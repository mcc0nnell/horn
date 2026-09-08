export type HornSourceSeriesIssue = {
  code: string;
  message: string;
};

export type HornSourceLocator = {
  path: string;
  gitBlobSha1: string;
  bytes: number;
  role?: string;
};

export type HornSourceSeriesMap = HornSourceLocator & {
  map: number;
  id: string;
  question: string;
  relatedSource?: HornSourceLocator;
};

export type HornSourceSeries = {
  version: "horn-source-series/0.1";
  id: string;
  title: string;
  creator: string;
  year: number;
  authority: {
    role: string;
    rule: string;
  };
  sourceRepository: {
    repository: string;
    ref: string;
    pathPolicy: string;
  };
  maps: HornSourceSeriesMap[];
  companionSources: Array<HornSourceLocator & { id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validBlobSha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function validByteLength(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function validateLocator(
  issues: HornSourceSeriesIssue[],
  value: unknown,
  subject: string,
): void {
  if (!isRecord(value)) {
    issues.push({ code: "invalid-source", message: `${subject} must be an object` });
    return;
  }

  if (!nonEmptyString(value.path)) {
    issues.push({ code: "missing-source-path", message: `${subject} needs a path` });
  } else if (!value.path.startsWith("docs/")) {
    issues.push({
      code: "source-outside-docs",
      message: `${subject} must reference the calibrated docs/ source copy`,
    });
  }

  if (!validBlobSha1(value.gitBlobSha1)) {
    issues.push({
      code: "invalid-source-blob",
      message: `${subject} needs a 40-character lowercase Git blob SHA-1`,
    });
  }

  if (!validByteLength(value.bytes)) {
    issues.push({
      code: "invalid-source-size",
      message: `${subject} needs a positive integer byte length`,
    });
  }
}

export function validateHornSourceSeries(value: unknown): HornSourceSeriesIssue[] {
  const issues: HornSourceSeriesIssue[] = [];

  if (!isRecord(value)) {
    return [{ code: "invalid-series", message: "Source series must be an object" }];
  }

  if (value.version !== "horn-source-series/0.1") {
    issues.push({
      code: "version",
      message: `Unsupported source-series version ${String(value.version)}`,
    });
  }

  for (const key of ["id", "title", "creator"] as const) {
    if (!nonEmptyString(value[key])) {
      issues.push({ code: `missing-${key}`, message: `Source series needs ${key}` });
    }
  }

  if (!Number.isInteger(value.year) || Number(value.year) < 1) {
    issues.push({ code: "invalid-year", message: "Source series needs a positive integer year" });
  }

  if (!isRecord(value.authority)) {
    issues.push({ code: "missing-authority", message: "Source series needs an authority boundary" });
  } else {
    if (!nonEmptyString(value.authority.role)) {
      issues.push({ code: "missing-authority-role", message: "Authority boundary needs a role" });
    }
    if (!nonEmptyString(value.authority.rule)) {
      issues.push({ code: "missing-authority-rule", message: "Authority boundary needs a rule" });
    }
  }

  if (!isRecord(value.sourceRepository)) {
    issues.push({
      code: "missing-source-repository",
      message: "Source series needs repository provenance",
    });
  } else {
    for (const key of ["repository", "ref", "pathPolicy"] as const) {
      if (!nonEmptyString(value.sourceRepository[key])) {
        issues.push({
          code: `missing-source-repository-${key}`,
          message: `Source repository needs ${key}`,
        });
      }
    }
  }

  if (!Array.isArray(value.maps) || value.maps.length < 1) {
    issues.push({ code: "missing-maps", message: "Source series needs at least one map" });
  } else {
    const mapNumbers = new Set<number>();
    const ids = new Set<string>();
    const paths = new Set<string>();

    value.maps.forEach((entry, index) => {
      const subject = `Map entry ${index}`;
      validateLocator(issues, entry, subject);

      if (!isRecord(entry)) {
        return;
      }

      if (!Number.isInteger(entry.map) || Number(entry.map) < 1) {
        issues.push({ code: "invalid-map-number", message: `${subject} needs a positive integer map number` });
      } else {
        const mapNumber = Number(entry.map);
        if (mapNumbers.has(mapNumber)) {
          issues.push({ code: "duplicate-map-number", message: `Duplicate map number ${mapNumber}` });
        }
        mapNumbers.add(mapNumber);
      }

      if (!nonEmptyString(entry.id)) {
        issues.push({ code: "missing-map-id", message: `${subject} needs an id` });
      } else {
        if (ids.has(entry.id)) {
          issues.push({ code: "duplicate-map-id", message: `Duplicate map id ${entry.id}` });
        }
        ids.add(entry.id);
      }

      if (!nonEmptyString(entry.question)) {
        issues.push({ code: "missing-map-question", message: `${subject} needs a question` });
      }

      if (nonEmptyString(entry.path)) {
        if (paths.has(entry.path)) {
          issues.push({ code: "duplicate-source-path", message: `Duplicate source path ${entry.path}` });
        }
        paths.add(entry.path);
      }

      if (entry.relatedSource !== undefined) {
        validateLocator(issues, entry.relatedSource, `${subject} related source`);
      }
    });
  }

  if (!Array.isArray(value.companionSources)) {
    issues.push({
      code: "invalid-companion-sources",
      message: "companionSources must be an array",
    });
  } else {
    const companionIds = new Set<string>();
    for (const [index, entry] of value.companionSources.entries()) {
      const subject = `Companion source ${index}`;
      validateLocator(issues, entry, subject);
      if (!isRecord(entry)) {
        continue;
      }
      if (!nonEmptyString(entry.id)) {
        issues.push({ code: "missing-companion-id", message: `${subject} needs an id` });
      } else if (companionIds.has(entry.id)) {
        issues.push({ code: "duplicate-companion-id", message: `Duplicate companion id ${entry.id}` });
      } else {
        companionIds.add(entry.id);
      }
    }
  }

  return issues.sort((a, b) =>
    a.code === b.code ? a.message.localeCompare(b.message) : a.code.localeCompare(b.code),
  );
}
