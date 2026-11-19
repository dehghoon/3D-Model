import type { Level, SurfaceType, Vec3 } from "@linkoteq/structural-core";
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
    areas?: Array<{sourceId:string;boundaryNodeIds:string[];sourceLine?:number;sourceGuid?:string|null;sourceSectionAssignment?:{section?:string|null;materialProperty?:string|null;sourceLine?:number}|null;geometryOnly?:boolean}>;
    grids: unknown;
    sourceLevels: unknown;
    definedLevels?: Array<{name:string;elevation:number;sourceLine:number}>;
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
  if (v.geometryPreview.definedLevels !== undefined &&
      (!Array.isArray(v.geometryPreview.definedLevels) || v.geometryPreview.definedLevels.some(
        level=>!level || typeof level.name!=="string" || !level.name.trim() || !Number.isFinite(level.elevation)))) {
    throw new Error("SAP_HANDOFF_LEVEL_INVALID");
  }
  const archive=v.sourceArchive;
  if (typeof archive.filename!=="string" || !archive.filename.toLowerCase().match(/[.](s2k|[$]2k)$/) ||
      !Number.isSafeInteger(archive.byteLength) || archive.byteLength<0 ||
      typeof archive.bytesBase64!=="string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(archive.bytesBase64) ||
      (archive.bytesBase64.length/4*3 - (archive.bytesBase64.endsWith("==")?2:archive.bytesBase64.endsWith("=")?1:0))!==archive.byteLength)
    throw new Error("SAP_HANDOFF_SOURCE_ARCHIVE_INVALID");
  if (!v.geometryPreview.nodes.length) throw new Error("SAP_HANDOFF_EMPTY_GEOMETRY");
  const ids=new Set<string>();
  for (const n of v.geometryPreview.nodes) {
    if (!n.sourceId || ids.has(n.sourceId) || !n.position ||
        ![n.position.x,n.position.y,n.position.z].every(Number.isFinite)) throw new Error("SAP_HANDOFF_NODE_INVALID");
    ids.add(n.sourceId);
  }
  const memberIds=new Set<string>();
  for (const m of v.geometryPreview.members) {
    if (!m.sourceId || memberIds.has(m.sourceId) || !ids.has(m.startNodeId) ||
        !ids.has(m.endNodeId) || m.startNodeId===m.endNodeId ||
        typeof m.renderable!=="boolean") throw new Error("SAP_HANDOFF_FRAME_INVALID");
    memberIds.add(m.sourceId);
  }
  const areaIds=new Set<string>();
  for (const area of v.geometryPreview.areas ?? []) {
    if (!area.sourceId || areaIds.has(area.sourceId) || !Array.isArray(area.boundaryNodeIds) ||
        area.boundaryNodeIds.length<3 || new Set(area.boundaryNodeIds).size!==area.boundaryNodeIds.length ||
        area.boundaryNodeIds.some(id=>!ids.has(id))) throw new Error("SAP_HANDOFF_AREA_INVALID");
    areaIds.add(area.sourceId);
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
  if(!preview || typeof preview!=="object" || Array.isArray(preview)) return {...model,grids:[]};
  const lines=(preview as {gridLines?:unknown}).gridLines;
  if(!Array.isArray(lines)) return {...model,grids:[]};
  const positions=handoff.geometryPreview.nodes;
  if(!positions.length) return {...model,grids:[]};
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
    const g=item as {id?:unknown;displayLabel?:unknown;axis?:unknown;coordinate?:unknown;coordinateSystem?:unknown};
    if(g.coordinateSystem!=="GLOBAL" || (g.axis!=="X" && g.axis!=="Y") ||
      typeof g.id!=="string" || !g.id.trim()) continue;
    if(typeof g.coordinate!=="string" || !g.coordinate.trim()) continue;
    const coordinate=Number(g.coordinate);
    if(!Number.isFinite(coordinate)) continue;
    const id="sap-source-grid-"+index;
    if(usedIds.has(id)) continue;
    usedIds.add(id);
    grids.push({
      id,label:typeof g.displayLabel === "string" ? g.displayLabel : g.id,
      start:g.axis==="X"?{x:coordinate,y:minY-margin,z:0}:{x:minX-margin,y:coordinate,z:0},
      end:g.axis==="X"?{x:coordinate,y:maxY+margin,z:0}:{x:maxX+margin,y:coordinate,z:0},
    });
  }
  // Preserve all source grids (including deferred/Z grids) in handoff.
  // Do not present the proxy as a validated or analysis-ready model.
  return {...model,grids};
}

