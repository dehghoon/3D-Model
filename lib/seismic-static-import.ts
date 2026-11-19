import type { Diaphragm, DiaphragmLoad, LoadCase, LoadSource, StructuralModel } from "@linkoteq/structural-core";

type StoreyResult = { heightM: number; forceKN: number; torsionPlusKNm: number; torsionMinusKNm: number };
type StaticSeismic = {
  schema: "linkoteq.seismic.static.v1";
  codeEdition: "NBCC_2020";
  hazardSourceId: string;
  siteDesignation: string;
  sfrsId: string;
  baseShearKN: number;
  storeys: StoreyResult[];
  warnings: string[];
};

function readStaticSeismic(input: unknown): StaticSeismic {
  const data = input as Partial<StaticSeismic> | null;
  if (data?.schema !== "linkoteq.seismic.static.v1" || data.codeEdition !== "NBCC_2020" ||
      ![data.hazardSourceId, data.siteDesignation, data.sfrsId].every(value => typeof value === "string" && value.trim()) ||
      !Number.isFinite(data.baseShearKN) || !(data.baseShearKN! > 0) ||
      !Array.isArray(data.warnings) || !data.warnings.every(message => typeof message === "string") ||
      !Array.isArray(data.storeys) || !data.storeys.length) {
    throw new Error("Choose a static seismic export from the Linkoteq calculator.");
  }
  if (!data.storeys.every((row, index, rows) => row && Number.isFinite(row.heightM) &&
    row.heightM > (rows[index - 1]?.heightM ?? 0) && Number.isFinite(row.forceKN) && row.forceKN >= 0 &&
    Number.isFinite(row.torsionPlusKNm) && Number.isFinite(row.torsionMinusKNm) && row.torsionPlusKNm >= row.torsionMinusKNm)) {
    throw new Error("The export has invalid storey forces, heights, or torsion.");
  }
  const total = data.storeys.reduce((sum, row) => sum + row.forceKN, 0);
  if (Math.abs(total - data.baseShearKN!) > Math.max(1e-8, data.baseShearKN! * 1e-8)) {
    throw new Error("The storey forces do not sum to the exported base shear.");
  }
  return data as StaticSeismic;
}

