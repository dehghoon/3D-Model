import { NextResponse } from "next/server";

const PAGE_SIZE = 200;
const CISC_API_BASE_URL =
  process.env.CISC_SECTION_API_BASE_URL ??
  process.env.W_SECTION_API_BASE_URL ??
  process.env.NEXT_PUBLIC_W_SECTION_API_BASE_URL ??
  "";

interface SectionPage {
  items?: unknown[];
  total?: number;
  dataset_version?: string;
}

export async function GET() {
  if (!CISC_API_BASE_URL) {
    return NextResponse.json(
      {
        error: "CISC section catalog service is not configured.",
        code: "CISC_SECTION_API_NOT_CONFIGURED",
        requiredEnvironmentVariable: "CISC_SECTION_API_BASE_URL",
      },
      { status: 503 },
    );
  }

  try {
    const base = CISC_API_BASE_URL.replace(/\/$/, "");
    const sections: unknown[] = [];
    let datasetVersion = "";
    let total = Number.POSITIVE_INFINITY;
    let offset = 0;

    while (offset < total) {
      const params = new URLSearchParams({
        family: "",
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const response = await fetch(`${base}/api/v1/sections?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            error: "Unable to load the approved CISC section catalog.",
            code: "CISC_SECTION_API_UNAVAILABLE",
            upstreamStatus: response.status,
          },
          { status: 502 },
        );
      }

      const page = (await response.json()) as SectionPage;
      if (!Array.isArray(page.items) || typeof page.total !== "number") {
        return NextResponse.json(
          {
            error: "Approved CISC section catalog returned an invalid response.",
            code: "CISC_SECTION_API_INVALID_RESPONSE",
          },
          { status: 502 },
        );
      }

      if (typeof page.dataset_version === "string" && page.dataset_version) {
        if (datasetVersion && datasetVersion !== page.dataset_version) {
          return NextResponse.json(
            {
              error: "Approved CISC section catalog changed version during pagination.",
              code: "CISC_SECTION_DATASET_VERSION_CHANGED",
            },
            { status: 502 },
          );
        }
        datasetVersion = page.dataset_version;
      }

      total = page.total;
      sections.push(...page.items);
      offset += page.items.length;

      if (page.items.length === 0) break;
    }

    if (!datasetVersion || sections.length !== total) {
      return NextResponse.json(
        {
          error: "Approved CISC section catalog is incomplete.",
          code: "CISC_SECTION_CATALOG_INCOMPLETE",
          loaded: sections.length,
          expected: Number.isFinite(total) ? total : null,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      dataset_version: datasetVersion,
      total,
      sections,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to reach the approved CISC section catalog service.",
        code: "CISC_SECTION_API_UNAVAILABLE",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
