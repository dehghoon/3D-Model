import assert from "node:assert/strict";
import test from "node:test";
import {NextRequest} from "next/server";
import {OPTIONS, POST} from "../app/api/calculators/snow/route";
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
  let access:"owner"|"employee"|"trial"|"denied"="owner";
  try{
    globalThis.fetch=async(input,init)=>{
      const url=String(input);calls.push(url);
      if(url.endsWith("/auth/v1/user"))return Response.json({id:"synthetic-user"});
      if(url.includes("/rpc/platform_access_is_owner"))return Response.json(access==="owner");
      if(url.includes("/rpc/platform_my_permissions"))return Response.json(access==="employee"?["engineering_tools_internal"]:[]);
      if(url.includes("/rpc/has_active_customer_tool_trial"))return Response.json(true);
      if(url.includes("/rpc/has_accepted_customer_tool_disclaimer"))return Response.json(access==="trial");
      const body=JSON.parse(String(init?.body));
      assert.ok(url.endsWith("/v"+body.modelSchemaVersion));
      assert.equal(body.targetIds.length,1);
      const data=writeback(body.modelSchemaVersion);
      return Response.json({...data,runId:body.runId,projectId:body.projectId,targetIds:body.targetIds,
        loads:[{...data.loads[0],id:body.runId,surfaceId:body.targetIds[0],
          provenance:{sourceId:"source-"+body.runId,calculatorRunId:body.runId}}],
      });
    };
    for(const version of ["0.5","0.6"] as const){
      access=version==="0.5"?"owner":"employee";
      const response=await POST(new NextRequest("https://synthetic.invalid/api/calculators/snow",{
        method:"POST",headers:{"authorization":"Bearer synthetic-test-token","content-type":"application/json",origin:"https://www.linkoteq.com"},
        body:JSON.stringify({modelSchemaVersion:version,projectId:"project",runId:"synthetic-run",targetIds:["roof"]}),
      }));
      assert.equal(response.status,200);
      assert.equal(response.headers.get("access-control-allow-origin"),"https://www.linkoteq.com");
      const result=await response.json();
      assert.equal(result.modelSchemaVersion,version);
      assert.equal(mapSnowWriteback(result,["roof"]).loads[0].pressure.value,2);
    }
    const asCustomer=()=>POST(new NextRequest("https://synthetic.invalid/api/calculators/snow",{
      method:"POST",headers:{"authorization":"Bearer synthetic-test-token","content-type":"application/json"},
      body:JSON.stringify({modelSchemaVersion:"0.6",projectId:"project",runId:"synthetic-run",targetIds:["roof"]}),
    }));
    access="trial";
    assert.equal((await asCustomer()).status,200);
    const multi=await POST(new NextRequest("https://synthetic.invalid/api/calculators/snow",{
      method:"POST",headers:{"authorization":"Bearer synthetic-test-token","content-type":"application/json"},
      body:JSON.stringify({modelSchemaVersion:"0.6",projectId:"project",runId:"batch",targetIds:["roof-a","roof-b"],
        inputs:{calculation:{mode:"UNIFORM_ROOF"}}}),
    }));
    assert.equal(multi.status,200);
    const batch=await multi.json();
    assert.equal(batch.runId,"batch");
    assert.deepEqual(mapSnowWriteback(batch,["roof-a","roof-b"]).loads.map(load=>[
      load.surfaceId,load.provenance?.calculatorRunId,
    ]),[["roof-a","batch-1"],["roof-b","batch-2"]]);
    access="denied";
    assert.equal((await asCustomer()).status,403);
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

test("only the Linkoteq account origin can preflight the Snow proxy",()=>{
  const preflight=(origin:string)=>OPTIONS(new NextRequest("https://3dmodel.linkoteq.com/api/calculators/snow",{
    method:"OPTIONS",headers:{origin},
  }));
  assert.equal(preflight("https://www.linkoteq.com").status,204);
  const denied=preflight("https://untrusted.invalid");
  assert.equal(denied.status,403);
  assert.equal(denied.headers.get("access-control-allow-origin"),null);
});
