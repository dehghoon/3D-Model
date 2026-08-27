import type {
  Load,
  Material,
  Member,
  Section,
  StructuralModel,
  Support,
} from "@linkoteq/structural-core";

export const CORE_SCHEMA_VERSION = "0.5" as const;
export const LEGACY_SCHEMA_VERSION = "0.2" as const;

type AnyRecord = Record<string, unknown>;

export type MigrationResult = {
  model: StructuralModel;
  warnings: string[];
};

const asRecord = (value: unknown): AnyRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value) throw new Error(`MISSING_${field.toUpperCase()}`);
  return value;
};

function migrateSupport(value: unknown): Support {
  const source = asRecord(value);
  const r = asRecord(source.restraints);
  return {
    id: text(source.id, "support_id"),
    nodeId: text(source.nodeId, "support_node_id"),
    restraints: {
      DX: Boolean(r.DX ?? r.ux),
      DY: Boolean(r.DY ?? r.uy),
      DZ: Boolean(r.DZ ?? r.uz),
      RX: Boolean(r.RX ?? r.rx),
      RY: Boolean(r.RY ?? r.ry),
      RZ: Boolean(r.RZ ?? r.rz),
    },
  };
}

function migrateRelease(value: unknown) {
  const r = asRecord(value);
  if (!Object.keys(r).length) return undefined;
  return {
    DX: Boolean(r.DX ?? r.ux),
    DY: Boolean(r.DY ?? r.uy),
    DZ: Boolean(r.DZ ?? r.uz),
    RX: Boolean(r.RX ?? r.rx),
    RY: Boolean(r.RY ?? r.ry),
    RZ: Boolean(r.RZ ?? r.rz),
  };
}

function migrateMember(value: unknown): Member {
  const source = asRecord(value);
  return {
    ...(source as unknown as Member),
    id: text(source.id, "member_id"),
    type: (source.type ?? "other") as Member["type"],
    startNodeId: text(source.startNodeId, "member_start_node_id"),
    endNodeId: text(source.endNodeId, "member_end_node_id"),
    materialId: text(source.materialId, "member_material_id"),
    sectionId: text(source.sectionId, "member_section_id"),
    startRelease: migrateRelease(source.startRelease),
    endRelease: migrateRelease(source.endRelease),
  };
}

function assertMaterial(value: unknown): asserts value is Material {
  const m = asRecord(value);
  const a = asRecord(m.analysis);
  for (const key of ["id", "type", "name"]) text(m[key], `material_${key}`);
  for (const key of ["E", "G", "rho"]) {
    const unitValue = asRecord(a[key]);
    if (typeof unitValue.value !== "number" || typeof unitValue.unit !== "string") {
      throw new Error(`MATERIAL_${key}_UNIT_VALUE_REQUIRED`);
    }
  }
  if (typeof a.nu !== "number") throw new Error("MATERIAL_NU_REQUIRED");
}

function assertSection(value: unknown): asserts value is Section {
  const s = asRecord(value);
  text(s.id, "section_id");
  const a = asRecord(s.analysis);
  for (const key of ["A", "Iy", "Iz", "J"]) {
    const unitValue = asRecord(a[key]);
    if (typeof unitValue.value !== "number" || typeof unitValue.unit !== "string") {
      throw new Error(`SECTION_${key}_UNIT_VALUE_REQUIRED`);
    }
  }
}

function assertLoad(value: unknown): asserts value is Load {
  const load = asRecord(value);
  text(load.id, "load_id");
  text(load.loadCaseId, "load_case_id");
  const type = text(load.type, "load_type");
  if (!["nodal", "member-point", "member-distributed", "surface-pressure", "self-weight", "level", "diaphragm"].includes(type)) {
    throw new Error(`UNSUPPORTED_CORE_LOAD:${type}`);
  }
}

export function assertCanonicalV05(model: unknown): asserts model is StructuralModel {
  const m = asRecord(model);
  if (m.schemaVersion !== CORE_SCHEMA_VERSION) throw new Error("CORE_V05_REQUIRED");

  for (const material of asArray(m.materials)) assertMaterial(material);
  for (const section of asArray(m.sections)) assertSection(section);
  for (const support of asArray(m.supports)) {
    const s = migrateSupport(support);
    if (Object.values(s.restraints).length !== 6) throw new Error("SUPPORT_SIX_DOF_REQUIRED");
  }
  for (const load of asArray(m.loads)) assertLoad(load);
}

export function migrateProjectToV05(input: unknown): MigrationResult {
  const root = asRecord(input);
  const source = root.format === "linkoteq-project" ? asRecord(root.model) : root;
  const version = String(source.schemaVersion ?? "");

  if (version === CORE_SCHEMA_VERSION) {
    const model = clone(source) as unknown as StructuralModel;
    assertCanonicalV05(model);
    return { model, warnings: [] };
  }

  if (version !== LEGACY_SCHEMA_VERSION) {
    throw new Error(`UNSUPPORTED_CORE_SCHEMA:${version || "<missing>"}`);
  }

  const warnings = [
    "Project migrated from Core v0.2 to Core v0.5; newly saved projects use Core v0.5 only.",
  ];

  const raw = clone(source);
  const project = asRecord(raw.project);
  const model = {
    ...raw,
    schemaVersion: CORE_SCHEMA_VERSION,
    project: {
      ...project,
      metadata: {
        ...asRecord(project.metadata),
        migration: {
          migratedFromSchema: LEGACY_SCHEMA_VERSION,
          migratedToSchema: CORE_SCHEMA_VERSION,
          warnings,
        },
      },
    },
    members: asArray(raw.members).map(migrateMember),
    supports: asArray(raw.supports).map(migrateSupport),
    loadSources: asArray(raw.loadSources),
    loadCases: asArray(raw.loadCases),
    loads: asArray(raw.loads),
    loadCombinations: asArray(raw.loadCombinations),
  } as unknown as StructuralModel;

  assertCanonicalV05(model);
  return { model, warnings };
}
