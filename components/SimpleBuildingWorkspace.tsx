"use client";
import { useState } from "react";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import {
  buildingLevels,
  type SimpleBuildingSettings,
} from "../lib/editor/simple-building";
import {
  MEMBER_DRAW_PICK_EVENT,
  usePointToolState,
} from "../lib/editor/member-draw-events";
import {
  getPublishedSelections,
  publishSelections,
} from "../lib/editor/selection-store";
import type { EditorSelection } from "../lib/editor/selection";
import {
  useInteractionState,
  setCopyBase,
  setCopyPreview,
} from "../lib/editor/interaction-store";

type Props = {
  model: StructuralModel;
  settings: SimpleBuildingSettings;
  onSettingsChange: (s: SimpleBuildingSettings) => void;
  view: "plan" | "3d";
  onViewChange: (v: "plan" | "3d") => void;
  onSelect: (s: EditorSelection) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};
export default function SimpleBuildingWorkspace(p: Props) {
  const { levels, level, end } = buildingLevels(p.model, p.settings);
  const tool = usePointToolState();
  const transform = useInteractionState();
  const [multiple, setMultiple] = useState(false);
  const nodes = p.model.nodes.filter(
    (n) => level && Math.abs(n.position.z - level.elevation) < 1e-8,
  );
  const all = p.model.nodes
    .map((n) => n.position)
    .concat(tool.points.map((p) => p.point))
    .concat(p.model.grids.flatMap((g) => [g.start, g.end]));
  const minX = Math.min(0, ...all.map((n) => n.x)) - 2,
    maxX = Math.max(8, ...all.map((n) => n.x)) + 2;
  const minY = Math.min(0, ...all.map((n) => n.y)) - 2,
    maxY = Math.max(8, ...all.map((n) => n.y)) + 2;
  const width = maxX - minX,
    height = maxY - minY,
    stroke = Math.max(width, height) / 250;
  const nodeById = new Map(p.model.nodes.map((n) => [n.id, n]));
  function cancel() {
    window.dispatchEvent(new Event("linkoteq:modeling-cancel"));
  }
  function pick(point: Vec3) {
    const snap = {
      point,
      kind: "work-plane",
      label: `Floor ${level?.name}`,
    } as const;
    if (transform.mode === "copy-base") {
      setCopyBase(snap);
      return;
    }
    if (transform.mode !== "select" && transform.base) {
      setCopyPreview(snap);
      const a = transform.base.point;
      window.dispatchEvent(
        new CustomEvent("linkoteq:copy-commit", {
          detail: {
            delta: { x: point.x - a.x, y: point.y - a.y, z: point.z - a.z },
          },
        }),
      );
      return;
    }
    if (tool.tool)
      window.dispatchEvent(
        new CustomEvent(MEMBER_DRAW_PICK_EVENT, { detail: snap }),
      );
  }
  function select(s: Exclude<EditorSelection, null>) {
    if (multiple) {
      const current = getPublishedSelections();
      publishSelections(
        current.some((x) => x.type === s.type && x.id === s.id)
          ? current.filter((x) => x.type !== s.type || x.id !== s.id)
          : [...current, s],
      );
    } else p.onSelect(s);
  }
  const selected = getPublishedSelections();
  const color = (type: string, id: string) =>
    selected.some((s) => s.type === type && s.id === id)
      ? "#ea580c"
      : "#2563eb";
  return (
    <>
      <section className="simpleFloorBar" aria-label="Building setup">
        <label>
          Working floor
          <select
            aria-label="Working floor"
            value={level?.id ?? ""}
            onChange={(e) => {
              cancel();
              p.onSettingsChange({ levelId: e.target.value, endLevelId: "" });
            }}
          >
            {!levels.length ? (
              <option value="">Add floors using Levels</option>
            ) : (
              levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.elevation}{" "}
                  {p.model.project.units === "US" ? "ft" : "m"}
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          Columns / walls extend to
          <select
            aria-label="End floor"
            value={end?.id ?? ""}
            onChange={(e) => {
              cancel();
              p.onSettingsChange({
                ...p.settings,
                levelId: level?.id ?? "",
                endLevelId: e.target.value,
              });
            }}
          >
            {!end ? <option value="">Add a higher floor</option> : null}
            {levels
              .filter((l) => level && l.elevation > level.elevation)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </label>
        <button
          aria-pressed={p.view === "plan"}
          onClick={() => p.onViewChange("plan")}
        >
          Floor plan
        </button>
        <button
          aria-pressed={p.view === "3d"}
          onClick={() => p.onViewChange("3d")}
        >
          3D preview
        </button>
        <button disabled={!p.canUndo} onClick={p.onUndo}>
          Undo
        </button>
        <button disabled={!p.canRedo} onClick={p.onRedo}>
          Redo
        </button>
        <button aria-pressed={multiple} onClick={() => setMultiple(!multiple)}>
          Select multiple
        </button>
        <span>
          Concept geometry · Members use{" "}
          {p.model.sections[0]?.designation ?? "assigned sections"}; review
          sections, supports and loads in Advanced before analysis
        </span>
      </section>
      {p.view === "plan" ? (
        <div className="simplePlanCanvas">
          <p className="simplePlanHint" role="status">
            {!level
              ? "Add floors to start."
              : tool.tool === "column"
                ? `Click a column position on ${level.name}; its top is ${end?.name ?? "not set"}.`
                : tool.tool === "wall"
                  ? "Pick two wall ends, check the boundary, then Finish Wall."
                  : tool.tool === "slab"
                    ? "Pick two opposite slab corners, check the boundary, then Finish Slab."
                    : tool.tool === "beam"
                      ? "Pick the beam start and end on this floor."
                      : transform.mode !== "select"
                        ? transform.message
                        : "Choose an element above to draw, or select an existing element."}
          </p>
          <svg
            role="img"
            aria-label={`Floor plan ${level?.name ?? "no floor"}`}
            viewBox={`${minX} ${-maxY} ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            onClick={(e) => {
              if (!level) return;
              const svg = e.currentTarget,
                matrix = svg.getScreenCTM();
              if (!matrix) return;
              const point = svg.createSVGPoint();
              point.x = e.clientX;
              point.y = e.clientY;
              const local = point.matrixTransform(matrix.inverse());
              let target = { x: local.x, y: -local.y, z: level.elevation };
              // Snap only to points on the working floor; geometry is never silently projected from another floor.
              const nearest = nodes
                .map((n) => ({
                  p: n.position,
                  d: Math.hypot(
                    n.position.x - target.x,
                    n.position.y - target.y,
                  ),
                }))
                .sort((a, b) => a.d - b.d)[0];
              if (nearest && nearest.d < Math.max(width, height) * 0.018)
                target = nearest.p;
              pick(target);
            }}
          >
            <rect
              x={minX}
              y={-maxY}
              width={width}
              height={height}
              fill="#f8fafc"
            />
            {p.model.grids.map((g) => (
              <g key={g.id}>
                <line
                  x1={g.start.x}
                  y1={-g.start.y}
                  x2={g.end.x}
                  y2={-g.end.y}
                  stroke="#b9c7d8"
                  strokeWidth={stroke / 2}
                  strokeDasharray={`${stroke * 3} ${stroke * 3}`}
                />
                <text x={g.start.x} y={-g.start.y} fontSize={stroke * 4}>
                  {g.label}
                </text>
              </g>
            ))}
            {p.model.surfaces.map((s) => {
              const boundary = s.boundaryNodeIds
                .map((id) => nodeById.get(id))
                .filter(Boolean);
              if (
                !level ||
                !boundary.length ||
                !boundary.every(
                  (n) =>
                    Math.abs(n!.position.z - level.elevation) < 1e-8 ||
                    (s.type === "wall" && n!.position.z >= level.elevation),
                ) ||
                !boundary.some(
                  (n) => Math.abs(n!.position.z - level.elevation) < 1e-8,
                )
              )
                return null;
              return (
                <polygon
                  key={s.id}
                  points={boundary
                    .map((n) => `${n!.position.x},${-n!.position.y}`)
                    .join(" ")}
                  fill={s.type === "wall" ? "none" : "#dbeafe"}
                  stroke={color("surface", s.id)}
                  strokeWidth={stroke}
                  onClick={(e) => {
                    if (!tool.tool && transform.mode === "select") {
                      e.stopPropagation();
                      select({ type: "surface", id: s.id });
                    }
                  }}
                >
                  <title>
                    {s.type} {s.id}
                  </title>
                </polygon>
              );
            })}
            {p.model.members.map((m) => {
              const a = nodeById.get(m.startNodeId)?.position,
                b = nodeById.get(m.endNodeId)?.position;
              if (
                !a ||
                !b ||
                !level ||
                !(
                  Math.abs(a.z - level.elevation) < 1e-8 ||
                  Math.abs(b.z - level.elevation) < 1e-8
                )
              )
                return null;
              const vertical = Math.hypot(a.x - b.x, a.y - b.y) < 1e-8;
              const onClick = (e: React.MouseEvent) => {
                if (!tool.tool && transform.mode === "select") {
                  e.stopPropagation();
                  select({ type: "member", id: m.id });
                }
              };
              return vertical ? (
                <circle
                  key={m.id}
                  cx={a.x}
                  cy={-a.y}
                  r={stroke * 2}
                  fill={color("member", m.id)}
                  onClick={onClick}
                >
                  <title>Column {m.id}</title>
                </circle>
              ) : (
                <line
                  key={m.id}
                  x1={a.x}
                  y1={-a.y}
                  x2={b.x}
                  y2={-b.y}
                  stroke={color("member", m.id)}
                  strokeWidth={stroke * 2}
                  onClick={onClick}
                >
                  <title>
                    {m.type} {m.id}
                  </title>
                </line>
              );
            })}
            {tool.points.length ? (
              <polyline
                points={tool.points
                  .map((s) => `${s.point.x},${-s.point.y}`)
                  .join(" ")}
                stroke="#ea580c"
                fill="none"
                strokeWidth={stroke}
                strokeDasharray={`${stroke * 3} ${stroke * 2}`}
                pointerEvents="none"
              />
            ) : null}
            {nodes.map((n) => (
              <circle
                key={n.id}
                cx={n.position.x}
                cy={-n.position.y}
                r={stroke}
                fill="#0f172a"
                pointerEvents="none"
              />
            ))}
          </svg>
        </div>
      ) : null}
    </>
  );
}
