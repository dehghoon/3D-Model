import assert from "node:assert/strict";
import test from "node:test";
import type { StructuralModel } from "@linkoteq/structural-core";
import { createSupportFromCanonicalNode } from "../lib/editor-support-v05";

function fixture(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "P1", name: "Support Test", units: "SI" },
    grids: [],
    levels: [],
    nodes: [
      { id: "N1", position: { x: 0, y: 0, z: 0 } },
      { id: "N2", position: { x: 1, y: 0, z: 0 } },
    ],
    members: [],
    surfaces: [],
    materials: [],
    sections: [],
    supports: [],
    supportSprings: [],
    enforcedDisplacements: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
    analysisRuns: [],
    analysisResults: [],
    designRuns: [],
    designResults: [],
    reports: [],
  };
}

test("editor creates canonical six-DOF support from an existing node", () => {
  const model = fixture();
  const result = createSupportFromCanonicalNode(model, {
    nodeId: "N1",
    restraints: { DX: true, DY: true, DZ: true, RX: false, RY: false, RZ: false },
  });

  assert.deepEqual(result.support, {
    id: "SUP1",
    nodeId: "N1",
    restraints: { DX: true, DY: true, DZ: true, RX: false, RY: false, RZ: false },
  });
  assert.equal(model.supports.length, 0);
  assert.equal(result.model.supports.length, 1);
});

test("editor preserves explicit DOF restraints and deterministic support IDs", () => {
  const first = createSupportFromCanonicalNode(fixture(), {
    nodeId: "N1",
    restraints: { DX: true, DY: false, DZ: false, RX: false, RY: true, RZ: true },
  });
  const second = createSupportFromCanonicalNode(first.model, {
    nodeId: "N2",
    restraints: { DX: false, DY: true, DZ: true, RX: true, RY: false, RZ: false },
  });

  assert.equal(first.support.id, "SUP1");
  assert.equal(second.support.id, "SUP2");
  assert.deepEqual(second.support.restraints, { DX: false, DY: true, DZ: true, RX: true, RY: false, RZ: false });
});

test("editor rejects unknown nodes and duplicate node supports", () => {
  assert.throws(
    () => createSupportFromCanonicalNode(fixture(), { nodeId: "MISSING", restraints: { DX: true } }),
    /UNKNOWN_SUPPORT_NODE:MISSING/,
  );

  const first = createSupportFromCanonicalNode(fixture(), {
    nodeId: "N1",
    restraints: { DX: true },
  });
  assert.throws(
    () => createSupportFromCanonicalNode(first.model, { nodeId: "N1", restraints: { DY: true } }),
    /SUPPORT_ALREADY_EXISTS_FOR_NODE:N1/,
  );
});

test("editor rejects non-v0.5 models", () => {
  const model = { ...fixture(), schemaVersion: "0.4" } as unknown as StructuralModel;
  assert.throws(
    () => createSupportFromCanonicalNode(model, { nodeId: "N1", restraints: { DX: true } }),
    /CORE_V05_REQUIRED:0.4/,
  );
});
