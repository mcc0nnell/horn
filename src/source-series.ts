export type HornSourceSeriesIssue = {
  code: string;
  message: string;
};

export type HornSourceLocator = {
  path: string;
  gitBlobSha1: string;
  bytes: number;
  role?: string;
  aliases?: string[];
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

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validBlobSha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function validRepositoryPath(value: string): boolean {
  return value.startsWith("docs/") || value.startsWith("public/horn/");
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
  } else if (!validRepositoryPath(value.path)) {
    issues.push({
      code: "source-outside-registry-roots",
      message: `${subject} must reference docs/ or public/horn/ in the source repository`,
    });
  }

  if (!validBlobSha1(value.gitBlobSha1)) {
    issues.push({
      code: "invalid-source-blob",
      message: `${subject} needs a 40-character lowercase Git blob SHA-1`,
    });
  }

  if (!positiveInteger(value.bytes)) {
    issues.push({
      code: "invalid-source-size",
      message: `${subject} needs a positive integer byte length`,
    });
  }

  if (value.aliases !== undefined) {
    if (!Array.isArray(value.aliases)) {
      issues.push({ code: "invalid-source-aliases", message: `${subject} aliases must be an array` });
    } else {
      const aliases = new Set<string>();
      for (const [index, alias] of value.aliases.entries()) {
        if (!nonEmptyString(alias)) {
          issues.push({ code: "invalid-source-alias", message: `${subject} alias ${index} must be a non-empty path` });
          continue;
        }
        if (!validRepositoryPath(alias)) {
          issues.push({
            code: "source-alias-outside-registry-roots",
            message: `${subject} alias ${alias} must reference docs/ or public/horn/`,
          });
        }
        if (alias === value.path) {
          issues.push({ code: "source-alias-equals-path", message: `${subject} alias duplicates its primary path` });
        }
        if (aliases.has(alias)) {
          issues.push({ code: "duplicate-source-alias", message: `${subject} repeats alias ${alias}` });
        }
        aliases.add(alias);
      }
    }
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

  if (!positiveInteger(value.year)) {
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

      if (!positiveInteger(entry.map)) {
        issues.push({ code: "invalid-map-number", message: `${subject} needs a positive integer map number` });
      } else {
        if (mapNumbers.has(entry.map)) {
          issues.push({ code: "duplicate-map-number", message: `Duplicate map number ${entry.map}` });
        }
        mapNumbers.add(entry.map);
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
