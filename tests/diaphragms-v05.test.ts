import assert from "node:assert/strict";
import test from "node:test";
import type { StructuralModel } from "@linkoteq/structural-core";
import { assignDiaphragm } from "../lib/diaphragms-v05";

const base = (): StructuralModel => ({
  schemaVersion: "0.5", project: { id: "P", name: "Test", units: "SI" },
  levels: [{ id: "L1", name: "Level 1", elevation: 3 }], grids: [],
  nodes: [{ id: "N1", position: { x: 0, y: 0, z: 3 }, levelId: "L1" }],
  members: [], surfaces: [{ id: "S1", type: "slab", boundaryNodeIds: ["N1"], levelId: "L1" }],
  diaphragms: [], materials: [], sections: [], supports: [], loadCases: [], loads: [], loadCombinations: [],
});
const input = { id: "D1", type: "rigid" as const, levelId: "L1", surfaceIds: ["S1"], nodeIds: ["N1"] };

test("diaphragm is canonical and survives JSON round trip", () => {
  const model = base();
  const result = assignDiaphragm(model, input);
  assert.equal(result.diaphragms[0].type, "rigid");
  assert.deepEqual(JSON.parse(JSON.stringify(result)).diaphragms, result.diaphragms);
  assert.equal(model.diaphragms.length, 0);
});

test("diaphragm update replaces matching ID without duplication", () => {
  const once = assignDiaphragm(base(), input);
  const twice = assignDiaphragm(once, { ...input, type: "semi-rigid" });
  assert.equal(twice.diaphragms.length, 1);
  assert.equal(twice.diaphragms[0].type, "semi-rigid");
});

test("diaphragm rejects orphan references and empty targets", () => {
  assert.throws(() => assignDiaphragm(base(), { ...input, levelId: "MISSING" }), /UNKNOWN_DIAPHRAGM_LEVEL/);
  assert.throws(() => assignDiaphragm(base(), { ...input, nodeIds: [], surfaceIds: [] }), /DIAPHRAGM_TARGET_REQUIRED/);
  assert.throws(() => assignDiaphragm(base(), { ...input, nodeIds: ["MISSING"] }), /UNKNOWN_DIAPHRAGM_NODE/);
});
