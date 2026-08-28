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
  assert.equal(model.sections[0].analysis.J.value, 185000);
  assert.equal(model.loadSources?.[0].id, "LS-SWOW");
  assert.equal(model.loadSources?.[0].codeEdition, "NBCC 2020");
  assert.equal(model.loadCases[1].sourceId, "LS-SNOW");
  assert.equal(model.loadCombinations[0].factors["LC-S"], 1.5);
  assert.match(warnings.join(" "), /migrated from Core v0.2/i);
  assert.doesNotThrow(() => assertCanonicalV05(model));
});

test("legacy migration preserves stable IDs across all canonical entities", () => {
  const legacy = fixture();
  const { model } = migrateProjectToV05(legacy);
  for (const key of ["nodes", "materials", "sections", "members", "supports", "surfaces", "loadSources", "loadCases", "loads", "loadCombinations"]) {
    assert.deepEqual(
      (model as unknown as Record<string, Array<{ id: string }>>)[key].map((item) => item.id),
      legacy[key].map((item: { id: string }) => item.id),
      key,
    );
  }
  assert.equal(model.project.id, legacy.project.id);
});

test("legacy loads become explicit Core v0.5 primitives with references, units, and provenance", () => {
  const { model } = migrateProjectToV05(fixture());
  const nodal = model.loads.find((load) => load.id === "L-N");
  const line = model.loads.find((load) => load.id === "L-L");
  const area = model.loads.find((load) => load.id === "L-A");
  assert.equal(nodal?.type, "nodal");
  assert.equal(nodal?.type === "nodal" ? nodal.nodeId : "", "N2");
  assert.equal(line?.type, "member-distributed");
  assert.equal(line?.type === "member-distributed" ? line.memberId : "", "M1");
  assert.equal(line?.type === "member-distributed" ? line.w1.unit : "", "kN/m");
  assert.equal(area?.type, "surface-pressure");
  assert.equal(area?.type === "surface-pressure" ? area.surfaceId : "", "S1");
  assert.equal(area?.type === "surface-pressure" ? area.pressure.unit : "", "kPa");
  assert.equal(area?.provenance?.sourceId, "LS-SNOW");
  assert.equal(area?.provenance?.calculatorRunId, "RUN-SNOW-1");
});

test("legacy v0.2 -> v0.5 save/export -> reopen/import round-trip is stable", () => {
  const first = migrateProjectToV05(fixture()).model;
  const exported = JSON.stringify(first);
  const reopened = migrateProjectToV05(JSON.parse(exported)).model;
  assert.equal(reopened.schemaVersion, "0.5");
  assert.deepEqual(reopened, first);
  assert.doesNotThrow(() => assertCanonicalV05(reopened));
  assert.equal(reopened.members[0].materialId, "MAT1");
  assert.equal(reopened.members[0].sectionId, "SEC1");
  assert.equal(reopened.loads[2].loadCaseId, "LC-S");
  assert.equal(reopened.supports[0].restraints.DX, true);
  assert.equal(reopened.members[0].endRelease?.RZ, true);
});

test("legacy material missing required analysis data is rejected", () => {
  const legacy = fixture();
  delete legacy.materials[0].properties.G;
  assert.throws(() => migrateProjectToV05(legacy), /MATERIAL_MAT1_G_UNIT_VALUE_REQUIRED/);
});

test("ambiguous legacy line load is rejected", () => {
  const legacy = fixture();
  const load = legacy.loads.find((item: { id: string }) => item.id === "L-L");
  delete load.distribution;
  delete load.w1;
  delete load.w2;
  assert.throws(() => migrateProjectToV05(legacy), /AMBIGUOUS_LEGACY_LINE_LOAD:L-L/);
});

test("ambiguous legacy area load is rejected", () => {
  const legacy = fixture();
  const load = legacy.loads.find((item: { id: string }) => item.id === "L-A");
  delete load.pressure;
  assert.throws(() => migrateProjectToV05(legacy), /AMBIGUOUS_LEGACY_AREA_LOAD:L-A/);
});

test("orphaned load-case reference is rejected", () => {
  const legacy = fixture();
  legacy.loads[0].loadCaseId = "LC-MISSING";
  assert.throws(() => migrateProjectToV05(legacy), /ORPHANED_LOAD_CASE_REFERENCE:L-N/);
});

test("missing load target ID is rejected", () => {
  const legacy = fixture();
  delete legacy.loads[0].targetId;
  assert.throws(() => migrateProjectToV05(legacy), /MISSING_LOAD_TARGET_ID/);
});

test("duplicate stable IDs are rejected", () => {
  const legacy = fixture();
  legacy.nodes.push({ ...legacy.nodes[0] });
  assert.throws(() => migrateProjectToV05(legacy), /DUPLICATE_STABLE_ID:nodes:N1/);
});

test("unsupported lossy legacy load shape is rejected", () => {
  const legacy = fixture();
  legacy.loads[0] = { id: "L-X", type: "polygon", loadCaseId: "LC-D", targetId: "S1" };
  assert.throws(() => migrateProjectToV05(legacy), /UNSUPPORTED_LOSSY_LEGACY_LOAD:L-X/);
});

test("orphaned load-combination case reference is rejected", () => {
  const legacy = fixture();
  legacy.loadCombinations[0].loadCaseFactors["LC-MISSING"] = 1;
  assert.throws(() => migrateProjectToV05(legacy), /ORPHANED_COMBINATION_LOAD_CASE:COMB1:LC-MISSING/);
});

test("analysis boundary uses canonical request identity", () => {
  const model = emptyCore();
  const request = { id: "AR001", modelId: "P1", loadCaseIds: ["LC1"], resultTypes: ["member-forces"] };
  const submission = buildAnalysisSubmission("P1", model as never, request as never);
  assert.equal(submission.requestId, "AR001");
});

test("snow writeback preserves surface target and provenance", () => {
  const writeback = {
    modelSchemaVersion: "0.5",
    calculator: "snow",
    calculatorVersion: "1.0",
    runId: "R1",
    loadSources: [{ id: "LS1", category: "snow", name: "Snow", calculator: "snow", calculatorVersion: "1.0", status: "generated" }],
    loads: [{
      id: "LD1",
      type: "surface-pressure",
      loadCaseId: "LC1",
      surfaceId: "S1",
      pressure: { value: 2.5, unit: "kPa" },
      provenance: { sourceId: "LS1", calculatorRunId: "R1" },
    }],
  };
  const mapped = mapSnowWriteback(writeback as never, ["S1"]);
  assert.equal(mapped.loads[0].surfaceId, "S1");
  assert.equal(mapped.loads[0].pressure.unit, "kPa");
  assert.equal(mapped.loads[0].provenance?.calculatorRunId, "R1");
});

test("snow writeback rejects lossy surface mapping", () => {
  const writeback = {
    modelSchemaVersion: "0.5",
    calculator: "snow",
    calculatorVersion: "1.0",
    runId: "R1",
    loadSources: [],
    loads: [{
      id: "LD1",
      type: "surface-pressure",
      loadCaseId: "LC1",
      surfaceId: "S2",
      pressure: { value: 1, unit: "kPa" },
      provenance: { sourceId: "LS1", calculatorRunId: "R1" },
    }],
  };
  assert.throws(() => mapSnowWriteback(writeback as never, ["S1"]), /LOSSY_SNOW_SURFACE_MAPPING/);
});

test("platform boundary does not import PyNite", () => {
  const boundary = readFileSync("lib/analysis-boundary.ts", "utf8");
  assert.doesNotMatch(boundary, /from\s+["'`]@?pynite(?:\/|["'`])/i);
});
