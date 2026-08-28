import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildAnalysisSubmission } from "../lib/analysis-boundary";
import { mapSnowWriteback } from "../lib/core-loads-v05";
import { assertCanonicalV05, migrateProjectToV05 } from "../lib/core-v05";

const fixture = () => JSON.parse(readFileSync("tests/fixtures/legacy-v02-project.json", "utf8"));
const emptyCore = () => ({
  schemaVersion: "0.5",
  project: { id: "P1", name: "Test", units: "SI" },
  levels: [], grids: [], nodes: [], members: [], surfaces: [], diaphragms: [],
  materials: [], sections: [], supports: [], loadSources: [], loadCases: [], loads: [], loadCombinations: [],
});

test("canonical Core v0.5 model is accepted", () => {
  const model = emptyCore();
  assert.doesNotThrow(() => assertCanonicalV05(model));
  assert.equal(model.schemaVersion, "0.5");
});

test("realistic legacy v0.2 fixture migrates every required collection", () => {
  const { model, warnings } = migrateProjectToV05(fixture());
  assert.equal(model.schemaVersion, "0.5");
  assert.equal(model.project.id, "P-LEGACY-001");
  assert.equal(model.materials[0].id, "MAT1");
  assert.equal(model.materials[0].analysis.E.unit, "MPa");
  assert.equal(model.materials[0].analysis.G.value, 77000);
  assert.equal(model.materials[0].analysis.nu, 0.3);
  assert.equal(model.materials[0].analysis.rho.unit, "kg/m3");
  assert.equal(model.sections[0].id, "SEC1");
  assert.equal(model.sections[0].analysis.A.unit, "mm2");
  assert.equal(model.sections[0].analysis.Iy.unit, "mm4");
  assert.equal(model.sections[0].analysis.J.Value, 185000);
  assert.equal(model.loadSources?.[0].id, "LS-SNOW");
  assert.equal(model.loadSources?.[0].codeEdition, "NBCC 2020");
  assert.equal(model.loadCases[1].sourceId, "LS-SNOW");
  assert.equal(model.loadCombinations[0].factors["LC-S"], 1.5);
  assert.match(warnings.join(" "), /migrated from Core v0.2/i);
  assert.doesNotThrow(() => assertCanonicalV05(model));
});
