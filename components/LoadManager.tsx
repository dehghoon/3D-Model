"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Load, LoadCase, LoadCombination, LoadSource, Member, Node, StructuralModel, Surface } from "@linkoteq/structural-core";

type LoadMode = "slab" | "wall" | "beam" | "node";
type Props = {
  model: StructuralModel;
  selectedSurface?: Surface;
  selectedMember?: Member;
  selectedNode?: Node;
  onModelChange: (next: StructuralModel, message?: string) => void;
};
type SnowWriteback = { runId: string; modelSchemaVersion: string; loadSources?: LoadSource[]; loadCases?: LoadCase[]; loads?: Load[]; warnings?: string[]; errors?: string[]; };
type ClimateRecord = { province: string; location: string; ss: number; sr: number; source?: string };

const card: React.CSSProperties = { border: "1px solid #e4e7ec", borderRadius: 8, padding: 8, background: "#fbfcfd", display: "grid", gap: 6 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 };
const input: React.CSSProperties = { width: "100%", border: "1px solid #d0d5dd", borderRadius: 6, padding: "6px 7px", background: "white", fontSize: 11 };
const button: React.CSSProperties = { border: "1px solid #cfd6df", background: "white", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer" };
const primary: React.CSSProperties = { ...button, background: "#17202a", color: "white", borderColor: "#17202a" };
const muted: React.CSSProperties = { fontSize: 9, color: "#667085", lineHeight: 1.4 };

function sourceStatus(model: StructuralModel, category: string) { return model.loadSources?.find(s => s.category === category)?.status || "not generated"; }
function num(v: string, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function slabGeometry(model: StructuralModel, slab?: Surface) {
  if (!slab) return { slope: 0, larger: 0, smaller: 0 };
  const pts = slab.boundaryNodeIds.map(id => model.nodes.find(node => node.id === id)?.position).filter(Boolean) as Array<{x:number;y:number;z:number}>;
  if (pts.length < 3) return { slope: 0, larger: 0, smaller: 0 };
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const dx = Math.max(...xs)-Math.min(...xs), dy = Math.max(...ys)-Math.min(...ys);
  const a = {x:pts[1].x-pts[0].x,y:pts[1].y-pts[0].y,z:pts[1].z-pts[0].z}, b = {x:pts[2].x-pts[0].x,y:pts[2].y-pts[0].y,z:pts[2].z-pts[0].z};
  const nx=a.y*b.z-a.z*b.y, ny=a.z*b.x-a.x*b.z, nz=a.x*b.y-a.y*b.x;
  const slope=Math.atan2(Math.hypot(nx,ny),Math.abs(nz))*180/Math.PI;
  return { slope:Number.isFinite(slope)?slope:0, larger:Math.max(dx,dy), smaller:Math.min(dx,dy) };
}
function autoCb(larger:number,smaller:number,cw:number){
  if(!(larger>0)||!(smaller>0)||!(cw>0)) return {lc:0,cb:0.8,threshold:70};
  const l=Math.max(larger,smaller),w=Math.min(larger,smaller),lc=2*w-(w*w/l),threshold=70/(cw*cw);
  const cb=lc<=threshold?0.8:(1/cw)*(1-(1-0.8*cw)*Math.exp(-((lc*cw*cw)-70)/100));
  return {lc,cb,threshold};
}

export default function LoadManager({ model, selectedSurface, selectedMember, selectedNode, onModelChange }: Props) {
  const [open,setOpen]=useState(false),[mode,setMode]=useState<LoadMode>("slab"),[advanced,setAdvanced]=useState(false),[busy,setBusy]=useState(false);
  const [dead,setDead]=useState("1.0"),[live,setLive]=useState("1.9"),[wind,setWind]=useState("1.0"),[seismic,setSeismic]=useState("10.0");
  const [importance,setImportance]=useState("1.0"),[cw,setCw]=useState("1.0"),[surfaceType,setSurfaceType]=useState("normal");
  const [province,setProvince]=useState(""),[location,setLocation]=useState(""),[provinces,setProvinces]=useState<string[]>([]),[locations,setLocations]=useState<string[]>([]),[ss,setSs]=useState(""),[sr,setSr]=useState("");
  const [slopeOverride,setSlopeOverride]=useState<string|null>(null),[cbOverride,setCbOverride]=useState<string|null>(null),[message,setMessage]=useState("Choose a load type, then select the matching model element.");

  const slab=selectedSurface?.type==="slab"?selectedSurface:undefined;
  const wall=selectedSurface?.type==="wall"?selectedSurface:undefined;
  const beam=selectedMember?.type==="beam"?selectedMember:undefined;
  const geometry=useMemo(()=>slabGeometry(model,slab),[model,slab]);
  const cbAuto=useMemo(()=>autoCb(geometry.larger,geometry.smaller,num(cw,1)),[geometry,cw]);
  const slope=slopeOverride===null?geometry.slope:num(slopeOverride,geometry.slope),cb=cbOverride===null?cbAuto.cb:num(cbOverride,cbAuto.cb);
  const activeTarget = mode==="slab"?slab:mode==="wall"?wall:mode==="beam"?beam:selectedNode;
  const activeLoads=useMemo(()=>activeTarget?model.loads.filter(l=>l.targetId===activeTarget.id):[],[model.loads,activeTarget]);

  useEffect(()=>{fetch("/api/calculators/snow/climate").then(r=>r.json()).then(d=>setProvinces(Array.isArray(d.provinces)?d.provinces:[])).catch(()=>setMessage("Could not load Snow Calculator locations."));},[]);
  useEffect(()=>{setLocation("");setLocations([]);if(!province)return;fetch(`/api/calculators/snow/climate?province=${encodeURIComponent(province)}`).then(r=>r.json()).then(d=>setLocations(Array.isArray(d.locations)?d.locations:[])).catch(()=>setMessage("Could not load locations."));},[province]);
  useEffect(()=>{if(!province||!location)return;fetch(`/api/calculators/snow/climate?province=${encodeURIComponent(province)}&location=${encodeURIComponent(location)}`).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d?.detail||d?.error||"Climate lookup failed");return d as ClimateRecord;}).then(d=>{setSs(String(d.ss));setSr(String(d.sr));setMessage(`${d.location}, ${d.province}: Ss ${d.ss} kPa · Sr ${d.sr} kPa loaded.`);}).catch(e=>setMessage(e instanceof Error?e.message:"Climate lookup failed."));},[province,location]);

  function withSource(next:StructuralModel,source:LoadSource){return {...next,schemaVersion:"0.2" as const,loadSources:[...(next.loadSources||[]).filter(s=>s.id!==source.id),source]};}
  function assignManual(category:"dead"|"live"|"wind"|"seismic", valueText:string) {
    const target = mode==="slab"?slab:mode==="wall"?wall:mode==="beam"?beam:selectedNode;
    if(!target) return setMessage(`Select a ${mode} first.`);
    const magnitude=Number(valueText); if(!Number.isFinite(magnitude)||magnitude<0) return setMessage("Load must be a non-negative number.");
    const caseId=category==="dead"?"D":category==="live"?"L":category==="wind"?"W":"E";
    const sourceId=`SRC-${caseId}`;
    const source:LoadSource={id:sourceId,category,name:`${category[0].toUpperCase()+category.slice(1)} Load`,calculator:"manual",status:"manual",generatedAt:new Date().toISOString(),summary:{targetType:mode,magnitude}};
    const loadCase:LoadCase={id:caseId,name:category[0].toUpperCase()+category.slice(1),category,sourceId,analysisType:"static"};
    const type = mode==="slab"?"area":mode==="beam"||mode==="wall"?"line":"nodal";
    const targetType = mode==="slab"||mode==="wall"?"surface":mode==="beam"?"member":"node";
    const unit = mode==="slab"?"kPa":mode==="beam"||mode==="wall"?"kN/m":"kN";
    const direction = category==="wind"||category==="seismic"?{x:1,y:0,z:0}:{x:0,y:0,z:-1};
    const load:Load={id:`${caseId}-${mode}-${target.id}`,type,targetId:target.id,targetType,loadCaseId:caseId,direction,magnitude,unit,provenance:{sourceId,note:`Manual ${category} load assigned in ${mode} load tool`}};
    let next:StructuralModel={...model,schemaVersion:"0.2",loadCases:[...model.loadCases.filter(c=>c.id!==caseId),loadCase],loads:[...model.loads.filter(l=>l.id!==load.id),load]};
    next=withSource(next,source); onModelChange(next,`${loadCase.name} load assigned to ${target.id}.`); setMessage(`${loadCase.name} assigned to ${target.id}.`);
  }
  function setTransfer(method:"one-way"|"two-way"|"shell"|"manual"){if(!slab)return;onModelChange({...model,schemaVersion:"0.2",surfaces:model.surfaces.map(s=>s.id===slab.id?{...s,loadTransfer:{...(s.loadTransfer||{}),method}}:s)},`${slab.id} load transfer = ${method}.`);}
  async function runSnow(){
    if(!slab)return setMessage("Select a slab first."); if(!province||!location)return setMessage("Choose Province / Territory and Location first."); if(!ss||!sr)return setMessage("Climate data has not loaded yet.");
    setBusy(true);setMessage("Running NBCC 2020 Snow Calculator…");const runId=`snow-${Date.now()}`;
    const payload={modelSchemaVersion:"0.2",projectId:model.project.id,runId,calculator:"snow",targetIds:[slab.id],inputs:{target_surface_id:slab.id,mode:"UNIFORM_ROOF",jurisdiction:model.project.jurisdiction||`${location}, ${province}`,common:{ss:num(ss),sr_climatic:num(sr),roof_slope_alpha:slope,roof_surface_type:surfaceType,is:num(importance,1),cw:num(cw,1),cb,adjacent_surface_drift_applicable:false},geometry_context:{larger_plan_dimension_m:geometry.larger,smaller_plan_dimension_m:geometry.smaller,characteristic_length_m:cbAuto.lc,auto_cb:cbAuto.cb,auto_slope_deg:geometry.slope,province,location},lower_roof_cases:[],distribution_points:8}};
    try{const response=await fetch("/api/calculators/snow",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw new Error(data?.error||data?.detail||`Snow service returned ${response.status}`);const writeback=data as SnowWriteback;if(writeback.errors?.length)throw new Error(writeback.errors.join("; "));const ids=new Set((writeback.loadSources||[]).map(s=>s.id)),caseIds=new Set((writeback.loadCases||[]).map(c=>c.id)),loadIds=new Set((writeback.loads||[]).map(l=>l.id));onModelChange({...model,schemaVersion:"0.2",loadSources:[...(model.loadSources||[]).filter(s=>!ids.has(s.id)),...(writeback.loadSources||[])],loadCases:[...model.loadCases.filter(c=>!caseIds.has(c.id)),...(writeback.loadCases||[])],loads:[...model.loads.filter(l=>!loadIds.has(l.id)),...(writeback.loads||[])]},`Snow load generated for ${slab.id}.`);setMessage(writeback.warnings?.length?`Snow generated with warning: ${writeback.warnings.join("; ")}`:`Snow generated and assigned to ${slab.id}.`);}catch(e){setMessage(e instanceof Error?e.message:"Snow calculation failed.");}finally{setBusy(false);}
  }
  function addDraftCombinations(){
    const combos:LoadCombination[]=[
      {id:"ULS-GRAV-S",name:"ULS draft · gravity + snow",limitState:"ULS",factors:{D:1.25,L:1.5,S:1.0},codeRef:"Draft only — engineer must verify governing NBCC combination"},
      {id:"ULS-WIND",name:"ULS draft · gravity + wind",limitState:"ULS",factors:{D:1.25,L:0.5,W:1.4},codeRef:"Draft only — engineer must verify governing NBCC wind combination"},
      {id:"ULS-SEISMIC",name:"ULS draft · gravity + seismic",limitState:"ULS",factors:{D:1.0,L:0.5,E:1.0},codeRef:"Draft only — engineer must verify governing NBCC seismic combination"},
      {id:"SLS-ALL",name:"SLS draft · D + L + S/W/E review",limitState:"SLS",factors:{D:1.0,L:1.0,S:1.0,W:1.0,E:1.0},codeRef:"Draft review set — engineer selects applicable lateral action"}
    ];
    onModelChange({...model,schemaVersion:"0.2",loadCombinations:[...model.loadCombinations.filter(c=>!combos.some(x=>x.id===c.id)),...combos]},"Draft gravity, snow, wind and seismic combinations added for review.");
  }
  function openMode(next:LoadMode){setMode(next);setOpen(true);setMessage(`Select a ${next} in the model, then assign the available load.`);}

  const targetText=activeTarget?`${activeTarget.id}`:`select a ${mode}`;
  const content=<div style={{display:"grid",gap:8}}>
    <div style={card}><strong style={{fontSize:12}}>{mode[0].toUpperCase()+mode.slice(1)} Load · Core v0.2</strong><div style={muted}>Target: {targetText}</div>{mode==="slab"&&slab&&<label style={{fontSize:10}}>Slab load transfer<select style={input} value={slab.loadTransfer?.method||"two-way"} onChange={e=>setTransfer(e.target.value as "one-way"|"two-way"|"shell"|"manual")}><option value="one-way">One-way</option><option value="two-way">Two-way</option><option value="shell">Shell</option><option value="manual">Manual</option></select></label>}</div>
    <div style={card}><strong style={{fontSize:11}}>Load Sources</strong>{(["dead","live","snow","wind","seismic"] as const).map(c=><div key={c} style={{display:"flex",justifyContent:"space-between",fontSize:10}}><span>{c[0].toUpperCase()+c.slice(1)}</span><span style={{color:sourceStatus(model,c)==="not generated"?"#98a2b3":"#027a48"}}>{sourceStatus(model,c)}</span></div>)}</div>

    {mode==="slab"&&<>
      <div style={card}><strong style={{fontSize:11}}>Dead / Live · area load</strong><div style={row}><label style={{fontSize:9}}>Dead kPa<input style={input} value={dead} onChange={e=>setDead(e.target.value)}/></label><label style={{fontSize:9}}>Live kPa<input style={input} value={live} onChange={e=>setLive(e.target.value)}/></label></div><div style={row}><button style={button} disabled={!slab} onClick={()=>assignManual("dead",dead)}>Assign Dead to slab</button><button style={button} disabled={!slab} onClick={()=>assignManual("live",live)}>Assign Live to slab</button></div></div>
      <div style={card}><strong style={{fontSize:11}}>Snow · NBCC 2020</strong><div style={muted}>Select the slab first. Only location and Importance Factor are required; roof geometry is read from the model.</div><label style={{fontSize:9}}>Province / Territory<select style={input} value={province} onChange={e=>setProvince(e.target.value)}><option value="">Select province</option>{provinces.map(p=><option key={p}>{p}</option>)}</select></label><label style={{fontSize:9}}>Location<select style={input} value={location} disabled={!province} onChange={e=>setLocation(e.target.value)}><option value="">{province?"Select location":"Select province first"}</option>{locations.map(l=><option key={l}>{l}</option>)}</select></label><label style={{fontSize:9}}>Importance factor, Is<input style={input} value={importance} onChange={e=>setImportance(e.target.value)}/></label><div style={{padding:"6px 7px",borderRadius:6,background:"#f2f4f7",fontSize:9,lineHeight:1.5}}><b>Auto from selected slab</b><br/>Roof: {geometry.larger.toFixed(2)} × {geometry.smaller.toFixed(2)} m · slope {geometry.slope.toFixed(2)}° · Cb {cbAuto.cb.toFixed(3)}{location&&<> · Ss {ss||"…"} · Sr {sr||"…"} kPa</>}</div><button style={button} onClick={()=>setAdvanced(v=>!v)}>{advanced?"Hide":"Review / edit"} auto parameters</button>{advanced&&<div style={{...card,background:"white"}}><div style={row}><label style={{fontSize:9}}>Ss kPa<input style={input} value={ss} onChange={e=>setSs(e.target.value)}/></label><label style={{fontSize:9}}>Sr kPa<input style={input} value={sr} onChange={e=>setSr(e.target.value)}/></label></div><div style={row}><label style={{fontSize:9}}>Slope °<input style={input} value={slopeOverride??geometry.slope.toFixed(3)} onChange={e=>setSlopeOverride(e.target.value)}/><button style={button} onClick={()=>setSlopeOverride(null)}>Use model</button></label><label style={{fontSize:9}}>Roof surface<select style={input} value={surfaceType} onChange={e=>setSurfaceType(e.target.value)}><option value="normal">Normal</option><option value="smooth_slippery">Smooth / slippery</option></select></label></div><div style={row}><label style={{fontSize:9}}>Cw<input style={input} value={cw} onChange={e=>setCw(e.target.value)}/></label><label style={{fontSize:9}}>Cb<input style={input} value={cbOverride??cbAuto.cb.toFixed(3)} onChange={e=>setCbOverride(e.target.value)}/><button style={button} onClick={()=>setCbOverride(null)}>Use model</button></label></div></div>}<button style={primary} disabled={!slab||busy} onClick={runSnow}>{busy?"Calculating…":"Run Snow → selected slab"}</button></div>
    </>}

    {mode==="wall"&&<div style={card}><strong style={{fontSize:11}}>Wind · wall line load</strong><div style={muted}>Select a wall, enter the resolved wind line load, then assign it to that wall.</div><label style={{fontSize:9}}>Wind kN/m<input style={input} value={wind} onChange={e=>setWind(e.target.value)}/></label><button style={primary} disabled={!wall} onClick={()=>assignManual("wind",wind)}>Assign Wind to wall</button></div>}
    {mode==="beam"&&<div style={card}><strong style={{fontSize:11}}>Beam loads · line load</strong><div style={row}><label style={{fontSize:9}}>Dead kN/m<input style={input} value={dead} onChange={e=>setDead(e.target.value)}/></label><label style={{fontSize:9}}>Live kN/m<input style={input} value={live} onChange={e=>setLive(e.target.value)}/></label></div><div style={row}><button style={button} disabled={!beam} onClick={()=>assignManual("dead",dead)}>Assign Dead to beam</button><button style={button} disabled={!beam} onClick={()=>assignManual("live",live)}>Assign Live to beam</button></div></div>}
    {mode==="node"&&<div style={card}><strong style={{fontSize:11}}>Node loads · point load</strong><div style={row}><label style={{fontSize:9}}>Dead kN<input style={input} value={dead} onChange={e=>setDead(e.target.value)}/></label><label style={{fontSize:9}}>Live kN<input style={input} value={live} onChange={e=>setLive(e.target.value)}/></label></div><label style={{fontSize:9}}>Seismic kN<input style={input} value={seismic} onChange={e=>setSeismic(e.target.value)}/></label><div style={row}><button style={button} disabled={!selectedNode} onClick={()=>assignManual("dead",dead)}>Assign Dead</button><button style={button} disabled={!selectedNode} onClick={()=>assignManual("live",live)}>Assign Live</button></div><button style={primary} disabled={!selectedNode} onClick={()=>assignManual("seismic",seismic)}>Assign Seismic to node</button></div>}

    <div style={card}><strong style={{fontSize:11}}>Load Cases / Combinations</strong>{model.loadCases.length?model.loadCases.map(c=><div key={c.id} style={{fontSize:10}}>{c.id} · {c.name} <span style={{color:"#667085"}}>({c.category})</span></div>):<span style={muted}>No load cases yet.</span>}<button style={button} onClick={addDraftCombinations}>Add draft D/L/S/W/E combinations</button><small style={{fontSize:8,color:"#b54708"}}>Draft combinations are review templates, not certified code selection.</small></div>
    {activeTarget&&<div style={card}><strong style={{fontSize:11}}>Loads on {activeTarget.id}</strong>{activeLoads.length?activeLoads.map(l=><div key={l.id} style={{fontSize:10}}>{l.loadCaseId}: {l.magnitude} {l.unit} · {l.type}</div>):<span style={muted}>No loads assigned.</span>}</div>}
    <div style={muted}>{message}</div>
  </div>;

  return <>
    <div className="loadManagerEmbedded">{content}</div>
    {typeof document!=="undefined"&&createPortal(<>
      <div className="loadManagerLauncherGroup" aria-label="Load assignment tools">
        <button onClick={()=>openMode("slab")}>Slab Load</button><button onClick={()=>openMode("wall")}>Wall Load</button><button onClick={()=>openMode("beam")}>Beam Load</button><button onClick={()=>openMode("node")}>Node Load</button>
      </div>
      {open&&<div className="loadManagerBackdrop" onPointerDown={()=>setOpen(false)}><aside className="loadManagerDrawer" onPointerDown={e=>e.stopPropagation()}><div className="loadManagerDrawerHeader"><div><strong>{mode[0].toUpperCase()+mode.slice(1)} Load</strong><span> · {targetText}</span></div><button onClick={()=>setOpen(false)} aria-label="Close Load Manager">×</button></div><div className="loadManagerModeTabs"><button className={mode==="slab"?"active":""} onClick={()=>setMode("slab")}>Slab</button><button className={mode==="wall"?"active":""} onClick={()=>setMode("wall")}>Wall</button><button className={mode==="beam"?"active":""} onClick={()=>setMode("beam")}>Beam</button><button className={mode==="node"?"active":""} onClick={()=>setMode("node")}>Node</button></div><div className="loadManagerDrawerBody">{content}</div></aside></div>}
    </>,document.body)}
  </>;
}
