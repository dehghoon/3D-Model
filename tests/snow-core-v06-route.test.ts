import assert from "node:assert/strict";
import test from "node:test";
import {NextRequest} from "next/server";
import {POST} from "../app/api/calculators/snow/route";
import {mapSnowWriteback} from "../lib/core-loads-v05";

test("authenticated Snow requests preserve Core version through proxy and writeback",async()=>{
  const fetchBefore=globalThis.fetch;
  const names=["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SNOW_CALCULATOR_API_URL"] as const;
  const before=names.map(key=>process.env[key]);
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://synthetic-auth.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="synthetic-test-key";
  process.env.SNOW_CALCULATOR_API_URL="https://synthetic-snow.invalid";
  const writeback=(version:"0.5"|"0.6")=>({
    runId:"synthetic-run",modelSchemaVersion:version,loadSources:[],
    loads:[{id:"load",type:"surface-pressure",loadCaseId:"snow",surfaceId:"roof",
      pressure:{value:2,unit:"kPa"},provenance:{sourceId:"source",calculatorRunId:"synthetic-run"}}],
  });
  const calls:string[]=[];
  try{
    globalThis.fetch=async(input,init)=>{
      const url=String(input);calls.push(url);
      if(url.endsWith("/auth/v1/user"))return Response.json({id:"synthetic-user"});
      if(url.includes("/rpc/has_internal_engineering_tool_access"))return Response.json(true);
      const body=JSON.parse(String(init?.body));
      assert.ok(url.endsWith("/v"+body.modelSchemaVersion));
      return Response.json(writeback(body.modelSchemaVersion));
    };
    for(const version of ["0.5","0.6"] as const){
      const response=await POST(new NextRequest("https://synthetic.invalid/api/calculators/snow",{
        method:"POST",headers:{"authorization":"Bearer synthetic-test-token","content-type":"application/json"},
        body:JSON.stringify({modelSchemaVersion:version,projectId:"project",runId:"synthetic-run",targetIds:["roof"]}),
      }));
      assert.equal(response.status,200);
      const result=await response.json();
      assert.equal(result.modelSchemaVersion,version);
      assert.equal(mapSnowWriteback(result,["roof"]).loads[0].pressure.value,2);
    }
    const previousCalls=calls.length;
    const anonymous=await POST(new NextRequest("https://synthetic.invalid/api/calculators/snow",{
      method:"POST",headers:{"content-type":"application/json"},body:"{}",
    }));
    assert.equal(anonymous.status,401);
    assert.equal(calls.length,previousCalls);
    assert.throws(()=>mapSnowWriteback({...writeback("0.6"),modelSchemaVersion:"0.7"} as never,["roof"]),/VERSION_MISMATCH/);
  } finally {
    globalThis.fetch=fetchBefore;
    names.forEach((key,i)=>{if(before[i]===undefined)delete process.env[key];else process.env[key]=before[i];});
  }
});
