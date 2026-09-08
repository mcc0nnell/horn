package org.mcc0nnell.horn.zeppelin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
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
 * <p>This class deliberately contains no HORN validation, rendering, graph,
 * provenance, or layout semantics. Presentation views delegate to the
 * transport-neutral TypeScript adapter. Headless analysis delegates to
 * horn_celix, which discovers the pinned libhorn services inside a real Celix
 * framework. Notebook composition is derived and ephemeral: named results live
 * only in interpreter memory and can never replace canonical HORN documents.</p>
 */
public class HornInterpreter extends Interpreter {
  static final String PROP_REPO = "horn.repo";
  static final String PROP_NPM = "horn.npm";
  static final String PROP_CELIX = "horn.celix";
  static final String PROP_TIMEOUT = "horn.command.timeout.millis";

  private static final long DEFAULT_TIMEOUT_MILLIS = 60_000L;
  private static final String DEFAULT_NOTE_KEY = "__horn_default_note__";
  private static final String BINDINGS_CONTRACT = "horn-zeppelin-bindings/0.1";
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final Set<String> PRESENTATION_COMMANDS =
      Set.of("render", "network", "audit", "manifest");
  private static final Set<String> SINGLE_DOCUMENT_ANALYSIS_COMMANDS =
      Set.of("validate", "inspect");
  private static final Set<String> MULTI_OPERAND_ANALYSIS_COMMANDS =
      Set.of("query", "explain", "impact", "diff");
  private static final Set<String> BINDABLE_COMMANDS =
      Set.of("runtime", "validate", "inspect", "query", "explain", "impact", "diff");

