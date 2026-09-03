import type { HornDocument, Point } from "../types";
import { HornCamera, type HornViewBox, viewBoxToString } from "./camera";

export type HornCameraControllerOptions = {
  maxZoom?: number;
  focusPadding?: number;
  wheelSensitivity?: number;
  keyboardPanFraction?: number;
  onChange?: (viewBox: HornViewBox) => void;
};

export type HornCameraController = {
  camera: HornCamera;
  focusNode: (nodeId: string) => HornViewBox;
  setViewBox: (viewBox: HornViewBox) => HornViewBox;
  reset: () => HornViewBox;
  destroy: () => void;
};

type DragState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  viewBox: HornViewBox;
};

function eventNodeId(event: Event): string | undefined {
  for (const target of event.composedPath()) {
    if (target instanceof Element) {
      const id = target.getAttribute("data-horn-node");
      if (id) {
        return id;
      }
    }
  }
  return undefined;
}

function clientToDocument(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const matrix = svg.getScreenCTM();
  if (!matrix) {
    const view = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.width,
      y: view.y + ((clientY - rect.top) / rect.height) * view.height,
    };
  }

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

export function attachHornCamera(
  svg: SVGSVGElement,
  doc: HornDocument,
  options: HornCameraControllerOptions = {},
): HornCameraController {
  const camera = new HornCamera(doc.canvas, {
    ...(options.maxZoom === undefined ? {} : { maxZoom: options.maxZoom }),
    ...(options.focusPadding === undefined
      ? {}
      : { focusPadding: options.focusPadding }),
  });
  const wheelSensitivity = options.wheelSensitivity ?? 0.0015;
  const keyboardPanFraction = options.keyboardPanFraction ?? 0.1;

  if (!Number.isFinite(wheelSensitivity) || wheelSensitivity <= 0) {
    throw new Error("wheelSensitivity must be a finite positive number");
  }
  if (
    !Number.isFinite(keyboardPanFraction) ||
    keyboardPanFraction <= 0 ||
    keyboardPanFraction > 1
  ) {
    throw new Error("keyboardPanFraction must be in (0, 1]");
  }

  let drag: DragState | undefined;

  const apply = (viewBox: HornViewBox): HornViewBox => {
    svg.setAttribute("viewBox", viewBoxToString(viewBox));
    options.onChange?.({ ...viewBox });
    return viewBox;
  };

  const reset = (): HornViewBox => apply(camera.reset());
  const setViewBox = (viewBox: HornViewBox): HornViewBox =>
    apply(camera.set(viewBox));

  const focusNode = (nodeId: string): HornViewBox => {
    const node = doc.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      throw new Error(`Unknown Horn node ${nodeId}`);
    }
    return apply(camera.focus(node.geometry));
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    drag = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewBox: camera.viewBox,
    };
    svg.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const dx = -((event.clientX - drag.clientX) / rect.width) * drag.viewBox.width;
    const dy = -((event.clientY - drag.clientY) / rect.height) * drag.viewBox.height;
    apply(
      camera.set({
        ...drag.viewBox,
        x: drag.viewBox.x + dx,
        y: drag.viewBox.y + dy,
      }),
    );
  };

  const endDrag = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
    drag = undefined;
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const anchor = clientToDocument(svg, event.clientX, event.clientY);
    const factor = Math.exp(-event.deltaY * wheelSensitivity);
    apply(camera.zoom(factor, anchor));
  };

  const onDoubleClick = (event: MouseEvent): void => {
    const nodeId = eventNodeId(event);
    if (!nodeId) {
      return;
    }
    event.preventDefault();
    focusNode(nodeId);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const view = camera.viewBox;
    const dx = view.width * keyboardPanFraction;
    const dy = view.height * keyboardPanFraction;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        apply(camera.pan(-dx, 0));
        break;
      case "ArrowRight":
        event.preventDefault();
        apply(camera.pan(dx, 0));
        break;
      case "ArrowUp":
        event.preventDefault();
        apply(camera.pan(0, -dy));
        break;
      case "ArrowDown":
        event.preventDefault();
        apply(camera.pan(0, dy));
        break;
      case "+":
      case "=":
        event.preventDefault();
        apply(camera.zoom(1.35));
        break;
      case "-":
      case "_":
        event.preventDefault();
        apply(camera.zoom(1 / 1.35));
        break;
      case "0":
      case "Home":
        event.preventDefault();
        reset();
        break;
    }
  };

  if (!svg.hasAttribute("tabindex")) {
    svg.setAttribute("tabindex", "0");
  }
  svg.style.touchAction = "none";
  reset();

  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  svg.addEventListener("wheel", onWheel, { passive: false });
  svg.addEventListener("dblclick", onDoubleClick);
  svg.addEventListener("keydown", onKeyDown);

  const destroy = (): void => {
    svg.removeEventListener("pointerdown", onPointerDown);
    svg.removeEventListener("pointermove", onPointerMove);
    svg.removeEventListener("pointerup", endDrag);
    svg.removeEventListener("pointercancel", endDrag);
    svg.removeEventListener("wheel", onWheel);
    svg.removeEventListener("dblclick", onDoubleClick);
    svg.removeEventListener("keydown", onKeyDown);
  };

  return { camera, focusNode, setViewBox, reset, destroy };
}
