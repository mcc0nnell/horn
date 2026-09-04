package org.mcc0nnell.horn.zeppelin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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
    Files.writeString(repository.resolve("src/zeppelin/cli.ts"), "// fixture\n");
    Files.writeString(repository.resolve("package.json"), "{}\n");
    Files.writeString(repository.resolve("maps/example.horn.json"), "{}\n");
    Files.writeString(repository.resolve("maps/with space.horn.json"), "{}\n");

    Properties properties = new Properties();
    properties.setProperty(HornInterpreter.PROP_REPO, repository.toString());
    properties.setProperty(HornInterpreter.PROP_NPM, "npm");
    properties.setProperty(HornInterpreter.PROP_TIMEOUT, "5000");
    interpreter = new StubHornInterpreter(properties);
    interpreter.open();
  }

  @Test
  void mapsRenderToNativeHtml() {
    interpreter.result = new HornInterpreter.CommandResult(0, "%html\n<section>mural</section>\n");

    InterpreterResult result = interpreter.interpret("render maps/example.horn.json", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals(Type.HTML, result.message().get(0).getType());
    assertEquals("<section>mural</section>\n", result.message().get(0).getData());
    assertEquals("render", interpreter.lastView);
    assertEquals(Path.of("maps/example.horn.json"), interpreter.lastDocument);
  }

  @Test
  void mapsNetworkToNativeNetworkWithoutChangingPayload() {
    String network = "{\"nodes\":[],\"edges\":[],\"directed\":true,\"types\":[]}";
    interpreter.result = new HornInterpreter.CommandResult(0, "%network " + network + "\n");

    InterpreterResult result = interpreter.interpret("network maps/example.horn.json", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals(Type.NETWORK, result.message().get(0).getType());
    assertEquals(network, result.message().get(0).getData());
  }

  @Test
  void preservesSpacesInRepositoryRelativeDocumentPath() {
    interpreter.result = new HornInterpreter.CommandResult(0, "{\"valid\":true}\n");

    InterpreterResult result = interpreter.interpret("validate maps/with space.horn.json", null);

    assertEquals(Code.SUCCESS, result.code());
    assertEquals(Path.of("maps/with space.horn.json"), interpreter.lastDocument);
  }

  @Test
  void rejectsTraversalBeforeAdapterExecution() {
    InterpreterResult result = interpreter.interpret("render ../outside.horn.json", null);

    assertEquals(Code.ERROR, result.code());
    assertTrue(result.message().get(0).getData().contains("escapes the configured repository"));
    assertEquals(null, interpreter.lastView);
  }

  @Test
  void rejectsAbsolutePathsBeforeAdapterExecution() {
    InterpreterResult result = interpreter.interpret(
        "render " + repository.resolve("maps/example.horn.json").toAbsolutePath(), null);

    assertEquals(Code.ERROR, result.code());
    assertTrue(result.message().get(0).getData().contains("repository-relative"));
  }

  @Test
  void rejectsNonHornDocuments() throws IOException {
    Files.writeString(repository.resolve("maps/example.json"), "{}\n");

    InterpreterResult result = interpreter.interpret("render maps/example.json", null);

    assertEquals(Code.ERROR, result.code());
    assertTrue(result.message().get(0).getData().contains("must end with .horn.json"));
  }

  @Test
  void rejectsUnknownViews() {
    InterpreterResult result = interpreter.interpret("layout maps/example.horn.json", null);

    assertEquals(Code.ERROR, result.code());
    assertTrue(result.message().get(0).getData().contains("Unknown HORN view"));
  }

  @Test
  void propagatesAdapterFailureAsInterpreterError() {
    interpreter.result = new HornInterpreter.CommandResult(
        2, "{\"valid\":false,\"issues\":[{\"code\":\"invalid\"}]}\n");

    InterpreterResult result = interpreter.interpret("validate maps/example.horn.json", null);

    assertEquals(Code.ERROR, result.code());
    assertEquals(Type.TEXT, result.message().get(0).getType());
    assertTrue(result.message().get(0).getData().contains("\"valid\":false"));
  }

  @Test
  void rejectsMalformedAdapterDisplayEnvelope() {
    interpreter.result = new HornInterpreter.CommandResult(0, "<section>missing marker</section>");

    InterpreterResult result = interpreter.interpret("render maps/example.horn.json", null);

    assertEquals(Code.ERROR, result.code());
    assertTrue(result.message().get(0).getData().contains("unexpected render result envelope"));
  }

  private static final class StubHornInterpreter extends HornInterpreter {
    CommandResult result = new CommandResult(0, "{}\n");
    String lastView;
    Path lastDocument;

    StubHornInterpreter(Properties properties) {
      super(properties);
    }

    @Override
    protected CommandResult executeCli(String view, Path relativeDocument) {
      lastView = view;
      lastDocument = relativeDocument;
      return result;
    }
  }
}
