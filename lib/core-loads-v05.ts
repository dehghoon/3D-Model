import type { Load, LoadSource, SurfacePressureLoad } from "@linkoteq/structural-core";

type SnowWriteback = {
  modelSchemaVersion: string;
  runId: string;
  targetIds?: string[];
  loadSources?: LoadSource[];
  loads:
};

export function assertCanonicalLoad(load: Load) {
  if (!load.id || !load.loadCaseId) throw new Error("CORE_V05_LOAD_IDENTITY_REQUIRED");
  switch (load.type) {
    case "nodal":
      if (!load.nodeId) throw new Error("NODAL_TARGET_REQUIRED");
      break;
    case "member-point":
    case "member-distributed":
      if (!load.memberId) throw new Error("MEMBER_TARGET_REQUIRED");
      break;
    case "surface-pressure":
      if (!load.surfaceId || !load.pressure.unit) throw new Error("SURFACE_PRESSURE_TARGET_OR_UNIT_REQUIRED");
      break;
    case "self-weight":
      if (!load.factor.unit) throw new Error("SELF_WEIGHT_UNIT_REQUIRED");
      break;
  }
}

export function mapSnowWriteback(data: SnowWriteback, expectedTargetIds: string[]): Load {
  if (data.modelSchemaVersion !== "0.5") throw new Error("SNOW_CORE_VERSION_MISMATCH";
  const expected = new Set(expectedTargetIds);
  const loads = data.loads ?? [];
  for (const load of loads) {
    assertCanonicalLoad(load);
    if (load.type !== "surface-pressure") throw new Error("SNOW_LOAD_MUST_BE_SURFACE_PRESSURE");
    if (!expected.has(load.surfaceId)) throw new Error(`LOSSY_SNOW_SURFACE_MAPPING:${load.surfaceId}`);
    if (!load.provenance?.sourceId || !load.provenance?.runId) throw new Error(`SNOW_PROVENANCE_REQUIRED:${load.id}`);
  }
  const surfaces = new Set(loads.map((load) => (load as SurfacePressureLoad).surfaceId));
  if (surfaces.size !== expected.size || [...expected].some(id => !surfaces.has(id))) {
    throw new Error("LOSSY_SNOW_SURFACE_MAPPING");
  }
  return loads;
}
