import type { GridLine, StructuralModel } from "@linkoteq/structural-core";

import {
  createGridLine,
  deleteGridLine,
  updateGridLine,
} from "./grid-service";

export type GridAxis = "x" | "y";

export interface GridOffsetLine {
  id?: string;
  label: string;
  offset: number;
}

export interface GridOffsetSystem {
  xLines: GridOffsetLine[];
  yLines: GridOffsetLine[];
}

interface ClassifiedGrid {
  axis: GridAxis;
  offset: number;
  grid: GridLine;
}

const EPSILON = 1e-9;
const MIN_EXTENSION = 2;

function requireFinite(value: number, code: string): number {
  if (!Number.isFinite(value)) throw new Error(code);
  return value;
}

function classifyGrid(grid: GridLine): ClassifiedGrid | null {
  const atZero=
    Math.abs(grid.start.z) < EPSILON &&
    Math.abs(grid.end.z) < EPSILON;

  if (!atZero) return null;

  const vertical=
    Math.abs(grid.start.x - grid.end.x) < EPSILON &&
    Math.abs(grid.start.y - grid.end.y) > EPSILON;

  if (vertical) {
    return { axis: "x", offset: grid.start.x, grid };
  }

  const horizontal=
    Math.abs(grid.start.y - grid.end.y) < EPSILON &&
    Math.abs(grid.start.x - grid.end.x) > EPSILON;

  if (horizontal) {
    return { axis: "y", offset: grid.start.y, grid };
  }

  return null;
}

function classifiedAxis(model: StructuralModel, axis: GridAxis): ClassifiedGrid[] {
  return model.grids
    .map(classifyGrid)
    .filter((item): item is ClassifiedGrid => item !== null && item.axis === axis)
    .sort((a, b) => a.offset - b.offset);
}

export function readGridOffsetSystem(model: StructuralModel): GridOffsetSystem {
  return {
    xLines: classifiedAxis(model, "x").map(({ grid, offset }) => ({
      id: grid.id,
      label: grid.label,
      offset,
    })),
    yLines: classifiedAxis(model, "y").map(({ grid, offset }) => ({
      id: grid.id,
      label: grid.label,
      offset,
    })),
  };
}

function normalizeLines(lines: GridOffsetLine[], axis: GridAxis): GridOffsetLine[] {
  const code = axis === "x" ? "GRID_X" : "GRID_Y";
  if (lines.length < 2) throw new Error(`${code}_REQUIRES_AT_LEAST_TWO_LINES`);

  const labels = new Set<string>();
  const offsets = new Set<number>();

  return lines.map((line, index) => {
    const label = line.label.trim();
    if (!label) throw new Error(`${code}_LABEL_REQUIRED_${index + 1}`);

    const offset = requireFinite(line.offset, `${code}_OFFSET_MUST_BE_FINITE_${index + 1}`);
    if (labels.has(label)) throw new Error(`${code}_LABEL_MUST_BE_UNIQUE_${label}`);
    if (offsets.has(offset)) throw new Error(`${code}_OFFSET_MUST_BE_UNIQUE_${offset}`);

    labels.add(label);
    offsets.add(offset);
    return { id: line.id, label, offset };
  });
}

function extendedBounds(values: number[]): { min: number; max: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const extension = Math.max(MIN_EXTENSION, span * 0.08);
  return { min: min - extension, max: max + extension };
}

function syncAxis(
  model: StructuralModel,
  axis: GridAxis,
  desired: GridOffsetLine[],
  xBounds: { min: number; max: number },
  yBounds: { min: number; max: number },
): StructuralModel {
  const existing = classifiedAxis(model, axis);
  const byId = new Map(existing.map((item) => [item.grid.id, item.grid]));
  const retained = new Set<string>();
  let next = model;

  for (const line of desired) {
    const start =
      axis === "x"
        ? { x: line.offset, y: yBounds.min, z: 0 }
        : { x: xBounds.min, y: line.offset, z: 0 };
    const end =
      axis === "x"
        ? { x: line.offset, y: yBounds.max, z: 0 }
        : { x: xBounds.max, y: line.offset, z: 0 };

    const existingGrid = line.id ? byId.get(line.id) : undefined;

    if (existingGrid) {
      const result = updateGridLine(next, existingGrid.id, {
        label: line.label,
        start,
        end,
      });
      next = result.model;
      retained.add(existingGrid.id);
    } else {
      const result = createGridLine(next, { label: line.label, start, end });
      next = result.model;
      retained.ad(result.grid.id);
    }
  }

  for (const item of existing) {
    if (!retained.has(item.grid.id)) next = deleteGridLine(next, item.grid.id);
  }

  return next;
}

export function applyGridOffsetSystem(model: StructuralModel, input: GridOffsetSystem): StructuralModel {
  const xLines = normalizeLines(input.xLines, "x");
  const yLines = normalizeLines(input.yLines, "y");
  const xBounds = extendedBounds(xLines.map((line) => line.offset));
  const yBounds = extendedBounds(yLines.map((line) => line.offset));

  let next = syncAxis(model, "x", xLines, xBounds, yBounds);
  next = syncAxis(next, "y", yLines, xBounds, yBounds);
  return next;
}
