"use client";

import { useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";

import { createGridLine } from "../lib/modeling/grid-service";

export type ContextualModelingTool =
  | "grid"
  | "column"
  | "beam"
  | "brace"
  | "slab"
  | "wall";

interface Props {
  tool: ContextualModelingTool;
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

function parseFinite(value: string, code: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

function GridHelper({
  model,
  onModelChange,
}: Omit<Props, "tool">) {
  const [label, setLabel] = useState("");
  const [startX, setStartX] = useState("0");
  const [startY, setStartY] = useState("0");
  const [startZ, setStartZ] = useState("0");
  const [endX, setEndX] = useState("10");
  const [endY, setEndY] = useState("0");
  const [endZ, setEndZ] = useState("0");

  function createGrid() {
    try {
      const result = createGridLine(model, {
        label,
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

      onModelChange(result.model, `Created grid ${result.grid.id}.`);
      setLabel("");
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Grid creation failed.",
      );
    }
  }

  return (
    <div className="contextualModelHelperCard">
      <div className="contextualModelHelperHeader">
        <div>
          <span>CONTEXT HELPER</span>
          <h2>Create Grid</h2>
        </div>
        <strong>{model.grids.length} grids</strong>
      </div>

      <label>
        Label
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="A"
        />
      </label>

      <div className="contextualModelHelperSection">
        <span>Start</span>
        <div className="contextualModelHelperCoords">
          <input type="number" value={startX} onChange={(event) => setStartX(event.target.value)} aria-label="Start X" />
          <input type="number" value={startY} onChange={(event) => setStartY(event.target.value)} aria-label="Start Y" />
          <input type="number" value={startZ} onChange={(event) => setStartZ(event.target.value)} aria-label="Start Z" />
        </div>
      </div>

      <div className="contextualModelHelperSection">
        <span>End</span>
        <div className="contextualModelHelperCoords">
          <input type="number" value={endX} onChange={(event) => setEndX(event.target.value)} aria-label="End X" />
          <input type="number" value={endY} onChange={(event) => setEndY(event.target.value)} aria-label="End Y" />
          <input type="number" value={endZ} onChange={(event) => setEndZ(event.target.value)} aria-label="End Z" />
        </div>
      </div>

      <button
        className="contexualModelHelperPrimary"
        type="button"
        onClick={createGrid}
      >
        Create Grid Line
      </button>
    </div>
  );
}

export default function ContextualModelHelper({
  tool,
  model,
  onModelChange,
}: Props) {
  if (tool === "grid") {
    return <GridHelper model={model} onModelChange={onModelChange} />;
  }

  const label = tool.charAt(0).toUpperCase() + tool.slice(1);

  return (
    <div className="contextualModelHelperCard contextualModelHelperComing">
      <span>CONTEXT HELPER</span>
      <h2>{label}</h2>
      <p>
        This helper will be connected when the corresponding modeling service
        is ready.
      </p>
    </div>
  );
}
