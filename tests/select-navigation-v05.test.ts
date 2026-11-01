import assert from "node:assert/strict";
import test from "node:test";
import { middlePanTruck, wheelDollyStep } from "../lib/visualization/select-navigation";

test("mouse wheel zoom responds to direction and clamps extreme deltas", () => {
  assert.ok(wheelDollyStep(120, 0, 800, 20) < 0);
  assert.ok(wheelDollyStep(-120, 0, 800, 20) > 0);
  assert.equal(wheelDollyStep(0, 0, 800, 20), 0);
  assert.equal(wheelDollyStep(1e6, 0, 800, 20), -6);
  assert.equal(wheelDollyStep(-1e6, 0, 800, 20), 6);
});
test("wheel delta modes normalize pixels, lines and pages", () => {
  assert.equal(wheelDollyStep(16, 0, 800, 20), wheelDollyStep(1, 1, 800, 20));
  assert.equal(wheelDollyStep(800, 0, 800, 20), wheelDollyStep(1, 2, 800, 20));
});
test("middle mouse pan uses delta without modifying selection", () => {
  assert.deepEqual(middlePanTruck({ x: 100, y: 200 }, { x: 120, y: 190 }, 800, 20), { x: -0.5, y: -0.25 });
  assert.deepEqual(middlePanTruck({ x: 10, y: 10 }, { x: 10, y: 10 }, 800, 20), { x: 0, y: 0 });
});
test("invalid wheel data never returns NaN", () => {
  assert.equal(wheelDollyStep(Number.NaN, 0, 800, 20), 0);
});
