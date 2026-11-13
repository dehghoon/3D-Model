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
  if (model.schemaVersion !== "0.6") {
    throw new Error(`CORE_V06_REQUIRED:${model.schemaVersion}`);
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


/** Update a native or SAP-imported Area without changing its source provenance. */
export function updateSurfaceBoundaryFromCanonicalRefs(
  model: StructuralModel,
  surfaceId: string,
  boundaryNodeIds: string[],
): {model:StructuralModel;surface:Surface} {
  if (model.schemaVersion !== "0.6") throw new Error(`CORE_V06_REQUIRED:${model.schemaVersion}`);
  const index=model.surfaces.findIndex(s=>s.id===surfaceId);
  if (index<0) throw new Error(`UNKNOWN_SURFACE:${surfaceId}`);
  const nodes=boundaryNodeIds.map(id=>id.trim());
  if (nodes.length<3) throw new Error("SURFACE_AT_LEAST_THREE_NODES_REQUIRED");
  if (nodes.some(id=>!id) || new Set(nodes).size!==nodes.length)
    throw new Error("SURFACE_BOUNDARY_NODES_MUST_BE_DISTINCT");
  const known=new Set(model.nodes.map(n=>n.id));
  for (const id of nodes) if (!known.has(id)) throw new Error(`UNKNOWN_SURFACE_NODE:${id}`);
  const surface={...model.surfaces[index],boundaryNodeIds:nodes,
    metadata:{...model.surfaces[index].metadata,
      ...(model.surfaces[index].metadata?.sourceFormat==="SAP2000"
        ? {geometryOnly:true,engineeringValidationRequired:true} : {})}};
  const surfaces=[...model.surfaces];
  surfaces[index]=surface;
  return {model:{...model,surfaces},surface};
}

export function deleteSurfaceFromCanonicalRefs(
  model:StructuralModel,surfaceId:string,
):StructuralModel {
  if (model.schemaVersion!=="0.6") throw new Error(`CORE_V06_REQUIRED:${model.schemaVersion}`);
  if (!model.surfaces.some(s=>s.id===surfaceId)) throw new Error(`UNKNOWN_SURFACE:${surfaceId}`);
  return {...model,surfaces:model.surfaces.filter(s=>s.id!==surfaceId)};
}
