"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import { applyGridOffsetSystem, readGridOffsetSystem, type GridOffsetLine, type GridOffsetSystem } from "../lib/modeling/grid-system-service";

const defaults=():GridOffsetSystem=>({
  xLines:[0,6,12,18].map((offset,i)=>({label:String(i+1),offset})),
  yLines:[0,6,12,18].map((offset,i)=>({label:String.fromCharCode(65+i),offset})),
});

function valid(model:StructuralModel){
  const s=readGridOffsetSystem(model);
  return s.xLines.length>=2 && s.yLines.length>=2 &&
    s.xLines.length+s.yLines.length===model.grids.length &&
    !s.xLines.every(line=>/^[A-Z]+$/i.test(line.label)) &&
    !s.yLines.every(line=>/^\d+$/.test(line.label));
}

function Axis({title,axis,lines,setLines}:{title:string;axis:"x"|"y";lines:GridOffsetLine[];setLines:(v:GridOffsetLine[])=>void}){
  const update=(i:number,p:Partial<GridOffsetLine>)=>setLines(lines.map((line,n)=>n===i?{...line,...p}:line));
  const add=()=>{
    const last=lines.at(-1), prev=lines.at(-2);
    const step=last&&prev?Math.max(Math.abs(last.offset-prev.offset),1):6;
    setLines([...lines,{label:axis==="x"?String(lines.length+1):String.fromCharCode(65+lines.length),offset:last?last.offset+step:0}]);
  };
  return <section className="gridOffsetSection">
    <div className="gridOffsetSectionHead"><div><span>{title}</span><strong>{axis==="x"?"Vertical grid lines":"Horizontal grid lines"}</strong></div><button type="button" onClick={add}>Add line</button></div>
    <div className="gridOffsetTable">
      <div className="gridOffsetTableHead"><span>Label</span><span>Offset from origin</span><span /></div>
      {lines.map((line,i)=><div className="gridOffsetRow" key={`${axis}-${i}`}>
        <input value={line.label} onChange={e=>update(i,{label:e.target.value})}/>
        <input type="number" step="any" value={line.offset} onChange={e=>update(i,{offset:Number(e.target.value)})}/>
        <button type="button" className="gridOffsetDelete" disabled={lines.length<=2} onClick={()=>setLines(lines.filter((_,n)=>n!==i))}>×</button>
      </div>)}
    </div>
  </section>;
}

export default function GridOffsetEditorV07({model,onModelChange}:{model:StructuralModel;onModelChange:(m:StructuralModel,s:string)=>void}){
  const initial=useMemo(()=>valid(model)?readGridOffsetSystem(model):defaults(),[model.project.id]);
  const [system,setSystem]=useState<GridOffsetSystem>(initial);
  const initialized=useRef(false);

  useEffect(()=>{
    if(initialized.current) return;
    initialized.current=true;
    if(!valid(model)) onModelChange(applyGridOffsetSystem(model,initial),"Canonical Grid system initialized.");
  },[initial,model,onModelChange]);

  const save=()=>{
    try{onModelChange(applyGridOffsetSystem(model,system),"Grid system saved.");}
    catch(error){onModelChange(model,error instanceof Error?error.message:"Grid update failed.");}
  };

  return <div className="gridOffsetEditor">
    <div className="gridOffsetIntro"><strong>Define each Grid line independently.</strong><span>Vertical: 1, 2, 3, 4. Horizontal: A, B, C, D. Browser-local Grid state is not used.</span></div>
    <Axis title="Numbered axes" axis="x" lines={system.xLines} setLines={xLines=>setSystem(s=>({...s,xLines}))}/>
    <Axis title="Lettered axes" axis="y" lines={system.yLines} setLines={yLines=>setSystem(s=>({...s,yLines}))}/>
    <button type="button" className="lgPrimary gridOffsetSave" onClick={save}>Save Grid System</button>
  </div>;
}
