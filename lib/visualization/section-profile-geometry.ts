import * as THREE from "three";
import type { Member, Section, StructuralModel, UnitValue, Vec3 } from "@linkoteq/structural-core";

const FACTOR: Record<string, number> = { m: 1, cm: .01, mm: .001, in: .0254, ft: .3048 };

function t(v: Vec3) { return new THREE.Vector3(v.x, v.z, v.y); }
function uv(v: unknown): v is UnitValue {
  if (!v || typeof v !== "object") return false;
  const x = v as Partial<UnitValue>;
  return Number.isFinite(x.value) && typeof x.unit === "string" && !!x.unit.trim();
}
function dim(s: Section, keys: string[], model: StructuralModel) {
  const g = s.geometry;
  if (!g) return null;
  for (const k of keys) {
    const raw = g[k];
    if (!uv(raw)) continue;
    const f = FACTOR[raw.unit.trim().toLowerCase()];
    if (!f) continue;
    const meters = raw.value * f;
    const value = model.project.units === "US" ? meters / .3048 : meters;
    if (value > 0) return value;
  }
  return null;
}
function wShape(d:number,bf:number,tw:number,tf:number) {
  if (tw >= bf || tf*2 >= d) return null;
  const b=bf/2,h=d/2,w=tw/2,s=new THREE.Shape();
  s.moveTo(-b,h); s.lineTo(b,h); s.lineTo(b,h-tf); s.lineTo(w,h-tf);
  s.lineTo(w,-h+tf); s.lineTo(b,-h+tf); s.lineTo(b,-h);
  s.lineTo(-b,-h); s.lineTo(-b,-h+tf); s.lineTo(-w,-h+tf);
  s.lineTo(-w,h-tf); s.lineTo(-b,h-tf); s.closePath(); return s;
}
function boxShape(h:number,b:number,t:number) {
  if (t*2 >= Math.min(h,b)) return null;
  const x=b/2,y=h/2,s=new THREE.Shape(); s.moveTo(-x,-y); s.lineTo(x,-y); s.lineTo(x,y); s.lineTo(-x,y); s.closePath();
  const ix=x-t,iy=y-t,p=new THREE.Path(); p.moveTo(-ix,-iy); p.lineTo(-ix,iy); p.lineTo(ix,iy); p.lineTo(ix,-iy); p.closePath(); s.holes.push(p); return s;
}
function pipeShape(d:number,t:number) {
  const r=d/2; if (t>=r) return null;
  const s=new THREE.Shape(); s.absarc(0,0,r,0,Math.PI*2,false);
  const p=new THREE.Path(); p.absarc(0,0,r-t,0,Math.PI*2,true); s.holes.push(p); return s;
}
function profile(section: Section, model: StructuralModel) {
  const f=section.family.trim().toUpperCase();
  if (["W","WF","I"].includes(f)) {
    const d=dim(section,["d","depth","height"],model), bf=dim(section,["bf","flangeWidth","width"],model), tw=dim(section,["tw","webThickness"],model), tf=dim(section,["tf","flangeThickness"],model);
    return d&&bf&&tw&&tf ? wShape(d,bf,tw,tf) : null;
  }
  if (["HSS","RHS","SHS","BOX"].includes(f)) {
    const h=dim(section,["H","h","height","d","depth"],model), b=dim(section,["B","b","width","bf"],model), th=dim(section,["t","thickness","wallThickness"],model);
    return h&&b&&th ? boxShape(h,b,th) : null;
  }
  if (["PIPE","CHS"].includes(f)) {
    const d=dim(section,["D","d","diameter","OD"],model), th=dim(section,["t","thickness","wallThickness"],model);
    return d&&th ? pipeShape(d,th) : null;
  }
  return null;
}
function axes(member: Member, x: THREE.Vector3) {
  let y:THREE.Vector3,z:THREE.Vector3;
  if (member.localAxes?.convention==="right-handed") {
    y=t(member.localAxes.y).normalize(); z=t(member.localAxes.z).normalize();
  } else {
    const ref=Math.abs(x.dot(new THREE.Vector3(0,1,0)))<.95?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
    z=new THREE.Vector3().crossVectors(x,ref).normalize(); y=new THREE.Vector3().crossVectors(z,x).normalize();
  }
  const a=THREE.MathUtils.degToRad(member.rotationDeg??0);
  if (Math.abs(a)>1e-12) { const q=new THREE.Quaternion().setFromAxisAngle(x,a); y.applyQuaternion(q); z.applyQuaternion(q); }
  return {y,z};
}
export function buildRealMemberGeometry(model:StructuralModel,member:Member,start:THREE.Vector3,end:THREE.Vector3) {
  const section=model.sections.find(s=>s.id===member.sectionId); if(!section) return null;
  const shape=profile(section,model); if(!shape) return null;
  const dir=end.clone().sub(start), length=dir.length(); if(length<1e-9) return null;
  const x=dir.normalize(), {y,z}=axes(member,x);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,steps:1,curveSegments:12});
  geometry.translate(0,0,-length/2); geometry.applyMatrix4(new THREE.Matrix4().makeBasis(y,z,x));
  const m=start.clone().add(end).multiplyScalar(.5); geometry.translate(m.x,m.y,m.z); geometry.computeVertexNormals();
  return geometry;
}
