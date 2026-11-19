import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {createStarterModelV06} from "../lib/default-model-v05";
import {projectSapGeometryForEditing,readSapHandoff} from "../lib/import/sap2000-handoff";
import {readProjectV06} from "../lib/core-v06";
import {createSupportFromCanonicalNode} from "../lib/editor-support-v05";
import {buildCoreScene,disposeCoreScene,getObjectSelection,syncDenseNodeSelection} from "../lib/visualization/core-scene";
import {editableSapFitBounds,sourceSapFitBounds} from "../lib/visualization/sap-camera-fit";

function source() {
  return readSapHandoff({
    format:"linkoteq-sap2000-gpt3-handoff-v1",sourceHash:"synthetic",
    coreModel:null,canonicalMappingValidated:false,analysisReady:false,
    geometryPreview:{
      sourceUnits:"KN, m, C",
      nodes:[
        {sourceId:"A",position:{x:1e6,y:1e6,z:0}},
        {sourceId:"B",position:{x:1e6+2,y:1e6,z:0}},
        {sourceId:"C",position:{x:1e6+2,y:1e6+2,z:0}},
        {sourceId:"D",position:{x:1e6,y:1e6+2,z:0}},
        {sourceId:"E",position:{x:1e6,y:1e6,z:3}},
        {sourceId:"F",position:{x:1e6+2,y:1e6,z:3}},
      ],
      members:[{sourceId:"M",startNodeId:"A",endNodeId:"E",renderable:true}],
      areas:[
        {sourceId:"H",boundaryNodeIds:["A","B","C","D"],sourceGuid:"synthetic-guid",
          sourceSectionAssignment:{section:"Unverified deck",materialProperty:"source-material"}},
        {sourceId:"V",boundaryNodeIds:["A","B","F","E"]},
      ],
      grids:{gridLines:[{id:"K",axis:"X",coordinate:"1000000",coordinateSystem:"GLOBAL"}]},
      sourceLevels:{},inferredLevels:[],propertyAssignments:[],
    },
    engineeringData:{sourceAreaLoads:[{sourceId:"H",unverified:true}]},
    sourceArchive:{filename:"synthetic.s2k",sha256:"synthetic",byteLength:1,bytesBase64:"AA=="},
    importFidelity:{},diagnostics:{},
  });
}

test("SAP surfaces retain source provenance while horizontal and vertical geometry get distinct editor types",()=>{
  const handoff=source(), before=JSON.stringify(handoff);
  const model=projectSapGeometryForEditing(createStarterModelV06(),handoff);
  assert.deepEqual(model.surfaces.map(s=>s.type),["slab","wall"]);
  assert.equal(model.surfaces[0].metadata?.sourceAreaGuid,"synthetic-guid");
  assert.equal(model.surfaces[0].metadata?.sourceSectionName,"Unverified deck");
  assert.equal(model.surfaces[0].metadata?.sourceMaterialProperty,"source-material");
  assert.equal(model.surfaces[0].metadata?.engineeringValidationRequired,true);
  assert.equal(JSON.stringify(handoff),before);
  assert.equal(JSON.stringify(readProjectV06(JSON.parse(JSON.stringify(model)))),JSON.stringify(model));
});

test("floating point elevations cluster without altering any source node coordinates",()=>{
  const handoff=source();
  handoff.geometryPreview.nodes[1].position.z=1e-15;
  const model=projectSapGeometryForEditing(createStarterModelV06(),handoff);
  assert.equal(model.levels.length,2);
  assert.equal(model.nodes[1].position.z,1e-15);
  assert.ok(model.levels.every(l=>l.name.startsWith("Inferred")));
});

test("SAP replacement clears native supports and diaphragms with stale node references",()=>{
  const template=createStarterModelV06();
  template.supports=[{id:"old",nodeId:"absent",restraints:{DX:true,DY:true,DZ:true,RX:false,RY:false,RZ:false}}];
  const imported=projectSapGeometryForEditing(template,source());
  assert.deepEqual(imported.supports,[]);
  assert.deepEqual(imported.diaphragms,[]);
});

test("Core 0.5 saved project upgrades additively and Core 0.6 accepts support edits",()=>{
  const old={...createStarterModelV06(),schemaVersion:"0.5",surfaceAnalysis:[]};
  const before=JSON.stringify(old),model=readProjectV06({format:"linkoteq-project",model:old});
  assert.equal(model.schemaVersion,"0.6");
  assert.equal(JSON.stringify(old),before);
  assert.deepEqual(model.nodes,old.nodes);
  assert.deepEqual(model.surfaceAnalysis,[]);
  const editable={...model,supports:[]};
  const next=createSupportFromCanonicalNode(editable,{nodeId:model.nodes[0].id,restraints:{DX:true}});
  assert.equal(next.model.schemaVersion,"0.6");
  assert.equal(next.support.nodeId,model.nodes[0].id);
});

