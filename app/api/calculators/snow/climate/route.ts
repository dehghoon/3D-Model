import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const base = process.env.SNOW_CALCULATOR_API_URL?.replace(/\/$/, "");
  if (!base) return NextResponse.json({ error: "Snow Calculator is not configured." }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const province = searchParams.get("province");
  const location = searchParams.get("location");
  let path = "/api/v1/climatic/provinces";
  if (province && location) path = `/api/v1/climatic/location?province=${encodeURIComponent(province)}&location=${encodeURIComponent(location)}`;
  else if (province) path = `/api/v1/climatic/locations?province=${encodeURIComponent(province)}`;

  try {
    const response = await fetch(`${base}${path}`, { cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/json" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Climate lookup failed." }, { status: 502 });
  }
}
