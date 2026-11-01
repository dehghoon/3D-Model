import assert from "node:assert/strict";
import test from "node:test";
import type { StructuralModel } from "@linkoteq/structural-core";
import { columnPointAtLevel, pointFromCoordinates } from "../lib/editor/point-input";

test("absolute XYZ point entry", () => {
  assert.deepEqual(pointFromCoordinates({ x: "2", y: "-3.5", z: "4" }, "absolute", null).point, { x: 2, y: -3.5, z: 4 });
});

test("relative delta XYZ uses first point as base", () => {
  assert.deepEqual(pointFromCoordinates({ x: "0", y: "0", z: "3" }, "relative", { x: 5, y: 8, z: 0 }).point, { x: 5, y: 8, z: 3 });
  assert.throws(() => pointFromCoordinates({ x: "1", y: "2", z: "3" }, "relative", null), /base point/);
});

test("empty, infinite and overflowed coordinates are rejected", () => {
  assert.throws(() => pointFromCoordinates({ x: "", y: "0", z: "0" }, "absolute", null), /all three/);
  assert.throws(() => pointFromCoordinates({ x: "Infinity", y: "0", z: "0" }, "absolute", null), /finite/);
  assert.throws(() => pointFromCoordinates({ x: "1e308", y: "0", z: "0" }, "relative", { x: 1e308, y: 0, z: 0 }), /finite/);
});

test("column second point can be selected by end level", () => {
  const model = { levels: [{ id: "L2", name: "Level 2", elevation: 6 }] } as StructuralModel;
  assert.deepEqual(columnPointAtLevel(model, { x: 2, y: 4, z: 3 }, "L2").point, { x: 2, y: 4, z: 6 });
  assert.throws(() => columnPointAtLevel(model, { x: 2, y: 4, z: 6 }, "L2"), /must differ/);
});
