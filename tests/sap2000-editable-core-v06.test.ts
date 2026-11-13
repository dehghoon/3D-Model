import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV06 } from "../lib/default-model-v05";
import { assertCanonicalV06, readProjectV06 } from "../lib/core-v06";
import { auditSapGeometryEdits, projectSapGeometryForEditing, readSapHandoff } from "../lib/import/sap2000-handoff";
import { transformGroup } from "../lib/editor/group-transform";
import { createNodeFromGlobalCoordinates, createMemberFromCanonicalRefs } from "../lib/editor-modeling-v05";
import { createSurfaceFromCanonicalRefs, updateSurfaceBoundaryFromCanonicalRefs, deleteSurfaceFromCanonicalRefs } from "../lib/editor-surface-v05";

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


test("SAP member property edit survives Core 0.6 save/reopen without altering source geometry", () => {
  const source=handoff();
  const imported=projectSapGeometryForEditing(createStarterModelV06(),source);
  const originalNodes=JSON.parse(JSON.stringify(imported.nodes));
  const originalArchive=JSON.parse(JSON.stringify(source.sourceArchive));
  const member=imported.members[0];
  const edited={
    ...imported,
    members:imported.members.map(m=>m.id===member.id
      ? {...m,rotationDeg:37,sectionId:member.sectionId,materialId:member.materialId}
      : m),
  };
  const reopened=readProjectV06(JSON.parse(JSON.stringify(edited)));
  assertCanonicalV06(reopened);
  assert.equal(reopened.members[0].rotationDeg,37);
  assert.deepEqual(reopened.nodes,originalNodes);
  assert.equal(reopened.members[0].startNodeId,member.startNodeId);
  assert.equal(reopened.members[0].endNodeId,member.endNodeId);
  assert.equal(reopened.members[0].metadata?.sourceEngineeringAssignment,"unresolved");
  assert.equal(reopened.project.metadata?.analysisReady,false);
  assert.deepEqual(source.sourceArchive,originalArchive);
  const audit=auditSapGeometryEdits(reopened,imported);
  assert.deepEqual(audit.movedNodes,[]);
  assert.deepEqual(audit.addedNodes,[]);
  assert.deepEqual(audit.addedMembers,[]);
});


test("SAP projection strips stale Quick Frame metadata that could overwrite imported geometry", () => {
  const template=createStarterModelV06();
  const contaminated={...template,project:{...template.project,
    metadata:{...template.project.metadata,simpleFrame:JSON.stringify({x:[5],y:[5],heights:[3]})}}};
  const imported=projectSapGeometryForEditing(contaminated,handoff());
  assert.equal(imported.project.metadata?.simpleFrame,undefined);
  assert.equal(imported.nodes.length,4);
  assert.equal(imported.members.length,1);
  assert.equal(imported.members[0].metadata?.sourceMemberId,"F1");
  assertCanonicalV06(imported);
});


test("SAP import does not inherit unrelated template grid lines", () => {
  const template=createStarterModelV06();
  const contaminated={...template,grids:[{
    id:"unrelated-grid",label:"OLD",
    start:{x:0,y:0,z:0},end:{x:0,y:10,z:0},
  }]};
  const imported=projectSapGeometryForEditing(contaminated,handoff());
  assert.deepEqual(imported.grids,[]);
  assert.equal(imported.members.length,1);
  assertCanonicalV06(imported);
});


test("SAP source areas become editable geometry-only Core surfaces without certifying properties", () => {
  const source=handoff();
  source.geometryPreview.areas=[{sourceId:"A1",sourceGuid:"area-guid-123",boundaryNodeIds:["1","2","3","4"],geometryOnly:true}];
  const imported=projectSapGeometryForEditing(createStarterModelV06(),source);
  assertCanonicalV06(imported);
  assert.equal(imported.surfaces.length,1);
  assert.deepEqual(imported.surfaces[0].boundaryNodeIds,["SAP-N-0","SAP-N-1","SAP-N-2","SAP-N-3"]);
  assert.equal(imported.surfaces[0].metadata?.sourceAreaId,"A1");
  assert.equal(imported.surfaces[0].metadata?.sourceAreaGuid,"area-guid-123");
  assert.equal(imported.project.metadata?.analysisReady,false);
  const reopened=readProjectV06(JSON.parse(JSON.stringify(imported)));
  assert.equal(reopened.surfaces.length,1);
  assert.deepEqual(reopened.surfaces[0].boundaryNodeIds,imported.surfaces[0].boundaryNodeIds);
});

test("SAP area with missing or repeated boundary nodes is rejected", () => {
  const source=handoff();
  const raw={...source,geometryPreview:{...source.geometryPreview,
    areas:[{sourceId:"A1",boundaryNodeIds:["1","2","missing"]}]}};
  assert.throws(()=>readSapHandoff(raw),/AREA_INVALID/);
  raw.geometryPreview.areas=[{sourceId:"A1",boundaryNodeIds:["1","2","2"]}];
  assert.throws(()=>readSapHandoff(raw),/AREA_INVALID/);
});


