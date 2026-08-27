import type { CalculatorWriteback, Load, LoadSource, SurfacePressureLoad } from "@linkoteq/structural-core";

export type SnowV05Writeback = CalculatorWriteback & {
  projectId?: string;
  targetIds?: string[];
};

export function assertCanonicalLoad(load: Load): void {
  if (!load.id || !load.loadCaseId) {
    throw new Error("CORE_V05_LOAD_IDENTITY_REQUIRED");
  }
  if (load.type === "nodal" && !load.nodeId) {
    throw new Error("NODAL_TARGET_REQUIRED");
  }
  if ((load.type === "member-point" || load.type === "member-distributed") && !load.memberId) {
    throw new Error("MEMBER_TARGET_REQUIRED");
  }
  if (load.type === "surface-pressure") {
    if (!load.surfaceId || !load.pressure.unit) {
      throw new Error("SURFACE_PRESSURE_TARGET_OR_UNIT_REQUIRED");
    }
  }
  if (load.type === "self-weight" && !load.globalDirection) {
    throw new Error("SELF_WEIGHT_DIRECTION_REQUIRED");
  }
}

export function mapSnowWriteback(
  data: SnowV05Writeback,
  expectedTargetIds: string[],
): { loads: SurfacePressureLoad[]; loadSources: LoadSource[] } {
  if (data.modelSchemaVersion !== "0.5") {
    throw new Error("SNOW_CORE_VERSION_MISMATCH");
  }

  const expected = new Set(expectedTargetIds);
  const loads = (data.loads ?? []).map((load) => {
    assertCanonicalLoad(load);
    if (load.type !== "surface-pressure") {
      throw new Error("SNOW_LOAD_MUST_BE_SURFACE_PRESSURE");
    }
    if (!expected.has(load.surfaceId)) {
      throw new Error(`LOSSY_SNOW_SURFACE_MAPPING:${load.surfaceId}`);
    }
    if (!load.provenance?.sourceId || !load.provenance?.calculatorRunId) {
      throw new Error(`SNOW_PROVENANCE_REQUIRED:${load.id}`);
    }
    return load;
  });

  const mapped = new Set(loads.map((load) => load.surfaceId));
  if (
    mapped.size !== expected.size ||
    [...expected].some((surfaceId) => !mapped.has(surfaceId))
  ) {
    throw new Error("LOSSY_SNOW_SURFACE_MAPPING");
  }

  return {
    loads,
    loadSources: data.loadSources ?? [],
  };
}