export function importStaticSeismic(model: StructuralModel, input: unknown, axis: "x" | "y"): StructuralModel {
  if (model.schemaVersion !== "0.6" || model.project.units !== "SI") {
    throw new Error("Import static seismic loads into a Core 0.6 model in metres.");
  }
  const result = readStaticSeismic(input);
  const levels = [...model.levels].sort((a,b) => a.elevation - b.elevation);
  const base = levels[0]?.elevation;
  if (base === undefined || levels.length !== result.storeys.length + 1) {
    throw new Error("The model must have one base level and all storey levels from the export.");
  }
  const nodes = new Map(model.nodes.map(node => [node.id, node]));
  const diaphragmsById = new Map(model.diaphragms.map(item => [item.id, item]));
  const loadPoints: { levelId: string; x: number; y: number; z: number }[] = [];
  const targetIds = result.storeys.map(({ heightM, forceKN, torsionPlusKNm, torsionMinusKNm }, index) => {
    const level = levels[index + 1];
    if (Math.abs(level.elevation - base - heightM) > 1e-6) {
      throw new Error(`The exported storey at ${heightM} m does not match model level ${level.name}.`);
    }
    const diaphragms = model.diaphragms.filter(item => item.levelId === level.id);
    const existing = diaphragms[0];
    if (diaphragms.length > 1 || (existing && existing.type !== "rigid")) {
      throw new Error(`Level ${level.name} must use one rigid diaphragm for seismic assignment.`);
    }
    const slabs = model.surfaces.filter(surface => surface.type === "slab" &&
      surface.boundaryNodeIds.length >= 3 &&
      surface.boundaryNodeIds.every(id => Math.abs((nodes.get(id)?.position.z ?? Infinity) - level.elevation) <= 1e-6));
    if (slabs.length !== 1 || (existing?.surfaceIds.length && (existing.surfaceIds.length !== 1 || existing.surfaceIds[0] !== slabs[0]?.id))) {
      throw new Error(`Level ${level.name} needs one continuous floor slab covering its rigid diaphragm.`);
    }
    const slab = slabs[0];
    const corners = slab.boundaryNodeIds.map(id => nodes.get(id)!.position);
    const perpendicular = axis === "x" ? "y" : "x";
    const coordinates = corners.map(corner => corner[perpendicular]);
    const modelWidth = Math.max(...coordinates) - Math.min(...coordinates);
    if (forceKN > 0) {
      const exportWidth = (torsionPlusKNm - torsionMinusKNm) / (0.20 * forceKN);
      if (Math.abs(modelWidth - exportWidth) > Math.max(0.001, modelWidth * 1e-6)) {
        throw new Error(`The calculator width perpendicular to ${axis.toUpperCase()} does not match ${level.name}.`);
      }
    }
    const origin = corners[0];
    let doubledArea = 0, weightedX = 0, weightedY = 0;
    corners.forEach((corner, i) => {
      const next = corners[(i + 1) % corners.length];
      const ax = corner.x - origin.x, ay = corner.y - origin.y;
      const bx = next.x - origin.x, by = next.y - origin.y;
      const cross = ax * by - bx * ay;
      doubledArea += cross;
      weightedX += (ax + bx) * cross;
      weightedY += (ay + by) * cross;
    });
    if (!Number.isFinite(doubledArea) || Math.abs(doubledArea) <= 1e-8) {
      throw new Error(`Floor slab on ${level.name} has no usable plan area.`);
    }
    const position = { x: origin.x + weightedX / (3 * doubledArea), y: origin.y + weightedY / (3 * doubledArea), z: level.elevation };
    const diaphragmId = existing?.id ?? `seismic-rigid-${level.id}`;
    const priorReference = existing?.constraint?.referenceNodeId;
    const referenceId = priorReference ?? `seismic-centroid-${level.id}`;
    const previous = nodes.get(referenceId);
    if (previous && Math.hypot(previous.position.x - position.x, previous.position.y - position.y, previous.position.z - position.z) > 1e-6) {
      throw new Error(`The diaphragm reference on ${level.name} no longer matches the floor centroid.`);
    }
    if ((priorReference && !previous) || (!existing && diaphragmsById.has(diaphragmId)) ||
        (!priorReference && previous) || (existing?.constraint?.analysisPolicy && existing.constraint.analysisPolicy !== "rigid-constraint")) {
      throw new Error(`Check the rigid diaphragm reference on ${level.name}.`);
    }
    if (existing && !priorReference && model.loads.some(load => load.type === "diaphragm" && load.diaphragmId === diaphragmId)) {
      throw new Error(`Level ${level.name} already has diaphragm loads. Confirm its centroid reference before adding seismic loads.`);
    }
    const diaphragm: Diaphragm = {
      ...existing, id: diaphragmId, type: "rigid", levelId: level.id, surfaceIds: [slab.id],
      nodeIds: [...new Set([...(existing?.nodeIds ?? []), referenceId])],
      constraint: { ...existing?.constraint, referenceNodeId: referenceId, analysisPolicy: "rigid-constraint" },
    };
    diaphragmsById.set(diaphragmId, diaphragm);
    if (!previous) nodes.set(referenceId, { id: referenceId, position, levelId: level.id });
    loadPoints.push({ levelId: level.id, ...position });
    return diaphragmId;
  });
  const axisLabel = axis.toUpperCase();
  const id = `seismic-static-${axis}`;
  const source: LoadSource = {
    id,
    category: "seismic",
    name: `NBCC 2020 static seismic · ${axisLabel}`,
    calculator: "seismic",
    codeEdition: result.codeEdition,
    status: "generated",
    inputs: { ...result, direction: axisLabel },
    summary: { loadPoints, reference: "Verified centre of mass at the floor plan centroid", appliedTorsion: "Accidental only; inherent eccentricity follows from the model geometry" },
  };
  const cases: LoadCase[] = [];
  const loads: DiaphragmLoad[] = [];
  for (const sign of [1, -1]) {
    for (const torsion of ["plus", "minus"] as const) {
      const caseId = `${id}-${sign === 1 ? "positive" : "negative"}-${torsion}`;
      cases.push({ id: caseId, category: "seismic", name: `Seismic ${sign === 1 ? "+" : "-"}${axisLabel} · torsion ${torsion}`, sourceId: id, analysisType: "static" });
      result.storeys.forEach((row, index) => {
        loads.push({
          id: `${caseId}-${index + 1}`, type: "diaphragm", diaphragmId: targetIds[index], loadCaseId: caseId,
          force: { x: axis === "x" ? row.forceKN * sign : 0, y: axis === "y" ? row.forceKN * sign : 0, z: 0 },
          // The engine moments are about the centre of resistance. Placing force at the
          // verified mass centre already produces the inherent eccentricity in the model.
          moment: { x: 0, y: 0, z: sign * (torsion === "plus" ? 1 : -1) * (row.torsionPlusKNm - row.torsionMinusKNm) / 2 },
          forceUnit: "kN", momentUnit: "kN*m", provenance: { sourceId: id, calculatorRunId: id },
        });
      });
    }
  }
  const ids = new Set(cases.map(item => item.id));
  return {
    ...model,
    nodes: [...nodes.values()],
    diaphragms: [...diaphragmsById.values()],
    loadSources: [...(model.loadSources ?? []).filter(item => item.id !== id), source],
    loadCases: [...model.loadCases.filter(item => !ids.has(item.id)), ...cases],
    loads: [...model.loads.filter(item => item.provenance?.sourceId !== id), ...loads],
  };
}
