"use client";

import { getJoistDesignationCandidates, SJI_LOAD_TABLE_SOURCE } from "../lib/catalogs/sji-joist-designations";

import { useEffect, useMemo, useRef, useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";
import SimpleFrameModeler from "./SimpleFrameModeler";
import { createSimpleFrame, DEFAULT_FRAME } from "../lib/simple-frame";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import { detectJoistBay, layoutJoists, type JoistBay } from "../lib/editor/joist-bay-layout";
import ViewportDisplayOptionsV05 from "./ViewportDisplayOptionsV05";
import { projectSapGridsForGridTool, readSapHandoff, type SapHandoff } from "../lib/import/sap2000-handoff";

import { MEMBER_DRAW_PICK_EVENT, MODELING_COMMAND_EVENT, SURFACE_FINISH_EVENT, UTILITY_COMMAND_EVENT, usePointToolState } from "../lib/editor/member-draw-events";
import { useInteractionState } from "../lib/editor/interaction-store";
import { usePublishedSelections } from "../lib/editor/selection-store";

type WorkspaceMode = "simple" | "advanced";
type ModelingTool = "Column" | "Beam" | "Brace" | "Joist" | "Slab" | "Wall";
type UtilityTool = "Select" | "View" | "Move" | "Copy" | "Delete";

const modelingTools: ModelingTool[] = ["Column", "Beam", "Brace", "Joist", "Slab", "Wall"];
const utilityTools: UtilityTool[] = ["Select", "View", "Move", "Copy", "Delete"];

function clickProjectAction(label: "New" | "Open" | "Save"): void {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".engineeringEditorStage .appShell > .topbar button",
    ),
  ).find((item) => item.textContent?.trim() === label);

  button?.click();
}

function openGrid(): void {
  window.dispatchEvent(new Event("linkoteq:grid-panel-open"));
}

function openLevels(): void {
  window.dispatchEvent(new Event("linkoteq:levels-panel-open"));
}

function utilityDescription(tool: UtilityTool): string {
  switch (tool) {
    case "Select":
      return "Tap or window select";
    case "View":
      return "Orbit, pan and zoom";
    case "Move":
      return "Snap move selection";
    case "Copy":
      return "Snap copy selection";
    case "Delete":
      return "Remove selection";
  }
}

