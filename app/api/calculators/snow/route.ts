import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const base = process.env.SNOW_CALCULATOR_API_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({
      error: "Snow Calculator is not configured. Set SNOW_CALCULATOR_API_URL in the 3D-Model Vercel project to the Snow Calculator API origin."
    }, { status: 503 });
  }

  try {
    const body = await request.text();
    const response = await fetch(`${base}/api/v1/core/roof-snow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store"
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";
    return new NextResponse(text, { status: response.status, headers: { "content-type": contentType } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Snow Calculator request failed." }, { status: 502 });
  }
}
