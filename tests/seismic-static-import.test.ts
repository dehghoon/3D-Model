import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV06 } from "../lib/default-model-v05";
import { importStaticSeismic } from "../lib/seismic-static-import";

const model = createStarterModelV06();
const levels = [...model.levels].sort((a, b) => a.elevation - b.elevation);
const diaphragms = levels.slice(1).map((level, i) => ({ id: "D" + i, type: "rigid" as const, levelId: level.id, surfaceIds: [] }));
const sourceModel = { ...model, diaphragms };
const storeys = levels.slice(1).map((level, i) => ({
  heightM: level.elevation - levels[0].elevation,
  forceKN: 10 * (i + 1), torsionPlusKNm: 2, torsionMinusKNm: -1,
}));
const handoff = {
  schema: "linkoteq.seismic.static.v1", codeEdition: "NBCC_2020", hazardSourceId: "reviewed-hazard",
  siteDesignation: "XD", sfrsId: "N20-SFRS-019", warnings: [],
  baseShearKN: storeys.reduce((sum, row) => sum + row.forceKN, 0), storeys,
};

test("static seismic import preserves the force, torsion and diaphragm mapping in four cases", () => {
  const result = importStaticSeismic(sourceModel, handoff, "y");
  const cases = result.loadCases.filter(loadCase => loadCase.sourceId === "seismic-static-y");
  assert.equal(cases.length, 4);
  const loads = result.loads.filter(load => load.type === "diaphragm");
  assert.equal(loads.length, 4 * storeys.length);
  const pick = (id: string) => loads.find(load => load.id === "seismic-static-y-" + id)!;
  assert.deepEqual(pick("positive-plus-1").force, { x: 0, y: 10, z: 0 });
  assert.equal(pick("negative-minus-1").moment?.z, 1);
  assert.equal(pick("positive-plus-1").diaphragmId, diaphragms[0].id);
  assert.equal(importStaticSeismic(result, handoff, "y").loads.length, result.loads.length);
  assert.equal(importStaticSeismic(result, handoff, "x").loads.length, result.loads.length + loads.length);
});

test("static seismic import rejects incomplete diaphragm assignments and inconsistent base shear", () => {
  assert.throws(() => importStaticSeismic(model, handoff, "x"), /rigid diaphragm/);
  assert.throws(() => importStaticSeismic(sourceModel, { ...handoff, baseShearKN: handoff.baseShearKN + 1 }, "x"), /base shear/);
});
