import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("real section renderer consumes Core section geometry with explicit units", () => {
  const renderer = source("lib/visualization/section-profile-geometry.ts");

  assert.match(renderer, /UnitValue/);
  assert.match(renderer, /["W\",\"WF\",\"I"]/);
  assert.match(renderer, /["HSS\",\"RHS\",\"SHS\",\"BOX"]/);
  assert.match(renderer, /["PIPE\",\"CHS"]/);
  assert.match(renderer, /return null;/);
});

test("member profile orientation follows Core local axes and rotation", () => {
  const renderer = source("lib/visualization/section-profile-geometry.ts");

  assert.match(renderer, /member\.localAxes/);
  assert.match(renderer, /right-handed/);
  assert.match(renderer, /member\.rotationDeg/);
  assert.match(renderer, /setFromAxisAngle/);
});

test("active core scene replaces only the visible member geometry", () => {
  const scene = source("lib/visualization/core-scene-v2.ts");

  assert.match(scene, /buildRealMemberGeometry/);
  assert.match(scene, /MeshStandardMaterial/);
  assert.match(scene, /visible\.geometry = geometry/);
  assert.doesNotMatch(scene, /hit\\.geometry = geometry/);
});
