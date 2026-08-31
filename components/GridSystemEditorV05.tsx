"use client";

import { useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";

import { createOrthogonalGridSystem } from "../lib/modeling/grid-system-service";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

function numberValue(value: string, code: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

export default function GridSystemEditorV05({ model, onModelChange }: Props) {
  const [xCount, setXCount] = useState("6");
  const [xSpacing, setXSpacing] = useState("6");
  const [yCount, setYCount] = useState("5");
  const [ySpacing, setYSpacing] = useState("6");

  function createSystem() {
    try {
      const next = createOrthogonalGridSystem(model, {
        xCount: numberValue(xCount, "GRID_X_COUNT_MUST_BE_FINITE"),
        xSpacing: numberValue(xSpacing, "GRID_X_SPACING_MUST_BE_FINITE"),
        yCount: numberValue(yCount, "GRID_Y_COUNT_MUST_BE_FINITE"),
        ySpacing: numberValue(ySpacing, "GRID_Y_SPACING_MUST_BE_FINITE"),
      });

      onModelChange(
        next,
        `Created orthogonal Grid system: ${xCount} X-lines and ${yCount} Y-lines at Z=0.`,
      );
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Grid system creation failed.",
      );
    }
  }

  return (
    <section className="panelBlock lgPanel">
      <header className="lgHeader">
        <div>
          <span>MODEL SETUP</span>
          <h3>Grid System</h3>
          <p>Orthogonal X/Y grid lines are always created at Z=0.</p>
        </div>
        <button
          type="button"
          aria-label="Close Grid System"
          onClick={() =>
            document
              .querySelector(".architect-revealed-panel")
              ?.classList.remove("architect-revealed-panel")
          }
        >
          ×
        </button>
      </header>

      <div className="lgBody">
        <section className="lgCard">
          <div className="lgTitle">
            <span>X DIRECTION</span>
            <strong>Numbered grid lines</strong>
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
            <span>Y DIRECTION</span>
            <strong>Lettered grid lines</strong>
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

        <button type="button" className="lgPrimary" onClick={createSystem}>
          {model.grids.length ? "Replace Grid System" : "Create Grid System"}
        </button>

        <p className="selectionText">
          X-lines and Y-lines remain parallel within each direction, intersect at right angles,
          and are stored on global Z=0.
        </p>
      </div>
    </section>
  );
}
