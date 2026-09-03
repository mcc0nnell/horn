import type { Point, Rect } from "../types";

export type HornCanvas = {
  width: number;
  height: number;
};

export type HornViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HornCameraOptions = {
  maxZoom?: number;
  focusPadding?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function finitePositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number`);
  }
  return value;
}

function normalizeViewBox(view: HornViewBox, canvas: HornCanvas): HornViewBox {
  const width = clamp(view.width, Number.EPSILON, canvas.width);
  const height = clamp(view.height, Number.EPSILON, canvas.height);
  return {
    x: clamp(view.x, 0, canvas.width - width),
    y: clamp(view.y, 0, canvas.height - height),
    width,
    height,
  };
}

export function viewBoxToString(view: HornViewBox): string {
  return `${view.x} ${view.y} ${view.width} ${view.height}`;
}

export class HornCamera {
  readonly canvas: HornCanvas;
  readonly maxZoom: number;
  readonly focusPadding: number;

  #view: HornViewBox;

  constructor(canvas: HornCanvas, options: HornCameraOptions = {}) {
    this.canvas = {
      width: finitePositive(canvas.width, "canvas.width"),
      height: finitePositive(canvas.height, "canvas.height"),
    };
    const maxZoom = finitePositive(options.maxZoom ?? 24, "maxZoom");
    if (maxZoom < 1) {
      throw new Error("maxZoom must be at least 1");
    }
    this.maxZoom = maxZoom;
    this.focusPadding = options.focusPadding ?? 0.12;
    if (
      !Number.isFinite(this.focusPadding) ||
      this.focusPadding < 0 ||
      this.focusPadding > 2
    ) {
      throw new Error("focusPadding must be between 0 and 2");
    }
    this.#view = this.fullCanvas();
  }

  get viewBox(): HornViewBox {
    return { ...this.#view };
  }

  fullCanvas(): HornViewBox {
    return {
      x: 0,
      y: 0,
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  reset(): HornViewBox {
    this.#view = this.fullCanvas();
    return this.viewBox;
  }

  set(view: HornViewBox): HornViewBox {
    this.#view = normalizeViewBox(view, this.canvas);
    return this.viewBox;
  }

  pan(dx: number, dy: number): HornViewBox {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new Error("pan delta must be finite");
    }
    return this.set({
      ...this.#view,
      x: this.#view.x + dx,
      y: this.#view.y + dy,
    });
  }

  zoom(factor: number, anchor?: Point): HornViewBox {
    finitePositive(factor, "zoom factor");

    const current = this.#view;
    const aspect = this.canvas.width / this.canvas.height;
    const minWidth = this.canvas.width / this.maxZoom;
    const minHeight = this.canvas.height / this.maxZoom;

    let width = clamp(current.width / factor, minWidth, this.canvas.width);
    let height = width / aspect;

    if (height < minHeight) {
      height = minHeight;
      width = height * aspect;
    }
    if (height > this.canvas.height) {
      height = this.canvas.height;
      width = height * aspect;
    }

    const focus = anchor ?? {
      x: current.x + current.width / 2,
      y: current.y + current.height / 2,
    };
    const rx = current.width === 0 ? 0.5 : (focus.x - current.x) / current.width;
    const ry = current.height === 0 ? 0.5 : (focus.y - current.y) / current.height;

    return this.set({
      x: focus.x - rx * width,
      y: focus.y - ry * height,
      width,
      height,
    });
  }

  focus(rect: Rect, padding = this.focusPadding): HornViewBox {
    if (
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.w) ||
      !Number.isFinite(rect.h) ||
      rect.w <= 0 ||
      rect.h <= 0
    ) {
      throw new Error("focus rect must be finite with positive dimensions");
    }
    if (!Number.isFinite(padding) || padding < 0) {
      throw new Error("focus padding must be finite and non-negative");
    }

    const aspect = this.canvas.width / this.canvas.height;
    const center = {
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
    };

    let width = rect.w * (1 + padding * 2);
    let height = rect.h * (1 + padding * 2);

    if (width / height < aspect) {
      width = height * aspect;
    } else {
      height = width / aspect;
    }

    width = Math.min(width, this.canvas.width);
    height = Math.min(height, this.canvas.height);

    return this.set({
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
    });
  }
}
