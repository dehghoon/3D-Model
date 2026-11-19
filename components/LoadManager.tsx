"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  Load,
  LoadCase,
  LoadCombination,
  Member,
  Node,
  StructuralModel,
  Surface,
} from "@linkoteq/structural-core";
import { assertCanonicalLoad, mapSnowWriteback } from "../lib/core-loads-v05";
import { requestSnowThroughAccount } from "../lib/snow-account-request";
import { importStaticSeismic } from "../lib/seismic-static-import";
import { findAutomaticSnowRoof } from "../lib/snow-model-roof";
type LoadMode = "slab" | "wall" | "beam" | "node";
type MemberLoadKind = "distributed" | "point";
type Props = {
  model: StructuralModel;
  selectedSurfaces: Surface[];
  selectedMembers: Member[];
  selectedNodes: Node[];
  onModelChange: (next: StructuralModel, message?: string) => void;
  onBeginTargetSelection: (mode: LoadMode) => void;
  onEndTargetSelection: () => void;
};

type SnowWriteback = Parameters<typeof mapSnowWriteback>[0];
const snowErrors: Record<string, string> = {
  authentication_required: "Sign in to Linkoteq before running Snow.",
  tool_access_denied: "Snow requires employee access or an active Snow Load trial with an accepted disclaimer.",
  entitlement_unavailable: "Snow access could not be verified. Try again.",
  snow_not_configured: "Snow is temporarily unavailable on this deployment.",
  invalid_snow_request: "The selected surfaces or project could not be sent to Snow.",
  invalid_snow_inputs: "Snow rejected the roof or site data.",
  snow_location_unavailable: "Snow Load has no usable climate data for this location.",
};
const button: React.CSSProperties = {
  border: "1px solid #cfd6df",
  background: "white",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 11,
  cursor: "pointer",
};
const primary: React.CSSProperties = { ...button, background: "#17202a", color: "white" };

