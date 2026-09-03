"use client";

import { useState, type CSSProperties } from "react";
import type { Material, Member, StructuralDOF, StructuralModel, SupportRestraints } from "@linkoteq/structural-core";
import type { EditorSelection } from "../lib/editor/selection";

type Selection = Exclude<EditorSelection, null>;
type Mode = "material" | "section" | "rotation" | "releases" | "support" | "springs" | "movement" | null;
type Props = {
  model: StructuralModel;
  selections?: Selection[];
  member?: Member;
  surface?: StructuralModel["surfaces"][number];
  node?: StructuralModel["nodes"][number];
  open: boolean;
  onClose: () => void;
  onModelChange?: (model: StructuralModel, status: string) => void;
};

const DOFS: StructuralDOF[] = ["DX","DY","DZ","RX","RY","RZ"];
const EMPTY: SupportRestraints = {DX:false,DY:false,DZ:false,RX:false,RY:false,RZ:false};
const card: CSSProperties = {border:"1px solid #e4e7ec",borderRadius:8,padding:9,background:"#fbfcfd",display:"grid",gap:7};
const grid: CSSProperties = {display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6};
const button: CSSProperties = {minHeight:32,border:"1px solid #d0d5dd",borderRadius:7,background:"#fff",padding:"6px 8px",cursor:"pointer",fontSize:10,fontWeight:700,textAlign:"left"};
const backdrop: CSSProperties = {position:"fixed",inset:0,zIndex:180,display:"grid",placeItems:"center",padding:16,background:"rgba(16,24,40,.34)"};
const modal: CSSProperties = {width:"min(540px,calc(100vw - 32px))",maxHeight:"calc(100vh - 32px)",overflow:"auto",background:"#fff",borderRadius:12,border:"1px solid #d0d5dd"};

function common<T>(values:T[]) {
  if (!values.length) return {value:undefined as T|undefined,mixed:false};
  const same=values.every((value)=>value===values[0]);
  return {value:same?values[0]:undefined,mixed:!same};
}
function nextId(prefix:string, ids:string[]) {
  let i=1; const used=new Set(ids); while(used.has(`${prefix}${i}`)) i+=1; return `${prefix}${i}`;
}
function unitValue(value:string,unit:string) {
  const n=Number(value); if(!Number.isFinite(n)) throw new Error("A finite numeric value is required.");
  if(!unit.trim()) throw new Error("An explicit unit is required by Core v0.5.");
  return {value:n,unit:unit.trim()};
}
function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
  return <div style={backdrop} onPointerDown={onClose}><section style={modal} onPointerDown={(e)=>e.stopPropagation()}>
    <header className="propertiesHeader"><div><strong>{title}</strong><span>Core v0.5</span></div><button onClick={onClose}>×</button></header>
    <div className="propertiesBody">{children}</div>
  </section></div>;
}
function MaterialInfo({material}:{material?:Material}) {
  if(!material) return <small>No common material assigned.</small>;
  const a=material.analysis;
  return <div style={card}>
    <b>{material.name} · {material.type}</b>
    <small>E: {a.E.value} {a.E.unit} · G: {a.G.value} {a.G.unit} · ν: {a.nu}</small>
    <small>ρ: {a.rho.value} {a.rho.unit}{a.fy?` · Fy: ${a.fy.value} ${a.fy.unit}`:""}</small>
  </div>;
}

