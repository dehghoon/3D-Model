import { NextRequest, NextResponse } from "next/server";

const DATASET_URL = "https://raw.githubusercontent.com/dehghoon/steel-verification/main/data/cisc/cisc_sections.json";
const DESIGN_API_BASE_URL = process.env.W_SECTION_API_BASE_URL ?? process.env.NEXT_PUBLIC_W_SECTION_API_BASE_URL ?? "";

export async function GET() {
  try {
    const response = await fetch(DATASET_URL, { next: { revalidate: 3600 } });
    if (!response.ok) {
      return NextResponse.json({ error: "Unable to load CISC W-section dataset." }, { status: 502 });
    }
    const data = await response.json();
    const sections = Array.isArray(data.sections)
      ? data.sections.map((section: any) => ({
          id: section.id,
          designation: section.designation,
          designation_metric: section.designation_metric ?? null,
          designation_imperial: section.designation_imperial ?? null,
          family: section.family,
          properties: section.properties ?? {}
        }))
      : [];
    return NextResponse.json({ dataset_version: data.dataset_version ?? null, sections });
  } catch {
    return NextResponse.json({ error: "Unable to load CISC W-section dataset." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!DESIGN_API_BASE_URL) {
    return NextResponse.json(
      {
        error: "W-section design service is not configured.",
        code: "W_SECTION_API_NOT_CONFIGURED",
        requiredEnvironmentVariable: "W_SECTION_API_BASE_URL"
      },
      { status: 503 }
    );
  }

  try {
    const payload = await request.json();
    const response = await fetch(`${DESIGN_API_BASE_URL.replace(/\/$/, "")}/api/v1/calculations/w-section/core`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const body = await response.json().catch(() => ({ error: "Invalid response from W-section design service." }));
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to reach W-section design service.",
        code: "W_SECTION_API_UNAVAILABLE",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 502 }
    );
  }
}
