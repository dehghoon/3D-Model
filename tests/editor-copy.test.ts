import assert from "node:assert/strict";
import test from "node:test";

import type { StructuralModel } from "@linkoteq/structural-core";
import { copySelection } from "../lib/editor/copy-command";
import { createSelection } from "../lib/editor/selection";

function fixture(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "P1", name: "Copy Test", units: "SI" },
    levels: [
      { id: "L1", name: "Level 1", elevation: 0 },
      { id: "L2", name: "Level 2", elevation: 3 },
    ],
    grids: [],
    nodes: [
      { id: "N1", position: { x: 0, y: 0, z: 0 }, levelId: "L1" },
      { id: "N2", position: { x: 4, y: 0, z: 0 }, levelId: "L1" },
    ],
    members: [
      {
        id: "M1",
        type: "beam",
        startNodeId: "N1",
        endNodeId: "N2",
        levelId: "L1",
        sectionId: "S1",
        materialId: "MAT1",
      },
    ],
    surfaces: [],
    diaphragms: [],
    materials: [{ id: "MAT1", type: "steel", name: "Steel", properties: {} }],
    sections: [{ id: "S1", family: "W", materialType: "steel", geometry: {}, properties: {} }],
    supports: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
  };
}

test("copySelection copies a member with translated nodes and stable new IDs", () => {
  const model = fixture();
  const result = copySelection(
    model,
    createSelection("member", "M1"),
    { x: 0, y: 0, z: 3 },
  );

  assert.equal(result.model.members.length, 2);
  assert.equal(result.model.nodes.length, 4);

  const copied = result.model.members[1];
  assert.equal(copied.id, "M1-copy");
  assert.equal(copied.levelId, "L2");
  assert.equal(copied.sectionId, "S1");
  assert.equal(copied.materialId, "MAT1");

  const start = result.model.nodes.find((node) => node.id === copied.startNodeId);
  const end = result.model.nodes.find((node) => node.id === copied.endNodeId);

  assert.deepEqual(start?.position, { x: 0, y: 0, z: 3 });
  assert.deepEqual(end?.position, { x: 4, y: 0, z: 3 });
  assert.equal(start?.levelId, "L2");
  assert.equal(end?.levelId, "L2");
});

test("copySelection does not duplicate loads or supports", () => {
  const model = fixture();
  model.supports = [
    {
      id: "SUP1",
      nodeId: "N1",
      restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
    },
  ];
  model.loadCases = [{ id: "LC1", name: "Dead", category: "dead" }];
  model.loads = [
    {
      id: "LOAD1",
      type: "nodal",
      targetId: "N1",
      targetType: "node",
      loadCaseId: "LC1",
      direction: { x: 0, y: 0, z: -1 },
      magnitude: 1,
      unit: "kN",
    },
  ];

  const result = copySelection(
    model,
    createSelection("node", "N1"),
    { x: 2, y: 0, z: 0 },
  );

  assert.equal(result.model.nodes.length, 3);
  assert.equal(result.model.supports.length, 1);
  assert.equal(result.model.loads.length, 1);
});

test("copySelection rejects zero translation", () => {
  const model = fixture();

  assert.throws(
    () => copySelection(model, createSelection("node", "N1"), { x: 0, y: 0, z: 0 }),
    /COPY_DELTA_ZERO/,
  );
});
