import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildAnalysisSubmission } from "../lib/analysis-boundary";
import { mapSnowWriteback } from "../lib/core-loads-v05";
import { assertCanonicalV05, migrateProjectToV05 } from "../lib/core-v05";

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

test("legacy v0.2 import migrates to v0.5 and preserves stable IDs", () => {
  const legacy = {
    ...emptyCore(),
    schemaVersion: "0.2",
    nodes: [{ id: "N1", position: { x: 0, y: 0, z: 0 } }],
    project: { id: "P1", name: "Legacy", units: "SI" },
  };

  const result = migrateProjectToV05(legacy);

  assert.equal(result.model.schemaVersion, "0.5");
  assert.equal(result.model.project.id, "P1");
  assert.equal(result.model.nodes[0].id, "N1");
  assert.match(result.warnings[0], /migrated from Core v0\.2/i);
});

test("analysis boundary uses canonical request identity", () => {
  const model = emptyCore();
  const request = {
    id: "AR001",
    modelId: "P1",
    loadCaseIds: ["LC1"],
    resultTypes: ["member-forces"],
  };

  const submission = buildAnalysisSubmission("P1", model as never, request as never);

  assert.equal(submission.requestId, "AR001");
});

test("snow writeback preserves surface target and provenance", () => {
  const writeback = {
    modelSchemaVersion: "0.5",
    calculator: "snow",
    calculatorVersion: "1.0",
    runId: "R1",
    loadSources: [
      {
        id: "LS1",
        calculator: "snow",
        calculatorVersion: "1.0",
        calculatorRunId: "R1",
      },
    ],
    loads: [
      {
        id: "LD1",
        type: "surface-pressure",
        loadCaseId: "LC1",
        surfaceId: "S1",
        pressure: { value: 2.5, unit: "kPa" },
        provenance: { sourceId: "LS1", calculatorRunId: "R1" },
      },
    ],
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
    loads: [
      {
        id: "LD1",
        type: "surface-pressure",
        loadCaseId: "LC1",
        surfaceId: "S2",
        pressure: { value: 1, unit: "kPa" },
        provenance: { sourceId: "LS1", calculatorRunId: "R1" },
      },
    ],
  };

  assert.throws(
    () => mapSnowWriteback(writeback as never, ["S1"]),
    /LOSSY_SNOW_SURFACE_MAPPING/,
  );
});

test("platform boundary does not import PyNite", () => {
  const boundary = readFileSync("lib/analysis-boundary.ts", "utf8");

  assert.doesNotMatch(boundary, /from\s+["'`]@?pynite(?:\/|["'`])/i);
});
