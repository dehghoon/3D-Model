import type { StructuralModel } from "@linkoteq/structural-core";

export interface SnowRoofGeometry {
  widthM: number;
  lengthM: number;
  meanHeightM: number | null;
}

export function findAutomaticSnowRoof(model: StructuralModel, selectedIds: string[]) {
  if (model.project.units !== "SI") throw new Error("Automatic Snow requires a model in metres.");
  const nodes = new Map(model.nodes.map(node => [node.id, node.position]));
  const tolerance = 1e-6;
  const highest = model.nodes.reduce((z, node) => Math.max(z, node.position.z), -Infinity);
  const roofs = model.surfaces.filter(surface => surface.type === "slab" &&
    surface.boundaryNodeIds.every(id => Math.abs((nodes.get(id)?.z ?? Infinity) - highest) <= tolerance));
  if (roofs.length !== 1 || (selectedIds.length && (selectedIds.length !== 1 || selectedIds[0] !== roofs[0]?.id))) {
    throw new Error("Automatic Snow requires one unobstructed top-level roof slab. Use Snow Load for split, stepped or obstructed roofs.");
  }

  const roof = roofs[0];
  const corners = roof.boundaryNodeIds.map(id => nodes.get(id)!);
  if (corners.length !== 4) throw new Error("Automatic Snow requires a rectangular flat roof.");
  const edges = corners.map((a, index) => {
    const b = corners[(index + 1) % corners.length];
    return { x: b.x - a.x, y: b.y - a.y };
  });
  const lengths = edges.map(edge => Math.hypot(edge.x, edge.y));
  const isRectangle = edges.every((edge, index) => {
    const next = edges[(index + 1) % edges.length];
    return lengths[index] > tolerance &&
      Math.abs(edge.x * next.x + edge.y * next.y) <= tolerance * lengths[index] * lengths[(index + 1) % edges.length];
  });
  if (!isRectangle) throw new Error("Automatic Snow requires a rectangular flat roof.");
  const [first, second] = edges;
  const cross = first.x * second.y - first.y * second.x;
  const grade = model.project.metadata?.gradeElevationM;
  const meanHeightM = typeof grade === "number" && Number.isFinite(grade) ? highest - grade : null;
  if (meanHeightM !== null && meanHeightM < 0) throw new Error("The roof is below the recorded grade.");
  const geometry: SnowRoofGeometry = { widthM: Math.min(...lengths), lengthM: Math.max(...lengths), meanHeightM };
  return { surfaceId: roof.id, geometry, normalSense: cross > 0 ? "negative" as const : "positive" as const };
}

// NBC 2020 Division B 4.1.6.2.(2) and 4.1.6.13, using unreduced Cw = 1.
export function automaticSnowRoofFactor(roof: SnowRoofGeometry, ss: number) {
  const { widthM, lengthM, meanHeightM } = roof;
  const characteristicLengthM = 2 * widthM - widthM ** 2 / lengthM;
  const gamma = Math.min(4, 0.43 * ss + 2.2);
  if (meanHeightM === null || meanHeightM < 1 + ss / gamma) {
    return { cb: 1, characteristicLengthM, unverifiedGrade: meanHeightM === null };
  }
  return {
    cb: characteristicLengthM <= 70 ? 0.8 : 1 - 0.2 * Math.exp(-(characteristicLengthM - 70) / 100),
    characteristicLengthM,
    unverifiedGrade: false,
  };
}
