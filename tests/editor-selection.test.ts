import assert from "node:assert/strict";
import test from "node:test";

import type { StructuralModel } from "@linkoteq/structural-core";
import {
  clearSelection,
  createSelection,
  getSelectionLabel,
  isSameSelection,
  reconcileSelection,
  selectionExists,
} from "../lib/editor/selection";

function modelFixture(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "PROJECT001", name: "Selection Test", units: "SI" },
    levels: [],
    grids: [],
    nodes: [
      { id: "N1", position: { x: 0, y: 0, z: 0 } },
      { id: "N2", position: { x: 4, y: 0, z: 0 } },
    ],
    members: [],
    surfaces: [],
    diaphragms: [],
    materials: [],
    sections: [],
    supports: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
  } as StructuralModel;
}

test("creates stable editor selections", () => {
  const selection = createSelection("node", " N1 ");
  assert.deepEqual(selection, { type: "node", id: "N1" });
  assert.equal(getSelectionLabel(selection), "node: N1");
});

test("rejects empty selection ids", () => {
  assert.throws(() => createSelection("member", "   "), /Selection id is required/);
});

test("compares and clears selections", () => {
  const first = createSelection("node", "N1");
  const same = createSelection("node", "N1");
  const different = createSelection("node", "N2");

  assert.equal(isSameSelection(first, same), true);
  assert.equal(isSameSelection(first, different), false);
  assert.equal(clearSelection(), null);
});

test("keeps only selections that still exist in the model", () => {
  const model = modelFixture();
  const existing = createSelection("node", "N1");
  const missing = createSelection("node", "N404");

  assert.equal(selectionExists(model, existing), true);
  assert.equal(selectionExists(model, missing), false);
  assert.deepEqual(reconcileSelection(model, existing), existing);
  assert.equal(reconcileSelection(model, missing), null);
});
