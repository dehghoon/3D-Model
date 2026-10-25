"use client";
import { useState } from "react";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import { useMemberDrawState } from "../lib/editor/member-draw-store";
import {
  usePointToolState,
  MEMBER_DRAW_PICK_EVENT,
  SURFACE_FINISH_EVENT,
  setSurfacePoints,
} from "../lib/editor/member-draw-events";
import {
  useInteractionState,
  setCopyBase,
  setCopyPreview,
} from "../lib/editor/interaction-store";
import type { SnapPoint } from "../lib/editor/interaction-store";
import {
  pointFromCoordinates,
  columnPointAtLevel,
} from "../lib/editor/point-input";

const format = (p: Vec3) =>
  [p.x, p.y, p.z].map((v) => Number(v.toFixed(4))).join(", ");
function dispatchPoint(point: SnapPoint) {
  window.dispatchEvent(
    new CustomEvent(MEMBER_DRAW_PICK_EVENT, { detail: point }),
  );
}

function CoordinateForm({
  base,
  onPoint,
  mode,
  setMode,
}: {
  base: Vec3 | null;
  onPoint: (point: SnapPoint) => void;
  mode: "absolute" | "relative";
  setMode: (mode: "absolute" | "relative") => void;
}) {
  const [values, setValues] = useState(() => mode === "relative" ? {x:"0",y:"0",z:"0"} : { x: "", y: "", z: "" });
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const point = pointFromCoordinates(values, mode, base);
          setError("");
          onPoint(point);
        } catch (error) {
          setError(error instanceof Error ? error.message : "Invalid point.");
        }
      }}
    >
      <label>
        Point entry
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as typeof mode);
            setError("");
          }}
        >
          <option value="absolute">Absolute X / Y / Z</option>
          <option value="relative" disabled={!base}>
            Relative ΔX / ΔY / ΔZ
          </option>
        </select>
      </label>
      {mode === "relative" && base ? (
        <p>Offsets from ({format(base)})</p>
      ) : null}
      <div className="pointCoordinateFields">
        {(["x", "y", "z"] as const).map((axis) => (
          <label key={axis}>
            {mode === "relative" ? "Δ" : ""}
            {axis.toUpperCase()}
            <input
              aria-label={`${mode === "relative" ? "Δ" : ""}${axis.toUpperCase()}`}
              type="number"
              step="any"
              required
              value={values[axis]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [axis]: event.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>
      <button type="submit">Use point</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

export default function PointInputPanel({ model }: { model: StructuralModel }) {
  const tool = usePointToolState();
  const draw = useMemberDrawState();
  const transform = useInteractionState();
  const [entryMode, setEntryMode] = useState<"absolute" | "relative">("absolute");
  const [endLevel, setEndLevel] = useState("");
  const [levelError, setLevelError] = useState("");
  const isSurface = tool.tool === "wall" || tool.tool === "slab";
  const transforming = transform.mode !== "select";
  if (!tool.tool && !transforming) {
    const message =
      tool.message ||
      (transform.message !== "Select an object." ? transform.message : "");
    return message ? (
      <aside className="pointInputPanel" aria-label="Editor status">
        <p role="status">{message}</p>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event("linkoteq:modeling-cancel"))
          }
        >
          Dismiss
        </button>
      </aside>
    ) : null;
  }
  const base = transforming
    ? (transform.base?.point ?? null)
    : isSurface
      ? (tool.points.at(-1)?.point ?? null)
      : (draw.start?.point ?? null);
  const title = transforming
    ? `${transform.operation === "move" ? "Move" : "Copy"} · ${transform.selections.length} selected`
    : `${tool.tool![0].toUpperCase()}${tool.tool!.slice(1)}`;
  const step = transforming
    ? transform.mode === "copy-base"
      ? "1 · Choose base point"
      : "2 · Choose target point"
    : isSurface
      ? `${tool.points.length + 1} · Choose boundary point`
      : draw.start
        ? "2 · Choose end point"
        : "1 · Choose start point";
  const submit = (point: SnapPoint) => {
    if (!transforming) {
      dispatchPoint(point);
      return;
    }
    if (transform.mode === "copy-base") {
      setCopyBase(point);
      return;
    }
    if (transform.base) {
      setCopyPreview(point);
      const a = transform.base.point,
        b = point.point;
      window.dispatchEvent(
        new CustomEvent("linkoteq:copy-commit", {
          detail: { delta: { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z } },
        }),
      );
    }
  };
  return (
    <aside
      className="pointInputPanel"
      aria-label="Point input"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape")
          window.dispatchEvent(new Event("linkoteq:modeling-cancel"));
        event.stopPropagation();
      }}
    >
      <div className="pointInputHeading">
        <strong>{title}</strong>
        <button
          type="button"
          aria-label="Cancel active tool"
          onClick={() =>
            window.dispatchEvent(new Event("linkoteq:modeling-cancel"))
          }
        >
          Cancel
        </button>
      </div>
      <p role="status" aria-live="polite">
        <strong>{step}</strong>
      </p>
      <p>
        Click in the model or enter a point below. Global X / Y / Z ·{" "}
        {model.project.units === "US" ? "ft" : "m"} · Z is vertical.
      </p>
      {base ? (
        <p>
          {transforming ? "Base" : "Previous point"}: ({format(base)})
        </p>
      ) : null}
      <CoordinateForm
        key={`${tool.tool}:${step}:${base ? `${base.x}:${base.y}:${base.z}` : "none"}:${base ? entryMode : "absolute"}`}
        base={base}
        mode={base ? entryMode : "absolute"}
        setMode={setEntryMode}
        onPoint={submit}
      />
      {tool.tool === "column" && draw.start ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              submit(columnPointAtLevel(model, draw.start!.point, endLevel));
              setLevelError("");
            } catch (error) {
              setLevelError(
                error instanceof Error ? error.message : "Choose an end level.",
              );
            }
          }}
        >
          <label>
            Column end level
            <select
              value={endLevel}
              onChange={(event) => setEndLevel(event.target.value)}
            >
              <option value="">Choose level</option>
              {model.levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name} ({level.elevation})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!endLevel}>
            Use end level
          </button>
          {levelError ? <p role="alert">{levelError}</p> : null}
        </form>
      ) : null}
      {isSurface ? (
        <>
          <ol aria-label="Boundary points">
            {tool.points.map((point, index) => (
              <li key={index}>{format(point.point)}</li>
            ))}
          </ol>
          <div className="pointInputActions">
            <button
              type="button"
              disabled={!tool.points.length}
              onClick={() => setSurfacePoints(tool.points.slice(0, -1))}
            >
              Undo point
            </button>
            <button
              type="button"
              disabled={tool.points.length < 3}
              onClick={() =>
                window.dispatchEvent(new Event(SURFACE_FINISH_EVENT))
              }
            >
              Finish {title}
            </button>
          </div>
        </>
      ) : null}
      <p role="status" aria-live="polite">
        {transforming ? transform.message : tool.message}
      </p>
      {transforming ? (
        <p>
          Move keeps shared connections; Copy keeps originals. Press Esc to
          cancel.
        </p>
      ) : null}
    </aside>
  );
}
