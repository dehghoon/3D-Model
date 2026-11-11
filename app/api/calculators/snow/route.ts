import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeRequest(input: Record<string, unknown>) {
  const projectId = String(input.projectId ?? "");
  const runId = String(input.runId ?? "");
  const targetIds = Array.isArray(input.targetIds) ? input.targetIds.map(String) : [];
  if (!projectId || !runId || !targetIds.length) throw new Error("SNOW_CORE_V05_IDENTITY_REQUIRED");
  return { ...input, modelSchemaVersion: "0.5", projectId, runId, calculator: "snow", targetIds };
}


// Customer authorization is fail-closed. Employee SSO must be verified and
// federated before this guard can replace the existing production route.
async function authorizeCustomerSnow(request: NextRequest): Promise<401 | 403 | 503 | null> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return 401;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return 503;
  const headers = { apikey: key, authorization, "Content-Type": "application/json" };
  try {
    const user = await fetch(url + "/auth/v1/user", { headers, cache: "no-store" });
    if (!user.ok) return user.status >= 500 ? 503 : 401;
    const internal = await fetch(url + "/rest/v1/rpc/has_internal_engineering_tool_access", {
      method: "POST", headers, body: JSON.stringify({ p_tool_key: "snow_load" }), cache: "no-store"
    });
    if (!internal.ok) return 503;
    if (await internal.json() === true) return null;
    const grant = await fetch(url + "/rest/v1/rpc/has_active_customer_tool_trial", {
      method: "POST", headers, body: JSON.stringify({ p_tool_key: "snow_load" }), cache: "no-store"
    });
    if (!grant.ok) return 503;
    if (await grant.json() !== true) return 403;
    const disclaimer = await fetch(url + "/rest/v1/rpc/has_accepted_customer_tool_disclaimer", {
      method: "POST", headers,
      body: JSON.stringify({ p_tool_key: "snow_load", p_version: "engineering-trial-v1" }),
      cache: "no-store"
    });
    if (!disclaimer.ok) return 503;
    return await disclaimer.json() === true ? null : 403;
  } catch { return 503; }
}

export async function POST(request: NextRequest) {
  const denial = await authorizeCustomerSnow(request);
  if (denial !== null) return NextResponse.json({ error: denial === 401 ? "authentication_required" : denial === 403 ? "tool_access_denied" : "entitlement_unavailable" }, { status: denial, headers: { "Cache-Control": "no-store" } });
  const base = process.env.SNOW_CALCULATOR_API_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({ error: "Snow Calculator is not configured." }, { status: 503 });
  }
  try {
    const body = normalizeRequest(await request.json());
    const response = await fetch(`${base}/api/v1/core/roof-snow/v0.5`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";
    return new NextResponse(text, { status: response.status, headers: { "content-type": contentType } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Snow Calculator request failed." }, { status: 502 });
  }
}
