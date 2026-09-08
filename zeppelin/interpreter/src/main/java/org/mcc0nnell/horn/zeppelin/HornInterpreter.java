package org.mcc0nnell.horn.zeppelin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
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
 * <p>This class deliberately contains no HORN validation, graph, provenance,
 * binding-resolution, JSON-Pointer, or reasoning-session semantics. Presentation
 * views delegate to the transport-neutral TypeScript adapter. Direct headless
 * analysis delegates to horn_celix. Composed analysis transports an opaque
 * note-scoped session envelope to IReasoningSessionService, which owns binding
 * resolution and service orchestration inside Celix.</p>
 */
public class HornInterpreter extends Interpreter {
  static final String PROP_REPO = "horn.repo";
  static final String PROP_NPM = "horn.npm";
  static final String PROP_CELIX = "horn.celix";
  static final String PROP_TIMEOUT = "horn.command.timeout.millis";

  private static final long DEFAULT_TIMEOUT_MILLIS = 60_000L;
  private static final String DEFAULT_NOTE_KEY = "__horn_default_note__";
  private static final String SESSION_CONTRACT = "horn-reasoning-session/0.1";
  private static final String SESSION_REQUEST_CONTRACT = "horn-reasoning-session-request/0.1";
  private static final String SESSION_RESPONSE_CONTRACT = "horn-reasoning-session-response/0.1";
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final Set<String> PRESENTATION_COMMANDS =
      Set.of("render", "network", "audit", "manifest");
  private static final Set<String> SINGLE_DOCUMENT_ANALYSIS_COMMANDS =
      Set.of("validate", "inspect");
  private static final Set<String> MULTI_OPERAND_ANALYSIS_COMMANDS =
      Set.of("query", "explain", "impact", "diff");
  private static final Set<String> SESSION_BINDABLE_COMMANDS =
      Set.of("validate", "query", "explain", "impact", "diff");

