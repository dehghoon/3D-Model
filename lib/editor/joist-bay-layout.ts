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
  const nodes = new Map(model.nodes.map(n => [n.id,n.position]));
  const beams = model.members.filter(m=>m.type==="beam").flatMap(m=>{
    const a=nodes.get(m.startNodeId),b=nodes.get(m.endNodeId);
    return a&&b&&near(a.z,levelZ)&&near(b.z,levelZ)&&key(a)!==key(b)?[{id:m.id,a,b}]:[];
  });
  // Split long beams at every plan intersection, including T-junctions and
  // crossings. A visible grid bay need not correspond to four whole members.
  type Vertex = {p:Vec3;t:number};
  const cuts:Vertex[][]=beams.map(e=>[{p:e.a,t:0},{p:e.b,t:1}]);
  const det=(ax:number,ay:number,bx:number,by:number)=>ax*by-ay*bx;
  for(let i=0;i<beams.length;i++)for(let j=i+1;j<beams.length;j++){
    const a=beams[i],b=beams[j],rx=a.b.x-a.a.x,ry=a.b.y-a.a.y;
    const sx=b.b.x-b.a.x,sy=b.b.y-b.a.y;
    const denominator=det(rx,ry,sx,sy);
    if(Math.abs(denominator)<EPS)continue;
    const qx=b.a.x-a.a.x,qy=b.a.y-a.a.y;
    const t=det(qx,qy,sx,sy)/denominator,u=det(qx,qy,rx,ry)/denominator;
    if(t < -EPS||t>1+EPS||u < -EPS||u>1+EPS)continue;
    const p={x:a.a.x+rx*t,y:a.a.y+ry*t,z:levelZ};
    cuts[i].push({p,t});cuts[j].push({p,t:u});
  }
  type Edge={id:string;a:Vec3;b:Vec3;ka:string;kb:string};
  const edges:Edge[]=[];
  beams.forEach((beam,i)=>{
    const sorted=cuts[i].sort((a,b)=>a.t-b.t);
    for(let k=0;k<sorted.length-1;k++){
      const a=sorted[k].p,b=sorted[k+1].p;
      if(key(a)!==key(b))edges.push({id:beam.id,a,b,ka:key(a),kb:key(b)});
    }
  });
  const adjacent=new Map<string,Edge[]>();
  for(const e of edges)for(const directed of [e,{...e,a:e.b,b:e.a,ka:e.kb,kb:e.ka}]){
    const list=adjacent.get(directed.ka)??[];
    list.push(directed);adjacent.set(directed.ka,list);
  }
  const candidates:JoistBay[]=[];
  // Find four straight boundary runs (each may contain several beam pieces).
  // Trace faces by turning consistently at intersections; then merge collinear
  // pieces and require exactly four convex corners.
  const seen=new Set<string>();
  for(const first of edges){
    for(const initial of [first,{...first,a:first.b,b:first.a,ka:first.kb,kb:first.ka}]){
      let current=initial;
      const path:Edge[]=[];
      for(let step=0;step<=edges.length;step++){
        if(step>0&&current.ka===initial.ka)break;
        if(path.some(e=>e.ka===current.ka)){path.length=0;break;}
        path.push(current);
        const choices=(adjacent.get(current.kb)??[]).filter(e=>e.kb!==current.ka);
        if(!choices.length){path.length=0;break;}
        const dx=current.b.x-current.a.x,dy=current.b.y-current.a.y;
        // Clockwise angular successor gives a bounded planar face.
        const angle=(e:Edge)=>{const ex=e.b.x-e.a.x,ey=e.b.y-e.a.y;
          return (Math.atan2(det(dx,dy,ex,ey),dx*ex+dy*ey)+2*Math.PI)%(2*Math.PI);};
        choices.sort((a,b)=>angle(a)-angle(b));
        current=choices[0];
      }
      if(path.length<4||current.ka!==initial.ka)continue;
      const vertices=path.map(e=>e.a);
      const corners=vertices.filter((p,i)=>Math.abs(cross(vertices[(i+vertices.length-1)%vertices.length],p,vertices[(i+1)%vertices.length]))>EPS);
      if(corners.length!==4||!inside(point,corners))continue;
      if(corners.some((p,i)=>Math.abs(cross(p,corners[(i+1)%4],point))<=EPS))continue;
      const turns=corners.map((p,i)=>cross(p,corners[(i+1)%4],corners[(i+2)%4]));
      if(!turns.every(t=>t>EPS)&&!turns.every(t=>t< -EPS))continue;
      const signature=corners.map(key).sort().join("|");
      if(seen.has(signature))continue;
      seen.add(signature);
      const ids=corners.map((p,i)=>{
        const q=corners[(i+1)%4];
        const edge=path.find(e=>Math.abs(cross(p,q,e.a))<=EPS&&Math.abs(cross(p,q,e.b))<=EPS&&
          (e.a.x-p.x)*(q.x-p.x)+(e.a.y-p.y)*(q.y-p.y)>=-EPS);
        return edge?.id??"";
      }) as [string,string,string,string];
      candidates.push({levelZ,beamIds:ids,corners:corners as [Vec3,Vec3,Vec3,Vec3]});
    }
  }
  // Robust fast path for rectangular grid bays. The nearest four framing
  // lines around the click define the cell even if beams run across bays.
  if(!candidates.length && beams.length){
    const xs=[...new Set(beams.flatMap(e=>[e.a.x,e.b.x]))].sort((a,b)=>a-b);
    const ys=[...new Set(beams.flatMap(e=>[e.a.y,e.b.y]))].sort((a,b)=>a-b);
    const x0=[...xs].reverse().find(x=>x<point.x-EPS);
    const x1=xs.find(x=>x>point.x+EPS);
    const y0=[...ys].reverse().find(y=>y<point.y-EPS);
    const y1=ys.find(y=>y>point.y+EPS);
    if(x0!==undefined&&x1!==undefined&&y0!==undefined&&y1!==undefined){
      const covers=(axis:"x"|"y",fixed:number,from:number,to:number)=>{
        const intervals=beams.flatMap(e=>{
          const a=e.a,b=e.b;
          if(axis==="x" && Math.abs(a.y-fixed)<EPS && Math.abs(b.y-fixed)<EPS)
            return [{start:Math.min(a.x,b.x),end:Math.max(a.x,b.x),id:e.id}];
          if(axis==="y" && Math.abs(a.x-fixed)<EPS && Math.abs(b.x-fixed)<EPS)
            return [{start:Math.min(a.y,b.y),end:Math.max(a.y,b.y),id:e.id}];
          return [];
        }).sort((a,b)=>a.start-b.start);
        let covered=from;const ids:string[]=[];
        for(const item of intervals){
          if(item.start>covered+EPS)break;
          if(item.end>covered+EPS){covered=item.end;ids.push(item.id);}
          if(covered>=to-EPS)return ids[0]??"";
        }
        return "";
      };
      const bottom=covers("x",y0,x0,x1),right=covers("y",x1,y0,y1);
      const top=covers("x",y1,x0,x1),left=covers("y",x0,y0,y1);
      if(bottom&&right&&top&&left)candidates.push({
        levelZ,beamIds:[bottom,right,top,left],
        corners:[{x:x0,y:y0,z:levelZ},{x:x1,y:y0,z:levelZ},{x:x1,y:y1,z:levelZ},{x:x0,y:y1,z:levelZ}]
      });
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
