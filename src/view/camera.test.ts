import assert from "node:assert/strict";
import test from "node:test";

import { HornCamera, viewBoxToString } from "./camera";

test("starts at the full authored canvas", () => {
  const camera = new HornCamera({ width: 1000, height: 500 });
  assert.deepEqual(camera.viewBox, { x: 0, y: 0, width: 1000, height: 500 });
  assert.equal(viewBoxToString(camera.viewBox), "0 0 1000 500");
});

test("zooms around the current center without changing canvas geometry", () => {
  const camera = new HornCamera({ width: 1000, height: 500 });
  assert.deepEqual(camera.zoom(2), {
    x: 250,
    y: 125,
    width: 500,
    height: 250,
  });
});

test("zooms around a document-space anchor", () => {
  const camera = new HornCamera({ width: 1000, height: 500 });
  assert.deepEqual(camera.zoom(2, { x: 0, y: 0 }), {
    x: 0,
    y: 0,
    width: 500,
    height: 250,
  });
});

test("clamps pan to the authored canvas", () => {
  const camera = new HornCamera({ width: 1000, height: 500 });
  camera.zoom(2);
  assert.deepEqual(camera.pan(-1000, -1000), {
    x: 0,
    y: 0,
    width: 500,
    height: 250,
  });
  assert.deepEqual(camera.pan(1000, 1000), {
    x: 500,
    y: 250,
    width: 500,
    height: 250,
  });
});

test("focus expands a node rectangle to the mural aspect ratio", () => {
  const camera = new HornCamera(
    { width: 1000, height: 500 },
    { focusPadding: 0 },
  );
  assert.deepEqual(camera.focus({ x: 400, y: 200, w: 100, h: 100 }), {
    x: 350,
    y: 200,
    width: 200,
    height: 100,
  });
});

test("focus clamps at canvas boundaries without moving the node", () => {
  const camera = new HornCamera(
    { width: 1000, height: 500 },
    { focusPadding: 0 },
  );
  assert.deepEqual(camera.focus({ x: 0, y: 0, w: 100, h: 100 }), {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  });
});