function importedLevels(handoff: SapHandoff): Level[] {
  const source = handoff.geometryPreview.definedLevels;
  if (source?.length) {
    return source.map(({name,elevation},i)=>({id:"SAP-L-"+i,name,elevation}))
      .sort((a,b)=>a.elevation-b.elevation);
  }
  const gridPreview = handoff.geometryPreview.grids as {gridLines?: Array<{id?:string;axis?:string;coordinate?:string;coordinateSystem?:string;displayLabel?:string}>} | null;
  const elevationGrids = gridPreview?.gridLines?.filter(grid =>
    grid.coordinateSystem === "GLOBAL" && grid.axis === "Z" &&
    typeof grid.coordinate === "string" && grid.coordinate.trim() && Number.isFinite(Number(grid.coordinate)));
  if (elevationGrids?.length) {
    return elevationGrids.map((grid,i)=>({
      id:"SAP-L-"+i,name:grid.displayLabel || grid.id || "Elevation grid",elevation:Number(grid.coordinate),
    })).sort((a,b)=>a.elevation-b.elevation);
  }
  const heights = handoff.geometryPreview.nodes.map(n => n.position.z).sort((a,b) => a-b);
  if (!heights.length) return [];
  const tolerance = Math.max(1e-8, (heights.at(-1)! - heights[0]) * 1e-6);
  const clusters: Array<{elevation:number;count:number}> = [];
  for (const elevation of heights) {
    const last = clusters.at(-1);
    if (last && elevation-last.elevation <= tolerance) last.count++;
    else clusters.push({elevation, count:1});
  }
  const minimum = Math.max(2, Math.ceil(heights.length * 0.015));
  const levels = clusters.filter(item => item.count >= minimum);
  if (!levels.length) levels.push(clusters.reduce((a,b) => a.count >= b.count ? a : b));
  return levels.map(({elevation},i) => ({id:"SAP-L-"+i,name:"Inferred level "+(i+1),elevation}));
}