test("shell triangulation retains local precision at large offsets and preserves both windings",()=>{
  const model=projectSapGeometryForEditing(createStarterModelV06(),source());
  for(const reversed of [false,true]){
    model.surfaces=model.surfaces.map(s=>({...s,boundaryNodeIds:reversed?[...s.boundaryNodeIds].reverse():s.boundaryNodeIds}));
    const scene=buildCoreScene(model,null);
    const shells=scene.pickables.filter(o=>getObjectSelection(o)?.type==="surface") as THREE.Mesh[];
    assert.equal(shells.length,2);
    for(const mesh of shells){
      assert.equal(mesh.geometry.index?.count,6);
      mesh.geometry.computeBoundingBox();
      const size=mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
      assert.ok(Math.max(size.x,size.y,size.z)<=3);
      assert.ok(mesh.position.x>=1e6);
      assert.equal((mesh.material as THREE.MeshStandardMaterial).side,THREE.DoubleSide);
    }
    disposeCoreScene(scene.root);
  }
});

test("camera fits surface vertices beyond frame bounds and excludes unrelated orphan nodes",()=>{
  const handoff=source();
  const model=projectSapGeometryForEditing(createStarterModelV06(),handoff);
  model.nodes.push({id:"orphan",position:{x:1e9,y:1e9,z:1e9}});
  const bounds=editableSapFitBounds(model);
  assert.equal(bounds.max.x,1e6+2);
  assert.equal(bounds.max.z,1e6+2);
  assert.deepEqual(bounds,sourceSapFitBounds(handoff));
});

test("dense node display uses one point cloud and shared hit geometry while retaining raycast and highlight",()=>{
  const model=createStarterModelV06();
  model.nodes=Array.from({length:1000},(_,i)=>({id:"N"+i,position:{x:i*2,y:0,z:0}}));
  model.members=[];model.surfaces=[];model.grids=[];
  const scene=buildCoreScene(model,null);
  const points=scene.root.getObjectByName("core-dense-node-points") as THREE.Points;
  assert.equal(points.geometry.getAttribute("position").count,1000);
  assert.equal(scene.denseNodeHits?.size,1000);
  assert.equal(new Set([...scene.denseNodeHits!.values()].map(m=>m.geometry)).size,1);
  scene.root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,0,10),new THREE.Vector3(0,0,-1));
  assert.equal(getObjectSelection(ray.intersectObjects(scene.pickables)[0].object)?.id,"N0");
  syncDenseNodeSelection(scene,["N0","N8"]);
  assert.equal(scene.root.getObjectByName("core-dense-node-selection")?.children.length,2);
  syncDenseNodeSelection(scene,[]);
  assert.equal(scene.root.getObjectByName("core-dense-node-selection")?.children.length,0);
  let disposed=0;
  scene.denseNodeHits!.get("N0")!.geometry.addEventListener("dispose",()=>disposed++);
  disposeCoreScene(scene.root);
  assert.equal(disposed,1);
});

test("explicit source level elevations and names override geometric inference",()=>{
  const handoff=source();
  handoff.geometryPreview.definedLevels=[{name:"Roof",elevation:3,sourceLine:1},{name:"Base",elevation:0,sourceLine:2}];
  const model=projectSapGeometryForEditing(createStarterModelV06(),handoff);
  assert.deepEqual(model.levels.map(l=>[l.name,l.elevation]),[["Base",0],["Roof",3]]);
});

test("saved SAP projects retain source archive and engineering records without mutating Core geometry",async()=>{
  const {serializeSapProject,readSapProject}=await import("../lib/import/sap-project");
  const handoff=source(),model=projectSapGeometryForEditing(createStarterModelV06(),handoff);
  const saved=serializeSapProject(model,handoff);
  const reopened=readSapProject(JSON.parse(saved));
  assert.deepEqual(reopened.source,handoff);
  assert.equal(JSON.stringify(reopened.model),JSON.stringify(model));
  const invalid=JSON.parse(saved);
  invalid.model.project.metadata.sourceHash="other";
  assert.throws(()=>readSapProject(invalid),/SOURCE_HASH_MISMATCH/);
  assert.equal(readSapProject(JSON.parse(serializeSapProject(createStarterModelV06()))).source,null);
});
