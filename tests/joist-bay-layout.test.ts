import test from "node:test";
import assert from "node:assert/strict";
import type { StructuralModel } from "@linkoteq/structural-core";
import {detectJoistBay,layoutJoists,createJoistsInBay} from "../lib/editor/joist-bay-layout";
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

test("batch joist creation uses preview coordinates and pins both ends",()=>{
 const model=fixture();
 model.materials=[{id:"M",type:"steel",name:"Steel",analysis:{E:{value:200000,unit:"MPa"},G:{value:77000,unit:"MPa"},nu:0.3,rho:{value:7850,unit:"kg/m3"}}}];
 model.sections=[{id:"S",family:"joist",analysis:{A:{value:1,unit:"mm2"},Iy:{value:1,unit:"mm4"},Iz:{value:1,unit:"mm4"},J:{value:1,unit:"mm4"}}}];
 const bay=detectJoistBay(model,{x:3,y:2,z:3},3);
 const preview=layoutJoists(bay,{direction:0,count:2});
 const result=createJoistsInBay(model,{bay,direction:0,count:2,materialId:"M",sectionId:"S",joist:{series:"K",designation:"K-test",analyticalRepresentation:"preserve-only",capacityVerification:"unverified"}});
 assert.deepEqual(result.segments,preview);
 assert.equal(result.memberIds.length,2);
 assert.equal(result.model.members.filter(m=>m.type==="joist").length,2);
 assert.deepEqual(result.model.members.find(m=>m.id===result.memberIds[0])?.startRelease,{RX:true,RY:true,RZ:true});
 assert.equal(model.members.length,4);
});
