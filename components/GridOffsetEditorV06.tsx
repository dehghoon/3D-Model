"use client";

import { useEffect, useRef, useState } from "react";
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

const STORAGE_PREFIX = "linkoteq:grid-offsets:v07:";

function alpha(index: number): string {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    n -= 1;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

function defaults(): GridOffsetSystem {
  const offsets = [0, 6, 12, 18];
  return {
    xLines: offsets.map((offset, index) => ({
      label: String(index + 1),
      offset,
    })),
    yLines: offsets.map((offset, index) => ({
      label: alpha(index),
      offset,
    })),
  };
}


function isLegacySwapped(system: GridOffsetSystem): boolean {
  return (
    system.xLines.length >= 2 &&
    system.yLines.length >= 2 &&
    system.xLines.every((line) => /^[A-Z]+$/i.test(line.label.trim())) &&
    system.yLines.every((line) => /^\d+$/.test(line.label.trim()))
  );
}

function loadStored(projectId: string): GridOffsetSystem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GridOffsetSystem;
    if (!Array.isArray(parsed.xLines) || !Array.isArray(parsed.yLines)) return null;
    if (parsed.xLines.length < 2 || parsed.yLines.length < 2) return null;
    return isLegacySwapped(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function saveStored(projectId: string, system: GridOffsetSystem) {
  if (typeof window === "undefined") return;
  const portable = {
    xLines: system.xLines.map(({ label, offset }) => ({ label, offset })),
    yLines: system.yLines.map(({ label, offset }) => ({ label, offset })),
  };
  window.localStorage.setItem(
    `${STORAGE_PREFIX}${projectId}`,
    JSON.stringify(portable),
  );
}

function initialSystem(model: StructuralModel): GridOffsetSystem {
  const current = readGridOffsetSystem(model);
  const hasCompleteOrthogonalModel =
    current.xLines.length >= 2 &&
    current.yLines.length >= 2 &&
    current.xLines.length + current.yLines.length === model.grids.length;

  if (hasCompleteOrthogonalModel && !isLegacySwapped(current)) return current;
  return loadStored(model.project.id) ?? defaults();
}

function AxisEditor({
  title,
  axis,
  lines,
  setLines,
}: {
  title: string;
  axis: "x" | "y";
  lines: GridOffsetLine[];
  setLines: (lines: GridOffsetLine[]) => void;
}) {
  const update = (index: number, patch: Partial<GridOffsetLine>) => {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const add = () => {
    const last = lines.at(-1);
    const previous = lines.at(-2);
    const step =
      last && previous
        ? Math.max(Math.abs(last.offset - previous.offset), 1)
        : 6;
    setLines([
      ...lines,
      {
        label: axis === "x" ? String(lines.length + 1) : alpha(lines.length),
        offset: last ? last.offset + step : 0,
      },
    ]);
  };

  const remove = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  return (
    <section className="gridOffsetSection">
      <div className="gridOffsetSectionHead">
        <div>
          <span>{title}</span>
          <strong>
            {axis === "x" ? "Vertical grid lines" : "Horizontal grid lines"}
          </strong>
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
          <div className="gridOffsetRow" key={`${axis}-${index}`}>
            <input
              value={line.label}
              onChange={(event) => update(index, { label: event.target.value })}
              aria-label={`${title} label ${index + 1}`}
            />
            <input
              type="number"
              step="any"
              value={line.offset}
              onChange={(event) =>
                update(index, { offset: Number(event.target.value) })
              }
              aria-label={`${title} offset ${index + 1}`}
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

export default function GridOffsetEditorV06({ model, onModelChange }: Props) {
  const [system, setSystem] = useState<GridOffsetSystem>(() => initialSystem(model));
  const [feedback, setFeedback] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const current = readGridOffsetSystem(model);
    const isClean =
      current.xLines.length >= 2 &&
      current.yLines.length >= 2 &&
      current.xLines.length + current.yLines.length === model.grids.length &&
      !isLegacySwapped(current);

    if (isClean) return;

    try {
      const next = applyGridOffsetSystem(model, system);
      saveStored(model.project.id, system);
      onModelChange(next, "Default Grid system initialized.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Grid initialization failed.",
      );
    }
  }, [model, onModelChange, system]);

  const save = () => {
    try {
      const next = applyGridOffsetSystem(model, system);
      saveStored(model.project.id, system);
      onModelChange(next, "Grid system saved.");
      setFeedback("Saved");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Grid system update failed.",
      );
    }
  };

  return (
    <div className="gridOffsetEditor">
      <div className="gridOffsetIntro">
        <strong>Define each Grid line independently.</strong>
        <span>
          Vertical lines default to 1, 2, 3, 4. Horizontal lines default to A, B, C, D.
        </span>
      </div>

      <AxisEditor
        title="Numbered axes"
        axis="x"
        lines={system.xLines}
        setLines={(xLines) => setSystem((current) => ({ ...current, xLines }))}
      />
      <AxisEditor
        title="Lettered axes"
        axis="y"
        lines={system.yLines}
        setLines={(yLines) => setSystem((current) => ({ ...current, yLines }))}
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
