import type { StructuralModel, Surface, SurfaceType } from "@linkoteq/structural-core";

export interface CreateSurfaceInput {
  type: SurfaceType;
  boundaryNodeIds: string[];
  levelId?: string;
  materialId?: string;
}

function nextSurfaceId(surfaces: Surface[]): string {
  const used = new Set(surfaces.map((surface) => surface.id));
  let index = 1;
  while (used.has(`S${index}`)) index += 1;
  return `S${index}`;
}

function optionalId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Reject degenerate area boundaries before committing editable Core geometry. */
function validateSurfaceGeometry(model: StructuralModel, ids: string[]): void {
  const byId = new Map(model.nodes.map(node => [node.id, node.position]));
  const points = ids.map(id => byId.get(id));
  if (points.some(point => !point)) return; // Unknown node IDs are reported by the caller.
  const vertices = points as Array<{x:number;y:number;z:number}>;
  const scale = Math.max(1, ...vertices.flatMap(p => [Math.abs(p.x),Math.abs(p.y),Math.abs(p.z)]));
  const tolerance = scale * 1e-10;
  for (let i=0;i<vertices.length;i++) for(let j=i+1;j<vertices.length;j++) {
    const a=vertices[i],b=vertices[j];
    if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<=tolerance)
      throw new Error("SURFACE_COINCIDENT_BOUNDARY_NODES");
  }
  const origin=vertices[0];
  let nonCollinear=false;
  for(let i=1;i<vertices.length-1 && !nonCollinear;i++){
    const a=vertices[i],b=vertices[i+1];
    const ux=a.x-origin.x,uy=a.y-origin.y,uz=a.z-origin.z;
    const vx=b.x-origin.x,vy=b.y-origin.y,vz=b.z-origin.z;
    const area=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx);
    if(area>tolerance*tolerance) nonCollinear=true;
  }
  if(!nonCollinear) throw new Error("SURFACE_COLLINEAR_BOUNDARY_NODES");
  // Newell normal provides a stable best-fit plane for arbitrary 3D polygons.
  let nx=0,ny=0,nz=0;
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length];
    nx+=(a.y-b.y)*(a.z+b.z);
    ny+=(a.z-b.z)*(a.x+b.x);
    nz+=(a.x-b.x)*(a.y+b.y);
  }
  const norm=Math.hypot(nx,ny,nz);
  if(norm<=tolerance*tolerance) throw new Error("SURFACE_ZERO_PROJECTED_AREA");
  // Project to the plane with the largest normal component, then reject crossing edges.
  const axis=Math.abs(nx)>=Math.abs(ny) && Math.abs(nx)>=Math.abs(nz) ? "x" :
    Math.abs(ny)>=Math.abs(nz) ? "y" : "z";
  const projected=vertices.map(p=>axis==="x" ? {u:p.y,v:p.z} :
    axis==="y" ? {u:p.x,v:p.z} : {u:p.x,v:p.y});
  const orient=(a:{u:number;v:number},b:{u:number;v:number},p:{u:number;v:number})=>
    (b.u-a.u)*(p.v-a.v)-(b.v-a.v)*(p.u-a.u);
  const intersects=(a:{u:number;v:number},b:{u:number;v:number},p:{u:number;v:number},q:{u:number;v:number})=>{
    const abp=orient(a,b,p),abq=orient(a,b,q),pqa=orient(p,q,a),pqb=orient(p,q,b);
    const eps=tolerance*tolerance;
    const onSegment=(s:{u:number;v:number},t:{u:number;v:number},v:{u:number;v:number})=>
      Math.min(s.u,t.u)-tolerance<=v.u && v.u<=Math.max(s.u,t.u)+tolerance &&
      Math.min(s.v,t.v)-tolerance<=v.v && v.v<=Math.max(s.v,t.v)+tolerance;
    if(Math.abs(abp)<=eps && onSegment(a,b,p)) return true;
    if(Math.abs(abq)<=eps && onSegment(a,b,q)) return true;
    if(Math.abs(pqa)<=eps && onSegment(p,q,a)) return true;
    if(Math.abs(pqb)<=eps && onSegment(p,q,b)) return true;
    return ((abp>eps && abq< -eps)||(abp< -eps && abq>eps)) &&
      ((pqa>eps && pqb< -eps)||(pqa< -eps && pqb>eps));
  };
  for(let i=0;i<projected.length;i++) for(let j=i+1;j<projected.length;j++){
    if(j===i+1 || (i===0 && j===projected.length-1)) continue;
    if(intersects(projected[i],projected[(i+1)%projected.length],
      projected[j],projected[(j+1)%projected.length]))
      throw new Error("SURFACE_SELF_INTERSECTING_BOUNDARY");
  }
  const planeTolerance=Math.max(1e-8,scale*1e-7);
  for(const point of vertices){
    const distance=Math.abs((point.x-origin.x)*nx+(point.y-origin.y)*ny+(point.z-origin.z)*nz)/norm;
    if(distance>planeTolerance) throw new Error("SURFACE_NON_PLANAR_BOUNDARY");
  }

}

