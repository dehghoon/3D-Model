"use client";

import { useEffect, useMemo, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import {
  applyGridOffsetSystem,
  readGridOffsetSystem,
  type GridOffsetLine,
  type GridOffsetSystem,
} from "../lib/modeling/grid-system-service";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

const STORAGE_PREFIX = "linkoteq:grid-offsets:v05:";

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
  return [0, 6, 12, 18].map((offset, index) => ({
    label: axis === "x" ? String(index + 1) : nextAlpha(index),
    offset,
  }));
}

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function loadStoredSystem(projectId: string): GridOffsetSystem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GridOffsetSystem>;
    if (!Array.isArray(parsed.xLines) || !Array.isArray(parsed.yLines)) return null;

    const valid = (line: GridOffsetLine) =>
      typeof line?.label === "string" &&
      line.label.trim().length > 0 &&
      Number.isFinite(line.offset);

    if (!parsed.xLines.every(valid) || !parsed.yLines.every(valid)) return null;
    if (parsed.xLines.length < 2 || parsed.yLines.length < 2) return null;

    return {
      xLines: parsed.xLines.map(({ label, offset }) => ({ label, offset })),
      yLines: parsed.yLines.map(({ label, offset }) => ({ label, offset })),
    };
  } catch {
    return null;
  }
}

function saveStoredSystem(projectId: string, system: GridOffsetSystem) {
  if (typeof window === "undefined") return;
  const portable: GridOffsetSystem = {
    xLines: system.xLines.map(({ label, offset }) => ({ label, offset })),
    yLines: system.yLines.map(({ label, offset }) => ({ label, offset })),
  };
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(portable));
}

function initialSystem(model: StructuralModel): GridOffsetSystem {
  const current = readGridOffsetSystem(model);
  if (current.xLines.length >= 2 && current.yLines.length >= 2) return current;

  const stored = loadStoredSystem(model.project.id);
  if (stored) return stored;

  return {
    xLines: defaultLines("x"),
    yLines: defaultLines("y"),
  };
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
    const last = lines.at(-1);
    const previous = lines.at(-2);
    const step =
      last && previous ? Math.max(Math.abs(last.offset - previous.offset), 1) : 6;
    onChange([
      ...lines,
      {
        label: axis === "x" ? String(lines.length + 1) : nextAlpha(lines.length),
        offset: last ? last.offset + step : 0,
      },
    ]);
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
  const initial = useMemo(() => initialSystem(model), [model.project.id]);
  const [xLines, setXLines] = useState<GridOffsetLine[]>(initial.xLines);
  const [yLines, setYLines] = useState<GridOffsetLine[]>(initial.yLines);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (snapshot.xLines.length >= 2) setXLines(snapshot.xLines);
    if (snapshot.yLines.length >= 2) setYLines(snapshot.yLines);
  }, [snapshot]);

  function save() {
    try {
      const system = { xLines, yLines };
      const next = applyGridOffsetSystem(model, system);
      saveStoredSystem(model.project.id, system);
      onModelChange(next, "Grid system saved.");
      setFeedback("Saved");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Grid system update failed.");
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

      <div className="gridOffsetSaveRow">
        <button type="button" className="lgPrimary gridOffsetSave" onClick={save}>
          Save Grid System
        </button>
        {feedback ? <span className="gridOffsetFeedback">{feedback}</span> : null}
      </div>
    </div>
  );
}
