import { createHash } from "node:crypto";

import { renderHornSvg, type HornRenderWarning } from "../render";
import type { Citation, HornDocument } from "../types";
import { validateHornDocument, type HornIssue } from "../validate";

export const HORN_ZEPPELIN_PROJECTION_CONTRACT = "horn-zeppelin/0.1" as const;
export const HORN_ZEPPELIN_RENDERER = "horn-svg" as const;

export type HornSourceInspection =
  | {
      valid: true;
      sha256: string;
      documentId: string;
      hornSchema: HornDocument["version"];
      issues: [];
    }
  | {
      valid: false;
      sha256: string;
      issues: HornIssue[];
      documentId?: string;
      hornSchema?: string;
    };

export type PreparedHornDocument = {
  readonly document: HornDocument;
  readonly sha256: string;
};

export class HornZeppelinValidationError extends Error {
  readonly issues: HornIssue[];

  constructor(issues: HornIssue[]) {
    super(
      `Horn document failed Zeppelin adapter validation:\n${issues
        .map((issue) => `${issue.code}: ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "HornZeppelinValidationError";
    this.issues = issues;
  }
}

function sourceBytes(source: string | Uint8Array): Uint8Array {
  return typeof source === "string" ? Buffer.from(source, "utf8") : source;
}

function sha256(source: Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

function decodeUtf8(source: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(source);
  } catch {
    throw new HornZeppelinValidationError([
      { code: "invalid-utf8", message: "HORN documents must be valid UTF-8" },
    ]);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function minimumShapeIssue(value: unknown): HornIssue | undefined {
  if (!record(value)) {
    return { code: "invalid-root", message: "HORN document root must be an object" };
  }

  if (
    typeof value.id !== "string" ||
    typeof value.version !== "string" ||
    !record(value.canvas) ||
    !Array.isArray(value.regions) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.relations) ||
    !Array.isArray(value.citations) ||
    !Array.isArray(value.readingPath)
  ) {
    return {
      code: "invalid-structure",
      message: "HORN document is missing required top-level transport fields",
    };
  }

  return undefined;
}

function parseSource(source: string | Uint8Array): {
  bytes: Uint8Array;
  digest: string;
  document?: HornDocument;
  issues: HornIssue[];
  documentId?: string;
  hornSchema?: string;
} {
  const bytes = sourceBytes(source);
  const digest = sha256(bytes);

  let text: string;
  try {
    text = decodeUtf8(bytes);
  } catch (error) {
    if (error instanceof HornZeppelinValidationError) {
      return { bytes, digest, issues: error.issues };
    }
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      bytes,
      digest,
      issues: [
        {
          code: "invalid-json",
          message: error instanceof Error ? error.message : "Invalid JSON",
        },
      ],
    };
  }

  const shapeIssue = minimumShapeIssue(value);
  if (shapeIssue) {
    return {
      bytes,
      digest,
      issues: [shapeIssue],
      ...(record(value) && typeof value.id === "string"
        ? { documentId: value.id }
        : {}),
      ...(record(value) && typeof value.version === "string"
        ? { hornSchema: value.version }
        : {}),
    };
  }

  const document = value as HornDocument;
  let issues: HornIssue[];
  try {
    issues = validateHornDocument(document);
  } catch (error) {
    issues = [
      {
        code: "invalid-structure",
        message:
          error instanceof Error
            ? `Validator could not inspect document structure: ${error.message}`
            : "Validator could not inspect document structure",
      },
    ];
  }

  return {
    bytes,
    digest,
    document,
    issues,
    documentId: document.id,
    hornSchema: document.version,
  };
}

export function inspectHornSource(
  source: string | Uint8Array,
): HornSourceInspection {
  const parsed = parseSource(source);
  if (!parsed.document || parsed.issues.length > 0) {
    return {
      valid: false,
      sha256: parsed.digest,
      issues: parsed.issues,
      ...(parsed.documentId !== undefined
        ? { documentId: parsed.documentId }
        : {}),
      ...(parsed.hornSchema !== undefined
        ? { hornSchema: parsed.hornSchema }
        : {}),
    };
  }

  return {
    valid: true,
    sha256: parsed.digest,
    documentId: parsed.document.id,
    hornSchema: parsed.document.version,
    issues: [],
  };
}

export function prepareHornDocument(
  source: string | Uint8Array,
): PreparedHornDocument {
  const parsed = parseSource(source);
  if (!parsed.document || parsed.issues.length > 0) {
    throw new HornZeppelinValidationError(parsed.issues);
  }
  return { document: parsed.document, sha256: parsed.digest };
}

export type HornZeppelinManifest = {
  hornSchema: HornDocument["version"];
  documentId: string;
  sha256: string;
  renderer: typeof HORN_ZEPPELIN_RENDERER;
  projectionContract: typeof HORN_ZEPPELIN_PROJECTION_CONTRACT;
  authority: HornDocument["authority"];
};

export function projectManifest(
  prepared: PreparedHornDocument,
): HornZeppelinManifest {
  return {
    hornSchema: prepared.document.version,
    documentId: prepared.document.id,
    sha256: prepared.sha256,
    renderer: HORN_ZEPPELIN_RENDERER,
    projectionContract: HORN_ZEPPELIN_PROJECTION_CONTRACT,
    authority: prepared.document.authority,
  };
}

export type HornZeppelinMural = {
  svg: string;
  warnings: HornRenderWarning[];
  sha256: string;
};

export function projectMural(
  prepared: PreparedHornDocument,
): HornZeppelinMural {
  const rendered = renderHornSvg(prepared.document);
  return { ...rendered, sha256: prepared.sha256 };
}

function html(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function muralToZeppelinHtml(
  prepared: PreparedHornDocument,
): string {
  const mural = projectMural(prepared);
  const warnings = mural.warnings.length
    ? `<aside class="horn-zeppelin__warnings" role="status"><strong>HORN warnings</strong><ul>${mural.warnings
        .map(
          (warning) =>
            `<li data-warning-code="${html(warning.code)}" data-relation-id="${html(warning.relationId)}">${html(warning.message)}</li>`,
        )
        .join("")}</ul></aside>`
    : "";

  return [
    `<section class="horn-zeppelin" data-horn-document="${html(prepared.document.id)}"`,
    ` data-horn-sha256="${prepared.sha256}"`,
    ` data-horn-projection-contract="${HORN_ZEPPELIN_PROJECTION_CONTRACT}">`,
    mural.svg,
    warnings,
    `</section>`,
  ].join("");
}

export type ZeppelinNetworkProjection = {
  nodes: Array<{
    id: string;
    label: string;
    labels: string[];
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    data: Record<string, unknown>;
  }>;
  directed: true;
  types: string[];
  hornProjection: {
    contract: typeof HORN_ZEPPELIN_PROJECTION_CONTRACT;
    fidelity: "lossy-semantic-projection";
    roundTrip: false;
    sourceSha256: string;
    omitted: string[];
  };
};

export function projectNetwork(
  prepared: PreparedHornDocument,
): ZeppelinNetworkProjection {
  const doc = prepared.document;
  const types = [...new Set(doc.relations.map((relation) => relation.kind))].sort();

  return {
    nodes: doc.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      labels: [node.kind, node.origin],
      data: {
        hornNodeId: node.id,
        kind: node.kind,
        origin: node.origin,
        number: node.number,
        focus: node.focus === true,
        citationIds: [...node.citationIds],
        projectionFidelity: "semantic-only",
        ...(node.author !== undefined ? { author: node.author } : {}),
        ...(node.year !== undefined ? { year: node.year } : {}),
      },
    })),
    edges: doc.relations.map((relation) => ({
      id: relation.id,
      source: relation.from,
      target: relation.to,
      label: relation.kind,
      data: {
        hornRelationId: relation.id,
        displayLabel: relation.label,
        kind: relation.kind,
        hasPersistedRoute: relation.route !== undefined,
        routeCommandCount: relation.route?.commands.length ?? 0,
        projectionFidelity: "semantic-only",
      },
    })),
    directed: true,
    types,
    hornProjection: {
      contract: HORN_ZEPPELIN_PROJECTION_CONTRACT,
      fidelity: "lossy-semantic-projection",
      roundTrip: false,
      sourceSha256: prepared.sha256,
      omitted: [
        "node.geometry",
        "region.geometry",
        "relation.route.commands",
        "relation.route.labelGeometry",
        "readingPath geometry/ordering semantics",
        "typography and mural styling",
      ],
    },
  };
}

