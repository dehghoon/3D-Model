import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Allow the Python importer to wake from cold start and parse large SAP files.
export const maxDuration = 120;
const MAX_BYTES = 20_000_000;

/** Python service owns all SAP parsing; never parse SAP text in Next.js. */
export async function POST(request: NextRequest) {
  const base = process.env.SAP2000_IMPORTER_API_URL?.replace(/\/$/, "");
  if (!base) return NextResponse.json({error:"SAP2000_IMPORTER_NOT_CONFIGURED"}, {status:503});
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !/\.(s2k|\$2k)$/i.test(file.name)) {
      return NextResponse.json({error:"SAP2000_FILE_REQUIRED"}, {status:400});
    }
    if (file.size > MAX_BYTES) return NextResponse.json({error:"SAP2000_FILE_TOO_LARGE"}, {status:413});
    const upstream = new FormData();
    upstream.append("file",file,file.name);
    upstream.append("project_id",String(form.get("project_id") || "advanced-model"));
    const headers:Record<string,string>={};
    if (process.env.SAP2000_IMPORTER_API_TOKEN) headers.Authorization="Bearer "+process.env.SAP2000_IMPORTER_API_TOKEN;
    const response = await fetch(base+"/api/import/sap2000", {method:"POST",headers,body:upstream,cache:"no-store",signal:AbortSignal.timeout(110000)});
    const contentType=response.headers.get("content-type")||"";
    if (!contentType.includes("application/json")) return NextResponse.json({error:"IMPORTER_INVALID_RESPONSE"}, {status:502});
    const payload=await response.json();
    return NextResponse.json(payload,{status:response.status});
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return NextResponse.json({error:"SAP2000_IMPORTER_TIMEOUT",detail:"The Python importer did not respond within 110 seconds. Check Render service health and cold-start logs before retrying."},{status:504});
    }
    return NextResponse.json({error:error instanceof Error?error.message:"SAP2000_IMPORT_FAILED"},{status:502});
  }
}