/** Geometric editor classification. Source section names never certify design behavior. */
function importedSurfaceType(points: Vec3[]): SurfaceType {
  const origin = points[0];
  let nx=0, ny=0, nz=0, extent=0;
  for (let i=1; i<points.length; i++) {
    const a=points[i], b=points[(i+1)%points.length];
    const ax=a.x-origin.x, ay=a.y-origin.y, az=a.z-origin.z;
    const bx=b.x-origin.x, by=b.y-origin.y, bz=b.z-origin.z;
    nx+=ay*bz-az*by; ny+=az*bx-ax*bz; nz+=ax*by-ay*bx;
    extent=Math.max(extent,Math.hypot(ax,ay,az));
  }
  const norm=Math.hypot(nx,ny,nz);
  if (norm<=extent*extent*1e-10) return "other";
  if (points.some(p => Math.abs((p.x-origin.x)*nx+(p.y-origin.y)*ny+(p.z-origin.z)*nz) >
      norm*Math.max(1e-8,extent*1e-6))) return "other";
  const vertical=Math.abs(nz)/norm;
  if (vertical>=0.9999) return "slab";
  if (vertical<=0.014) return "wall";
  return "other";
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
  const sourcePositions = new Map(handoff.geometryPreview.nodes.map(node => [node.sourceId,node.position]));
  const levels = importedLevels(handoff);
  const nearestLevel = (z:number) => levels.reduce((best,level) =>
    Math.abs(level.elevation-z)<Math.abs(best.elevation-z)?level:best,levels[0]).id;
  // The editor needs catalog IDs for geometry tools, but these are NOT SAP assignments.
  // Mark every proxy member explicitly so downstream analysis cannot mistake them
  // for validated imported engineering properties.
  const materialId = template.materials[0]?.id;
  const sectionId = template.sections[0]?.id;
  if (!materialId || !sectionId || !levels.length) throw new Error("SAP_EDITABLE_PROJECTION_REQUIRES_CATALOG_AND_LEVELS");
  const nodes = handoff.geometryPreview.nodes.map(node => ({
    id: ids.get(node.sourceId)!,
    position: {...node.position},
    levelId:nearestLevel(node.position.z),
  }));
  const members: import("@linkoteq/structural-core").StructuralModel["members"] =
    handoff.geometryPreview.members.map((member,i) => {
      const a = sourcePositions.get(member.startNodeId)!;
      const b = sourcePositions.get(member.endNodeId)!;
      const vertical = Math.abs(a.z-b.z);
      const horizontal = Math.hypot(a.x-b.x,a.y-b.y);
      const type: "beam"|"column"|"brace" =
        vertical > 1e-7 && horizontal > 1e-7 ? "brace" :
        vertical > horizontal ? "column" : "beam";
      return {
        id:"SAP-M-"+i, type,
        startNodeId:ids.get(member.startNodeId)!,
        endNodeId:ids.get(member.endNodeId)!,
        materialId,sectionId,
        levelId:nearestLevel(Math.max(a.z,b.z)),
        metadata:{sourceFormat:"SAP2000",sourceMemberId:member.sourceId,
          sourceEngineeringAssignment:"unresolved",geometryOnly:true,
          engineeringValidationRequired:true},
      };
    });
  const surfaces: import("@linkoteq/structural-core").StructuralModel["surfaces"] =
    (handoff.geometryPreview.areas ?? []).map((area,i)=>({
      id:"SAP-A-"+i,
      type:importedSurfaceType(area.boundaryNodeIds.map(id=>sourcePositions.get(id)!)),
      boundaryNodeIds:area.boundaryNodeIds.map(id=>ids.get(id)!),
      metadata:{sourceFormat:"SAP2000",sourceAreaId:area.sourceId,
        ...(area.sourceLine !== undefined ? {sourceAreaLine:area.sourceLine} : {}),
        ...(area.sourceGuid ? {sourceAreaGuid:area.sourceGuid} : {}),
        ...(area.sourceSectionAssignment?.section ? {sourceSectionName:area.sourceSectionAssignment.section} : {}),
        ...(area.sourceSectionAssignment?.materialProperty ? {sourceMaterialProperty:area.sourceSectionAssignment.materialProperty} : {}),
        sourceEngineeringAssignment:"unresolved",geometryOnly:true,
        engineeringValidationRequired:true},
    }));
  const projected = projectSapGridsForGridTool(template,handoff);
  // A template may carry Quick Frame metadata; retaining it can trigger an
  // asynchronous catalog refresh that regenerates and destroys SAP geometry.
  const {simpleFrame: _discardTemplateFrame, ...projectMetadata} = projected.project.metadata ?? {};
  return {
    ...projected,
    project:{...projected.project,metadata:{
      ...projectMetadata,
      sourceFormat:"SAP2000",
      sourceHash:handoff.sourceHash,
      sapSourceUnits:handoff.geometryPreview.sourceUnits,
      importGeometryStatus:"editable-unverified",
      importedSectionMaterialAssignments:"unresolved-proxy-only",
      analysisReady:false,
    }},
    // A new SAP import replaces the previous model geometry. Never retain
    // unrelated native surfaces or load data from the template project.
    // SAP areas/loads must be mapped explicitly before they are editable.
    nodes,members,levels,
    surfaces,
    supports:[],
    diaphragms:[],
    loadCases:[],
    loads:[],
    loadCombinations:[],
  };
}

/**
 * Compare the editable workspace against the immutable SAP source projection.
 * Edits do not mutate the source archive and cannot certify an analytical model.
 */
export function auditSapGeometryEdits(
  current: import("@linkoteq/structural-core").StructuralModel,
  original: import("@linkoteq/structural-core").StructuralModel,
): { movedNodes:string[]; changedMembers:string[]; addedNodes:string[]; addedMembers:string[]; deletedNodes:string[]; deletedMembers:string[] } {
  const previousNodes=new Map(original.nodes.map(n=>[n.id,n]));
  const currentNodes=new Map(current.nodes.map(n=>[n.id,n]));
  const previousMembers=new Map(original.members.map(m=>[m.id,m]));
  const currentMembers=new Map(current.members.map(m=>[m.id,m]));
  return {
    movedNodes:current.nodes.filter(n=>{const old=previousNodes.get(n.id);return old && (old.position.x!==n.position.x || old.position.y!==n.position.y || old.position.z!==n.position.z);}).map(n=>n.id),
    changedMembers:current.members.filter(m=>{const old=previousMembers.get(m.id);return old && JSON.stringify(old)!==JSON.stringify(m);}).map(m=>m.id),
    addedNodes:current.nodes.filter(n=>!previousNodes.has(n.id)).map(n=>n.id),
    addedMembers:current.members.filter(m=>!previousMembers.has(m.id)).map(m=>m.id),
    deletedNodes:original.nodes.filter(n=>!currentNodes.has(n.id)).map(n=>n.id),
    deletedMembers:original.members.filter(m=>!currentMembers.has(m.id)).map(m=>m.id),
  };
}
