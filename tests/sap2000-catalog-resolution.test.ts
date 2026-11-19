import test from "node:test";
import assert from "node:assert/strict";
import {resolveSapCatalogReference} from "../lib/import/sap2000-catalog-resolution";
const sections=[{id:"s0",name:"W310x32"},{id:"s1",name:"W250x49"}];
const materials=[{id:"m0",name:"Default Steel"},{id:"m1",name:"A992"}];
test("matches both references without declaring analysis readiness",()=>{
 const r=resolveSapCatalogReference({sourceMemberId:"F1",sectionName:" w250X49 ",materialName:"A992"},sections,materials,"s0","m0");
 assert.equal(r.sectionId,"s1");assert.equal(r.materialId,"m1");
 assert.deepEqual(r.warnings,[]);assert.equal(r.analysisReady,false);
});
test("uses editable defaults and warnings for missing references",()=>{
 const r=resolveSapCatalogReference({sourceMemberId:"F2",sectionName:"CUSTOM",materialName:"UNKNOWN"},sections,materials,"s0","m0");
 assert.equal(r.sectionId,"s0");assert.equal(r.materialId,"m0");
 assert.equal(r.warnings.length,2);
 assert.equal(r.sectionStatus,"default-missing");
});
test("never silently chooses between ambiguous library names",()=>{
 const r=resolveSapCatalogReference({sourceMemberId:"F3",sectionName:"W310x32",materialName:"A992"},[...sections,{id:"duplicate",name:"w310X32"}],materials,"s0","m0");
 assert.equal(r.sectionStatus,"default-ambiguous");assert.equal(r.materialStatus,"matched");
 assert.equal(r.warnings.length,1);
});
test("rejects nonexistent fallback catalog identifiers",()=>{
 assert.throws(()=>resolveSapCatalogReference({sourceMemberId:"F4"},sections,materials,"bad","m0"),/DEFAULT_NOT_FOUND/);
});
