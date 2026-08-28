import assert from "node:assert/strict";
import test from "node:test";

import type { StructuralModel } from "@linkoteq/structural-core";
import {
  createMemberFromCanonicalRefs,
  createNodeFromGlobalCoordinates,
} from "../lib/editor-modeling-v05";

function modelFixture(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "P1", name: "Editor Test", units: "SI" },
    levels: [],
    grids: [],
    nodes: [
      { id: "N1", position: { x: 0, y: 0, z: 0 } },
      { id: "N2", position: { x: 6, y: 0, z: 0 } },
    ],
    members: [],
    surfaces: [],
    diaphragms: [],
    materials: [
      {
        id: "MAT1",
        type: "steel",
        name: "Existing material",
        analysis: {
          E: { value: 200000, unit: "MPa" },
          G: { value: 77000, unit: "MPa" },
          nu: 0.3,
          rho: { value: 7850, unit: "kg/m3" },
        },
      },
    ],
    sections: [
      {
        id: "SEC1",
        family: "W",
        designation: "Existing section",
        analysis: {
          A: { value: 1000, unit: "mm2" },
          Iy: { value: 1000000, unit: "mm4" },
          Iz: { value: 2000000, unit: "mm4" },
          J: { value: 10000, unit: "mm4" },
        },
      },
    ],
    supports: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
  };
}

test("editor creates a Core v0.5 member only from existing canonical references", () => {
  const source = modelFixture();
  const result = createMemberFromCanonicalRefs(source, {
    type: "beam",
    startNodeId: "N1",
    endNodeId: "N2",
    materialId: "MAT1",
    sectionId: "SEC1",
  });

  assert.equal(result.member.id, "B1");
  assert.equal(result.member.materialId, "MAT1");
  assert.equal(result.member.sectionId, "SEC1");
  assert.equal(result.model.members.length, 1);
  assert.equal(source.members.length, 0);
  assert.deepEqual(Object.keys(result.member).sort(), [
    "endNodeId",
    "id",
    "materialId",
    "sectionId",
    "startNodeId",
    "type",
  ]);
});

test("editor member IDs remain stable and deterministic", () => {
  const source = modelFixture();
  const first = createMemberFromCanonicalRefs(source, {
    type: "brace",
    startNodeId: "N1",
    endNodeId: "N2",
    materialId: "MAT1",
    sectionId: "SEC1",
  }).model;
  const second = createMemberFromCanonicalRefs(first, {
    type: "brace",
    startNodeId: "N2",
    endNodeId: "N1",
    materialId: "MAT1",
    sectionId: "SEC1",
  });

  assert.equal(first.members[0].id, "BR1");
  assert.equal(second.member.id, "BR2");
});

test("editor rejects missing canonical material and section references", () => {
  const source = modelFixture();

  assert.throws(
    () =>
      createMemberFromCanonicalRefs(source, {
        type: "beam",
        startNodeId: "N1",
        endNodeId: "N2",
        materialId: "MISSING",
        sectionId: "SEC1",
      }),
    /UNKNOWN_MATERIAL:MISSING/,,
  );

  assert.throws(
    () =>
      createMemberFromCanonicalRefs(source, {
        type: "beam",
        startNodeId: "N1",
        endNodeId: "N2",
        materialId: "MAT1",
        sectionId: "MISSING",
      }),
    /UNKNOWN_SECTION:MISSING/,
  );
});

test("editor rejects invalid node references without inventing geometry", () => {
  const source = modelFixture();

  assert.throws(
    () =>
      createMemberFromCanonicalRefs(source, {
        type: "column",
        startNodeId: "N1",
        endNodeId: "N1",
        materialId: "MAT1",
        sectionId: "SEC1",
      }),
    /DISTINCT_MEMBER_NODES_REQUIRED/,
  );

  assert.throws(
    () =>
      createMemberFromCanonicalRefs(source, {
        type: "column",
        startNodeId: "N1",
        endNodeId: "N9",
        materialId: "MAT1",
        sectionId: "SEC1",
      }),
    /UNKNOWN_END_NODE:N9/,
  );
});

test("editor creates canonical nodes from global coordinates", () => {
  const source = modelFixture();
  const result = createNodeFromGlobalCoordinates(source, { x: 3, y: 4, z: 5 });

  assert.equal(result.node.id, "N3");
  assert.deepEqual(result.node.position, { x: 3, y: 4, z: 5 });
  assert.equal(result.model.nodes.length, 3);
  assert.equal(source.nodes.length, 2);
});

test("editor rejects non-finite node coordinates", () => {
  const source = modelFixture();
  assert.throws(
    () => createNodeFromGlobalCoordinates(sourc, { x: Number.NaN, y: 0, z: 0 }),
    /NODE_COORDINATES_MUST_BE_FINITE/,
  );
});
