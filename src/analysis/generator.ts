import type { HornDocument, HornNode, HornRelation } from "../types.js";

export type GeneratedCase = {
  name: string;
  seed: number;
  validIntent: boolean;
  document: HornDocument;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function baseDocument(id: string): HornDocument {
  return {
    id,
    version: "horn-document/0.1",
    vocabulary: ["argumentation"],
    unitSize: "concept-diagram",
    authority: "authored",
    after: { name: "Robert E. Horn", works: ["Mapping Great Debates (1998)"] },
    title: id,
    subtitle: "generated fixture",
    issueQuestion: "What follows?",
    canvas: { width: 4000, height: 4000, unit: "test", origin: "top-left" },
    regions: [],
    nodes: [],
    relations: [],
    citations: [
      {
        id: "mapped",
        layer: "mapped",
        citation: "Mapped source",
        short: "Mapped",
        year: 1998,
      },
      {
        id: "cartographic",
        layer: "cartographic",
        citation: "Cartographic source",
        short: "Cartographic",
        year: 2026,
      },
    ],
    readingPath: [],
    rights: "test",
  };
}

function makeNode(
  id: string,
  number: number,
  x: number,
  y: number,
  extras: Partial<HornNode> = {},
): HornNode {
  return {
    id,
    number,
    kind: extras.kind ?? "claim",
    origin: extras.origin ?? "debate",
    label: extras.label ?? id,
    text: extras.text ?? id,
    geometry: extras.geometry ?? { x, y, w: 80, h: 60 },
    citationIds: extras.citationIds ?? ["mapped", "cartographic"],
    ...("focus" in extras ? { focus: extras.focus } : {}),
    ...("year" in extras ? { year: extras.year } : {}),
  };
}

function makeRel(
  id: string,
  kind: HornRelation["kind"],
  from: string,
  to: string,
): HornRelation {
  return { id, kind, from, to, label: kind };
}

function emptyGraph(): HornDocument {
  const document = baseDocument("horn:generated:empty");
  document.nodes = [];
  document.readingPath = [];
  return document;
}

function oneNode(): HornDocument {
  const document = baseDocument("horn:generated:one-node");
  document.nodes = [
    makeNode("anchor", 1, 40, 40, {
      origin: "authored",
      focus: true,
      year: 2026,
      citationIds: ["cartographic"],
    }),
  ];
  document.readingPath = ["anchor"];
  return document;
}

function disconnected(rng: () => number): HornDocument {
  const document = baseDocument("horn:generated:disconnected");
  const count = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < count; i += 1) {
    document.nodes.push(
      makeNode(`n${i + 1}`, i + 1, 40 + (i % 4) * 120, 40 + Math.floor(i / 4) * 120, {
        origin: i === 0 ? "authored" : "debate",
        focus: i === 0,
        year: 1990 + i,
        citationIds: i === 0 ? ["cartographic"] : ["mapped", "cartographic"],
      }),
    );
  }
  document.readingPath = document.nodes.map((node) => node.id);
  return document;
}

function chain(length: number): HornDocument {
  const document = baseDocument(`horn:generated:chain-${length}`);
  for (let i = 0; i < length; i += 1) {
    document.nodes.push(
      makeNode(`n${i + 1}`, i + 1, 40 + i * 100, 80, {
        origin: i === 0 ? "authored" : "debate",
        focus: i === 0,
        year: 1950 + i,
        citationIds: i === 0 ? ["cartographic"] : ["mapped", "cartographic"],
      }),
    );
    if (i > 0) {
      document.relations.push(
        makeRel(`r${i}`, "supports", `n${i + 1}`, `n${i}`),
      );
    }
  }
  document.readingPath = document.nodes.map((node) => node.id);
  return document;
}

function diamond(): HornDocument {
  const document = baseDocument("horn:generated:diamond");
  document.nodes = [
    makeNode("focus", 1, 200, 40, { origin: "authored", focus: true, year: 1950, citationIds: ["cartographic"] }),
    makeNode("left", 2, 40, 160, { year: 1960 }),
    makeNode("right", 3, 360, 160, { year: 1961 }),
    makeNode("join", 4, 200, 280, { year: 1970 }),
  ];
  document.relations = [
    makeRel("left-focus", "supports", "left", "focus"),
    makeRel("right-focus", "disputes", "right", "focus"),
    makeRel("join-left", "supports", "join", "left"),
    makeRel("join-right", "supports", "join", "right"),
  ];
  document.readingPath = ["focus", "left", "right", "join"];
  return document;
}

