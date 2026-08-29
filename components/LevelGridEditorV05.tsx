"use client";

import { useMemo, useState } from "react";
import type { GridLine, StructuralModel } from "@linkoteq/structural-core";
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

function GridEditorRow({
  grid,
  model,
  onModelChange,
}: {
  grid: GridLine;
  model: StructuralModel;
  onModelChange: Props["onModelChange"];
}) {
  const [label, setLabel] = useState(grid.label);
  const [startX, setStartX] = useState(String(grid.start.x));
  const [startY, setStartY] = useState(String(grid.start.y));
  const [startZ, setStartZ] = useState(String(grid.start.z));
  const [endX, setEndX] = useState(String(grid.end.x));
  const [endY, setEndY] = useState(String(grid.end.y));
  const [endZ, setEndZ] = useState(String(grid.end.z));

  function updateGrid() {
    try {
      const nextLabel = label.trim();
      if (!nextLabel) throw new Error("GRID_LABEL_REQUIRED");

      const start = {
        x: parseFinite(startX, "GRID_START_MUST_BE_FINITE"),
        y: parseFinite(startY, "GRID_START_MUST_BE_FINITE"),
        z: parseFinite(startZ, "GRID_START_MUST_BE_FINITE"),
      };
      const end = {
        x: parseFinite(endX, "GRID_END_MUST_BE_FINITE"),
        y: parseFinite(endY, "GRID_END_MUST_BE_FINITE"),
        z: parseFinite(endZ, "GRID_END_MUST_BE_FINITE"),
      };

      if (start.x === end.x && start.y === end.y && start.z === end.z) {
        throw new Error("GRID_DISTINCT_POINTS_REQUIRED");
      }

      onModelChange(
        {
          ...model,
          grids: model.grids.map((item) =>
            item.id === grid.id ? { ...item, label: nextLabel, start, end } : item,
          ),
        },
        `Canonical Core v0.5 grid ${grid.id} updated.`,
      );
    } catch (error) {
      onModelChange(model, error instanceof Error ? error.message : "Grid update failed.");
    }
  }

  function removeGrid() {
    onModelChange(
      { ...model, grids: model.grids.filter((item) => item.id !== grid.id) },
      `Canonical Core v0.5 grid ${grid.id} removed.`,
    );
  }

  return (
    <div className="gridEditRow">
      <label>
        Label
        <input value={label} onChange={(event) => setLabel(event.target.value)} />
      </label>

      <div className="selectionText">Start</div>
      <div className="inlineFields">
        <label>X<input type="number" value={startX} onChange={(event) => setStartX(event.target.value)} /></label>
        <label>Y<input type="number" value={startY} onChange={(event) => setStartY(event.target.value)} /></label>
        <label>Z<input type="number" value={startZ} onChange={(event) => setStartZ(event.target.value)} /></label>
      </div>

      <div className="selectionText">End</div>
      <div className="inlineFields">
        <label>X<input type="number" value={endX} onChange={(event) => setEndX(event.target.value)} /></label>
        <label>Y<input type="number" value={endY} onChange={(event) => setEndY(event.target.value)} /></label>
        <label>Z<input type="number" value={endZ} onChange={(event) => setEndZ(event.target.value)} /></label>
      </div>

      <div className="toolGrid twoCol">
        <button type="button" onClick={updateGrid}>Update Grid</button>
        <button type="button" onClick={removeGrid}>Remove Grid</button>
      </div>
    </div>
  );
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

  const gridCount = useMemo(() => model.grids.length, [model.grids.length]);

  function addLevel() {
    try {
      const result = createLevel(model, {
        name: levelName,
        elevation: parseFinite(elevation, "LEVEL_ELEVATION_MUST_BE_FINITE"),
      });
      onModelChange(result.model, `Canonical Core v0.5 level ${result.level.id} created.`);
      setLevelName("");
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
      setGridLabel("");
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
      <button type="button" onClick={addLevel}>Create Level</button>

      <label>
        Grid label
        <input value={gridLabel} onChange={(event) => setGridLabel(event.target.value)} />
      </label>

      <div className="selectionText">Start global coordinates</div>
      <div className="inlineFields">
        <label>X<input type="number" value={startX} onChange={(event) => setStartX(event.target.value)} /></label>
        <label>Y<input type="number" value={startY} onChange={(event) => setStartY(event.target.value)} /></label>
        <label>Z<input type="number" value={startZ} onChange={(event) => setStartZ(event.target.value)} /></label>
      </div>

      <div className="selectionText">End global coordinates</div>
      <div className="inlineFields">
        <label>X<input type="number" value={endX} onChange={(event) => setEndX(event.target.value)} /></label>
        <label>Y<input type="number" value={endY} onChange={(event) => setEndY(event.target.value)} /></label>
        <label>Z<input type="number" value={endZ} onChange={(event) => setEndZ(event.target.value)} /></label>
      </div>

      <button type="button" onClick={addGrid}>Create Grid</button>

      {gridCount > 0 ? (
        <details className="gridEditorDetails">
          <summary>Edit Existing Grids ({gridCount})</summary>
          {model.grids.map((grid) => (
            <GridEditorRow
              key={grid.id}
              grid={grid}
              model={model}
              onModelChange={onModelChange}
            />
          ))}
        </details>
      ) : null}

      <p className="selectionText">
        Level elevations and grid endpoints remain canonical Core v0.5 global geometry.
      </p>
    </section>
  );
}
