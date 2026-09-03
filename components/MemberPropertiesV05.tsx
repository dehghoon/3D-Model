"use client";

import { useState, type CSSProperties } from "react";
import type { Member, StructuralDOF, StructuralModel } from "@linkoteq/structural-core";

type Props = {
  model: StructuralModel;
  members: Member[];
  onModelChange?: (model: StructuralModel, status: string) => void;
};

const DOFS: StructuralDOF[] = ["DX","DY","DZ","RX","RY","RZ"];
const card: CSSProperties = {border:"1px solid #e4e7ec",borderRadius:8,padding:9,background:"#fbfcfd",display:"grid",gap:7};
const row: CSSProperties = {display:"grid",gridTemplateColumns:"52px 1fr 1fr",gap:6,fontSize:10,alignItems:"center"};

function common<T>(values:T[]) {
  if (!values.length) return { value: undefined as T | undefined, mixed:false };
  const same=values.every((value)=>value===values[0]);
  return { value:same?values[0]:undefined, mixed:!same };
}

export default function MemberPropertiesV05({ model, members, onModelChange }: Props) {
  const [mode,setMode]=useState<"rotation"|"releases"|null>(null);
  const [rotation,setRotation]=useState("");
  const [start,setStart]=useState<Partial<Record<StructuralDOF,boolean|undefined>>>({});
  const [end,setEnd]=useState<Partial<Record<StructuralDOF,boolean|undefined>>>({});
  if (!members.length) return null;

  const openRotation=()=>{
    const state=common(members.map((item)=>item.rotationDeg??0));
    setRotation(state.mixed?"":String(state.value??0));
    setMode("rotation");
  };

  const applyRotation=()=>{
    if(!onModelChange)return;
    const value=Number(rotation);
    if(!Number.isFinite(value))return;
    const ids=new Set(members.map((item)=>item.id));
    onModelChange({
      ...model,
      members:model.members.map((item)=>ids.has(item.id)?{...item,rotationDeg:value}:item),
    },"Updated canonical Core v0.5 Member.rotationDeg.");
    setMode(null);
  };

  const openReleases=()=>{
    const build=(which:"start"|"end")=>Object.fromEntries(DOFS.map((dof)=>{
      const state=common(members.map((item)=>Boolean((which==="start"?item.startRelease:item.endRelease)?.[dof])));
      return [dof,state.mixed?undefined:Boolean(state.value)];
    })) as Partial<Record<StructuralDOF,boolean|undefined>>;
    setStart(build("start"));
    setEnd(build("end"));
    setMode("releases");
  };

  const applyReleases=()=>{
    if(!onModelChange)return;
    const startChanges=Object.fromEntries(DOFS.filter((dof)=>start[dof]!==undefined).map((dof)=>[dof,Boolean(start[dof])]));
    const endChanges=Object.fromEntries(DOFS.filter((dof)=>end[dof]!==undefined).map((dof)=>[dof,Boolean(end[dof])]));
    const ids=new Set(members.map((item)=>item.id));
    onModelChange({
      ...model,
      members:model.members.map((item)=>ids.has(item.id)?{
        ...item,
        startRelease:{...(item.startRelease??{}),...startChanges},
        endRelease:{...(item.endRelease??{}),...endChanges},
      }:item),
    },"Updated canonical Core v0.5 member end releases.");
    setMode(null);
  };

  return (
    <section className="propertyActionCard">
      <div className="propertiesSectionHeading"><strong>Member Behavior</strong><span>Core v0.5</span></div>
      <button type="button" onClick={openRotation}>Local Axis / Rotation</button>
      <button type="button" onClick={openReleases}>End Releases</button>
      <small>Local +x is startNodeId → endNodeId. Explicit localAxes vectors are preserved.</small>

      {mode==="rotation"?<div style={card}>
        <b>Local Axis / Rotation</b>
        <input value={rotation} onChange={(event)=>setRotation(event.target.value)} inputMode="decimal" placeholder="rotationDeg or multiple values"/>
        <button type="button" onClick={applyRotation}>Apply to selection</button>
      </div>:null}

      {mode==="releases"?<div style={card}>
        <div style={row}><b>DOF</b><b>I / Start</b><b>J / End</b>
          {DOFS.map((dof)=><div key={dof} style={{display:"contents"}}>
            <span>{dof}</span>
            <label><input type="checkbox" checked={Boolean(start[dof])} ref={(el)=>{if(el)el.indeterminate=start[dof]===undefined;}} onChange={()=>setStart((current)=>({...current,[dof]:current[dof]===undefined?true:!current[dof]}))}/> Released</label>
            <label><input type="checkbox" checked={Boolean(end[dof])} ref={(el)=>{if(el)el.indeterminate=end[dof]===undefined;}} onChange={()=>setEnd((current)=>({...current,[dof]:current[dof]===undefined?true:!current[dof]}))}/> Released</label>
          </div>)}
        </div>
        <small>Mixed DOFs remain unchanged until explicitly edited.</small>
        <button type="button" onClick={applyReleases}>Apply to selection</button>
      </div>:null}
    </section>
  );
}
