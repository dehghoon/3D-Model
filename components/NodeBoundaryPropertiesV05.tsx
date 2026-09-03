"use client";

import { useState } from "react";
import type { Node, StructuralDOF, StructuralModel, SupportRestraints, SupportSpring } from "@linkoteq/structural-core";

type Props = { model: StructuralModel; nodes: Node[]; onModelChange?: (model: StructuralModel, status: string) => void };
const DOFS: StructuralDOF[] = ["DX","DY","DZ","RX","RY","RZ"];
const EMPTY: SupportRestraints = { DX:false,DY:false,DZ:false,RX:false,RY:false,RZ:false };

function nextId(prefix:string, ids:string[]) {
  let i=1; const used=new Set(ids); while(used.has(`${prefix}${i}`)) i+=1; return `${prefix}${i}`;
}
function unitValue(value:string, unit:string) {
  const n=Number(value);
  if(!Number.isFinite(n)) throw new Error("A finite numeric value is required.");
  if(!unit.trim()) throw new Error("An explicit unit is required by Core v0.5.");
  return { value:n, unit:unit.trim() };
}
function common(values:boolean[]) {
  return values.every(v=>v===values[0]) ? values[0] : undefined;
}

export default function NodeBoundaryPropertiesV05({model,nodes,onModelChange}:Props) {
  const [mode,setMode]=useState<"support"|"spring"|"movement"|null>(null);
  const [restraints,setRestraints]=useState<Partial<Record<StructuralDOF,boolean|undefined>>>({});
  const [dof,setDof]=useState<StructuralDOF>("DX");
  const [value,setValue]=useState("");
  const [unit,setUnit]=useState("");
  const [behavior,setBehavior]=useState<SupportSpring["behavior"]>("two-way");
  const [loadCaseId,setLoadCaseId]=useState("");
  if(!nodes.length) return null;

  const nodeIds=new Set(nodes.map(n=>n.id));
  const springs=(model.supportSprings??[]).filter(s=>nodeIds.has(s.nodeId));
  const movements=(model.enforcedNodeDisplacements??[]).filter(r=>nodeIds.has(r.nodeId));

  const openSupport=()=>{
    const next=Object.fromEntries(DOFS.map(d=>[d,common(nodes.map(n=>Boolean(model.supports.find(s=>s.nodeId===n.id)?.restraints[d])))]));
    setRestraints(next); setMode("support");
  };
  const applySupport=()=>{
    if(!onModelChange) return;
    const changes=Object.fromEntries(DOFS.filter(d=>restraints[d]!==undefined).map(d=>[d,Boolean(restraints[d])])) as Partial<SupportRestraints>;
    let next=[...model.supports];
    for(const node of nodes){
      const i=next.findIndex(s=>s.nodeId===node.id);
      if(i>=0) next[i]={...next[i],restraints:{...next[i].restraints,...changes}};
      else next.push({id:nextId("SUP",next.map(s=>s.id)),nodeId:node.id,restraints:{...EMPTY,...changes}});
    }
    onModelChange({...model,supports:next},"Updated canonical Core v0.5 support restraints."); setMode(null);
  };
  const addSpring=()=>{
    if(!onModelChange) return;
    try{
      const stiffness=unitValue(value,unit); let next=[...(model.supportSprings??[])];
      for(const node of nodes) next.push({id:nextId("SPR",next.map(s=>s.id)),nodeId:node.id,dof,stiffness,behavior});
      onModelChange({...model,supportSprings:next},"Added canonical Core v0.5 SupportSpring record."); setValue("");
    }catch(e){onModelChange(model,e instanceof Error?e.message:"Support spring update failed.");}
  };
  const addMovement=()=>{
    if(!onModelChange) return;
    try{
      const magnitude=unitValue(value,unit); let next=[...(model.enforcedNodeDisplacements??[])];
      for(const node of nodes) next.push({id:nextId("END",next.map(r=>r.id)),nodeId:node.id,dof,magnitude,loadCaseId:loadCaseId||undefined});
      onModelChange({...model,enforcedNodeDisplacements:next},"Added canonical Core v0.5 EnforcedNodeDisplacement record."); setValue("");
    }catch(e){onModelChange(model,e instanceof Error?e.message:"Prescribed movement update failed.");}
  };

  return <section className="propertyActionCard">
    <div className="propertiesSectionHeading"><strong>Boundary Conditions</strong><span>Core v0.5</span></div>
    <div className="propertyActionGrid">
      <button onClick={openSupport}>Support</button>
      <button onClick={()=>setMode("spring")}>Support Springs</button>
      <button onClick={()=>setMode("movement")}>Prescribed Movement</button>
    </div>

    {mode==="support"?<div className="propertyCoreSummary">
      {DOFS.map(d=><label key={d}><input type="checkbox" checked={Boolean(restraints[d])}
        ref={el=>{if(el)el.indeterminate=restraints[d]===undefined}}
        onChange={()=>setRestraints(c=>({...c,[d]:c[d]===undefined?true:!c[d]}))}/>{" "}{d} restrained</label>)}
      <small>Support restraints and SupportSpring records are separate Core v0.5 entities.</small>
      <button onClick={applySupport}>Apply to selection</button>
    </div>:null}

    {mode==="spring"?<div className="propertyCoreSummary">
      <b>Support Springs</b>
      <select value={dof} onChange={e=>setDof(e.target.value as StructuralDOF)}>{DOFS.map(d=><option key={d}>{d}</option>)}</select>
      <input value={value} onChange={e=>setValue(e.target.value)} placeholder="Stiffness"/>
      <input value={unit} onChange={e=>setUnit(e.target.value)} placeholder="Explicit unit"/>
      <select value={behavior} onChange={e=>setBehavior(e.target.value as SupportSpring["behavior"])}>
        <option value="two-way">two-way</option><option value="tension-only">tension-only</option><option value="compression-only">compression-only</option>
      </select>
      <button onClick={addSpring}>Add to selected nodes</button>
      <small>{springs.length} SupportSpring record(s) on selection.</small>
    </div>:null}

    {mode==="movement"?<div className="propertyCoreSummary">
      <b>Prescribed Movement</b>
      <select value={dof} onChange={e=>setDof(e.target.value as StructuralDOF)}>{DOFS.map(d=><option key={d}>{d}</option>)}</select>
      <input value={value} onChange={e=>setValue(e.target.value)} placeholder="Magnitude"/>
      <input value={unit} onChange={e=>setUnit(e.target.value)} placeholder="Explicit unit"/>
      <select value={loadCaseId} onChange={e=>setLoadCaseId(e.target.value)}>
        <option value="">Not assigned</option>{model.loadCases.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button onClick={addMovement}>Add to selected nodes</button>
      <small>{movements.length} EnforcedNodeDisplacement record(s) on selection.</small>
    </div>:null}
  </section>;
}
