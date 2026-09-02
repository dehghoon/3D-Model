"use client";

import { useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";

import { adjustModelToGridEdits } from "../lib/modeling/reference-adjustment-service";
import GridOffsetEditorV07 from "./GridOffsetEditorV07";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

export default function GridOffsetEditorV08({ model, onModelChange }: Props) {
  const [adjustConnected, setAdjustConnected] = useState(false);

  return (
    <div className="referenceEditPanel">
      <label className="referenceAdjustToggle">
        <input
          type="checkbox"
          checked={adjustConnected}
          onChange={(event) => setAdjustConnected(event.target.checked)}
        />
        <span>
          <strong>Adjust connected model</strong>
          <small>
            Move nodes and connected members/surfaces that lie on edited Grid lines.
          </small>
        </span>
      </label>

      <GridOffsetEditorV07
        model={model}
        onModelChange={(next, status) => {
          const adjusted = adjustConnected ? adjustModelToGridEdits(model, next) : next;
          onModelChange(
            adjusted,
            adjustConnected ? `${status} Connected geometry adjusted.` : status,
          );
        }}
      />
    </div>
  );
}
