import assert from "node:assert/strict";
import test from "node:test";
import type { StructuralModel } from "@linkoteq/structural-core";
import { assertCanonicalV05, migrateProjectToV05 } from "../lib/core-v05";
import { createMemberFromCanonicalRefs } from "../lib/editor-modeling-v05";

const model=():StructuralModel=>({
 schemaVersion:"0.5",project:{id:"p",name:"joist",units:"SI"},levels:[],grids:[],
 nodes:[{id:"N1",position:{x:0,y:0,z:0}},{id:"N2",position:{x:5,y:0,z:0}}],
 members:[],surfaces:[],diaphragms:[],
 materials:[{id:"MAT",type:"steel",name:"steel",analysis:{E:{value:200000,unit:"MPa"},G:{value:77000,unit:"MPa"},nu:0.3,rho:{value:7850,unit:"kg/m3"}}}],
 sections:[{id:"SEC",family:"joist",analysis:{A:{value:1,unit:"mm2"},Iy:{value:1,unit:"mm4"},Iz:{value:1,unit:"mm4"},J:{value:1,unit:"mm4"}}}],
 supports:[],loadCases:[],loads:[],loadCombinations:[]
});
const refs={type:"joist" as const,startNodeId:"N1",endNodeId:"N2",materialId:"MAT",sectionId:"SEC"};
test("joist creation preserves engineering designation and unverified capacity",()=>{
 const result=createMemberFromCanonicalRefs(model(),{...refs,joist:{series:"K",designation:"K-test",analyticalRepresentation:"preserve-only",capacityVerification:"unverified"}});
 assert.equal(result.member.type,"joist");assert.equal(result.member.id,"J1");
 assert.equal(result.member.joist?.designation,"K-test");
 assert.equal(JSON.parse(JSON.stringify(result.model)).members[0].joist.capacityVerification,"unverified");
});
test("joist without specification fails rather than silently becoming beam",()=>{
 assert.throws(()=>createMemberFromCanonicalRefs(model(),refs),/JOIST_SPECIFICATION_REQUIRED/);
});
test("beam cannot silently acquire joist engineering data",()=>{
 assert.throws(()=>createMemberFromCanonicalRefs(model(),{...refs,type:"beam",joist:{series:"K",designation:"K-test",analyticalRepresentation:"preserve-only",capacityVerification:"unverified"}}),/JOIST_SPECIFICATION_REQUIRES_JOIST_MEMBER/);
});

test("joist model survives canonical save and reopen without changing capacity status",()=>{
 const created=createMemberFromCanonicalRefs(model(),{...refs,joist:{series:"LH",designation:"LH-test",analyticalRepresentation:"preserve-only",capacityVerification:"unverified",catalog:{publisher:"test",edition:"fixture"}}});
 assert.doesNotThrow(()=>assertCanonicalV05(created.model));
 const reopened=migrateProjectToV05(JSON.parse(JSON.stringify(created.model))).model;
 assert.deepEqual(reopened,created.model);
 assert.equal(reopened.members[0].joist?.catalog?.edition,"fixture");
});
test("import rejects malformed joist instead of silently dropping designation",()=>{
 const created=createMemberFromCanonicalRefs(model(),{...refs,joist:{series:"K",designation:"K-test",analyticalRepresentation:"preserve-only",capacityVerification:"unverified"}});
 const invalid=JSON.parse(JSON.stringify(created.model));
 invalid.members[0].joist.designation="";
 assert.throws(()=>migrateProjectToV05(invalid),/INVALID_JOIST_SPECIFICATION/);
});
test("canonical model rejects joist fields attached to beams",()=>{
 const created=createMemberFromCanonicalRefs(model(),{...refs,joist:{series:"K",designation:"K-test",analyticalRepresentation:"preserve-only",capacityVerification:"unverified"}});
 const invalid=JSON.parse(JSON.stringify(created.model));
 invalid.members[0].type="beam";
 assert.throws(()=>assertCanonicalV05(invalid),/JOIST_SPECIFICATION_REQUIRES_JOIST_MEMBER/);
});
