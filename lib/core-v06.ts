import type { StructuralModel } from "@linkoteq/structural-core";

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Validate the editor's Core 0.6 exchange boundary without stripping
 * optional Core fields or importer-specific preserved information.
 * This is structural input validation, not engineering verification.
 */
export function assertCanonicalV06(value: unknown): asserts value is StructuralModel {
  if (!isRecord(value) || value.schemaVersion !== "0.6") {
    throw new Error("CORE_V06_REQUIRED");
  }
  if (!isRecord(value.project) || typeof value.project.id !== "string" ||
      typeof value.project.name !== "string" ||
      !["SI", "US"].includes(String(value.project.units))) {
    throw new Error("CORE_V06_PROJECT_REQUIRED");
  }
  const requiredArrays = [
    "levels", "grids", "nodes", "members", "surfaces", "diaphragms",
    "materials", "sections", "supports", "loadCases", "loads", "loadCombinations",
  ] as const;
  for (const field of requiredArrays) {
    if (!Array.isArray(value[field])) {
      throw new Error(`CORE_V06_${field.toUpperCase()}_REQUIRED`);
    }
  }
  for (const field of requiredArrays) {
    const ids = new Set<string>();
    for (const item of value[field] as unknown[]) {
      if (!isRecord(item) || typeof item.id !== "string" || !item.id) {
        throw new Error(`CORE_V06_${field.toUpperCase()}_ID_REQUIRED`);
      }
      if (ids.has(item.id)) throw new Error(`CORE_V06_${field.toUpperCase()}_DUPLICATE_ID`);
      ids.add(item.id);
    }
  }
}

/** Accept only native Core 0.6 models; no legacy conversion or data loss. */
export function readProjectV06(input: unknown): StructuralModel {
  const candidate = isRecord(input) && input.format === "linkoteq-project"
    ? input.model
    : input;
  assertCanonicalV06(candidate);
  return candidate;
}
