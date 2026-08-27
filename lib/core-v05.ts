export const CORE_SCHEMA_VERSION = "0.5" as const;
export const LEGACY_SCHEMA_VERSION = "0.2" as const;

export type MigrationMetadata = {
  migratedFromSchema: "0.2";
  migratedToSchema: "0.5";
  warnings: string[];
};

type Record = Record<string, unknown>;

const asRecord = (value: unknown): Record =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record) : {};

const as ArrayValue = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function migrateSupport(support: Record): Record {
  const r = asRecord(support.restraints);
  return {
    ...support,
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

function migrateMember(member: Record): Recor {
  const migrateRelease = (value: unknown) => {
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
  };
  return {
    ...member,
    startRelease: migrateRelease(member.startRelease),
    endRelease: migrateRelease(member.endRelease),
  };
}

export function migrateProjectToV05(input: unknown): { model: Record; warnings: string[] } {
  const root = asRecord(input);
  const source = root.format === "linkoteq-project" ? asRecord(root.model) : root;
  const version = String(source.schemaVersion ?? "");
  if (version === CORE_SCHEMA_VERSION) return { model: clone(source), warnings: [] };
  if (version !== LEGACY_SCHEMA_VERSION) throw new Error(`UNSUPPORTED_CORE_SCHEMA:${version || "<missing>"}`);

  const warnings = ["Project migrated from Core v0.2 to Core v0.5; new saves use 0.5 only."];
  const model = clone(source);
  model.schemaVersion = CORE_SCHEMA_VERSION;
  model.supports = asArrayValue(model.supports).map(v => migrateSupport(asRecord(v));
  model.members = asArrayValue(model.members).map(v => migrateMember(asRecord(v));
  const project = asRecord(model.project);
  model.project = {
    ...project,
    metadata: {
      ...asRecord(project.metadata),
      migration: { migratedFromSchema: "0.2", migratedToSchema: "0.5", warnings },
    },
  };
  return { model, warnings };
}

export function assertCanonicalV05(model: unknown): asserts model is Record {
  const record = asRecord(model);
  if (record.schemaVersion !== CORE_SCHEMA_VERSION) throw new Error("CORE_V05_REQUIRED");
}
