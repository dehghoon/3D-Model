import { NextResponse } from "next/server";

const SOURCE_URL = "https://raw.githubusercontent.com/dehghoon/steel-verification/main/data/cisc/cisc_sections.json";

export async function GET() {
  try {
    const response = await fetch(SOURCE_URL, { next: { revalidate: 3600 } });
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
