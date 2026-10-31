import assert from "node:assert/strict";
import test from "node:test";
import type { StructuralModel } from "@linkoteq/structural-core";
import { releasePreset, updateMemberEndRelease } from "../lib/member-releases-v05";

const model = (): StructuralModel => ({
  schemaVersion: "0.5",
  project: { id: "P", name: "Release test", units: "SI" },
  levels: [], grids: [], nodes: [],
  members: [
    { id: "M1", type: "beam", startNodeId: "N1", endNodeId: "N2", sectionId: "S", materialId: "MAT" },
    { id: "M2", type: "column", startNodeId: "N2", endNodeId: "N3", sectionId: "S", materialId: "MAT" },
  ],
  surfaces: [], diaphragms: [], materials: [], sections: [],
  supports: [], loadCases: [], loads: [], loadCombinations: [],
});

test("Core v0.5 pinned preset releases rotations but retains translations", () => {
  assert.deepEqual(releasePreset("pinned"), {
    DX: false, DY: false, DZ: false, RX: true, RY: true, RZ: true,
  });
});

test("member end releases modify only the requested end and selected members", () => {
  const original = model();
  const next = updateMemberEndRelease(original, ["M1"], "end", releasePreset("pinned"));
  assert.equal(next.members[0].endRelease?.RZ, true);
  assert.equal(next.members[0].endRelease?.DX, false);
  assert.equal(next.members[0].startRelease, undefined);
  assert.deepEqual(next.members[1], original.members[1]);
  assert.equal(original.members[0].endRelease, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(next)).members[0].endRelease, releasePreset("pinned"));
});

test("manual releases reject missing targets and invalid flags without changing model", () => {
  const original = model();
  assert.throws(() => updateMemberEndRelease(original, ["MISSING"], "start", releasePreset("fixed")), /UNKNOWN_MEMBER/);
  assert.throws(() => updateMemberEndRelease(original, [], "start", releasePreset("fixed")), /NO_MEMBERS_SELECTED/);
  assert.throws(() => updateMemberEndRelease(original, ["M1"], "start", { RX: "yes" } as never), /INVALID_RELEASE_FLAG/);
  assert.equal(original.members[0].startRelease, undefined);
});
