import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import type { StructuralModel } from "@linkoteq/structural-core";
import { selectMembersInWindow } from "../lib/visualization/selection-window";

function model(): StructuralModel {
  return {
    nodes: [
      { id: "N1", position: { x: -1, y: 0, z: 0 } },
      { id: "N2", position: { x: 1, y: 0, z: 0 } },
      { id: "N3", position: { x: 4, y: 0, z: 0 } },
    ],
    members: [
      { id: "M1", startNodeId: "N1", endNodeId: "N2" },
      { id: "M2", startNodeId: "N2", endNodeId: "N3" },
    ],
  } as unknown as StructuralModel;
}

function camera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

const rect = {
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  right: 100,
  bottom: 100,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

test("left-to-right selection contains complete members", () => {
  const selected = selectMembersInWindow(
    model(),
    camera(),
    rect,
    {
      start: { x: 35, y: 40 },
      end: { x: 65, y: 60 },
    },
  );

  assert.deepEqual(selected, [{ type: "member", id: "M1" }, { type: "node", id: "N1" }, { type: "node", id: "N2" }]);
});

test("right-to-left selection crosses intersecting members", () => {
  const selected = selectMembersInWindow(
    model(),
    camera(),
    rect,
    {
      start: { x: 52, y: 40 },
      end: { x: 48, y: 60 },
    },
  );

  assert.deepEqual(selected, [{ type: "member", id: "M1" }]);
});


test("window selection includes complete surfaces and crossing windows inside a surface", async () => {
  const {selectSurfacesInWindow}=await import("../lib/visualization/selection-window");
  const shape={...model(),nodes:[{id:"A",position:{x:-2,y:0,z:-2}},{id:"B",position:{x:2,y:0,z:-2}},
    {id:"C",position:{x:2,y:0,z:2}},{id:"D",position:{x:-2,y:0,z:2}}],
    surfaces:[{id:"W1",type:"wall" as const,boundaryNodeIds:["A","B","C","D"]}]};
  assert.deepEqual(selectSurfacesInWindow(shape,camera(),rect,{start:{x:20,y:20},end:{x:80,y:80}}),[{type:"surface",id:"W1"}]);
  assert.deepEqual(selectSurfacesInWindow(shape,camera(),rect,{start:{x:52,y:48},end:{x:48,y:52}}),[{type:"surface",id:"W1"}]);
  assert.deepEqual(selectSurfacesInWindow(shape,camera(),rect,{start:{x:48,y:48},end:{x:52,y:52}}),[]);
});
