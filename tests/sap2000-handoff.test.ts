import test from "node:test";
import assert from "node:assert/strict";
import {auditSapGeometryEdits, readSapHandoff} from "../lib/import/sap2000-handoff";

const fixture={
  format:"linkoteq-sap2000-gpt3-handoff-v1",
  sourceHash:"fixture-hash",
  coreModel:null,
  canonicalMappingValidated:false,
  analysisReady:false,
  geometryPreview:{
    sourceUnits:"KIP,FT",
    nodes:[{sourceId:"1",position:{x:0,y:0,z:0}},{sourceId:"2",position:{x:0,y:0,z:10}}],
    members:[{sourceId:"F1",startNodeId:"1",endNodeId:"2",renderable:true}],
    grids:{gridLines:[],deferredGridLines:[]},sourceLevels:{sourceRecordCount:0},
    inferredLevels:[],propertyAssignments:[]
  },
  engineeringData:{sourceLoads:{}},
  sourceArchive:{filename:"fixture.s2k",sha256:"fixture-hash",byteLength:1,bytesBase64:"AA=="},
  importFidelity:{},diagnostics:{}
};
test("accepts source-only GPT-2 geometry without certifying analysis",()=>{
  const v=readSapHandoff(fixture);
  assert.equal(v.analysisReady,false);
  assert.equal(v.geometryPreview.members[0].sourceId,"F1");
});
test("rejects forged analysis-ready package",()=>{
  assert.throws(()=>readSapHandoff({...fixture,analysisReady:true}),/CONTRACT_MISMATCH/);
});
test("rejects unresolved frame connectivity",()=>{
  assert.throws(()=>readSapHandoff({...fixture,geometryPreview:{...fixture.geometryPreview,members:[{sourceId:"F1",startNodeId:"missing",endNodeId:"2",renderable:false}]}}),/FRAME_INVALID/);
});

test("records SAP workspace moves, additions and deletions without rewriting the source",()=>{
  const original={nodes:[{id:"SAP-N-0",position:{x:0,y:0,z:0}},{id:"SAP-N-1",position:{x:0,y:0,z:10}}],members:[{id:"SAP-M-0",startNodeId:"SAP-N-0",endNodeId:"SAP-N-1"}]};
  const current={nodes:[{id:"SAP-N-0",position:{x:2,y:0,z:0}},{id:"NEW",position:{x:3,y:0,z:0}}],members:[{id:"NEW-M",startNodeId:"SAP-N-0",endNodeId:"NEW"}]};
  type Model=import("@linkoteq/structural-core").StructuralModel;
  const result=auditSapGeometryEdits(current as unknown as Model,original as unknown as Model);
  assert.deepEqual(result.movedNodes,["SAP-N-0"]);
  assert.deepEqual(result.addedNodes,["NEW"]);
  assert.deepEqual(result.deletedNodes,["SAP-N-1"]);
  assert.deepEqual(result.addedMembers,["NEW-M"]);
  assert.deepEqual(result.deletedMembers,["SAP-M-0"]);
  assert.equal(original.nodes[0].position.x,0);
});


test("rejects duplicate source frame identifiers and zero-length connectivity",()=>{
  const first=fixture.geometryPreview.members[0];
  assert.throws(()=>readSapHandoff({...fixture,geometryPreview:{...fixture.geometryPreview,members:[first,{...first}]} }),/FRAME_INVALID/);
  assert.throws(()=>readSapHandoff({...fixture,geometryPreview:{...fixture.geometryPreview,members:[{...first,endNodeId:first.startNodeId}]} }),/FRAME_INVALID/);
});
