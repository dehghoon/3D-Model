"use client";

import { useState } from "react";
import type { Level, StructuralModel } from "@linkoteq/structural-core";

import { adjustModelToLevelEdit } from "../lib/modeling/reference-adjustment-service";
import LevelEditorV06 from "./LevelEditorV06";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
  embedded?: boolean;
}

function changedLevel(before: StructuralModel, after: StructuralModel): {
  before: Level;
  after: Level;
} | null {
  for (const next of after.levels) {
    const previous = before.levels.find((level) => level.id === next.id);
    if (!previous) continue;
    if (
      previous.name !== next.name ||
      Math.abs(previous.elevation - next.elevation) > 1e-9
    ) {
      return { before: previous, after: next };
    }
  }
  return null;
}

export default function LevelEditorV07({
  model,
  onModelChange,
  embedded = false,
}: Props) {
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
            Move nodes assigned to an edited Level so connected geometry follows it.
          </small>
        </span>
      </label>

      <LevelEditorV06
        model={model}
        embedded={embedded}
        onModelChange={(next, status) => {
          if (!adjustConnected) {
            onModelChange(next, status);
            return;
          }

          const change = changedLevel(model, next);
          const adjusted = change
            ? adjustModelToLevelEdit(next, change.before, change.after)
            : next;

          onModelChange(
            adjusted,
            change ? `${status} Connected geometry adjusted.` : status,
          );
        }}
      />
    </div>
  );
}
