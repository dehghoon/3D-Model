import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Display options are collapsible", () => {
  const src = source("components/ViewportDisplayOptionsV05.tsx");
  assert.match(src, /<details/);
  assert.match(src, /<summary/);
  assert.match(src, /open=\{false\}/);
});

test("Boundary condition symbols use tuned visual sizes and release offset", () => {
  const src = source("lib/visualization/boundary-condition-symbols.ts");
  assert.match(src, /size \* 1.18/);
  assert.match(src, /releaseSize = size \* 1.16/);
  assert.match(src, /releaseOffset = Math\.min\(size \* 0.72, length \* 0.18\)/);
  assert.match(src, /start\.clone\(\)\.ad\(/u;
  assert.match(src, /end\.clone\(\)\.ad\(/u;
});

test("Node visual scale is smaller while labels are larger and clearer", () => {
  const src = source("lib/visualization/display-options-scene.ts");
  assert.match(src, /NODE_VISUAL_SCALE = 0.8/);
  assert.match(src, /canvas.width = 384/);
  assert.match(src, /canvas.height = 128/);
  assert.match(src, /700 48px Arial/);
  assert.match(src, /sprite.scale.set\(scale \* 3.4, scale \* 1.14, 1\)/);
});
