"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Load, LoadCase, LoadCombination, LoadSource, StructuralModel, Surface } from "@linkoteq/structural-core";

type Props = {
  model: StructuralModel;
  selectedSurface?: Surface;
  onModelChange: (next: StructuralModel, message?: string) => void;
};

type SnowWriteback = {
  runId: string;
  modelSchemaVersion: string;
  loadSources?: LoadSource[];
  loadCases?: LoadCase[];
  loads?: Load[];
  warnings?: string[];
  errors?: string[];
};

const card: React.CSSProperties = { border: "1px solid #e4e7ec", borderRadius: 8, padding: 8, background: "#fbfcfd", display: "grid", gap: 6 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 };
const input: React.CSSProperties = { width: "100%", border: "1px solid #d0d5dd", borderRadius: 6, padding: "6px 7px", background: "white", fontSize: 11 };
const button: React.CSSProperties = { border: "1px solid #cfd6df", background: "white", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer" };
const primary: React.CSSProperties = { ...button, background: "#17202a", color: "white", borderColor: "#17202a" };

function sourceStatus(model: StructuralModel, category: string) {
  const source = model.loadSources?.find(s => s.category === category);
  return source?.status || "not generated";
}

export default function LoadManager({ model, selectedSurface, onModelChange }: Props) {
  const [open, setOpen] = useState(false);
  const [dead, setDead] = useState("1.0");
  const [live, setLive] = useState("1.9");
  const [ss, setSs] = useState("2.4");
  const [sr, setSr] = useState("0.4");
  const [slope, setSlope] = useState("0");
  const [cw, setCw] = useState("1.0");
  const [cb, setCb] = useState("0.8");
  const [importance, setImportance] = useState("1.0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Select a slab to assign area loads.");

  const slab = selectedSurface?.type === "slab" ? selectedSurface : undefined;
  const loadsForSlab = useMemo(() => slab ? model.loads.filter(l => l.targetId === slab.id) : [], [model.loads, slab]);

  function withSource(next: StructuralModel, source: LoadSource) {
    const sources = [...(next.loadSources || []).filter(s => s.id !== source.id), source];
    return { ...next, schemaVersion: "0.2" as const, loadSources: sources };
  }

  function assignManual(category: "dead" | "live", valueText: string) {
    if (!slab) return setMessage("Select a slab first.");
    const magnitude = Number(valueText);
    if (!Number.isFinite(magnitude) || magnitude < 0) return setMessage("Load must be a non-negative number.");
    const sourceId = `SRC-${category.toUpperCase()}`;
    const caseId = category === "dead" ? "D" : "L";
    const source: LoadSource = { id: sourceId, category, name: `${category === "dead" ? "Dead" : "Live"} Load`, calculator: "manual", status: "manual", generatedAt: new Date().toISOString(), summary: { areaLoadKPa: magnitude } };
    const loadCase: LoadCase = { id: caseId, name: category === "dead" ? "Dead" : "Live", category, sourceId, analysisType: "static" };
    const load: Load = { id: `${caseId}-${slab.id}`, type: "area", targetId: slab.id, targetType: "surface", loadCaseId: caseId, direction: { x: 0, y: 0, z: -1 }, magnitude, unit: "kPa", provenance: { sourceId, note: "Manual area load assigned in Linkoteq Load Manager" } };
    let next: StructuralModel = { ...model, schemaVersion: "0.2", loadCases: [...model.loadCases.filter(c => c.id !== caseId), loadCase], loads: [...model.loads.filter(l => l.id !== load.id), load] };
    next = withSource(next, source);
    onModelChange(next, `${loadCase.name} load assigned to ${slab.id}.`);
    setMessage(`${loadCase.name}: ${magnitude.toFixed(2)} kPa → ${slab.id}`);
  }

  function setTransfer(method: "one-way" | "two-way" | "shell" | "manual") {
    if (!slab) return;
    const surfaces = model.surfaces.map(s => s.id === slab.id ? { ...s, loadTransfer: { ...(s.loadTransfer || {}), method } } : s);
    onModelChange({ ...model, schemaVersion: "0.2", surfaces }, `${slab.id} load transfer = ${method}.`);
  }

  async function runSnow() {
    if (!slab) return setMessage("Select a slab first.");
    setBusy(true); setMessage("Running NBCC 2020 Snow Calculator…");
    const runId = `snow-${Date.now()}`;
    const payload = {
      modelSchemaVersion: "0.2",
      projectId: model.project.id,
      runId,
      calculator: "snow",
      targetIds: [slab.id],
      inputs: {
        target_surface_id: slab.id,
        mode: "UNIFORM_ROOF",
        jurisdiction: model.project.jurisdiction || "Model code calculation; jurisdiction-specific amendments not verified",
        common: {
          ss: Number(ss), sr_climatic: Number(sr), roof_slope_alpha: Number(slope), roof_surface_type: "normal",
          is: Number(importance), cw: Number(cw), cb: Number(cb), adjacent_surface_drift_applicable: false
        },
        lower_roof_cases: [], distribution_points: 8
      }
    };
    try {
      const response = await fetch("/api/calculators/snow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || data?.detail || `Snow service returned ${response.status}`);
      const writeback = data as SnowWriteback;
      if (writeback.errors?.length) throw new Error(writeback.errors.join("; "));
      const ids = new Set((writeback.loadSources || []).map(s => s.id));
      const caseIds = new Set((writeback.loadCases || []).map(c => c.id));
      const loadIds = new Set((writeback.loads || []).map(l => l.id));
      const next: StructuralModel = {
        ...model, schemaVersion: "0.2",
        loadSources: [...(model.loadSources || []).filter(s => !ids.has(s.id)), ...(writeback.loadSources || [])],
        loadCases: [...model.loadCases.filter(c => !caseIds.has(c.id)), ...(writeback.loadCases || [])],
        loads: [...model.loads.filter(l => !loadIds.has(l.id)), ...(writeback.loads || [])]
      };
      onModelChange(next, `Snow load generated for ${slab.id}.`);
      setMessage(writeback.warnings?.length ? `Snow generated with warning: ${writeback.warnings.join("; ")}` : `Snow generated and assigned to ${slab.id}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Snow calculation failed.");
    } finally { setBusy(false); }
  }

  function addDraftCombinations() {
    const combos: LoadCombination[] = [
      { id: "ULS-USER-1", name: "ULS draft: 1.25D + 1.5L + 1.0S", limitState: "ULS", factors: { D: 1.25, L: 1.5, S: 1.0 }, codeRef: "Draft template — engineer must verify governing NBCC 2020 combination" },
      { id: "SLS-USER-1", name: "SLS draft: 1.0D + 1.0L + 1.0S", limitState: "SLS", factors: { D: 1.0, L: 1.0, S: 1.0 }, codeRef: "Draft template — engineer must verify governing NBCC 2020 combination" }
    ];
    onModelChange({ ...model, schemaVersion: "0.2", loadCombinations: [...model.loadCombinations.filter(c => !combos.some(x => x.id === c.id)), ...combos] }, "Draft load combinations added for review.");
  }

  const content = <div style={{ display: "grid", gap: 8 }}>
    <div style={card}>
      <strong style={{ fontSize: 12 }}>Load Manager · Core v0.2</strong>
      <div style={{ fontSize: 10, color: "#667085" }}>Target: {slab ? `${slab.id} · ${slab.levelId || "no level"}` : "select a slab"}</div>
      {slab && <label style={{ fontSize: 10 }}>Slab load transfer<select style={input} value={slab.loadTransfer?.method || "two-way"} onChange={e => setTransfer(e.target.value as "one-way" | "two-way" | "shell" | "manual")}><option value="one-way">One-way</option><option value="two-way">Two-way</option><option value="shell">Shell</option><option value="manual">Manual</option></select></label>}
    </div>

    <div style={card}><strong style={{ fontSize: 11 }}>Load Sources</strong>{(["dead","live","snow","wind","seismic"] as const).map(c => <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span>{c[0].toUpperCase()+c.slice(1)}</span><span style={{ color: sourceStatus(model,c)==="not generated" ? "#98a2b3" : "#027a48" }}>{sourceStatus(model,c)}</span></div>)}</div>

    <div style={card}><strong style={{ fontSize: 11 }}>Dead / Live area loads</strong><div style={row}><label style={{ fontSize: 9 }}>Dead kPa<input style={input} value={dead} onChange={e=>setDead(e.target.value)}/></label><label style={{ fontSize: 9 }}>Live kPa<input style={input} value={live} onChange={e=>setLive(e.target.value)}/></label></div><div style={row}><button style={button} onClick={()=>assignManual("dead",dead)}>Assign Dead</button><button style={button} onClick={()=>assignManual("live",live)}>Assign Live</button></div></div>

    <div style={card}><strong style={{ fontSize: 11 }}>Snow · NBCC 2020</strong><div style={row}><label style={{fontSize:9}}>Ss kPa<input style={input} value={ss} onChange={e=>setSs(e.target.value)}/></label><label style={{fontSize:9}}>Sr kPa<input style={input} value={sr} onChange={e=>setSr(e.target.value)}/></label></div><div style={row}><label style={{fontSize:9}}>Slope °<input style={input} value={slope} onChange={e=>setSlope(e.target.value)}/></label><label style={{fontSize:9}}>Is<input style={input} value={importance} onChange={e=>setImportance(e.target.value)}/></label></div><div style={row}><label style={{fontSize:9}}>Cw<input style={input} value={cw} onChange={e=>setCw(e.target.value)}/></label><label style={{fontSize:9}}>Cb<input style={input} value={cb} onChange={e=>setCb(e.target.value)}/></label></div><button style={primary} disabled={!slab||busy} onClick={runSnow}>{busy?"Calculating…":"Run Snow → selected slab"}</button></div>

    <div style={card}><strong style={{ fontSize: 11 }}>Load Cases</strong>{model.loadCases.length ? model.loadCases.map(c=><div key={c.id} style={{fontSize:10}}>{c.id} · {c.name} <span style={{color:"#667085"}}>({c.category})</span></div>) : <span style={{fontSize:10,color:"#98a2b3"}}>No load cases yet.</span>}</div>
    <div style={card}><strong style={{ fontSize: 11 }}>Combinations</strong>{model.loadCombinations.map(c=><div key={c.id} style={{fontSize:9}}>{c.name}</div>)}<button style={button} onClick={addDraftCombinations}>Add draft NBCC review set</button><small style={{fontSize:8,color:"#b54708"}}>Draft combinations are not certified code selection. Engineer review is required.</small></div>
    {slab && <div style={card}><strong style={{fontSize:11}}>Loads on {slab.id}</strong>{loadsForSlab.length?loadsForSlab.map(l=><div key={l.id} style={{fontSize:10}}>{l.loadCaseId}: {l.magnitude} {l.unit} · {l.type}</div>):<span style={{fontSize:10,color:"#98a2b3"}}>No loads assigned.</span>}</div>}
    <div style={{fontSize:9,color:"#667085",lineHeight:1.4}}>{message}</div>
  </div>;

  return <>
    <div className="loadManagerEmbedded">{content}</div>
    {typeof document !== "undefined" && createPortal(<>
      <button className="loadManagerLauncher" onClick={()=>setOpen(true)} aria-label="Open Load Manager">Loads</button>
      {open && <div className="loadManagerBackdrop" onPointerDown={()=>setOpen(false)}>
        <aside className="loadManagerDrawer" onPointerDown={e=>e.stopPropagation()}>
          <div className="loadManagerDrawerHeader"><div><strong>Load Manager</strong><span>{slab ? ` · ${slab.id}` : " · no slab selected"}</span></div><button onClick={()=>setOpen(false)} aria-label="Close Load Manager">×</button></div>
          <div className="loadManagerDrawerBody">{content}</div>
        </aside>
      </div>}
    </>, document.body)}
  </>;
}
