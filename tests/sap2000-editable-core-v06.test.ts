import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV06 } from "../lib/default-model-v05";
import { assertCanonicalV06, readProjectV06 } from "../lib/core-v06";
import { auditSapGeometryEdits, projectSapGeometryForEditing, readSapHandoff } from "../lib/import/sap2000-handoff";
import { transformGroup } from "../lib/editor/group-transform";
import { createNodeFromGlobalCoordinates, createMemberFromCanonicalRefs } from "../lib/editor-modeling-v05";
import { createSurfaceFromCanonicalRefs } from "../lib/editor-surface-v05";

function handoff() {
  return readSapHandoff({
    format:"linkoteq-sap2000-gpt3-handoff-v1",
    sourceHash:"test-hash",coreModel:null,canonicalMappingValidated:false,analysisReady:false,
    geometryPreview:{
      sourceUnits:"KIP,FT",
      nodes:[
        {sourceId:"1",position:{x:0,y:0,z:0}},
        {sourceId:"2",position:{x:0,y:0,z:3}},
        {sourceId:"3",position:{x:4,y:0,z:3}},
        {sourceId:"4",position:{x:4,y:0,z:0}},
      ],
      members:[{sourceId:"F1",startNodeId:"1",endNodeId:"2",renderable:true}],
      grids:{gridLines:[]},sourceLevels:{},inferredLevels:[],propertyAssignments:[],
    },
    engineeringData:{},sourceArchive:{filename:"fixture.s2k",sha256:"test-hash",byteLength:1,bytesBase64:"AA=="},
    importFidelity:{},diagnostics:{},
  });
}

test("SAP imported Core 0.6 geometry supports native move, copy, add member, wall, and save/reopen", () => {
  const source=handoff();
  const imported=projectSapGeometryForEditing(createStarterModelV06(),source);
  assertCanonicalV06(imported);
  assert.equal(imported.members.length,1);
  assert.equal(imported.members[0].metadata?.sourceEngineeringAssignment,"unresolved");
  assert.equal(imported.project.metadata?.analysisReady,false);

  const moved=transformGroup(imported,[{type:"member",id:"SAP-M-0"}],{x:1,y:0,z:0},"move").model;
  assert.equal(moved.nodes.find(n=>n.id==="SAP-N-0")?.position.x,1);
  const copied=transformGroup(moved,[{type:"member",id:"SAP-M-0"}],{x:2,y:0,z:0},"copy").model;
  assert.equal(copied.members.length,2);
  const added=createNodeFromGlobalCoordinates(copied,{x:2,y:2,z:0}).model;
  const materialId=imported.members[0].materialId, sectionId=imported.members[0].sectionId;
  const withMember=createMemberFromCanonicalRefs(added,{
    type:"beam",startNodeId:"SAP-N-2",endNodeId:added.nodes.at(-1)!.id,materialId,sectionId,
  }).model;
  const withWall=createSurfaceFromCanonicalRefs(withMember,{
    type:"wall",boundaryNodeIds:["SAP-N-0","SAP-N-1","SAP-N-2"],
  }).model;
  const reopened=readProjectV06(JSON.parse(JSON.stringify(withWall)));
  assertCanonicalV06(reopened);
  assert.equal(reopened.members.length,3);
  assert.equal(reopened.surfaces.length,1);
  assert.equal(reopened.project.metadata?.analysisReady,false);
  assert.equal(source.analysisReady,false);
  const audit=auditSapGeometryEdits(reopened,imported);
  assert.ok(audit.movedNodes.includes("SAP-N-0"));
  assert.equal(audit.addedMembers.length,2);
  assert.equal(audit.addedNodes.length,3);
});


test("SAP import never inherits unrelated native surfaces or loads", () => {
  const template=createStarterModelV06();
  const contaminated={...template,
    surfaces:[{id:"legacy-surface",type:"slab" as const,boundaryNodeIds:[]}],
    loadCases:[{id:"legacy-load-case",name:"Old load"}],
    loads:[{id:"legacy-load"}],
    loadCombinations:[{id:"legacy-combination",name:"Old combination"}],
  } as unknown as typeof template;
  const imported=projectSapGeometryForEditing(contaminated,handoff());
  assertCanonicalV06(imported);
  assert.deepEqual(imported.surfaces,[]);
  assert.deepEqual(imported.loadCases,[]);
  assert.deepEqual(imported.loads,[]);
  assert.deepEqual(imported.loadCombinations,[]);
  assert.equal(imported.project.metadata?.analysisReady,false);
});
