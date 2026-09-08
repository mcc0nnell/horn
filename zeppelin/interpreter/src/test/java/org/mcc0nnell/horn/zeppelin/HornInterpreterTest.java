package org.mcc0nnell.horn.zeppelin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Properties;

import org.apache.zeppelin.interpreter.InterpreterResult;
import org.apache.zeppelin.interpreter.InterpreterResult.Code;
import org.apache.zeppelin.interpreter.InterpreterResult.Type;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class HornInterpreterTest {
  private static final ObjectMapper JSON = new ObjectMapper();

  @TempDir
  Path repository;

  private StubHornInterpreter interpreter;

  @BeforeEach
  void setUp() throws Exception {
    Files.createDirectories(repository.resolve("src/zeppelin"));
    Files.createDirectories(repository.resolve("maps"));
    Files.createDirectories(repository.resolve("requests"));
    Files.createDirectories(repository.resolve("evidence"));
    Files.writeString(repository.resolve("src/zeppelin/cli.ts"), "// fixture\n");
    Files.writeString(repository.resolve("package.json"), "{}\n");
    Files.writeString(repository.resolve("maps/example.horn.json"),
        "{\"version\":\"horn-document/0.1\",\"id\":\"horn:test\"}\n");
    Files.writeString(repository.resolve("maps/with space.horn.json"),
        "{\"version\":\"horn-document/0.1\",\"id\":\"horn:space\"}\n");
    Files.writeString(repository.resolve("maps/after.horn.json"),
        "{\"version\":\"horn-document/0.1\",\"id\":\"horn:after\"}\n");
    Files.writeString(repository.resolve("requests/node lookup.json"),
        "{\"version\":\"horn-query/0.1\",\"op\":\"node-lookup\",\"id\":\"c1\"}\n");
    Files.writeString(repository.resolve("evidence/physical.json"), "{\"components\":{}}\n");
    Files.writeString(repository.resolve("evidence/bindings.json"), "{\"bindings\":[]}\n");
    Files.writeString(repository.resolve("evidence/support pack.json"),
        "{\"version\":\"horn-argument/0.1\"}\n");

    Properties properties = new Properties();
    properties.setProperty(HornInterpreter.PROP_REPO, repository.toString());
    properties.setProperty(HornInterpreter.PROP_NPM, "npm");
    properties.setProperty(HornInterpreter.PROP_CELIX, "build/native/horn_celix");
    properties.setProperty(HornInterpreter.PROP_TIMEOUT, "5000");
    interpreter = new StubHornInterpreter(properties);
    interpreter.open();
  }

  @Test
  void mapsRenderThroughPresentationPlane() {
    interpreter.cliResult =
        new HornInterpreter.CommandResult(0, "%html\n<section>mural</section>\n");

    InterpreterResult result = interpreter.interpret("render maps/example.horn.json", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals(Type.HTML, result.message().get(0).getType());
    assertEquals("<section>mural</section>\n", result.message().get(0).getData());
    assertEquals("render", interpreter.lastCliView);
    assertEquals(Path.of("maps/example.horn.json"), interpreter.lastCliDocument);
    assertEquals(null, interpreter.lastCelixView);
  }

  @Test
  void directQueryStillUsesDiscoveredQueryServiceWithoutSessionEnvelope() {
    interpreter.celixResult = new HornInterpreter.CommandResult(
        0, "{\"version\":\"horn-query-result/0.1\",\"ok\":true}\n");

    InterpreterResult result = interpreter.interpret(
        "query maps/example.horn.json \"requests/node lookup.json\"", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals("query", interpreter.lastCelixView);
    assertEquals(List.of(
        "query",
        repository.resolve("maps/example.horn.json").toString(),
        repository.resolve("requests/node lookup.json").toString()),
        interpreter.lastCelixArgs);
    assertEquals(null, interpreter.lastSessionRequest);
  }

  @Test
  void compositionTransportsOpaqueCelixSessionAndLeavesPointerUnresolvedInJava() throws Exception {
    interpreter.celixResult = sessionResponse(
        "{\"version\":\"horn-query-result/0.1\",\"node\":{\"id\":\"c1\"}}",
        "[{\"name\":\"lookup\",\"command\":\"query\",\"value\":{\"node\":{\"id\":\"c1\"}}}]",
        "celix-owned");

    InterpreterResult first = interpreter.interpret(
        "let lookup = query maps/example.horn.json \"requests/node lookup.json\"", null);

    assertEquals(Code.SUCCESS, first.code());
    assertEquals("session", interpreter.lastCelixView);
    assertEquals("session", interpreter.lastCelixArgs.get(0));
    assertEquals("query", interpreter.lastSessionRequest.path("command").path("op").asText());
    assertEquals("lookup", interpreter.lastSessionRequest.path("bind").asText());
    assertEquals("canonical",
        interpreter.lastSessionRequest.path("command").path("document").path("authority").asText());
    assertEquals("node-lookup",
        interpreter.lastSessionRequest.path("command").path("request").path("value").path("op").asText());
    Path firstRequestFile = interpreter.lastSessionRequestFile;
    assertFalse(Files.exists(firstRequestFile), "session request temp file must be deleted");

    interpreter.celixResult = sessionResponse(
        "{\"version\":\"horn-explanation/0.1\",\"identity\":\"c1\",\"ok\":true}",
        "[{\"name\":\"lookup\",\"command\":\"query\",\"value\":{\"node\":{\"id\":\"c1\"}}}]",
        "celix-owned");

    InterpreterResult second = interpreter.interpret(
        "explain maps/example.horn.json @lookup#/node/id", null);

    assertEquals(Code.SUCCESS, second.code());
    assertTrue(second.message().get(0).getData().contains("horn-explanation/0.1"));
    assertEquals("celix-owned",
        interpreter.lastSessionRequest.path("session").path("opaqueMarker").asText());
    assertEquals("@lookup#/node/id",
        interpreter.lastSessionRequest.path("command").path("identity").path("ref").asText());
    assertFalse(
        interpreter.lastSessionRequest.path("command").path("identity").has("value"),
        "Java must not resolve the JSON Pointer before Celix sees it");
  }

  @Test
  void bindingsIsAReasoningSessionOperationNotAJavaRegistry() throws Exception {
    interpreter.celixResult = sessionResponse(
        "{\"version\":\"horn-reasoning-bindings/0.1\",\"ephemeral\":true,\"bindings\":[]}",
        "[]",
        "opaque");

    InterpreterResult result = interpreter.interpret("bindings", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals("session", interpreter.lastCelixView);
    assertEquals("bindings", interpreter.lastSessionRequest.path("command").path("op").asText());
    assertTrue(result.message().get(0).getData().contains("horn-reasoning-bindings/0.1"));
  }

  @Test
  void failedSessionCallDoesNotReplaceLastGoodOpaqueEnvelope() throws Exception {
    interpreter.celixResult = sessionResponse(
        "{\"version\":\"horn-query-result/0.1\"}",
        "[{\"name\":\"lookup\",\"value\":{\"node\":{\"id\":\"c1\"}}}]",
        "good-state");
    assertEquals(Code.SUCCESS,
        interpreter.interpret(
            "let lookup = query maps/example.horn.json \"requests/node lookup.json\"", null).code());

    interpreter.celixResult = new HornInterpreter.CommandResult(1, "session failure\n");
    assertEquals(Code.ERROR,
        interpreter.interpret("explain maps/example.horn.json @lookup#/node/id", null).code());

    interpreter.celixResult = sessionResponse(
        "{\"version\":\"horn-reasoning-bindings/0.1\",\"ephemeral\":true,\"bindings\":[]}",
        "[]",
        "after-inspection");
    assertEquals(Code.SUCCESS, interpreter.interpret("bindings", null).code());
    assertEquals("good-state",
        interpreter.lastSessionRequest.path("session").path("opaqueMarker").asText());
  }

  @Test
  void derivedBindingsCannotOccupyCanonicalDocumentPositions() {
    interpreter.lastCelixView = null;

    InterpreterResult result = interpreter.interpret(
        "diff @lookup maps/after.horn.json", null);

    assertEquals(Code.ERROR, result.code());
    assertTrue(result.message().get(0).getData().contains(
        "Derived notebook bindings cannot be used as HORN documents"));
    assertEquals(null, interpreter.lastCelixView);
  }

  @Test
  void impactAndDiffDirectPathsRemainFileOriented() {
    interpreter.celixResult = new HornInterpreter.CommandResult(0, "{}\n");

    assertEquals(Code.SUCCESS,
        interpreter.interpret(
            "impact maps/example.horn.json evidence/physical.json evidence/bindings.json", null).code());
    assertEquals(List.of(
        "impact",
        repository.resolve("maps/example.horn.json").toString(),
        repository.resolve("evidence/physical.json").toString(),
        repository.resolve("evidence/bindings.json").toString()),
        interpreter.lastCelixArgs);

    assertEquals(Code.SUCCESS,
        interpreter.interpret("diff maps/example.horn.json maps/after.horn.json", null).code());
    assertEquals("diff", interpreter.lastCelixArgs.get(0));
  }

  @Test
  void preservesSpacesAndRejectsTraversalBeforeExecution() {
    interpreter.celixResult = new HornInterpreter.CommandResult(0, "{}\n");

    assertEquals(Code.SUCCESS,
        interpreter.interpret("validate maps/with space.horn.json", null).code());
    assertEquals(repository.resolve("maps/with space.horn.json").toString(),
        interpreter.lastCelixArgs.get(1));

    interpreter.lastCelixView = null;
    InterpreterResult traversal = interpreter.interpret(
        "query maps/example.horn.json ../outside.json", null);
    assertEquals(Code.ERROR, traversal.code());
    assertTrue(traversal.message().get(0).getData().contains("escapes the configured repository"));
    assertEquals(null, interpreter.lastCelixView);
  }

  @Test
  void rejectsSessionBindingForUnsupportedRuntimeOrInspectComposition() {
    InterpreterResult runtime = interpreter.interpret("let r = runtime", null);
    assertEquals(Code.ERROR, runtime.code());
    assertTrue(runtime.message().get(0).getData().contains("can bind validate, query"));

    InterpreterResult inspect = interpreter.interpret(
        "let packet = inspect maps/example.horn.json", null);
    assertEquals(Code.ERROR, inspect.code());
    assertTrue(inspect.message().get(0).getData().contains("can bind validate, query"));
  }

  @Test
  void propagatesCelixSessionFailureAsInterpreterError() {
    interpreter.celixResult = new HornInterpreter.CommandResult(
        1, "Celix service not found: horn::IReasoningSessionService\n");

    InterpreterResult result = interpreter.interpret(
        "let lookup = query maps/example.horn.json \"requests/node lookup.json\"", null);

    assertEquals(Code.ERROR, result.code());
    assertEquals(Type.TEXT, result.message().get(0).getType());
    assertTrue(result.message().get(0).getData().contains("IReasoningSessionService"));
  }

  private static HornInterpreter.CommandResult sessionResponse(
      String result,
      String bindings,
      String opaqueMarker) {
    String response = "{"
        + "\"version\":\"horn-reasoning-session-response/0.1\","
        + "\"session\":{"
        + "\"version\":\"horn-reasoning-session/0.1\","
        + "\"id\":\"__horn_default_note__\","
        + "\"ephemeral\":true,"
        + "\"opaqueMarker\":\"" + opaqueMarker + "\","
        + "\"bindings\":" + bindings
        + "},"
        + "\"result\":" + result
        + "}\n";
    return new HornInterpreter.CommandResult(0, response);
  }

  private static final class StubHornInterpreter extends HornInterpreter {
    CommandResult cliResult = new CommandResult(0, "{}\n");
    CommandResult celixResult = new CommandResult(0, "{}\n");
    String lastCliView;
    Path lastCliDocument;
    String lastCelixView;
    List<String> lastCelixArgs;
    JsonNode lastSessionRequest;
    Path lastSessionRequestFile;

    StubHornInterpreter(Properties properties) {
      super(properties);
    }

    @Override
    protected CommandResult executeCli(String view, Path relativeDocument) {
      lastCliView = view;
      lastCliDocument = relativeDocument;
      return cliResult;
    }

    @Override
    protected CommandResult executeCelix(String view, List<String> nativeArgs) throws IOException {
      lastCelixView = view;
      lastCelixArgs = List.copyOf(nativeArgs);
      lastSessionRequest = null;
      lastSessionRequestFile = null;
      if (!nativeArgs.isEmpty() && "session".equals(nativeArgs.get(0))) {
        lastSessionRequestFile = Path.of(nativeArgs.get(1));
        lastSessionRequest = JSON.readTree(Files.readString(lastSessionRequestFile));
      }
      return celixResult;
    }
  }
}
