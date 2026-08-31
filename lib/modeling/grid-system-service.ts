import type { StructuralModel } from "@linkoteq/structural-core";

import { createGridLine } from "./grid-service";

export interface OrthogonalGridSystemInput {
  xCount: number;
  xSpacing: number;
  yCount: number;
  ySpacing: number;
  originX?: number;
  originY?: number;
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

export function createOrthogonalGridSystem(
  model: StructuralModel,
  input: OrthogonalGridSystemInput,
): StructuralModel {
  const xCount = requireCount(input.xCount, "GRID_X_COUNT_MUST_BE_AT_LEAST_2");
  const yCount = requireCount(input.yCount, "GRID_Y_COUNT_MUST_BE_AT_LEAST_2");
  const xSpacing = requireSpacing(input.xSpacing, "GRID_X_SPACING_MUST_BE_POSITIVE");
  const ySpacing = requireSpacing(input.ySpacing, "GRID_Y_SPACING_MUST_BE_POSITIVE");
  const originX = input.originX ?? 0;
  const originY = input.originY ?? 0;

  if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
    throw new Error("GRID_ORIGIN_MUST_BE_FINITE");
  }

  const xMax = originX + (xCount - 1) * xSpacing;
  const yMax = originY + (yCount - 1) * ySpacing;

  let next: StructuralModel = { ...model, grids: [] };

  for (let index = 0; index < xCount; index += 1) {
    const x = originX + index * xSpacing;
    next = createGridLine(next, {
      label: String(index + 1),
      start: { x, y: originY, z: 0 },
      end: { x, y: yMax, z: 0 },
    }).model;
  }

  for (let index = 0; index < yCount; index += 1) {
    const y = originY + index * ySpacing;
    next = createGridLine(next, {
      label: alphaLabel(index),
      start: { x: originX, y, z: 0 },
      end: { x: xMax, y, z: 0 },
    }).model;
  }

  return next;
}
