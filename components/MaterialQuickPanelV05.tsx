"use client";
import { useEffect, useState } from "react";
import type { Material, MaterialType, Member, StructuralModel } from "@linkoteq/structural-core";
import AssignmentPropertiesV05 from "./AssignmentPropertiesV05";
import { MATERIAL_REFERENCE_LIBRARY_V05, type MaterialReferenceTemplateV05 } from "../lib/material-reference-library-v05";
import { getDefaultMaterialId, getDefaultSectionId, setModelingDefaults } from "../lib/modeling-default-preferences-v05";

type Props={model:StructuralModel;members:Member[];surfaces:StructuralModel["surfaces"];onModelChange:(model:StructuralModel,status:string)=>void};
type Draft={id:string;name:string;type:MaterialType;E:string;Eu:string;G:string;Gu:string;nu:string;rho:string;rhou:string;fy:string;fyu:string;referenceId:string;standard:string;jurisdiction:string};
const OPEN="linkoteq:material-panel-open";

function blank():Draft{return{id:`MAT-CUSTOM-${Date.now().toString(36).toUpperCase()}`,name:"Custom Material",type:"steel",E:"",Eu:"MPa",G:"",Gu:"MPa",nu:"",rho:"",rhou:"kg/m3",fy:"",fyu:"MPa",referenceId:"",standard:"",jurisdiction:""}}
function fromMaterial(m:Material):Draft{return{id:m.id,name:m.name,type:m.type,E:String(m.analysis.E.value),Eu:m.analysis.E.unit,G:String(m.analysis.G.value),Gu:m.analysis.G.unit,nu:String(m.analysis.nu),rho:String(m.analysis.rho.value),rhou:m.analysis.rho.unit,fy:m.analysis.fy?String(m.analysis.fy.value):"",fyu:m.analysis.fy?.unit??"MPa",referenceId:String(m.metadata?.referenceTemplateId??""),standard:String(m.metadata?.standard??""),jurisdiction:String(m.metadata?.jurisdiction??"")}}
function fromTemplate(t:MaterialReferenceTemplateV05):Draft{return{...blank(),id:`MAT-${t.id}-${Date.now().toString(36).toUpperCase()}`,name:t.name,type:t.type,referenceId:t.id,standard:t.standard,jurisdiction:t.jurisdiction}}
function num(v:string,n:string){const x=Number(v);if(!v.trim()||!Number.isFinite(x))throw new Error(`${n}_MUST_BE_FINITE`);return x}
function toMaterial(d:Draft,old?:Material):Material{
 if(!d.id.trim()||!d.name.trim())throw new Error("MATERIAL_ID_AND_NAME_REQUIRED");
 if(!d.Eu.trim()||!d.Gu.trim()||!d.rhou.trim())throw new Error("MATERIAL_ANALYSIS_UNITS_REQUIRED");
 const fy=d.fy.trim()?num(d.fy,"MATERIAL_FY"):undefined;
 const m:Material={id:d.id.trim(),name:d.name.trim(),type:d.type,analysis:{E:{value:num(d.E,"MATERIAL_E"),unit:d.Eu.trim()},G:{value:num(d.G,"MATERIAL_G"),unit:d.Gu.trim()},nu:num(d.nu,"MATERIAL_NU"),rho:{value:num(d.rho,"MATERIAL_RHO"),unit:d.rhou.trim()},...(fy!==undefined?{fy:{value:fy,unit:d.fyu.trim()||"MPa"}}:{})},metadata:{...(old?.metadata??{}),...(d.referenceId?{referenceTemplateId:d.referenceId}:{}),...(d.standard?{standard:d.standard}:{}),...(d.jurisdiction?{jurisdiction:d.jurisdiction}:{})}};
 if(old?.type===d.type){if(d.type==="steel"&&old.steel)m.steel=old.steel;if(d.type==="concrete"&&old.concrete)m.concrete=old.concrete;if(d.type==="wood"&&old.wood)m.wood=old.wood}
 return m;
}
function copyId(model:StructuralModel,id:string){let n=`${id}-COPY`,i=2;while(model.materials.some(x=>x.id===n))n=`${id}-COPY-${i++}`;return n}
const box={border:"1px solid #e2e8f0",borderRadius:8,padding:8,marginBottom:8} as const;

