"use client";
import { useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import {
  createSimpleFrame,
  DEFAULT_FRAME,
  fitDimension,
  positions,
  resizeBays,
  total,
  type FrameLayout,
} from "../lib/simple-frame";
interface Props {
  model: StructuralModel;
  onChange: (model: StructuralModel) => void;
  onAdvanced: () => void;
}
export default function SimpleFrameModeler({
  model,
  onChange,
  onAdvanced,
}: Props) {
  const [layout, setLayout] = useState<FrameLayout>(() => {
    try {
      const value = model.project.metadata?.simpleFrame;
      return typeof value === "string" ? JSON.parse(value) : DEFAULT_FRAME;
    } catch {
      return DEFAULT_FRAME;
    }
  });
  const [edit, setEdit] = useState<{
    axis: keyof FrameLayout;
    index: number;
  } | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(false);
  const generated = typeof model.project.metadata?.simpleFrame === "string";
  function update(next: FrameLayout, replace = false) {
    if (!generated && !replace) {
      setError(
        "Create a quick frame first, or continue in Advanced to keep the current model.",
      );
      return;
    }
    try {
      const nextModel = createSimpleFrame(next, model);
      setLayout(next);
      onChange(nextModel);
      setEdit(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function select(axis: keyof FrameLayout, index: number) {
    if (!generated) {
      setError("Create a quick frame first to edit dimensions.");
      return;
    }
    setEdit({ axis, index });
    setValue(String(layout[axis][index]));
  }
  const xs = positions(layout.x),
    ys = positions(layout.y),
    zs = positions(layout.heights);
  const width = total(layout.x),
    depth = total(layout.y),
    height = total(layout.heights);
  const raw = (x: number, y: number, z: number) =>
    plan ? { x, y: -y } : { x: x - y * 0.65, y: (x + y) * 0.3 - z };
  const corners = [0, width].flatMap((x) =>
    [0, depth].flatMap((y) => [0, height].map((z) => raw(x, y, z))),
  );
  const minX = Math.min(...corners.map((p) => p.x)),
    maxX = Math.max(...corners.map((p) => p.x)),
    minY = Math.min(...corners.map((p) => p.y)),
    maxY = Math.max(...corners.map((p) => p.y));
  const scale = Math.min(
    570 / Math.max(1, maxX - minX),
    410 / Math.max(1, maxY - minY),
  );
  const p = (x: number, y: number, z: number) => {
    const q = raw(x, y, z);
    return { x: 90 + (q.x - minX) * scale, y: 70 + (q.y - minY) * scale };
  };
  const line = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    key: string,
    kind: string,
  ) => <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={kind} />;
  function dimension(
    axis: keyof FrameLayout,
    index: number,
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) {
    const x = (a.x + b.x) / 2,
      y = (a.y + b.y) / 2;
    return (
      <g
        key={`${axis}${index}`}
        className="sfDimension"
        role="button"
        tabIndex={0}
        aria-label={`Edit ${axis === "heights" ? "storey" : axis.toUpperCase() + " bay"} ${index + 1}: ${layout[axis][index]} m`}
        onClick={() => select(axis, index)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select(axis, index);
          }
        }}
      >
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        <rect x={x - 28} y={y - 14} width={56} height={28} rx={7} />
        <text x={x} y={y + 4} textAnchor="middle">
          {Number(layout[axis][index].toFixed(2))} m
        </text>
      </g>
    );
  }
  return (
    <main className="simpleFrameWorkspace">
      <aside className="sfSetup">
        <span className="sfEyebrow">QUICK FRAME</span>
        <h1>Your building, in a few clicks</h1>
        <p>
          Set the plan, add grids and storeys. Columns and beams connect
          automatically.
        </p>
        {!generated ? (
          <div className="sfNotice">
            Your existing model is kept in Advanced. Creating a quick frame
            replaces the current geometry.
            <button onClick={() => update(layout, true)}>
              Create quick frame
            </button>
            <button onClick={onAdvanced}>Keep editing in Advanced</button>
          </div>
        ) : null}
        <h2>
          Plan size <small>metres</small>
        </h2>
        {(["x", "y"] as const).map((axis) => (
          <label key={axis}>
            Overall {axis === "x" ? "length X" : "width Y"}
            <input
              key={`${axis}-${total(layout[axis])}`}
              type="number"
              min="0.1"
              max="20000"
              step="any"
              defaultValue={total(layout[axis])}
              onBlur={(e) => {
                try {
                  if (Number(e.target.value) !== total(layout[axis]))
                    update({
                      ...layout,
                      [axis]: fitDimension(Number(e.target.value)),
                    });
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </label>
        ))}
        <h2>Grids &amp; storeys</h2>
        {(["x", "y", "heights"] as const).map((axis) => (
          <div className="sfCounter" key={axis}>
            <div>
              <strong>
                {axis === "heights"
                  ? "Storeys"
                  : `Grid lines ${axis.toUpperCase()}`}
              </strong>
              <small>
                {axis === "heights" ? "New storey: 3 m" : "New bay: 5 m"}
              </small>
            </div>
            <button
              aria-label={`Remove ${axis}`}
              disabled={layout[axis].length === 1}
              onClick={() =>
                update({
                  ...layout,
                  [axis]: resizeBays(
                    layout[axis],
                    layout[axis].length - 1,
                    axis === "heights" ? 3 : 5,
                  ),
                })
              }
            >
              −
            </button>
            <output>
              {layout[axis].length + (axis === "heights" ? 0 : 1)}
            </output>
            <button
              aria-label={`Add ${axis}`}
              disabled={layout[axis].length === 20}
              onClick={() =>
                update({
                  ...layout,
                  [axis]: resizeBays(
                    layout[axis],
                    layout[axis].length + 1,
                    axis === "heights" ? 3 : 5,
                  ),
                })
              }
            >
              +
            </button>
          </div>
        ))}
        <p className="sfHint">
          Adding a grid adds a 5 m bay. Changing the overall size uses 5 m bays
          plus the remaining distance. Click any dimension to customize it.
        </p>
        <button className="sfAdvanced" onClick={onAdvanced}>
          Continue in Advanced →
        </button>
      </aside>
      <section className="sfCanvas">
        <header>
          <div>
            <strong>Live model</strong>
            <span>
              {width.toFixed(1)} × {depth.toFixed(1)} m · {height.toFixed(1)} m
              high
            </span>
          </div>
          <div>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(model, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${model.project.id}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Save
            </button>
            <button aria-pressed={!plan} onClick={() => setPlan(false)}>
              3D
            </button>
            <button aria-pressed={plan} onClick={() => setPlan(true)}>
              Plan
            </button>
          </div>
        </header>
        <svg
          viewBox="0 0 820 590"
          aria-label="Interactive structural frame: click dimensions to edit"
          role="group"
        >
          {zs.flatMap((z, k) =>
            plan && k !== zs.length - 1
              ? []
              : ys.flatMap((y, j) =>
                  xs.flatMap((x, i) => [
                    ...(!plan && k > 0
                      ? [
                          line(
                            p(x, y, zs[k - 1]),
                            p(x, y, z),
                            `c${i}-${j}-${k}`,
                            "sfColumn",
                          ),
                        ]
                      : []),
                    ...(i < xs.length - 1
                      ? [
                          line(
                            p(x, y, z),
                            p(xs[i + 1], y, z),
                            `x${i}-${j}-${k}`,
                            k === 0 ? "sfGrid" : "sfBeam",
                          ),
                        ]
                      : []),
                    ...(j < ys.length - 1
                      ? [
                          line(
                            p(x, y, z),
                            p(x, ys[j + 1], z),
                            `y${i}-${j}-${k}`,
                            k === 0 ? "sfGrid" : "sfBeam",
                          ),
                        ]
                      : []),
                  ]),
                ),
          )}
          {layout.x.map((_, i) =>
            dimension(
              "x",
              i,
              { x: p(xs[i], 0, 0).x, y: p(xs[i], 0, 0).y + 36 },
              { x: p(xs[i + 1], 0, 0).x, y: p(xs[i + 1], 0, 0).y + 36 },
            ),
          )}
          {layout.y.map((_, j) =>
            dimension(
              "y",
              j,
              { x: p(0, ys[j], 0).x - 40, y: p(0, ys[j], 0).y },
              { x: p(0, ys[j + 1], 0).x - 40, y: p(0, ys[j + 1], 0).y },
            ),
          )}
          {!plan &&
            layout.heights.map((_, k) =>
              dimension(
                "heights",
                k,
                { x: p(width, 0, zs[k]).x + 45, y: p(width, 0, zs[k]).y },
                {
                  x: p(width, 0, zs[k + 1]).x + 45,
                  y: p(width, 0, zs[k + 1]).y,
                },
              ),
            )}
        </svg>
        {edit ? (
          <form
            className="sfEdit"
            onSubmit={(e) => {
              e.preventDefault();
              const next = {
                ...layout,
                [edit.axis]: layout[edit.axis].map((v, i) =>
                  i === edit.index ? Number(value) : v,
                ),
              };
              try {
                createSimpleFrame(next, model);
                update(next);
                setEdit(null);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label>
              {edit.axis === "heights"
                ? "Storey height"
                : `${edit.axis.toUpperCase()} bay spacing`}{" "}
              {edit.index + 1} (m)
              <input
                autoFocus
                type="number"
                step="any"
                min="0.1"
                max="1000"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <button type="submit">Apply</button>
            <button type="button" onClick={() => setEdit(null)}>
              Cancel
            </button>
          </form>
        ) : (
          <p className="sfCanvasHint">
            Click a dimension on the model to edit it
          </p>
        )}
        {error ? <p role="alert">{error}</p> : null}
        <footer>
          {generated
            ? `${model.nodes.length} nodes · ${model.members.filter((m) => m.type === "column").length} columns · ${model.members.filter((m) => m.type === "beam").length} beams`
            : "Frame preview"}{" "}
          · All dimensions in metres
        </footer>
      </section>
    </main>
  );
}
