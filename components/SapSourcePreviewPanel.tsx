"use client";

import { useMemo, useState } from "react";
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
  const drawing = useMemo(() => createSapPreviewDrawing(preview), [preview]);
  const bounds = useMemo(() => {
    const points = preview.nodes.map(n => n.positionSourceUnits);
    if (!points.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { minX, minY, maxX: Math.max(...xs), maxY: Math.max(...ys) };
  }, [preview]);
  const extentX = Math.max(bounds.maxX - bounds.minX, 1e-9);
  const extentY = Math.max(bounds.maxY - bounds.minY, 1e-9);
  const scale = Math.min(700 / extentX, 370 / extentY);
  const x = (value: number) => 30 + (value - bounds.minX) * scale;
  const y = (value: number) => 420 - (value - bounds.minY) * scale;
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
      <p style={{margin:"6px 0",fontSize:12}}>2D source-coordinate inspection only. Axes/units are not transformed. Unknown materials, sections, releases, loads and grid/level meanings are not certified or converted to Core.</p>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <label><input type="checkbox" checked={showFrames} onChange={e=>setShowFrames(e.target.checked)}/> Frames</label>
        <label><input type="checkbox" checked={showNodes} onChange={e=>setShowNodes(e.target.checked)}/> Joints</label>
        <button type="button" onClick={()=>setDetails(v=>!v)} aria-expanded={details}>Source details</button>
      </div>
      <svg role="img" aria-label="SAP2000 source plan preview (not a 3D Core model)" viewBox="0 0 780 460" style={{display:"block",width:"100%",maxHeight:360,background:"#f8fafc",border:"1px solid #ddd",marginTop:8}}>
        {showFrames ? drawing.segments.map(s=><line key={s.id} x1={x(s.start.x)} y1={y(s.start.y)} x2={x(s.end.x)} y2={y(s.end.y)} stroke="#0f766e" strokeWidth="1.3"><title>{s.id}: ({s.start.x}, {s.start.y}, {s.start.z}) to ({s.end.x}, {s.end.y}, {s.end.z})</title></line>) : null}
        {showNodes ? preview.nodes.map(n=><circle key={n.id} cx={x(n.positionSourceUnits.x)} cy={y(n.positionSourceUnits.y)} r="1.8" fill="#b45309"><title>{n.sourceId}: {JSON.stringify(n.positionSourceUnits)}</title></circle>) : null}
      </svg>
      {details ? <>
        <p>Source SHA256: <code>{preview.sourceHash}</code></p>
        <details><summary>Grid source audit</summary><pre style={{whiteSpace:"pre-wrap",maxHeight:200,overflow:"auto"}}>{JSON.stringify(preview.gridAudit,null,2)}</pre></details>
        <details><summary>Level source audit</summary><pre style={{whiteSpace:"pre-wrap",maxHeight:200,overflow:"auto"}}>{JSON.stringify(preview.levelAudit,null,2)}</pre></details>
        <details><summary>Importer diagnostics ({preview.diagnostics.length})</summary><pre style={{whiteSpace:"pre-wrap",maxHeight:160,overflow:"auto"}}>{preview.diagnostics.join("\n")}</pre></details>
      </> : null}
    </section>
  );
}
