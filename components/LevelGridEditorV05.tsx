"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Level, StructuralModel } from "@linkoteq/structural-core";

import {
  createOrthogonalGridSystem,
  inspectOrthogonalGridSystem,
  updateOrthogonalGridSystem,
} from "../lib/modeling/grid-system-service";
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

function finite(value: string, code: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
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
      onModelChange(deleteLevel(model, level.id), `Level ${level.id} removed.`);
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
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("grid");
  const [xCount, setXCount] = useState("10");
  const [xSpacing, setXSpacing] = useState("6");
  const [yCount, setYCount] = useState("6");
  const [ySpacing, setYSpacing] = useState("6");
  const [originX, setOriginX] = useState("0");
  const [originY, setOriginY] = useState("0");
  const [levelName, setLevelName] = useState("");
  const [elevation, setElevation] = useState("0");

  const snapshot = useMemo(
    () => inspectOrthogonalGridSystem(model),
    [model.grids],
  );

  useEffect(() => {
    const openPanel = () => {
      setTab("grid");
      setOpen(true);
    };
    const closePanel = () => setOpen(false);

    window.addEventListener("linkoteq:grid-panel-open", openPanel);
    window.addEventListener("linkoteq:grid-panel-close", closePanel);
    return () => {
      window.removeEventListener("linkoteq:grid-panel-open", openPanel);
      window.removeEventListener("linkoteq:grid-panel-close", closePanel);
    };
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    setXCount(String(snapshot.xCount));
    setXSpacing(String(snapshot.xSpacing));
    setYCount(String(snapshot.yCount));
    setYSpacing(String(snapshot.ySpacing));
    setOriginX(String(snapshot.originX));
    setOriginY(String(snapshot.originY));
  }, [
    snapshot?.xCount,
    snapshot?.xSpacing,
    snapshot?.yCount,
    snapshot?.ySpacing,
    snapshot?.originX,
    snapshot?.originY,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function saveGrid() {
    try {
      const input = {
        xCount: finite(xCount, "GRID_X_COUNT_MUST_BE_FINITE"),
        xSpacing: finite(xSpacing, "GRID_X_SPACING_MUST_BE_FINITE"),
        yCount: finite(yCount, "GRID_Y_COUNT_MUST_BE_FINITE"),
        ySpacing: finite(ySpacing, "GRID_Y_SPACING_MUST_BE_FINITE"),
        originX: finite(originX, "GRID_ORIGIN_MUST_BE_FINITE"),
        originY: finite(originY, "GRID_ORIGIN_MUST_BE_FINITE"),
      };

      const next = snapshot
        ? updateOrthogonalGridSystem(model, input)
        : createOrthogonalGridSystem(model, input);

      onModelChange(
        next,
        snapshot ? "Grid system updated." : "Grid system created.",
      );
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Grid system update failed.",
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

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="lgModalBackdrop" onMouseDown={() => setOpen(false)}>
      <section
        className="panelBlock lgPanel lgPortalPanel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="lgHeader">
          <div>
            <span>MODEL SETUP</span>
            <h3>Grid & Levels</h3>
            <p>Orthogonal Grid at Z=0 and canonical model levels.</p>
          </div>
          <button
            type="button"
            aria-label="Close Grid and Levels"
            onClick={() => setOpen(false)}
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
                <span>{snapshot ? "EDIT GRID SYSTEM" : "NEW GRID SYSTEM"}</span>
                <strong>Numbered axes · 1, 2, 3, ...</strong>
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

              <div className="lgTitle">
                <span>ORIGIN</span>
                <strong>Global plan origin</strong>
              </div>
              <div className="lgTwo">
                <label>
                  <span>X</span>
                  <input
                    type="number"
                    step="any"
                    value={originX}
                    onChange={(event) => setOriginX(event.target.value)}
                  />
                </label>
                <label>
                  <span>Y</span>
                  <input
                    type="number"
                    step="any"
                    value={originY}
                    onChange={(event) => setOriginY(event.target.value)}
                  />
                </label>
              </div>
            </section>

            <button type="button" className="lgPrimary" onClick={saveGrid}>
              {snapshot ? "Update Grid System" : "Create Grid System"}
            </button>
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
                <div><span>MODEL</span><strong>Existing levels</strong></div>
                <b>{model.levels.length}</b>
              </div>
              {model.levels.length ? (
                <div className="lgList">
                  {model.levels.map((level) => (
                    <LevelRow key={level.id} level={level} model={model} onModelChange={onModelChange} />
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
    </div>,
    document.body,
  );
}
