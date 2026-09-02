"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Level, StructuralModel } from "@linkoteq/structural-core";
import { createLevel, deleteLevel, updateLevel } from "../lib/modeling/level-service";
import { publishLevels } from "../lib/level-visual-store";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
  embedded?: boolean;
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

  useEffect(() => {
    setName(level.name);
    setElevation(String(level.elevation));
  }, [level.id, level.name, level.elevation]);

  const save = () => {
    try {
      const result = updateLevel(model, level.id, {
        name,
        elevation: Number(elevation),
      });
      onModelChange(result.model, `Level ${result.level.id} updated.`);
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Level update failed.",
      );
    }
  };

  const remove = () => {
    try {
      onModelChange(deleteLevel(model, level.id), `Level ${level.id} removed.`);
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Level removal failed.",
      );
    }
  };

  return (
    <div className="lgItem lgLevelRow">
      <div className="lgTwo">
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>Elevation</span>
          <input
            type="number"
            step="any"
            value={elevation}
            onChange={(event) => setElevation(event.target.value)}
          />
        </label>
      </div>
      <div className="lgActions">
        <button type="button" onClick={save}>
          Update
        </button>
        <button type="button" className="danger" onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}

function LevelEditorBody({
  model,
  onModelChange,
}: Pick<Props, "model" | "onModelChange">) {
  const [name, setName] = useState("Level 1");
  const [elevation, setElevation] = useState("0");

  const add = () => {
    try {
      const result = createLevel(model, {
        name,
        elevation: Number(elevation),
      });
      onModelChange(result.model, `Level ${result.level.id} created.`);
      setName(`Level ${result.model.levels.length + 1}`);
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Level creation failed.",
      );
    }
  };

  return (
    <>
      <section className="lgCard">
        <div className="lgTitle">
          <span>NEW LEVEL</span>
          <strong>Add elevation</strong>
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
              step="any"
              value={elevation}
              onChange={(event) => setElevation(event.target.value)}
            />
          </label>
        </div>
        <button type="button" className="lgPrimary" onClick={add}>
          Add Level
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
        <div className="lgList">
          {model.levels
            .slice()
            .sort((a, b) => a.elevation - b.elevation)
            .map((level) => (
              <LevelRow
                key={level.id}
                level={level}
                model={model}
                onModelChange={onModelChange}
              />
            ))}
        </div>
      </section>
    </>
  );
}

export default function LevelEditorV06({
  model,
  onModelChange,
  embedded = false,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    publishLevels(model.levels);
  }, [model.levels]);

  useEffect(() => {
    if (embedded) return;

    const show = () => setOpen(true);
    const hide = () => setOpen(false);
    window.addEventListener("linkoteq:levels-panel-open", show);
    window.addEventListener("linkoteq:levels-panel-close", hide);

    return () => {
      window.removeEventListener("linkoteq:levels-panel-open", show);
      window.removeEventListener("linkoteq:levels-panel-close", hide);
    };
  }, [embedded]);

  if (embedded) {
    return <LevelEditorBody model={model} onModelChange={onModelChange} />;
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
            <h3>Levels</h3>
            <p>Add, edit, and remove canonical elevation references.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close Levels"
          >
            ×
          </button>
        </header>
        <div className="lgBody">
          <LevelEditorBody model={model} onModelChange={onModelChange} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
