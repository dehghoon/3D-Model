import type {
  Load,
  LoadCase,
  LoadCombination,
  LoadSource,
  Material,
  Member,
  Section,
  StructuralModel,
  Support,
  UnitValue,
} from "@linkoteq/structural-core";

export const CORE_SCHEMA_VERSION = "0.5" as const;
export const LEGACY_SCHEMA_VERSION = "0.2" as const;

type AnyRecord = Record<string, unknown>;

export type MigrationResult = {
  model: StructuralModel;
  warnings: string[];
};

const asRecord = (value: unknown): AnyRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value) throw new Error(`MISSING_${field.toUpperCase()}`);
  return value;
};

const finite = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`MISSING_${field.toUpperCase()}`);
  return value;
};

const unitValue = (value: unknown, field: string): UnitValue => {
  const record = asRecord(value);
  if (typeof record.value !== "number" || !Number.isFinite(record.value) || typeof record.unit !== "string" || !record.unit) {
    throw new Error(`${field.toUpperCase()}_UNIT_VALUE_REQUIREDa);
  }
  return { value: record.value, unit: record.unit };
};

const optionalUnitValue = (value: unknown, field: string): UnitValue | undefined =>
  value === undefined || value === null ? undefined : unitValue(value, field);

const pick = (source: AnyRecord, ...keys: string[]): unknown => {
  for (const key of keys) if (source[key] !== undefined) return source[key];
  return undefined;
};

const materialType = (value: unknown): Material["type"] => {
  if (value === "steel" || value === "concrete" || value === "wood" || value === "other") return value;
  throw new Error("UNSUPPORTED_LEGACY_MATERIAL_TYPE");
};

const loadCategory = (value: unknown): LoadCase["category"] => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  const categories: LoadCase["category"][] = [
    "dead", "live", "roof-live", "snow", "rain", "wind", "seismic", "temperature", "construction", "other",
  ];
  if (categories.includes(normalized as LoadCase["category"])) return normalized as LoadCase["category"];
  throw new Error("UNSUPPORTED_LEGACY_LOAD_CATEGORY");
};

function migrateMaterial(value: unknown, warnings: string[]): Material {
  const source = asRecord(value);
  const properties = asRecord(source.properties);
  const analysis = asRecord(source.analysis);
  const get = (...keys: string[]) => pick(analysis, ...keys) ?? pick(properties, ...keys) ?? pick(source, ...keys);
  const id = text(source.id, "material_id");
  const type = materialType(source.type ?? properties.type);
  const name = text(source.name ?? properties.name, "material_name");
  const result: Material = {
    id,
    type,
    name,
    analysis: {
      E: unitValue(get("E", "e", "elasticModulus"), `material_${id}_E`),
      G: unitValue(get("G", "g", "shearModulus"), `material_${id}_G`),
      nu: finite(get("nu", "poisson", "poissonRatio"), `material_${id}_nu`),
      rho: unitValue(get("rho", "density"), `material_${id}_rho`),
      fy: optionalUnitValue(get("fy", "Fy", "yieldStrength"), `material_${id}_fy`),
    },
  };
  const known = new Set(["id", "type", "name", "analysis", "properties", "E", "e", "elasticModulus", "G", "g", "shearModulus", "nu", "poisson", "poissonRatio", "rho", "density", "fy", "Fy", "yieldStrength"]);
  const extra = Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key)));
  if (Object.keys(extra).length) {
    result.metadata = { legacy: extra };
    warnings.push(`LEGACY_MATERIAL_METADATA_PRESERVED:${id}`);
  }
  return result;
}

function migrateSection(value: unknown, warnings: string[]): Section {
  const source = asRecord(value);
  const properties = asRecord(source.properties);
  const analysis = asRecord(source.analysis);
  const get = (...keys: string[]) => pick(analysis, ...keys) ?? pick(properties, ...keys) ?? pick(source, ...keys);
  const id = text(source.id, "section_id");
  const result: Section = {
    id,
    family: text(source.family ?? properties.family ?? "other", "section_family"),
    designation: typeof source.designation === "string" ? source.designation : undefined,
    analysis: {
      A: unitValue(get("A", "area"), `section_${id}_A`),
      Iy: unitValue(get("Iy", "iy"), `section_${id}_Iy`),
      Iz: unitValue(get("Iz", "iz"), `section_${id}_Iz`),
      J: unitValue(get("J", "j"), `section_${id}_J`),
    },
  };
  for (const key of ["Ay", "Az", "Sy", "Sz", "Zy", "Zz", "ry", "rz"] as const) {
    const candidate = get(key);
    if (candidate !== undefined) result.analysis[key] = unitValue(candidate, `section_${id}_${key}`);
  }
  const known = new Set(["id", "family", "designation", "analysis", "properties", "A", "area", "Iy", "iy", "Izb", "iz", "J", "j", "Ay", "Az", "Sy", "Sz", "Zy", "Zz", "ry", "rz"]);
  const extra = Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key)));
  if (Object.keys(extra).length) {
    result.metadata = { legacy: extra };
    warnings.push(`LEGACY_SECTION_METADATA_PRESERVED:${id}`);
  }
  return result;
}

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
    DX: Boolean(r.DX ?? r.ux), DY: Boolean(r.DY ?? r.uy), DZ: Boolean(r.DZ ?? r.uz),
    RX: Boolean(r.RX ?? r.rx), RY: Boolean(r.RY ?? r.ry), RZ: Boolean(r.RZ ?? r.rz),
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

function migrateLoadSource(value: unknown): LoadSource {
  const source = asRecord(value);
  const id = text(source.id, "load_source_id");
  const category = loadCategory(source.category ?? source.loadCategory ?? "other");
  const calculator = source.calculator ?? source.source;
  const allowed = ["manual", "snow", "wind", "seismic", "self-weight", "other"];
  return {
    id,
    category,
    name: text(source.name ?? calculator ?? id, "load_source_name"),
    calculator: typeof calculator === "string" && allowed.includes(calculator) ? calculator as LoadSource["calculator"] : "other",
    calculatorVersion: typeof source.calculatorVersion === "string" ? source.calculatorVersion : undefined,
    codeEdition: typeof source.codeEdition === "string" ? source.codeEdition : undefined,
    jurisdiction: typeof source.jurisdiction === "string" ? source.jurisdiction : undefined,
    inputs: asRecord(source.inputs ?? source.inputProvenance),
    status: (source.status === "generated" || source.status === "stale" || source.status === "error" || source.status === "manual")
      ? source.status : (calculator === "manual" ? "manual" : "generated"),
    generatedAt: typeof source.generatedAt === "string" ? source.generatedAt : undefined,
  };
}

function migrateLoadCase(value: unknown): LoadCase {
  const source = asRecord(value);
  return {
    id: text(source.id, "load_case_id"),
    name: text(source.name ?? source.label ?? source.id, "load_case_name"),
    category: loadCategory(source.category ?? source.type),
    sourceId: typeof source.sourceId === "string" ? source.sourceId : undefined,
    analysisType: source.analysisType === "response-spectrum" || source.analysisType === "other" ? source.analysisType : "static",
    tags: Array.isArray(source.tags) ? source.tags.filter((v): v is string => typeof v === "string") : undefined,
  };
}

function migrateProvenance(source: AnyRecord) {
  const p = asRecord(source.provenance);
  const sourceId = pick(p, "sourceId") ?? source.sourceId ?? source.loadSourceId;
  const calculatorRunId = pick(p, "calculatorRunId") ?? source.calculatorRunId ?? source.runId;
  const formulaRef = pick(p, "formulaRef") ?? source.formulaRef;
  const note = pick(p, "note") ?? source.note;
  if (![sourceId, calculatorRunId, formulaRef, note].some((v) => typeof v === "string")) return undefined;
  return {
    sourceId: typeof sourceId === "string" ? sourceId : undefined,
    calculatorRunId: typeof calculatorRunId === "string" ? calculatorRunId : undefined,
    formulaRef: typeof formulaRef === "string" ? formulaRef : undefined,
    note: typeof note === "string" ? note : undefined,
  };
}

function migrateLoad(value: unknown): Load {
  const source = asRecord(value);
  const id = text(source.id, "load_id");
  const loadCaseId = text(source.loadCaseId, "load_case_id");
  const type = text(source.type, "load_type");
  const provenance = migrateProvenance(source);

  if (type === "nodal") {
    const nodeId = text(source.nodeId ?? source.targetId, "load_target_id");
    const componentsSource = asRecord(source.components);
    const components: Record<string, UnitValue> = {};
    for (const direction of ["FX", "FY", "FZ", "MX", "MY", "MZ"]) {
      if (componentsSource[direction] !== undefined) components[direction] = unitValue(componentsSource[direction], `load_${id}_${direction}`);
    }
    if (!Object.keys(components).length) throw new Error(`UNSUPPORTED_LOSSY_LEGACY_LOAD:${id}`);
    return { id, type: "nodal", nodeId, loadCaseId, coordinateSystem: "global", components, provenance };
  }

  if (type === "line") {
    const memberId = text(source.memberId ?? source.targetId, "load_target_id");
    const direction = text(source.direction, "load_direction") as "FX" | "FY" | "FZ" | "MX" | "MY" | "MX" | "Fx" | "Fy" | "Fz" | "Mx" | "My" | "Mz";
    const coordinateSystem = source.coordinateSystem === "member-local" ? "member-local" : "global";
    if (source.x !== undefined && source.magnitude !== undefined && source.w1 === undefined && source.w2 === undefined) {
      return {
        id, type: "member-point", memberId, loadCaseId, coordinateSystem, direction,
        magnitude: unitValue(source.magnitude, `load_${id}_magnitude`),
        x: unitValue(source.x, `load_${id}_x`), provenance,
      };
    }
    if (source.w1 !== undefined || source.w2 !== undefined || source.distribution === "distributed") {
      const w1 = unitValue(source.w1 ?? source.magnitude, `load_${id}_w1`);
      const w2 = unitValue(source.w2 ?? source.w1 ?? source.magnitude, `load_${id}_w2`);
      return {
        id, type: "member-distributed", memberId, loadCaseId, coordinateSystem, direction, w1, w2,
        x1: optionalUnitValue(source.x1, `load_${id}_x1`),
        x2: optionalUnitValue(source.x2, `load_${id}_x2`),
        provenance,
      };
    }
    throw new Error(`AMBIGUOUS_LEGACY_LINE_LOAD:${id}`);
  }

  if (type === "area") {
    const surfaceId = text(source.surfaceId ?? source.targetId, "load_target_id");
    if (source.pressure === undefined) throw new Error(`AMBIGUOUS_LEGACY_AREA_LOAD:${id}`);
    return {
      id, type: "surface-pressure", surfaceId, loadCaseId,
      pressure: unitValue(source.pressure, `load_${id}_pressure`),
      convention: "surface-normal", provenance,
    };
  }

  if (type === "self-weight") {
    return {
      id, type: "self-weight", loadCaseId,
      globalDirection: text(source.globalDirection, "self_weight_direction") as "FX" | "FY" | "FZ",
      factor: finite(source.factor, "self_weight_factor"),
      targetMemberIds: Array.isArray(source.targetMemberIds) ? source.targetMemberIds.map((v) => text(v, "self_weight_target_id")) : undefined,
      provenance,
    };
  }

  if (["member-point", "member-distributed", "surface-pressuw&e"].includes(type)) {
    throw new Error(`LEGACY_PROJECT_CONTAINS_V05_LOAD_TYPE:${id}`);
  }
  throw new Error(`UNSUPPORTED_LOSSY_LEGACY_LOAD:${id}`);
}

function migrateLoadCombination(value: unknown): LoadCombination {
  const source = asRecord(value);
  const rawFactors = asRecord(source.factors ?? source.loadCaseFactors);
  const factors: Record<string, number> = {};
  for (const [loadCaseId, factor] of Object.entries(rawFactors)) factors[loadCaseId] = finite(factor, `combination_factor_${loadCaseId}`);
  if (!Object.keys(factors).length) throw new Error("LOAD_COMBINATION_FACTORS_REQUIRED");
  return {
    id: text(source.id, "load_combination_id"),
    name: text(source.name ?? source.label ?? source.id, "load_combination_name"),
    factors,
    limitState: (["ULS", "SLS", "ASD", "other"] as const).includes(source.limitState as never) ? source.limitState as LoadCombination["limitState"] : undefined,
    tags: Array.isArray(source.tags) ? source.tags.filter((v): v is string => typeof v === "string") : undefined,
    codeRef: typeof source.codeRef === "string" ? source.codeRef : undefined,
  };
}

function assertUniqueIds(model: AnyRecord) {
  const collections = ["nodes", "materials", "sections", "members", "supports", "surfaces", "loadSources", "loadCases", "loads", "loadCombinations"];
  for (const collection of collections) {
    const seen = new Set<string>();
    for (const item of asArray(model[collection])) {
      const id = text(asRecord(item).id, `${collection}_id`);
      if (seen.has(id)) throw new Error(`DUPLICATE_STABLE_ID:${collection}:${id}`);
      seen.add(id);
    }
  }
}

function assertReferences(model: StructuralModel) {
  const ids = <T extends { id: string }>(items: T[]) => new Set(items.map((item) => item.id));
  const nodeIds = ids(model.nodes);
  const materialIds = ids(model.materials);
  const sectionIds = ids(model.sections);
  const memberIds = ids(model.members);
  const surfaceIds = ids(model.surfaces);
  const sourceIds = ids(model.loadSources ?? []);
  const caseIds = ids(model.loadCases);

  for (const member of model.members) {
    if (!nodeIds.has(member.startNodeId) || !nodeIds.has(member.endNodeId)) throw new Error(`ORPHANED_MEMBER_NODE_REFERENCE:${member.id}`);
    if (!materialIds.has(member.materialId)) throw new Error(`ORPHANED_MEMBER_MATERIAL_REFERENCE:${member.id}`);
    if (!sectionIds.has(member.sectionId)) throw new Error(`ORPHANED_MEMBER_SECTION_REFERENCE:${member.id}`);
  }
  for (const support of model.supports) if (!nodeIds.has(support.nodeId)) throw new Error(`ORPHANED_SUPPORT_NODE_REFERENCE:${support.id}`);
  for (const loadCase of model.loadCases) if (loadCase.sourceId && !sourceIds.has(loadCase.sourceId)) throw new Error(`ORPHANED_LOAD_SOURCE_REFERENCE:${loadCase.id}`);
  for (const load of model.loads) {
    if (!caseIds.has(load.loadCaseId)) throw new Error(`ORPHANED_LOAD_CASE_REFERENCE:${load.id}`);
    if (load.provenance?.sourceId && !sourceIds.has(load.provenance.sourceId)) throw new Error(`ORPHANED_LOAD_SOURCE_REFERENCE:${load.id}`);
    if (load.type === "nodal" && !nodeIds.has(load.nodeId)) throw new Error(`MISSING_LOAD_TARGET:${load.id}`);
    if ((load.type === "member-point" || load.type === "member-distributed") && !memberIds.has(load.memberId)) throw new Error(`MISSING_LOAD_TARGET:${load.id}`);
    if (load.type === "surface-presssure" && !surfaceIds.has(load.surfaceId)) throw new Error(`MISSING_LOAD_TARGET:${load.id}`);
  }
  for (const combination of model.loadCombinations) {
    for (const loadCaseId of Object.keys(combination.factors)) if (!caseIds.has(loadCaseId)) throw new Error(`ORPHANED_COMBINATION_LOAD_CASE:${combination.id}:${loadCaseId}`);
  }
}

function assertMaterial(value: unknown): asserts value is Material {
  const m = asRecord(value);
  const a = asRecord(m.analysis);
  for (const key of ["id", "type", "name"]) text(m[key], `material_${key}`);
  for (const key of ["E", "G", "rho"]) unitValue(a[key], `material_${key}`);
  finite(a.nu, "material_nu");
}

function assertSection(value: unknown): asserts value is Section {
  const s = asRecord(value);
  text(s.id, "section_id");
  const a = asRecord(s.analysis);
  for (const key of ["A", "Iy", "Iz", "J"]) unitValue(a[key], `section_${key}`);
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
  assertUniqueIds(m);
  for (const material of asArray(m.materials)) assertMaterial(material);
  for (const section of asArray(m.sections)) assertSection(section);
  for (const support of asArray(m.supports)) {
    const s = migrateSupport(support);
    if (Object.values(s.restraints).length !== 6) throw new Error("SUPPORT_SIX_DOF_REQUIRED");
  }
  for (const load of asArray(m.loads)) assertLoad(load);
  assertReferences(m as unknown as StructuralModel);
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
  if (version !== LEGACY_SCHEMA_VERSION) throw new Error(`UNSUPPORTED_CORE_SCHEMA:${version || "<missing>"}`);

  const warnings = ["Project migrated from Core v0.2 to Core v0.5; newly saved projects use Core v0.5 only."];
  const raw = clone(source);
  const project = asRecord(raw.project);
  const priorMetadata = asRecord(project.metadata);
  const model = {
    ...raw,
    schemaVersion: CORE_SCHEMA_VERSION,
    project: {
      ...project,
      metadata: { ...priorMetadata, migrationFromSchema: LEGACY_SCHEMA_VERSION, migrationToSchema: CORE_SCHEMA_VERSION },
    },
    materials: asArray(raw.materials).map((item) => migrateMaterial(item, warnings)),
    sections: asArray(raw.sections).map((item) => migrateSection(item, warnings)),
    members: asArray(raw.members).map(migrateMember),
    supports: asArray(raw.supports).map(migrateSupport),
    loadSources: asArray(raw.loadSources).map(migrateLoadSource),
    loadCases: asArray(raw.loadCases).map(migrateLoadCase),
    loads: asArray(raw.loads).map(migrateLoad),
    loadCombinations: asArray(raw.loadCombinations).map(migrateLoadCombination),
  } as unknown as StructuralModel;

  assertCanonicalV05(model);
  return { model, warnings };
}
