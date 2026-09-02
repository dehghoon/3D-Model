"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { StructuralModel } from "@linkoteq/structural-core";

import GridOffsetEditorV05 from "./GridOffsetEditorV05";
import LevelEditorV07 from "./LevelEditorV07";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

type Panel = "grid" | "levels" | null;

export default function LevelGridEditorV05New({
  model,
  onModelChange,
}: Props) {
  const [panel, setPanel] = useState<Panel>(null);

  useEffect(() => {
    const openGrid = () => setPanel("grid");
    const openLevels = () => setPanel("levels");
    const closeGrid = () => setPanel((current) => (current === "grid" ? null : current));
    const closeLevels = () => setPanel((current) => (current === "levels" ? null : current));

    window.addEventListener("linkoteq:grid-panel-open", openGrid);
    window.addEventListener("linkoteq:levels-panel-open", openLevels);
    window.addEventListener("linkoteq:grid-panel-close", closeGrid);
    window.addEventListener("linkoteq:levels-panel-close", closeLevels);

    return () => {
      window.removeEventListener("linkoteq:grid-panel-open", openGrid);
      window.removeEventListener("linkoteq:levels-panel-open", openLevels);
      window.removeEventListener("linkoteq:grid-panel-close", closeGrid);
      window.removeEventListener("linkoteq:levels-panel-close", closeLevels);
    };
  }, []);

  if (!panel || typeof document === "undefined") return null;

  const isGrid = panel === "grid";

  return createPortal(
    <div className="lgModalBackdrop" onMouseDown={() => setPanel(null)}>
      <section
        className="panelBlock lgPanel lgPortalPanel"
        onMouseDown={(event) => event.stopPropagation()}
        aria-label={isGrid ? "Grid setup" : "Level setup"}
      >
        <header className="lgHeader">
          <div>
            <span>MODEL SETUP</span>
            <h3>{isGrid ? "Grid" : "Levels"}</h3>
            <p>
              {isGrid
                ? "Edit plan Grid labels and offsets from the global origin."
                : "Edit Level names and elevations independently."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPanel(null)}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="lgSummary lgSummarySingle">
          <div>
            <strong>{isGrid ? model.grids.length : model.levels.length}</strong>
            <span>{isGrid ? "Grid lines" : "Levels"}</span>
          </div>
          <div>
            <span>Core</span>
            <strong>0.5</strong>
          </div>
        </div>

        <div className="lgBody">
          {isGrid ? (
            <GridOffsetEditorV05
              model={model}
              onModelChange={onModelChange}
            />
          ) : (
            <LevelEditorV07
              model={model}
              onModelChange={onModelChange}
            />
          )}
        </div>

        <footer className="lgFooter">
          Global coordinates · Canonical Core 0.5 model
        </footer>
      </section>
    </div>,
    document.body,
  );
}
