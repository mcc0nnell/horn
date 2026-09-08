import { createHash } from "node:crypto";

/**
 * Serialize JSON-compatible data with recursively sorted object keys.
 *
 * Horn proof digests intentionally bind to semantic JSON content rather than
 * incidental whitespace or repository formatting. Callers must pass values
 * that came from JSON-compatible Horn contract artifacts.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new Error("canonical Horn JSON cannot contain a non-finite number");
      }
      return JSON.stringify(value);
    case "object": {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort();
      return `{${keys
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
        .join(",")}}`;
    }
    default:
      throw new Error(`canonical Horn JSON cannot encode ${typeof value}`);
  }
}

export function canonicalJsonSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