export default function MaterialQuickPanelV05({model,members,surfaces,onModelChange}:Props){
 const [open,setOpen]=useState(false),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState<Draft|null>(null),[message,setMessage]=useState("");
 useEffect(()=>{const fn=()=>setOpen(true);window.addEventListener(OPEN,fn);return()=>window.removeEventListener(OPEN,fn)},[]);
 if(!open)return null;
 const change=<K extends keyof Draft>(k:K,v:Draft[K])=>setDraft(d=>d?{...d,[k]:v}:d);
 const save=()=>{if(!draft)return;try{const old=editing?model.materials.find(x=>x.id===editing):undefined,m=toMaterial(draft,old);if(!editing&&model.materials.some(x=>x.id===m.id))throw new Error("MATERIAL_ID_ALREADY_EXISTS");const materials=editing?model.materials.map(x=>x.id===editing?m:x):[...model.materials,m];onModelChange({...model,materials},`Material ${m.name} ${editing?"updated":"added"}.`);setDraft(null);setEditing(null);setMessage("")}catch(e){setMessage(e instanceof Error?e.message:"Material update failed.")}};
 const edit=(m:Material)=>{setEditing(m.id);setDraft(fromMaterial(m));setMessage("")};
 const copy=(m:Material)=>{const d=fromMaterial(m);d.id=copyId(model,m.id);d.name=`${m.name} Copy`;setEditing(null);setDraft(d);setMessage("")};
 const template=(t:MaterialReferenceTemplateV05)=>{setEditing(null);setDraft(fromTemplate(t));setMessage("Enter project-approved E, G, nu and rho before saving.")};
 const setDefault=(kind:"materialId"|"sectionId",value:string)=>onModelChange(setModelingDefaults(model,{[kind]:value}),`Default ${kind==="materialId"?"material":"section"} updated.`);
 return <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(15,23,42,.24)",display:"flex",justifyContent:"flex-end"}}>
  <section style={{width:"min(560px,96vw)",height:"100%",overflowY:"auto",background:"#fff",padding:16}}>
   <div style={{display:"flex",justifyContent:"space-between"}}><div><small>CORE 0.5 → PyNite</small><h2>Material Library</h2></div><button onClick={()=>setOpen(false)}>Close</button></div>
   <p>Canonical fields: E, G, nu, rho and optional fy. Reference templates never inject engineering values.</p>

   <div style={box}><h3>Modeling Defaults</h3>
    <label>Default Material<select value={getDefaultMaterialId(model)} onChange={e=>setDefault("materialId",e.target.value)}><option value="">No default</option>{model.materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label>Default Section<select value={getDefaultSectionId(model)} onChange={e=>setDefault("sectionId",e.target.value)}><option value="">No default</option>{model.sections.map(s=><option key={s.id} value={s.id}>{s.designation}</option>)}</select></label>
    <small>Core keeps Section and Material independent; new members use both defaults.</small>
   </div>

   <div style={{display:"flex",justifyContent:"space-between"}}><h3>Canonical Materials</h3><button onClick={()=>{setEditing(null);setDraft(blank());setMessage("")}}>New Custom</button></div>
   {model.materials.map(m=><div key={m.id} style={box}><strong>{m.name}</strong><small style={{display:"block"}}>{m.type} · {m.id}</small><div>E {m.analysis.E.value} {m.analysis.E.unit} · G {m.analysis.G.value} {m.analysis.G.unit} · nu {m.analysis.nu}<br/>rho {m.analysis.rho.value} {m.analysis.rho.unit}{m.analysis.fy?` · fy ${m.analysis.fy.value} ${m.analysis.fy.unit}`:""}</div><button onClick={()=>edit(m)}>Edit</button><button onClick={()=>copy(m)}>Copy</button></div>)}

   <details><summary>North American Reference Library</summary>
    {(["steel","concrete","wood"] as MaterialType[]).map(type=><div key={type}><h4>{type}</h4>{MATERIAL_REFERENCE_LIBRARY_V05.filter(x=>x.type===type).map(t=><button key={t.id} onClick={()=>template(t)} style={{display:"block",width:"100%",textAlign:"left",marginBottom:4}}>{t.name} — {t.jurisdiction} · {t.standard}</button>)}</div>)}
   </details>

   {draft?<div style={{...box,background:"#eff6ff"}}><h3>{editing?"Edit":"Create"} Material</h3>
    <label>ID<input value={draft.id} readOnly={Boolean(editing)} onChange={e=>change("id",e.target.value)}/></label>
    <label>Name<input value={draft.name} onChange={e=>change("name",e.target.value)}/></label>
    <label>Type<select value={draft.type} onChange={e=>change("type",e.target.value as MaterialType)}><option value="steel">Steel</option><option value="concrete">Concrete</option><option value="wood">Wood</option><option value="other">Other</option></select></label>
    {([["E","Eu"],["G","Gu"],["rho","rhou"],["fy","fyu"]] as const).map(([v,u])=><div key={v}><label>{v}<input type="number" step="any" value={draft[v]} onChange={e=>change(v,e.target.value)}/></label><label>Unit<input value={draft[u]} onChange={e=>change(u,e.target.value)}/></label></div>)}
    <label>nu<input type="number" step="any" value={draft.nu} onChange={e=>change("nu",e.target.value)}/></label>
    {draft.standard?<small>Reference: {draft.jurisdiction} · {draft.standard}</small>:null}{message?<p>{message}</p>:null}
    <button onClick={save}>Save Material</button><button onClick={()=>{setDraft(null);setEditing(null);setMessage("")}}>Cancel</button>
   </div>:null}

   <hr/><h3>Assign Selection</h3>
   {members.length+surfaces.length>0?<AssignmentPropertiesV05 model={model} members={members} surfaces={surfaces} onModelChange={onModelChange}/>:<p>Select one or more members or surfaces to assign a material.</p>}
  </section>
 </div>
}
