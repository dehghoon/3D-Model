import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV06 } from "../lib/default-model-v05";
import { createMemberFromSnapPoints } from "../lib/editor/member-draw-controller";
import { createSurfaceFromPoints } from "../lib/editor/surface-draw-controller";
import { columnPointAtLevel, pointFromCoordinates } from "../lib/editor/point-input";
import type { SnapPoint } from "../lib/editor/interaction-store";

const snap = (x: number, y: number, z: number): SnapPoint => ({
  point: { x, y, z }, kind: "work-plane", label: `(${x},${y},${z})`,
});

test("numeric beam creates a persistent canonical member and endpoints", () => {
  const model = createStarterModelV06();
  const materialId = model.materials[0].id;
  const sectionId = model.sections[0].id;
  const start = pointFromCoordinates({ x: "101", y: "103", z: "3" }, "absolute", null);
  const end = pointFromCoordinates({ x: "5", y: "0", z: "0" }, "relative", start.point);
  const result = createMemberFromSnapPoints(model, { type: "beam", materialId, sectionId, start, end });
  const member = result.model.members.find(m => m.id === result.memberId);
  assert.ok(member);
  assert.equal(member.sectionId, sectionId);
  assert.deepEqual(result.model.nodes.find(n => n.id === member.startNodeId)?.position, start.point);
  assert.deepEqual(result.model.nodes.find(n => n.id === member.endNodeId)?.position, end.point);
  assert.equal(result.model.members.length, model.members.length + 1);
});

test("column end level creates a canonical vertical member", () => {
  const model = createStarterModelV06();
  const start = snap(107, 109, -3);
  const level = model.levels.find(l => Math.abs(l.elevation - start.point.z) > 1e-8);
  assert.ok(level);
  const end = columnPointAtLevel(model, start.point, level.id);
  const result = createMemberFromSnapPoints(model, {
    type: "column", materialId: model.materials[0].id, sectionId: model.sections[0].id, start, end,
  });
  const member = result.model.members.find(m => m.id === result.memberId);
  assert.ok(member);
  assert.deepEqual(result.model.nodes.find(n => n.id === member.endNodeId)?.position, end.point);
  assert.equal(result.model.members.length, model.members.length + 1);
});

for (const type of ["slab", "wall"] as const) {
  test(`${type} polygon creates a canonical surface with boundary nodes`, () => {
    const model = createStarterModelV06();
    const points = type === "slab"
      ? [snap(101, 101, 3).point, snap(105, 101, 3).point, snap(105, 105, 3).point, snap(101, 105, 3).point]
      : [snap(101, 101, 0).point, snap(105, 101, 0).point, snap(105, 101, 3).point, snap(101, 101, 3).point];
    const result = createSurfaceFromPoints(model, type, points);
    assert.equal(result.model.surfaces.length, model.surfaces.length + 1);
    assert.equal(result.surface.type, type);
    assert.equal(result.surface.boundaryNodeIds.length, 4);
    for (const id of result.surface.boundaryNodeIds) assert.ok(result.model.nodes.some(n => n.id === id));
  });
}
