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

/**
 * Source-only projection for the existing Grid tool. This is NOT a validated
 * analytical Core import: source units and original metadata stay in SapHandoff.
 * Only GLOBAL Cartesian X/Y lines can be represented by the offset Grid tool.
 */
export function projectSapGridsForGridTool(
  model: import("@linkoteq/structural-core").StructuralModel,
  handoff: SapHandoff,
): import("@linkoteq/structural-core").StructuralModel {
  const preview=handoff.geometryPreview.grids;
  if(!preview || typeof preview!=="object" || Array.isArray(preview)) return model;
  const lines=(preview as {gridLines?:unknown}).gridLines;
  if(!Array.isArray(lines)) return model;
  const positions=handoff.geometryPreview.nodes;
  if(!positions.length) return model;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const {position:p} of positions){
    if(p.x<minX) minX=p.x;
    if(p.x>maxX) maxX=p.x;
    if(p.y<minY) minY=p.y;
    if(p.y>maxY) maxY=p.y;
  }
  const margin=Math.max(maxX-minX,maxY-minY,1)*0.05;
  const grids: import("@linkoteq/structural-core").GridLine[]=[];
  const usedIds=new Set<string>();
  for(const [index,item] of lines.entries()){
    if(!item || typeof item!=="object") continue;
    const g=item as {id?:unknown;axis?:unknown;coordinate?:unknown;coordinateSystem?:unknown};
    if(g.coordinateSystem!=="GLOBAL" || (g.axis!=="X" && g.axis!=="Y") ||
      typeof g.id!=="string" || !g.id.trim()) continue;
    if(typeof g.coordinate!=="string" || !g.coordinate.trim()) continue;
    const coordinate=Number(g.coordinate);
    if(!Number.isFinite(coordinate)) continue;
    const id="sap-source-grid-"+index;
    if(usedIds.has(id)) continue;
    usedIds.add(id);
    grids.push({
      id,label:g.id,
      start:g.axis==="X"?{x:coordinate,y:minY-margin,z:0}:{x:minX-margin,y:coordinate,z:0},
      end:g.axis==="X"?{x:coordinate,y:maxY+margin,z:0}:{x:maxX+margin,y:coordinate,z:0},
    });
  }
  // Preserve all source grids (including deferred/Z grids) in handoff.
  // Do not present the proxy as a validated or analysis-ready model.
  return {...model,grids};
}

/**
 * Editable geometry projection. This is deliberately NOT an analytical import:
 * the immutable source archive, engineering assignments and fidelity diagnostics
 * remain in SapHandoff until a verified semantic mapper can reconcile edits.
 */
export function projectSapGeometryForEditing(
  template: import("@linkoteq/structural-core").StructuralModel,
  handoff: SapHandoff,
): import("@linkoteq/structural-core").StructuralModel {
  const ids = new Map(handoff.geometryPreview.nodes.map((node, i) => [node.sourceId, "SAP-N-" + i]));
  const levels = [...template.levels];
  const fallbackLevel = levels[0]?.id;
  const materialId = template.materials[0]?.id;
  const sectionId = template.sections[0]?.id;
  if (!materialId || !sectionId) throw new Error("SAP_EDITABLE_PROJECTION_REQUIRES_CATALOG");
  const nodes = handoff.geometryPreview.nodes.map(node => ({
    id: ids.get(node.sourceId)!,
    position: {...node.position},
    ...(fallbackLevel ? {levelId:fallbackLevel} : {}),
  }));
  const members: import("@linkoteq/structural-core").StructuralModel["members"] =
    handoff.geometryPreview.members.map((member,i) => {
      const a = handoff.geometryPreview.nodes.find(node=>node.sourceId===member.startNodeId)?.position;
      const b = handoff.geometryPreview.nodes.find(node=>node.sourceId===member.endNodeId)?.position;
      const type: "beam"|"column"|"brace" = a && b && Math.abs(a.z-b.z)>Math.hypot(a.x-b.x,a.y-b.y)*2 ? "column" : "beam";
      return {
        id:"SAP-M-"+i, type,
        startNodeId:ids.get(member.startNodeId)!,
        endNodeId:ids.get(member.endNodeId)!,
        materialId,sectionId,
        ...(fallbackLevel ? {levelId:fallbackLevel} : {}),
      };
    });
  const projected = projectSapGridsForGridTool(template,handoff);
  return {
    ...projected,
    project:{...projected.project,metadata:{
      ...projected.project.metadata,
      sourceFormat:"SAP2000",
      sourceHash:handoff.sourceHash,
      importGeometryStatus:"editable-unverified",
    }},
    nodes,members,
  };
}
