import type { StructuralModel } from "@linkoteq/structural-core";
import { createStarterModelV05 } from "./default-model-v05";
import { assertCanonicalV05 } from "./core-v05";
export interface FrameLayout {
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
  const materialId = template.materials[0]?.id ?? seed.materials[0].id;
  const sectionId = template.sections[0]?.id ?? seed.sections[0].id;
  const add = (type: "column" | "beam", a: string, b: string, k: number) =>
    members.push({
      id: `SF-${type === "column" ? "C" : "B"}-${a}-${b}`,
      type,
      startNodeId: a,
      endNodeId: b,
      levelId: levels[k].id,
      materialId,
      sectionId,
    });
  for (let k = 1; k < zs.length; k++)
    for (let j = 0; j < ys.length; j++)
      for (let i = 0; i < xs.length; i++) {
        add("column", id(i, j, k - 1), id(i, j, k), k);
        if (i + 1 < xs.length) add("beam", id(i, j, k), id(i + 1, j, k), k);
        if (j + 1 < ys.length) add("beam", id(i, j, k), id(i, j + 1, k), k);
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
    members,
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
