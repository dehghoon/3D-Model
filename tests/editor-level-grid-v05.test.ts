import assert from "node:assert/strict";
import test from "node:test";

import type { StructuralModel } from "@linkoteq/structural-core";
import {
  createGridLine,
  deleteGridLine,
  updateGridLine,
} from "../lib/modeling/grid-service";
import {
  createLevel,
  deleteLevel,
  updateLevel,
} from "../lib/modeling/level-service";

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

test("level service creates canonical Core v0.5 levels with deterministic stable IDs", () => {
  const source = modelFixture();
  const first = createLevel(source, { name: "Ground", elevation: 0 });
  const second = createLevel(first.model, { name: "Level 2", elevation: 3.5 });

  assert.deepEqual(first.level, { id: "L1", name: "Ground", elevation: 0 });
  assert.deepEqual(second.level, { id: "L2", name: "Level 2", elevation: 3.5 });
  assert.equal(source.levels.length, 0);
});

test("level service updates a level while preserving its stable ID", () => {
  const source = modelFixture();
  const created = createLevel(source, { name: "Ground", elevation: 0 });
  const updated = updateLevel(created.model, created.level.id, {
    name: "Main Floor",
    elevation: 0.15,
  });

  assert.equal(updated.level.id, created.level.id);
  assert.equal(updated.level.name, "Main Floor");
  assert.equal(updated.level.elevation, 0.15);
});

test("level service deletes an unreferenced level by stable ID", () => {
  const source = modelFixture();
  const created = createLevel(source, { name: "Ground", elevation: 0 });
  const next = deleteLevel(created.model, created.level.id);

  assert.equal(next.levels.length, 0);
  assert.equal(created.model.levels.length, 1);
});

test("level service rejects invalid canonical level input", () => {
  const source = modelFixture();
  assert.throws(() => createLevel(source, { name: " ", elevation: 0 }), /LEVEL_NAME_REQUIRED/);
  assert.throws(
    () => createLevel(source, { name: "Roof", elevation: Number.NaN }),
    /LEVEL_ELEVATION_MUST_BE_FINITE/,
  );
  assert.throws(
    () => updateLevel(source, "L404", { name: "Roof", elevation: 3 }),
    /UNKNOWN_LEVEL:L404/,
  );
  assert.throws(() => deleteLevel(source, "L404"), /UNKNOWN_LEVEL:L404/);
});

test("grid service creates canonical Core v0.5 grid lines with deterministic stable IDs", () => {
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

test("grid service updates a grid while preserving its stable ID", () => {
  const source = modelFixture();
  const created = createGridLine(source, {
    label: "A",
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 10, z: 0 },
  });

  const updated = updateGridLine(created.model, created.grid.id, {
    label: "A1",
    start: { x: 1, y: 0, z: 0 },
    end: { x: 1, y: 12, z: 0 },
  });

  assert.equal(updated.grid.id, created.grid.id);
  assert.equal(updated.grid.label, "A1");
  assert.deepEqual(updated.grid.start, { x: 1, y: 0, z: 0 });
  assert.deepEqual(updated.grid.end, { x: 1, y: 12, z: 0 });
});

test("grid service deletes an existing grid by stable ID", () => {
  const source = modelFixture();
  const created = createGridLine(source, {
    label: "A",
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 10, z: 0 },
  });

  const next = deleteGridLine(created.model, created.grid.id);

  assert.equal(next.grids.length, 0);
  assert.equal(created.model.grids.length, 1);
});

test("grid service rejects invalid canonical grid input", () => {
  const source = modelFixture();
  assert.throws(
    () =>
      createGridLine(source, {
        label: " ",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      }),
    /GRID_LABEL_REQUIRED/,
  );
  assert.throws(
    () =>
      createGridLine(source, {
        label: "A",
        start: { x: Number.NaN, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      }),
    /GRID_START_MUST_BE_FINITE/,
  );
  assert.throws(
    () =>
      createGridLine(source, {
        label: "A",
        start: { x: 1, y: 2, z: 3 },
        end: { x: 1, y: 2, z: 3 },
      }),
    /GRID_DISTINCT_POINTS_REQUIRED/,
  );
  assert.throws(
    () =>
      updateGridLine(source, "G404", {
        label: "A",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      }),
    /UNKNOWN_GRID:G404/,
  );
  assert.throws(() => deleteGridLine(source, "G404"), /UNKNOWN_GRID:G404/);
});
