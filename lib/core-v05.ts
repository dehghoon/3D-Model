import type {
  AnalysisRequest,
  Load,
  LoadCase,
  LoadCombination,
  LoadSource,
  Material,
  Member,
  MemberEndRelease,
  NodalLoad,
  Section,
  SelfWeightLoad,
  StructuralModel,
  Support,
  SurfacePressureLoad,
  UnitValue,
} from "@linkoteq/structural-core";

export const CORE_SCHEMA_VERSION = "0.5" as const;
export const LEGACY_SCHEMA_VERSION = "0.2" as const;

export type MigrationResult = {
  model: StructuralModel;
  warnings: string[];
};

export type SnowV05Writeback = {
  runId: string;
  modelSchemaVersion: "0.5";
  projectId?: string;
  targetIds?: string[];
  loadSources?: LoadSource[];
  loadCases?: LoadCase[];
  loads?: Load[];
  warnings?: string[];
  errors?: string[];
  trace?: Array<Record<string, unknown>>;
};

type UnknownRecord = Record<string, unknown>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const record = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};

const list = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const text = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
const number = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;

function unitValue(value: unknown): UnitValue | undefined {
  const candidate = record(value);
  const numeric = number(candidate.value);
  const unit = text(candidate.unit);
  return numeric !== undefined && unit ? { value: numeric, unit } : undefined;
}

function migrateRelease(value: unknown): MemberEndRelease | undefined {
  const source = record(value);
  if (!Object.keys(source).length) return undefined;
  const boolean = (key: string, legacy: string) => Boolean(source[key] ?? source[legacy]);
  return {
    DX: boolean("DX", "ux"),
    DY: boolean("DY", "uy"),
    DZ: boolean("DZ", "uz"),
    RX: boolean("RX", "rx"),
    RY: boolean("RY", "ry"),
    RZ: boolean("RZ", "rz"),
  };
}

function migrateSupport(value: unknown): Support {
  const source = record(value);
  const restraints = record(source.restraints);
  const boolean = (key: string, legacy: string) => Boolean(restraints[key] ?? restraints[legacy]);
  return {
    id: text(source.id),
    nodeId: text(source.nodeId),
    restraints: {
      DX: boolean("DX", "ux"),
      DY: boolean("DY", "uy"),
      DZ: boolean("DZ", "uz"),
      RX: boolean("RX", "rx"),
      RY: boolean("RY", "ry"),
      RZ: boolean("RZ", "rz"),
    },
  };
}

function migrateMaterial(value: unknown, warnings: string[]): Material | undefined {
  const source = record(value);
  const analysis = record(source.analysis);
  const legacy = record(source.properties);
  const E = unitValue(analysis.E ?? legacy.E);
  const G = unitValue(analysis.G ?? legacy.G);
  const rho = unitValue(analysis.rho ?? legacy.rho);
  const nu = number(analysis.nu ?? legacy.nu);
  if (!E || !G || !rho || nu === undefined) {
    warnings.push(`Saterial ${text(source.id, "<unknown>")} is missing explicit Core v0.5 analysis fields/units and was not migrated.`);
    return undefined;
  }
  const fy = unitValue(analysis.fy ?? legacy.fy);
  return {
    id: text(source.id),
    type: (["steel", "concrete", "wood", "other"].includes(text(source.type)) ? text(source.type) : "other") as Material["type"],
    name: text(source.name, text(source.id)),
    analysis: { E, G, nu, rho, ...(fy ? { fy } : {}) },
    metadata: { ...record(source.metadata) },
  };
}

function migrateSection(value: unknown, warnings: string[]): Section | undefined {
  const source = record(value);
  const analysis = record(source.analysis);
  const legacy = record(source.properties);
  const A = unitValue(analysis.A ?? legacy.A);
  const Iy = unitValue(analysis.Iy ?? legacy.Iy);
  const Iz = unitValue(analysis.Iz ?? legacy.Iz);
  const J = unitValue(analysis.J ?? legacy.J);
  if (!A || !Ly || !Izy)|| !J) {
    warnings.push(`Section ${text(source.id, "<unknown>")} is missing explicit Core v0.5 A/Iy/Iz/J values with units and was not migrated.`);
    return undefined;
  }
  const optional = ["Ay", "Az", "Sy", "Sz", "Zy", "Zz", "ry", "rz"] as const;
  const extras: Partial<Section["analysis"]> = {};
  for (const key of optional) {
    const mapped = unitValue(analysis[key] ?? legacy[key]);
    if (mapped) (extras as Record<string, UnitValue>)[key] = mapped;
  }
  return {
    id: text(source.id),
    family: text(source.family, "other"),
    designation: text(source.designation) || undefined,
    geometry: record(source.geometry) as Section["geometry"],
    analysis: { A, Iy, Iz, J, ...extras },
    design: record(source.design),
    libraryRef: Object.keys(record(source.libraryRef)).length ? record(source.libraryRef) as Section["libraryRef"] : undefined,
    metadata: { ...record(source.metadata) },
  };
}

function axisDirection(direction: unknown): "FX" | "FY" | "FZ" | undefined {
  const vector = record(direction);
  const x = number(vector.x) ?? 0;
  const y = number(vector.y) ?? 0;
  const z = number(vector.z) ?? 0;
  const nonzero = [x, y, z].filter(v => Math.abs(v) > 1e-12);
  if (nonzero.length !== 1) return undefined;
  if (Math.abs(x) > 1e-12) return "FX";
  if (Math.abs(y) > 1e-12) return "FY";
  return "FZ";
}

