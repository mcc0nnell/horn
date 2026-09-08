package org.mcc0nnell.horn.zeppelin;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
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
 * provenance, or layout semantics. Presentation views delegate to the
 * transport-neutral TypeScript adapter. Headless analysis delegates to
 * horn_celix, which discovers the pinned libhorn services inside a real Celix
 * framework.</p>
 */
public class HornInterpreter extends Interpreter {
  static final String PROP_REPO = "horn.repo";
  static final String PROP_NPM = "horn.npm";
  static final String PROP_CELIX = "horn.celix";
  static final String PROP_TIMEOUT = "horn.command.timeout.millis";

  private static final long DEFAULT_TIMEOUT_MILLIS = 60_000L;
  private static final Set<String> PRESENTATION_COMMANDS =
      Set.of("render", "network", "audit", "manifest");
  private static final Set<String> SINGLE_DOCUMENT_ANALYSIS_COMMANDS =
      Set.of("validate", "inspect");
  private static final Set<String> MULTI_OPERAND_ANALYSIS_COMMANDS =
      Set.of("query", "explain", "impact", "diff");

  private Path repositoryRoot;
  private String npmCommand;
  private Path celixCommand;
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

    String configuredCelix = firstNonBlank(getProperty(PROP_CELIX), System.getenv("HORN_CELIX"));
    Path celixCandidate = configuredCelix == null
        ? repositoryRoot.resolve("build/native/horn_celix")
        : Paths.get(configuredCelix);
    if (!celixCandidate.isAbsolute()) {
      celixCandidate = repositoryRoot.resolve(celixCandidate);
    }
    celixCommand = celixCandidate.toAbsolutePath().normalize();

