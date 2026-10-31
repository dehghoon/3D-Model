import type { Diaphragm, StructuralModel } from "@linkoteq/structural-core";

export function assignDiaphragm(
  model: StructuralModel,
  input: { id: string; type: Diaphragm["type"]; levelId: string; surfaceIds: string[]; nodeIds: string[] },
): StructuralModel {
  const id = input.id.trim();
  if (!id) throw new Error("DIAPHRAGM_ID_REQUIRED");
  if (input.type !== "rigid" && input.type !== "semi-rigid") throw new Error("INVALID_DIAPHRAGM_TYPE");
  if (!model.levels.some((level) => level.id === input.levelId)) throw new Error("UNKNOWN_DIAPHRAGM_LEVEL");
  if (!input.surfaceIds.length && !input.nodeIds.length) throw new Error("DIAPHRAGM_TARGET_REQUIRED");
  if (new Set(input.surfaceIds).size !== input.surfaceIds.length || new Set(input.nodeIds).size !== input.nodeIds.length) {
    throw new Error("DUPLICATE_DIAPHRAGM_TARGET");
  }
  for (const id of input.surfaceIds) {
    const surface = model.surfaces.find((item) => item.id === id);
    if (!surface) throw new Error(`UNKNOWN_DIAPHRAGM_SURFACE:${id}`);
    if (surface.levelId !== input.levelId) throw new Error(`DIAPHRAGM_SURFACE_LEVEL_MISMATCH:${id}`);
  }
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  for (const id of input.nodeIds) {
    const node = model.nodes.find((item) => item.id === id);
    if (!nodeIds.has(id) || !node) throw new Error(`UNKNOWN_DIAPHRAGM_NODE:${id}`);
    if (node.levelId !== input.levelId) throw new Error(`DIAPHRAGM_NODE_LEVEL_MISMATCH:${id}`);
  }
  const diaphragm: Diaphragm = { id, type: input.type, levelId: input.levelId, surfaceIds: [...input.surfaceIds], nodeIds: [...input.nodeIds] };
  const existing = model.diaphragms.find((item) => item.id === id);
  if (existing && existing.levelId !== input.levelId) throw new Error("DIAPHRAGM_LEVEL_CHANGE_REQUIRES_EXPLICIT_REMOVAL");
  return { ...model, diaphragms: [...model.diaphragms.filter((item) => item.id !== id), diaphragm] };
}
