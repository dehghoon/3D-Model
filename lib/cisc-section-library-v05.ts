import type { Material, Section, StructuralModel } from "@linkoteq/structural-core";

export const APPROVED_CISC_DATASET_URL =
  process.env.NEXT_PUBLIC_CISC_DATASET_URL ??
  "https://raw.githubusercontent.com/dehghoon/steel-verification/main/data/cisc/cisc_sections.json";

export const DEFAULT_CISC_DESIGNATION = "W310X39";

export interface CiscSectionRecord {
  id: string;
  designation: string;
  designation_imperial?: string | null;
  designation_metric?: string | null;
  family: string;
  source: string;
  dataset_version: string;
  units: Record<string, string>;
  properties: Record<string, number | string | null>;
}

interface CiscDataset {
  dataset_version: string;
  sections: CiscSectionRecord[];
}

function requiredNumber(record: CiscSectionRecord, key: string): number {
  const value = record.properties[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`CISC_SECTION_PROPERTY_REQUIRED:${record.id}:${key}`);
  }
  return value;
}

function optionalNumber(record: CiscSectionRecord, key: string): number | undefined {
  const value = record.properties[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function unitValue(value: number, unit: string) {
  return { value, unit };
}

export async function loadApprovedCiscSections(): Promise<{
  datasetVersion: string;
  sections: CiscSectionRecord[];
}> {
  const response = await fetch(APPROVED_CISC_DATASET_URL, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`CISC_DATASET_FETCH_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as Partial<CiscDataset>;
  if (
    typeof payload.dataset_version !== "string" ||
    !payload.dataset_version ||
    !Array.isArray(payload.sections)
  ) {
    throw new Error("CISC_DATASET_INVALID");
  }

  const sections = payload.sections.filter(
    (item): item is CiscSectionRecord =>
      Boolean(item) &&
      typeof item.id === "string" &&
      typeof item.designation === "string" &&
      item.family === "W" &&
      item.dataset_version === payload.dataset_version,
  );

  if (!sections.length) {
    throw new Error("CISC_DATASET_HAS_NO_W_SECTIONS");
  }

  return { datasetVersion: payload.dataset_version, sections };
}

export function ciscRecordToCoreSection(record: CiscSectionRecord): Section {
  const lengthUnit = record.units.length ?? "mm";
  const areaUnit = record.units.area ?? "mm2";
  const inertiaUnit = record.units.inertia ?? "mm4";
  const sectionModulusUnit = record.units.section_modulus ?? "mm3";

  const analysis: Section["analysis"] = {
    A: unitValue(requiredNumber(record, "gross_area"), areaUnit),
    Iy: unitValue(requiredNumber(record, "moment_of_inertia_major"), inertiaUnit),
    Iz: unitValue(requiredNumber(record, "moment_of_inertia_minor"), inertiaUnit),
    J: unitValue(requiredNumber(record, "torsional_constant"), inertiaUnit),
  };

  const optional: Array<[keyof Section["analysis"], string, string]> = [
    ["Sy", "elastic_modulus_major", sectionModulusUnit],
    ["Sz", "elastic_modulus_minor", sectionModulusUnit],
    ["Zy", "plastic_modulus_major", sectionModulusUnit],
    ["Zz", "plastic_modulus_minor", sectionModulusUnit],
    ["ry", "radius_of_gyration_major", lengthUnit],
    ["rz", "radius_of_gyration_minor", lengthUnit],
  ];

  for (const [target, source, unit] of optional) {
    const value = optionalNumber(record, source);
    if (value !== undefined) {
      (analysis as Record<string, unknown>)[target] = unitValue(value, unit);
    }
  }

  const geometry: NonNullable<Section["geometry"]> = {};
  const geometryMap: Array<[string, string]> = [
    ["depth", "depth"],
    ["flangeWidth", "flange_width"],
    ["flangeThickness", "flange_thickness"],
    ["webThickness", "web_thickness"],
  ];

  for (const [target, source] of geometryMap) {
    const value = optionalNumber(record, source);
    if (value !== undefined) {
      geometry[target] = unitValue(value, lengthUnit);
    }
  }

  return {
    id: record.id,
    family: record.family,
    designation: record.designation,
    geometry,
    analysis,
    design: {
      source: record.source,
      designationImperial: record.designation_imperial ?? null,
      designationMetric: record.designation_metric ?? null,
      warpingConstant:
        optionalNumber(record, "warping_constant") !== undefined
          ? unitValue(optionalNumber(record, "warping_constant")!, record.units.warping ?? "mm6")
          : undefined,
      massPerLength:
        optionalNumber(record, "mass_per_length") !== undefined
          ? unitValue(optionalNumber(record, "mass_per_length")!, record.units.mass ?? "kg/m")
          : undefined,
    },
    libraryRef: {
      library: "CISC",
      version: record.dataset_version,
      recordId: record.id,
    },
    metadata: {
      approvedDatasetUrl: APPROVED_CISC_DATASET_URL,
      source: record.source,
    },
  };
}

export function verifiedLegacySteel350W(): Material {
  return {
    id: "MAT-STEEL-350W",
    type: "steel",
    name: "Steel 350W",
    analysis: {
      E: { value: 200000, unit: "MPa" },
      G: { value: 77000, unit: "MPa" },
      nu: 0.3,
      rho: { value: 7850, unit: "kg/m3" },
      fy: { value: 350, unit: "MPa" },
    },
    steel: {
      grade: "350W",
    },
    metadata: {
      source: "3D-Model/tests/fixtures/legacy-v02-project.json",
    },
  };
}

export function createDefaultPortalFrame(record: CiscSectionRecord): StructuralModel {
  const section = ciscRecordToCoreSection(record);
  const material = verifiedLegacySteel350W();

  return {
    schemaVersion: "0.5",
    project: {
      id: "PROJECT001",
      name: "3D Model",
      units: "SI",
      metadata: {
        defaultModel: "portal-frame",
        ciscDatasetVersion: record.dataset_version,
      },
    },
    levels: [
      { id: "LEVEL-BASE", name: "Base", elevation: 0 },
      { id: "LEVEL-ROOF", name: "Roof", elevation: 3.5 },
    ],
    grids: [
      { id: "GRID-A", label: "A", start: { x: 0, y: -2, z: 0 }, end: { x: 0, y: 2, z: 0 } },
      { id: "GRID-B", label: "B", start: { x: 6, y: -2, z: 0 }, end: { x: 6, y: 2, z: 0 } },
      { id: "GRID-1", label: "1", start: { x: -2, y: 0, z: 0 }, end: { x: 8, y: 0, z: 0 } },
    ],
    nodes: [
      { id: "N1", position: { x: 0, y: 0, z: 0 }, levelId: "LEVEL-BASE" },
      { id: "N2", position: { x: 0, y: 0, z: 3.5 }, levelId: "LEVEL-ROOF" },
      { id: "N3", position: { x: 6, y: 0, z: 3.5 }, levelId: "LEVEL-ROOF" },
      { id: "N4", position: { x: 6, y: 0, z: 0 }, levelId: "LEVEL-BASE" },
    ],
    members: [
      {
        id: "C1",
        type: "column",
        startNodeId: "N1",
        endNodeId: "N2",
        materialId: material.id,
        sectionId: section.id,
      },
      {
        id: "B1",
        type: "beam",
        startNodeId: "N2",
        endNodeId: "N3",
        materialId: material.id,
        sectionId: section.id,
      },
      {
        id: "C2",
        type: "column",
        startNodeId: "N4",
        endNodeId: "N3",
        materialId: material.id,
        sectionId: section.id,
      },
    ],
    surfaces: [],
    diaphragms: [],
    materials: [material],
    sections: [section],
    supports: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
  };
}

export function addCiscSectionToModel(
  model: StructuralModel,
  record: CiscSectionRecord,
): StructuralModel {
  const section = ciscRecordToCoreSection(record);
  const sections = model.sections.some((item) => item.id === section.id)
    ? model.sections.map((item) => (item.id === section.id ? section : item))
    : [...model.sections, section];

  return {
    ...model,
    sections,
    project: {
      ...model.project,
      metadata: {
        ...(model.project.metadata ?? {}),
        ciscDatasetVersion: record.dataset_version,
      },
    },
  };
}
