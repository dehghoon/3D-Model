import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV05 } from "../lib/default-model-v05";
import { transformGroup } from "../lib/editor/group-transform";
import { pointFromCoordinates, columnPointAtLevel } from "../lib/editor/point-input";
import { createSurfaceFromPoints } from "../lib/editor/surface-draw-controller";
import { assertCanonicalV05 } from "../lib/core-v05";

const delta={x:10,y:2,z:3};
function connectedFixture(){
  const model=createStarterModelV05();
  model.surfaces=[{id:"TEST-SURFACE",type:"wall",boundaryNodeIds:model.nodes.map(node=>node.id)}];
  return model;
}
for(const operation of ["move","copy"] as const){
  test(`${operation} transforms mixed connected selections and shared nodes exactly once`,()=>{
    const model=connectedFixture(); const before=structuredClone(model);
    const selections=[...model.members.map(item=>({type:"member" as const,id:item.id})),{type:"surface" as const,id:"TEST-SURFACE"}, {type:"node" as const,id:model.nodes[1].id}];
    const result=transformGroup(model,[...selections,selections[0]],delta,operation);
    assert.deepEqual(model,before,"Source must remain immutable");
    assert.equal(result.nodeIds.length,model.nodes.length);
    assert.equal(new Set(result.nodeIds).size,model.nodes.length);
    assert.equal(result.selections.length,selections.length);
    assertCanonicalV05(result.model);
    for(const [index,node] of model.nodes.entries()){
      const transformed=result.model.nodes.find(item=>item.id===result.nodeIds[index])!;
      // Node-map order is traversal order; resolve by original ID on move and suffix on copy.
      const target=operation==="move"?result.model.nodes.find(item=>item.id===node.id)!:result.model.nodes.find(item=>item.id===`${node.id}-copy`)!;
      assert.deepEqual(target.position,{x:node.position.x+delta.x,y:node.position.y+delta.y,z:node.position.z+delta.z});
      assert.ok(transformed);
    }
    const selectedMemberIds=new Set(result.selections.filter(item=>item.type==="member").map(item=>item.id));
    const copiedMembers=result.model.members.filter(member=>selectedMemberIds.has(member.id));
    const surface=result.model.surfaces.find(item=>item.id===(operation==="move"?"TEST-SURFACE":"TEST-SURFACE-copy"))!;
    assert.ok(copiedMembers.every(member=>surface.boundaryNodeIds.includes(member.startNodeId)&&surface.boundaryNodeIds.includes(member.endNodeId)));
    if(operation==="copy"){
      assert.equal(result.model.nodes.length,model.nodes.length*2);
      assert.equal(result.model.members.length,model.members.length*2);
      assert.deepEqual(result.model.nodes.slice(0,model.nodes.length),model.nodes);
      assert.deepEqual(result.model.supports,model.supports);
      assert.deepEqual(result.model.loads,model.loads);
    } else {
      assert.deepEqual(result.model.nodes.map(node=>node.id),model.nodes.map(node=>node.id));
    }
  });
}
test("copy IDs remain unique across repeated group copies",()=>{
  const model=connectedFixture();const selected=model.members.map(member=>({type:"member" as const,id:member.id}));
  const one=transformGroup(model,selected,delta,"copy");
  const two=transformGroup(one.model,selected,delta,"copy");
  for(const records of [two.model.nodes,two.model.members])assert.equal(new Set(records.map(item=>item.id)).size,records.length);
});
test("invalid group member and zero/non-finite displacement never partially mutate geometry",()=>{
  const model=connectedFixture(),before=structuredClone(model);
  assert.throws(()=>transformGroup(model,[{type:"member",id:model.members[0].id},{type:"member",id:"MISSING"}],delta,"copy"),/UNKNOWN_MEMBER/);
  assert.throws(()=>transformGroup(model,[{type:"node",id:model.nodes[0].id}],{x:0,y:0,z:0},"move"),/ZERO/);
  assert.throws(()=>transformGroup(model,[{type:"node",id:model.nodes[0].id}],{x:NaN,y:0,z:0},"move"),/INVALID/);
  assert.deepEqual(model,before);
});
test("absolute, relative and column-level input preserve global XYZ",()=>{
  assert.deepEqual(pointFromCoordinates({x:"2",y:"3",z:"4"},"absolute",null).point,{x:2,y:3,z:4});
  assert.deepEqual(pointFromCoordinates({x:"-2",y:"3",z:"4"},"relative",{x:5,y:6,z:7}).point,{x:3,y:9,z:11});
  const model=createStarterModelV05();
  const level=model.levels.find(item=>item.elevation!==0)!;
  assert.deepEqual(columnPointAtLevel(model,{x:8,y:9,z:0},level.id).point,{x:8,y:9,z:level.elevation});
  assert.throws(()=>pointFromCoordinates({x:"",y:"0",z:"1"},"absolute",null),/all three/);
  assert.throws(()=>pointFromCoordinates({x:"1e999",y:"0",z:"1"},"absolute",null),/finite/);
  assert.throws(()=>columnPointAtLevel(model,{x:0,y:0,z:level.elevation},level.id),/differ/);
});
test("surface completion is atomic and rejects crossing, non-planar and collinear boundaries",()=>{
  const model=createStarterModelV05(),before=structuredClone(model);
  const p=(x:number,y:number,z=0)=>({x,y,z});
  assert.throws(()=>createSurfaceFromPoints(model,"slab",[p(20,20),p(24,24),p(20,24),p(24,20)]),/cross/);
  assert.throws(()=>createSurfaceFromPoints(model,"slab",[p(20,20),p(24,20),p(24,24),p(20,24,1)]),/plane/);
  assert.throws(()=>createSurfaceFromPoints(model,"slab",[p(20,20),p(21,21),p(22,22)]),/area/);
  assert.deepEqual(model,before);
  const result=createSurfaceFromPoints(model,"slab",[p(20,20),p(24,20),p(24,24),p(20,24)]);
  assert.equal(result.model.nodes.length,model.nodes.length+4);
  assert.equal(result.surface.boundaryNodeIds.length,4);
  assertCanonicalV05(result.model);
});

test("moving a shared node cannot collapse an unselected connected member",()=>{
  const model=createStarterModelV05(),member=model.members[0];
  const start=model.nodes.find(node=>node.id===member.startNodeId)!;
  const end=model.nodes.find(node=>node.id===member.endNodeId)!;
  assert.throws(()=>transformGroup(model,[{type:"node",id:end.id}],{
    x:start.position.x-end.position.x,y:start.position.y-end.position.y,z:start.position.z-end.position.z,
  },"move"),/COLLAPSES_MEMBER/);
});
test("copied surface openings retain their new host and boundary IDs",()=>{
  const model=connectedFixture();
  const extra=[{id:"O1",position:{x:1,y:0,z:1}},{id:"O2",position:{x:2,y:0,z:1}},{id:"O3",position:{x:2,y:0,z:2}}];
  model.nodes.push(...extra);model.openings=[{id:"OPEN1",hostSurfaceId:"TEST-SURFACE",boundaryNodeIds:extra.map(node=>node.id)}];
  const result=transformGroup(model,[{type:"surface",id:"TEST-SURFACE"}],delta,"copy");
  const opening=result.model.openings!.find(item=>item.id!=="OPEN1")!;
  assert.equal(opening.hostSurfaceId,"TEST-SURFACE-copy");
  assert.ok(opening.boundaryNodeIds.every(id=>id.endsWith("-copy")&&result.model.nodes.some(node=>node.id===id)));
});
