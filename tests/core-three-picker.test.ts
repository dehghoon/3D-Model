import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("direct Core picker prioritizes nodes before other elements", () => {
  const picker = source("lib/visualization/core-three-picker.ts");
  assert.match(picker, /new THREE\\.Raycaster\\(\\)/);
  assert.match(picker, /getObjectSelection\\(object\\)\\?.type === "node"/);
  assert.match(picker, /const node = pickFromItems\\(raycaster, nodes\\)/);
  assert.match(picker, /if \\(node\\) return node/);
});

test("That Open runtime delegates Core picking to direct Three.js raycaster", () => {
  const runtime = source("lib/visualization/that-open-runtime-base.ts");
  assert.match(runtime, /import { pickCoreThree } from "\\.\\/core-three-picker"/);
  assert.match(runtime, /return pickCoreThree\\(runtime, event\\)/);
});
