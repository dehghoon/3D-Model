import type { GridLine, StructuralModel } from "@linkoteq/structural-core";

import {
  createGridLine,
  deleteGridLine,
  updateGridLine,
} from "./grid-service";

export interface OrthogonalGridSystemInput {
  xCount: number;
  xSpacing: number;
  yCount: number;
  ySpacing: number;
  originX?: number;
  originY?: number;
}

export interface OrthogonalGridSystemSnapshot {
  xCount: number;
  xSpacing: number;
  yCount: number;
  ySpacing: number;
  originX: number;
  originY: number;
}

type Axis = "x" | "y";

interface AxisGrid {
  axis: Axis;
  position: number;
  grid: GridLine;
}

function requireCount(value: number, code: string): number {
  if (!Number.isInteger(value) || value < 2) throw new Error(code);
  return value;
}

function requireSpacing(value: number, code: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(code);
  return value;
}

function alphaLabel(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function classifyGrid(grid: GridLine): AxisGrid | null {
  const atZero =
    Math.abs(grid.start.z) < 1e-9 &&
    Math.abs(grid.end.z) < 1e-9;

  if (!atZero) return null;

  if (
    Math.abs(grid.start.x - grid.end.x) < 1e-9 &&
    Math.abs(grid.start.y - grid.end.y) > 1e-9
  ) {
    return { axis: "x", position: grid.start.x, grid };
  }

  if (
    Math.abs(grid.start.y - grid.end.y) < 1e-9 &&
    Math.abs(grid.start.x - grid.end.x) > 1e-9
  ) {
    return { axis: "y", position: grid.start.y, grid };
  }

  return null;
}

function axisGrids(model: StructuralModel, axis: Axis): AxisGrid[] {
  return model.grids
    .map(classifyGrid)
    .filter((item): item is AxisGrid => Boolean(item) && item.axis === axis)
    .sort((a, b) => a.position - b.position);
}

function spacingFrom(items: AxisGrid[]): number {
  if (items.length < 2) return 0;
  return items[1].position - items[0].position;
}

export function inspectOrthogonalGridSystem(
  model: StructuralModel,
): OrthogonalGridSystemSnapshot | null {
  const xItems = axisGrids(model, "x");
  const yItems = axisGrids(model, "y");

  if (xItems.length < 2 || yItems.length < 2) return null;

  const xSpacing = spacingFrom(xItems);
  const ySpacing = spacingFrom(yItems);

  if (xSpacing <= 0 || ySpacing <= 0) return null;

  return {
    xCount: xItems.length,
    xSpacing,
    yCount: yItems.length,
    ySpacing,
    originX: xItems[0].position,
    originY: yItems[0].position,
  };
}

function normalizedInput(
  input: OrthogonalGridSystemInput,
): Required<OrthogonalGridSystemInput> {
  const xCount = requireCount(
    input.xCount,
    "GRID_X_COUNT_MUST_BE_AT_LEAST_2",
  );
  const yCount = requireCount(
    input.yCount,
    "GRID_Y_COUNT_MUST_BE_AT_LEAST_2",
  );
  const xSpacing = requireSpacing(
    input.xSpacing,
    "GRID_X_SPACING_MUST_BE_POSITIVE",
  );
  const ySpacing = requireSpacing(
    input.ySpacing,
    "GRID_Y_SPACING_MUST_BE_POSITIVE",
  );
  const originX = input.originX ?? 0;
  const originY = input.originY ?? 0;

  if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
    throw new Error("GRID_ORIGIN_MUST_BE_FINITE");
  }

  return { xCount, xSpacing, yCount, ySpacing, originX, originY };
}

function updateAxis(
  model: StructuralModel,
  axis: Axis,
  count: number,
  spacing: number,
  originX: number,
  originY: number,
  xMax: number,
  yMax: number,
): StructuralModel {
  const existing = axisGrids(model, axis);
  let next = model;

  for (let index = 0; index < count; index += 1) {
    const label = axis === "x" ? String(index + 1) : alphaLabel(index);
    const position =
      axis === "x"
        ? originX + index * spacing
        : originY + index * spacing;

    const start =
      axis === "x"
        ? { x: position, y: originY, z: 0 }
        : { x: originX, y: position, z: 0 };

    const end =
      axis === "x"
        ? { x: position, y: yMax, z: 0 }
        : { x: xMax, y: position, z: 0 };

    const current = existing[index];

    if (current) {
      next = updateGridLine(next, current.grid.id, {
        label,
        start,
        end,
      }).model;
    } else {
      next = createGridLine(next, { label, start, end }).model;
    }
  }

  for (const extra of existing.slice(count)) {
    next = deleteGridLine(next, extra.grid.id);
  }

  return next;
}

export function updateOrthogonalGridSystem(
  model: StructuralModel,
  input: OrthogonalGridSystemInput,
): StructuralModel {
  const normalized = normalizedInput(input);
  const xMax =
    normalized.originX +
    (normalized.xCount - 1) * normalized.xSpacing;
  const yMax =
    normalized.originY +
    (normalized.yCount - 1) * normalized.ySpacing;

  let next = updateAxis(
    model,
    "x",
    normalized.xCount,
    normalized.xSpacing,
    normalized.originX,
    normalized.originY,
    xMax,
    yMax,
  );

  next = updateAxis(
    next,
    "y",
    normalized.yCount,
    normalized.ySpacing,
    normalized.originX,
    normalized.originY,
    xMax,
    yMax,
  );

  return next;
}

export function createOrthogonalGridSystem(
  model: StructuralModel,
  input: OrthogonalGridSystemInput,
): StructuralModel {
  const preserved = model.grids.filter((grid) => !classifyGrid(grid));
  return updateOrthogonalGridSystem({ ...model, grids: preserved }, input);
}
