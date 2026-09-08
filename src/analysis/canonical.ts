/**
 * Deterministic JSON normalization shared by every analysis artifact.
 *
 * Object keys are sorted recursively. Arrays keep their already-deterministic
 * order. The pretty form is 2-space JSON with a trailing newline so TypeScript
 * and C++ can be compared byte-for-byte.
 */
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const child = record[key];
      if (child === undefined) {
        continue;
      }
      sorted[key] = sortKeys(child);
    }
    return sorted;
  }
  return value;
}

export function stringifyNormalized(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

export function canonicalizeJsonText(text: string): string {
  return JSON.stringify(sortKeys(JSON.parse(text)));
}
