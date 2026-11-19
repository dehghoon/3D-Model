import type { DiaphragmLoad, LoadCase, LoadSource, StructuralModel } from "@linkoteq/structural-core";

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
    Number.isFinite(row.torsionPlusKNm) && Number.isFinite(row.torsionMinusKNm))) {
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
  const targetIds = result.storeys.map(({ heightM }, index) => {
    const level = levels[index + 1];
    if (Math.abs(level.elevation - base - heightM) > 1e-6) {
      throw new Error(`The exported storey at ${heightM} m does not match model level ${level.name}.`);
    }
    const diaphragms = model.diaphragms.filter(item => item.levelId === level.id);
    if (diaphragms.length !== 1 || diaphragms[0].type !== "rigid") {
      throw new Error(`Level ${level.name} needs exactly one rigid diaphragm for seismic assignment.`);
    }
    return diaphragms[0].id;
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
          moment: { x: 0, y: 0, z: sign * (torsion === "plus" ? row.torsionPlusKNm : row.torsionMinusKNm) },
          forceUnit: "kN", momentUnit: "kN*m", provenance: { sourceId: id, calculatorRunId: id },
        });
      });
    }
  }
  const ids = new Set(cases.map(item => item.id));
  return {
    ...model,
    loadSources: [...(model.loadSources ?? []).filter(item => item.id !== id), source],
    loadCases: [...model.loadCases.filter(item => !ids.has(item.id)), ...cases],
    loads: [...model.loads.filter(item => item.provenance?.sourceId !== id), ...loads],
  };
}
