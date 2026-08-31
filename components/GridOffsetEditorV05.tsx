"use client";

import { useEffect, useMemo, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import {
  applyGridOffsetSystem,
  readGridOffsetSystem,
  type GridOffsetLine,
} from "../lib/modeling/grid-system-service";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

function nextAlpha(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function defaultLines(axis: "x" | "y"): GridOffsetLine[] {
  const offsets = [0, 6, 12];
  return offsets.map((offset, index) => ({
    label: axis === "x" ? String(index + 1) : nextAlpha(index),
    offset,
  }));
}

function GridAxisEditor({
  title,
  axis,
  lines,
  onChange,
}: {
  title: string;
  axis: "x" | "y";
  lines: GridOffsetLine[];
  onChange: (lines: GridOffsetLine[]) => void;
}) {
  function update(index: number, patch: Partial<GridOffsetLine>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function add() {
    const last = lines[lines.length - 1];
    const previous = lines[lines.length - 2];
    const step = last && previous ? Math.max(Math.abs(last.offset - previous.offset), 1) : 6;
    const offset = last ? last.offset + step : 0;
    const label = axis === "x" ? String(lines.length + 1) : nextAlpha(lines.length);
    onChange([...lines, { label, offset }]);
  }

  function remove(index: number) {
    if (lines.length <= 2) return;
    onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <section className="gridOffsetSection">
      <div className="gridOffsetSectionHead">
        <div>
          <span>{title}</span>
          <strong>{axis === "x" ? "Vertical grid lines" : "Horizontal grid lines"}</strong>
        </div>
        <button type="button" onClick={add}>Add line</button>
      </div>

      <div className="gridOffsetTable">
        <div className="gridOffsetTableHead">
          <span>Label</span>
          <span>Offset from origin</span>
          <span />
        </div>

        {lines.map((line, index) => (
          <div className="gridOffsetRow" key={line.id ?? `${axis}-${index}`}>
            <input
              aria-label={`${title} line label ${index + 1}`}
              value={line.label}
              onChange={(event) => update(index, { label: event.target.value })}
            />
            <input
              aria-label={`${title} line offset ${index + 1}`}
              type="number"
              step="any"
              value={line.offset}
              onChange={(event) => update(index, { offset: Number(event.target.value) })}
            />
            <button
              type="button"
              className="gridOffsetDelete"
              disabled={lines.length <= 2}
              onClick={() => remove(index)}
              aria-label={`Delete ${line.label}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function GridOffsetEditorV05({ model, onModelChange }: Props) {
  const snapshot = useMemo(() => readGridOffsetSystem(model), [model.grids]);
  const [xLines, setXLines] = useState<GridOffsetLine[]>(
    snapshot.xLines.length >= 2 ? snapshot.xLines : defaultLines("x"),
  );
  const [yLines, setYLines] = useState<GridOffsetLine[]>(
    snapshot.yLines.length >= 2 ? snapshot.yLines : defaultLines("y"),
  );

  useEffect(() => {
    if (snapshot.xLines.length >= 2) setXLines(snapshot.xLines);
    if (snapshot.yLines.length >= 2) setYLines(snapshot.yLines);
  }, [snapshot]);

  function save() {
    try {
      const next = applyGridOffsetSystem(model, { xLines, yLines });
      onModelChange(next, "Grid system updated from origin offsets.");
    } catch (error) {
      onModelChange(
        model,
        error instanceof Error ? error.message : "Grid system update failed.",
      );
    }
  }

  return (
    <div className="gridOffsetEditor">
      <div className="gridOffsetIntro">
        <strong>Define each Grid line independently.</strong>
        <span>Offsets are measured from global origin. Equal spacing is not required.</span>
      </div>

      <GridAxisEditor
        title="Numbered axes"
        axis="x"
        lines={xLines}
        onChange={setXLines}
      />
      <GridAxisEditor
        title="Lettered axes"
        axis="y"
        lines={yLines}
        onChange={setYLines}
      />

      <button type="button" className="lgPrimary gridOffsetSave" onClick={save}>
        {snapshot.xLines.length >= 2 && snapshot.yLines.length >= 2
          ? "Update Grid System"
          : "Create Grid System"}
      </button>
    </div>
  );
}
