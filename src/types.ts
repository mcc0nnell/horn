export type HornAuthority = "historical" | "authored";

export type HornUnitSize =
  | "vlicon"
  | "concept-diagram"
  | "infographic"
  | "infomural";

export type NodeKind =
  | "question"
  | "claim"
  | "grounds"
  | "warrant"
  | "rebuttal"
  | "example"
  | "gloss";

export type RelationKind = "supports" | "disputes" | "warrants" | "addresses";

export type ClaimOrigin = "debate" | "authored";

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Citation = {
  id: string;
  layer: "mapped" | "cartographic";
  citation: string;
  short: string;
  year: number;
  url?: string;
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
};

export type HornRelation = {
  id: string;
  kind: RelationKind;
  from: string;
  to: string;
  label: string;
};

export type HornRegion = {
  id: string;
  label: string;
  geometry: Rect;
};

export type HornDocument = {
  id: string;
  version: "horn-document/0.1";
  vocabulary: string[];
  unitSize: HornUnitSize;
  authority: HornAuthority;
  after: {
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
};
