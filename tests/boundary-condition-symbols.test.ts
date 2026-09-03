import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("boundary condition symbols follow canonical Core supports and releases", () => {
  const symbols = source("lib/visualization/boundary-condition-symbols.ts");

  assert.match(symbols, /model\\.supports/);
  assert.match(symbols, /member\\.startRelease/);
  assert.match(symbols, /member\\.endRelease/);
  assert.match(symbols, /Object\\.values\\(release\\*\)\\.some\\(Boolean\\)/);
  assert.match(symbols, /release-symbol:/);
  assert.doesNotMatch(symbols, /partial release|full release|pinned-pinned/i);
});

test("active scene mounts and disposes support and release symbols", () => {
  const scene = source("lib/visualization/core-scene-v2.ts");

  assert.match(scene, /buildBoundaryConditionSymbols/);
  assert.match(scene, /core-boundary-condition-symbols/);
  assert.match(scene, /disposeBoundaryConditionSymbols/);
});
