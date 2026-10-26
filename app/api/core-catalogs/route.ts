import { NextResponse } from "next/server";
import { CORE_CATALOG_REF } from "../../../lib/core-frame-catalogs";
const ROOT = `https://raw.githubusercontent.com/dehghoon/linkoteq-structural-core/${CORE_CATALOG_REF}/`;
export async function GET() {
  try {
    const paths = [
      "catalogs/locations/canadian-location-index.json",
      "catalogs/materials/references/material-templates-v05.json",
      "catalogs/sections/steel/cisc/sst13-2026-08-25/manifest.json",
    ];
    const results = await Promise.all(
      paths.map(async (path) => {
        const response = await fetch(ROOT + path, {
          next: { revalidate: 3600 },
        });
        if (!response.ok)
          throw new Error(`Core catalog unavailable: ${response.status}`);
        return response.json();
      }),
    );
    const [locations, materials, manifest] = results;
    if (
      !Array.isArray(locations.records) ||
      locations.records.length !== locations.recordCount ||
      !Array.isArray(materials.records) ||
      materials.records.length !== materials.recordCount ||
      typeof manifest.dataset_version !== "string"
    )
      throw new Error("Incomplete Core catalog response.");
    return NextResponse.json({
      ref: CORE_CATALOG_REF,
      locations: locations.records,
      materials: materials.records,
      sectionDatasetVersion: manifest.dataset_version,
      sourcePaths: paths,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Core catalogs unavailable",
      },
      { status: 502 },
    );
  }
}
