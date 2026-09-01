"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { StructuralModel } from "@linkoteq/structural-core";

import GridOffsetEditorV05 from "./GridOffsetEditorV05";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

export default function LevelGridEditorV05New({ model, onModelChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"grid" | "levels">("grid");

  useEffect(() => {
    const show = () => {
      setTab("grid");
      setOpen(true);
    };
    const hide = () => setOpen(false);

    window.addEventListener("linkoteq:grid-panel-open", show);
    window.addEventListener("linkoteq:grid-panel-close", hide);

    return () => {
      window.removeEventListener("linkoteq:grid-panel-open", show);
      window.removeEventListener("linkoteq:grid-panel-close", hide);
    };
  }, []);

  const gridEditor = (
    <GridOffsetEditorV05 model={model} onModelChange={onModelChange} />
  );

  if (!open || typeof document === "undefined") {
    return (
      <div hidden aria-hidden="true">
        {gridEditor}
      </div>
    );
  }

  return createPortal(
    <div className="lgModalBackdrop" onMouseDown={() => setOpen(false)}>
      <section
        className="panelBlock lgPanel lgPortalPanel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="lgHeader">
          <div>
            <span>MODEL SETUP</span>
            <h3>Grid &amp; Levels</h3>
            <p>
              Each Grid line uses an independent offset from global origin at Z=0.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="lgSummary">
          <div>
            <strong>{model.grids.length}</strong>
            <span>Grid lines</span>
          </div>
          <div>
            <strong>{model.levels.length}</strong>
            <span>Levels</span>
          </div>
          <div>
            <span>Core</span>
            <strong>0.5</strong>
          </div>
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
          <div className="lgBody">{gridEditor}</div>
        ) : (
          <div className="lgBody">
            <section className="lgCard">
              <div className="lgTitle">
                <span>MODEL</span>
                <strong>Existing levels</strong>
              </div>
              <div className="lgList">
                {model.levels.map((level) => (
                  <div className="lgItem" key={level.id}>
                    <strong>{level.name}</strong>
                    <span>{level.elevation}</span>
                  </div>
                ))}
              </div>
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
