import assert from "node:assert/strict";
import test from "node:test";
import {
  createSimpleFrame,
  DEFAULT_FRAME,
  fitDimension,
  resizeBays,
  total,
} from "../lib/simple-frame";
import { assertCanonicalV05 } from "../lib/core-v05";
test("quick frame creates connected columns at every intersection and beams at each elevated level", () => {
  const m = createSimpleFrame(DEFAULT_FRAME);
  assertCanonicalV05(m);
  assert.equal(m.project.metadata?.defaultModel,"simple-frame");
  assert.equal(m.nodes.length, 36);
  assert.equal(m.members.filter((x) => x.type === "column").length, 24);
  assert.equal(m.members.filter((x) => x.type === "beam").length, 34);
  assert.deepEqual(
    m.levels.map((x) => x.elevation),
    [0, 3, 6],
  );
  assert.equal(m.grids.length, 7);
  const edges = new Set<string>();
  for (const member of m.members) {
    assert.ok(m.nodes.some((n) => n.id === member.startNodeId));
    assert.ok(m.nodes.some((n) => n.id === member.endNodeId));
    const key = [member.startNodeId, member.endNodeId].sort().join("|");
    assert.ok(!edges.has(key));
    edges.add(key);
  }
});
test("spacing changes update shared nodes once, retain IDs and regenerate complete frame", () => {
  const a = createSimpleFrame(DEFAULT_FRAME);
  const b = createSimpleFrame(
    { ...DEFAULT_FRAME, x: [7, 5, 5], heights: [4, 3] },
    a,
  );
  assert.deepEqual(
    a.nodes.map((n) => n.id),
    b.nodes.map((n) => n.id),
  );
  assert.deepEqual(
    a.members.map((n) => n.id),
    b.members.map((n) => n.id),
  );
  assert.deepEqual(b.nodes.find((n) => n.id === "SF-N1-0-1")?.position, {
    x: 7,
    y: 0,
    z: 4,
  });
  assert.equal(a.nodes.find((n) => n.id === "SF-N1-0-1")?.position.x, 5);
  assert.deepEqual(
    b.levels.map((l) => l.elevation),
    [0, 4, 7],
  );
  assertCanonicalV05(b);
});
test("plan dimensions, counts and defaults have explicit exact behavior", () => {
  assert.deepEqual(fitDimension(12), [5, 5, 2]);
  assert.equal(total(fitDimension(10.01)), 10.01);
  assert.equal(total(fitDimension(1000)), 1000);
  assert.deepEqual(resizeBays([7, 4], 3, 5), [7, 4, 5]);
  assert.deepEqual(resizeBays([4], 2, 3), [4, 3]);
  for (const x of [0, -1, NaN, Infinity]) assert.throws(() => fitDimension(x));
  assert.throws(() => resizeBays([5], 0, 5));
  assert.throws(() => createSimpleFrame({ ...DEFAULT_FRAME, heights: [0] }));
});
test("frame setup metadata round trips as canonical project metadata", () => {
  const model = createSimpleFrame(DEFAULT_FRAME);
  const saved = JSON.parse(JSON.stringify(model));
  assertCanonicalV05(saved);
  assert.deepEqual(
    JSON.parse(String(saved.project.metadata?.simpleFrame)),
    DEFAULT_FRAME,
  );
});
