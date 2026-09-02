"use client";

import { useMemo, useState } from "react";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import { copySelection } from "../lib/editor/copy-command";
import { selectionExists } from "../lib/editor/selection";
import { usePublishedSelection } from "../lib/editor/selection-store";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

function sourceElevation(model: StructuralModel, selection: ReturnType<typeof usePublishedSelection>): number | null {
  if (!selection) return null;

  if (selection.type === "node") {
    return model.nodes.find((item) => item.id === selection.id)?.position.z ?? null;
  }

  if (selection.type === "member") {
    const member = model.members.find((item) => item.id === selection.id);
    if (!member) return null;
    if (member.levelId) {
      const level = model.levels.find((item) => item.id === member.levelId);
      if (level) return level.elevation;
    }
    return model.nodes.find((item) => item.id === member.startNodeId)?.position.z ?? null;
  }

  const surface = model.surfaces.find((item) => item.id === selection.id);
  if (!surface) return null;
  if (surface.levelId) {
    const level = model.levels.find((item) => item.id === surface.levelId);
    if (level) return level.elevation;
  }
  const firstNodeId = surface.boundaryNodeIds[0];
  return model.nodes.find((item) => item.id === firstNodeId)?.position.z ?? null;
}

export default function CopyToolV05({ model, onModelChange }: Props) {
  const selection = usePublishedSelection();
  const [dx, setDx] = useState("0");
  const [dy, setDy] = useState("0");
  const [dz, setDz] = useState("0");
  const [targetLevelId, setTargetLevelId] = useState("");

  const selectionLabel = selection ? `${selection.type}: ${selection.id}` : "None";
  const selectedExists = selectionExists(model, selection);
  const currentElevation = useMemo(
    () => sourceElevation(model, selection),
    [model, selection],
  );

  function applyCopy(delta: Vec3, statusLabel: string) {
    try {
      const result = copySelection(model, selection, delta);
      onModelChange(result.model, statusLabel);
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Copy failed.",
      );
    }
  }

  function copyByOffset() {
    applyCopy(
      { x: Number(dx), y: Number(dy), z: Number(dz) },
      `Copied ${selectionLabel} by offset.`,
    );
  }

  function copyToLevel() {
    const level = model.levels.find((item) => item.id === targetLevelId);
    if (!level || currentElevation === null) {
      onModelChange(model, "Select a valid target Level.");
      return;
    }

    applyCopy(
      { x: 0, y: 0, z: level.elevation - currentElevation },
      `Copied ${selectionLabel} to ${level.name}.`,
    );
  }

  return (
    <section className="panelBlock">
      <h3>Copy</h3>
      <p className="selectionText">Selected: {selectionLabel}</p>

      <div className="toolGrid threeCol">
        <label>
          X
          <input type="number" step="any" value={dx} onChange={(event) => setDx(event.target.value)} />
        </label>
        <label>
          Y
          <input type="number" step="any" value={dy} onChange={(event) => setDy(event.target.value)} />
        </label>
        <label>
          Z
          <input type="number" step="any" value={dz} onChange={(event) => setDz(event.target.value)} />
        </label>
      </div>

      <button
        type="button"
        className="primaryWide"
        disabled={!selectedExists || [dx, dy, dz].some((value) => !Number.isFinite(Number(value)))}
        onClick={copyByOffset}
      >
        Copy by Offset
      </button>

      <label>
        Copy to Level
        <select value={targetLevelId} onChange={(event) => setTargetLevelId(event.target.value)}>
          <option value="">Select Level</option>
          {model.levels
            .slice()
            .sort((a, b) => a.elevation - b.elevation)
            .map((level) => (
              <option key={level.id} value={level.id}>
                {level.name} ({level.elevation})
              </option>
            ))}
        </select>
      </label>

      <button
        type="button"
        disabled={!selectedExists || !targetLevelId || currentElevation === null}
        onClick={copyToLevel}
      >
        Copy to Level
      </button>

      <p className="selectionText">
        Geometry is copied with new stable IDs. Loads, supports, analysis results, and design results are not duplicated.
      </p>
    </section>
  );
}
