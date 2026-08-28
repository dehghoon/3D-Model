"use client";

import { useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import { createNodeFromGlobalCoordinates } from "../lib/editor-modeling-v05";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
  onNodeCreated?: (nodeId: string) => void;
}

function parseCoordinate(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("NODE_COORDINATES_MUST_BE_FINITE");
  return parsed;
}

export default function NodeCreatorV05({ model, onModelChange, onNodeCreated }: Props) {
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const [z, setZ] = useState("0");

  function createNode() {
    try {
      const result = createNodeFromGlobalCoordinates(model, {
        x: parseCoordinate(x),
        y: parseCoordinate(y),
        z: parseCoordinate(z),
      });
      onModelChange(result.model, `Canonical Core v0.5 node ${result.node.id} created.`);
      onNodeCreated?.(result.node.id);
    } catch (error) {
      onModelChange(model, error instanceof Error ? error.message : "Node creation failed.");
    }
  }

  return (
    <section className="panelBlock">
      <h3>Create Node</h3>
      <label>
        Global X
        <input type="number" step="any" value={x} onChange={(event) => setX(event.target.value)} />
      </label>
      <label>
        Global Y
        <input type="number" step="any" value={y} onChange={(event) => setY(event.target.value)} />
      </label>
      <label>
        Global Z
        <input type="number" step="any" value={z} onChange={(event) => setZ(event.target.value)} />
      </label>
      <button onClick={createNode}>Create Node</button>
      <p className="selectionText">Coordinates are stored in the Core global model coordinate system.</p>
    </section>
  );
}
