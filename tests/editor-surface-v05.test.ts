import assert from "node:assert/strict";
import test from "node:test";

import type { StructuralModel } from "@linkoteq/structural-core";
import { createSurfaceFromCanonicalRefs, updateSurfaceBoundaryFromCanonicalRefs, deleteSurfaceFromCanonicalRefs } from "../lib/editor-surface-v05";

function fixture(): StructuralModel {
  return {
    schemaVersion: "0.6",
    project: { id: "P1", name: "Surface Test", units: "SI" },
    levels: [{ id: "L1", name: "Level 1", elevation: 0 }],
    grids: [],
    nodes: [
      { id: "N1", position: { x: 0, y: 0, z: 0 } },
      { id: "N2", position: { x: 4, y: 0, z: 0 } },
      { id: "N3", position: { x: 4, y: 3, z: 0 } },
      { id: "N4", position: { x: 0, y: 3, z: 0 } },
    ],
    members: [],
    surfaces: [],
    diaphragms: [],
    materials: [],
    sections: [],
    supports: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
  };
}

test("editor creates canonical Core v0.6 surfaces from existing node references", () => {
  const model = fixture();
  const result = createSurfaceFromCanonicalRefs(model, {
    type: "slab",
    boundaryNodeIds: ["N1", "N2", "N3", "N4"],
    levelId: "L1",
  });

  assert.deepEqual(result.surface, {
    id: "S1",
    type: "slab",
    boundaryNodeIds: ["N1", "N2", "N3", "N4"],
    levelId: "L1",
  });
  assert.equal(model.surfaces.length, 0);
  assert.equal(result.model.surfaces.length, 1);
});

test("editor generates deterministic surface IDs and does not synthesize engineering properties", () => {
  const model = fixture();
  const first = createSurfaceFromCanonicalRefs(model, {
    type: "wall",
    boundaryNodeIds: ["N1", "N2", "N3"],
  });
  const second = createSurfaceFromCanonicalRefs(first.model, {
    type: "wall",
    boundaryNodeIds: ["N1", "N3", "N4"],
  });

  assert.equal(first.surface.id, "S1");
  assert.equal(second.surface.id, "S2");
  assert.deepEqual(Object.keys(first.surface).sort(), ["boundaryNodeIds", "id", "type"]);
});

test("editor rejects invalid canonical surface boundaries", () => {
  const model = fixture();
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, { type: "slab", boundaryNodeIds: ["N1", "N2"] }),
    /SURFACE_AT_LEAST_THREE_NODES_REQUIRED/,
  );
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, { type: "slab", boundaryNodeIds: ["N1", "N2", "N1"] }),
    /SURFACE_BOUNDARY_NODES_MUST_BE_DISTINCT/,
  );
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, { type: "wall", boundaryNodeIds: ["N1", "N2", "MISSING"] }),
    /UNKNOWN_SURFACE_NODE:MISSING/,
  );
});

test("editor rejects unknown optional surface references", () => {
  const model = fixture();
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, {
      type: "slab",
      boundaryNodeIds: ["N1", "N2", "N3"],
      levelId: "MISSING",
    }),
    /UNKNOWN_SURFACE_LEVEL:MISSING/,
  );
  assert.throws(
    () => createSurfaceFromCanonicalRefs(model, {
      type: "wall",
      boundaryNodeIds: ["N1", "N2", "N3"],
      materialId: "MISSING",
    }),
    /UNKNOWN_SURFACE_MATERIAL:MISSING/,
  );
});


test("Area validation remains stable with large SAP coordinate offsets", () => {
  const original=fixture();
  const shifted={...original,nodes:original.nodes.map(node=>({
    ...node,position:{
      x:node.position.x+1_000_000,
      y:node.position.y-2_000_000,
      z:node.position.z+3_000_000,
    },
  }))};
  const boundaryNodeIds=["N1","N2","N3","N4"];
  const created=createSurfaceFromCanonicalRefs(shifted,{type:"slab",boundaryNodeIds});
  assert.deepEqual(created.surface.boundaryNodeIds,boundaryNodeIds);
  assert.equal(shifted.surfaces.length,0);
  const warped={...shifted,nodes:shifted.nodes.map(node=>
    node.id==="N3" ? {...node,position:{...node.position,z:node.position.z+0.5}} : node)};
  assert.throws(()=>createSurfaceFromCanonicalRefs(warped,{
    type:"slab",boundaryNodeIds
  }),/NON_PLANAR/);
});

test("SAP Area boundary edits retain provenance and do not mutate original model", () => {
  const original=fixture();
  const imported={...original,surfaces:[{
    id:"SAP-AREA-1",type:"slab" as const,
    boundaryNodeIds:["N1","N2","N3","N4"],
    metadata:{sourceFormat:"SAP2000",sourceAreaId:"A-17",sourceGuid:"GUID-17",
      sourceSectionName:"SLAB200",geometryOnly:true,engineeringValidationRequired:true},
  }]};
  const updated=updateSurfaceBoundaryFromCanonicalRefs(imported,"SAP-AREA-1",["N1","N2","N3"]);
  assert.deepEqual(updated.surface.boundaryNodeIds,["N1","N2","N3"]);
  assert.equal(updated.surface.metadata?.sourceGuid,"GUID-17");
  assert.equal(updated.surface.metadata?.sourceAreaId,"A-17");
  assert.equal(updated.surface.metadata?.sourceSectionName,"SLAB200");
  assert.equal(updated.surface.metadata?.engineeringValidationRequired,true);
  assert.deepEqual(imported.surfaces[0].boundaryNodeIds,["N1","N2","N3","N4"]);
  assert.throws(()=>updateSurfaceBoundaryFromCanonicalRefs(imported,"SAP-AREA-1",["N1","N2","N1"]),
    /SURFACE_BOUNDARY_NODES_MUST_BE_DISTINCT/);
  assert.deepEqual(imported.surfaces[0].boundaryNodeIds,["N1","N2","N3","N4"]);
  const deleted=deleteSurfaceFromCanonicalRefs(updated.model,"SAP-AREA-1");
  assert.equal(deleted.surfaces.length,0);
  assert.equal(updated.model.surfaces.length,1);
});
