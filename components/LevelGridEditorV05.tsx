"use client";

import { useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import { createGridLine, createLevel } from "../lib/editor-modeling-v05";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

function parseFinite(value: string, code: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

export default function LevelGridEditorV05({ model, onModelChange }: Props) {
  const [levelName, setLevelName] = useState("");
  const [elevation, setElevation] = useState("0");
  const [gridLabel, setGridLabel] = useState("");
  const [startX, setStartX] = useState("0");
  const [startY, setStartY] = useState("0");
  const [startZ, setStartZ] = useState("0");
  const [endX, setEndX] = useState("10");
  const [endY, setEndY] = useState("0");
  const [endZ, setEndZ] = useState("0");

  function addLevel() {
    try {
      const result = createLevel(model, {
        name: levelName,
        elevation: parseFinite(elevation, "LEVEL_ELEVATION_MUST_BE_FINITE"),
      });
      onModelChange(result.model, `Canonical Core v0.5 level ${result.level.id} created.`);
    } catch (error) {
      onModelChange(model, error instanceof Error ? error.message : "Level creation failed.");
    }
  }

  function addGrid() {
    try {
      const result = createGridLine(model, {
        label: gridLabel,
        start: {
          x: parseFinite(startX, "GRID_START_MUST_BE_FINITE"),
          y: parseFinite(startY, "GRID_START_MUST_BE_FINITE"),
          z: parseFinite(startZ, "GRID_START_MUST_BE_FINITE"),
        },
        end: {
          x: parseFinite(endX, "GRID_END_MUST_BE_FINITE"),
          y: parseFinite(endY, "GRID_END_MUST_BE_FINITE"),
          z: parseFinite(endZ, "GRID_END_MUST_BE_FINITE"),
        },
      });
      onModelChange(result.model, `Canonical Core v0.5 grid ${result.grid.id} created.`);
    } catch (error) {
      onModelChange(model, error instanceof Error ? error.message : "Grid creation failed.");
    }
  }

  return (
    <section className="panelBlock">
      <h3>Levels / Grids</h3>
      <label>
        Level name
        <input value={levelName} onChange={(event) => setLevelName(event.target.value)} />
      </label>
      <label>
        Elevation
        <input type="number" value={elevation} onChange={(event) => setElevation(event.target.value)} />
      </label>
      <button onClick={addLevel}>Create Level</button>

      <label>
        Grid label
        <input value={gridLabel} onChange={(event) => setGridLabel(event.target.value)} />
      </label>
      <div className="selectionText">Start global coordinates</div>
      <label>X<input type="number" value={startX} onChange={(event) => setStartX(event.target.value)} /></label>
      <label>Y<input type="number" value={startY} onChange={(event) => setStartY(event.target.value)} /></label>
      <label>Z<input type="number" value={startZ} onChange={(event) => setStartZ(event.target.value)} /></label>
      <div className="selectionText">End global coordinates</div>
      <label>X<input type="number" value={endX} onChange={(event) => setEndX(event.target.value)} /></label>
      <label>Y<input type="number" value={endY} onChange={(event) => setEndY(event.target.value)} /></label>
      <label>Z<input type="number" value={endZ} onChange={(event) => setEndZ(event.target.value)} /></label>
      <button onClick={addGrid}>Create Grid</button>
      <p className="selectionText">Level elevations and grid endpoints are stored as canonical Core model geometry.</p>
    </section>
  );
}
