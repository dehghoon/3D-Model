import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyLinkoteqCustomerAccess } from "../lib/linkoteq-customer-access";

const config={supabaseUrl:"https://example.supabase.co",supabaseAnonKey:"public-anon-key"};
test("missing token is denied without network calls",async()=>{
 const result=await verifyLinkoteqCustomerAccess(null,"3d_model",config,async()=>{throw Error("should not call");});
 assert.deepEqual(result,{allowed:false,status:401,reason:"authentication_required"});
});
test("valid identity with no owner grant is denied",async()=>{
 let calls=0;
 const result=await verifyLinkoteqCustomerAccess("Bearer test-token","3d_model",config,async()=>{
  calls++;
  return new Response(calls===1?JSON.stringify({id:"user-1"}):"false",{status:200,headers:{"content-type":"application/json"}});
 });
 assert.equal(calls,2);
 assert.deepEqual(result,{allowed:false,status:403,reason:"owner_approval_required"});
});
test("active beta grant permits the verified user",async()=>{
 let calls=0;
 const result=await verifyLinkoteqCustomerAccess("Bearer test-token","3d_model",config,async()=>{
  calls++;
  return new Response(calls===1?JSON.stringify({id:"user-1"}):"true",{status:200,headers:{"content-type":"application/json"}});
 });
 assert.deepEqual(result,{allowed:true,userId:"user-1"});
});
test("RPC failure fails closed",async()=>{
 let calls=0;
 const result=await verifyLinkoteqCustomerAccess("Bearer test-token","3d_model",config,async()=>{
  calls++;return new Response(calls===1?JSON.stringify({id:"user-1"}):"{}",{status:calls===1?200:500});
 });
 assert.equal(result.allowed,false);
});
