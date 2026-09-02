import assert from "node:assert/strict";
import test from "node:test";

import type { StructuralModel } from "@linkoteq/structural-core";
import { moveSelection } from "../lib/editor/move-command";
import { createSelection } from "../lib/editor/selection";

function fixture(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "P1", name: "Move Test", units: "SI" },
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
    materials: [
      { id: "MAT1", type: "steel", name: "Steel", properties: {} },
    ],
    sections: [
      {
        id: "S1",
        family: "W",
        materialType: "steel",
        geometry: {},
        properties: {},
      },
    ],
    supports: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
  };
}

test("moveSelection translates a selected member through its canonical nodes", () => {
  const result = moveSelection(
    fixture(),
    createSelection("member", "M1"),
    { x: 1, y: 2, z: 3 },
  );

  assert.deepEqual(result.model.nodes[0].position, { x: 1, y: 2, z: 3 });
  assert.deepEqual(result.model.nodes[1].position, { x: 5, y: 2, z: 3 });
  assert.equal(result.model.nodes[0].levelId, "L2");
  assert.equal(result.model.nodes[1].levelId, "L2");
  assert.equal(result.model.members[0].levelId, "L2");
  assert.equal(result.model.members[0].id, "M1");
  assert.deepEqual(result.selection, createSelection("member", "M1"));
});

test("moveSelection preserves stable IDs and does not duplicate model records", () => {
  const model = fixture();
  const result = moveSelection(
    model,
    createSelection("node", "N1"),
    { x: 2, y: 0, z: 0 },
  );

  assert.equal(result.model.nodes.length, model.nodes.length);
  assert.equal(result.model.members.length, model.members.length);
  assert.deepEqual(result.model.nodes.map((node) => node.id), ["N1", "N2"]);
  assert.deepEqual(result.movedNodeIds, ["N1"]);
});

test("moveSelection rejects zero displacement", () => {
  assert.throws(
    () =>
      moveSelection(
        fixture(),
        createSelection("node", "N1"),
        { x: 0, y: 0, z: 0 },
      ),
    /MOVE_DELTA_ZERO/,
  );
});