export type HornAuditProjection = {
  document: {
    id: string;
    hornSchema: HornDocument["version"];
    authority: HornDocument["authority"];
    sha256: string;
    after?: HornDocument["after"];
  };
  layerA: Citation[];
  layerB: Citation[];
  nodes: Array<{
    id: string;
    origin: HornDocument["nodes"][number]["origin"];
    mappedCitationIds: string[];
    directCartographicCitationIds: string[];
    inheritedDocumentCartographicCitationIds: string[];
  }>;
  relations: Array<{
    id: string;
    kind: HornDocument["relations"][number]["kind"];
    from: string;
    to: string;
    hasPersistedRoute: boolean;
    routeCommandCount: number;
    inheritedDocumentCartographicCitationIds: string[];
  }>;
};

export function projectAudit(
  prepared: PreparedHornDocument,
): HornAuditProjection {
  const doc = prepared.document;
  const citationById = new Map(doc.citations.map((citation) => [citation.id, citation]));
  const layerA = doc.citations.filter((citation) => citation.layer === "mapped");
  const layerB = doc.citations.filter((citation) => citation.layer === "cartographic");
  const documentLayerBIds = layerB.map((citation) => citation.id);

  return {
    document: {
      id: doc.id,
      hornSchema: doc.version,
      authority: doc.authority,
      sha256: prepared.sha256,
      ...(doc.after !== undefined ? { after: doc.after } : {}),
    },
    layerA,
    layerB,
    nodes: doc.nodes.map((node) => {
      const directCitations = node.citationIds
        .map((id) => citationById.get(id))
        .filter((citation): citation is Citation => citation !== undefined);
      const directLayerBIds = directCitations
        .filter((citation) => citation.layer === "cartographic")
        .map((citation) => citation.id);

      return {
        id: node.id,
        origin: node.origin,
        mappedCitationIds: directCitations
          .filter((citation) => citation.layer === "mapped")
          .map((citation) => citation.id),
        directCartographicCitationIds: directLayerBIds,
        inheritedDocumentCartographicCitationIds: documentLayerBIds.filter(
          (id) => !directLayerBIds.includes(id),
        ),
      };
    }),
    relations: doc.relations.map((relation) => ({
      id: relation.id,
      kind: relation.kind,
      from: relation.from,
      to: relation.to,
      hasPersistedRoute: relation.route !== undefined,
      routeCommandCount: relation.route?.commands.length ?? 0,
      inheritedDocumentCartographicCitationIds: [...documentLayerBIds],
    })),
  };
}
