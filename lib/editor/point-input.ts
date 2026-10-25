import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { SnapPoint } from "./interaction-store";

export function pointFromCoordinates(
  values: { x: string; y: string; z: string },
  mode: "absolute" | "relative",
  base: Vec3 | null,
): SnapPoint {
  if (Object.values(values).some((value) => !value.trim()))
    throw new Error("Enter all three coordinates.");
  const point = {
    x: Number(values.x),
    y: Number(values.y),
    z: Number(values.z),
  };
  if (mode === "relative") {
    if (!base) throw new Error("Choose a base point before using offsets.");
    point.x += base.x;
    point.y += base.y;
    point.z += base.z;
  }
  if (!Object.values(point).every(Number.isFinite))
    throw new Error("Coordinates must be finite numbers.");
  return {
    point,
    kind: "work-plane",
    label: `${mode === "relative" ? "Offset" : "Coordinates"} (${point.x}, ${point.y}, ${point.z})`,
  };
}

export function columnPointAtLevel(
  model: StructuralModel,
  base: Vec3,
  levelId: string,
): SnapPoint {
  const level = model.levels.find((item) => item.id === levelId);
  if (!level) throw new Error("Choose an end level.");
  if (Math.abs(level.elevation - base.z) < 1e-8)
    throw new Error("End level must differ from the base elevation.");
  return {
    point: { x: base.x, y: base.y, z: level.elevation },
    kind: "work-plane",
    label: `Level ${level.name}`,
  };
}
