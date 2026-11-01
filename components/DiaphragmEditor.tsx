"use client";

import { useState } from "react";
import type { StructuralModel, Node, Surface, Diaphragm } from "@linkoteq/structural-core";
import { assignDiaphragm } from "../lib/diaphragms-v05";

export default function DiaphragmEditor({ model, selectedNodes, selectedSurfaces, onModelChange }: {
  model: StructuralModel;
  selectedNodes: Node[];
  selectedSurfaces: Surface[];
  onModelChange: (model: StructuralModel, message: string) => void;
}) {
  const [id, setId] = useState("D1");
  const [levelId, setLevelId] = useState("");
  const [type, setType] = useState<Diaphragm["type"]>("rigid");
  const [status, setStatus] = useState("");
  function apply() {
    try {
      const next = assignDiaphragm(model, {
        id, type, levelId,
        nodeIds: selectedNodes.map((node) => node.id),
        surfaceIds: selectedSurfaces.map((surface) => surface.id),
      });
      onModelChange(next, `Diaphragm ${id} assigned to selected targets.`);
      setStatus("Assignment saved in Core v0.5 model.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Diaphragm assignment failed.");
    }
  }
  return (
    <section className="panelBlock">
      <h3>Diaphragm Assignment (Core v0.5)</h3>
      <p>Selected: {selectedNodes.length} nodes, {selectedSurfaces.length} surfaces.</p>
      <label>ID <input value={id} onChange={(event) => setId(event.target.value)} /></label>
      <label>Level
        <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
          <option value="">Choose level</option>
          {model.levels.map((level) => <option key={level.id} value={level.id}>{level.name} ({level.id})</option>)}
        </select>
      </label>
      <label>Type
        <select value={type} onChange={(event) => setType(event.target.value as Diaphragm["type"])}>
          <option value="rigid">Rigid</option>
          <option value="semi-rigid">Semi-rigid</option>
        </select>
      </label>
      <button type="button" disabled={!model.levels.length || (!selectedNodes.length && !selectedSurfaces.length)} onClick={apply}>Assign diaphragm</button>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
