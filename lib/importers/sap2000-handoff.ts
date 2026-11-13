/**
 * Transport-only SAP2000 handoff checks. This is NOT Core validation.
 * Geometry retains SAP source units; do not cast it to StructuralModel.
 */
export interface SapPoint { x: number; y: number; z: number }
export interface SapPreviewNode { sourceId: string; position: SapPoint; sourceLine?: number }
export interface SapPreviewMember {
  sourceId: string; startNodeId: string; endNodeId: string;
  renderable: boolean; sourceLine?: number;
}
export interface SapHandoff {
  format: "linkoteq-sap2000-gpt3-handoff-v1";
  canonicalMappingValidated: false;
  analysisReady: false;
  geometryPreview: {
    sourceUnits: unknown;
    coordinatesConvertedToSI: false;
    nodes: SapPreviewNode[];
    members: SapPreviewMember[];
    grids: unknown;
    sourceLevels: unknown;
    inferredLevels: unknown;
  };
  engineeringData: unknown;
  importFidelity: unknown;
  diagnostics: unknown;
  sourceArchive: { filename: string; encoding: "base64"; bytesBase64: string; sha256: string };
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const point = (v: unknown): v is SapPoint =>
  record(v) && ["x", "y", "z"].every(k => typeof v[k] === "number" && Number.isFinite(v[k]));
export function readSapHandoff(input: unknown): SapHandoff {
  if (!record(input) || input.format !== "linkoteq-sap2000-gpt3-handoff-v1")
    throw new Error("SAP_HANDOFF_FORMAT_INVALID");
  if (input.canonicalMappingValidated !== false || input.analysisReady !== false)
    throw new Error("SAP_HANDOFF_UNEXPECTED_VALIDATION_STATUS");
  const preview = input.geometryPreview;
  if (!record(preview) || preview.coordinatesConvertedToSI !== false ||
      !Array.isArray(preview.nodes) || !Array.isArray(preview.members))
    throw new Error("SAP_HANDOFF_GEOMETRY_INVALID");
  const ids = new Set<string>();
  for (const node of preview.nodes) {
    if (!record(node) || typeof node.sourceId !== "string" || !node.sourceId ||
        !point(node.position) || ids.has(node.sourceId))
      throw new Error("SAP_HANDOFF_NODE_INVALID");
    ids.add(node.sourceId);
  }
  const members = new Set<string>();
  for (const member of preview.members) {
    if (!record(member) || typeof member.sourceId !== "string" || !member.sourceId ||
        members.has(member.sourceId) || typeof member.startNodeId !== "string" ||
        typeof member.endNodeId !== "string" || typeof member.renderable !== "boolean")
      throw new Error("SAP_HANDOFF_MEMBER_INVALID");
    members.add(member.sourceId);
    if (member.renderable && (!ids.has(member.startNodeId) || !ids.has(member.endNodeId)))
      throw new Error("SAP_HANDOFF_CONNECTIVITY_INVALID");
  }
  if (!record(input.sourceArchive) || input.sourceArchive.encoding !== "base64" ||
      typeof input.sourceArchive.bytesBase64 !== "string" ||
      typeof input.sourceArchive.sha256 !== "string" ||
      !("importFidelity" in input) || !("engineeringData" in input) ||
      !("diagnostics" in input))
    throw new Error("SAP_HANDOFF_FIDELITY_MISSING");
  return input as unknown as SapHandoff;
}
