import type {
  HornDocument,
  HornPathCommand,
  HornRelation,
  HornRoute,
} from "../types";
import { validateHornDocument } from "../validate";

export type HornRenderWarning = {
  code: "unrouted-authored-relation";
  message: string;
  relationId: string;
};

export type HornSvgRenderOptions = {
  showRegions?: boolean;
  showRelationLabels?: boolean;
  accessibleTitle?: string;
};

export type HornSvgRenderResult = {
  svg: string;
  warnings: HornRenderWarning[];
};

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function number(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot render non-finite coordinate ${value}`);
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function commandToSvg(command: HornPathCommand): string {
  switch (command.op) {
    case "M":
      return `M ${number(command.x)} ${number(command.y)}`;
    case "L":
      return `L ${number(command.x)} ${number(command.y)}`;
    case "Q":
      return `Q ${number(command.x1)} ${number(command.y1)} ${number(command.x)} ${number(command.y)}`;
    case "C":
      return `C ${number(command.x1)} ${number(command.y1)} ${number(command.x2)} ${number(command.y2)} ${number(command.x)} ${number(command.y)}`;
    case "Z":
      return "Z";
  }
}

export function pathCommandsToSvgD(commands: HornPathCommand[]): string {
  return commands.map(commandToSvg).join(" ");
}

function relationClass(relation: HornRelation): string {
  return `horn-relation horn-relation--${xml(relation.kind)}`;
}

function renderRelationPath(relation: HornRelation, route: HornRoute): string {
  return [
    `<path class="${relationClass(relation)}"`,
    ` data-horn-relation="${xml(relation.id)}"`,
    ` data-from="${xml(relation.from)}"`,
    ` data-to="${xml(relation.to)}"`,
    ` data-kind="${xml(relation.kind)}"`,
    ` d="${xml(pathCommandsToSvgD(route.commands))}"`,
    ` fill="none" vector-effect="non-scaling-stroke" />`,
  ].join("");
}

function renderRelationLabel(relation: HornRelation, route: HornRoute): string {
  if (!route.labelGeometry) {
    return "";
  }
  const g = route.labelGeometry;
  return [
    `<foreignObject class="horn-relation-label"`,
    ` data-horn-relation-label="${xml(relation.id)}"`,
    ` x="${number(g.x)}" y="${number(g.y)}"`,
    ` width="${number(g.w)}" height="${number(g.h)}">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" class="horn-relation-label__body">${xml(relation.label)}</div>`,
    `</foreignObject>`,
  ].join("");
}

function renderRegion(region: HornDocument["regions"][number]): string {
  const g = region.geometry;
  return [
    `<g class="horn-region" data-horn-region="${xml(region.id)}">`,
    `<rect x="${number(g.x)}" y="${number(g.y)}" width="${number(g.w)}" height="${number(g.h)}" />`,
    `<text class="horn-region__label" x="${number(g.x)}" y="${number(g.y)}">${xml(region.label)}</text>`,
    `</g>`,
  ].join("");
}

function renderNode(node: HornDocument["nodes"][number]): string {
  const g = node.geometry;
  const classes = [
    "horn-node",
    `horn-node--${node.kind}`,
    `horn-node--${node.origin}`,
    node.focus ? "horn-node--focus" : "",
  ]
    .filter(Boolean)
    .map(xml)
    .join(" ");

  const author = node.author
    ? `<div class="horn-node__author">${xml(node.author)}${node.year ? ` · ${xml(String(node.year))}` : ""}</div>`
    : "";

  return [
    `<foreignObject class="${classes}"`,
    ` data-horn-node="${xml(node.id)}"`,
    ` data-number="${number(node.number)}"`,
    ` data-kind="${xml(node.kind)}"`,
    ` data-origin="${xml(node.origin)}"`,
    ` x="${number(g.x)}" y="${number(g.y)}"`,
    ` width="${number(g.w)}" height="${number(g.h)}">`,
    `<article xmlns="http://www.w3.org/1999/xhtml" class="horn-node__body">`,
    `<header class="horn-node__header"><span class="horn-node__number">${number(node.number)}</span><h2 class="horn-node__label">${xml(node.label)}</h2></header>`,
    `<p class="horn-node__text">${xml(node.text)}</p>`,
    author,
    `</article>`,
    `</foreignObject>`,
  ].join("");
}

export function renderHornSvg(
  doc: HornDocument,
  options: HornSvgRenderOptions = {},
): HornSvgRenderResult {
  const issues = validateHornDocument(doc);
  if (issues.length > 0) {
    throw new Error(
      `Cannot render invalid Horn document:\n${issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n")}`,
    );
  }

  const warnings: HornRenderWarning[] = [];
  const relations: string[] = [];
  const relationLabels: string[] = [];

  for (const relation of doc.relations) {
    if (!relation.route) {
      warnings.push({
        code: "unrouted-authored-relation",
        relationId: relation.id,
        message: `Authored relation ${relation.id} has no persisted route; renderer did not invent one`,
      });
      continue;
    }
    relations.push(renderRelationPath(relation, relation.route));
    if (options.showRelationLabels !== false) {
      relationLabels.push(renderRelationLabel(relation, relation.route));
    }
  }

  const title = options.accessibleTitle ?? doc.title;
  const regions = options.showRegions === false ? [] : doc.regions.map(renderRegion);
  const nodes = doc.nodes.map(renderNode);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` class="horn-mural"`,
    ` data-horn-document="${xml(doc.id)}"`,
    ` data-authority="${xml(doc.authority)}"`,
    ` viewBox="0 0 ${number(doc.canvas.width)} ${number(doc.canvas.height)}"`,
    ` role="img" aria-label="${xml(title)}" preserveAspectRatio="xMidYMid meet">`,
    `<title>${xml(title)}</title>`,
    `<g class="horn-layer horn-layer--regions">${regions.join("")}</g>`,
    `<g class="horn-layer horn-layer--relations">${relations.join("")}</g>`,
    `<g class="horn-layer horn-layer--relation-labels">${relationLabels.join("")}</g>`,
    `<g class="horn-layer horn-layer--nodes">${nodes.join("")}</g>`,
    `</svg>`,
  ].join("");

  return { svg, warnings };
}
