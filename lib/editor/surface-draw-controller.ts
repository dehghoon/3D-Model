import type {
  StructuralModel,
  SurfaceType,
  Vec3,
} from "@linkoteq/structural-core";
import { ensureNodeAtPoint } from "./member-draw-controller";
import { createSurfaceFromCanonicalRefs } from "../editor-surface-v05";

export function createSurfaceFromPoints(
  model: StructuralModel,
  type: SurfaceType,
  points: Vec3[],
) {
  if (points.length < 3)
    throw new Error("Pick at least three distinct boundary points.");
  if (points.some((point) => !Object.values(point).every(Number.isFinite)))
    throw new Error("Boundary coordinates must be finite.");
  const epsilon = 1e-8;
  for (let i = 0; i < points.length; i++)
    for (let j = 0; j < i; j++) {
      if (
        Math.hypot(
          points[i].x - points[j].x,
          points[i].y - points[j].y,
          points[i].z - points[j].z,
        ) < epsilon
      )
        throw new Error("Boundary points must be distinct.");
    }
  const subtract = (a: Vec3, b: Vec3) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  });
  const cross = (a: Vec3, b: Vec3) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const a = points[0];
  let normal = { x: 0, y: 0, z: 0 };
  for (let i = 1; i < points.length - 1; i++) {
    const value = cross(subtract(points[i], a), subtract(points[i + 1], a));
    const length = Math.hypot(value.x, value.y, value.z);
    if (length > epsilon) {
      normal = {
        x: value.x / length,
        y: value.y / length,
        z: value.z / length,
      };
      break;
    }
  }
  if (Math.hypot(normal.x, normal.y, normal.z) < epsilon)
    throw new Error("Boundary points must enclose an area.");
  const scale = Math.max(
    1,
    ...points.map((p) => Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z)),
  );
  if (
    points.some(
      (p) =>
        Math.abs(
          (p.x - a.x) * normal.x +
            (p.y - a.y) * normal.y +
            (p.z - a.z) * normal.z,
        ) >
        epsilon * scale,
    )
  )
    throw new Error("Boundary points must lie in one plane.");
  const axes =
    Math.abs(normal.z) >= Math.max(Math.abs(normal.x), Math.abs(normal.y))
      ? (["x", "y"] as const)
      : Math.abs(normal.y) >= Math.abs(normal.x)
        ? (["x", "z"] as const)
        : (["y", "z"] as const);
  const flat = points.map((p) => ({ x: p[axes[0]], y: p[axes[1]] }));
  const orient = (a: (typeof flat)[number], b: typeof a, c: typeof a) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const onSegment = (a: (typeof flat)[number], b: typeof a, c: typeof a) =>
    Math.abs(orient(a, b, c)) < epsilon &&
    c.x >= Math.min(a.x, b.x) - epsilon &&
    c.x <= Math.max(a.x, b.x) + epsilon &&
    c.y >= Math.min(a.y, b.y) - epsilon &&
    c.y <= Math.max(a.y, b.y) + epsilon;
  for (let i = 0; i < flat.length; i++)
    for (let j = i + 1; j < flat.length; j++) {
      if (j === i + 1 || (i === 0 && j === flat.length - 1)) continue;
      const a = flat[i],
        b = flat[(i + 1) % flat.length],
        c = flat[j],
        d = flat[(j + 1) % flat.length];
      if (
        (orient(a, b, c) * orient(a, b, d) < 0 &&
          orient(c, d, a) * orient(c, d, b) < 0) ||
        onSegment(a, b, c) ||
        onSegment(a, b, d) ||
        onSegment(c, d, a) ||
        onSegment(c, d, b)
      )
        throw new Error(
          "Boundary edges must not cross. Pick points around the perimeter.",
        );
    }
  let next = model;
  const ids = points.map((point) => {
    const result = ensureNodeAtPoint(next, point);
    next = result.model;
    return result.nodeId;
  });
  const level = model.levels.find((level) =>
    points.every((point) => Math.abs(point.z - level.elevation) < epsilon),
  );
  return createSurfaceFromCanonicalRefs(next, {
    type,
    boundaryNodeIds: ids,
    ...(level ? { levelId: level.id } : {}),
  });
}
