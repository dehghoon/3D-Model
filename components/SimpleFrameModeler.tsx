"use client";
import { useEffect, useRef, useState } from "react";
import FrameCatalogToolbar, { FrameSectionPicker } from "./FrameCatalogToolbar";
import FrameBraceControls from "./FrameBraceControls";
import {
  loadFrameCatalogs,
  requestedSection,
  type FrameCatalogs,
} from "../lib/core-frame-catalogs";
import type { Section, Material } from "@linkoteq/structural-core";
import type { StructuralModel } from "@linkoteq/structural-core";
import {
  createSimpleFrame,
  DEFAULT_FRAME,
  fitDimension,
  positions,
  resizeBays,
  total,
  type FrameLayout,
  type FrameAxis,
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
    axis: FrameAxis;
    index: number;
  } | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(false);
  const [catalogs, setCatalogs] = useState<FrameCatalogs | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const current = useRef({ model, layout, onChange });
  current.current = { model, layout, onChange };
  useEffect(() => {
    const controller = new AbortController();
    setCatalogError("");
    loadFrameCatalogs(controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setCatalogs(loaded);
        const {
          model: latest,
          layout: setup,
          onChange: change,
        } = current.current;
        if (typeof latest.project.metadata?.simpleFrame !== "string") return;
        const column = requestedSection(loaded, "column");
        if (!setup.defaults?.column && column) {
          const next = {
            ...setup,
            defaults: { ...setup.defaults, column: column.id },
          };
          const template = {
            ...latest,
            sections: [
              ...latest.sections.filter((s) => s.id !== column.id),
              column,
            ],
          };
          const nextModel = createSimpleFrame(next, template);
          setLayout(next);
          change(nextModel);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setCatalogError(err.message);
      });
    return () => controller.abort();
  }, [retry]);
  const selected = model.members.find((m) => m.id === selectedId);
  function updateWithSection(next: FrameLayout, section?: Section) {
    const template = section
      ? {
          ...model,
          sections: [
            ...model.sections.filter((s) => s.id !== section.id),
            section,
          ],
        }
      : model;
    update(next, false, template);
  }
  function materialChange(material: Material) {
    const template = {
      ...model,
      materials: [
        ...model.materials.filter((m) => m.id !== material.id),
        material,
      ],
    };
    update(
      { ...layout, defaults: { ...layout.defaults, materialId: material.id } },
      false,
      template,
    );
  }
  function locationChange(id: string) {
    const location = catalogs?.locations.find((l) => l.id === id);
    const metadata = { ...model.project.metadata };
    for (const key of [
      "locationId",
      "locationName",
      "provinceOrTerritory",
      "country",
      "locationCatalogRef",
      "climateReference",
    ])
      delete metadata[key];
    if (location)
      Object.assign(metadata, {
        locationId: location.id,
        locationName: location.location,
        provinceOrTerritory: location.provinceOrTerritory,
        country: location.country,
        locationCatalogRef: catalogs?.ref,
        climateReference: JSON.stringify(location.climateRef),
      });
    onChange({ ...model, project: { ...model.project, metadata } });
  }
  function editMember(
    patch: NonNullable<FrameLayout["overrides"]>[string],
    section?: Section,
  ) {
    if (!selected) return;
    updateWithSection(
      {
        ...layout,
        overrides: {
          ...layout.overrides,
          [selected.id]: { ...layout.overrides?.[selected.id], ...patch },
        },
      },
      section,
    );
  }
  const generated = typeof model.project.metadata?.simpleFrame === "string";
  function update(next: FrameLayout, replace = false, template = model) {
    if (!generated && !replace) {
      setError(
        "Create a quick frame first, or continue in Advanced to keep the current model.",
      );
      return;
    }
    try {
      const nextModel = createSimpleFrame(next, template);
      setLayout(next);
      onChange(nextModel);
      setEdit(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function select(axis: FrameAxis, index: number) {
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
    500 / Math.max(1, maxX - minX),
    360 / Math.max(1, maxY - minY),
  );
  const p = (x: number, y: number, z: number) => {
    const q = raw(x, y, z);
    return { x: 125 + (q.x - minX) * scale, y: 100 + (q.y - minY) * scale };
  };
  const line = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    key: string,
    kind: string,
  ) => <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={kind} />;
  function dimension(
    axis: FrameAxis,
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
    <>
      <FrameCatalogToolbar
        model={model}
        layout={layout}
        catalogs={catalogs}
        error={catalogError}
        onRetry={() => setRetry((n) => n + 1)}
        onLayout={updateWithSection}
        onMaterial={materialChange}
        onLocation={locationChange}
      />
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
            Adding a grid adds a 5 m bay. Changing the overall size uses 5 m
            bays plus the remaining distance. Click any dimension to customize
            it.
          </p>
          <FrameBraceControls
            layout={layout}
            onChange={(next) => update(next)}
          />
          <button className="sfAdvanced" onClick={onAdvanced}>
            Continue in Advanced →
          </button>
        </aside>
        <section className="sfCanvas">
          <header>
            <div>
              <strong>Live model</strong>
              <span>
                {width.toFixed(1)} × {depth.toFixed(1)} m · {height.toFixed(1)}{" "}
                m high
              </span>
            </div>
            <div>
              <label className="sfMemberFilter">
                Pick members
                <select
                  aria-label="Member type filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="beam">Beams</option>
                  <option value="column">Columns</option>
                  <option value="brace">Braces</option>
                </select>
              </label>
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
            {xs.map((x, i) =>
              line(p(x, 0, 0), p(x, depth, 0), `gx${i}`, "sfGrid"),
            )}
            {ys.map((y, j) =>
              line(p(0, y, 0), p(width, y, 0), `gy${j}`, "sfGrid"),
            )}
            {model.members
              .filter(
                (m) =>
                  (filter === "all" || m.type === filter) &&
                  (!plan ||
                    m.type !== "column" ||
                    m.levelId === model.levels.at(-1)?.id),
              )
              .map((member) => {
                const a = model.nodes.find((n) => n.id === member.startNodeId)!,
                  b = model.nodes.find((n) => n.id === member.endNodeId)!;
                const start = p(a.position.x, a.position.y, a.position.z),
                  end = p(b.position.x, b.position.y, b.position.z);
                const section = model.sections.find(
                  (s) => s.id === member.sectionId,
                );
                return (
                  <g
                    key={member.id}
                    className={`sfMember ${selectedId === member.id ? "sfMemberSelected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${member.type} ${member.id}`}
                    onClick={() => {
                      if (generated) {
                        setSelectedId(member.id);
                        setEdit(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(member.id);
                        setEdit(null);
                      }
                    }}
                  >
                    <title>
                      {member.type} · {section?.designation ?? member.sectionId}
                    </title>
                    {plan && member.type === "column" ? (
                      <>
                        <circle
                          cx={end.x}
                          cy={end.y}
                          r={10}
                          className="sfMemberHit"
                        />
                        <circle
                          cx={end.x}
                          cy={end.y}
                          r={4}
                          className="sfPlanColumn"
                        />
                      </>
                    ) : (
                      <>
                        <line
                          x1={start.x}
                          y1={start.y}
                          x2={end.x}
                          y2={end.y}
                          className="sfMemberHit"
                        />
                        {line(
                          start,
                          end,
                          member.id,
                          member.type === "column"
                            ? "sfColumn"
                            : member.type === "brace"
                              ? "sfBrace"
                              : "sfBeam",
                        )}
                      </>
                    )}
                  </g>
                );
              })}
            {xs.flatMap((x, i) =>
              [true, false].map((near) => {
                const q = p(x, near ? 0 : depth, 0),
                  other = p(x, near ? depth : 0, 0);
                const len = Math.hypot(q.x - other.x, q.y - other.y) || 1;
                const bubble = {
                  x: q.x + ((q.x - other.x) / len) * 45,
                  y: q.y + ((q.y - other.y) / len) * 45,
                };
                return (
                  <g
                    key={`labelX${i}${near}`}
                    className="sfGridBubble"
                    aria-label={`Grid ${i + 1} ${near ? "near" : "far"}`}
                  >
                    <line x1={q.x} y1={q.y} x2={bubble.x} y2={bubble.y} />
                    <circle cx={bubble.x} cy={bubble.y} r={12} />
                    <text x={bubble.x} y={bubble.y + 4} textAnchor="middle">
                      {i + 1}
                    </text>
                  </g>
                );
              }),
            )}
            {ys.flatMap((y, j) =>
              [true, false].map((near) => {
                const q = p(near ? 0 : width, y, 0),
                  other = p(near ? width : 0, y, 0);
                const len = Math.hypot(q.x - other.x, q.y - other.y) || 1;
                const bubble = {
                  x: q.x + ((q.x - other.x) / len) * 45,
                  y: q.y + ((q.y - other.y) / len) * 45,
                };
                return (
                  <g
                    key={`labelY${j}${near}`}
                    className="sfGridBubble"
                    aria-label={`Grid ${String.fromCharCode(65 + j)} ${near ? "near" : "far"}`}
                  >
                    <line x1={q.x} y1={q.y} x2={bubble.x} y2={bubble.y} />
                    <circle cx={bubble.x} cy={bubble.y} r={12} />
                    <text x={bubble.x} y={bubble.y + 4} textAnchor="middle">
                      {String.fromCharCode(65 + j)}
                    </text>
                  </g>
                );
              }),
            )}
            {layout.x.map((_, i) =>
              dimension(
                "x",
                i,
                { x: p(xs[i], 0, 0).x, y: p(xs[i], 0, 0).y + 80 },
                { x: p(xs[i + 1], 0, 0).x, y: p(xs[i + 1], 0, 0).y + 80 },
              ),
            )}
            {layout.y.map((_, j) =>
              dimension(
                "y",
                j,
                { x: p(0, ys[j], 0).x - 80, y: p(0, ys[j], 0).y },
                { x: p(0, ys[j + 1], 0).x - 80, y: p(0, ys[j + 1], 0).y },
              ),
            )}
            {!plan &&
              layout.heights.map((_, k) =>
                dimension(
                  "heights",
                  k,
                  { x: p(width, 0, zs[k]).x + 80, y: p(width, 0, zs[k]).y },
                  {
                    x: p(width, 0, zs[k + 1]).x + 80,
                    y: p(width, 0, zs[k + 1]).y,
                  },
                ),
              )}
          </svg>
          {selected ? (
            <section className="sfMemberEditor" aria-label="Member editor">
              <div>
                <strong>
                  {selected.type} · {selected.id}
                </strong>
                <button onClick={() => setSelectedId(null)}>
                  Close member editor
                </button>
              </div>
              <FrameSectionPicker
                label="Member section"
                value={selected.sectionId}
                catalogs={catalogs}
                model={model}
                onChange={(section) =>
                  editMember({ sectionId: section.id }, section)
                }
              />
              <label>
                Member material
                <select
                  aria-label="Member material"
                  value={selected.materialId}
                  onChange={(e) => editMember({ materialId: e.target.value })}
                >
                  {model.materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Rotation (degrees)
                <input
                  aria-label="Member rotation"
                  key={`${selected.id}-${selected.rotationDeg}`}
                  type="number"
                  step="any"
                  defaultValue={selected.rotationDeg ?? 0}
                  onBlur={(e) =>
                    editMember({ rotationDeg: Number(e.target.value) })
                  }
                />
              </label>
              <button
                onClick={() => {
                  editMember({ excluded: true });
                  setSelectedId(null);
                }}
              >
                Omit this member
              </button>
              <button
                onClick={() => {
                  const next = { ...layout.overrides };
                  delete next[selected.id];
                  update({ ...layout, overrides: next });
                }}
              >
                Use defaults for this member
              </button>
            </section>
          ) : null}
          {Object.values(layout.overrides ?? {}).some((o) => o.excluded) ? (
            <button
              onClick={() => {
                const overrides = Object.fromEntries(
                  Object.entries(layout.overrides ?? {}).map(([id, o]) => [
                    id,
                    { ...o, excluded: false },
                  ]),
                );
                update({ ...layout, overrides });
              }}
            >
              Restore omitted members
            </button>
          ) : null}
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
              ? `${model.nodes.length} nodes · ${model.members.filter((m) => m.type === "column").length} columns · ${model.members.filter((m) => m.type === "beam").length} beams · ${model.members.filter((m) => m.type === "brace").length} braces`
              : "Frame preview"}{" "}
            · All dimensions in metres
          </footer>
        </section>
      </main>
    </>
  );
}
