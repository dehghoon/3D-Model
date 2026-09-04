import * as THREE from "three";
import type { Member, Section, StructuralModel, Vec3 } from "@linkoteq/structural-core";

const FACTOR: Record<string, number> = { m: 1, cm: .01, mm: .001, in: .0254, ft: .3048 };
const v3 = (v: Vec3) => new THREE.Vector3(v.x, v.z, v.y);

function dim(s: Section, keys: string[], model: StructuralModel): number | null {
  if (!s.geometry) return null;
  for (const key of keys) {
    const raw = s.geometry[key] as { value?: unknown; unit?: unknown } | undefined;
    if (!raw || typeof raw.value !== "number" || !Number.isFinite(raw.value) || typeof raw.unit !== "string") continue;
    const factor = FACTOR[raw.unit.trim().toLowerCase()];
    if (!factor) continue;
    const meters = raw.value * factor;
    const value = model.project.units === "US" ? meters / .3048 : meters;
    if (value > 0) return value;
  }
  return null;
}

function iShape(d:number,bf:number,tw:number,tf:number) {
  if (tw >= bf || tf * 2 >= d) return null;
  const b=bf/2,h=d/2,w=tw/2,s=new THREE.Shape();
  s.moveTo(-b,h); s.lineTo(b,h); s.lineTo(b,h-tf); s.lineTo(w,h-tf); s.lineTo(w,-h+tf);
  s.lineTo(b,-h+tf); s.lineTo(b,-h); s.lineTo(-b,-h); s.lineTo(-b,-h+tf); s.lineTo(-w,-h+tf);
  s.lineTo(-w,h-tf); s.lineTo(-b,h-tf); s.closePath(); return s;
}

function channelShape(d:number,bf:number,tw:number,tf:number) {
  if (tw >= bf || tf * 2 >= d) return null;
  const h=d/2,x0=-bf/2,x1=x0+tw,x2=bf/2,s=new THREE.Shape();
  s.moveTo(x0,h); s.lineTo(x2,h); s.lineTo(x2,h-tf); s.lineTo(x1,h-tf);
  s.lineTo(x1,-h+tf); s.lineTo(x2,-h+tf); s.lineTo(x2,-h); s.lineTo(x0,-h); s.closePath(); return s;
}

function teeShape(d:number,b:number,tw:number,tf:number) {
  if (tw >= b || tf >= d) return null;
  const x=b/2,w=tw/2,h=d/2,s=new THREE.Shape();
  s.moveTo(-x,h); s.lineTo(x,h); s.lineTo(x,h-tf); s.lineTo(w,h-tf);
  s.lineTo(w,-h); s.lineTo(-w,-h); s.lineTo(-w,h-tf); s.lineTo(-x,h-tf); s.closePath(); return s;
}

function angleShape(d:number,b:number,t:number) {
  if (t >= Math.min(d,b)) return null;
  const x=b/2,y=d/2,s=new THREE.Shape();
  s.moveTo(-x,-y); s.lineTo(-x+t,-y); s.lineTo(-x+t,y-t); s.lineTo(x,y-t);
  s.lineTo(x,y); s.lineTo(-x,y); s.closePath(); return s;
}

function boxShape(h:number,b:number,t:number) {
  if (t * 2 >= Math.min(h,b)) return null;
  const x=b/2,y=h/2,s=new THREE.Shape();
  s.moveTo(-x,-y); s.lineTo(x,-y); s.lineTo(x,y); s.lineTo(-x,y); s.closePath();
  const ix=x-t,iy=y-t,p=new THREE.Path();
  p.moveTo(-ix,-iy); p.lineTo(-ix,iy); p.lineTo(ix,iy); p.lineTo(ix,-iy); p.closePath();
  s.holes.push(p); return s;
}

function pipeShape(d:number,t:number) {
  const r=d/2; if (t >= r) return null;
  const s=new THREE.Shape(); s.absarc(0,0,r,0,Math.PI*2,false);
  const p=new THREE.Path(); p.absarc(0,0,r-t,0,Math.PI*2,true); s.holes.push(p); return s;
}

