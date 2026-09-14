import * as THREE from "three";
import type { Member, Section, StructuralModel, Vec3 } from "@linkoteq/structural-core";

const U: Record<string, number> = { m: 1, cm: .01, mm: .001, in: .0254, ft: .3048 };
const V = (p: Vec3) => new THREE.Vector3(p.x, p.z, p.y);

function dim(s: Section, keys: string[], m: StructuralModel): number | null {
  for (const k of keys) {
    const q = s.geometry?.[k] as { value?: unknown; unit?: unknown } | undefined;
    if (!q || typeof q.value !== "number" || !Number.isFinite(q.value) || typeof q.unit !== "string") continue;
    const f = U[q.unit.trim().toLowerCase()];
    if (!f) continue;
    const meters = q.value * f;
    const v = m.project.units === "US" ? meters / .3048 : meters;
    if (v > 0) return v;
  }
  return null;
}

const fam = (s: Section) => s.family.trim().toUpperCase().replace(/[_\s]+/g, "-");
const des = (s: Section) => (s.designation ?? "").trim().toUpperCase().replace(/\s+/g, "");
function wide(s: Section) {
  const f = fam(s);
  return ["W","WF","I","HP","M","S","W-SHAPE","W-SHAPES","WIDE-FLANGE","WIDE-FLANGE-SHAPE","WIDE-FLANGE-SHAPES","WIDEFLANGE"].includes(f)
    || (/^W\d/.test(des(s)) && !/^WT\d/.test(des(s)));
}

function poly(points: Array<[number, number]>) {
  const s = new THREE.Shape();
  s.moveTo(...points[0]);
  for (const p of points.slice(1)) s.lineTo(...p);
  s.closePath();
  return s;
}
function rect(h: number, b: number) {
  return h > 0 && b > 0 ? poly([[-b/2,-h/2],[b/2,-h/2],[b/2,h/2],[-b/2,h/2]]) : null;
}
function ishape(d:number,b:number,tw:number,tf:number) {
  if (tw<=0 || tf<=0 || tw>=b || tf*2>=d) return null;
  const B=b/2,H=d/2,W=tw/2;
  return poly([[-B,H],[B,H],[B,H-tf],[W,H-tf],[W,-H+tf],[B,-H+tf],[B,-H],[-B,-H],[-B,-H+tf],[-W,-H+tf],[-W,H-tf],[-B,H-tf]]);
}
function channel(d:number,b:number,tw:number,tf:number) {
  if (tw<=0 || tf<=0 || tw>=b || tf*2>=d) return null;
  const H=d/2,x0=-b/2,x1=x0+tw,x2=b/2;
  return poly([[x0,H],[x2,H],[x2,H-tf],[x1,H-tf],[x1,-H+tf],[x2,-H+tf],[x2,-H],[x0,-H]]);
}
function tee(d:number,b:number,tw:number,tf:number) {
  if (tw<=0 || tf<=0 || tw>=b || tf>=d) return null;
  const B=b/2,H=d/2,W=tw/2;
  return poly([[-B,H],[B,H],[B,H-tf],[W,H-tf],[W,-H],[-W,-H],[-W,H-tf],[-B,H-tf]]);
}
function angle(d:number,b:number,t:number) {
  if (t<=0 || t>=Math.min(d,b)) return null;
  const B=b/2,H=d/2;
  return poly([[-B,-H],[-B+t,-H],[-B+t,H-t],[B,H-t],[B,H],[-B,H]]);
}
function box(h:number,b:number,t:number) {
  if (t<=0 || t*2>=Math.min(h,b)) return null;
  const s=rect(h,b); if(!s) return null;
  const x=b/2-t,y=h/2-t,hole=new THREE.Path();
  hole.moveTo(-x,-y); hole.lineTo(-x,y); hole.lineTo(x,y); hole.lineTo(x,-y); hole.closePath();
  s.holes.push(hole); return s;
}
function pipe(d:number,t:number) {
  if (d<=0 || t<=0 || t>=d/2) return null;
  const s=new THREE.Shape(),r=d/2,hole=new THREE.Path();
  s.absarc(0,0,r,0,Math.PI*2,false); hole.absarc(0,0,r-t,0,Math.PI*2,true); s.holes.push(hole); return s;
}