export default function ElementProperties({
  model,selections,member,surface,node,open,onClose,onModelChange,
}:Props) {
  const [mode,setMode]=useState<Mode>(null);
  const [rotation,setRotation]=useState("");
  const [startRelease,setStartRelease]=useState<Partial<Record<StructuralDOF,boolean|undefined>>>({});
  const [endRelease,setEndRelease]=useState<Partial<Record<StructuralDOF,boolean|undefined>>>({});
  const [restraints,setRestraints]=useState<Partial<Record<StructuralDOF,boolean|undefined>>>({});
  const [dof,setDof]=useState<StructuralDOF>("DX");
  const [value,setValue]=useState("");
  const [unit,setUnit]=useState("");
  const [behavior,setBehavior]=useState<"two-way"|"tension-only"|"compression-only">("two-way");
  const [loadCaseId,setLoadCaseId]=useState("");

  const fallback:Selection[]=member?[{type:"member",id:member.id}]:surface?[{type:"surface",id:surface.id}]:node?[{type:"node",id:node.id}]:[];
  const active=selections?.length?selections:fallback;
  const members=active.filter((s)=>s.type==="member").map((s)=>model.members.find((x)=>x.id===s.id)).filter((x):x is Member=>Boolean(x));
  const surfaces=active.filter((s)=>s.type==="surface").map((s)=>model.surfaces.find((x)=>x.id===s.id)).filter(Boolean) as StructuralModel["surfaces"];
  const nodes=active.filter((s)=>s.type==="node").map((s)=>model.nodes.find((x)=>x.id===s.id)).filter(Boolean) as StructuralModel["nodes"];
  if(!open||!active.length) return null;

  const targets=[...members,...surfaces];
  const materialState=common(targets.map((x)=>x.materialId));
  const sectionState=common(members.map((x)=>x.sectionId));
  const material=materialState.value?model.materials.find((x)=>x.id===materialState.value):undefined;
  const commit=(next:StructuralModel,status:string)=>onModelChange?.(next,status);

  const setMaterial=(id:string)=>{
    if(members.length&&!id)return;
    const ms=new Set(members.map((x)=>x.id)), ss=new Set(surfaces.map((x)=>x.id));
    commit({...model,members:model.members.map((x)=>ms.has(x.id)?{...x,materialId:id}:x),surfaces:model.surfaces.map((x)=>ss.has(x.id)?{...x,materialId:id||undefined}:x)},"Updated canonical material assignment.");
  };
  const setSection=(id:string)=>{
    if(!id)return; const ids=new Set(members.map((x)=>x.id));
    commit({...model,members:model.members.map((x)=>ids.has(x.id)?{...x,sectionId:id}:x)},"Updated canonical section assignment.");
  };
  const openRotation=()=>{const state=common(members.map((x)=>x.rotationDeg??0));setRotation(state.mixed?"":String(state.value??0));setMode("rotation");};
  const applyRotation=()=>{const n=Number(rotation);if(!Number.isFinite(n))return;const ids=new Set(members.map((x)=>x.id));commit({...model,members:model.members.map((x)=>ids.has(x.id)?{...x,rotationDeg:n}:x)},"Updated canonical Member.rotationDeg.");setMode(null);};

  const openReleases=()=>{
    const endState=(end:"start"|"end")=>Object.fromEntries(DOFS.map((d)=>{
      const state=common(members.map((x)=>Boolean((end==="start"?x.startRelease:x.endRelease)?.[d])));
      return [d,state.mixed?undefined:Boolean(state.value)];
    })) as Partial<Record<StructuralDOF,boolean|undefined>>;
    setStartRelease(endState("start"));setEndRelease(endState("end"));setMode("releases");
  };
  const applyReleases=()=>{
    const start=Object.fromEntries(DOFS.filter((d)=>startRelease[d]!==undefined).map((d)=>[d,Boolean(startRelease[d])]));
    const end=Object.fromEntries(DOFS.filter((d)=>endRelease[d]!==undefined).map((d)=>[d,Boolean(endRelease[d])]));
    const ids=new Set(members.map((x)=>x.id));
    commit({...model,members:model.members.map((x)=>ids.has(x.id)?{...x,startRelease:{...(x.startRelease??{}),...start},endRelease:{...(x.endRelease??{}),...end}}:x)},"Updated canonical Core v0.5 member end releases.");setMode(null);
  };

  const openSupport=()=>{
    const state=Object.fromEntries(DOFS.map((d)=>{const c=common(nodes.map((x)=>Boolean(model.supports.find((s)=>s.nodeId===x.id)?.restraints[d])));return[d,c.mixed?undefined:Boolean(c.value)];})) as Partial<Record<StructuralDOF,boolean|undefined>>;
    setRestraints(state);setMode("support");
  };
  const applySupport=()=>{
    const changes=Object.fromEntries(DOFS.filter((d)=>restraints[d]!==undefined).map((d)=>[d,Boolean(restraints[d])])) as Partial<SupportRestraints>;
    let next=[...model.supports];
    for(const n of nodes){const i=next.findIndex((s)=>s.nodeId===n.id);if(i>=0)next[i]={...next[i],restraints:{...next[i].restraints,...changes}};else next.push({id:nextId("SUP",next.map((x)=>x.id)),nodeId:n.id,restraints:{...EMPTY,...changes}});}
    commit({...model,supports:next},"Updated canonical Core v0.5 support restraints.");setMode(null);
  };

  const addSpring=()=>{try{const stiffness=unitValue(value,unit);let next=[...(model.supportSprings??[])];for(const n of nodes)next.push({id:nextId("SPR",next.map((x)=>x.id)),nodeId:n.id,dof,stiffness,behavior});commit({...model,supportSprings:next},"Added canonical SupportSpring record.");setValue("");}catch(e){commit(model,e instanceof Error?e.message:"Support spring update failed.");}};
  const addMovement=()=>{try{const magnitude=unitValue(value,unit);let next=[...(model.enforcedNodeDisplacements??[])];for(const n of nodes)next.push({id:nextId("END",next.map((x)=>x.id)),nodeId:n.id,dof,magnitude,loadCaseId:loadCaseId||undefined});commit({...model,enforcedNodeDisplacements:next},"Added canonical EnforcedNodeDisplacement record.");setValue("");}catch(e){commit(model,e instanceof Error?e.message:"Prescribed movement update failed.");}};
  const springs=(model.supportSprings??[]).filter((x)=>nodes.some((n)=>n.id===x.nodeId));
  const movements=(model.enforcedNodeDisplacements??[]).filter((x)=>nodes.some((n)=>n.id===x.nodeId));

  return <>
    <aside className="propertiesSidePanel" onPointerDown={(e)=>e.stopPropagation()}>
      <header className="propertiesHeader"><div><strong>Properties</strong><span>{active.length} selected · Core v0.5</span></div><button onClick={onClose}>×</button></header>
      <div className="propertiesBody">
        <section style={card}><div className="propertiesSectionHeading"><strong>Actions</strong><span.Canonical fields</span></div><div style={grid}>