    timeoutMillis = parsePositiveLong(
        firstNonBlank(getProperty(PROP_TIMEOUT), System.getenv("HORN_COMMAND_TIMEOUT_MILLIS")),
        DEFAULT_TIMEOUT_MILLIS,
        PROP_TIMEOUT);
  }

  @Override
  public void close() {
    // No persistent runtime is owned by the interpreter. horn_celix owns one
    // framework for the duration of each headless command.
  }

  @Override
  public InterpreterResult interpret(String statement, InterpreterContext context) {
    try {
      ensureOpen();
      HornCommand command = parse(statement);

      CommandResult commandResult;
      if (PRESENTATION_COMMANDS.contains(command.view)) {
        Path relativeDocument = resolveDocument(command.operands.get(0));
        commandResult = executeCli(command.view, relativeDocument);
      } else {
        commandResult = executeCelix(command.view, buildCelixArgs(command));
      }
      return mapCommandResult(command.view, commandResult);
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
    return executeProcess(List.of(
        npmCommand,
        "run",
        "--silent",
        "horn-zeppelin",
        "--",
        view,
        relativeDocument.toString()));
  }

  protected CommandResult executeCelix(String view, List<String> nativeArgs)
      throws IOException, InterruptedException, InterpreterException {
    if (!Files.isRegularFile(celixCommand)) {
      throw new InterpreterException(
          "Pinned libhorn Celix driver not found: " + celixCommand
              + "; build with cmake -S native -B build/native -DHORN_WITH_CELIX=ON"
              + " && cmake --build build/native");
    }

    List<String> command = new ArrayList<>();
    command.add(celixCommand.toString());
    command.addAll(nativeArgs);
    return executeProcess(command);
  }

  private List<String> buildCelixArgs(HornCommand command) throws InterpreterException {
    List<String> args = new ArrayList<>();
    switch (command.view) {
      case "runtime":
        args.add("probe");
        break;
      case "validate":
        args.add("validate");
        args.add(absoluteDocument(command.operands.get(0)).toString());
        break;
      case "inspect":
        args.add("inspect");
        args.add(absoluteDocument(command.operands.get(0)).toString());
        args.add("--projection");
        args.add("argument");
        args.add("--projection");
        args.add("timeline");
        args.add("--projection");
        args.add("evidence");
        args.add("--projection");
        args.add("frontier");
        break;
      case "query":
        args.add("query");
        args.add(absoluteDocument(command.operands.get(0)).toString());
        args.add(resolveJsonFile("HORN query request", command.operands.get(1)).toString());
        break;
      case "explain":
        args.add("explain");
        args.add(absoluteDocument(command.operands.get(0)).toString());
        args.add(command.operands.get(1));
        for (int index = 2; index < command.operands.size(); index++) {
          args.add(resolveJsonFile("HORN explanation support", command.operands.get(index)).toString());
        }
        break;
      case "impact":
        args.add("impact");
        args.add(absoluteDocument(command.operands.get(0)).toString());
        args.add(resolveJsonFile("HORN evidence", command.operands.get(1)).toString());
        args.add(resolveJsonFile("HORN bindings", command.operands.get(2)).toString());
        break;
      case "diff":
        args.add("diff");
        args.add(absoluteDocument(command.operands.get(0)).toString());
        args.add(absoluteDocument(command.operands.get(1)).toString());
        break;
      default:
        throw new InterpreterException("Unsupported Celix-backed HORN view: " + command.view);
    }
    return args;
  }

  private Path absoluteDocument(String documentPath) throws InterpreterException {
    return repositoryRoot.resolve(resolveDocument(documentPath)).normalize();
  }

  private Path resolveJsonFile(String label, String path) throws InterpreterException {
    return resolveRepositoryFile(label, path, ".json");
  }

  private CommandResult executeProcess(List<String> command)
      throws IOException, InterruptedException, InterpreterException {
    Path outputFile = Files.createTempFile("horn-zeppelin-", ".out");
    try {
      ProcessBuilder builder = new ProcessBuilder(command);
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

  private InterpreterResult mapCommandResult(String view, CommandResult commandResult)
      throws InterpreterException {
    if (commandResult.exitCode != 0) {
      return new InterpreterResult(Code.ERROR, Type.TEXT, commandResult.output);
    }
    return mapResult(view, commandResult.output);
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
      case "inspect":
      case "runtime":
      case "query":
      case "explain":
      case "impact":
      case "diff":
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
    if ("runtime".equals(trimmed.toLowerCase(Locale.ROOT))) {
      return new HornCommand("runtime", List.of());
    }

    int separator = firstWhitespace(trimmed);
    if (separator < 0) {
      throw usage("HORN paragraph is missing operands");
    }

    String view = trimmed.substring(0, separator).toLowerCase(Locale.ROOT);
    String remainder = trimmed.substring(separator).trim();
    if (remainder.isEmpty()) {
      throw usage("HORN paragraph is missing operands");
    }

    if (PRESENTATION_COMMANDS.contains(view) || SINGLE_DOCUMENT_ANALYSIS_COMMANDS.contains(view)) {
      return new HornCommand(view, List.of(remainder));
    }
    if (!MULTI_OPERAND_ANALYSIS_COMMANDS.contains(view)) {
      throw usage("Unknown HORN view: " + view);
    }

    List<String> operands = tokenizeOperands(remainder);
    switch (view) {
      case "query":
        requireOperandCount(view, operands, 2, 2);
        break;
      case "explain":
        requireOperandCount(view, operands, 2, Integer.MAX_VALUE);
        break;
      case "impact":
        requireOperandCount(view, operands, 3, 3);
        break;
      case "diff":
        requireOperandCount(view, operands, 2, 2);
        break;
      default:
        throw usage("Unknown HORN view: " + view);
    }
    return new HornCommand(view, operands);
  }

  private static List<String> tokenizeOperands(String input) throws InterpreterException {
    List<String> tokens = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    char quote = 0;
    boolean escaping = false;
    boolean tokenStarted = false;

    for (int index = 0; index < input.length(); index++) {
      char c = input.charAt(index);
      if (escaping) {
        current.append(c);
        escaping = false;
        tokenStarted = true;
        continue;
      }
      if (c == '\\') {
        escaping = true;
        tokenStarted = true;
        continue;
      }
      if (quote != 0) {
        if (c == quote) {
          quote = 0;
        } else {
          current.append(c);
        }
        tokenStarted = true;
        continue;
      }
      if (c == '"' || c == '\'') {
        quote = c;
        tokenStarted = true;
        continue;
      }
      if (Character.isWhitespace(c)) {
        if (tokenStarted) {
          tokens.add(current.toString());
          current.setLength(0);
          tokenStarted = false;
        }
        continue;
      }
      current.append(c);
      tokenStarted = true;
    }

    if (escaping) {
      throw usage("HORN paragraph ends with an incomplete escape");
    }
    if (quote != 0) {
      throw usage("HORN paragraph contains an unterminated quoted operand");
    }
    if (tokenStarted) {
      tokens.add(current.toString());
    }
    return tokens;
  }

  private static void requireOperandCount(
      String view, List<String> operands, int minimum, int maximum) throws InterpreterException {
    if (operands.size() < minimum || operands.size() > maximum) {
      throw usage("Wrong operand count for HORN " + view);
    }
  }

  private Path resolveDocument(String documentPath) throws InterpreterException {
    Path resolved = resolveRepositoryFile("HORN document", documentPath, ".horn.json");
    return repositoryRoot.relativize(resolved);
  }

  private Path resolveRepositoryFile(String label, String path, String requiredSuffix)
      throws InterpreterException {
    Path requested;
    try {
      requested = Paths.get(path);
    } catch (RuntimeException exception) {
      throw new InterpreterException("Invalid " + label + " path: " + path);
    }

    if (requested.isAbsolute()) {
      throw new InterpreterException(label + " paths must be repository-relative");
    }
    if (!path.endsWith(requiredSuffix)) {
      throw new InterpreterException(label + " path must end with " + requiredSuffix);
    }

    Path resolved = repositoryRoot.resolve(requested).normalize();
    if (!resolved.startsWith(repositoryRoot)) {
      throw new InterpreterException(label + " path escapes the configured repository");
    }
    if (!Files.isRegularFile(resolved)) {
      throw new InterpreterException(label + " does not exist: " + path);
    }
    return resolved;
  }

  private void ensureOpen() throws InterpreterException {
    if (repositoryRoot == null || npmCommand == null || celixCommand == null) {
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
        message
            + "; expected: runtime | <render|network|audit|manifest|validate|inspect> <path.horn.json>"
            + " | query <doc.horn.json> <query.json>"
            + " | explain <doc.horn.json> <identity> [support.json ...]"
            + " | impact <doc.horn.json> <evidence.json> <bindings.json>"
            + " | diff <before.horn.json> <after.horn.json>");
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
    final List<String> operands;

    HornCommand(String view, List<String> operands) {
      this.view = view;
      this.operands = List.copyOf(operands);
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
