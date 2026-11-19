import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";

/**
 * Source-only preview from importer Import Result 0.1.0.
 * It MUST NOT be treated as an analytically valid Core model.
 */
type Dict = Record<string, unknown>;
const record = (value: unknown): value is Dict =>
  !!value && typeof value === "object" && !Array.isArray(value);
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string => typeof value === "string" ? value : "";
const fail = (reason: string): never => { throw new Error("SAP_PREVIEW_" + reason); };
const finite = (value: unknown, label: string): number => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) fail(label);
  const number = Number(value);
  if (!Number.isFinite(number)) fail(label);
  return number;
};

export interface SapSourcePreview {
  kind: "sap2000-source-preview-not-analysis-ready";
  sourceHash: string;
  filename: string;
  unitsDeclaration: string | null;
  nodes: Array<{ id: string; sourceId: string; positionSourceUnits: Vec3 }>;
  frames: Array<{ id: string; sourceId: string; startNodeId: string; endNodeId: string }>;
  gridAudit: unknown;
  levelAudit: unknown;
  diagnostics: string[];
  sourceResult: unknown;
  analysisReady: false;
}

/** Only importer-owned source views are accepted; no fabricated analytical sections. */
export function readSapSourcePreview(value: unknown): SapSourcePreview {
  if (!record(value) || value.contract !== "linkoteq.import-result" ||
    value.version !== "0.1.0" || value.sourceFormat !== "sap2000" ||
    value.coreModel !== null || value.coreMappingStatus !== "not-validated") {
    return fail("IMPORT_RESULT_CONTRACT_REQUIRED");
  }
  const source = value.source;
  if (!record(source) || !string(source.sourceHash)) return fail("SOURCE_HASH_REQUIRED");
  const views = value.sourceViews;
  if (!record(views)) return fail("SOURCE_VIEWS_REQUIRED");
  const nodes = array(views.nodes).map((raw, i) => {
    if (!record(raw) || !string(raw.id) || !string(raw.sourceId) ||
      !Array.isArray(raw.coordinatesSourceUnits) || raw.coordinatesSourceUnits.length !== 3) {
      return fail("NODE_INVALID_" + i);
    }
    const [x, y, z] = raw.coordinatesSourceUnits;
    return { id: string(raw.id), sourceId: string(raw.sourceId),
      positionSourceUnits: { x: finite(x, "X_" + i), y: finite(y, "Y_" + i), z: finite(z, "Z_" + i) } };
  });
  const nodeIds = new Map<string, string>();
  const stableIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.sourceId) || stableIds.has(node.id)) fail("DUPLICATE_NODE");
    nodeIds.set(node.sourceId, node.id);
    stableIds.add(node.id);
  }
  const seenFrames = new Set<string>();
  const frames = array(views.frames).map((raw, i) => {
    if (!record(raw) || !string(raw.id) || !string(raw.sourceId) ||
      !string(raw.startSourceId) || !string(raw.endSourceId)) return fail("FRAME_INVALID_" + i);
    const id = string(raw.id);
    if (seenFrames.has(id)) return fail("DUPLICATE_FRAME");
    seenFrames.add(id);
    const startNodeId = nodeIds.get(string(raw.startSourceId));
    const endNodeId = nodeIds.get(string(raw.endSourceId));
    if (!startNodeId || !endNodeId) return fail("UNRESOLVED_FRAME_NODE_" + i);
    return { id, sourceId: string(raw.sourceId), startNodeId, endNodeId };
  });
  const fidelity = record(value.importFidelity) ? value.importFidelity :
    record(value.fidelity) ? value.fidelity : {};
  // The current Import Result stores an inventory, while the separate v0.6
  // gate report carries sourceGridAudit/sourceLevelAudit under importFidelity.
  // Accept an explicitly bundled gate report only after the source hashes match.
  const gate = record(value.sap2000V06GateReport) ? value.sap2000V06GateReport : null;
  if (gate && (gate.sourceHash !== source.sourceHash || gate.coreModel !== null ||
    gate.canonicalMappingValidated !== false || gate.analysisReady !== false)) {
    return fail("GATE_REPORT_MISMATCH");
  }
  const gateFidelity = gate && record(gate.importFidelity) ? gate.importFidelity : {};
  const sourceGridAudit = fidelity.sourceGridAudit ?? gateFidelity.sourceGridAudit ?? value.sourceGridAudit ?? null;
  const sourceLevelAudit = fidelity.sourceLevelAudit ?? gateFidelity.sourceLevelAudit ?? value.sourceLevelAudit ?? null;
  return {
    kind: "sap2000-source-preview-not-analysis-ready",
    sourceHash: string(source.sourceHash),
    filename: string(source.originalFilename) || "SAP2000 source",
    unitsDeclaration: string(value.sourceUnitsDeclaration) || null,
    nodes, frames,
    gridAudit: sourceGridAudit,
    levelAudit: sourceLevelAudit,
    diagnostics: array(value.diagnostics).map(String),
    sourceResult: value,
    analysisReady: false,
  };
}

/**
 * UI-only drawing proxy. NEVER use the proxy as an imported Core engineering model.
 * Geometry is in source units, as expressed by the unconverted importer.
 */
export function createSapPreviewDrawing(preview: SapSourcePreview): {
  segments: Array<{ id: string; start: Vec3; end: Vec3 }>;
} {
  const nodes = new Map(preview.nodes.map(node => [node.id, node.positionSourceUnits]));
  return { segments: preview.frames.map(frame => ({
    id: frame.id,
    start: nodes.get(frame.startNodeId)!,
    end: nodes.get(frame.endNodeId)!,
  })) };
}

export function isSapPreview(value: unknown): value is SapSourcePreview {
  return record(value) && value.kind === "sap2000-source-preview-not-analysis-ready" &&
    value.analysisReady === false;
}

// Type-level separation: no conversion to StructuralModel is exported.
export type CanonicalModelOnly = StructuralModel;
