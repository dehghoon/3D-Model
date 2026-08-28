import assert from "node:assert/strict";
import test from "node:test";

import type { StructuralModel } from "@linkoteq/structural-core";
import { createGridLine, createLevel } from "../lib/editor-modeling-v05";

function modelFixture(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "P1", name: "Editor Level/Grid Test", units: "SI" },
    levels: [],
    grids: [],
    nodes: [],
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
  };
}

test("editor creates canonical Core v0.5 levels with deterministic stable IDs", () => {
  const source = modelFixture();
  const first = createLevel(source, { name: "Ground", elevation: 0 });
  const second = createLevel(first.model, { name: "Level 2", elevation: 3.5 });

  assert.deepEqual(first.level, { id: "L1", name: "Ground", elevation: 0 });
  assert.deepEqual(second.level, { id: "L2", name: "Level 2", elevation: 3.5 });
  assert.equal(source.levels.length, 0);
});

test("editor rejects invalid canonical level input", () => {
  const source = modelFixture();
  assert.throws(() => createLevel(source, { name: " ", elevation: 0 }), /LEVEL_NAME_REQUIRED/);
  assert.throws(() => createLevel(source, { name: "Roof", elevation: Number.NaN }), /LEVEL_ELEVATION_MUST_BE_FINITE/);
});

test("editor creates canonical Core v0.5 grid lines with deterministic stable IDs", () => {
  const source = modelFixture();
  const first = createGridLine(source, {
    label: "A",
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 10, z: 0 },
  });
  const second = createGridLine(first.model, {
    label: "1",
    start: { x: 0, y: 0, z: 0 },
    end: { x: 10, y: 0, z: 0 },
  });

  assert.deepEqual(first.grid, {
    id: "G1",
    label: "A",
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 10, z: 0 },
  });
  assert.equal(second.grid.id, "G2");
  assert.equal(source.grids.length, 0);
});

test("editor rejects invalid canonical grid input", () => {
  const source = modelFixture();
  assert.throws(
    () => createGridLine(source, { label: " ", start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }),
    /GRID_LABEL_REQUIRED/,
  );
  assert.throws(
    () => createGridLine(source, { label: "A", start: { x: Number.NaN, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }),
    /GRID_START_MUST_BE_FINITE/,
  );
  assert.throws(
    () => createGridLine(source, { label: "A", start: { x: 1, y: 2, z: 3 }, end: { x: 1, y: 2, z: 3 } }),
    /GRID_DISTINCT_POINTS_REQUIRED/,
  );
});
