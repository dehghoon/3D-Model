import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("real section renderer consumes Core geometry with explicit unit conversion", () => {
  const renderer = source("lib/visualization/section-profile-geometry.ts");

  assert.match(renderer, /FACTOR/);
  assert.match(renderer, /geometry\[key\]/);
  assert.match(renderer, /\["W","WF","I","HP","M","S"\]/);
  assert.match(renderer, /\["C","MC","CHANNEL"\]/);
  assert.match(renderer, /\["L","ANGLE"\]/);
  assert.match(renderer, /\["WT","TEE"\]/);
  assert.match(renderer, /"HS SQ"/);
  assert.match(renderer, /"HA RE"/);
  assert.match(renderer, /"HS RO"/);
  assert.match(renderer, /"HA RO"/);
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
  assert.doesNotMatch(scene, /hit\.geometry = geometry/);
});
