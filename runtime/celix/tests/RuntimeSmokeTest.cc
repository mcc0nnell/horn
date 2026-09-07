#include "HornDocumentAdapter.h"
#include "horn/rules/IHornRule.h"
#include "horn/rules/RuleUtils.h"

#include <cassert>
#include <memory>
#include <string>
#include <vector>

namespace horn::rules {
std::shared_ptr<IHornRule> createClaimAtomicityRule();
std::shared_ptr<IHornRule> createFocusClaimFormulationRule();
std::shared_ptr<IHornRule> createFocusBoxRule();
std::shared_ptr<IHornRule> createArgumentReadingDirectionRule();
}

int main(int argc, char** argv) {
    assert(argc == 2);
    const auto document = horn::rules::loadHornDocumentView(argv[1]);

    assert(document.id == "horn:authored:test:rule-violations");
    assert(document.version == "horn-document/0.1");
    assert(document.nodes.size() == 2);
    assert(document.relations.size() == 1);
    assert(document.nodes.front().focus);

    auto focusBox = horn::rules::createFocusBoxRule();
    auto readingDirection = horn::rules::createArgumentReadingDirectionRule();
    auto claimAtomicity = horn::rules::createClaimAtomicityRule();
    auto focusFormulation = horn::rules::createFocusClaimFormulationRule();

    assert(focusBox->evaluate(document).empty());

    const auto readingDiagnostics = readingDirection->evaluate(document);
    assert(readingDiagnostics.size() == 1);
    assert(readingDiagnostics.front().ruleId == "horn.rules.1998.argument-reading-direction");
    assert(readingDiagnostics.front().targetId == "r-evidence-focus");

    const auto atomicityDiagnostics = claimAtomicity->evaluate(document);
    assert(atomicityDiagnostics.size() == 1);
    assert(atomicityDiagnostics.front().ruleId == "horn.rules.2003.claim-atomicity");
    assert(atomicityDiagnostics.front().targetId == "focus");

    const auto formulationDiagnostics = focusFormulation->evaluate(document);
    assert(formulationDiagnostics.size() == 1);
    assert(formulationDiagnostics.front().ruleId == "horn.rules.2003.focus-claim-formulation");
    assert(formulationDiagnostics.front().targetId == "focus");

    std::vector<horn::rules::Diagnostic> combined{};
    combined.insert(combined.end(), atomicityDiagnostics.begin(), atomicityDiagnostics.end());
    combined.insert(combined.end(), formulationDiagnostics.begin(), formulationDiagnostics.end());
    horn::rules::sortDiagnostics(combined);
    assert(combined.size() == 2);
    assert(combined[0].ruleId < combined[1].ruleId);

    return 0;
}