function cycle(): HornDocument {
  const document = baseDocument("horn:generated:cycle");
  document.nodes = [
    makeNode("a", 1, 40, 40, { origin: "authored", focus: true, year: 1950, citationIds: ["cartographic"] }),
    makeNode("b", 2, 200, 40, { year: 1960 }),
    makeNode("c", 3, 120, 200, { year: 1970 }),
  ];
  document.relations = [
    makeRel("b-a", "supports", "b", "a"),
    makeRel("c-b", "disputes", "c", "b"),
    makeRel("a-c", "interprets-as", "a", "c"),
  ];
  document.readingPath = ["a", "b", "c"];
  return document;
}

function highFan(fan: number): HornDocument {
  const document = baseDocument(`horn:generated:fan-${fan}`);
  document.nodes.push(
    makeNode("focus", 1, 40, 40, {
      origin: "authored",
      focus: true,
      year: 1950,
      citationIds: ["cartographic"],
    }),
  );
  for (let i = 0; i < fan; i += 1) {
    document.nodes.push(
      makeNode(`leaf-${i + 1}`, i + 2, 40 + (i % 10) * 90, 200 + Math.floor(i / 10) * 90, {
        year: 1960 + i,
      }),
    );
    document.relations.push(
      makeRel(`r${i + 1}`, i % 2 === 0 ? "supports" : "disputes", `leaf-${i + 1}`, "focus"),
    );
  }
  document.readingPath = document.nodes.map((node) => node.id);
  return document;
}

function duplicateIds(): HornDocument {
  const document = chain(3);
  document.id = "horn:generated:duplicate-ids";
  document.nodes.push(
    makeNode("n1", 99, 800, 800, { origin: "authored", citationIds: ["cartographic"] }),
  );
  return document;
}

function missingEndpoints(): HornDocument {
  const document = chain(2);
  document.id = "horn:generated:missing-endpoints";
  document.relations.push(makeRel("ghost", "supports", "missing-from", "missing-to"));
  return document;
}

function largeGraph(count: number, rng: () => number): HornDocument {
  const document = baseDocument(`horn:generated:large-${count}`);
  for (let i = 0; i < count; i += 1) {
    document.nodes.push(
      makeNode(`n${i + 1}`, i + 1, 40 + (i % 20) * 90, 40 + Math.floor(i / 20) * 90, {
        origin: i === 0 ? "authored" : "debate",
        focus: i === 0,
        year: 1900 + (i % 120),
        citationIds: i === 0 ? ["cartographic"] : ["mapped", "cartographic"],
      }),
    );
  }
  for (let i = 1; i < count; i += 1) {
    const target = 1 + Math.floor(rng() * i);
    const kind = pick(rng, ["supports", "disputes", "interprets-as"] as const);
    document.relations.push(makeRel(`r${i}`, kind, `n${i + 1}`, `n${target}`));
  }
  document.readingPath = document.nodes.slice(0, Math.min(count, 40)).map((node) => node.id);
  return document;
}

export function generateFixtureCases(seed: number): GeneratedCase[] {
  const rng = mulberry32(seed);
  const cases: GeneratedCase[] = [
    { name: "empty-graph", seed, validIntent: false, document: emptyGraph() },
    { name: "one-node", seed, validIntent: true, document: oneNode() },
    { name: "disconnected", seed, validIntent: true, document: disconnected(rng) },
    { name: "long-chain", seed, validIntent: true, document: chain(12) },
    { name: "diamond", seed, validIntent: true, document: diamond() },
    { name: "cycle", seed, validIntent: true, document: cycle() },
    { name: "high-fan", seed, validIntent: true, document: highFan(16) },
    { name: "duplicate-ids", seed, validIntent: false, document: duplicateIds() },
    { name: "missing-endpoints", seed, validIntent: false, document: missingEndpoints() },
    { name: "large-synthetic", seed, validIntent: true, document: largeGraph(48, rng) },
  ];
  return cases;
}
