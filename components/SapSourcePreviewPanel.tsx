"use client";

import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { SapSourcePreview } from "../lib/import/sap2000-source-preview";
import { createSapPreviewDrawing } from "../lib/import/sap2000-source-preview";

function countSourceRecords(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const audit = value as { sourceRecordCount?: unknown };
  return typeof audit.sourceRecordCount === "number" && Number.isFinite(audit.sourceRecordCount)
    ? audit.sourceRecordCount : null;
}

/** Read-only preview. Import Result is not a Core model or an analysis input. */
export default function SapSourcePreviewPanel({ preview, onClose }: {
  preview: SapSourcePreview;
  onClose: () => void;
}) {
  const [details, setDetails] = useState(false);
  const [showNodes, setShowNodes] = useState(true);
  const [showFrames, setShowFrames] = useState(true);
  const [viewMode, setViewMode] = useState<"iso" | "plan">("iso");
  const [yaw, setYaw] = useState(Math.PI / 4);
  const [pitch, setPitch] = useState(Math.atan(1 / Math.sqrt(2)));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0,y:0});
  const [dragMode, setDragMode] = useState<"rotate" | "pan">("rotate");
  const pointer = useRef<{id:number,x:number,y:number} | null>(null);
  const project3D = (p:{x:number;y:number;z:number}) => {
    const c=Math.cos(yaw), s=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
    const horizontal=p.x*c+p.y*s;
    return {x:-p.x*s+p.y*c,y:horizontal*sp-p.z*cp};
  };
  const onPointerDown = (e:PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || pointer.current) return;
    pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e:PointerEvent<SVGSVGElement>) => {
    const last=pointer.current;
    if (!last || last.id !== e.pointerId) return;
    const dx=e.clientX-last.x,dy=e.clientY-last.y;
    pointer.current={id:last.id,x:e.clientX,y:e.clientY};
    if (dragMode === "pan" || viewMode === "plan") {
      const rect=e.currentTarget.getBoundingClientRect();
      setPan(p=>({x:p.x+dx*780/rect.width,y:p.y+dy*460/rect.height}));
    } else {
      setYaw(a=>a+dx*0.012);
      setPitch(a=>Math.max(-Math.PI/2+0.02,Math.min(Math.PI/2-0.02,a+dy*0.012)));
    }
  };
  const endPointer = (e:PointerEvent<SVGSVGElement>) => {
    if (pointer.current?.id === e.pointerId) pointer.current=null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onWheel = (e:WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setZoom(v=>Math.max(0.1,Math.min(30,v*Math.exp(-e.deltaY*0.001))));
  };
  const resetView = () => {setYaw(Math.PI/4);setPitch(Math.atan(1/Math.sqrt(2)));setZoom(1);setPan({x:0,y:0});};
  const drawing = useMemo(() => createSapPreviewDrawing(preview), [preview]);
  const project = (p: {x:number;y:number;z:number}) => viewMode === "plan"
    ? { x:p.x, y:p.y }
    : project3D(p);
  const bounds = useMemo(() => {
    const points = preview.nodes.map(n => {
      const p=n.positionSourceUnits;
      return viewMode === "plan" ? {x:p.x,y:p.y} :
        project3D(p);
    });
    if (!points.length) return { minX:0,minY:0,maxX:1,maxY:1 };
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    return {minX:Math.min(...xs),minY:Math.min(...ys),maxX:Math.max(...xs),maxY:Math.max(...ys)};
  },[preview,viewMode,yaw,pitch]);
  const extentX = Math.max(bounds.maxX-bounds.minX,1e-9);
  const extentY = Math.max(bounds.maxY-bounds.minY,1e-9);
  const scale = Math.min(700/extentX,370/extentY);
  const x = (value:number) => 30+(value-bounds.minX)*scale;
  const y = (value:number) => 420-(value-bounds.minY)*scale;
  const gridCount = countSourceRecords(preview.gridAudit);
  const levelCount = countSourceRecords(preview.levelAudit);
  return (
    <section aria-label="SAP2000 source preview" style={{padding:12, border:"2px solid #eab308", borderRadius:8, background:"#fff", color:"#111", marginBottom:12}}>
      <div style={{display:"flex", gap:10, flexWrap:"wrap", justifyContent:"space-between", alignItems:"center"}}>
        <strong>SAP2000 source preview — NOT analysis ready</strong>
        <button type="button" onClick={onClose} aria-label="Close SAP source preview">Close preview</button>
      </div>
      <p style={{margin:"6px 0"}}>{preview.filename} · {preview.nodes.length} joints · {preview.frames.length} frames · Source units: {preview.unitsDeclaration ?? "unspecified"}</p>
      <p style={{margin:"6px 0"}}>Grids: {gridCount === null ? "not provided" : gridCount + " raw records"} · Levels: {levelCount === null ? "not provided" : levelCount + " raw records"} · Core mapping: unvalidated</p>
      <p style={{margin:"6px 0",fontSize:12}}>Read-only source-coordinate inspection (isometric projection or plan). Axes/units are not transformed. Unknown materials, sections, releases, loads and grid/level meanings are not certified or converted to Core.</p>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <label><input type="checkbox" checked={showFrames} onChange={e=>setShowFrames(e.target.checked)}/> Frames</label>
        <label><input type="checkbox" checked={showNodes} onChange={e=>setShowNodes(e.target.checked)}/> Joints</label>
        <label>View <select aria-label="Source preview projection" value={viewMode} onChange={e=>setViewMode(e.target.value as "iso"|"plan")}><option value="iso">3D isometric</option><option value="plan">XY plan</option></select></label>
        <label>Gesture <select aria-label="Preview gesture" value={dragMode} onChange={e=>setDragMode(e.target.value as "rotate"|"pan")}><option value="rotate">Rotate</option><option value="pan">Pan</option></select></label>
        <button type="button" aria-label="Zoom in preview" onClick={()=>setZoom(v=>Math.min(30,v*1.3))}>Zoom +</button>
        <button type="button" aria-label="Zoom out preview" onClick={()=>setZoom(v=>Math.max(0.1,v/1.3))}>Zoom −</button>
        <button type="button" onClick={resetView}>Reset view</button>
        <button type="button" onClick={()=>setDetails(v=>!v)} aria-expanded={details}>Source details</button>
      </div>
      <p style={{fontSize:12,margin:"5px 0"}}>Drag to {viewMode === "plan" ? "pan" : dragMode}; mouse wheel or Zoom buttons to zoom. On touch, use one finger to drag.</p>\n      <svg role="img" aria-label="Interactive SAP2000 source geometry preview (not a Core model)" viewBox="0 0 780 460" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPointer} onPointerCancel={endPointer} onLostPointerCapture={()=>{pointer.current=null;}} onWheel={onWheel} style={{display:"block",width:"100%",maxHeight:360,background:"#f8fafc",border:"1px solid #ddd",marginTop:8,touchAction:"none",cursor:dragMode==="pan"?"grab":"move"}}>\n        <g transform={`translate(${390+pan.x} ${230+pan.y}) scale(${zoom}) translate(-390 -230)`}>
        {showFrames ? drawing.segments.map(s=><line key={s.id} x1={x(project(s.start).x)} y1={y(project(s.start).y)} x2={x(project(s.end).x)} y2={y(project(s.end).y)} stroke="#0f766e" strokeWidth="1.3"><title>{s.id}: ({s.start.x}, {s.start.y}, {s.start.z}) to ({s.end.x}, {s.end.y}, {s.end.z})</title></line>) : null}
        {showNodes ? preview.nodes.map(n=><circle key={n.id} cx={x(project(n.positionSourceUnits).x)} cy={y(project(n.positionSourceUnits).y)} r="1.8" fill="#b45309"><title>{n.sourceId}: {JSON.stringify(n.positionSourceUnits)}</title></circle>) : null}
        </g>\n      </svg>
      {details ? <>
        <p>Source SHA256: <code>{preview.sourceHash}</code></p>
        <details><summary>Grid source audit</summary><pre style={{whiteSpace:"pre-wrap",maxHeight:200,overflow:"auto"}}>{JSON.stringify(preview.gridAudit,null,2)}</pre></details>
        <details><summary>Level source audit</summary><pre style={{whiteSpace:"pre-wrap",maxHeight:200,overflow:"auto"}}>{JSON.stringify(preview.levelAudit,null,2)}</pre></details>
        <details><summary>Importer diagnostics ({preview.diagnostics.length})</summary><pre style={{whiteSpace:"pre-wrap",maxHeight:160,overflow:"auto"}}>{preview.diagnostics.join("\n")}</pre></details>
      </> : null}
    </section>
  );
}
