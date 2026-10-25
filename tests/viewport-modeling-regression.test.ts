import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { assertCanonicalV05 } from "../lib/core-v05";
import { createStarterModelV05 } from "../lib/default-model-v05";
import { createMemberFromSnapPoints } from "../lib/editor/member-draw-controller";
import { resolveSnapPoint } from "../lib/visualization/snap-resolver";
import { copySelection } from "../lib/editor/copy-command";
import { moveSelection } from "../lib/editor/move-command";
import { createSurfaceFromCanonicalRefs } from "../lib/editor-surface-v05";

const element = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } as HTMLElement;
const point = (x: number, y: number, z: number) => ({ point: { x, y, z }, kind: "work-plane" as const, label: "Test point" });

for (const type of ["column", "beam", "brace"] as const) {
  test(`${type}: snapped points create canonical member, then copy and move preserve references`, () => {
    const base = createStarterModelV05();
    assertCanonicalV05(base);
    const start = point(30, 30, 0);
    const end = type === "column" ? point(30, 30, 3) : type === "beam" ? point(34, 30, 0) : point(34, 30, 3);
    const created = createMemberFromSnapPoints(base, { type, start, end, materialId: base.materials[0].id, sectionId: base.sections[0].id });
    const member = created.model.members.find((item) => item.id === created.memberId)!;
    assert.equal(member.type, type);
    assert.deepEqual(created.model.nodes.find((item) => item.id === member.endNodeId)!.position, end.point);
    const copied = copySelection(created.model, { type: "member", id: member.id }, { x: 5, y: 0, z: 0 });
    assert.notEqual(copied.selection.id, member.id);
    const moved = moveSelection(copied.model, copied.selection, { x: 0, y: 2, z: 0 });
    assert.equal(moved.model.nodes.find((item) => item.id === member.startNodeId)!.position.y, 30);
    assert.equal(moved.movedNodeIds.length, 2);
    assert.throws(() => createMemberFromSnapPoints(base, { type, start, end: start, materialId: base.materials[0].id, sectionId: base.sections[0].id }), /DISTINCT/);
  });
}

test("front elevation can pick free points when the horizontal plane is parallel to the ray", () => {
  const model = { ...createStarterModelV05(), nodes: [], members: [], grids: [] };
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const snap = resolveSnapPoint({ clientX: 500, clientY: 210 }, model, null, camera, element, 13);
  assert.ok(snap);
  assert.ok(Math.abs(snap.point.x - 2.5) < 1e-8);
  assert.ok(Math.abs(snap.point.z - 3) < 1e-8);
});

for (const type of ["slab", "wall"] as const) {
  test(`${type}: ordered boundary nodes survive copy and move`, () => {
    const base = createStarterModelV05();
    const nodes = [{ id: "A", position: { x: 30, y: 30, z: 0 } }, { id: "B", position: { x: 34, y: 30, z: 0 } }, { id: "C", position: type === "slab" ? { x: 34, y: 34, z: 0 } : { x: 34, y: 30, z: 3 } }];
    const created = createSurfaceFromCanonicalRefs({ ...base, nodes: [...base.nodes, ...nodes] }, { type, boundaryNodeIds: ["A", "B", "C"] });
    const copied = copySelection(created.model, { type: "surface", id: created.surface.id }, { x: 5, y: 0, z: 0 });
    const moved = moveSelection(copied.model, copied.selection, { x: 0, y: 2, z: 0 });
    const surface = moved.model.surfaces.find((item) => item.id === copied.selection.id)!;
    assert.equal(surface.type, type);
    assert.equal(surface.boundaryNodeIds.length, 3);
    assert.ok(surface.boundaryNodeIds.every((id) => moved.model.nodes.some((node) => node.id === id)));
  });
}
