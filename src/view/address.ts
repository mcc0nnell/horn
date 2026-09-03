import type { HornCameraController } from "./controller";
import type { HornViewBox } from "./camera";

export type HornAddress =
  | { kind: "node"; nodeId: string }
  | { kind: "view"; viewBox: HornViewBox }
  | { kind: "full" };

function finite(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function paramsFrom(input: string | URL | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input);
  }
  if (input instanceof URL) {
    return new URLSearchParams(input.searchParams);
  }
  if (input.startsWith("?") || !input.includes("://")) {
    return new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);
  }
  return new URL(input).searchParams;
}

export function parseHornAddress(
  input: string | URL | URLSearchParams,
): HornAddress {
  const params = paramsFrom(input);
  const nodeId = params.get("node")?.trim();
  if (nodeId) {
    return { kind: "node", nodeId };
  }

  const raw = params.get("view")?.split(",").map((value) => value.trim());
  if (raw?.length === 4) {
    const [xRaw, yRaw, widthRaw, heightRaw] = raw;
    const x = finite(xRaw);
    const y = finite(yRaw);
    const width = finite(widthRaw);
    const height = finite(heightRaw);
    if (
      x !== undefined &&
      y !== undefined &&
      width !== undefined &&
      height !== undefined &&
      width > 0 &&
      height > 0
    ) {
      return {
        kind: "view",
        viewBox: { x, y, width, height },
      };
    }
  }

  return { kind: "full" };
}

function compact(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Horn viewBox values must be finite");
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

export function hornNodeUrl(base: string | URL, nodeId: string): URL {
  if (nodeId.trim() === "") {
    throw new Error("Horn node id cannot be empty");
  }
  const url = new URL(base.toString());
  url.searchParams.set("node", nodeId);
  url.searchParams.delete("view");
  return url;
}

export function hornViewUrl(base: string | URL, viewBox: HornViewBox): URL {
  if (
    !Number.isFinite(viewBox.x) ||
    !Number.isFinite(viewBox.y) ||
    !Number.isFinite(viewBox.width) ||
    !Number.isFinite(viewBox.height) ||
    viewBox.width <= 0 ||
    viewBox.height <= 0
  ) {
    throw new Error("Horn viewBox must contain finite values and positive dimensions");
  }
  const url = new URL(base.toString());
  url.searchParams.set(
    "view",
    [viewBox.x, viewBox.y, viewBox.width, viewBox.height].map(compact).join(","),
  );
  url.searchParams.delete("node");
  return url;
}

export function applyHornAddress(
  controller: HornCameraController,
  address: HornAddress,
): HornViewBox {
  switch (address.kind) {
    case "node":
      return controller.focusNode(address.nodeId);
    case "view":
      return controller.setViewBox(address.viewBox);
    case "full":
      return controller.reset();
  }
}
