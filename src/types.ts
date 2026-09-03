export type HornAuthority = "historical" | "authored";

export type HornUnitSize =
  | "vlicon"
  | "concept-diagram"
  | "infographic"
  | "infomural";

export type CoreNodeKind =
  | "question"
  | "claim"
  | "grounds"
  | "warrant"
  | "rebuttal"
  | "example"
  | "gloss"
  | "issue-area"
  | "focus-claim"
  | "implemented-model"
  | "proposed-model"
  | "postulate-set"
  | "definition"
  | "concept-sidebar"
  | "thought-experiment"
  | "dilemma"
  | "unmapped-territory"
  | "cross-reference"
  | "supplemental-artifact";

export type NodeKind = CoreNodeKind | `x-${string}`;

export type CoreRelationKind =
  | "supports"
  | "disputes"
  | "warrants"
  | "addresses"
  | "interprets-as";

export type RelationKind = CoreRelationKind | `x-${string}`;

export type ClaimOrigin = "debate" | "authored";
export type CitationLayer = "mapped" | "cartographic";
export type HornExtensions = Record<string, unknown>;

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Citation = {
  id: string;
  layer: CitationLayer;
  citation: string;
  short: string;
  year: number;
  url?: string;
  extensions?: HornExtensions;
};

export type HornNode = {
  id: string;
  number: number;
  kind: NodeKind;
  origin: ClaimOrigin;
  focus?: boolean;
  label: string;
  text: string;
  author?: string;
  authorShort?: string;
  year?: number;
  geometry: Rect;
  citationIds: string[];
  notes?: string;
  extensions?: HornExtensions;
};

export type HornRelation = {
  id: string;
  kind: RelationKind;
  from: string;
  to: string;
  label: string;
  extensions?: HornExtensions;
};

export type HornRegion = {
  id: string;
  label: string;
  geometry: Rect;
  extensions?: HornExtensions;
};

export type HornDocument = {
  id: string;
  version: "horn-document/0.1";
  vocabulary: string[];
  unitSize: HornUnitSize;
  authority: HornAuthority;
  after?: {
    name: string;
    works: string[];
  };
  title: string;
  subtitle: string;
  issueQuestion: string;
  canvas: {
    width: number;
    height: number;
    unit: string;
    origin: "top-left";
  };
  regions: HornRegion[];
  nodes: HornNode[];
  relations: HornRelation[];
  citations: Citation[];
  readingPath: string[];
  rights: string;
  extensions?: HornExtensions;
};
