import test from "node:test";
import assert from "node:assert/strict";
import type { StructuralModel } from "@linkoteq/structural-core";
import {detectJoistBay,layoutJoists} from "../lib/editor/joist-bay-layout";
function fixture():StructuralModel {
 const nodes=[[0,0],[6,0],[6,4],[0,4]].map(([x,y],i)=>({id:`N${i}`,position:{x,y,z:3}}));
 const members=[0,1,2,3].map(i=>({id:`B${i}`,type:"beam" as const,startNodeId:`N${i}`,endNodeId:`N${(i+1)%4}`,materialId:"M",sectionId:"S"}));
 return {schemaVersion:"0.5",project:{id:"P",name:"P",units:"SI"},nodes,members,levels:[],grids:[],surfaces:[],diaphragms:[],materials:[],sections:[],supports:[],loadCases:[],loads:[],loadCombinations:[]};
}
test("detect four-beam closed bay at active level",()=>{
 const bay=detectJoistBay(fixture(),{x:3,y:2,z:3},3);
 assert.equal(bay.beamIds.length,4);
 assert.equal(layoutJoists(bay,{direction:0,count:2}).length,2);
 assert.equal(layoutJoists(bay,{direction:1,count:3}).length,3);
});
test("spacing produces interior members and no boundary duplicates",()=>{
 const bay=detectJoistBay(fixture(),{x:3,y:2,z:3},3);
 const segments=layoutJoists(bay,{direction:0,spacing:2});
 assert.equal(segments.length,2);
 assert.equal(segments[0].start.z,3);
 assert.notDeepEqual(segments[0].start,segments[0].end);
});
test("open bay and wrong level fail closed",()=>{
 const open=fixture();open.members.pop();
 assert.throws(()=>detectJoistBay(open,{x:3,y:2,z:3},3),/NOT_FOUND/);
 assert.throws(()=>detectJoistBay(fixture(),{x:3,y:2,z:4},3),/LEVEL_MISMATCH/);
});
test("invalid count and spacing rejected",()=>{
 const bay=detectJoistBay(fixture(),{x:3,y:2,z:3},3);
 assert.throws(()=>layoutJoists(bay,{direction:0,count:0}),/INVALID/);
 assert.throws(()=>layoutJoists(bay,{direction:0,spacing:0}),/INVALID/);
});
