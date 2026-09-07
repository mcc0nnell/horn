package org.mcc0nnell.horn.zeppelin;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.apache.zeppelin.interpreter.Interpreter;
import org.apache.zeppelin.interpreter.InterpreterContext;
import org.apache.zeppelin.interpreter.InterpreterException;
import org.apache.zeppelin.interpreter.InterpreterResult;
import org.apache.zeppelin.interpreter.InterpreterResult.Code;
import org.apache.zeppelin.interpreter.InterpreterResult.Type;

/**
 * Thin Apache Zeppelin interpreter for canonical HORN documents.
 *
 * <p>This class deliberately contains no HORN validation, rendering, graph,
 * provenance, or layout semantics. It validates only its execution boundary,
 * then delegates to the repository's transport-neutral TypeScript adapter.</p>
 */
public class HornInterpreter extends Interpreter {
  static final String PROP_REPO = "horn.repo";
  static final String PROP_NPM = "horn.npm";
  static final String PROP_TIMEOUT = "horn.command.timeout.millis";

  private static final long DEFAULT_TIMEOUT_MILLIS = 60_000L;
  private static final Set<String> COMMANDS =
      Set.of("render", "network", "audit", "manifest", "validate");

  private Path repositoryRoot;
  private String npmCommand;
  private long timeoutMillis;

  public HornInterpreter(Properties properties) {
    super(properties);
  }

  @Override
  public void open() throws InterpreterException {
    String configuredRepository = firstNonBlank(
        getProperty(PROP_REPO), System.getenv("HORN_REPO"));
    if (configuredRepository == null) {
      throw new InterpreterException(
          "HORN repository is not configured; set horn.repo or HORN_REPO");
    }

    Path candidate = Paths.get(configuredRepository).toAbsolutePath().normalize();
    if (!Files.isDirectory(candidate)) {
      throw new InterpreterException("HORN repository does not exist: " + candidate);
    }
    if (!Files.isRegularFile(candidate.resolve("src/zeppelin/cli.ts"))) {
      throw new InterpreterException(
          "Configured HORN repository does not contain src/zeppelin/cli.ts: " + candidate);
    }
    if (!Files.isRegularFile(candidate.resolve("package.json"))) {
      throw new InterpreterException(
          "Configured HORN repository does not contain package.json: " + candidate);
    }

    repositoryRoot = candidate;
    npmCommand = firstNonBlank(getProperty(PROP_NPM), System.getenv("HORN_NPM"), "npm");
    timeoutMillis = parsePositiveLong(
        firstNonBlank(getProperty(PROP_TIMEOUT), System.getenv("HORN_COMMAND_TIMEOUT_MILLIS")),
        DEFAULT_TIMEOUT_MILLIS,
        PROP_TIMEOUT);
  }

  @Override
  public void close() {
    // No persistent runtime is owned by the interpreter.
  }

  @Override
  public InterpreterResult interpret(String statement, InterpreterContext context) {
    try {
      ensureOpen();
      HornCommand command = parse(statement);
      Path relativeDocument = resolveDocument(command.documentPath);
      CommandResult commandResult = executeCli(command.view, relativeDocument);

      if (commandResult.exitCode != 0) {
        return new InterpreterResult(Code.ERROR, Type.TEXT, commandResult.output);
      }
      return mapResult(command.view, commandResult.output);
    } catch (InterpreterException exception) {
      return new InterpreterResult(Code.ERROR, Type.TEXT, exception.getMessage());
    } catch (IOException exception) {
      return new InterpreterResult(
          Code.ERROR, Type.TEXT, "Unable to execute HORN adapter: " + exception.getMessage());
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      return new InterpreterResult(Code.ERROR, Type.TEXT, "HORN execution was interrupted");
    }
  }

  @Override
  public void cancel(InterpreterContext context) {
    // Z1-B is FIFO and each command has a hard timeout. Process-scoped cancellation
    // can be added later without changing the HORN authority boundary.
  }

  @Override
  public FormType getFormType() {
    return FormType.NONE;
  }

  @Override
  public int getProgress(InterpreterContext context) {
    return 0;
  }

