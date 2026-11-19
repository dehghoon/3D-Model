import type { LoadCase, LoadSource, StructuralModel, SurfaceVectorLoad } from "@linkoteq/structural-core";

const tolerance = 1e-6;
const faces = ["west", "east", "south", "north"] as const;
type Face = typeof faces[number];
const outward: Record<Face, { component: "FX" | "FY"; sign: number }> = {
  west: { component: "FX", sign: -1 }, east: { component: "FX", sign: 1 },
  south: { component: "FY", sign: -1 }, north: { component: "FY", sign: 1 },
};

export function windEnvelope(model: StructuralModel) {
  if (model.project.units !== "SI") throw new Error("Wind wall assignment requires a model in metres.");
  const nodes = new Map(model.nodes.map(node => [node.id, node.position]));
  const points = model.nodes.map(node => node.position);
  const [minX, minY, minZ] = (["x", "y", "z"] as const).map(axis =>
    points.reduce((value, point) => Math.min(value, point[axis]), Infinity));
  const [maxX, maxY, maxZ] = (["x", "y", "z"] as const).map(axis =>
    points.reduce((value, point) => Math.max(value, point[axis]), -Infinity));
  const recordedGrade = model.project.metadata?.gradeElevationM;
  const grade = typeof recordedGrade === "number" && Number.isFinite(recordedGrade) ? recordedGrade : minZ;
  const dimensions = { x: maxX - minX, y: maxY - minY, z: maxZ - grade };
  if (!Object.values(dimensions).every(value => Number.isFinite(value) && value > tolerance)) {
    throw new Error("Define a building with nonzero plan dimensions and height.");
  }
  const wallIds: Record<Face, string[]> = { west: [], east: [], south: [], north: [] };
  for (const wall of model.surfaces.filter(surface => surface.type === "wall")) {
    const boundary = wall.boundaryNodeIds.map(id => nodes.get(id));
    if (boundary.length < 3 || boundary.some(point => !point)) throw new Error(`Wall ${wall.id} has an incomplete boundary.`);
    if (boundary.every(point => point!.z <= grade + tolerance)) continue;
    const onPlane = (axis: "x" | "y", coordinate: number) =>
      boundary.every(point => Math.abs(point![axis] - coordinate) <= tolerance);
    const candidates = [
      onPlane("x", minX) && "west", onPlane("x", maxX) && "east",
      onPlane("y", minY) && "south", onPlane("y", maxY) && "north",
    ].filter((face): face is Face => Boolean(face));
    if (candidates.length === 1) {
      if (boundary.some(point => point!.z < grade - tolerance)) {
        throw new Error(`Split wall ${wall.id} at grade before assigning outside wind pressures.`);
      }
      wallIds[candidates[0]].push(wall.id);
    }
    if (candidates.length > 1) throw new Error(`Wall ${wall.id} is degenerate.`);
  }
  if (faces.some(face => !wallIds[face].length)) {
    throw new Error("Model a rectangular building with exterior wall surfaces on all four sides.");
  }
  return { dimensions, wallIds, gradeElevationM: grade };
}

type Pressures = { windward: number; leeward: number; parallel: number };
export function assignWindWalls(
  model: StructuralModel, envelope: ReturnType<typeof windEnvelope>,
  pressures: Record<"x" | "y", Pressures>, inputs: Record<string, unknown>,
): StructuralModel {
  for (const row of Object.values(pressures)) {
    if (![row.windward, row.leeward, row.parallel].every(Number.isFinite) ||
        row.windward <= 0 || row.leeward >= 0 || row.parallel >= 0) {
      throw new Error("Wind Calculator did not return valid signed external wall pressures.");
    }
  }
  const id = "wind-exterior-walls";
  const source: LoadSource = {
    id, name: "NBC 2020 external wall wind pressure", category: "wind", calculator: "wind",
    codeEdition: "NBC 2020", status: "generated", inputs, summary: { envelope, pressures },
  };
  const cases: LoadCase[] = [];
  const loads: SurfaceVectorLoad[] = [];
  for (const [axis, sign, windward, leeward] of [
    ["x", "+", "west", "east"], ["x", "-", "east", "west"],
    ["y", "+", "south", "north"], ["y", "-", "north", "south"],
  ] as const) {
    const loadCaseId = `${id}-${axis}-${sign === "+" ? "positive" : "negative"}`;
    cases.push({ id: loadCaseId, name: `Wind ${sign}${axis.toUpperCase()} · external walls`, category: "wind", analysisType: "static", sourceId: id });
    for (const face of faces) {
      const row = pressures[axis];
      const pressure = face === windward ? row.windward : face === leeward ? row.leeward : row.parallel;
      const { component, sign: direction } = outward[face];
      for (const surfaceId of envelope.wallIds[face]) {
        loads.push({
          id: `${loadCaseId}-${surfaceId}`, type: "surface-vector", surfaceId, loadCaseId,
          coordinateSystem: "global", distribution: "force-per-area",
          components: { [component]: { value: -pressure * direction, unit: "kPa" } },
          provenance: { sourceId: id },
        });
      }
    }
  }
  return {
    ...model,
    loadSources: [...(model.loadSources ?? []).filter(item => item.id !== id), source],
    loadCases: [...model.loadCases.filter(item => item.sourceId !== id), ...cases],
    loads: [...model.loads.filter(item => item.provenance?.sourceId !== id), ...loads],
  };
}
