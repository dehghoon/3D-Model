import type {
  GridLine,
  Member,
  Node,
  StructuralModel,
  Support,
  Surface,
  Vec3,
} from "@linkoteq/structural-core";

import { assertCanonicalV05 } from "./core-v05";
import {
  createGridLine,
  createLevel,
  createMemberFromCanonicalRefs,
  createNodeFromGlobalCoordinates,
  type CreateGridLineInput,
  type CreateLevelInput,
  type CreateMemberInput,
  type CreateNodeInput,
} from "./editor-modeling-v05";
import {
  createSurfaceFromCanonicalRefs,
  type CreateSurfaceInput,
} from "./editor-surface-v05";
import {
  createSupportFromCanonicalNode,
  type CreateSupportInput,
} from "./editor-support-v05";

export const MODELING_CORE_SCHEMA_VERSION = "0.5" as const;

export type ModelingMutation<T> = {
  model: StructuralModel;
  entity: T;
};

function assertFiniteVec3(value: Vec3, code: string): void {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(code);
  }
}

function assertModelingModel(model: StructuralModel): void {
  assertCanonicalV05(model);
}

export function createCanonicalNodeV05(
  model: StructuralModel,
  input: CreateNodeInput,
): ModelingMutation<Node> {
  assertModelingModel(model);
  const result = createNodeFromGlobalCoordinates(model, input);
  assertModelingModel(result.model);
  return { model: result.model, entity: result.node };
}

export function createCanonicalLevelV05(
  model: StructuralModel,
  input: CreateLevelInput,
) {
  assertModelingModel(model);
  const result = createLevel(model, input);
  assertModelingModel(result.model);
  return { model: result.model, entity: result.level };
}

export function createCanonicalGridV05(
  model: StructuralModel,
  input: CreateGridLineInput,
): ModelingMutation<GridLine> {
  assertModelingModel(model);
  const result = createGridLine(model, input);
  assertModelingModel(result.model);
  return { model: result.model, entity: result.grid };
}

export function createCanonicalMemberV05(
  model: StructuralModel,
  input: CreateMemberInput,
): ModelingMutation<Member> {
  assertModelingModel(model);
  const result = createMemberFromCanonicalRefs(model, input);
  assertModelingModel(result.model);
  return { model: result.model, entity: result.member };
}

export function createCanonicalSurfaceV05(
  model: StructuralModel,
  input: CreateSurfaceInput,
): ModelingMutation<Surface> {
  assertModelingModel(model);
  const result = createSurfaceFromCanonicalRefs(model, input);
  assertModelingModel(result.model);
  return { model: result.model, entity: result.surface };
}

export function createCanonicalSupportV05(
  model: StructuralModel,
  input: CreateSupportInput,
): ModelingMutation<Support> {
  assertModelingModel(model);
  const result = createSupportFromCanonicalNode(model, input);
  assertModelingModel(result.model);
  return { model: result.model, entity: result.support };
}

export function updateCanonicalNodePositionV05(
  model: StructuralModel,
  nodeId: string,
  position: Vec3,
): ModelingMutation<Node> {
  assertModelingModel(model);
  assertFiniteVec3(position, "NODE_COORDINATES_MUST_BE_FINITE");

  const id = nodeId.trim();
  if (!id) throw new Error("NODE_ID_REQUIRED");

  const existing = model.nodes.find((node) => node.id === id);
  if (!existing) throw new Error(`UNKNOWN_NODE:${id}`);

  const entity: Node = {
    ...existing,
    position: { x: position.x, y: position.y, z: position.z },
  };

  const next: StructuralModel = {
    ...model,
    nodes: model.nodes.map((node) => (node.id === id ? entity : node)),
  };

  assertModelingModel(next);
  return { model: next, entity };
}

export function updateCanonicalGridGeometryV05(
  model: StructuralModel,
  gridId: string,
  input: Pick<CreateGridLineInput, "label" | "start" | "end">,
): ModelingMutation<GridLine> {
  assertModelingModel(model);

  const id = gridId.trim();
  if (!id) throw new Error("GRID_ID_REQUIRED");

  const existing = model.grids.find((grid) => grid.id === id);
  if (!existing) throw new Error(`UNKNOWN_GRID:${id}`);

  const label = input.label.trim();
  if (!label) throw new Error("GRID_LABEL_REQUIRED");
  assertFiniteVec3(input.start, "GRID_START_MUST_BE_FINITE");
  assertFiniteVec3(input.end, "GRID_END_MUST_BE_FINITE");

  if (
    input.start.x === input.end.x &&
    input.start.y === input.end.y &&
    input.start.z === input.end.z
  ) {
    throw new Error("GRID_DISTINCT_POINTS_REQUIRED");
  }

  const entity: GridLine = {
    ...existing,
    label,
    start: { ...input.start },
    end: { ...input.end },
  };

  const next: StructuralModel = {
    ...model,
    grids: model.grids.map((grid) => (grid.id === id ? entity : grid)),
  };

  assertModelingModel(next);
  return { model: next, entity };
}

export function assertModelingFoundationV05(model: StructuralModel): void {
  assertModelingModel(model);

  for (const node of model.nodes) {
    assertFiniteVec3(node.position, `NODE_COORDINATES_MUST_BE_FINITE:${node.id}`);
  }

  for (const grid of model.grids) {
    assertFiniteVec3(grid.start, `GRID_START_MUST_BE_FINITE:${grid.id}`);
    assertFiniteVec3(grid.end, `GRID_END_MUST_BE_FINITE:${grid.id}`);
    if (
      grid.start.x === grid.end.x &&
      grid.start.y === grid.end.y &&
      grid.start.z === grid.end.z
    ) {
      throw new Error(`GRID_DISTINCT_POINTS_REQUIRED:${grid.id}`);
    }
  }
}