function profile(s: Section, m: StructuralModel): THREE.Shape | null {
  const f=fam(s);
  const get=(...k:string[])=>dim(s,k,m);
  if (f==="RC-RECT" || f==="WOOD-RECT" || s.geometry?.shape==="rectangular") {
    const d=get("depth","height","d","D"), b=get("width","b","B","bf"); return d&&b?rect(d,b):null;
  }
  if (wide(s)) {
    const d=get("d","D","depth","height"), b=get("bf","B","flangeWidth","width"), tw=get("tw","W","webThickness"), tf=get("tf","T","flangeThickness");
    return d&&b&&tw&&tf?ishape(d,b,tw,tf):null;
  }
  if (["C","MC","CHANNEL"].includes(f)) {
    const d=get("d","D","depth"), b=get("bf","B","flangeWidth","width"), tw=get("tw","W","webThickness"), tf=get("tf","T","flangeThickness");
    return d&&b&&tw&&tf?channel(d,b,tw,tf):null;
  }
  if (["L","ANGLE"].includes(f)) {
    const d=get("D","d","depth"),b=get("B","b","width"),t=get("T","t","thickness"); return d&&b&&t?angle(d,b,t):null;
  }
  if (["WT","TEE"].includes(f)) {
    const d=get("D","d","depth"),b=get("B","b","width"),tw=get("W","stemThickness","webThickness"),tf=get("T","t","thickness","flangeThickness");
    return d&&b&&tw&&tf?tee(d,b,tw,tf):null;
  }
  if (["HSS","RHS","SHS","BOX","HS-SQ","HS-RE","HA-SQ","HA-RE"].includes(f)) {
    const h=get("D","H","h","height","d","depth"),b=get("B","b","width","bf"),t=get("designThickness","Tdes","T","t","thickness","wallThickness");
    return h&&b&&t?box(h,b,t):null;
  }
  if (["PIPE","CHS","HS-RO","HA-RO"].includes(f)) {
    const d=get("D","d","diameter","OD","depth"),t=get("designThickness","Tdes","T","t","thickness","wallThickness");
    return d&&t?pipe(d,t):null;
  }
  return null;
}

function basis(member: Member, x: THREE.Vector3) {
  let y: THREE.Vector3, z: THREE.Vector3;
  if (member.localAxes?.convention === "right-handed") {
    y=V(member.localAxes.y).normalize(); z=V(member.localAxes.z).normalize();
  } else {
    const r=Math.abs(x.dot(new THREE.Vector3(0,1,0)))<.95?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
    z=new THREE.Vector3().crossVectors(x,r).normalize(); y=new THREE.Vector3().crossVectors(z,x).normalize();
  }
  const a=THREE.MathUtils.degToRad(member.rotationDeg??0);
  if(Math.abs(a)>1e-12){const q=new THREE.Quaternion().setFromAxisAngle(x,a); y.applyQuaternion(q); z.applyQuaternion(q);}
  return {y,z};
}

export function buildRealMemberGeometry(model: StructuralModel, member: Member, start: THREE.Vector3, end: THREE.Vector3): THREE.BufferGeometry | null {
  const section=model.sections.find(s=>s.id===member.sectionId); if(!section) return null;
  const shape=profile(section,model); if(!shape) return null;
  const dir=end.clone().sub(start), length=dir.length(); if(length<1e-9) return null;
  const x=dir.normalize(),{y,z}=basis(member,x);
  const g=new THREE.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,steps:1,curveSegments:12});
  g.translate(0,0,-length/2); g.applyMatrix4(new THREE.Matrix4().makeBasis(z,y,x));
  const mid=start.clone().add(end).multiplyScalar(.5); g.translate(mid.x,mid.y,mid.z); g.computeVertexNormals();
  return g;
}
