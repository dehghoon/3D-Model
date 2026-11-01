import { createMemberFromSnapPoints } from "./member-draw-controller";
import type { JoistSpecification, StructuralModel, Vec3 } from "@linkoteq/structural-core";

export interface JoistBay {
  levelZ: number;
  beamIds: [string, string, string, string];
  corners: [Vec3, Vec3, Vec3, Vec3]; // counterclockwise in XY
}
export interface JoistSegment { start: Vec3; end: Vec3 }
const EPS=1e-5;
const near=(a:number,b:number)=>Math.abs(a-b)<=EPS;
const key=(p:Vec3)=>`${Math.round(p.x/EPS)}:${Math.round(p.y/EPS)}`;
const cross=(a:Vec3,b:Vec3,c:Vec3)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function inside(p:Vec3, corners:Vec3[]):boolean {
  const signs=corners.map((a,i)=>cross(a,corners[(i+1)%4],p));
  return signs.every(s=>s>=-EPS)||signs.every(s=>s<=EPS);
}
/** Finds only unambiguous four-sided, convex, beam-framed bays at one elevation. */
export function detectJoistBay(model:StructuralModel, point:Vec3, levelZ:number):JoistBay {
  if(!near(point.z,levelZ))throw new Error("JOIST_PLAN_LEVEL_MISMATCH");
  const nodes=new Map(model.nodes.map(n=>[n.id,n.position]));
  const edges=model.members.filter(m=>m.type==="beam").flatMap(m=>{
    const a=nodes.get(m.startNodeId),b=nodes.get(m.endNodeId);
    return a&&b&&near(a.z,levelZ)&&near(b.z,levelZ)&&key(a)!==key(b)?[{id:m.id,a,b,ka:key(a),kb:key(b)}]:[];
  });
  const candidates:JoistBay[]=[];
  for(const e0 of edges)for(const e1 of edges) {
    if(e1.id===e0.id||e1.ka!==e0.kb)continue;
    for(const e2 of edges){
      if([e0.id,e1.id].includes(e2.id)||e2.ka!==e1.kb)continue;
      for(const e3 of edges){
        if([e0.id,e1.id,e2.id].includes(e3.id)||e3.ka!==e2.kb||e3.kb!==e0.ka)continue;
        const corners=[e0.a,e1.a,e2.a,e3.a] as [Vec3,Vec3,Vec3,Vec3];
        const turns=corners.map((a,i)=>cross(a,corners[(i+1)%4],corners[(i+2)%4]));
        if(!turns.every(t=>t>EPS)&&!turns.every(t=>t< -EPS))continue;
        if(!inside(point,corners)||corners.some((a,i)=>Math.abs(cross(a,corners[(i+1)%4],point))<=EPS))continue;
        const ids=[e0.id,e1.id,e2.id,e3.id] as [string,string,string,string];
        const signature=[...ids].sort().join("|");
        if(!candidates.some(b=>[...b.beamIds].sort().join("|")===signature))candidates.push({levelZ,beamIds:ids,corners});
      }
    }
  }
  if(!candidates.length)throw new Error("JOIST_BAY_NOT_FOUND_OR_NOT_CLOSED");
  if(candidates.length!==1)throw new Error("JOIST_BAY_AMBIGUOUS");
  return candidates[0];
}
const lerp=(a:Vec3,b:Vec3,t:number):Vec3=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
/** Direction selects the opposing support edges: 0 => edges 0 and 2; 1 => edges 1 and 3. */
export function layoutJoists(bay:JoistBay,input:{direction:0|1;count?:number;spacing?:number}):JoistSegment[] {
  const {corners:c}=bay;
  const [a,b,d,e]=input.direction===0?[c[0],c[1],c[2],c[3]]:[c[1],c[2],c[3],c[0]];
  const edgeLength=Math.hypot(b.x-a.x,b.y-a.y);
  if(!(edgeLength>EPS))throw new Error("JOIST_BAY_DEGENERATE");
  if((input.count===undefined)===(input.spacing===undefined))throw new Error("JOIST_COUNT_OR_SPACING_REQUIRED");
  const count=input.count!==undefined?input.count:Math.ceil(edgeLength/input.spacing!)-1;
  if(!Number.isInteger(count)||count<1||count>1000||input.spacing!==undefined&&(!Number.isFinite(input.spacing)||input.spacing<=0))throw new Error("JOIST_INVALID_COUNT_OR_SPACING");
  return Array.from({length:count},(_,i)=>{
    const t=(i+1)/(count+1);
    return {start:lerp(a,b,t),end:lerp(e,d,t)};
  });
}

/** Commit a previously previewed bay layout atomically. Caller must confirm preview first. */
export function createJoistsInBay(model:StructuralModel,input:{
 bay:JoistBay;direction:0|1;count?:number;spacing?:number;
 materialId:string;sectionId:string;joist:JoistSpecification;
}):{model:StructuralModel;memberIds:string[];segments:JoistSegment[]} {
 const segments=layoutJoists(input.bay,input);
 let next=model;
 const memberIds:string[]=[];
 for(const segment of segments){
   const result=createMemberFromSnapPoints(next,{
     type:"joist",materialId:input.materialId,sectionId:input.sectionId,
     joist:input.joist,
     start:{point:segment.start,kind:"work-plane",label:"Bay support"},
     end:{point:segment.end,kind:"work-plane",label:"Bay support"},
   });
   next=result.model;
   memberIds.push(result.memberId);
 }
 return {model:next,memberIds,segments};
}
