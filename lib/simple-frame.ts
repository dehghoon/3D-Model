import type { StructuralModel } from "@linkoteq/structural-core";
import { createStarterModelV05 } from "./default-model-v05";
import { assertCanonicalV05 } from "./core-v05";
export type FrameAxis = "x" | "y" | "heights";
export interface FrameBrace {
  id: string;
  direction: "x" | "y";
  frame: number;
  from: number;
  to: number;
  storey: number;
  pattern: "/" | "\\" | "X";
}
export interface MemberOverride {
  sectionId?: string;
  materialId?: string;
  excluded?: boolean;
  rotationDeg?: number;
}
export interface FrameLayout {
  defaults?: {
    beam?: string;
    column?: string;
    brace?: string;
    materialId?: string;
  };
  braces?: FrameBrace[];
  overrides?: Record<string, MemberOverride>;
  x: number[];
  y: number[];
  heights: number[];
}
export const DEFAULT_FRAME: FrameLayout = {
  x: [5, 5, 5],
  y: [5, 5],
  heights: [3, 3],
};
export const total = (values: number[]) => values.reduce((a, b) => a + b, 0);
export const positions = (values: number[]) =>
  values.reduce<number[]>((out, v) => [...out, out[out.length - 1] + v], [0]);
export function validateLayout(layout: FrameLayout): void {
  for (const values of [layout.x, layout.y, layout.heights]) {
    if (
      !values.length ||
      values.length > 20 ||
      values.some((v) => !Number.isFinite(v) || v < 0.1 || v > 1000)
    )
      throw new Error(
        "Use 1–20 bays/storeys and dimensions between 0.1 and 1000 m.",
      );
  }
}
export function fitDimension(length: number): number[] {
  if (!Number.isFinite(length) || length < 0.1 || length > 20000)
    throw new Error("Enter a plan dimension between 0.1 and 20000 m.");
  const count = Math.min(20, Math.max(1, Math.ceil(length / 5)));
  if (count === 20 && length > 100) return Array(20).fill(length / 20);
  const bays = Array.from({ length: count }, (_, i) =>
    i === count - 1 ? length - 5 * (count - 1) : 5,
  );
  if (bays.length > 1 && bays[bays.length - 1] < 0.1) {
    const remainder = bays.pop()!;
    bays[bays.length - 1] += remainder;
  }
  return bays;
}
export function resizeBays(
  values: number[],
  count: number,
  fallback: number,
): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 20)
    throw new Error("Choose between 1 and 20 bays/storeys.");
  return Array.from({ length: count }, (_, i) => values[i] ?? fallback);
}
export function createSimpleFrame(
  layout: FrameLayout,
  template = createStarterModelV05(),
): StructuralModel {
  validateLayout(layout);
  const seed = createStarterModelV05();
  const xs = positions(layout.x),
    ys = positions(layout.y),
    zs = positions(layout.heights);
  const levels = zs.map((elevation, k) => ({
    id: `SF-L${k}`,
    name: k ? `Level ${k}` : "Base",
    elevation,
  }));
  const id = (i: number, j: number, k: number) => `SF-N${i}-${j}-${k}`;
  const nodes = zs.flatMap((z, k) =>
    ys.flatMap((y, j) =>
      xs.map((x, i) => ({
        id: id(i, j, k),
        position: { x, y, z },
        levelId: levels[k].id,
      })),
    ),
  );
  const members: StructuralModel["members"] = [];
  const materialId =
    layout.defaults?.materialId ??
    template.materials[0]?.id ??
    seed.materials[0].id;
  const sectionId = template.sections[0]?.id ?? seed.sections[0].id;
  const add = (
    type: "column" | "beam" | "brace",
    a: string,
    b: string,
    k: number,
  ) =>
    members.push({
      id: `SF-${type === "column" ? "C" : type === "beam" ? "B" : "R"}-${a}-${b}`,
      type,
      startNodeId: a,
      endNodeId: b,
      levelId: levels[k].id,
      materialId,
      sectionId: layout.defaults?.[type] ?? sectionId,
    });
  for (let k = 1; k < zs.length; k++)
    for (let j = 0; j < ys.length; j++)
      for (let i = 0; i < xs.length; i++) {
        add("column", id(i, j, k - 1), id(i, j, k), k);
        if (i + 1 < xs.length) add("beam", id(i, j, k), id(i + 1, j, k), k);
        if (j + 1 < ys.length) add("beam", id(i, j, k), id(i, j + 1, k), k);
      }
  const braceIds = new Set<string>();
  const braceEdges = new Set<string>();
  for (const brace of layout.braces ?? []) {
    if (braceIds.has(brace.id)) throw new Error("Duplicate brace placement.");
    braceIds.add(brace.id);
    const spans = brace.direction === "x" ? layout.x : layout.y;
    const cross = brace.direction === "x" ? layout.y : layout.x;
    if (
      ![brace.frame, brace.from, brace.to, brace.storey].every(
        Number.isInteger,
      ) ||
      brace.frame < 0 ||
      brace.frame > cross.length ||
      brace.from < 0 ||
      brace.to > spans.length ||
      brace.from >= brace.to ||
      brace.storey < -1 ||
      brace.storey >= layout.heights.length
    )
      throw new Error(
        "Brace grids or storeys are outside the frame. Adjust the brace placements first.",
      );
    if (!layout.defaults?.brace) continue; // Explicitly pending until an assignable catalog section is selected.
    for (let k = 1; k < zs.length; k++) {
      if (brace.storey !== -1 && brace.storey !== k - 1) continue;
      const point = (along: number, level: number) =>
        brace.direction === "x"
          ? id(along, brace.frame, level)
          : id(brace.frame, along, level);
      const diagonal = (reverse: boolean) => {
        const start = point(reverse ? brace.to : brace.from, k - 1),
          end = point(reverse ? brace.from : brace.to, k);
        const edge = [start, end].sort().join("|");
        if (braceEdges.has(edge))
          throw new Error(
            "Two brace placements overlap. Choose another grid bay or storey.",
          );
        braceEdges.add(edge);
        members.push({
          id: `SF-R-${brace.id}-${k}-${reverse ? "down" : "up"}`,
          type: "brace",
          startNodeId: start,
          endNodeId: end,
          levelId: levels[k].id,
          materialId,
          sectionId: layout.defaults!.brace!,
        });
      };
      if (brace.pattern !== "\\") diagonal(false);
      if (brace.pattern !== "/") diagonal(true);
    }
  }
  const updatedMembers = members
    .filter((member) => !layout.overrides?.[member.id]?.excluded)
    .map((member) => {
      const { excluded, ...override } = layout.overrides?.[member.id] ?? {};
      return { ...member, ...override };
    });
  for (const member of updatedMembers) {
    if (
      !template.sections.some((s) => s.id === member.sectionId) &&
      !seed.sections.some((s) => s.id === member.sectionId)
    )
      throw new Error("Selected section is not in this model catalog.");
    if (
      !template.materials.some((m) => m.id === member.materialId) &&
      !seed.materials.some((m) => m.id === member.materialId)
    )
      throw new Error("Selected material is not in this model catalog.");
    if (
      member.rotationDeg !== undefined &&
      !Number.isFinite(member.rotationDeg)
    )
      throw new Error("Member rotation must be finite.");
  }
  const model: StructuralModel = {
    ...seed,
    project: {
      ...template.project,
      units: "SI",
      metadata: {
        ...template.project.metadata,
        defaultModel: "simple-frame",
        simpleFrame: JSON.stringify(layout),
      },
    },
    levels,
    grids: [
      ...xs.map((x, i) => ({
        id: `SF-GX${i}`,
        label: String(i + 1),
        start: { x, y: 0, z: 0 },
        end: { x, y: total(layout.y), z: 0 },
      })),
      ...ys.map((y, j) => ({
        id: `SF-GY${j}`,
        label: String.fromCharCode(65 + j),
        start: { x: 0, y, z: 0 },
        end: { x: total(layout.x), y, z: 0 },
      })),
    ],
    nodes,
    members: updatedMembers,
    surfaces: [],
    supports: [],
    diaphragms: [],
    loads: [],
    loadCases: [],
    loadSources: [],
    loadCombinations: [],
    materials: template.materials.length ? template.materials : seed.materials,
    sections: template.sections.length ? template.sections : seed.sections,
  };
  assertCanonicalV05(model);
  return model;
}
