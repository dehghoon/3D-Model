import assert from "node:assert/strict";
import test from "node:test";

import type { StructuralModel } from "@linkoteq/structural-core";
import { createSurfaceFromCanonicalRefs } from "../lib/editor-surface-v05";

function fixture(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "P1", name: "Surface Test", units: "SI" },
    levels: [{ id: "L1", name: "Level 1", elevation: 0 }],
    grids: [],
    nodes: [
      { id: "N1", position: { x: 0, y: 0, z: 0 } },
      { id: "N2", position: { x: 4, y: 0, z: 0 } },
      { id: "N3", position: { x: 4, y: 3, z: 0 } },
      { id: "N4", position: { x: 0, y: 3, z: 0 } },
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
  };
}

test("editor creates canonical Core v0.5 surfaces from existing node references", () => {
  const model = fixture();
  const result = createSurfaceFromCanonicalRefs(model, {
    type: "slab",
    boundaryNodeIds: ["N1", "N2", "N3", "N4"],
    levelId: "L1",
  });

  assert.deepEqual(result.surface, {
    id: "S1",
    type: "slab",
    boundaryNodeIds: ["N1", "N2", "N3", "N4"],
    levelId: "L1",
  });
  assert.equal(model.surfaces.length, 0);
  assert.equal(result.model.surfaces.length, 1);
});

test("editor generates deterministic surface IDs and does not synthesize engineering properties", () => {
  const model = fixture();
  const first = createSurfaceFromCanonicalRefs(model, {
    type: "wall",
    boundaryNodeIds: ["N1", "N2", "N3"],
  });
  const second = createSurfaceFromCanonicalRefs(first.model, {
    type: "wall",
    boundaryNodeIds: ["N1", "N3", "N4"],
  });

  assert.equal(first.surface.id, "S1");
  assert.equal(second.surface.id, "S2");
  assert.deepEqual(Object.keys(first.surface).sort(), ["boundaryNodeIds", "id", "type"]);
});

test("editor rejects invalid canonical surface boundaries", () => {
  const model = fixture();
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, { type: "slab", boundaryNodeIds: ["N1", "N2"] }),
    /SURFACE_AT_LEAST_THREE_NODES_REQUIRED/,
  );
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, { type: "slab", boundaryNodeIds: ["N1", "N2", "N1"] }),
    /SURFACE_BOUNDARY_NODES_MUST_BE_DISTINCT/,
  );
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, { type: "wall", boundaryNodeIds: ["N1", "N2", "MISSING"] }),
    /UNKNOWN_SURFACE_NODE:MISSING/,
  );
});

test("editor rejects unknown optional surface references", () => {
  const model = fixture();
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, {
      type: "slab",
      boundaryNodeIds: ["N1", "N2", "N3"],
      levelId: "MISSING",
    }),
    /UNKNOWN_SURFACE_LEVEL:MISSING/,
  );
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, {
      type: "wall",
      boundaryNodeIds: ["N1", "N2", "N3"],
      materialId: "MISSING",
    }),
    /UNKNOWN_SURFACE_MATERIAL:MISSING/,
  );
});
