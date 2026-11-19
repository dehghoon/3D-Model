import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV06 } from "../lib/default-model-v05";
import { automaticSnowRoofFactor, findAutomaticSnowRoof } from "../lib/snow-model-roof";

test("automatic Snow derives rotated roof dimensions and downward pressure orientation", () => {
  const root = createStarterModelV06();
  const points = [[0, 0], [12, 16], [4, 22], [-8, 6]];
  const nodes = points.map(([x, y], index) => ({ id: "roof" + index, position: { x, y, z: 8 } }));
  const boundaryNodeIds = nodes.map(node => node.id);
  const model = {
    ...root,
    project: { ...root.project, metadata: { gradeElevationM: 2 } },
    nodes,
    surfaces: [{ id: "roof", type: "slab" as const, boundaryNodeIds }],
  };
  assert.deepEqual(findAutomaticSnowRoof(model, []), {
    surfaceId: "roof", geometry: { widthM: 10, lengthM: 20, meanHeightM: 6 }, normalSense: "negative",
  });
  assert.equal(findAutomaticSnowRoof({
    ...model, surfaces: [{ ...model.surfaces[0], boundaryNodeIds: [...boundaryNodeIds].reverse() }],
  }, ["roof"]).normalSense, "positive");
  assert.throws(() => findAutomaticSnowRoof(model, ["floor"]), /top-level roof/);
  assert.throws(() => findAutomaticSnowRoof({
    ...model, nodes: [...nodes, { id: "high", position: { x: 0, y: 0, z: 9 } }],
  }, []), /top-level roof/);
});

test("roof factor accounts for dimensions and low or unknown grade", () => {
  assert.equal(automaticSnowRoofFactor({ widthM: 20, lengthM: 30, meanHeightM: 10 }, 2.5).cb, 0.8);
  assert.equal(automaticSnowRoofFactor({ widthM: 20, lengthM: 30, meanHeightM: 1 }, 2.5).cb, 1);
  const missing = automaticSnowRoofFactor({ widthM: 20, lengthM: 30, meanHeightM: null }, 2.5);
  assert.equal(missing.cb, 1);
  assert.equal(missing.unverifiedGrade, true);
  const large = automaticSnowRoofFactor({ widthM: 100, lengthM: 100, meanHeightM: 10 }, 2.5);
  assert.equal(large.characteristicLengthM, 100);
  assert.ok(large.cb > 0.8 && large.cb < 1);
});
