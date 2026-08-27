import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { assertCanonicalV05, migrateProjectToV05 } from "../lib/core-v05";

type AnyRecord = Record<string, any>;

const fixture = (): AnyRecord=>
  JSON.parse(readFileSync("tests/fixtures/legacy-v02-project.json", "utf8"));

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const ID_COLLECTIONS = [
  "nodes", "materials", "sections", "members", "supports", "surfaces",
  "loadSources", "loadCases", "loads", "loadCombinations",
] as const;

test("complete legacy v0.2 fixture migrates to canonical Core v0.5", () => {
  const legacy = fixture();
  const { model, warnings } = migrateProjectToV05(legacy);

  assert.equal(model.schemaVersion, "0.5");
  assert.equal(model.project.id, legacy.project.id);
  assert.doesNotThrow(() => assertCanonicalV05(model));
  assert.match(warnings[0], /migrated from Core v0\.2/i);

  for (const collection of ID_COLLECTIONS) {
    assert.deepEqual(
      (model[collection] as AnyRecord[]).map((item) => item.id),
      (legacy[collection] as AnyRecord[]).map((item) => item.id),
      `stable IDs changed for ${collection}`,
    );
  }

  assert.deepEqual(Object.keys(model.materials[0].analysis).sort(), ["E", "G", "fy", "nu", "rho"].sort());
  for (const key of ["A", "Iy", "Iz", "J"]) assert.ok(model.sections[0].analysis[key as keyof typeof model.sections[0]["analysis"]]);

  const loadTypes = new Map(model.loads.map((load) => [load.id, load.type]));
  assert.equal(loadTypes.get("L-N"), "nodal");
  assert.equal(loadTypes.get("L-L"), "member-distributed");
  assert.equal(loadTypes.get("L-A"), "surface-pressure");

  const areaLoad = model.loads.find((load) => load.id === "L-A");
  assert.equal(areaLoad?.provenance?.sourceId, "LS-SNOW");
  assert.equal(areaLoad?.provenance?.calculatorRunId, "RUN-SNOW-1");
  assert.equal(model.loadCombinations[0].factors["LC-S"], 1.5);
});

test("migrated v0.5 project survives save/export and reopen without identity loss", () => {
  const first = migrateProjectToV05(fixture()).model;
  const second = migrateProjectToV05(JSON.parse(JSON.stringify(first))).model;

  assert.equal(second.schemaVersion, "0.5");
  assert.deepEqual(second, first);
  assert.doesNotThrow(() => assertCanonicalV05(second));
});

test("negative legacy migration shapes are rejected explicitly", () => {
  const cases: Array<[string, (project: AnyRecord) => void, RegExp]> = [
    ["material missing analysis data", (p) => { delete p.materials[0].properties.E; }, /MATERIAL_MAT1_E/],
    ["ambiguous line load", (p) => { delete p.loads[1].w1; delete p.loads[1].w2; }, /AMBIGUOUS_LEGACY_LINE_LOAD/],
    ["ambiguous area load", (p) => { delete p.loads[2].pressure; }, /AMBIGUOUS_LEGACY_AREA_LOAD/],
    ["orphaned load-case reference", (p) => { p.loads[0].loadCaseId = "MISSING"; }, /ORPHANED_LOAD_CASE_REFERENCE/],
    ["missing target ID", (p) => { delete p.loads[0].targetId; }, /MISSING_LOAD_TARGET_ID/],
    ["duplicate stable IDs", (p) => { p.nodes.push(clone(p.nodes[0])); }, /DUPLICATE_STABLE_ID/],
    ["unsupported lossy legacy shape", (p) => { p.loads[0].type = "generic"; }, /UNSUPPORTED_LOSSY_LEGACY_LOAD/],
  ];

  for (const [name, mutate, pattern] of cases) {
    const project = fixture();
    mutate(project);
    assert.throws(() => migrateProjectToV05(project), pattern, name);
  }
});
