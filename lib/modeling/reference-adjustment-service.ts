import type { GridLine, Level, StructuralModel } from "@linkoteq/structural-core";

const TOLERANCE = 1e-7;

function near(left: number, right: number): boolean {
  return Math.abs(left - right) <= TOLERANCE;
}

function gridAxis(grid: GridLine): "x" | "y" | null {
  if (near(grid.start.x, grid.end.x) && !near(grid.start.y, grid.end.y)) return "x";
  if (near(grid.start.y, grid.end.y) && !near(grid.start.x, grid.end.x)) return "y";
  return null;
}

export function adjustModelToGridEdits(
  original: StructuralModel,
  edited: StructuralModel,
): StructuralModel {
  const originalById = new Map(original.grids.map((grid) => [grid.id, grid]));
  const changes = edited.grids.flatMap((grid) => {
    const before = originalById.get(grid.id);
    if (!before) return [];

    const beforeAxis = gridAxis(before);
    const afterAxis = gridAxis(grid);
    if (!beforeAxis || beforeAxis !== afterAxis) return [];

    const oldOffset = beforeAxis === "x" ? before.start.x : before.start.y;
    const newOffset = afterAxis === "x" ? grid.start.x : grid.start.y;
    if (near(oldOffset, newOffset)) return [];
    return [{ axis: beforeAxis, oldOffset, newOffset }];
  });

  if (!changes.length) return edited;

  return {
    ...edited,
    nodes: edited.nodes.map((node) => {
      let position = { ...node.position };
      for (const change of changes) {
        const value = change.axis === "x" ? position.x : position.y;
        if (!near(value, change.oldOffset)) continue;
        position =
          change.axis === "x"
            ? { ...position, x: change.newOffset }
            : { ...position, y: change.newOffset };
      }
      return { ...node, position };
    }),
  };
}

export function adjustModelToLevelEdit(
  model: StructuralModel,
  before: Level,
  after: Level,
): StructuralModel {
  if (near(before.elevation, after.elevation)) return model;

  return {
    ...model,
    nodes: model.nodes.map((node) =>
      node.levelId === before.id
        ? {
            ...node,
            position: { ...node.position, z: after.elevation },
          }
        : node,
    ),
  };
}
