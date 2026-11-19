import { NextRequest, NextResponse } from "next/server";
import { mapSnowWriteback, type SnowV05Writeback } from "../../../../lib/core-loads-v05";

export const runtime = "nodejs";
const accountOrigin = "https://www.linkoteq.com";

function accountCors(request: NextRequest) {
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (request.headers.get("origin") === accountOrigin) {
    headers.set("Access-Control-Allow-Origin", accountOrigin);
    headers.set("Access-Control-Allow-Methods", "POST");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  return headers;
}

export function OPTIONS(request: NextRequest) {
  const headers = accountCors(request);
  return new NextResponse(null, { status: headers.has("Access-Control-Allow-Origin") ? 204 : 403, headers });
}
function normalizeRequest(input: Record<string, unknown>) {
  const projectId = String(input.projectId ?? "");
  const runId = String(input.runId ?? "");
  const targetIds = Array.isArray(input.targetIds) ? [...new Set(input.targetIds.map(String))] : [];
  if (!projectId || !runId || !targetIds.length) throw new Error("SNOW_CORE_V05_IDENTITY_REQUIRED");
  const modelSchemaVersion = input.modelSchemaVersion ?? "0.6";
  if (modelSchemaVersion !== "0.5" && modelSchemaVersion !== "0.6") throw new Error("SNOW_CORE_VERSION_MISMATCH");
  return { ...input, modelSchemaVersion, projectId, runId, calculator: "snow", targetIds };
}

class SnowInputError extends Error {}

async function calculateSnow(base: string, body: ReturnType<typeof normalizeRequest>, signal: AbortSignal) {
  const response = await fetch(`${base}/api/v1/core/roof-snow/v${body.modelSchemaVersion}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  if (response.status === 400 || response.status === 422) throw new SnowInputError();
  if (!response.ok) throw new Error("Snow engine unavailable");
  const result = await response.json() as SnowV05Writeback;
  if (result.runId !== body.runId || result.modelSchemaVersion !== body.modelSchemaVersion ||
      result.projectId !== body.projectId) throw new Error("Snow engine returned mismatched run identity");
  mapSnowWriteback(result, body.targetIds);
  return result;
}

async function calculateSnowTargets(base: string, body: ReturnType<typeof normalizeRequest>) {
  const signal = AbortSignal.timeout(25000);
  const mode = (body as { inputs?: { calculation?: { mode?: string } } }).inputs?.calculation?.mode;
  if (mode !== "UNIFORM_ROOF" || body.targetIds.length === 1) return calculateSnow(base, body, signal);

  // The engine returns canonical writeback for exactly one uniform-roof surface.
  const results: SnowV05Writeback[] = [];
  for (let start = 0; start < body.targetIds.length; start += 4) {
    results.push(...await Promise.all(body.targetIds.slice(start, start + 4).map((targetId, index) => calculateSnow(base, {
      ...body,
      runId: `${body.runId}-${start + index + 1}`,
      targetIds: [targetId],
    }, signal))));
  }
  return {
    runId: body.runId,
    modelSchemaVersion: body.modelSchemaVersion,
    projectId: body.projectId,
    targetIds: body.targetIds,
    loadSources: results.flatMap(result => result.loadSources ?? []),
    loadCases: results.flatMap(result => result.loadCases ?? []),
    loads: results.flatMap(result => result.loads ?? []),
    warnings: results.flatMap(result => result.warnings ?? []),
  };
}


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
    const roleCheck = (rpc: string) => fetch(url + "/rest/v1/rpc/" + rpc, {
      method: "POST", headers, body: "{}", cache: "no-store",
    });
    const [owner, permissions] = await Promise.all([
      roleCheck("platform_access_is_owner"), roleCheck("platform_my_permissions"),
    ]);
    if (owner.ok && await owner.json() === true) return null;
    const grants: unknown = permissions.ok ? await permissions.json() : null;
    if (Array.isArray(grants) && grants.includes("engineering_tools_internal")) return null;
    if (!owner.ok || !permissions.ok) return 503;
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
  const headers = accountCors(request);
  const denial = await authorizeCustomerSnow(request);
  if (denial !== null) return NextResponse.json({ error: denial === 401 ? "authentication_required" : denial === 403 ? "tool_access_denied" : "entitlement_unavailable" }, { status: denial, headers });
  const base = process.env.SNOW_CALCULATOR_API_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({ error: "snow_not_configured" }, { status: 503, headers });
  }
  let body;
  try {
    body = normalizeRequest(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_snow_request" }, { status: 400, headers });
  }
  try {
    return NextResponse.json(await calculateSnowTargets(base, body), { headers });
  } catch (error) {
    const invalid = error instanceof SnowInputError;
    return NextResponse.json({ error: invalid ? "invalid_snow_inputs" : "snow_service_unavailable" }, { status: invalid ? 422 : 502, headers });
  }
}