export function createSurfaceFromCanonicalRefs(
  model: StructuralModel,
  input: CreateSurfaceInput,
): { model: StructuralModel; surface: Surface } {
  if (model.schemaVersion !== "0.6") {
    throw new Error(`CORE_V06_REQUIRED:${model.schemaVersion}`);
  }

  const boundaryNodeIds = input.boundaryNodeIds.map((id) => id.trim());
  if (boundaryNodeIds.length < 3) {
    throw new Error("SURFACE_AT_LEAST_THREE_NODES_REQUIRED");
  }
  if (boundaryNodeIds.some((id) => !id)) {
    throw new Error("SURFACE_NODE_ID_REQUIRED");
  }
  if (new Set(boundaryNodeIds).size !== boundaryNodeIds.length) {
    throw new Error("SURFACE_BOUNDARY_NODES_MUST_BE_DISTINCT");
  }

  for (const nodeId of boundaryNodeIds) {
    if (!model.nodes.some((node) => node.id === nodeId)) {
      throw new Error(`UNKNOWN_SURFACE_NODE:${nodeId}`);
    }
  }

  validateSurfaceGeometry(model,boundaryNodeIds);

  const levelId = optionalId(input.levelId);
  if (levelId && !model.levels.some((level) => level.id === levelId)) {
    throw new Error(`UNKNOWN_SURFACE_LEVEL:${levelId}`);
  }

  const materialId = optionalId(input.materialId);
  if (materialId && !model.materials.some((material) => material.id === materialId)) {
    throw new Error(`UNKNOWN_SURFACE_MATERIAL:${materialId}`);
  }

  const surface: Surface = {
    id: nextSurfaceId(model.surfaces),
    type: input.type,
    boundaryNodeIds,
    ...(levelId ? { levelId } : {}),
    ...(materialId ? { materialId } : {}),
  };

  return {
    model: { ...model, surfaces: [...model.surfaces, surface] },
    surface,
  };
}


/** Update a native or SAP-imported Area without changing its source provenance. */
export function updateSurfaceBoundaryFromCanonicalRefs(
  model: StructuralModel,
  surfaceId: string,
  boundaryNodeIds: string[],
): {model:StructuralModel;surface:Surface} {
  if (model.schemaVersion !== "0.6") throw new Error(`CORE_V06_REQUIRED:${model.schemaVersion}`);
  const index=model.surfaces.findIndex(s=>s.id===surfaceId);
  if (index<0) throw new Error(`UNKNOWN_SURFACE:${surfaceId}`);
  const nodes=boundaryNodeIds.map(id=>id.trim());
  if (nodes.length<3) throw new Error("SURFACE_AT_LEAST_THREE_NODES_REQUIRED");
  if (nodes.some(id=>!id) || new Set(nodes).size!==nodes.length)
    throw new Error("SURFACE_BOUNDARY_NODES_MUST_BE_DISTINCT");
  const known=new Set(model.nodes.map(n=>n.id));
  for (const id of nodes) if (!known.has(id)) throw new Error(`UNKNOWN_SURFACE_NODE:${id}`);
  validateSurfaceGeometry(model,nodes);
  const surface={...model.surfaces[index],boundaryNodeIds:nodes,
    metadata:{...model.surfaces[index].metadata,
      ...(model.surfaces[index].metadata?.sourceFormat==="SAP2000"
        ? {geometryOnly:true,engineeringValidationRequired:true} : {})}};
  const surfaces=[...model.surfaces];
  surfaces[index]=surface;
  return {model:{...model,surfaces},surface};
}

export function deleteSurfaceFromCanonicalRefs(
  model:StructuralModel,surfaceId:string,
):StructuralModel {
  if (model.schemaVersion!=="0.6") throw new Error(`CORE_V06_REQUIRED:${model.schemaVersion}`);
  if (!model.surfaces.some(s=>s.id===surfaceId)) throw new Error(`UNKNOWN_SURFACE:${surfaceId}`);
  return {...model,surfaces:model.surfaces.filter(s=>s.id!==surfaceId)};
}