export default function StructuralEditorShellV3() {
  const [mobilePanel, setMobilePanel] = useState<"tools" | "setup" | "display" | "project" | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>("simple");
  const [joistSetupOpen, setJoistSetupOpen] = useState(false);
  const [joistAssignment, setJoistAssignment] = useState<"area" | "two-point">("area");
  const [joistFirstPoint, setJoistFirstPoint] = useState<Vec3 | null>(null);
  const joistFirstPointRef = useRef<Vec3 | null>(null);
  const [joistSeries, setJoistSeries] = useState<"K" | "LH" | "DLH" | "other">("K");
  const [joistDesignation, setJoistDesignation] = useState("");
  const [joistSectionId, setJoistSectionId] = useState("");
  const [joistBay, setJoistBay] = useState<JoistBay | null>(null);
  const [joistDrafts, setJoistDrafts] = useState<Array<{id:string;designation:string;start:Vec3;end:Vec3}>>([]);
  const [joistDirection, setJoistDirection] = useState<0 | 1>(0);
  const [joistQuantityMode, setJoistQuantityMode] = useState<"count" | "spacing">("count");
  const [joistCount, setJoistCount] = useState(3);
  const [joistSpacing, setJoistSpacing] = useState(1.2);
  const [joistBayError, setJoistBayError] = useState("");
  const [model, setModel] = useState<StructuralModel>(() => createSimpleFrame(DEFAULT_FRAME));
  const [sapHandoff, setSapHandoff] = useState<SapHandoff | null>(null);
  const gridToolModel = useMemo(() => sapHandoff ? projectSapGridsForGridTool(model,sapHandoff) : model,[model,sapHandoff]);
  const [sapSummaryVisible, setSapSummaryVisible] = useState(true);
  const [sapImportError, setSapImportError] = useState("");
  const [sapImportBusy, setSapImportBusy] = useState(false);
  const [sapImportStatus, setSapImportStatus] = useState("Choose a .s2k or .$2k file using the file picker.");
  const [sapSelectedMember, setSapSelectedMember] = useState<string | null>(null);
  const sapImportFileRef = useRef<HTMLInputElement>(null);
  async function importSap2000(file: File): Promise<void> {
    setSapImportError("");
    setSapImportBusy(true);
    setSapImportStatus(`Uploading ${file.name} (${(file.size/1024).toFixed(0)} KB) to SAP2000 importer…`);
    try {
      if (!/\.(s2k|\$2k)$/i.test(file.name)) throw new Error("Select an SAP2000 .s2k or .$2k file.");
      const body=new FormData();
      body.append("file",file,file.name);
      body.append("project_id",model.project.id);
      const response=await fetch("/api/import/sap2000",{method:"POST",body});
      const raw=await response.json();
      if (!response.ok) throw new Error(typeof raw.error==="string"?raw.error:raw.detail||"SAP2000 import failed");
      const handoff=readSapHandoff(raw);
      setSapHandoff(handoff);
      setSapSummaryVisible(true);
      setSapImportStatus(`Imported ${handoff.geometryPreview.nodes.length} nodes and ${handoff.geometryPreview.members.length} frames from ${file.name}.`);
      setSapSelectedMember(null);
      setMode("advanced");
    } catch(error) {
      setSapImportError(error instanceof Error?error.message:"SAP2000 import failed");
      setSapImportStatus(`Import failed for ${file.name}.`);
    } finally {setSapImportBusy(false);}
  }
  const historyRef = useRef<{ past: StructuralModel[]; future: StructuralModel[] }>({ past: [], future: [] });
  const joistDesignationRef = useRef(joistDesignation);
  joistDesignationRef.current = joistDesignation;
  const modelRef = useRef(model);
  modelRef.current = model;
  const [historyVersion, setHistoryVersion] = useState(0);
  const applyModel = (next: StructuralModel) => {
    const current = modelRef.current;
    if (next === current) return;
    const history = historyRef.current;
    history.past.push(current);
    if (history.past.length > 100) history.past.shift();
    history.future = [];
    modelRef.current = next;
    setModel(next);
    setHistoryVersion(version => version + 1);
  };
  const undo = () => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(modelRef.current);
    modelRef.current = previous;
    setModel(previous);
    setHistoryVersion(version => version + 1);
  };
  const redo = () => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(modelRef.current);
    modelRef.current = next;
    setModel(next);
    setHistoryVersion(version => version + 1);
  };
  void historyVersion;
  function switchMode(next: WorkspaceMode) {
    window.dispatchEvent(new Event("linkoteq:modeling-cancel"));
    window.dispatchEvent(new Event("linkoteq:view-select"));
    setMobilePanel(null);
    setMode(next);
  }
  function advancedChange(next: StructuralModel) {
    if (sapHandoff) { setSapImportError("SAP_SOURCE_READ_ONLY: close imported source before editing the Core model."); return; }
    const metadata = { ...next.project.metadata };
    delete metadata.simpleFrame;
    applyModel({ ...next, project: { ...next.project, metadata } });
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  const pointState = usePointToolState();
  const interaction = useInteractionState();
  const selections = usePublishedSelections();
  const activeModelTool = pointState.tool ? `${pointState.tool[0].toUpperCase()}${pointState.tool.slice(1)}` as ModelingTool : null;
  const [activeUtilityTool, setActiveUtilityTool] = useState<UtilityTool>("Select");

  useEffect(() => {
    const active = (event: Event) => setActiveUtilityTool((event as CustomEvent<UtilityTool>).detail);
    const select = () => setActiveUtilityTool("Select");
    window.addEventListener("linkoteq:utility-active", active);
    window.addEventListener("linkoteq:view-select", select);
    return () => { window.removeEventListener("linkoteq:utility-active", active); window.removeEventListener("linkoteq:view-select", select); };
  }, []);
  useEffect(() => {
    const close = () => setMobilePanel(null);
    window.addEventListener("linkoteq:properties-open", close);
    window.addEventListener("linkoteq:grid-panel-open", close);
    window.addEventListener("linkoteq:levels-panel-open", close);
    return () => {
      window.removeEventListener("linkoteq:properties-open", close);
      window.removeEventListener("linkoteq:grid-panel-open", close);
      window.removeEventListener("linkoteq:levels-panel-open", close);
    };
  }, []);
  function toggleMobilePanel(panel: "tools" | "setup" | "display" | "project") {
    window.dispatchEvent(new Event("linkoteq:mobile-panel-open"));
    setMobilePanel(current => current === panel ? null : panel);
  }
  function finishSurface(): void { window.dispatchEvent(new Event(SURFACE_FINISH_EVENT)); }
  function runModelTool(tool: ModelingTool): void {
    if (sapHandoff) { setSapImportError("Imported SAP source is read-only until Core mapping is validated."); return; }
    if (tool === "Joist") { setJoistSetupOpen(true); setJoistBay(null); return; }
    setJoistSetupOpen(false);
    window.dispatchEvent(new CustomEvent(MODELING_COMMAND_EVENT, { detail: tool.toLowerCase() }));
  }
  useEffect(() => {
    const pick = (event: Event) => {
      const point = (event as CustomEvent<Vec3>).detail;
      try {
        const bay = detectJoistBay(modelRef.current, point, point.z);
        setJoistBay(bay);
        setJoistBayError("");
      } catch (error) {
        setJoistBay(null);
        setJoistBayError(error instanceof Error ? error.message : "Unable to identify a closed beam bay.");
      }
    };
    const rayPick = (event: Event) => {
      const candidates = (event as CustomEvent<Vec3[]>).detail ?? [];
      for (const point of candidates) {
        try {const bay=detectJoistBay(modelRef.current,point,point.z);setJoistBay(bay);setJoistBayError("");return;} catch {}
      }
      setJoistBay(null);
      setJoistBayError("No closed four-beam bay at the selected plan location.");
    };
    const pointPick = (event: Event) => {
      if (window.sessionStorage.getItem("linkoteq:joist-bay-mode") !== "two-point") return;
      const snap = (event as CustomEvent<{point:Vec3}>).detail;
      const point = snap?.point;
      if (!point) {setJoistBayError("Select a valid joist endpoint.");return;}
      if (!joistFirstPointRef.current) {
        joistFirstPointRef.current = point;
        setJoistFirstPoint(point);
        setJoistBayError("First point selected. Pick the second point.");
      } else {
        const start = joistFirstPointRef.current;
        if (Math.hypot(point.x-start.x,point.y-start.y,point.z-start.z)<1e-6) {setJoistBayError("Second point must differ from the first.");return;}
        setJoistDrafts(previous => [...previous,{id:`draft-${previous.length+1}`,designation:joistDesignationRef.current,start,end:point}]);
        joistFirstPointRef.current=null;
        setJoistFirstPoint(null);
        setJoistBayError("Joist geometry staged. Pick the first point for another joist.");
      }
    };
    window.addEventListener(MEMBER_DRAW_PICK_EVENT,pointPick);
    window.addEventListener("linkoteq:joist-bay-ray-pick", rayPick);
    window.addEventListener("linkoteq:joist-bay-pick", pick);
    return () => {window.removeEventListener(MEMBER_DRAW_PICK_EVENT,pointPick);window.removeEventListener("linkoteq:joist-bay-ray-pick", rayPick);window.removeEventListener("linkoteq:joist-bay-pick", pick);};
  }, []);
  function confirmJoistBay() {
    if (!joistBay || !joistDesignation.trim()) return;
    try {
      const segments = layoutJoists(joistBay, {direction:joistDirection, ...(joistQuantityMode === "count" ? {count:joistCount} : {spacing:joistSpacing})});
      setJoistDrafts(previous => [...previous, ...segments.map((segment,index) => ({id:`draft-${previous.length + index + 1}`,designation:joistDesignation.trim(),start:segment.start,end:segment.end}))]);
      setJoistBay(null);
      setJoistBayError("Geometry-only joists staged locally; Core persistence pending.");
      window.sessionStorage.removeItem("linkoteq:joist-bay-mode");
      window.dispatchEvent(new Event("linkoteq:modeling-cancel"));
    } catch(error) {setJoistBayError(error instanceof Error ? error.message : "Joist placement failed.");}
  }
  function startJoistAssignment(method: "area" | "two-point"): void {
    setJoistAssignment(method);
    joistFirstPointRef.current = null;
    setJoistFirstPoint(null);
    setJoistBay(null);
    setJoistBayError(method === "area" ? "Click inside a closed four-beam bay." : "Pick the first point.");
    window.sessionStorage.setItem("linkoteq:joist-bay-mode", method === "area" ? "active" : "two-point");
    window.dispatchEvent(new CustomEvent(MODELING_COMMAND_EVENT,{detail:"joist"}));
    window.dispatchEvent(new CustomEvent("linkoteq:joist-configure-and-draw",{detail:{series:joistSeries,designation:joistDesignation.trim()}}));
    setJoistSetupOpen(false);
  }
  function runUtilityTool(tool: UtilityTool): void {
    if (sapHandoff && !["Select","View"].includes(tool)) { setSapImportError("Imported SAP source is read-only."); return; }
    window.dispatchEvent(new CustomEvent(UTILITY_COMMAND_EVENT, { detail: tool }));
    setActiveUtilityTool(tool);
  }

  return (
    <div className={`architectEditorShell mobile-panel-${mobilePanel ?? "closed"} mode-${mode} ${activeModelTool || interaction.mode !== "select" ? "has-active-point-tool" : ""}`}>
      <header className="architectTopbar">
        <div className="architectBrand">
          <span className="architectBrandMark" aria-hidden="true">
            L
          </span>
          <div>
            <strong>Structural Concept Modeler</strong>
            <span>Core 0.6 · That Open</span>
          </div>
        </div>
        <div className="architectHistoryActions" aria-label="Edit history" style={{
          display:"flex", alignItems:"center", gap:4, flexShrink:0, position:"relative", zIndex:20
        }}>
          <button type="button" title="Undo (Ctrl/Cmd+Z)" aria-label="Undo"
            disabled={!historyRef.current.past.length} onClick={undo}
            style={{minWidth:36, minHeight:40, padding:"4px 7px", flexShrink:0}}>↶</button>
          <button type="button" title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo"
            disabled={!historyRef.current.future.length} onClick={redo}
            style={{minWidth:36, minHeight:40, padding:"4px 7px", flexShrink:0}}>↷</button>
        </div>
        <div className="architectModeSwitch" aria-label="Workspace mode" style={{display:"flex",flexShrink:0,alignItems:"center",gap:4,position:"relative",zIndex:30,visibility:"visible"}}>
          <button
            type="button"
            className={mode === "simple" ? "active" : ""}
            onClick={() => switchMode("simple")}
          >
            Simple Mode
          </button>
          <button
            type="button"
            className={mode === "advanced" ? "active" : ""}
            onClick={() => switchMode("advanced")}
          >
            Advanced Mode
          </button>
        </div>
        {mode === "advanced" ? <div className="architectTopActions" aria-label="Project actions">
          <button
            type="button"
            className="architectIconAction"
            title="New project"
            aria-label="New project"
            onClick={() => clickProjectAction("New")}
          >
            ＋
          </button>
          <button
            type="button"
            className="architectIconAction"
            title="Open project"
            aria-label="Open project"
            onClick={() => clickProjectAction("Open")}
          >
            ⌑
          </button>
          <button type="button" title="Import SAP2000 directly into Advanced Model" disabled={sapImportBusy} onClick={() => sapImportFileRef.current?.click()}>{sapImportBusy ? "Importing SAP2000…" : "Import SAP2000"}</button>
          <input ref={sapImportFileRef} aria-label="Choose SAP2000 file (.s2k or .$2k)" type="file" accept=".s2k,.$2k,application/octet-stream,text/plain" style={{maxWidth:190,fontSize:12}} onChange={event => { const file = event.target.files?.[0]; if (file) void importSap2000(file); event.target.value = ""; }} />
          <button
            type="button"
            className="architectIconAction architectSaveAction"
            title="Save project"
            aria-label="Save project"
            onClick={() => clickProjectAction("Save")}
          >
            ⇩
          </button>
        </div>
        : <span className="sfTopBadge">Automatic frame · SI / m</span>}
      </header>

      {mode === "advanced" ? <>
      {joistSetupOpen ? <section aria-label="Steel Joist setup" style={{position:"fixed",top:"18%",left:"50%",transform:"translateX(-50%)",zIndex:10000,width:"min(92vw,390px)",padding:16,borderRadius:12,background:"#fff",color:"#111",boxShadow:"0 8px 36px #0005",display:"grid",gap:10}}>
        <strong>Steel Joist — Setup</strong>
        <label>Series <select value={joistSeries} onChange={e=>{setJoistSeries(e.target.value as typeof joistSeries);setJoistDesignation("");setJoistSectionId("");}}><option value="K">K</option><option value="LH">LH</option><option value="DLH">DLH</option><option value="other">Other</option></select></label>
        <label>Source-verified SJI designation (reference only)<select value={joistSectionId ? "" : joistDesignation} onChange={e=>{setJoistDesignation(e.target.value);setJoistSectionId("");}} style={{width:"100%"}}><option value="">Select a published designation</option>{getJoistDesignationCandidates(joistSeries==="other"?"K":joistSeries).filter(d=>joistSeries!=="other").map(d=><option key={d.designation} value={d.designation}>{d.designation} — SJI table verified</option>)}</select></label>
        <small>Reference designations are confirmed in the published SJI table, but are not analytical Core sections. <a href={SJI_LOAD_TABLE_SOURCE} target="_blank" rel="noreferrer">Official SJI table (PDF)</a>.</small>
        <small>Capacity is unverified. The designation is preserved, not treated as a verified catalog capacity.</small>
        <small>Area: click inside a closed four-beam bay to choose count or spacing. Linear: pick the first and second endpoints.</small>
        <div style={{display:"grid",gap:10}}>
          <button type="button" disabled={!joistDesignation.trim()} style={{minHeight:48,padding:"10px 14px",fontWeight:700,borderRadius:8}} onClick={()=>startJoistAssignment("area")}>Draw Area Joist</button>
          <button type="button" disabled={!joistDesignation.trim()} style={{minHeight:48,padding:"10px 14px",fontWeight:700,borderRadius:8}} onClick={()=>startJoistAssignment("two-point")}>Draw Linear Joist</button>
          <button type="button" onClick={()=>{setJoistSetupOpen(false);window.sessionStorage.removeItem("linkoteq:joist-bay-mode");}}>Cancel</button>
        </div>
      </section> : null}
      {joistBay ? <section aria-label="Joist bay preview" style={{position:"fixed",top:"17%",left:"50%",transform:"translateX(-50%)",zIndex:10001,width:"min(92vw,430px)",padding:16,borderRadius:12,background:"#fff",color:"#111",boxShadow:"0 8px 36px #0005",display:"grid",gap:10}}>
        <strong>Joist Bay — Preview</strong>
        <small>Boundary beams: {joistBay.beamIds.join(", ")} · Level Z = {joistBay.levelZ}</small>
        <label>Span direction <select value={joistDirection} onChange={e=>setJoistDirection(Number(e.target.value) as 0|1)}><option value={0}>Between opposite beams 1 and 3</option><option value={1}>Between opposite beams 2 and 4</option></select></label>
        <label>Distribution <select value={joistQuantityMode} onChange={e=>setJoistQuantityMode(e.target.value as "count"|"spacing")}><option value="count">Number of joists</option><option value="spacing">Maximum spacing (m)</option></select></label>
        {joistQuantityMode==="count" ? <label>Count <input type="number" min={1} max={1000} value={joistCount} onChange={e=>setJoistCount(Number(e.target.value))}/></label> : <label>Spacing (m) <input type="number" min={0.01} step={0.1} value={joistSpacing} onChange={e=>setJoistSpacing(Number(e.target.value))}/></label>}
        <small>Calculated: {(()=>{try{return layoutJoists(joistBay,{direction:joistDirection,...(joistQuantityMode==="count"?{count:joistCount}:{spacing:joistSpacing})}).length+" joists"}catch{return "Invalid spacing or count"}})()}</small>
        <svg viewBox="0 0 320 210" role="img" aria-label="Joist bay plan preview" style={{width:"100%",maxHeight:210,background:"#f4f6f8",borderRadius:8}}>
          {(()=>{
            const pts=joistBay.corners;
            const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
            const minX=Math.min(...xs),minY=Math.min(...ys),dx=Math.max(...xs)-minX||1,dy=Math.max(...ys)-minY||1;
            const scale=Math.min(280/dx,170/dy);
            const xy=(p:Vec3)=>({x:20+(p.x-minX)*scale,y:190-(p.y-minY)*scale});
            let segments:ReturnType<typeof layoutJoists>=[];
            try{segments=layoutJoists(joistBay,{direction:joistDirection,...(joistQuantityMode==="count"?{count:joistCount}:{spacing:joistSpacing})});}catch{}
            return <>
              <polygon points={pts.map(p=>{const q=xy(p);return `${q.x},${q.y}`}).join(" ")} fill="#dce7f3" stroke="#334155" strokeWidth={5}/>
              {segments.map((s,i)=>{const a=xy(s.start),b=xy(s.end);return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0f766e" strokeWidth={3}/>})}
            </>;
          })()}
        </svg>
        <small>Each new joist has pinned rotational releases at both ends. No capacity verification is implied.</small>
        {joistBayError ? <p role="alert">{joistBayError}</p> : null}
        <div style={{display:"flex",gap:8}}><button type="button" onClick={()=>setJoistBay(null)}>Cancel</button><button type="button" onClick={confirmJoistBay}>Confirm Joists</button></div>
      </section> : null}
      {joistFirstPoint ? <p role="status">First point: ({joistFirstPoint.x.toFixed(2)}, {joistFirstPoint.y.toFixed(2)}, {joistFirstPoint.z.toFixed(2)}) — Pick second point</p> : null}
      {!joistBay && joistBayError ? <p role="status">{joistBayError}</p> : null}
      <nav className="architectToolstrip" aria-label="Add structural elements">
        {modelingTools.map((tool) => (
          <button
            key={tool}
            type="button"
            className={activeModelTool === tool ? "active" : ""}
            onClick={() => runModelTool(tool)}
          >
            <span className="architectToolIcon" aria-hidden="true">
              {tool.slice(0, 2)}
            </span>
            <span>{tool}</span>
          </button>
        ))}
        {activeModelTool === "Slab" || activeModelTool === "Wall" ? (
          <button type="button" onClick={finishSurface}>Finish {activeModelTool}</button>
        ) : null}
        {mode === "advanced" ? utilityTools.map(tool => <button key={tool} type="button" onClick={() => runUtilityTool(tool)}>{tool}</button>) : null}
        {selections.length ? <button type="button" onClick={() => window.dispatchEvent(new Event("linkoteq:properties-open"))}>Properties ({selections.length})</button> : null}
      </nav>

      <div className="architectContextbar">
        <span className="architectContextTitle">3D Workspace</span>
        <span className="architectContextHint">
          {activeModelTool
            ? activeModelTool === "Slab" || activeModelTool === "Wall"
              ? `Add: ${activeModelTool} · Pick boundary points in order, then Finish`
              : `Add: ${activeModelTool}`
            : activeUtilityTool === "View"
              ? "Orbit / pan / zoom"
              : interaction.message}
        </span>
        <div className="architectViewPills" aria-label="View status">
          <span>That Open</span>
          <span>Snap: ON</span>
        </div>
      </div>

      <div className="advancedMobileControls" aria-label="Mobile viewport tools">
        <button type="button" onClick={() => {runUtilityTool("Select"); window.dispatchEvent(new Event("linkoteq:view-select"));}}>Select</button>
        <button type="button" onClick={() => {runUtilityTool("View"); window.dispatchEvent(new Event("linkoteq:view-cycle"));}}>Orbit</button>
        <select aria-label="Mobile view" defaultValue="3d" onChange={event => window.dispatchEvent(new CustomEvent("linkoteq:view-preset", {detail:event.target.value}))}>
          <option value="3d">3D</option><option value="bottom">Bottom</option><option value="front">Front</option><option value="right">Right</option>
        </select>
        <button type="button" onClick={() => toggleMobilePanel("display")}>Display</button>
        <button type="button" onClick={() => window.dispatchEvent(new Event("linkoteq:view-fit"))}>Fit</button>
      </div>
      <div className="architectWorkspaceFrame">
        {mode === "advanced" ? (
          <aside className="architectQuickPanel" aria-label="Setup and quick tools">
            <button type="button" className="advancedSheetClose" aria-label="Collapse panel" onClick={() => setMobilePanel(null)}>⌄ Close</button>
            <div className="architectPanelHeading">
              <div>
                <span className="architectEyebrow">MODEL</span>
                <h2>Setup &amp; Tools</h2>
              </div>
              <span className="architectPanelBadge">Advanced</span>
            </div>
            <div className="architectQuickActions">
              <button type="button" onClick={openGrid}>
                <span className="architectQuickIcon" aria-hidden="true">
                  G
                </span>
                <span>
                  <strong>Grid</strong>
                  <small>Plan axes</small>
                </span>
              </button>
              <button type="button" onClick={openLevels}>
                <span className="architectQuickIcon" aria-hidden="true">
                  L
                </span>
                <span>
                  <strong>Levels</strong>
                  <small>Elevations</small>
                </span>
              </button>
              {utilityTools.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  className={activeUtilityTool === tool ? "active" : ""}
                  data-utility-command={tool}
                  onClick={() => runUtilityTool(tool)}
                >
                  <span className="architectQuickIcon" aria-hidden="true">
                    {tool === "Copy" ? "CP" : tool === "Move" ? "MV" : tool[0]}
                  </span>
                  <span>
                    <strong>{tool}</strong>
                    <small>{utilityDescription(tool)}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="advancedDisplayContent"><ViewportDisplayOptionsV05 /></div>
            <div className="advancedToolContent">{modelingTools.map(tool => <button type="button" key={tool} onClick={() => {runModelTool(tool); setMobilePanel(null);}}>{tool}</button>)}
            {utilityTools.map(tool => <button type="button" key={tool} onClick={() => {runUtilityTool(tool); setMobilePanel(null);}}>{tool}</button>)}
            {activeModelTool === "Slab" || activeModelTool === "Wall" ? <button type="button" onClick={finishSurface}>Finish {activeModelTool}</button> : null}
            <button type="button" disabled={!selections.length} onClick={() => window.dispatchEvent(new Event("linkoteq:properties-open"))}>Properties ({selections.length})</button></div>
            <div className="advancedProjectContent">{(["New", "Open", "Save"] as const).map(action => <button type="button" key={action} onClick={() => clickProjectAction(action)}>{action} project</button>)}</div>
          </aside>
        ) : null}

        <div className="architectViewportColumn">
          <p role="status" style={{fontSize:13,margin:"4px 0"}}>{sapImportStatus}</p>
          {sapImportError ? <p role="alert">{sapImportError}</p> : null}
          {sapHandoff && sapSummaryVisible ? <section aria-label="SAP2000 import summary" style={{padding:8,background:"#fff8e1",color:"#222"}}>
            <strong>SAP2000 source geometry — NOT Core validated / NOT analysis ready</strong>
            <span> · {sapHandoff.geometryPreview.nodes.length} nodes · {sapHandoff.geometryPreview.members.length} frames · Source units: {sapHandoff.geometryPreview.sourceUnits || "unspecified"}</span>
            <button type="button" onClick={()=>setSapSummaryVisible(false)}>Close summary</button>
            <details><summary>Grids, levels, engineering data, fidelity and diagnostics</summary>
              <p>Source-defined levels: {JSON.stringify(sapHandoff.geometryPreview.sourceLevels)}</p>
              <p>Inferred levels (not verified stories): {sapHandoff.geometryPreview.inferredLevels.length}</p>
              <pre style={{maxHeight:220,overflow:"auto",whiteSpace:"pre-wrap"}}>{JSON.stringify({grids:sapHandoff.geometryPreview.grids,engineeringData:sapHandoff.engineeringData,importFidelity:sapHandoff.importFidelity,diagnostics:sapHandoff.diagnostics},null,2)}</pre>
            </details>
            {sapSelectedMember ? <details open><summary>Selected SAP member: {sapSelectedMember}</summary><pre style={{maxHeight:180,overflow:"auto"}}>{JSON.stringify({member:sapHandoff.geometryPreview.members.find(m=>m.sourceId===sapSelectedMember),propertyAssignments:sapHandoff.geometryPreview.propertyAssignments},null,2)}</pre></details> : null}
          </section> : null}
          <div className="architectViewportStage">
            <div className="engineeringEditorStage">
              <StructuralEditorV05 model={gridToolModel} onModelChange={advancedChange} sapHandoff={sapHandoff} onSapMemberSelect={setSapSelectedMember} />
            </div>
          </div>
          <div className="architectStatusbar" role="status" aria-live="polite">
            <span>
              <strong>Utility:</strong> {interaction.operation ?? activeUtilityTool} · {selections.length} selected
            </span>
            <span className="architectStatusDivider" aria-hidden="true">
              |
            </span>
            <span>
              <strong>Add:</strong> {activeModelTool ?? "None"}
            </span>
            <span className="architectStatusDivider" aria-hidden="true">
              |
            </span>
            <span>
              <strong>Mode:</strong> {mode === "advanced" ? "Advanced" : "Simple"}
            </span>
          </div>
        </div>
      </div>
      <nav className="advancedMobileTabs" aria-label="Advanced mobile panels">
        {([ ["setup", "Plan & levels"], ["tools", "Members & tools"], ["project", "Project"] ] as const).map(([panel, label]) => <button type="button" key={panel} aria-expanded={mobilePanel === panel} onClick={() => toggleMobilePanel(panel)}>{label}</button>)}
      </nav>
      </> : sapHandoff ? <section role="status" style={{padding:24}}><h2>SAP2000 source preserved</h2><p>Simple Mode cannot safely represent this imported source yet. All imported geometry and engineering data remain in Advanced Mode.</p><button type="button" onClick={() => switchMode("advanced")}>Return to Advanced Mode</button></section> : <SimpleFrameModeler model={model} onChange={applyModel} onAdvanced={() => switchMode("advanced")} />}
    </div>
  );
}
