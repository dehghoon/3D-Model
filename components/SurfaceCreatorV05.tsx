"use client";

import { useEffect, useState } from "react";
import type { StructuralModel, SurfaceType } from "@linkoteq/structural-core";
import { createSurfaceFromCanonicalRefs } from "../lib/editor-surface-v05";

interface Props {
  model: StructuralModel;
  selectedNodeId?: string;
  onModelChange: (model: StructuralModel, status: string) => void;
  onSurfaceCreated?: (surfaceId: string) => void;
}

const SURFACE_TYPES: SurfaceType[] = ["slab", "wall"];

export default function SurfaceCreatorV05({
  model,
  selectedNodeId,
  onModelChange,
  onSurfaceCreated,
}: Props) {
  const [type, setType] = useState<SurfaceType>("slab");
  const [boundaryNodeIds, setBoundaryNodeIds] = useState<string[]>([]);
  const [levelId, setLevelId] = useState("");
  const [pickFromViewport, setPickFromViewport] = useState(false);

  useEffect(() => {
    if (!levelId && model.levels[0]) {
      setLevelId(model.levels[0].id);
    }
  }, [levelId, model.levels]);

  useEffect(() => {
    if (!pickFromViewport || !selectedNodeId) return;
    if (!model.nodes.some((node) => node.id === selectedNodeId)) return;
    setBoundaryNodeIds((current) =>
      current.includes(selectedNodeId) ? current : [...current, selectedNodeId],
    );
  }, [pickFromViewport, selectedNodeId, model.nodes]);

  function addSelectedNode() {
    if (!selectedNodeId) return;
    if (!model.nodes.some((node) => node.id === selectedNodeId)) return;
    setBoundaryNodeIds((current) =>
      current.includes(selectedNodeId) ? current : [...current, selectedNodeId],
    );
  }

  function removeBoundaryNode(nodeId: string) {
    setBoundaryNodeIds((current) => current.filter((id) => id !== nodeId));
  }

  function clearBoundary() {
    setBoundaryNodeIds([]);
    setPickFromViewport(false);
  }

  function createSurface() {
    try {
      const result = createSurfaceFromCanonicalRefs(model, {
        type,
        boundaryNodeIds,
        ...(levelId ? { levelId } : {}),
      });
      onModelChange(result.model, `Canonical Core v0.5 surface ${result.surface.id} created.`);
      setBoundaryNodeIds([]);
      setPickFromViewport(false);
      onSurfaceCreated?.(result.surface.id);
    } catch (error) {
      onModelChange(model, error instanceof Error ? error.message : "Surface creation failed.");
    }
  }

  return (
    <section className="panelBlock">
      <h3>Create Surface</h3>
      <label>
        Type
        <select value={type} onChange={(event) => setType(event.target.value as SurfaceType)}>
          {SURFACE_TYPES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <label>
        Level
        <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
          <option value="">None</option>
          {model.levels.map((level) => (
            <option key={level.id} value={level.id}>{level.name} ({level.id})</option>
          ))}
        </select>
      </label>

      <div className="selectionText">
        Boundary nodes: {boundaryNodeIds.length ? boundaryNodeIds.join(" -> ") : "None"}
      </div>
      <div className="selectionText">
        {pickFromViewport
          ? "Viewport pick mode is on. Select nodes in boundary order."
          : "Viewport pick mode is off."}
      </div>

      <button onClick={() => setPickFromViewport((current) => !current)}>
        {pickFromViewport ? "Stop Viewport Pick" : "Pick Boundary From Viewport"}
      </button>
      <button onClick={addSelectedNode} disabled={!selectedNodeId}>
        Add Selected Node
      </button>
      <button onClick={clearBoundary} disabled={!boundaryNodeIds.length}>
        Clear Boundary
      </button>

      {boundaryNodeIds.map((nodeId) => (
        <button key={nodeId} onClick={() => removeBoundaryNode(nodeId)}>
          Remove {nodeId}
        </button>
      ))}

      <button onClick={createSurface} disabled={boundaryNodeIds.length < 3}>
        Create Surface
      </button>
      <p className="selectionText">
        Uses only existing canonical node references. Thickness, material and load-transfer behavior are not synthesized.
      </p>
    </section>
  );
}
