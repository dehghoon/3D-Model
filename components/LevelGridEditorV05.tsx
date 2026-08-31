"use client";

import { useState } from "react";
import type { Level, StructuralModel } from "@linkoteq/structural-core";

import { createOrthogonalGridSystem } from "../lib/modeling/grid-system-service";
import {
  createLevel,
  deleteLevel,
  updateLevel,
} from "../lib/modeling/level-service";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

type Tab = "grid" | "levels";

function finite(value: string, code: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

function closePanel() {
  document
    .querySelector(".architect-revealed-panel")
    ?.classList.remove("architect-revealed-panel");
}

function LevelRow({
  level,
  model,
  onModelChange,
}: {
  level: Level;
  model: StructuralModel;
  onModelChange: Props["onModelChange"];
}) {
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
      onModelChange(
        model,
        error instanceof Error ? error.message : "Level update failed.",
      );
    }
  }

  function remove() {
    try {
      onModelChange(
        deleteLevel(model, level.id),
        `Level ${level.id} removed.`,
      );
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Level removal failed.",
      );
    }
  }

  return (
    <article className="lgItem">
      <div className="lgItemHead">
        <div>
          <strong>{level.name}</strong>
          <small>{level.id}</small>
        </div>
        <span>{level.elevation}</span>
      </div>

      <div className="lgTwo">
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>Elevation</span>
          <input
            type="number"
            value={elevation}
            onChange={(event) => setElevation(event.target.value)}
          />
        </label>
      </div>

      <div className="lgActions">
        <button type="button" onClick={save}>Update</button>
        <button type="button" className="danger" onClick={remove}>Delete</button>
      </div>
    </article>
  );
}

export default function LevelGridEditorV05({ model, onModelChange }: Props) {
  const [tab, setTab] = useState<Tab>("grid");

  const [xCount, setXCount] = useState("10");
  const [xSpacing, setXSpacing] = useState("6");
  const [yCount, setYCount] = useState("6");
  const [ySpacing, setYSpacing] = useState("6");

  const [levelName, setLevelName] = useState("");
  const [elevation, setElevation] = useState("0");

  function createGridSystem() {
    try {
      const next = createOrthogonalGridSystem(model, {
        xCount: finite(xCount, "GRID_X_COUNT_MUST_BE_FINITE"),
        xSpacing: finite(xSpacing, "GRID_X_SPACING_MUST_BE_FINITE"),
        yCount: finite(yCount, "GRID_Y_COUNT_MUST_BE_FINITE"),
        ySpacing: finite(ySpacing, "GRID_Y_SPACING_MUST_BE_FINITE"),
      });

      onModelChange(
        next,
        `Created orthogonal Grid system: ${xCount} numbered lines and ${yCount} lettered lines at Z=0.`,
      );
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Grid system creation failed.",
      );
    }
  }

  function addLevel() {
    try {
      const result = createLevel(model, {
        name: levelName,
        elevation: finite(elevation, "LEVEL_ELEVATION_MUST_BE_FINITE"),
      });
      onModelChange(result.model, `Level ${result.level.id} created.`);
      setLevelName("");
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Level creation failed.",
      );
    }
  }

  return (
    <section className="panelBlock lgPanel">
      <header className="lgHeader">
        <div>
          <span>MODEL SETUP</span>
          <h3>Grid & Levels</h3>
          <p>Orthogonal Grid at Z=0 and canonical model levels.</p>
        </div>
        <button
          type="button"
          aria-label="Close Grid and Levels"
          onClick={closePanel}
        >
          ×
        </button>
      </header>

      <div className="lgSummary">
        <div><strong>{model.grids.length}</strong><span>Grid lines</span></div>
        <div><strong>{model.levels.length}</strong><span>Levels</span></div>
        <div><span>Core</span><strong>0.5</strong></div>
      </div>

      <div className="lgTabs">
        <button
          type="button"
          className={tab === "grid" ? "active" : ""}
          onClick={() => setTab("grid")}
        >
          Grid
        </button>
        <button
          type="button"
          className={tab === "levels" ? "active" : ""}
          onClick={() => setTab("levels")}
        >
          Levels
        </button>
      </div>

      {tab === "grid" ? (
        <div className="lgBody">
          <section className="lgCard">
            <div className="lgTitle">
              <span>NUMBERED AXES</span>
              <strong>1, 2, 3, ...</strong>
            </div>
            <div className="lgTwo">
              <label>
                <span>Count</span>
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={xCount}
                  onChange={(event) => setXCount(event.target.value)}
                />
              </label>
              <label>
                <span>Spacing</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={xSpacing}
                  onChange={(event) => setXSpacing(event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="lgCard">
            <div className="lgTitle">
              <span>LETTERED AXES</span>
              <strong>A, B, C, ...</strong>
            </div>
            <div className="lgTwo">
              <label>
                <span>Count</span>
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={yCount}
                  onChange={(event) => setYCount(event.target.value)}
                />
              </label>
              <label>
                <span>Spacing</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={ySpacing}
                  onChange={(event) => setYSpacing(event.target.value)}
                />
              </label>
            </div>
          </section>

          <button
            type="button"
            className="lgPrimary"
            onClick={createGridSystem}
          >
            {model.grids.length ? "Replace Grid System" : "Create Grid System"}
          </button>

          <p className="selectionText">
            Grid axes are parallel within each direction, intersect at 90°, and are stored at global Z=0.
          </p>
        </div>
      ) : (
        <div className="lgBody">
          <section className="lgCard">
            <div className="lgTitle">
              <span>NEW LEVEL</span>
              <strong>Create elevation reference</strong>
            </div>

            <div className="lgTwo">
              <label>
                <span>Name</span>
                <input
                  value={levelName}
                  onChange={(event) => setLevelName(event.target.value)}
                  placeholder="Ground"
                />
              </label>
              <label>
                <span>Elevation</span>
                <input
                  type="number"
                  value={elevation}
                  onChange={(event) => setElevation(event.target.value)}
                />
              </label>
            </div>

            <button type="button" className="lgPrimary" onClick={addLevel}>
              Create Level
            </button>
          </section>

          <section className="lgCard">
            <div className="lgTitle row">
              <div>
                <span>MODEL</span>
                <strong>Existing levels</strong>
              </div>
              <b>{model.levels.length}</b>
            </div>

            {model.levels.length ? (
              <div className="lgList">
                {model.levels.map((level) => (
                  <LevelRow
                    key={level.id}
                    level={level}
                    model={model}
                    onModelChange={onModelChange}
                  />
                ))}
              </div>
            ) : (
              <div className="lgEmpty">No levels yet.</div>
            )}
          </section>
        </div>
      )}

      <footer className="lgFooter">
        Global coordinates · Canonical Core 0.5 model
      </footer>
    </section>
  );
}
