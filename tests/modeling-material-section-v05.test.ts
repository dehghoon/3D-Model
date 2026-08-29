import test from "node:test";
import assert from "node:assert/strict";
import type { Material, Section, StructuralModel } from "@linkoteq/structural-core";
import {
  upsertCanonicalMaterialV05,
  upsertCanonicalSectionV05,
} from "../lib/modeling-material-section-v05";

function emptyModel(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "TEST", name: "Test", units: "SI" },
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

const material: Material = {
  id: "MAT-TEST",
  type: "steel",
  name: "Test Steel",
  analysis: {
    E: { value: 200000, unit: "MPa" },
    G: { value: 77000, unit: "MPa" },
    nu: 0.3,
    rho: { value: 7850, unit: "kg/m3" },
    fy: { value: 350, unit: "MPa" },
  },
};

const section: Section = {
  id: "SEC-TEST",
  family: "W",
  designation: "W-Test",
  geometry: {},
  analysis: {
    A: { value: 1, unit: "mm2" },
    Iy: { value: 1, unit: "mm4" },
    Iz: { value: 1, unit: "mm4" },
    J: { value: 1, unit: "mm4" },
  },
};

test("upserts canonical Core v0.5 material", () => {
  const model = upsertCanonicalMaterialV05(emptyModel(), material);
  assert.equal(model.materials.length, 1);
  assert.equal(model.materials[0].id, material.id);
});

test("upserts canonical Core v0.5 section", () => {
  const model = upsertCanonicalSectionV05(emptyModel(), section);
  assert.equal(model.sections.length, 1);
  assert.equal(model.sections[0].id, section.id);
});

test("rejects invalid required section analysis values", () => {
  const invalid = {
    ...section,
    analysis: { ...section.analysis, J: { value: Number.NaN, unit: "mm4" } },
  } as Section;

  assert.throws(
    () => upsertCanonicalSectionV05(emptyModel(), invalid),
    /SECTION_J_INVALID/,
  );
});