  private final Map<String, Map<String, Binding>> bindingsByNote = new ConcurrentHashMap<>();
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
    bindingsByNote.clear();
    // No persistent runtime is owned by the interpreter. horn_celix owns one
    // framework for the duration of each headless command.
  }

  @Override
  public InterpreterResult interpret(String statement, InterpreterContext context) {
    try {
      ensureOpen();
      String noteKey = noteKey(context);
      HornCommand command = parse(statement);

      if ("bindings".equals(command.view)) {
        return bindingsResult(noteKey);
      }

      CommandResult commandResult;
      if (PRESENTATION_COMMANDS.contains(command.view)) {
        Path relativeDocument = resolveDocument(command.operands.get(0));
        commandResult = executeCli(command.view, relativeDocument);
      } else {
        try (ResolvedInvocation invocation = buildCelixInvocation(command, noteKey)) {
          commandResult = executeCelix(command.view, invocation.args);
        }
      }

      if (command.bindingName != null && commandResult.exitCode == 0) {
        bind(noteKey, command.bindingName, command.view, commandResult.output);
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

  private ResolvedInvocation buildCelixInvocation(HornCommand command, String noteKey)
      throws InterpreterException, IOException {
    List<String> args = new ArrayList<>();
    List<Path> temporaryFiles = new ArrayList<>();
    try {
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
          args.add(resolveJsonOperand(
              "HORN query request", command.operands.get(1), noteKey, temporaryFiles).toString());
          break;
        case "explain":
          args.add("explain");
          args.add(absoluteDocument(command.operands.get(0)).toString());
          args.add(resolveScalarOperand("HORN explanation identity", command.operands.get(1), noteKey));
          for (int index = 2; index < command.operands.size(); index++) {
            args.add(resolveJsonOperand(
                "HORN explanation support",
                command.operands.get(index),
                noteKey,
                temporaryFiles).toString());
          }
          break;
        case "impact":
          args.add("impact");
          args.add(absoluteDocument(command.operands.get(0)).toString());
          args.add(resolveJsonOperand(
              "HORN evidence", command.operands.get(1), noteKey, temporaryFiles).toString());
          args.add(resolveJsonOperand(
              "HORN bindings", command.operands.get(2), noteKey, temporaryFiles).toString());
          break;
        case "diff":
          args.add("diff");
          args.add(absoluteDocument(command.operands.get(0)).toString());
          args.add(absoluteDocument(command.operands.get(1)).toString());
          break;
        default:
          throw new InterpreterException("Unsupported Celix-backed HORN view: " + command.view);
      }
      return new ResolvedInvocation(args, temporaryFiles);
    } catch (InterpreterException | IOException exception) {
      deleteTemporaryFiles(temporaryFiles);
      throw exception;
    }
  }

  private Path absoluteDocument(String documentPath) throws InterpreterException {
    if (isBindingReference(documentPath)) {
      throw new InterpreterException(
          "Derived notebook bindings cannot be used as HORN documents; canonical document operands"
              + " must remain repository .horn.json files");
    }
    return repositoryRoot.resolve(resolveDocument(documentPath)).normalize();
  }

  private Path resolveJsonOperand(
      String label, String operand, String noteKey, List<Path> temporaryFiles)
      throws InterpreterException, IOException {
    if (!isBindingReference(operand)) {
      return resolveRepositoryFile(label, operand, ".json");
    }

    JsonNode selected = resolveBindingReference(noteKey, operand);
    Path temporary = Files.createTempFile("horn-zeppelin-binding-", ".json");
    Files.writeString(
        temporary,
        JSON.writeValueAsString(selected) + "\n",
        StandardCharsets.UTF_8);
    temporaryFiles.add(temporary);
    return temporary;
  }

  private String resolveScalarOperand(String label, String operand, String noteKey)
      throws InterpreterException {
    if (!isBindingReference(operand)) {
      return operand;
    }

    JsonNode selected = resolveBindingReference(noteKey, operand);
    if (selected.isNull() || selected.isContainerNode()) {
      throw new InterpreterException(
          label + " reference must select a scalar JSON value: " + operand);
    }
    return selected.asText();
  }

  private JsonNode resolveBindingReference(String noteKey, String reference)
      throws InterpreterException {
    BindingReference parsed = parseBindingReference(reference);
    Binding binding = bindingsForNote(noteKey).get(parsed.name);
    if (binding == null) {
      throw new InterpreterException("Unknown HORN notebook binding: @" + parsed.name);
    }
    if (parsed.pointer.isEmpty()) {
      return binding.value;
    }

    JsonNode selected;
    try {
      selected = binding.value.at(parsed.pointer);
    } catch (IllegalArgumentException exception) {
      throw new InterpreterException(
          "Invalid JSON Pointer in HORN notebook binding reference " + reference + ": "
              + exception.getMessage());
    }
    if (selected.isMissingNode()) {
      throw new InterpreterException("HORN notebook binding selector did not resolve: " + reference);
    }
    return selected;
  }

  private void bind(String noteKey, String name, String view, String output)
      throws InterpreterException {
    JsonNode value;
    try {
      value = JSON.readTree(output);
    } catch (JsonProcessingException exception) {
      throw new InterpreterException(
          "Cannot bind HORN " + view + " result because it is not a JSON value: "
              + exception.getOriginalMessage());
    }
    if (value == null) {
      throw new InterpreterException("Cannot bind empty HORN " + view + " result");
    }
    bindingsForNote(noteKey).put(name, new Binding(name, view, value, sha256(output)));
  }

  private InterpreterResult bindingsResult(String noteKey) throws InterpreterException {
    List<Binding> bindings = new ArrayList<>(bindingsForNote(noteKey).values());
    bindings.sort(Comparator.comparing(binding -> binding.name));

    List<Map<String, String>> rows = new ArrayList<>();
    for (Binding binding : bindings) {
      String contract = binding.value.path("version").isTextual()
          ? binding.value.path("version").asText()
          : "";
      Map<String, String> row = new LinkedHashMap<>();
      row.put("name", binding.name);
      row.put("command", binding.view);
      row.put("contract", contract);
      row.put("sha256", binding.sha256);
      rows.add(row);
    }

    Map<String, Object> envelope = new LinkedHashMap<>();
    envelope.put("version", BINDINGS_CONTRACT);
    envelope.put("ephemeral", true);
    envelope.put("bindings", rows);
    try {
      String output = JSON.writerWithDefaultPrettyPrinter().writeValueAsString(envelope) + "\n";
      return new InterpreterResult(Code.SUCCESS, Type.TEXT, output);
    } catch (JsonProcessingException exception) {
      throw new InterpreterException("Unable to serialize HORN notebook bindings");
    }
  }

  private Map<String, Binding> bindingsForNote(String noteKey) {
    return bindingsByNote.computeIfAbsent(noteKey, ignored -> new ConcurrentHashMap<>());
  }

  private static String noteKey(InterpreterContext context) {
    if (context == null || context.getNoteId() == null || context.getNoteId().trim().isEmpty()) {
      return DEFAULT_NOTE_KEY;
    }
    return context.getNoteId();
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
      if (!BINDABLE_COMMANDS.contains(inner.view)) {
        throw usage("HORN let can bind only Celix-backed analysis results");
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
          label + " expects a repository file; use a binding only where derived JSON is accepted");
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

  private static BindingReference parseBindingReference(String reference)
      throws InterpreterException {
    if (!isBindingReference(reference) || reference.length() == 1) {
      throw new InterpreterException("Invalid HORN notebook binding reference: " + reference);
    }
    int hash = reference.indexOf('#');
    String name = hash < 0 ? reference.substring(1) : reference.substring(1, hash);
    String pointer = hash < 0 ? "" : reference.substring(hash + 1);
    validateBindingName(name);
    if (!pointer.isEmpty() && !pointer.startsWith("/")) {
      throw new InterpreterException(
          "HORN notebook binding selectors use JSON Pointer after #: " + reference);
    }
    return new BindingReference(name, pointer);
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
            + "; expected: bindings | let <name> = <analysis-command>"
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

  private static String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(bytes.length * 2);
      for (byte b : bytes) {
        hex.append(String.format(Locale.ROOT, "%02x", b & 0xff));
      }
      return hex.toString();
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is not available", exception);
    }
  }

  private static void deleteTemporaryFiles(List<Path> paths) {
    for (Path path : paths) {
      try {
        Files.deleteIfExists(path);
      } catch (IOException ignored) {
        // Derived binding materializations are disposable. A failed cleanup must
        // not mutate or weaken canonical HORN state.
      }
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

  private static final class BindingReference {
    final String name;
    final String pointer;

    BindingReference(String name, String pointer) {
      this.name = name;
      this.pointer = pointer;
    }
  }

  private static final class Binding {
    final String name;
    final String view;
    final JsonNode value;
    final String sha256;

    Binding(String name, String view, JsonNode value, String sha256) {
      this.name = name;
      this.view = view;
      this.value = value;
      this.sha256 = sha256;
    }
  }

  private static final class ResolvedInvocation implements AutoCloseable {
    final List<String> args;
    final List<Path> temporaryFiles;

    ResolvedInvocation(List<String> args, List<Path> temporaryFiles) {
      this.args = List.copyOf(args);
      this.temporaryFiles = List.copyOf(temporaryFiles);
    }

    @Override
    public void close() {
      deleteTemporaryFiles(temporaryFiles);
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