test("native and imported SAP areas use the same edit/delete operations",()=>{
  const source=handoff();
  source.geometryPreview.areas=[{sourceId:"A1",sourceGuid:"guid-1",boundaryNodeIds:["1","2","3","4"]}];
  const imported=projectSapGeometryForEditing(createStarterModelV06(),source);
  const edited=updateSurfaceBoundaryFromCanonicalRefs(imported,"SAP-A-0",["SAP-N-0","SAP-N-1","SAP-N-2"]);
  assert.deepEqual(edited.surface.boundaryNodeIds,["SAP-N-0","SAP-N-1","SAP-N-2"]);
  assert.equal(edited.surface.metadata?.sourceAreaGuid,"guid-1");
  assert.equal(edited.surface.metadata?.engineeringValidationRequired,true);
  assert.equal(imported.surfaces[0].boundaryNodeIds.length,4);
  assert.throws(()=>updateSurfaceBoundaryFromCanonicalRefs(imported,"SAP-A-0",["SAP-N-0","SAP-N-1","SAP-N-1"]),/DISTINCT/);
  const reopened=readProjectV06(JSON.parse(JSON.stringify(edited.model)));
  assertCanonicalV06(reopened);
  assert.equal(reopened.surfaces[0].boundaryNodeIds.length,3);
  const deleted=deleteSurfaceFromCanonicalRefs(reopened,"SAP-A-0");
  assert.equal(deleted.surfaces.length,0);
  assert.equal(imported.surfaces.length,1);
});


test("Area creation and editing reject coincident and collinear geometry",()=>{
  const source=handoff();
  const imported=projectSapGeometryForEditing(createStarterModelV06(),source);
  const ids=["SAP-N-0","SAP-N-1","SAP-N-2"];
  const created=createSurfaceFromCanonicalRefs(imported,{type:"wall",boundaryNodeIds:ids});
  assert.equal(created.surface.type,"wall");
  const coincident={...imported,nodes:imported.nodes.map(node=>
    node.id==="SAP-N-2" ? {...node,position:{...imported.nodes.find(n=>n.id==="SAP-N-1")!.position}} : node)};
  assert.throws(()=>createSurfaceFromCanonicalRefs(coincident,{type:"wall",boundaryNodeIds:ids}),/COINCIDENT/);
  const collinear={...imported,nodes:imported.nodes.map(node=>
    node.id==="SAP-N-2" ? {...node,position:{x:0,y:0,z:6}} : node)};
  assert.throws(()=>createSurfaceFromCanonicalRefs(collinear,{type:"wall",boundaryNodeIds:ids}),/COLLINEAR/);
  assert.throws(()=>updateSurfaceBoundaryFromCanonicalRefs({...collinear,surfaces:created.model.surfaces},created.surface.id,ids),/COLLINEAR/);
  assert.deepEqual(imported.surfaces,[]);
});


test("Area boundary rejects nonplanar quadrilateral",()=>{
  const imported=projectSapGeometryForEditing(createStarterModelV06(),handoff());
  const nonplanar={...imported,nodes:imported.nodes.map(node=>
    node.id==="SAP-N-3" ? {...node,position:{x:4,y:1,z:0}} : node)};
  assert.throws(()=>createSurfaceFromCanonicalRefs(nonplanar,{
    type:"wall",boundaryNodeIds:["SAP-N-0","SAP-N-1","SAP-N-2","SAP-N-3"]
  }),/NON_PLANAR/);
  const valid=createSurfaceFromCanonicalRefs(imported,{
    type:"wall",boundaryNodeIds:["SAP-N-0","SAP-N-1","SAP-N-2","SAP-N-3"]
  });
  assert.equal(valid.surface.boundaryNodeIds.length,4);
  assert.throws(()=>updateSurfaceBoundaryFromCanonicalRefs(
    {...nonplanar,surfaces:valid.model.surfaces},valid.surface.id,
    ["SAP-N-0","SAP-N-1","SAP-N-2","SAP-N-3"]
  ),/NON_PLANAR/);
});


test("Area rejects crossing boundary edges without modifying the model",()=>{
  const imported=projectSapGeometryForEditing(createStarterModelV06(),handoff());
  const crossing=["SAP-N-0","SAP-N-2","SAP-N-1","SAP-N-3"];
  assert.throws(()=>createSurfaceFromCanonicalRefs(imported,{
    type:"wall",boundaryNodeIds:crossing
  }),/SELF_INTERSECTING|ZERO_PROJECTED_AREA/);
  assert.equal(imported.surfaces.length,0);
});


test("Area rejects nonadjacent edge touch and overlap",()=>{
  const imported=projectSapGeometryForEditing(createStarterModelV06(),handoff());
  const extra=[
    {id:"TEST-5",position:{x:2,y:0,z:3}},
    {id:"TEST-6",position:{x:2,y:0,z:0}},
  ];
  const model={...imported,nodes:[...imported.nodes,...extra]};
  // The fourth segment returns along part of the first horizontal edge.
  assert.throws(()=>createSurfaceFromCanonicalRefs(model,{
    type:"wall",boundaryNodeIds:["SAP-N-0","SAP-N-1","SAP-N-2","TEST-5","SAP-N-3","TEST-6"]
  }),/SELF_INTERSECTING|ZERO_PROJECTED_AREA/);
});