function nextId(prefix: string, ids: string[]) {
  let index = 1;
  while (ids.includes(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}
function categoryFromLabel(label: string): LoadCase["category"] {
  const value = label.toLowerCase();
  return (["dead", "live", "roof-live", "snow", "rain", "wind", "seismic", "temperature", "construction", "other"].includes(value)
    ? value
    : "other") as LoadCase["category"];
}
export default function LoadManager({
  model,
  selectedSurfaces,
  selectedMembers,
  selectedNodes,
  onModelChange,
  onBeginTargetSelection,
  onEndTargetSelection,
}: Props) {
  const [open, setOpen] = useState(false);
  const [seismicAxis, setSeismicAxis] = useState<"x" | "y">("x");
  const [seismicFile, setSeismicFile] = useState<File | null>(null);
  const [snowRunning, setSnowRunning] = useState(false);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [province, setProvince] = useState("");
  const [location, setLocation] = useState("");
  const [climateStatus, setClimateStatus] = useState("");
  const [climateRetry, setClimateRetry] = useState(0);
  const currentModel = useRef(model);
  currentModel.current = model;
  const [mode, setMode] = useState<LoadMode>("slab");
  const [magnitude, setMagnitude] = useState("1");
  const [memberLoadKind, setMemberLoadKind] = useState<MemberLoadKind>("distributed");
  const [pointDistance, setPointDistance] = useState("0");
  const [loadDirection, setLoadDirection] = useState<"FX" | "FY" | "FZ" | "MX" | "MY" | "MZ">("FZ");
  const [loadCaseId, setLoadCaseId] = useState("D");
  const [loadCategory, setLoadCategory] = useState("dead");
  const [status, setStatus] = useState("Canonical Core load tools.");
  const targetIds = useMemo(() => {
    if (mode === "slab") return selectedSurfaces.filter((s) => s.type === "slab").map((s) => s.id);
    if (mode === "wall") return selectedSurfaces.filter((s) => s.type === "wall").map((s) => s.id);
    if (mode === "beam") return selectedMembers.map((m) => m.id);
    return selectedNodes.map((n) => n.id);
  }, [mode, selectedMembers, selectedNodes, selectedSurfaces]);
  function ensureLoadCase(next: StructuralModel) {
    if (next.loadCases.some((item) => item.id === loadCaseId)) return next;
    const loadCase: LoadCase = {
      id: loadCaseId,
      name: loadCaseId,
      category: categoryFromLabel(loadCategory),
      analysisType: "static",
    };
    return { ...next, loadCases: [...next.loadCases, loadCase] };
  }
  function addManualLoad() {
    const value = magnitude.trim() === "" ? NaN : Number(magnitude);
    if (!Number.isFinite(value) || !targetIds.length || !loadCaseId.trim()) {
      setStatus("Select targets and enter a valid magnitude.");
      return;
    }
    if (mode === "wall") {
      setStatus("Wall load requires an explicit Core adapter; no load was added.");
      return;
    }
    const distance = pointDistance.trim() === "" ? NaN : Number(pointDistance);
    if (mode === "beam" && memberLoadKind === "point" && (!Number.isFinite(distance) || distance < 0)) {
      setStatus("Enter a non-negative distance from the member start in metres.");
      return;
    }
    if (mode === "beam" && memberLoadKind === "point") {
      const nodesById = new Map(model.nodes.map((node) => [node.id, node.position]));
      for (const member of selectedMembers) {
        const start = nodesById.get(member.startNodeId);
        const end = nodesById.get(member.endNodeId);
        if (!start || !end) {
          setStatus(`Member ${member.id} has missing end-node coordinates.`);
          return;
        }
        const length = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
        if (distance > length + 1e-9) {
          setStatus(`Point load distance exceeds member ${member.id} length (${length.toFixed(3)} m).`);
          return;
        }
      }
    }
    if (mode === "beam" && loadDirection.startsWith("M")) {
      setStatus("Member distributed loads require a force direction (FX/FY/FZ).");
      return;
    }
    let next = ensureLoadCase(model);
    const ids = next.loads.map((load) => load.id);
    const loads: Load[] = targetIds.map((targetId) => {
      const id = nextId("L", ids);
      ids.push(id);
      let load: Load;
      if (mode === "node") {
        load = {
          id,
          type: "nodal",
          nodeId: targetId,
          loadCaseId,
          coordinateSystem: "global",
          components: { [loadDirection]: { value, unit: loadDirection.startsWith("M") ? "kN*m" : "kN" } },
        };
      } else if (mode === "beam" && memberLoadKind === "point") {
        load = {
          id,
          type: "member-point",
          memberId: targetId,
          loadCaseId,
          coordinateSystem: "global",
          direction: loadDirection as "FX" | "FY" | "FZ",
          magnitude: { value, unit: "kN" },
          x: { value: distance, unit: "m" },
        };
      } else if (mode === "beam") {
        load = {
          id,
          type: "member-distributed",
          memberId: targetId,
          loadCaseId,
          coordinateSystem: "global",
          direction: loadDirection as "FX" | "FY" | "FZ",
          w1: { value, unit: "kN/m" },
          w2: { value, unit: "kN/m" },
        };
      } else if (mode === "slab") {
        load = {
          id,
          type: "surface-pressure",
          surfaceId: targetId,
          loadCaseId,
          pressure: { value, unit: "kPa" },
          convention: "surface-normal",
        };
      } else {
        throw new Error("WALL_LOAD_REQUIRES_EXPLICIT_ADAPTER_MAPPING");
      }
      assertCanonicalLoad(load);
      return load;
    });

    next = { ...next, loads: [...next.loads, ...loads] };
    onModelChange(next, `${loads.length} canonical Core load(s) added.`);
  }

  useEffect(() => {
    if (!open || mode !== "slab") return;
    const controller = new AbortController();
    const params = province ? "?" + new URLSearchParams({ province }) : "";
    setClimateStatus("Loading Snow Load locations…");
    fetch("/api/calculators/snow/climate" + params, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Climate catalog unavailable");
        const data = await response.json() as { provinces?: string[]; locations?: string[] };
        const entries = province ? data.locations : data.provinces;
        if (!Array.isArray(entries) || !entries.length) throw new Error("Climate catalog is empty");
        if (!controller.signal.aborted) {
          (province ? setLocations : setProvinces)(entries);
          setClimateStatus("");
        }
      }).catch(() => {
        if (!controller.signal.aborted) setClimateStatus("Snow Load locations could not be loaded.");
      });
    return () => controller.abort();
  }, [open, mode, province, climateRetry]);

  async function runSnow() {
    if (!province || !location) throw new Error("Choose the project province and location.");
    const roof = findAutomaticSnowRoof(model, selectedSurfaces.map(surface => surface.id));
    const surfaceIds = [roof.surfaceId];
    const identity = new TextEncoder().encode(JSON.stringify([model.project.id, roof.surfaceId]));
    const digest = await crypto.subtle.digest("SHA-256", identity);
    const runId = "snow-location-" + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const request = {
      modelSchemaVersion: model.schemaVersion,
      projectId: model.project.id,
      runId,
      calculator: "snow",
      calculatorVersion: "0.1.0",
      targetIds: surfaceIds,
      snowSite: { province, location, roof: roof.geometry },
    };

    const response = await requestSnowThroughAccount(request);
    if (!response.ok) {
      const error = (response.data as { error?: string } | null)?.error;
      throw new Error((error && snowErrors[error]) || "Snow could not reach the calculation service. Try again.");
    }
    const data = response.data as SnowWriteback;
    if (data?.runId !== runId || data.modelSchemaVersion !== model.schemaVersion) {
      throw new Error("The Snow response does not match this calculation. Run Snow again.");
    }
    if (currentModel.current !== model) throw new Error("The model changed during calculation. Run Snow again for the current model.");

    const mapped = mapSnowWriteback(data, surfaceIds);
    const incomingIds = new Set(mapped.loads.map((load) => load.id));
    const incomingSourceIds = new Set(mapped.loadSources.map((source) => source.id));
    const next: StructuralModel = {
      ...model,
      loadSources: [
        ...(model.loadSources ?? []).filter((source) => !incomingSourceIds.has(source.id)),
        ...mapped.loadSources,
      ],
      loadCases: [
        ...model.loadCases.filter((loadCase) => !(data.loadCases ?? []).some((candidate) => candidate.id === loadCase.id)),
        ...(data.loadCases ?? []),
      ],
      loads: [...model.loads.filter((load) => !incomingIds.has(load.id)), ...mapped.loads.map(load => ({ ...load, normalSense: roof.normalSense }))],
    };
    const message = `Snow load applied to roof ${roof.surfaceId} for ${location}, ${province}.`;
    onModelChange(next, message);
    setStatus(message);
  }
  async function applySeismic() {
    if (!seismicFile) return;
    try {
      const data: unknown = JSON.parse(await seismicFile.text());
      if (currentModel.current !== model) throw new Error("The model changed. Reopen Loads and try again.");
      onModelChange(importStaticSeismic(model, data, seismicAxis), "Static seismic diaphragm cases assigned.");
      setStatus(`Four static seismic cases assigned along ${seismicAxis.toUpperCase()}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Static seismic loads could not be imported.");
    }
  }
  function addCombination() {
    if (!model.loadCases.length) {
      setStatus("Add load cases first.");
      return;
    }
    const factors = Object.fromEntries(model.loadCases.map((loadCase) => [loadCase.id, 1]));
    const combination: LoadCombination = {
      id: nextId("COMBO", model.loadCombinations.map((item) => item.id)),
      name: "Custom combination",
      factors,
      limitState: "ULS",
    };
    onModelChange(
      { ...model, loadCombinations: [...model.loadCombinations, combination] },
      "Canonical load combination added.",
    );
  }

  const content = (
    <div style={{ display: "grid", gap: 8 }}>
      <div><b>Targets:</b> {targetIds.length ? targetIds.join(", ") : "none"}</div>
      <select value={mode} onChange={(event) => setMode(event.target.value as LoadMode)}>
        <option value="slab">Slab surface pressure</option>
        <option value="beam">Member distributed load</option>
        <option value="node">Nodal load</option>
        <option value="wall">Wall load (explicit adapter required)</option>
      </select>
      <button style={button} onClick={() => { onBeginTargetSelection(mode); setOpen(false); }}>Pick from model</button>
      <input value={loadCaseId} onChange={(event) => setLoadCaseId(event.target.value)} placeholder="Load case ID" />
      <select value={loadCategory} onChange={(event) => setLoadCategory(event.target.value)}>
        {["dead", "live", "roof-live", "snow", "rain", "wind", "seismic", "temperature", "construction", "other"].map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      {mode === "beam" && (
        <label>Member load type
          <select value={memberLoadKind} onChange={(event) => setMemberLoadKind(event.target.value as MemberLoadKind)}>
            <option value="distributed">Uniform distributed</option>
            <option value="point">Point load</option>
          </select>
        </label>
      )}
      {mode === "beam" && memberLoadKind === "point" && (
        <label>Distance from member start (m)
          <input type="number" min="0" step="any" value={pointDistance} onChange={(event) => setPointDistance(event.target.value)} />
        </label>
      )}
      {(mode === "node" || mode === "beam") && (
        <label>Global direction / component
          <select value={loadDirection} onChange={(event) => setLoadDirection(event.target.value as typeof loadDirection)}>
            {["FX", "FY", "FZ", ...(mode === "node" ? ["MX", "MY", "MZ"] : [])].map((direction) => (
              <option key={direction} value={direction}>{direction}</option>
            ))}
          </select>
        </label>
      )}
      <label>Signed magnitude ({mode === "node" ? (loadDirection.startsWith("M") ? "kN·m" : "kN") : mode === "beam" ? (memberLoadKind === "point" ? "kN" : "kN/m") : "kPa"})
        <input type="number" step="any" value={magnitude} onChange={(event) => setMagnitude(event.target.value)} placeholder="Signed magnitude" />
      </label>
      <button style={primary} onClick={addManualLoad}>Add canonical load</button>
      {mode === "slab" && <>
        <small>Uniform flat roof · NBC 2020 · Normal importance, ULS · Unreduced wind exposure</small>
        <label>Province or territory
          <select value={province} disabled={!provinces.length || snowRunning} onChange={event => {
            setProvince(event.target.value); setLocation(""); setLocations([]);
          }}>
            <option value="">Choose province or territory</option>
            {provinces.map(name => <option key={name}>{name}</option>)}
          </select>
        </label>
        <label>Project location
          <select value={location} disabled={!locations.length || snowRunning} onChange={event => setLocation(event.target.value)}>
            <option value="">Choose location</option>
            {locations.map(name => <option key={name}>{name}</option>)}
          </select>
        </label>
        {climateStatus && <small role="status">{climateStatus}</small>}
        {climateStatus.endsWith("could not be loaded.") && <button type="button" style={button} onClick={() => setClimateRetry(value => value + 1)}>Retry locations</button>}
        <button style={primary} disabled={snowRunning || !location} onClick={() => {
          setSnowRunning(true);
          setStatus("Running Snow…");
          void runSnow()
            .catch(error => setStatus(error instanceof Error ? error.message : "Snow request failed."))
            .finally(() => setSnowRunning(false));
        }}>{snowRunning ? "Running Snow…" : "Run Snow"}</button>
      </>}
      <details>
        <summary>Import static seismic loads</summary>
        <p>Choose a reviewed calculator export and the axis used for that run. Each storey needs one rigid diaphragm. This assigns forces and torsion to the model.</p>
        <label>Calculation direction
          <select value={seismicAxis} onChange={event => setSeismicAxis(event.target.value as "x" | "y")}>
            <option value="x">Global X</option><option value="y">Global Y</option>
          </select>
        </label>
        <label>Static seismic JSON
          <input type="file" accept=".json,application/json" onChange={event => setSeismicFile(event.target.files?.[0] ?? null)} />
        </label>
        <button type="button" style={primary} disabled={!seismicFile || snowRunning} onClick={() => void applySeismic()}>Apply seismic loads</button>
      </details>
      <button style={button} onClick={addCombination}>Add combination</button>
      <small role="status">{status}</small>
    </div>
  );
  if (typeof document === "undefined") return null;
  return (
    <>
      {createPortal(
        <>
          <button className="loadManagerLauncher" onClick={() => { onEndTargetSelection(); setOpen(true); }}>Loads</button>
          {open && (
            <div className="loadManagerBackdrop" onClick={() => setOpen(false)}>
              <aside className="loadManagerDrawer" aria-label="Core Loads" onClick={(event) => event.stopPropagation()}>
                <div className="loadManagerDrawerHeader">
                  <strong>Core Loads</strong>
                  <button type="button" aria-label="Close Loads" onClick={() => setOpen(false)}>×</button>
                </div>
                <div className="loadManagerDrawerBody">{content}</div>
              </aside>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
