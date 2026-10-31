import assert from "node:assert/strict";
import test from "node:test";
import type { StructuralModel } from "@linkoteq/structural-core";
import { deleteSelection } from "../lib/editor/commands";

function model(): StructuralModel {
  return {
    schemaVersion: "0.5", project: { id: "P", name: "Delete safety", units: "SI" },
    levels: [], grids: [],
    nodes: [
      { id: "N1", position: { x: 0, y: 0, z: 0 } },
      { id: "N2", position: { x: 1, y: 0, z: 0 } },
      { id: "N3", position: { x: 2, y: 0, z: 0 } },
    ],
    members: [{ id: "M1", type: "beam", startNodeId: "N1", endNodeId: "N2", sectionId: "S", materialId: "MAT" }],
    surfaces: [], diaphragms: [], materials: [], sections: [], supports: [],
    loadCases: [], loads: [], loadCombinations: [],
  };
}

test("referenced nodes cannot be deleted, but isolated nodes can", () => {
  const original = model();
  assert.throws(() => deleteSelection(original, { type: "node", id: "N1" }), /NODE_REFERENCED_BY_MEMBER/);
  assert.equal(deleteSelection(original, { type: "node", id: "N3" }).model.nodes.length, 2);
  assert.equal(original.nodes.length, 3);
});

test("member with assigned point load cannot be silently deleted", () => {
  const original = model();
  original.loads.push({ id: "LD1", type: "member-point", memberId: "M1", loadCaseId: "LC", coordinateSystem: "global", direction: "FZ", magnitude: { value: -10, unit: "kN" }, x: { value: 0.5, unit: "m" } });
  assert.throws(() => deleteSelection(original, { type: "member", id: "M1" }), /MEMBER_REFERENCED_BY_LOAD/);
});

test("surface with diaphragm membership cannot be silently deleted", () => {
  const original = model();
  original.surfaces.push({ id: "S1", type: "slab", boundaryNodeIds: ["N1", "N2"] });
  original.diaphragms.push({ id: "D1", type: "rigid", levelId: "L1", surfaceIds: ["S1"] });
  assert.throws(() => deleteSelection(original, { type: "surface", id: "S1" }), /SURFACE_REFERENCED_BY_DIAPHRAGM/);
});