  protected CommandResult executeCli(String view, Path relativeDocument)
      throws IOException, InterruptedException, InterpreterException {
    Path outputFile = Files.createTempFile("horn-zeppelin-", ".out");
    try {
      ProcessBuilder builder = new ProcessBuilder(List.of(
          npmCommand,
          "run",
          "--silent",
          "horn-zeppelin",
          "--",
          view,
          relativeDocument.toString()));
      builder.directory(repositoryRoot.toFile());
      builder.redirectErrorStream(true);
      builder.redirectOutput(outputFile.toFile());

      Process process = builder.start();
      boolean finished = process.waitFor(timeoutMillis, TimeUnit.MILLISECONDS);
      if (!finished) {
        process.destroy();
        if (!process.waitFor(2, TimeUnit.SECONDS)) {
          process.destroyForcibly();
          process.waitFor();
        }
        throw new InterpreterException(
            "HORN command timed out after " + timeoutMillis + " ms");
      }

      String output = Files.readString(outputFile, StandardCharsets.UTF_8);
      return new CommandResult(process.exitValue(), output);
    } finally {
      Files.deleteIfExists(outputFile);
    }
  }

  private InterpreterResult mapResult(String view, String output) throws InterpreterException {
    switch (view) {
      case "render":
        return new InterpreterResult(
            Code.SUCCESS, Type.HTML, stripRequiredPrefix(output, "%html\n", "render"));
      case "network":
        return new InterpreterResult(
            Code.SUCCESS, Type.NETWORK, stripRequiredPrefix(output, "%network ", "network").trim());
      case "audit":
      case "manifest":
      case "validate":
        return new InterpreterResult(Code.SUCCESS, Type.TEXT, output);
      default:
        throw new InterpreterException("Unsupported HORN view: " + view);
    }
  }

  private static String stripRequiredPrefix(String output, String prefix, String view)
      throws InterpreterException {
    if (!output.startsWith(prefix)) {
      throw new InterpreterException(
          "HORN adapter returned an unexpected " + view + " result envelope");
    }
    return output.substring(prefix.length());
  }

  private HornCommand parse(String statement) throws InterpreterException {
    if (statement == null || statement.trim().isEmpty()) {
      throw usage("HORN paragraph is empty");
    }

    String trimmed = statement.trim();
    int separator = firstWhitespace(trimmed);
    if (separator < 0) {
      throw usage("HORN paragraph is missing a document path");
    }

    String view = trimmed.substring(0, separator).toLowerCase(Locale.ROOT);
    String documentPath = trimmed.substring(separator).trim();
    if (!COMMANDS.contains(view)) {
      throw usage("Unknown HORN view: " + view);
    }
    if (documentPath.isEmpty()) {
      throw usage("HORN paragraph is missing a document path");
    }

    return new HornCommand(view, documentPath);
  }

  private Path resolveDocument(String documentPath) throws InterpreterException {
    Path requested;
    try {
      requested = Paths.get(documentPath);
    } catch (RuntimeException exception) {
      throw new InterpreterException("Invalid HORN document path: " + documentPath);
    }

    if (requested.isAbsolute()) {
      throw new InterpreterException("HORN document paths must be repository-relative");
    }
    if (!documentPath.endsWith(".horn.json")) {
      throw new InterpreterException("HORN document path must end with .horn.json");
    }

    Path resolved = repositoryRoot.resolve(requested).normalize();
    if (!resolved.startsWith(repositoryRoot)) {
      throw new InterpreterException("HORN document path escapes the configured repository");
    }
    if (!Files.isRegularFile(resolved)) {
      throw new InterpreterException("HORN document does not exist: " + documentPath);
    }

    return repositoryRoot.relativize(resolved);
  }

  private void ensureOpen() throws InterpreterException {
    if (repositoryRoot == null || npmCommand == null) {
      throw new InterpreterException("HORN interpreter is not open");
    }
  }

  private static int firstWhitespace(String value) {
    for (int index = 0; index < value.length(); index++) {
      if (Character.isWhitespace(value.charAt(index))) {
        return index;
      }
    }
    return -1;
  }

  private static InterpreterException usage(String message) {
    return new InterpreterException(
        message + "; expected: <render|network|audit|manifest|validate> <path.horn.json>");
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.trim().isEmpty()) {
        return value.trim();
      }
    }
    return null;
  }

  private static long parsePositiveLong(String value, long defaultValue, String property)
      throws InterpreterException {
    if (value == null) {
      return defaultValue;
    }
    try {
      long parsed = Long.parseLong(value);
      if (parsed <= 0) {
        throw new NumberFormatException("not positive");
      }
      return parsed;
    } catch (NumberFormatException exception) {
      throw new InterpreterException(property + " must be a positive integer");
    }
  }

  static final class HornCommand {
    final String view;
    final String documentPath;

    HornCommand(String view, String documentPath) {
      this.view = view;
      this.documentPath = documentPath;
    }
  }

  protected static class CommandResult {
    final int exitCode;
    final String output;

    protected CommandResult(int exitCode, String output) {
      this.exitCode = exitCode;
      this.output = output;
    }
  }
}
