import type { GridLine, Node, Vec3 } from "@linkoteq/structural-core";
/** Extend display lines beyond physical nodes. Never changes reference/snap geometry. */
export function gridDisplayEndpoints(
  grid: GridLine,
  nodes: Node[],
  offset?: number,
): { start: Vec3; end: Vec3 } {
  const dx = grid.end.x - grid.start.x,
    dy = grid.end.y - grid.start.y,
    length = Math.hypot(dx, dy);
  if (!length) return { start: { ...grid.start }, end: { ...grid.end } };
  const ux = dx / length,
    uy = dy / length;
  const projected = nodes.map(
    (n) =>
      (n.position.x - grid.start.x) * ux + (n.position.y - grid.start.y) * uy,
  );
  const min = Math.min(0, ...projected),
    max = Math.max(length, ...projected);
  const margin = offset ?? Math.max(1, (max - min) * 0.06);
  return {
    start: {
      x: grid.start.x + (min - margin) * ux,
      y: grid.start.y + (min - margin) * uy,
      z: grid.start.z,
    },
    end: {
      x: grid.start.x + (max + margin) * ux,
      y: grid.start.y + (max + margin) * uy,
      z: grid.end.z,
    },
  };
}