  /** Opaque envelopes returned by IReasoningSessionService, keyed only by note id. */
  private final Map<String, JsonNode> sessionsByNote = new ConcurrentHashMap<>();

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
    sessionsByNote.clear();
    // No persistent native runtime is owned by the interpreter. The opaque
    // session envelope is transported to a fresh horn_celix process per call.
  }

  @Override
  public InterpreterResult interpret(String statement, InterpreterContext context) {
    try {
      ensureOpen();
      String noteKey = noteKey(context);
      HornCommand command = parse(statement);

      if (PRESENTATION_COMMANDS.contains(command.view)) {
        Path relativeDocument = resolveDocument(command.operands.get(0));
        return mapCommandResult(command.view, executeCli(command.view, relativeDocument));
      }

      if (requiresReasoningSession(command)) {
        return mapCommandResult(command.view, executeSession(command, noteKey));
      }

      return mapCommandResult(command.view, executeCelix(command.view, buildDirectCelixArgs(command)));
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
    // Commands are FIFO and each process has a hard timeout.
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

  private boolean requiresReasoningSession(HornCommand command) {
    if ("bindings".equals(command.view) || command.bindingName != null) {
      return true;
    }
    for (String operand : command.operands) {
      if (isBindingReference(operand)) {
        return true;
      }
    }
    return false;
  }

  private CommandResult executeSession(HornCommand command, String noteKey)
      throws IOException, InterruptedException, InterpreterException {
    if (!"bindings".equals(command.view)
        && !SESSION_BINDABLE_COMMANDS.contains(command.view)) {
      throw new InterpreterException(
          "Celix reasoning sessions currently compose validate, query, explain, impact, and diff");
    }

    ObjectNode request = JSON.createObjectNode();
    request.put("version", SESSION_REQUEST_CONTRACT);
    request.set("session", sessionForNote(noteKey).deepCopy());
    request.set("command", buildSessionCommand(command));
    if (command.bindingName != null) {
      request.put("bind", command.bindingName);
    }

    Path requestFile = Files.createTempFile("horn-zeppelin-session-", ".json");
    try {
      Files.writeString(
          requestFile,
          JSON.writerWithDefaultPrettyPrinter().writeValueAsString(request) + "\n",
          StandardCharsets.UTF_8);
      CommandResult nativeResult = executeCelix("session", List.of("session", requestFile.toString()));
      if (nativeResult.exitCode != 0) {
        return nativeResult;
      }

      JsonNode response;
      try {
        response = JSON.readTree(nativeResult.output);
      } catch (JsonProcessingException exception) {
        throw new InterpreterException(
            "Celix reasoning session returned invalid JSON: " + exception.getOriginalMessage());
      }
      if (response == null
          || !SESSION_RESPONSE_CONTRACT.equals(response.path("version").asText())
          || !response.has("session")
          || !response.has("result")) {
        throw new InterpreterException("Celix reasoning session returned an unexpected envelope");
      }

      // Zeppelin treats this as opaque transport state. Binding interpretation,
      // selectors, metadata, and replacement rules remain inside Celix.
      sessionsByNote.put(noteKey, response.get("session").deepCopy());
      String resultText = JSON.writerWithDefaultPrettyPrinter()
          .writeValueAsString(response.get("result")) + "\n";
      return new CommandResult(0, resultText);
    } catch (JsonProcessingException exception) {
      throw new InterpreterException("Unable to serialize HORN reasoning session request");
    } finally {
      Files.deleteIfExists(requestFile);
    }
  }

  private ObjectNode buildSessionCommand(HornCommand command)
      throws InterpreterException, IOException {
    ObjectNode out = JSON.createObjectNode();
    out.put("op", command.view);
    switch (command.view) {
      case "bindings":
        break;
      case "validate":
        out.set("document", canonicalDocumentOperand(command.operands.get(0)));
        break;
      case "query":
        out.set("document", canonicalDocumentOperand(command.operands.get(0)));
        out.set("request", jsonOperand("HORN query request", command.operands.get(1)));
        break;
      case "explain":
        out.set("document", canonicalDocumentOperand(command.operands.get(0)));
        out.set("identity", scalarOperand(command.operands.get(1)));
        ArrayNode support = out.putArray("support");
        for (int index = 2; index < command.operands.size(); index++) {
          support.add(jsonOperand("HORN explanation support", command.operands.get(index)));
        }
        break;
      case "impact":
        out.set("document", canonicalDocumentOperand(command.operands.get(0)));
        out.set("evidence", jsonOperand("HORN evidence", command.operands.get(1)));
        out.set("bindings", jsonOperand("HORN bindings", command.operands.get(2)));
        break;
      case "diff":
        out.set("before", canonicalDocumentOperand(command.operands.get(0)));
        out.set("after", canonicalDocumentOperand(command.operands.get(1)));
        break;
      default:
        throw new InterpreterException("Unsupported Celix reasoning session view: " + command.view);
    }
    return out;
  }

  private ObjectNode canonicalDocumentOperand(String path)
      throws InterpreterException, IOException {
    if (isBindingReference(path)) {
      throw new InterpreterException(
          "Derived notebook bindings cannot be used as HORN documents; canonical document operands"
              + " must remain repository .horn.json files");
    }
    Path document = absoluteDocument(path);
    ObjectNode operand = JSON.createObjectNode();
    operand.put("authority", "canonical");
    try {
      operand.set("value", JSON.readTree(Files.readString(document, StandardCharsets.UTF_8)));
    } catch (JsonProcessingException exception) {
      throw new InterpreterException("HORN document is not valid JSON: " + path);
    }
    return operand;
  }

  private ObjectNode jsonOperand(String label, String operand)
      throws InterpreterException, IOException {
    ObjectNode encoded = JSON.createObjectNode();
    if (isBindingReference(operand)) {
      encoded.put("ref", operand);
      return encoded;
    }
    Path file = resolveRepositoryFile(label, operand, ".json");
    try {
      encoded.set("value", JSON.readTree(Files.readString(file, StandardCharsets.UTF_8)));
    } catch (JsonProcessingException exception) {
      throw new InterpreterException(label + " is not valid JSON: " + operand);
    }
    return encoded;
  }

  private ObjectNode scalarOperand(String operand) {
    ObjectNode encoded = JSON.createObjectNode();
    if (isBindingReference(operand)) {
      encoded.put("ref", operand);
    } else {
      encoded.put("value", operand);
    }
    return encoded;
  }

  private JsonNode sessionForNote(String noteKey) {
    return sessionsByNote.computeIfAbsent(noteKey, key -> {
      ObjectNode initial = JSON.createObjectNode();
      initial.put("version", SESSION_CONTRACT);
      initial.put("id", key);
      initial.put("ephemeral", true);
      initial.putArray("bindings");
      return initial;
    });
  }

  private List<String> buildDirectCelixArgs(HornCommand command)
      throws InterpreterException {
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
        args.add(resolveRepositoryFile(
            "HORN query request", command.operands.get(1), ".json").toString());
        break;
      case "explain":
        args.add("explain");
        args.add(absoluteDocument(command.operands.get(0)).toString());
        args.add(command.operands.get(1));
        for (int index = 2; index < command.operands.size(); index++) {
          args.add(resolveRepositoryFile(
              "HORN explanation support", command.operands.get(index), ".json").toString());
        }
        break;
      case "impact":
        args.add("impact");
        args.add(absoluteDocument(command.operands.get(0)).toString());
        args.add(resolveRepositoryFile(
            "HORN evidence", command.operands.get(1), ".json").toString());
        args.add(resolveRepositoryFile(
            "HORN bindings", command.operands.get(2), ".json").toString());
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
      case "bindings":
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
    if ("bindings".equals(trimmed.toLowerCase(Locale.ROOT))) {
      return new HornCommand("bindings", List.of(), null);
    }

    if (trimmed.toLowerCase(Locale.ROOT).startsWith("let ")) {
      String remainder = trimmed.substring(4).trim();
      int separator = firstWhitespace(remainder);
      if (separator < 0) {
        throw usage("HORN let is missing a command");
      }
      String name = remainder.substring(0, separator);
      validateBindingName(name);
      String nested = remainder.substring(separator).trim();
      if (nested.startsWith("=")) {
        nested = nested.substring(1).trim();
      }
      if (nested.isEmpty()) {
        throw usage("HORN let is missing a command");
      }
      HornCommand inner = parseCore(nested);
      if (!SESSION_BINDABLE_COMMANDS.contains(inner.view)) {
        throw usage(
            "HORN let can bind validate, query, explain, impact, or diff through the Celix session service");
      }
      return new HornCommand(inner.view, inner.operands, name);
    }

    return parseCore(trimmed);
  }

  private HornCommand parseCore(String trimmed) throws InterpreterException {
    if ("runtime".equals(trimmed.toLowerCase(Locale.ROOT))) {
      return new HornCommand("runtime", List.of(), null);
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
      return new HornCommand(view, List.of(remainder), null);
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
    return new HornCommand(view, operands, null);
  }

  private static void validateBindingName(String name) throws InterpreterException {
    if (!name.matches("[A-Za-z][A-Za-z0-9_.-]{0,63}")) {
      throw usage(
          "Invalid HORN binding name " + name
              + "; use 1-64 letters, digits, dot, underscore, or dash starting with a letter");
    }
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
    if (isBindingReference(path)) {
      throw new InterpreterException(
          label + " expects a repository file; derived references are resolved by the Celix session service");
    }

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

  private static boolean isBindingReference(String value) {
    return value != null && value.startsWith("@");
  }

  private void ensureOpen() throws InterpreterException {
    if (repositoryRoot == null || npmCommand == null || celixCommand == null) {
      throw new InterpreterException("HORN interpreter is not open");
    }
  }

  private static String noteKey(InterpreterContext context) {
    if (context == null || context.getNoteId() == null || context.getNoteId().trim().isEmpty()) {
      return DEFAULT_NOTE_KEY;
    }
    return context.getNoteId();
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
            + "; expected: bindings | let <name> = <validate|query|explain|impact|diff> ..."
            + " | runtime | <render|network|audit|manifest|validate|inspect> <path.horn.json>"
            + " | query <doc.horn.json> <query.json|@binding>"
            + " | explain <doc.horn.json> <identity|@binding#/pointer> [support.json|@binding ...]"
            + " | impact <doc.horn.json> <evidence.json|@binding> <bindings.json|@binding>"
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
    final String bindingName;

    HornCommand(String view, List<String> operands, String bindingName) {
      this.view = view;
      this.operands = List.copyOf(operands);
      this.bindingName = bindingName;
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
