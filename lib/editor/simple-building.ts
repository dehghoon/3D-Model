import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
export interface SimpleBuildingSettings {
  levelId: string;
  endLevelId: string;
}
export function buildingLevels(
  model: StructuralModel,
  settings: SimpleBuildingSettings,
) {
  const levels = [...model.levels].sort((a, b) => a.elevation - b.elevation);
  const level =
    levels.find((item) => item.id === settings.levelId) ?? levels[0];
  const end =
    levels.find(
      (item) =>
        item.id === settings.endLevelId &&
        item.elevation > (level?.elevation ?? Infinity),
    ) ?? levels.find((item) => item.elevation > (level?.elevation ?? Infinity));
  return { levels, level, end };
}
export function simpleBoundary(
  type: "wall" | "slab",
  a: Vec3,
  b: Vec3,
  top?: number,
): Vec3[] {
  if (![a.x, a.y, a.z, b.x, b.y, b.z].every(Number.isFinite))
    throw new Error("Coordinates must be finite.");
  if (Math.abs(a.z - b.z) > 1e-8)
    throw new Error("Both points must be on the selected floor.");
  if (type === "slab") {
    if (Math.abs(a.x - b.x) < 1e-8 || Math.abs(a.y - b.y) < 1e-8)
      throw new Error(
        "Choose two opposite corners with nonzero width and length.",
      );
    return [a, { x: b.x, y: a.y, z: a.z }, b, { x: a.x, y: b.y, z: a.z }];
  }
  if (top === undefined || !Number.isFinite(top) || top <= a.z)
    throw new Error("Choose a higher end floor for the wall.");
  if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-8)
    throw new Error("Wall ends must be distinct.");
  return [a, b, { ...b, z: top }, { ...a, z: top }];
}