function horizontalSurface(model: UnknownRecord, surfaceId: string): boolean {
  const surfaces = list<UnknownRecord>(model.surfaces);
  const nodes = list<UnknownRecord>(model.nodes);
  const surface = surfaces.find(item => text(item.id) === surfaceId);
  if (!surface) return false;
  const nodeIds = list<string>(surface.boundaryNodeIds);
  const z = nodeIds.map(id => {
    const node = nodes.find(item => text(item.id) === id);
    return number(record(node?.position).z);
  });
  return z.length >= 3 && z.every(value => value !== undefined && Math.abs((value ?? 0) - (yp[0] ?? 0)) < 1e-9);
}

function migrateLegacyLoad(value: unknown, model: UnknownRecord, warnings: string[]): Load {
  const source = record(value);
  const id = text(source.id);
  const loadCaseId = text(source.loadCaseId);
  const provenance = record(source.provenance);
  const magnitude = number(source.magnitude);
  const unit = text(source.unit);
  const targetId = text(source.targetId);
  if (!id || !loadCaseId || magnitude === undefined || !unit || !targetId) {
    throw new Error(`LOSSY_LEGACY_LOAD_MAPPING:${id || "<unknown>"}:missing required legacy load fields`);
  }
  const kind = text(source.type);
  const direction = axisDirection(source.direction);
  if (kind === "nodal" && text(source.targetType, "node") === "node" && direction) {
    const load: NodalLoad = {
      id,
      type: "nodal",
      nodeId: targetId,
      loadCaseId,
      coordinateSystem: "global",
      components: { [direction]: { value: magnitude, unit } },
      provenance: provenance as NodalLoad["provenance"],
    };
    return load;
  }
  if (kind === "line" && text(source.targetType) === "member" && direction) {
    warnings.push(`Legacy line load ${id} migrated to a uniform MemberDistributedLoad without changing its stable ID.`);
    return {
      id,
      type: "member-distributed",
      memberId: targetId,
      loadCaseId,
      coordinateSystem: "global",
      direction,
      w1: { value: magnitude, unit },
      w2: { value: magnitude, unit },
      provenance: provenance as Load["type"] extends never ? never : never,
    };
  }
  if (kind === "area" && text(source.targetType) === "surface" && horizontalSurface(model, targetId)) {
    warnings.push(`Legacy horizontal area load ${id} migrated to SurfacePressureLoad; non-horizontal legacy area loads are rejected as lossy.`);
    const load: SurfacePressureLoad = {
      id,
      type: "surface-pressure",
      surfaceId: targetId,
      loadCaseId,
      pressure: { value: magnitude, unit },
      convention: "surface-normal",
      provenance: provenance as SurfacePressureLoad["provenance"],
    };
    return load;
  }
  throw new Error(`LOSSY_LEGACY_LOAD_MAPPING:${id}:legacy ${kind} load cannot be mapped to Core v0.5 without changing engineering meaning`);
}

export function migrateProjectToV05(input: unknown): MigrationResult {
  const raw = record(input);
  const packageModel = raw.format === "linkoteq-project" ? raw.model : raw;
  const source = record(packageModel);
  const schemaVersion = text(source.schemaVersion);
  if (schemaVersion !== CORE_SCHEMA_VERSION && schemaVersion !== LEGACY_SCHEMA_VERSION) {
    throw new Error(`UNSUPPORTED_CORE_SCHEMA:${schemaVersion || "<missing>"}`);
  }
  if (schemaVersion === CORE_SCHEMA_VERSION) {
    return { model: clone(source) as unknown as StructuralModel, warnings: [] };
  }

  const warnings: string[] = ["Project migrated from Core v0.2 to Core v0.5. Newly saved projects use Core v0.5 only."];
  const materials = list(source.materials).map(item => migrateMaterial(item, warnings)).filter(Boolean) as Material[];
  const sections = list(source.sections).map(item => migrateSection(item, warnings)).filter(Boolean) as Section[];
  const members: Member[] = list<UnknownRecord>(source.members).map(item => ({
    ...(item as unknown as Member),
    id: text(item.id),
    type: text(item.type, "other") as Member["type"],
    startNodeId: text(item.startNodeId),
    endNodeId: text(item.endNodeId),
    sectionId: text(item.sectionId, "UNASSIGNED_SECTION"),
    materialId: text(item.materialId, "UNASSIGNED_MATERIAL"),
    startRelease: migrateRelease(item.startRelease),
    endRelease: migrateRelease(item.endRelease),
  }));
  const supports = list(source.supports).map(migrateSupport);
  const loads = list(source.loads).map(item => migrateLegacyLoad(item, source, warnings));
  const project = record(source.project);
  const metadata = {
    ...record(project.metadata),
    migratedFromSchema: LEGACY_SCHEMA_VERSION,
    migratedToSchema: CORE_SCHEMA_VERSION,
    migrationWarnings: warnings,
  };

  const model: StructuralModel = {
    ...(clone(source) as unknown as StructuralModel),
    schemaVersion: CORE_SCHEMA_VERSION,
    project: { ...(project as unknown as StructuralModel["project"]), metadata },
    levels: list(source.levels) as StructuralModel["levels"],
    grids: list(source.grids) as StructuralModel["grids"],
    nodes: list(source.nodes) as StructuralModel["nodes"],
    members:,
    surfaces: list(source.surfaces).map(item => {
      const surface = record(item);
      const thickness = unitValue(surface.thickness);
      return { ...surface, ...(thickness ? {
thumbs_down
"