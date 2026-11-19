import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV06 } from "../lib/default-model-v05";
import { assignWindWalls, windEnvelope } from "../lib/wind-model-walls";

const coordinates = [[0,0,0],[12,0,0],[12,8,0],[0,8,0],[0,0,6],[12,0,6],[12,8,6],[0,8,6]];
const nodes = coordinates.map(([x,y,z], i) => ({ id: `W${i}`, position: { x,y,z } }));
const faces = { north: [2,3,7,6], south: [0,1,5,4], east: [2,1,5,6], west: [0,3,7,4], interior: [0,2,6,4] };
const model = {
  ...createStarterModelV06(), nodes,
  surfaces: Object.entries(faces).map(([id, ids]) =>
    ({ id, type: "wall" as const, boundaryNodeIds: ids.map(i => nodes[i].id) })),
};

test("wind envelopes assign signed global pressure on exterior walls in four cardinal cases", () => {
  const envelope = windEnvelope(model);
  assert.deepEqual(envelope.dimensions, { x: 12, y: 8, z: 6 });
  const pressure = { windward: 1, leeward: -0.6, parallel: -0.5 };
  const pressures = { x: pressure, y: { ...pressure, leeward: -0.7 } };
  const result = assignWindWalls(model, envelope, pressures, {});
  const loads = result.loads.filter(load => load.type === "surface-vector");
  assert.equal(loads.length, 16);
  assert.equal(result.loadCases.filter(loadCase => loadCase.category === "wind").length, 4);
  const force = (id: string) => loads.find(load => load.id === `wind-exterior-walls-${id}`)?.components;
  assert.deepEqual(force("x-positive-west"), { FX: { value: 1, unit: "kPa" } });
  assert.deepEqual(force("x-positive-east"), { FX: { value: 0.6, unit: "kPa" } });
  assert.deepEqual(force("x-positive-south"), { FY: { value: -0.5, unit: "kPa" } });
  assert.deepEqual(force("y-negative-south"), { FY: { value: -0.7, unit: "kPa" } });
  assert.equal(assignWindWalls(result, envelope, pressures, {}).loads.length, 16);
});

test("wind envelope requires modeled walls on all four exterior faces", () => {
  assert.throws(() => windEnvelope({ ...model, surfaces: model.surfaces.slice(1) }), /all four sides/);
});
