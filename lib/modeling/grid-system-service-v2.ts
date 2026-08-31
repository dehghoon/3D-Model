import type { GridLine, StructuralModel } from "@linkoteq/structural-core";
import { createGridLine } from "./grid-service";

export type GridAxis = "x" | "y";
export interface GridOffsetLine { id?: string; label: string; offset: number; }
export interface GridOffsetSystem { xLines: GridOffsetLine[]; yLines: GridOffsetLine[]; }

const E = 1e-9;

function classify(g: GridLine): { axis: GridAxis; offset: number } | null {
  if (Math.abs(g.start.z) > E || Math.abs(g.end.z) > E) return null;
  const dx = g.end.x - g.start.x;
  const dy = g.end.y - g.start.y;
  if (Math.hypot(dx, dy) < E) return null;
  if (Math.abs(dx) < E) return { axis: "x", offset: g.start.x };
  if (Math.abs(dy) < E) return { axis: "y", offset: g.start.y };
  return null;
}

export function readGridOffsetSystem(model: StructuralModel): GridOffsetSystem {
  const xLines: GridOffsetLine[] = [];
  const yLines: GridOffsetLine[] = [];
  for (const grid of model.grids) {
    const item = classify(grid);
    if (!item) continue;
    const line = { id: grid.id, label: grid.label, offset: item.offset };
    (item.axis === "x" ? xLines : yLines).push(line);
  }
  xLines.sort((a, b) => a.offset - b.offset);
  yLines.sort((a, b) => a.offset - b.offset);
  return { xLines, yLines };
}

function validate(lines: GridOffsetLine[], axis: GridAxis): GridOffsetLine[] {
  if (lines.length < 2) throw new Error(`GRID_${axis.toUpperCase()}_REQUIRES_AT_LEAST_TWO_LINES`);
  const labels = new Set<string>();
  const offsets = new Set<number>();
  return lines.map((line) => {
    const label = line.label.trim();
    if (!label || !Number.isFinite(line.offset)) throw new Error("INVALID_GRID_LINE");
    if (labels.has(label) || offsets.has(line.offset)) throw new Error("DUPLICATE_GRID_LINE");
    labels.add(label);
    offsets.add(line.offset);
    return { label, offset: line.offset };
  });
}

function bounds(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const d = Math.max(2, Math.max(max - min, 1) * 0.08);
  return { min: min - d, max: max + d };
}

export function applyGridOffsetSystem(model: StructuralModel, input: GridOffsetSystem): StructuralModel {
  const x = validate(input.xLines, "x");
  const y = validate(input.yLines, "y");
  const xb = bounds(x.map((line) => line.offset));
  const yb = bounds(y.map((line) => line.offset));
  let next: StructuralModel = { ...model, grids: [] };

  for (const line of x) {
    next = createGridLine(next, {
      label: line.label,
      start: { x: line.offset, y: yb.min, z: 0 },
      end: { x: line.offset, y: yb.max, z: 0 },
    }).model;
  }

  for (const line of y) {
    next = createGridLine(next, {
      label: line.label,
      start: { x: xb.min, y: line.offset, z: 0 },
      end: { x: xb.max, y: line.offset, z: 0 },
    }).model;
  }

  return next;
}
