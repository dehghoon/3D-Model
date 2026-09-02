import assert from "node:assert/strict";
import test from "node:test";

import {
  isTapGesture,
  pickSamples,
  pointerToNdc,
  tapTolerance,
} from "../lib/visualization/mobile-picking";

test("pointer coordinates map to normalized device coordinates", () => {
  const point = pointerToNdc(150, 100, { left: 50, top: 50, width: 200, height: 100 });
  assert.equal(point.x, 0);
  assert.equal(point.y, -1);
});

test("mobile tap has a larger gesture tolerance than mouse", () => {
  assert.ok(tapTolerance("touch") > tapTolerance("mouse"));
  assert.equal(isTapGesture(0, 0, 18, 0, "touch"), true);
  assert.equal(isTapGesture(0, 0, 18, 0, "mouse"), false);
});

test("touch picking samples a finger-sized screen neighborhood", () => {
  const touch = pickSamples(100, 100, { left: 0, top: 0, width: 200, height: 200 }, "touch");
  const mouse = pickSamples(100, 100, { left: 0, top: 0, width: 200, height: 200 }, "mouse");

  assert.ok(touch.length > mouse.length);
  assert.equal(mouse.length, 1);
  assert.equal(touch[0].distancePx, 0);
});
