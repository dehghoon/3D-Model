"use client";

import { useMemo, useState } from "react";
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

type LoadMode = "slab" | "wall" | "beam" | "node";
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
  const [mode, setMode] = useState<LoadMode>("slab");
  const [magnitude, setMagnitude] = useState("1");
  const [loadCaseId, setLoadCaseId] = useState("D");
  const [loadCategory, setLoadCategory] = useState("dead");
  const [status, setStatus] = useState("Core v0.5 canonical load tools.");

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
    const value = Number(magnitude);
    if (!Number.isFinite(value) || !targetIds.length) {
      setStatus("Select targets and enter a valid magnitude.");
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
          components: { FZ: { value: -value, unit: "kN" } },
        };
      } else if (mode === "beam") {
        load = {
          id,
          type: "member-distributed",
          memberId: targetId,
          loadCaseId,
          coordinateSystem: "global",
          direction: "FZ",
          w1: { value: -value, unit: "kN/m" },
          w2: { value: -value, unit: "kN/m" },
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

    next = { ...next, schemaVersion: "0.5", loads: [...next.loads, ...loads] };
    onModelChange(next, `${loads.length} canonical Core v0.5 load(s) added.`);
  }

  async function runSnow() {
    const surfaceIds = selectedSurfaces.filter((surface) => surface.type === "slab").map((surface) => surface.id);
    if (!surfaceIds.length) {
      setStatus("Select one or more slab surfaces first.");
      return;
    }

    const runId = "snow-" + window.performance.timeOrigin + "-" + Math.floor(performance.now() * 1000);
    const request = {
      modelSchemaVersion: "0.5",
      projectId: model.project.id,
      runId,
      calculator: "snow",
      calculatorVersion: "0.1.0",
      targetIds: surfaceIds,
      inputs: {
        calculation: {
          mode: "UNIFORM_ROOF",
          common: {
            ss: 2.5,
            sr_climatic: 0.4,
            roof_slope_alpha: 0,
            roof_surface_type: "normal",
            is: 1,
            cw: 1,
            cb: 0.8,
          },
        },
      },
    };

    const response = await fetch("/api/calculators/snow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const data = (await response.json()) as SnowWriteback;
    if (!response.ok) throw new Error("Snow Core v0.5 request failed.");

    const mapped = mapSnowWriteback(data, surfaceIds);
    const incomingIds = new Set(mapped.loads.map((load) => load.id));
    const incomingSourceIds = new Set(mapped.loadSources.map((source) => source.id));
    const next: StructuralModel = {
      ...model,
      schemaVersion: "0.5",
      loadSources: [
        ...(model.loadSources ?? []).filter((source) => !incomingSourceIds.has(source.id)),
        ...mapped.loadSources,
      ],
      loadCases: [
        ...model.loadCases.filter((loadCase) => !(data.loadCases ?? []).some((candidate) => candidate.id === loadCase.id)),
        ...(data.loadCases ?? []),
      ],
      loads: [...model.loads.filter((load) => !incomingIds.has(load.id)), ...mapped.loads],
    };
    onModelChange(next, `Snow v0.5 loads added for ${surfaceIds.length} target surface(s).`);
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
      { ...model, schemaVersion: "0.5", loadCombinations: [...model.loadCombinations, combination] },
      "Canonical load combination added.",
    );
  }

  const content = (
    <div style={{ display: "grid", gap: 8 }}>
      <b>Core v0.5 Loads</b>
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
        {["dead", "live", "roof-live", "snow", "rain", "wind", "seismic", "temperature", "construction", "other"].map((v) => <option key={v} value={v}>{v}</option>))}
      </select>
      <input value={magnitude} onChange={(event) => setMagnitude(event.target.value)} placeholder="Magnitude" />
      <button style={primary} onClick={addManualLoad}>Add canonical load</button>
      <button style={primary} onClick={() => runSnow().catch((error) => setStatus(error instanceof Error ? error.message : "Snow request failed."))}>
        Run Snow v0.5
      </button>
      <button style={button} onClick={addCombination}>Add combination</button>
      <small>{status}</small>
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
              <aside className="loadManagerDrawer" onClick={(event) => event.stopPropagation()}>
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
