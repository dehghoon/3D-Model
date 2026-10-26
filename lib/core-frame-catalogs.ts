import type { Section } from "@linkoteq/structural-core";
import {
  ciscRecordToCoreSection,
  isCiscRecordCoreAssignable,
  type CiscSectionRecord,
} from "./cisc-section-library-v05";
import type { MaterialReferenceTemplateV05 } from "./material-reference-library-v05";
export const CORE_CATALOG_REF = "b1f25a6b735f4e3c586d4d8497298ebd6f656126";
export const REQUESTED_FRAME_SECTIONS = {
  beam: "W310x32",
  column: "W250x49",
  brace: "2L70x70x6.4",
} as const;
export interface CoreLocation {
  id: string;
  country: string;
  provinceOrTerritory: string;
  location: string;
  climateRef: { path: string; jsonPointer: string };
}
export interface FrameCatalogs {
  ref: string;
  locations: CoreLocation[];
  materials: MaterialReferenceTemplateV05[];
  records: CiscSectionRecord[];
  sections: Section[];
  datasetVersion: string;
}
export async function loadFrameCatalogs(
  signal?: AbortSignal,
): Promise<FrameCatalogs> {
  const [catalogResponse, sectionResponse] = await Promise.all([
    fetch("/api/core-catalogs", { signal }),
    fetch("/api/cisc-sections", { signal }),
  ]);
  if (!catalogResponse.ok || !sectionResponse.ok)
    throw new Error(
      "Core catalogs could not load. Retry to select locations and member defaults.",
    );
  const catalog = await catalogResponse.json();
  const dataset = await sectionResponse.json();
  if (
    !Array.isArray(catalog.locations) ||
    !Array.isArray(catalog.materials) ||
    !Array.isArray(dataset.sections) ||
    dataset.dataset_version !== catalog.sectionDatasetVersion
  )
    throw new Error("Core catalog version or response mismatch.");
  const records: CiscSectionRecord[] = dataset.sections.map(
    (record: CiscSectionRecord) => ({
      ...record,
      dataset_version: dataset.dataset_version,
    }),
  );
  return {
    ref: catalog.ref,
    locations: catalog.locations,
    materials: catalog.materials,
    records,
    sections: records
      .filter(isCiscRecordCoreAssignable)
      .map(ciscRecordToCoreSection),
    datasetVersion: dataset.dataset_version,
  };
}
export function requestedSection(
  catalogs: FrameCatalogs,
  type: keyof typeof REQUESTED_FRAME_SECTIONS,
): Section | undefined {
  const key = (s: string) => s.toLowerCase().replace(/[×\s]/g, "x");
  return catalogs.sections.find(
    (s) => key(s.designation ?? "") === key(REQUESTED_FRAME_SECTIONS[type]),
  );
}
