#include "HornDocumentAdapter.h"

#include <rapidjson/document.h>
#include <rapidjson/error/en.h>

#include <fstream>
#include <iterator>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>

namespace horn::rules {
namespace {

std::string requiredString(const rapidjson::Value& object, const char* key, const char* context) {
    if (!object.IsObject() || !object.HasMember(key) || !object[key].IsString()) {
        throw std::runtime_error{std::string{context} + " requires string field '" + key + "'"};
    }
    return object[key].GetString();
}

int requiredInt(const rapidjson::Value& object, const char* key, const char* context) {
    if (!object.IsObject() || !object.HasMember(key) || !object[key].IsInt()) {
        throw std::runtime_error{std::string{context} + " requires integer field '" + key + "'"};
    }
    return object[key].GetInt();
}

std::optional<int> optionalInt(const rapidjson::Value& object, const char* key) {
    if (!object.IsObject() || !object.HasMember(key) || object[key].IsNull()) {
        return std::nullopt;
    }
    if (!object[key].IsInt()) {
        throw std::runtime_error{std::string{"field '"} + key + "' must be an integer when present"};
    }
    return object[key].GetInt();
}

bool optionalBool(const rapidjson::Value& object, const char* key) {
    if (!object.IsObject() || !object.HasMember(key) || object[key].IsNull()) {
        return false;
    }
    if (!object[key].IsBool()) {
        throw std::runtime_error{std::string{"field '"} + key + "' must be boolean when present"};
    }
    return object[key].GetBool();
}

} // namespace

HornDocumentView loadHornDocumentView(const std::filesystem::path& path) {
    std::ifstream input{path, std::ios::binary};
    if (!input) {
        throw std::runtime_error{"cannot open Horn document: " + path.string()};
    }

    const std::string json{std::istreambuf_iterator<char>{input}, std::istreambuf_iterator<char>{}};
    rapidjson::Document parsed{};
    parsed.Parse(json.c_str(), json.size());
    if (parsed.HasParseError()) {
        throw std::runtime_error{
            "invalid JSON at offset " + std::to_string(parsed.GetErrorOffset()) + ": " +
            rapidjson::GetParseError_En(parsed.GetParseError())};
    }
    if (!parsed.IsObject()) {
        throw std::runtime_error{"Horn document root must be a JSON object"};
    }

    HornDocumentView document{};
    document.id = requiredString(parsed, "id", "Horn document");
    document.version = requiredString(parsed, "version", "Horn document");
    document.authority = requiredString(parsed, "authority", "Horn document");
    document.issueQuestion = requiredString(parsed, "issueQuestion", "Horn document");

    if (!parsed.HasMember("nodes") || !parsed["nodes"].IsArray()) {
        throw std::runtime_error{"Horn document requires array field 'nodes'"};
    }
    for (const auto& value : parsed["nodes"].GetArray()) {
        HornNodeView node{};
        node.id = requiredString(value, "id", "Horn node");
        node.number = requiredInt(value, "number", "Horn node");
        node.kind = requiredString(value, "kind", "Horn node");
        node.label = requiredString(value, "label", "Horn node");
        node.text = requiredString(value, "text", "Horn node");
        node.focus = optionalBool(value, "focus");
        node.year = optionalInt(value, "year");
        document.nodes.emplace_back(std::move(node));
    }

    if (!parsed.HasMember("relations") || !parsed["relations"].IsArray()) {
        throw std::runtime_error{"Horn document requires array field 'relations'"};
    }
    for (const auto& value : parsed["relations"].GetArray()) {
        HornRelationView relation{};
        relation.id = requiredString(value, "id", "Horn relation");
        relation.kind = requiredString(value, "kind", "Horn relation");
        relation.from = requiredString(value, "from", "Horn relation");
        relation.to = requiredString(value, "to", "Horn relation");
        relation.label = requiredString(value, "label", "Horn relation");
        document.relations.emplace_back(std::move(relation));
    }

    return document;
}

} // namespace horn::rules
