/** Source-only geometry. Never represent this as a validated Core StructuralModel. */
export interface SapHandoff {
  format: "linkoteq-sap2000-gpt3-handoff-v1";
  sourceHash: string;
  coreModel: null;
  canonicalMappingValidated: false;
  analysisReady: false;
  geometryPreview: {
    sourceUnits: string | null;
    nodes: Array<{sourceId:string;position:{x:number;y:number;z:number}}>;
    members: Array<{sourceId:string;startNodeId:string;endNodeId:string;renderable:boolean}>;
    grids: unknown;
    sourceLevels: unknown;
    inferredLevels: Array<{id:string;name:string;elevation:number;provenance:string;sourceDefined:false}>;
    propertyAssignments: unknown;
  };
  engineeringData: Record<string,unknown>;
  sourceArchive: {filename:string;sha256:string;byteLength:number;bytesBase64:string};
  importFidelity: Record<string,unknown>;
  diagnostics: Record<string,unknown>;
}
export function readSapHandoff(raw:unknown):SapHandoff {
  if (!raw || typeof raw!=="object") throw new Error("SAP_HANDOFF_INVALID");
  const v=raw as Partial<SapHandoff>;
  if (v.format!=="linkoteq-sap2000-gpt3-handoff-v1" || v.coreModel!==null ||
      v.canonicalMappingValidated!==false || v.analysisReady!==false ||
      !v.geometryPreview || !Array.isArray(v.geometryPreview.nodes) ||
      !Array.isArray(v.geometryPreview.members) || !v.sourceArchive ||
      !v.sourceHash || v.sourceArchive.sha256!==v.sourceHash ||
      !v.engineeringData || !v.importFidelity || !v.diagnostics) throw new Error("SAP_HANDOFF_CONTRACT_MISMATCH");
  const ids=new Set<string>();
  for (const n of v.geometryPreview.nodes) {
    if (!n.sourceId || ids.has(n.sourceId) || !n.position ||
        ![n.position.x,n.position.y,n.position.z].every(Number.isFinite)) throw new Error("SAP_HANDOFF_NODE_INVALID");
    ids.add(n.sourceId);
  }
  for (const m of v.geometryPreview.members) {
    if (!m.sourceId || !ids.has(m.startNodeId) || !ids.has(m.endNodeId)) throw new Error("SAP_HANDOFF_FRAME_INVALID");
  }
  return v as SapHandoff;
}
