import { canonicalJsonSha256 } from "./canonical-json";
import type { HornDocument } from "./types";

export const HORN_TAPE_PLAN_VERSION = "horn-tape-plan/0.1" as const;
export const HORN_TAPE_VERSION = "horn-tape/0.1" as const;
export const HORN_TAPE_EVENT_VERSION = "horn-tape-event/0.1" as const;
export const HORN_TAPE_REPLAY_VERSION = "horn-tape-replay/0.1" as const;
export const HORN_TAPE_VERIFICATION_VERSION = "horn-tape-verification/0.1" as const;

export type HornTapeAction =
  | { kind: "focus-node"; nodeId: string }
  | { kind: "follow-relation"; relationId: string }
  | { kind: "open-citation"; citationId: string }
  | { kind: "checkpoint"; label: string };

export type HornTapePlan = {
  version: typeof HORN_TAPE_PLAN_VERSION;
  actions: HornTapeAction[];
};

export type HornTapeEventPayload =
  | { kind: "focus-node"; nodeId: string }
  | {
      kind: "follow-relation";
      relationId: string;
      fromNodeId: string;
      toNodeId: string;
    }
  | { kind: "open-citation"; nodeId: string; citationId: string }
  | { kind: "checkpoint"; nodeId: string | null; label: string };

export type HornTapeEvent = {
  version: typeof HORN_TAPE_EVENT_VERSION;
  seq: number;
  previousDigest: string;
  payload: HornTapeEventPayload;
  receiptDigest: string;
};

export type HornTape = {
  version: typeof HORN_TAPE_VERSION;
  replayVersion: typeof HORN_TAPE_REPLAY_VERSION;
  document: { id: string; sha256: string };
  direction: "reader";
  genesisDigest: string;
  events: HornTapeEvent[];
  terminal: { nodeId: string | null; digest: string };
  id: string;
};

export type HornTapeVerification = {
  version: typeof HORN_TAPE_VERIFICATION_VERSION;
  valid: boolean;
  tapeId: string;
  expectedTapeId: string;
  sourceDigest: string;
  terminalNodeId: string | null;
  terminalDigest: string;
  replayedEvents: number;
  issues: string[];
};

function genesisDigest(doc: HornDocument, sourceDigest: string): string {
  return canonicalJsonSha256({
    version: "horn-tape-genesis/0.1",
    documentId: doc.id,
    sourceDigest,
    direction: "reader",
  });
}

function eventDigest(
  seq: number,
  previousDigest: string,
  payload: HornTapeEventPayload,
): string {
  return canonicalJsonSha256({
    version: HORN_TAPE_EVENT_VERSION,
    seq,
    previousDigest,
    payload,
  });
}

function tapeIdentity(tape: Omit<HornTape, "id">): string {
  return `horn-tape:${canonicalJsonSha256(tape)}`;
}

function resolveAction(
  doc: HornDocument,
  action: HornTapeAction,
  currentNodeId: string | null,
): { payload: HornTapeEventPayload; nextNodeId: string | null } {
  const nodeById = new Map(doc.nodes.map((node) => [node.id, node]));
  const relationById = new Map(
    doc.relations.map((relation) => [relation.id, relation]),
  );
  const citationById = new Map(
    doc.citations.map((citation) => [citation.id, citation]),
  );

  switch (action.kind) {
    case "focus-node": {
      if (!nodeById.has(action.nodeId)) {
        throw new Error(`Unknown Horn node ${action.nodeId}`);
      }
      return { payload: action, nextNodeId: action.nodeId };
    }
    case "follow-relation": {
      if (currentNodeId === null) {
        throw new Error(
          `Cannot follow relation ${action.relationId} without a focused node`,
        );
      }
      const relation = relationById.get(action.relationId);
      if (!relation) {
        throw new Error(`Unknown Horn relation ${action.relationId}`);
      }
      // Persisted Horn relations point response -> earlier claim. Reader traversal
      // follows the dialogue in the opposite direction: earlier claim -> response.
      if (relation.to !== currentNodeId) {
        throw new Error(
          `Relation ${relation.id} is not reader-followable from ${currentNodeId}`,
        );
      }
      return {
        payload: {
          kind: "follow-relation",
          relationId: relation.id,
          fromNodeId: currentNodeId,
          toNodeId: relation.from,
        },
        nextNodeId: relation.from,
      };
    }
    case "open-citation": {
      if (currentNodeId === null) {
        throw new Error(
          `Cannot open citation ${action.citationId} without a focused node`,
        );
      }
      const node = nodeById.get(currentNodeId);
      if (!node) {
        throw new Error(`Unknown Horn node ${currentNodeId}`);
      }
      if (!citationById.has(action.citationId)) {
        throw new Error(`Unknown Horn citation ${action.citationId}`);
      }
      if (!node.citationIds.includes(action.citationId)) {
        throw new Error(
          `Citation ${action.citationId} is not attached to node ${currentNodeId}`,
        );
      }
      return {
        payload: {
          kind: "open-citation",
          nodeId: currentNodeId,
          citationId: action.citationId,
        },
        nextNodeId: currentNodeId,
      };
    }
    case "checkpoint":
      return {
        payload: {
          kind: "checkpoint",
          nodeId: currentNodeId,
          label: action.label,
        },
        nextNodeId: currentNodeId,
      };
  }
}

