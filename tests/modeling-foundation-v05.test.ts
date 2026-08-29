import test from "node:test";
import assert from "node:assert/strict";
import type { StructuralModel } from "@linkoteq/structural-core";
import {
  MODELING_CORE_SCHEMA_VERSION,
  assertModelingFoundationV05,
  createCanonicalGridV05,
  createCanonicalLevelV05,
  createCanonicalNodeV05,
  updateCanonicalGridGeometryV05,
  updateCanonicalNodePositionV05,
} from "../lib/modeling-foundation-v05";

function emptyModel(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "TEST", name: "Test", units: "SI" },
    levels: [], grids: [], nodes: [], members: [], surfaces: [], diaphragms: [],
    materials: [], sections: [], supports: [], loadSources: [], loadCases: [], loads: [], loadCombinations: [],
  };
}

test("modeling foundation stays on Core v0.5", () => {
  assert.equal(MODELING_CORE_SCHEMA_VERSION, "0.5");
  assertModelingFoundationV05(emptyModel());
});

test("creates and updates canonical global geometry", () => {
  let model = emptyModel();

  const level = createCanonicalLevelV05(model, { name: "Roof", elevation: 3.5 });
  model = level.model;

  const grid = createCanonicalGridV05(model, {
    label: "A",
    start: { x: 0, y: -2, z: 0 },
    end: { x: 0, y: 2, z: 0 },
  });
  model = grid.model;

  const node = createCanonicalNodeV05(model, {
    position: { x: 1, y: 2, z: 3.5 },
    levelId: level.entity.id,
  });
  model = node.model;

  const moved = updateCanonicalNodePositionV05(model, node.entity.id, { x: 2, y: 4, z: 3.5 });
  model = moved.model;
  assert.deepEqual(moved.entity.position, { x: 2, y: 4, z: 3.5 });

  const updatedGrid = updateCanonicalGridGeometryV05(model, grid.entity.id, {
    label: "A1",
    start: { x: 1, y: -3, z: 0 },
    end: { x: 1, y: 3, z: 0 },
  });
  assert.equal(updatedGrid.entity.label, "A1");
  assert.deepEqual(updatedGrid.entity.start, { x: 1, y: -3, z: 0 });
  assert.deepEqual(updatedGrid.entity.end, { x: 1, y: 3, z: 0 });
  assertModelingFoundationV05(updatedGrid.model);
});

test("rejects invalid geometry without mutating the model", () => {
  const model = emptyModel();
  assert.throws(
    () => createCanonicalGridV05(model, { label: "A", start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 } }),
    /GRID_DISTINCT_POINTS_REQUIRED/,
  );
  assert.equal(model.grids.length, 0);
});
