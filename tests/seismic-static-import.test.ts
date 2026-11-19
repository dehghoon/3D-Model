import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV06 } from "../lib/default-model-v05";
import { importStaticSeismic } from "../lib/seismic-static-import";

const model = createStarterModelV06();
const levels = [...model.levels].sort((a, b) => a.elevation - b.elevation);
const diaphragms = levels.slice(1).map((level, i) => ({ id: "D" + i, type: "rigid" as const, levelId: level.id, surfaceIds: [] }));
const corners = [[1, 2], [11, 2], [11, 12], [1, 12]];
const slabs = levels.slice(1).map((level, i) => ({
  id: "slab-" + i, levelId: level.id, type: "slab" as const,
  boundaryNodeIds: corners.map((_, j) => `boundary-${i}-${j}`),
}));
const nodes = levels.slice(1).flatMap((level, i) => corners.map(([x, y], j) => ({
  id: `boundary-${i}-${j}`, levelId: level.id, position: { x, y, z: level.elevation },
})));
const sourceModel = { ...model, nodes: [...model.nodes, ...nodes], surfaces: slabs, diaphragms };
const storeys = levels.slice(1).map((level, i) => ({
  heightM: level.elevation - levels[0].elevation,
  forceKN: 10 * (i + 1), torsionPlusKNm: 2 + 10 * (i + 1), torsionMinusKNm: 2 - 10 * (i + 1),
}));
const handoff = {
  schema: "linkoteq.seismic.static.v1", codeEdition: "NBCC_2020", hazardSourceId: "reviewed-hazard",
  siteDesignation: "XD", sfrsId: "N20-SFRS-019", warnings: [],
  baseShearKN: storeys.reduce((sum, row) => sum + row.forceKN, 0), storeys,
};

test("static seismic import places force and accidental torsion at the floor centroid in four cases", () => {
  const result = importStaticSeismic(sourceModel, handoff, "y");
  const cases = result.loadCases.filter(loadCase => loadCase.sourceId === "seismic-static-y");
  assert.equal(cases.length, 4);
  const loads = result.loads.filter(load => load.type === "diaphragm");
  assert.equal(loads.length, 4 * storeys.length);
  const pick = (id: string) => loads.find(load => load.id === "seismic-static-y-" + id)!;
  assert.deepEqual(pick("positive-plus-1").force, { x: 0, y: 10, z: 0 });
  assert.equal(pick("positive-plus-1").moment?.z, 10);
  assert.equal(pick("negative-minus-1").moment?.z, 10);
  const reference = result.diaphragms[0].constraint?.referenceNodeId;
  assert.deepEqual(result.nodes.find(node => node.id === reference)?.position, { x: 6, y: 7, z: levels[1].elevation });
  assert.equal(pick("positive-plus-1").diaphragmId, diaphragms[0].id);
  assert.equal(importStaticSeismic(result, handoff, "y").loads.length, result.loads.length);
  assert.equal(importStaticSeismic(result, handoff, "x").loads.length, result.loads.length + loads.length);
});

test("static seismic import rejects missing floor slabs, inconsistent base shear or the wrong building width", () => {
  assert.throws(() => importStaticSeismic(model, handoff, "x"), /floor slab/);
  assert.throws(() => importStaticSeismic(sourceModel, { ...handoff, baseShearKN: handoff.baseShearKN + 1 }, "x"), /base shear/);
  assert.throws(() => importStaticSeismic(sourceModel, { ...handoff, storeys: storeys.map(row => ({ ...row, torsionPlusKNm: row.torsionPlusKNm + 4 })) }, "x"), /width/);
  const automatic = importStaticSeismic({ ...sourceModel, diaphragms: [] }, handoff, "x");
  assert.equal(automatic.diaphragms.length, storeys.length);
});
