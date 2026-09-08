package org.mcc0nnell.horn.zeppelin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    Files.writeString(repository.resolve("maps/example.horn.json"), "{}\n");
    Files.writeString(repository.resolve("maps/with space.horn.json"), "{}\n");
    Files.writeString(repository.resolve("maps/after.horn.json"), "{}\n");
    Files.writeString(repository.resolve("requests/node lookup.json"), "{}\n");
    Files.writeString(repository.resolve("evidence/physical.json"), "{}\n");
    Files.writeString(repository.resolve("evidence/bindings.json"), "{}\n");
    Files.writeString(repository.resolve("evidence/support pack.json"), "{}\n");

    Properties properties = new Properties();
    properties.setProperty(HornInterpreter.PROP_REPO, repository.toString());
    properties.setProperty(HornInterpreter.PROP_NPM, "npm");
    properties.setProperty(HornInterpreter.PROP_CELIX, "build/native/horn_celix");
    properties.setProperty(HornInterpreter.PROP_TIMEOUT, "5000");
    interpreter = new StubHornInterpreter(properties);
    interpreter.open();
  }

  @Test
  void mapsRenderToNativeHtmlThroughPresentationPlane() {
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
  void runtimeProbesDiscoveredCelixServicePlaneWithoutDocument() {
    interpreter.celixResult = new HornInterpreter.CommandResult(
        0, "{\"version\":\"horn-celix-probe/0.1\",\"ok\":true}\n");

    InterpreterResult result = interpreter.interpret("runtime", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals(Type.TEXT, result.message().get(0).getType());
    assertEquals("runtime", interpreter.lastCelixView);
    assertEquals(List.of("probe"), interpreter.lastCelixArgs);
  }

  @Test
  void validateAndInspectRouteThroughCelix() {
    interpreter.celixResult = new HornInterpreter.CommandResult(0, "{}\n");

    assertEquals(Code.SUCCESS,
        interpreter.interpret("validate maps/example.horn.json", null).code());
    assertEquals("validate", interpreter.lastCelixView);
    assertEquals("validate", interpreter.lastCelixArgs.get(0));

    assertEquals(Code.SUCCESS,
        interpreter.interpret("inspect maps/example.horn.json", null).code());
    assertEquals("inspect", interpreter.lastCelixView);
    assertTrue(interpreter.lastCelixArgs.contains("argument"));
    assertTrue(interpreter.lastCelixArgs.contains("frontier"));
  }

  @Test
  void queryRoutesRequestFileThroughIQueryService() {
    interpreter.celixResult = new HornInterpreter.CommandResult(
        0, "{\"version\":\"horn-query-result/0.1\",\"ok\":true}\n");

    InterpreterResult result = interpreter.interpret(
        "query maps/example.horn.json \"requests/node lookup.json\"", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals(Type.TEXT, result.message().get(0).getType());
    assertEquals("query", interpreter.lastCelixView);
    assertEquals(List.of(
        "query",
        repository.resolve("maps/example.horn.json").toString(),
        repository.resolve("requests/node lookup.json").toString()),
        interpreter.lastCelixArgs);
  }

  @Test
  void explainRoutesIdentityAndOptionalSupportFiles() {
    interpreter.celixResult = new HornInterpreter.CommandResult(
        0, "{\"version\":\"horn-explanation/0.1\",\"ok\":true}\n");

    InterpreterResult result = interpreter.interpret(
        "explain maps/example.horn.json c1 \"evidence/support pack.json\"", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals("explain", interpreter.lastCelixView);
    assertEquals(List.of(
        "explain",
        repository.resolve("maps/example.horn.json").toString(),
        "c1",
        repository.resolve("evidence/support pack.json").toString()),
        interpreter.lastCelixArgs);
  }

  @Test
  void impactRoutesEvidenceAndBindingsWithoutSourceMutation() {
    interpreter.celixResult = new HornInterpreter.CommandResult(
        0, "{\"version\":\"horn-impact-report/0.1\",\"mutatesSource\":false}\n");

    InterpreterResult result = interpreter.interpret(
        "impact maps/example.horn.json evidence/physical.json evidence/bindings.json", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals("impact", interpreter.lastCelixView);
    assertEquals(List.of(
        "impact",
        repository.resolve("maps/example.horn.json").toString(),
        repository.resolve("evidence/physical.json").toString(),
        repository.resolve("evidence/bindings.json").toString()),
        interpreter.lastCelixArgs);
  }

  @Test
  void diffRoutesTwoCanonicalDocuments() {
    interpreter.celixResult = new HornInterpreter.CommandResult(
        0, "{\"version\":\"horn-diff/0.1\"}\n");

    InterpreterResult result = interpreter.interpret(
        "diff maps/example.horn.json maps/after.horn.json", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals("diff", interpreter.lastCelixView);
    assertEquals(List.of(
        "diff",
        repository.resolve("maps/example.horn.json").toString(),
        repository.resolve("maps/after.horn.json").toString()),
        interpreter.lastCelixArgs);
  }

  @Test
  void preservesSpacesInSingleDocumentPathAndQuotedMultiOperandPath() {
    interpreter.celixResult = new HornInterpreter.CommandResult(0, "{}\n");

    assertEquals(Code.SUCCESS,
        interpreter.interpret("validate maps/with space.horn.json", null).code());
    assertEquals(
        repository.resolve("maps/with space.horn.json").toString(),
        interpreter.lastCelixArgs.get(1));

    assertEquals(Code.SUCCESS,
        interpreter.interpret(
            "diff \"maps/with space.horn.json\" maps/after.horn.json", null).code());
    assertEquals(
        repository.resolve("maps/with space.horn.json").toString(),
        interpreter.lastCelixArgs.get(1));
  }

  @Test
  void rejectsTraversalInAnalysisOperandBeforeExecution() {
    InterpreterResult result = interpreter.interpret(
        "query maps/example.horn.json ../outside.json", null);

    assertEquals(Code.ERROR, result.code());
    assertTrue(result.message().get(0).getData().contains("escapes the configured repository"));
    assertEquals(null, interpreter.lastCelixView);
  }

  @Test
  void rejectsAbsoluteDocumentPathsBeforeExecution() {
    InterpreterResult result = interpreter.interpret(
        "render " + repository.resolve("maps/example.horn.json").toAbsolutePath(), null);

    assertEquals(Code.ERROR, result.code());
    assertTrue(result.message().get(0).getData().contains("repository-relative"));
  }

  @Test
  void rejectsWrongOperandCountAndUnterminatedQuotes() {
    InterpreterResult missing = interpreter.interpret(
        "impact maps/example.horn.json evidence/physical.json", null);
    assertEquals(Code.ERROR, missing.code());
    assertTrue(missing.message().get(0).getData().contains("Wrong operand count"));

    InterpreterResult quote = interpreter.interpret(
        "query maps/example.horn.json \"requests/node lookup.json", null);
    assertEquals(Code.ERROR, quote.code());
    assertTrue(quote.message().get(0).getData().contains("unterminated quoted operand"));
  }

  @Test
  void rejectsUnknownViewsAndNonHornDocuments() throws IOException {
    InterpreterResult unknown = interpreter.interpret("layout maps/example.horn.json", null);
    assertEquals(Code.ERROR, unknown.code());
    assertTrue(unknown.message().get(0).getData().contains("Unknown HORN view"));

    Files.writeString(repository.resolve("maps/example.json"), "{}\n");
    InterpreterResult nonHorn = interpreter.interpret("render maps/example.json", null);
    assertEquals(Code.ERROR, nonHorn.code());
    assertTrue(nonHorn.message().get(0).getData().contains("must end with .horn.json"));
  }

  @Test
  void propagatesCelixFailureAsInterpreterError() {
    interpreter.celixResult = new HornInterpreter.CommandResult(
        1, "Celix service not found: horn::IQueryService\n");

    InterpreterResult result = interpreter.interpret(
        "query maps/example.horn.json \"requests/node lookup.json\"", null);

    assertEquals(Code.ERROR, result.code());
    assertEquals(Type.TEXT, result.message().get(0).getType());
    assertTrue(result.message().get(0).getData().contains("IQueryService"));
  }

  @Test
  void rejectsMalformedAdapterDisplayEnvelope() {
    interpreter.cliResult =
        new HornInterpreter.CommandResult(0, "<section>missing marker</section>");

    InterpreterResult result = interpreter.interpret("render maps/example.horn.json", null);

    assertEquals(Code.ERROR, result.code());
    assertTrue(result.message().get(0).getData().contains("unexpected render result envelope"));
  }

  private static final class StubHornInterpreter extends HornInterpreter {
    CommandResult cliResult = new CommandResult(0, "{}\n");
    CommandResult celixResult = new CommandResult(0, "{}\n");
    String lastCliView;
    Path lastCliDocument;
    String lastCelixView;
    List<String> lastCelixArgs;

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
    protected CommandResult executeCelix(String view, List<String> nativeArgs) {
      lastCelixView = view;
      lastCelixArgs = List.copyOf(nativeArgs);
      return celixResult;
    }
  }
}
