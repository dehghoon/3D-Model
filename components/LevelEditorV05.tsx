"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { StructuralModel } from "@linkoteq/structural-core";
import { createLevel, deleteLevel } from "../lib/modeling/level-service";
import { publishLevels } from "../lib/level-visual-store";

export default function LevelEditorV05({model,onModelChange}:{model:StructuralModel;onModelChange:(model:StructuralModel,status:string)=>void}) {
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("Level 1");
  const [elevation,setElevation]=useState("0");

  useEffect(()=>{ publishLevels(model.levels); },[model.levels]);

  useEffect(()=>{
    const show=()=>setOpen(true), hide=()=>setOpen(false);
    window.addEventListener("linkoteq:levels-panel-open",show);
    window.addEventListener("linkoteq:levels-panel-close",hide);
    return ()=>{window.removeEventListener("linkoteq:levels-panel-open",show);window.removeEventListener("linkoteq:levels-panel-close",hide);};
  },[]);

  function add(){
    try{
      const result=createLevel(model,{name,elevation:Number(elevation)});
      onModelChange(result.model,`Level ${result.level.id} created.`);
      setName(`Level ${result.model.levels.length+1}`);
      setElevation(String(Number(elevation)+3));
    }catch(error){onModelChange(model,error instanceof Error?error.message:"Level creation failed.");}
  }

  function remove(id:string){
    try{onModelChange(deleteLevel(model,id),`Level ${id} removed.`);}
    catch(error){onModelChange(model,error instanceof Error?error.message:"Level removal failed.");}
  }

  if(!open || typeof document==="undefined") return null;
  return createPortal(
    <div className="lgModalBackdrop" onMouseDown={()=>setOpen(false)}>
      <section className="panelBlock lgPanel lgPortalPanel" onMouseDown={event=>event.stopPropagation()}>
        <header className="lgHeader">
          <div><span>MODEL SETUP</span><h3>Levels</h3><p>Create canonical elevation references.</p></div>
          <button type="button" onClick={()=>setOpen(false)} aria-label="Close Levels">×</button>
        </header>
        <div className="lgBody">
          <section className="lgCard">
            <div className="lgTitle"><span>NEW LEVEL</span><strong>Add elevation</strong></div>
            <div className="lgTwo">
              <label><span>Name</span><input value={name} onChange={e=>setName(e.target.value)}/></label>
              <label><span>Elevation</span><input type="number" step="any" value={elevation} onChange={e=>setElevation(e.target.value)}/></label>
            </div>
            <button type="button" className="lgPrimary" onClick={add}>Add Level</button>
          </section>
          <section className="lgCard">
            <div className="lgTitle row"><div><span>MODEL</span><strong>Existing levels</strong></div><b>{model.levels.length}</b></div>
            <div className="lgList">
              {model.levels.slice().sort((a,b)=>a.elevation-b.elevation).map(level=>
                <div className="lgItem" key={level.id}>
                  <div><strong>{level.name}</strong><span>{level.elevation}</span></div>
                  <button type="button" className="danger" onClick={()=>remove(level.id)}>Delete</button>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>,document.body);
}
