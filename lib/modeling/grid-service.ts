import type { GridLine, StructuralModel, Vec3 } from "@linkoteq/structural-core";

import { assertCanonicalV05 } from "../core-v05";

export interface CreateGridLineInput {
  label: string;
  start: Vec3;
  end: Vec3;
}

export interface UpdateGridLineInput {
  label: string;
  start: Vec3;
  end: Vec3;
}

export interface GridMutationResult {
  model: StructuralModel;
  grid: GridLine;
}

function requireGridId(value: string): string {
  const id = value.trim();
  if (!id) throw new Error("GRID_ID_REQUIRED");
  return id;
}

function requireGridLabel(value: string): string {
  const label = value.trim();
  if (!label) throw new Error("GRID_LABEL_REQUIRED");
  return label;
}

function assertFinitePoint(value: Vec3, code: string): void {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(code);
  }
}

function normalizeGridInput(
  input: CreateGridLineInput | UpdateGridLineInput,
): Omit<GridLine, "id"> {
  const label = requireGridLabel(input.label);
  assertFinitePoint(input.start, "GRID_START_MUST_BE_FINITE");
  assertFinitePoint(input.end, "GRID_END_MUST_BE_FINITE");

  if (
    input.start.x === input.end.x &&
    input.start.y === input.end.y &&
    input.start.z === input.end.z
  ) {
    throw new Error("GRID_DISTINCT_POINTS_REQUIRED");
  }

  return {
    label,
    start: { ...input.start },
    end: { ...input.end },
  };
}

function nextGridId(model: StructuralModel): string {
  const used = new Set(model.grids.map((grid) => grid.id));
  let index = 1;
  while (used.has(`G${index}`)) index += 1;
  return `G${index}`;
}

export function createGridLine(
  model: StructuralModel,
  input: CreateGridLineInput,
): GridMutationResult {
  assertCanonicalV05(model);

  const grid: GridLine = {
    id: nextGridId(model),
    ...normalizeGridInput(input),
  };

  const nextModel: StructuralModel = {
    ...model,
    grids: [...model.grids, grid],
  };
  assertCanonicalV05(nextModel);

  return { model: nextModel, grid };
}

export function updateGridLine(
  model: StructuralModel,
  gridId: string,
  input: UpdateGridLineInput,
): GridMutationResult {
  assertCanonicalV05(model);

  const id = requireGridId(gridId);
  const existing = model.grids.find((grid) => grid.id === id);
  if (!existing) throw new Error(`UNKNOWN_GRID:${id}`);

  const grid: GridLine = {
    id: existing.id,
    ...normalizeGridInput(input),
  };

  const nextModel: StructuralModel = {
    ...model,
    grids: model.grids.map((item) => (item.id === id ? grid : item)),
  };
  assertCanonicalV05(nextModel);

  return { model: nextModel, grid };
}

export function deleteGridLine(
  model: StructuralModel,
  gridId: string,
): StructuralModel {
  assertCanonicalV05(model);

  const id = requireGridId(gridId);
  if (!model.grids.some((grid) => grid.id === id)) {
    throw new Error(`UNKNOWN_GRID:${id}`);
  }

  const nextModel: StructuralModel = {
    ...model,
    grids: model.grids.filter((grid) => grid.id !== id),
  };
  assertCanonicalV05(nextModel);

  return nextModel;
}
