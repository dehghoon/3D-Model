import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeRequest(input: Record<string, unknown>) {
  const projectId = String(input.projectId ?? "");
  const runId = String(input.runId ?? "");
  const targetIds = Array.isArray(input.targetIds) ? input.targetIds.map(String) : [];
  if (!projectId || !runId || !targetIds.length) throw new Error("SNOW_CORE_V05_IDENTITY_REQUIRED");
  return { ...input, modelSchemaVersion: "0.5", projectId, runId, calculator: "snow", targetIds };
}

export async function POST(request: NextRequest) {
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
