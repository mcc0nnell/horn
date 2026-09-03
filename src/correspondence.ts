import type { HornArgument, HornArgumentRelationKind } from "./argument";
import type { HornDocument, RelationKind } from "./types";

export type HornCorrespondenceProblem = {
  code: string;
  message: string;
};

function relationKindsAgree(
  semantic: HornArgumentRelationKind,
  cartographic: RelationKind,
): boolean {
  return semantic === cartographic;
}

/**
 * Validate the authored cartographic realization of a semantic Horn argument.
 *
 * Shared identities are the contract. Debate nodes in the document must realize
 * semantic claims with the same ids. Authored overlays are allowed to exist only
 * in the cartographic document. Semantic support/dispute/backing relations survive
 * with identical ids and endpoints. A semantic warrant is not a free-standing
 * edge: it licenses a support move. Cartography may render that licensing relation
 * as a `warrants` road from the warrant claim to the supported position.
 * Geometry itself is deliberately ignored here because it remains authored evidence.
 */
export function validateArgumentCartography(
  argument: HornArgument,
  document: HornDocument,
): HornCorrespondenceProblem[] {
  const problems: HornCorrespondenceProblem[] = [];
  const claimById = new Map(argument.claims.map((claim) => [claim.id, claim]));
  const relationById = new Map(argument.relations.map((relation) => [relation.id, relation]));
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const documentRelationById = new Map(document.relations.map((relation) => [relation.id, relation]));
  const expectedCartographicWarrants = new Set<string>();

  if (argument.issueQuestion !== document.issueQuestion) {
    problems.push({
      code: "issue-question-mismatch",
      message: "argument issue question does not match document issue question",
    });
  }

  const documentFocus = document.nodes.filter(
    (node) => node.focus === true && node.origin === "debate",
  );
  if (documentFocus.length !== 1 || documentFocus[0]?.id !== argument.focusClaimId) {
    problems.push({
      code: "focus-claim-mismatch",
      message: `document debate focus must realize argument focus ${argument.focusClaimId}`,
    });
  }

  for (const claim of argument.claims) {
    const node = nodeById.get(claim.id);
    if (!node) {
      problems.push({
        code: "missing-cartographic-claim",
        message: `argument claim ${claim.id} has no cartographic node with the same id`,
      });
      continue;
    }
    if (node.origin !== "debate") {
      problems.push({
        code: "semantic-claim-realized-as-authored-overlay",
        message: `argument claim ${claim.id} is realized by an authored overlay rather than a debate node`,
      });
    }
  }

  for (const node of document.nodes) {
    if (node.origin === "debate" && !claimById.has(node.id)) {
      problems.push({
        code: "cartographic-debate-node-without-semantic-claim",
        message: `debate node ${node.id} has no semantic claim with the same id`,
      });
    }
  }

  for (const relation of argument.relations) {
    const cartographic = documentRelationById.get(relation.id);
    if (!cartographic) {
      problems.push({
        code: "missing-cartographic-relation",
        message: `argument relation ${relation.id} has no cartographic relation with the same id`,
      });
      continue;
    }
    if (cartographic.from !== relation.from || cartographic.to !== relation.to) {
      problems.push({
        code: "relation-endpoint-mismatch",
        message: `relation ${relation.id} changes endpoints during cartography`,
      });
    }
    if (!relationKindsAgree(relation.kind, cartographic.kind)) {
      problems.push({
        code: "relation-kind-mismatch",
        message: `relation ${relation.id} changes meaning from ${relation.kind} to ${cartographic.kind}`,
      });
    }

    if (relation.warrantClaimId !== undefined) {
      const warrantRoad = document.relations.find(
        (candidate) =>
          candidate.kind === "warrants" &&
          candidate.from === relation.warrantClaimId &&
          candidate.to === relation.to,
      );
      if (!warrantRoad) {
        problems.push({
          code: "missing-cartographic-warrant",
          message: `support ${relation.id} is licensed by ${relation.warrantClaimId} but the mural has no matching warrant road`,
        });
      } else {
        expectedCartographicWarrants.add(warrantRoad.id);
      }
    }
  }

  for (const relation of document.relations) {
    const fromNode = nodeById.get(relation.from);
    const toNode = nodeById.get(relation.to);
    const isDebateRelation = fromNode?.origin === "debate" && toNode?.origin === "debate";
    if (!isDebateRelation) continue;

    if (relation.kind === "warrants") {
      if (!expectedCartographicWarrants.has(relation.id)) {
        problems.push({
          code: "cartographic-warrant-without-semantic-license",
          message: `warrant road ${relation.id} does not realize any semantic support warrant`,
        });
      }
      continue;
    }

    if (!relationById.has(relation.id)) {
      problems.push({
        code: "cartographic-debate-relation-without-semantic-relation",
        message: `debate relation ${relation.id} has no semantic relation with the same id`,
      });
    }
  }

  return problems;
}