function profile(s: Section, model: StructuralModel): THREE.Shape | null {
  const f=s.family.trim().toUpperCase();
  if (["W","WF","I","HP","M","S"].includes(f)) {
    const d=dim(s,["d","depth","height"],model),bf=dim(s,["bf","flangeWidth","width"],model);
    const tw=dim(s,["tw","webThickness"],model),tf=dim(s,["tf","flangeThickness"],model);
    return d&&bf&&tw&&tf ? iShape(d,bf,tw,tf) : null;
  }
  if (["C","MC","CHANNEL"].includes(f)) {
    const d=dim(s,["d","depth"],model),bf=dim(s,["bf","flangeWidth","width"],model);
    const tw=dim(s,["tw","webThickness"],model),tf=dim(s,["tf","flangeThickness"],model);
    return d&&bf&&tw&&tf ? channelShape(d,bf,tw,tf) : null;
  }
  if (["L","ANGLE"].includes(f)) {
    const d=dim(s,["D","d","depth"],model),b=dim(s,["B","b","width"],model),t=dim(s,["T","t","thickness"],model);
    return d&&b&&t ? angleShape(d,b,t) : null;
  }
  if (["WT","TEE"].includes(f)) {
    const d=dim(s,["D","d","depth"],model),b=dim(s,["B","b","width"],model);
    const tw=dim(s,["W","stemThickness","webThickness"],model),tf=dim(s,["T","t","thickness","flangeThickness"],model);
    return d&&b&&tw&&tf ? teeShape(d,b,tw,tf) : null;
  }
  if (["HSS","RHS","SHS","BOX","HS SQ","HS RE","HA SQ","HA RE"].includes(f)) {
    const h=dim(s,["D","H","h","height","d","depth"],model),b=dim(s,["B","b","width","bf"],model);
    const t=dim(s,["designThickness","Tdes","T","t","thickness","wallThickness"],model);
    return h&&b&&t ? boxShape(h,b,t) : null;
  }
  if (["PIPE","CHS","HS RO","HA RO"].includes(f)) {
    const d=dim(s,["D","d","diameter","OD","depth"],model);
    const t=dim(s,["designThickness","Tdes","T","t","thickness","wallThickness"],model);
    return d&&t ? pipeShape(d,t) : null;
  }
  return null;
}

function axes(member: Member, x: THREE.Vector3) {
  let y: THREE.Vector3, z: THREE.Vector3;
  if (member.localAxes?.convention === "right-handed") {
    y=v3(member.localAxes.y).normalize(); z=v3(member.localAxes.z).normalize();
  } else {
    const ref=Math.abs(x.dot(new THREE.Vector3(0,1,0)))<.95 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
    z=new THREE.Vector3().crossVectors(x,ref).normalize(); y=new THREE.Vector3().crossVectors(z,x).normalize();
  }
  const angle=THREE.MathUtils.degToRad(member.rotationDeg ?? 0);
  if (Math.abs(angle)>1e-12) {
    const q=new THREE.Quaternion().setFromAxisAngle(x,angle); y.applyQuaternion(q); z.applyQuaternion(q);
  }
  return { y, z };
}

export function buildRealMemberGeometry(model:StructuralModel,member:Member,start:THREE.Vector3,end:THREE.Vector3) {
  const section=model.sections.find((item)=>item.id===member.sectionId); if (!section) return null;
  const shape=profile(section,model); if (!shape) return null;
  const dir=end.clone().sub(start),length=dir.length(); if (length<1e-9) return null;
  const x=dir.normalize(),{y,z}=axes(member,x);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,steps:1,curveSegments:12});
  geometry.translate(0,0,-length/2);
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(z,y,x));
  const mid=start.clone().add(end).multiplyScalar(.5);
  geometry.translate(mid.x,mid.y,mid.z); geometry.computeVertexNormals(); return geometry;
}