function actionFromPayload(payload: HornTapeEventPayload): HornTapeAction {
  switch (payload.kind) {
    case "focus-node":
      return { kind: "focus-node", nodeId: payload.nodeId };
    case "follow-relation":
      return { kind: "follow-relation", relationId: payload.relationId };
    case "open-citation":
      return { kind: "open-citation", citationId: payload.citationId };
    case "checkpoint":
      return { kind: "checkpoint", label: payload.label };
  }
}

export function recordHornTape(
  doc: HornDocument,
  plan: HornTapePlan,
): HornTape {
  if (plan.version !== HORN_TAPE_PLAN_VERSION) {
    throw new Error(`Unsupported Horn tape plan ${plan.version}`);
  }

  const sourceDigest = canonicalJsonSha256(doc);
  const genesis = genesisDigest(doc, sourceDigest);
  const events: HornTapeEvent[] = [];
  let previousDigest = genesis;
  let currentNodeId: string | null = null;

  for (const [index, action] of plan.actions.entries()) {
    const { payload, nextNodeId } = resolveAction(doc, action, currentNodeId);
    const seq = index + 1;
    const receiptDigest = eventDigest(seq, previousDigest, payload);
    events.push({
      version: HORN_TAPE_EVENT_VERSION,
      seq,
      previousDigest,
      payload,
      receiptDigest,
    });
    previousDigest = receiptDigest;
    currentNodeId = nextNodeId;
  }

  const unsigned: Omit<HornTape, "id"> = {
    version: HORN_TAPE_VERSION,
    replayVersion: HORN_TAPE_REPLAY_VERSION,
    document: { id: doc.id, sha256: sourceDigest },
    direction: "reader",
    genesisDigest: genesis,
    events,
    terminal: { nodeId: currentNodeId, digest: previousDigest },
  };

  return { ...unsigned, id: tapeIdentity(unsigned) };
}

export function verifyHornTape(
  doc: HornDocument,
  tape: HornTape,
): HornTapeVerification {
  const issues: string[] = [];
  const sourceDigest = canonicalJsonSha256(doc);
  const expectedGenesis = genesisDigest(doc, sourceDigest);

  if (tape.version !== HORN_TAPE_VERSION) {
    issues.push("unsupported-tape-version");
  }
  if (tape.replayVersion !== HORN_TAPE_REPLAY_VERSION) {
    issues.push("unsupported-replay-version");
  }
  if (tape.document.id !== doc.id) issues.push("document-id-mismatch");
  if (tape.document.sha256 !== sourceDigest) issues.push("source-digest-mismatch");
  if (tape.direction !== "reader") issues.push("direction-mismatch");
  if (tape.genesisDigest !== expectedGenesis) {
    issues.push("genesis-digest-mismatch");
  }

  let previousDigest = expectedGenesis;
  let currentNodeId: string | null = null;
  let replayedEvents = 0;

  for (const [index, event] of tape.events.entries()) {
    const expectedSeq = index + 1;
    if (event.version !== HORN_TAPE_EVENT_VERSION) {
      issues.push(`event-${expectedSeq}-version-mismatch`);
    }
    if (event.seq !== expectedSeq) {
      issues.push(`event-${expectedSeq}-sequence-mismatch`);
    }
    if (event.previousDigest !== previousDigest) {
      issues.push(`event-${expectedSeq}-previous-digest-mismatch`);
    }

    const expectedReceipt = eventDigest(
      expectedSeq,
      previousDigest,
      event.payload,
    );
    if (event.receiptDigest !== expectedReceipt) {
      issues.push(`event-${expectedSeq}-receipt-digest-mismatch`);
    }

    try {
      const resolved = resolveAction(
        doc,
        actionFromPayload(event.payload),
        currentNodeId,
      );
      if (
        canonicalJsonSha256(resolved.payload) !==
        canonicalJsonSha256(event.payload)
      ) {
        issues.push(`event-${expectedSeq}-payload-mismatch`);
      }
      currentNodeId = resolved.nextNodeId;
      replayedEvents += 1;
    } catch {
      issues.push(`event-${expectedSeq}-semantic-replay-failed`);
    }

    previousDigest = expectedReceipt;
  }

  if (tape.terminal.nodeId !== currentNodeId) {
    issues.push("terminal-node-mismatch");
  }
  if (tape.terminal.digest !== previousDigest) {
    issues.push("terminal-digest-mismatch");
  }

  const unsigned: Omit<HornTape, "id"> = {
    version: tape.version,
    replayVersion: tape.replayVersion,
    document: tape.document,
    direction: tape.direction,
    genesisDigest: tape.genesisDigest,
    events: tape.events,
    terminal: tape.terminal,
  };
  const expectedTapeId = tapeIdentity(unsigned);
  if (tape.id !== expectedTapeId) issues.push("tape-id-mismatch");

  return {
    version: HORN_TAPE_VERIFICATION_VERSION,
    valid: issues.length === 0,
    tapeId: tape.id,
    expectedTapeId,
    sourceDigest,
    terminalNodeId: currentNodeId,
    terminalDigest: previousDigest,
    replayedEvents,
    issues,
  };
}
