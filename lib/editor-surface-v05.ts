import type { StructuralModel, Surface, SurfaceType } from "@linkoteq/structural-core";

export interface CreateSurfaceInput {
  type: SurfaceType;
  boundaryNodeIds: string[];
  levelId?: string;
  materialId?: string;
}

function nextSurfaceId(surfaces: Surface[]): string {
  const used = new Set(surfaces.map((surface) => surface.id));
  let index = 1;
  while (used.has(`S${index}`)) index += 1;
  return `S${index}`;
}

function optionalId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function createSurfaceFromCanonicalRefs(
  model: StructuralModel,
  input: CreateSurfaceInput,
): { model: StructuralModel; surface: Surface } {
  if (model.schemaVersion !== "0.5") {
    throw new Error(`CORE_V05_REQUIRED:${model.schemaVersion}`);
  }

  const boundaryNodeIds = input.boundaryNodeIds.map((id) => id.trim());
  if (boundaryNodeIds.length < 3) {
    throw new Error("SURFACE_AT_LEAST_THREE_NODES_REQUIRED");
  }
  if (boundaryNodeIds.some((id) => !id)) {
    throw new Error("SURFACE_NODE_ID_REQUIRED");
  }
  if (new Set(boundaryNodeIds).size !== boundaryNodeIds.length) {
    throw new Error("SURFACE_BOUNDARY_NODES_MUST_BE_DISTINCT");
  }

  for (const nodeId of boundaryNodeIds) {
    if (!model.nodes.some((node) => node.id === nodeId)) {
      throw new Error(`UNKNOWN_SURFACE_NODE:${nodeId}`);
    }
  }

  const levelId = optionalId(input.levelId);
  if (levelId && !model.levels.some((level) => level.id === levelId)) {
    throw new Error(`UNKNOWN_SURFACE_LEVEL:${levelId}`);
  }

  const materialId = optionalId(input.materialId);
  if (materialId && !model.materials.some((material) => material.id === materialId)) {
    throw new Error(`UNKNOWN_SURFACE_MATERIAL:${materialId}`);
  }

  const surface: Surface = {
    id: nextSurfaceId(model.surfaces),
    type: input.type,
    boundaryNodeIds,
    ...(levelId ? { levelId } : {}),
    ...(materialId ? { materialId } : {}),
  };

  return {
    model: { ...model, surfaces: [...model.surfaces, surface] },
    surface,
  };
}
