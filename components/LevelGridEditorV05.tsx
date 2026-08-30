"use client";

import { useState } from "react";
import type { GridLine, Level, StructuralModel } from "@linkoteq/structural-core";
import { createGridLine, deleteGridLine, updateGridLine } from "../lib/modeling/grid-service";
import { createLevel, deleteLevel, updateLevel } from "../lib/modeling/level-service";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

type Tab = "grid" | "levels";

function finite(value: string, code: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

function reportError(model: StructuralModel, onModelChange: Props["onModelChange"], error: unknown, fallback: string) {
  onModelChange(model, error instanceof Error ? error.message : fallback);
}

function closePanel() {
  document.querySelector(".architect-revealed-panel")?.classList.remove("architect-revealed-panel");
}

function CoordFields({
  title, x, y, z, setX, setY, setZ,
}: {
  title: string;
  x: string; y: string; z: string;
  setX: (value: string) => void;
  setY: (value: string) => void;
  setZ: (value: string) => void;
}) {
  return (
    <div className="lgCoords">
      <span>{title}</span>
      <div>
        {[
          ["X", x, setX],
          ["Y", y, setY],
          ["Z", z, setZ],
        ].map(([label, value, setter]) => (
          <label key={label as string}>
            <span>{label as string}</span>
            <input
              type="number"
              value={value as string}
              onChange={(event) => (setter as (value: string) => void)(event.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function LevelRow({ level, model, onModelChange }: { level: Level; model: StructuralModel; onModelChange: Props["onModelChange"] }) {
  const [name, setName] = useState(level.name);
  const [elevation, setElevation] = useState(String(level.elevation));

  function save() {
    try {
      const result = updateLevel(model, level.id, {
        name,
        elevation: finite(elevation, "LEVEL_ELEVATION_MUST_BE_FINITE"),
      });
      onModelChange(result.model, `Level ${result.level.id} updated.`);
    } catch (error) {
      reportError(model, onModelChange, error, "Level update failed.");
    }
  }

  function remove() {
    try {
      onModelChange(deleteLevel(model, level.id), `Level ${level.id} removed.`);
    } catch (error) {
      reportError(model, onModelChange, error, "Level removal failed.");
    }
  }

  return (
    <article className="lgItem">
      <div className="lgItemHead">
        <div><strong>{level.name}</strong><small>{level.id}</small></div>
        <span>{level.elevation}</span>
      </div>
      <div className="lgTwo">
        <label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label><span>Elevation</span><input type="number" value={elevation} onChange={(e) => setElevation(e.target.value)} /></label>
      </div>
      <div className="lgActions">
        <button type="button" onClick={save}>Update</button>
        <button type="button" className="danger" onClick={remove}>Delete</button>
      </div>
    </article>
  );
}

function GridRow({ grid, model, onModelChange }: { grid: GridLine; model: StructuralModel; onModelChange: Props["onModelChange"] }) {
  const [label, setLabel] = useState(grid.label);
  const [sx, setSx] = useState(String(grid.start.x));
  const [sy, setSy] = useState(String(grid.start.y));
  const [sz, setSz] = useState(String(grid.start.z));
  const [ex, setEx] = useState(String(grid.end.x));
  const [ey, setEy] = useState(String(grid.end.y));
  const [ez, setEz] = useState(String(grid.end.z));

  function save() {
    try {
      const result = updateGridLine(model, grid.id, {
        label,
        start: { x: finite(sx, "GRID_START_MUST_BE_FINITE"), y: finite(sy, "GRID_START_MUST_BE_FINITE"), z: finite(sz, "GRID_START_MUST_BE_FINITE") },
        end: { x: finite(ex, "GRID_END_MUST_BE_FINITE"), y: finite(ey, "GRID_END_MUST_BE_FINITE"), z: finite(ez, "GRID_END_MUST_BE_FINITE") },
      });
      onModelChange(result.model, `Grid ${result.grid.id} updated.`);
    } catch (error) {
      reportError(model, onModelChange, error, "Grid update failed.");
    }
  }

  function remove() {
    try {
      onModelChange(deleteGridLine(model, grid.id), `Grid ${grid.id} removed.`);
    } catch (error) {
      reportError(model, onModelChange, error, "Grid removal failed.");
    }
  }

  return (
    <article className="lgItem">
      <div className="lgItemHead"><div><strong>{grid.label}</strong><small>{grid.id}</small></div><span>Grid line</span></div>
      <label><span>Label</span><input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <CoordFields title="Start" x={sx} y={sy} z={sz} setX={setSx} setY={setSy} setZ={setSz} />
      <CoordFields title="End" x={ex} y={ey} z={ez} setX={setEx} setY={setEy} setZ={setEz} />
      <div className="lgActions">
        <button type="button" onClick={save}>Update</button>
        <button type="button" className="danger" onClick={remove}>Delete</button>
      </div>
    </article>
  );
}

export default function LevelGridEditorV05({ model, onModelChange }: Props) {
  const [tab, setTab] = useState<Tab>("grid");
  const [levelName, setLevelName] = useState("");
  const [elevation, setElevation] = useState("0");
  const [gridLabel, setGridLabel] = useState("");
  const [sx, setSx] = useState("0");
  const [sy, setSy] = useState("0");
  const [sz, setSz] = useState("0");
  const [ex, setEx] = useState("10");
  const [ey, setEy] = useState("0");
  const [ez, setEz] = useState("0");

  function addLevel() {
    try {
      const result = createLevel(model, { name: levelName, elevation: finite(elevation, "LEVEL_ELEVATION_MUST_BE_FINITE") });
      onModelChange(result.model, `Level ${result.level.id} created.`);
      setLevelName("");
    } catch (error) {
      reportError(model, onModelChange, error, "Level creation failed.");
    }
  }

  function addGrid() {
    try {
      const result = createGridLine(model, {
        label: gridLabel,
        start: { x: finite(sx, "GRID_START_MUST_BE_FINITE"), y: finite(sy, "GRID_START_MUST_BE_FINITE"), z: finite(sz, "GRID_START_MUST_BE_FINITE") },
        end: { x: finite(ex, "GRID_END_MUST_BE_FINITE"), y: finite(ey, "GRID_END_MUST_BE_FINITE"), z: finite(ez, "GRID_END_MUST_BE_FINITE") },
      });
      onModelChange(result.model, `Grid ${result.grid.id} created.`);
      setGridLabel("");
    } catch (error) {
      reportError(model, onModelChange, error, "Grid creation failed.");
    }
  }

  return (
    <section className="panelBlock lgPanel">
      <header className="lgHeader">
        <div>
          <span>MODEL SETUP</span>
          <h3>Grid & Levels</h3>
          <p>Define the reference system used to place model elements.</p>
        </div>
        <button type="button" onClick={closePanel} aria-label="Close Grid and Levels">×</button>
      </header>

      <div className="lgSummary">
        <div><strong>{model.grids.length}</strong><span>Grids</span></div>
        <div><strong>{model.levels.length}</strong><span>Levels</span></div>
        <div><span>Core</span><strong>0.5</strong></div>
      </div>

      <div className="lgTabs">
        <button type="button" className={tab === "grid" ? "active" : ""} onClick={() => setTab("grid")}>Grid</button>
        <button type="button" className={tab === "levels" ? "active" : ""} onClick={() => setTab("levels")}>Levels</button>
      </div>

      {tab === "grid" ? (
        <div className="lgBody">
          <section className="lgCard">
            <div className="lgTitle"><span>NEW GRID LINE</span><strong>Create reference line</strong></div>
            <label><span>Grid label</span><input value={gridLabel} onChange={(e) => setGridLabel(e.target.value)} placeholder="A" /></label>
            <CoordFields title="Start point" x={sx} y={sy} z={sz} setX={setSx} setY={setSy} setZ={setSz} />
            <CoordFields title="End point" x={ex} y={ey} z={ez} setX={setEx} setY={setEy} setZ={setEz} />
            <button type="button" className="lgPrimary" onClick={addGrid}>Create Grid</button>
          </section>
          <section className="lgCard">
            <div className="lgTitle row"><div><span>MODEL</span><strong>Existing grids</strong></div><b>{model.grids.length}</b></div>
            {model.grids.length ? <div className="lgList">{model.grids.map((grid) => <GridRow key={grid.id} grid={grid} model={model} onModelChange={onModelChange} />)}</div> : <div className="lgEmpty">No grid lines yet.</div>}
          </section>
        </div>
      ) : (
        <div className="lgBody">
          <section className="lgCard">
            <div className="lgTitle"><span>NEW LEVEL</span><strong>Create elevation reference</strong></div>
            <div className="lgTwo">
              <label><span>Level name</span><input value={levelName} onChange={(e) => setLevelName(e.target.value)} placeholder="Ground" /></label>
              <label><span>Elevation</span><input type="number" value={elevation} onChange={(e) => setElevation(e.target.value)} /></label>
            </div>
            <button type="button" className="lgPrimary" onClick={addLevel}>Create Level</button>
          </section>
          <section className="lgCard">
            <div className="lgTitle row"><div><span>MODEL</span><strong>Existing levels</strong></div><b>{model.levels.length}</b></div>
            {model.levels.length ? <div className="lgList">{model.levels.map((level) => <LevelRow key={level.id} level={level} model={model} onModelChange={onModelChange} />)}</div> : <div className="lgEmpty">No levels yet.</div>}
          </section>
        </div>
      )}

      <footer className="lgFooter">Global coordinates · Canonical Core 0.5 model</footer>
    </section>
  );
}
