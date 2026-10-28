"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import FrameCatalogToolbar, { FrameSectionPicker } from "./FrameCatalogToolbar";
import FrameBraceControls from "./FrameBraceControls";
import {
  loadFrameCatalogs,
  simpleDefaultSection,
  type FrameCatalogs,
} from "../lib/core-frame-catalogs";
import type { Section, Material } from "@linkoteq/structural-core";
import FrameDisplayPanel from "./FrameDisplayPanel";
import MobileFrameSheet, { type MobileFrameTab } from "./MobileFrameSheet";
import {
  INITIAL_FRAME_VIEW,
  framePoint,
  zoomFrame,
  pinchFrame,
  type FrameView,
} from "../lib/frame-navigation";
import {
  getDisplayOptions,
  subscribeDisplayOptions,
} from "../lib/visualization/display-options-store";
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
  const [mobile, setMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileFrameTab>("plan");
  const [sheetOpen, setSheetOpen] = useState(false);
  const touchPoints = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    view: FrameView;
    x: number;
    y: number;
    distance: number;
  } | null>(null);
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 760px)");
    if (!query) return;
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);
  function showPanel(tab: MobileFrameTab) {
    setMobileTab(tab);
    setSheetOpen(true);
  }
  function pickMember(id: string) {
    if (!generated) return;
    setSelectedId(id);
    setEdit(null);
    if (mobile) showPanel("members");
  }

  const [navigationTool, setNavigationTool] = useState<
    "select" | "pan" | "orbit"
  >("select");
  const [camera, setCamera] = useState<FrameView>(INITIAL_FRAME_VIEW);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    view: FrameView;
    yaw: number;
    tilt: number;
    kind: "pan" | "orbit" | null;
  } | null>(null);
  const suppressClick = useRef(false);
  const [angles, setAngles] = useState({ yaw: 0.6, tilt: 0.42 });
  const [showDimensions, setShowDimensions] = useState(true);
  const [showMembers, setShowMembers] = useState(true);
  const display = useSyncExternalStore(
    subscribeDisplayOptions,
    getDisplayOptions,
    getDisplayOptions,
  );
  function moveCamera(next: FrameView) {
    cameraRef.current = next;
    setCamera(next);
  }
  function zoomAt(factor: number) {
    const view = cameraRef.current;
    moveCamera(
      zoomFrame(view, factor, {
        x: view.x + view.width / 2,
        y: view.y + view.height / 2,
      }),
    );
  }
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const view = cameraRef.current;
      const point = framePoint(
        view,
        svg.getBoundingClientRect(),
        event.clientX,
        event.clientY,
      );
      moveCamera(
        zoomFrame(
          view,
          Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.0015))),
          point,
        ),
      );
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, []);

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
        const defaults = { ...setup.defaults };
        const sections = [...latest.sections];
        let changed = false;
        for (const type of ["beam", "column", "brace"] as const) {
          const section = simpleDefaultSection(loaded, type);
          if (!defaults[type] && section) {
            defaults[type] = section.id;
            changed = true;
            if (!sections.some((s) => s.id === section.id))
              sections.push(section);
          }
        }
        if (changed) {
          const next = { ...setup, defaults };
          const nextModel = createSimpleFrame(next, { ...latest, sections });
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
          sections: model.sections.some((s) => s.id === section.id)
            ? model.sections.map((s) => (s.id === section.id ? section : s))
            : [...model.sections, section],
        }
      : model;
    update(next, false, template);
  }
  function materialChange(material: Material) {
    const template = {
      ...model,
      materials: model.materials.some((m) => m.id === material.id)
        ? model.materials.map((m) => (m.id === material.id ? material : m))
        : [...model.materials, material],
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
    setSelectedId(null);
    if (mobile) showPanel("plan");
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
    plan
      ? { x, y: -y }
      : {
          x: x * Math.cos(angles.yaw) - y * Math.sin(angles.yaw),
          y:
            (x * Math.sin(angles.yaw) + y * Math.cos(angles.yaw)) *
              Math.sin(angles.tilt) -
            z * Math.cos(angles.tilt),
        };
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
  const catalogPanel = (
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
  );
  const setupPanel = (
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
          <output>{layout[axis].length + (axis === "heights" ? 0 : 1)}</output>
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
      <FrameBraceControls layout={layout} onChange={(next) => update(next)} />
      <button className="sfAdvanced" onClick={onAdvanced}>
        Continue in Advanced →
      </button>
    </aside>
  );
  const memberEditor = selected ? (
    <section className="sfMemberEditor" aria-label="Member editor">
      <div>
        <strong>
          {selected.type} · {selected.id}
        </strong>
        <button onClick={() => setSelectedId(null)}>Close member editor</button>
      </div>
      <FrameSectionPicker
        label="Member section"
        value={selected.sectionId}
        catalogs={catalogs}
        model={model}
        onChange={(section) => editMember({ sectionId: section.id }, section)}
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
          onBlur={(e) => editMember({ rotationDeg: Number(e.target.value) })}
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
  ) : null;
  const dimensionEditor = edit ? (
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
          if (mobile) setSheetOpen(false);
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
      {navigationTool === "select"
        ? "Select · Click a member to change its section"
        : navigationTool === "pan"
          ? "Pan · Drag to move the view"
          : "Orbit · Drag to rotate the 3D view"}{" "}
      · Wheel: zoom · Middle/right drag or Shift+drag: pan
    </p>
  );
  const memberBrowser = (
    <section className="sfMobileMemberBrowser" aria-label="Member browser">
      <p>Tap a member in the model, or choose one below.</p>
      <details className="sfMobileDefaults">
        <summary>Default sections</summary>
        {(["beam", "column", "brace"] as const).map((type) => (
          <FrameSectionPicker
            key={type}
            compact
            label={`Default ${type} section`}
            value={layout.defaults?.[type] ?? ""}
            model={model}
            catalogs={catalogs}
            onChange={(section) =>
              updateWithSection(
                {
                  ...layout,
                  defaults: { ...layout.defaults, [type]: section.id },
                },
                section,
              )
            }
          />
        ))}
      </details>
      <label>
        Member type
        <select
          aria-label="Browse member type"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All members</option>
          <option value="beam">Beams</option>
          <option value="column">Columns</option>
          <option value="brace">Braces</option>
        </select>
      </label>
      <ul>
        {model.members
          .filter((m) => filter === "all" || m.type === filter)
          .map((member, index) => (
            <li key={member.id}>
              <button onClick={() => pickMember(member.id)}>
                <strong>
                  {member.type} {index + 1}
                </strong>
                <span>
                  {model.sections.find((s) => s.id === member.sectionId)
                    ?.designation ?? member.sectionId}
                </span>
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
  return (
    <div
      className={`simpleFrameApp ${mobile ? "sfMobileLayout" : ""}`}
      data-panel-open={sheetOpen}
    >
      {!mobile ? catalogPanel : null}
      <main className="simpleFrameWorkspace">
        {!mobile ? setupPanel : null}
        <section className="sfCanvas">
          <header>
            <div>
              <strong>{mobile ? model.project.name : "Live model"}</strong>
              <span>
                {width.toFixed(1)} × {depth.toFixed(1)} m · {height.toFixed(1)}{" "}
                m high
              </span>
            </div>
            <div className="sfDesktopViewportTools">
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
                aria-pressed={navigationTool === "select"}
                onClick={() => setNavigationTool("select")}
              >
                Select
              </button>
              <button
                aria-pressed={navigationTool === "pan"}
                onClick={() => setNavigationTool("pan")}
              >
                Pan
              </button>
              <button
                aria-pressed={navigationTool === "orbit"}
                disabled={plan}
                onClick={() => setNavigationTool("orbit")}
              >
                Orbit
              </button>
              <button aria-label="Zoom in" onClick={() => zoomAt(0.8)}>
                +
              </button>
              <button aria-label="Zoom out" onClick={() => zoomAt(1.25)}>
                −
              </button>
              <button onClick={() => moveCamera(INITIAL_FRAME_VIEW)}>
                Fit
              </button>
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
              <button
                aria-pressed={!plan}
                onClick={() => {
                  setPlan(false);
                  moveCamera(INITIAL_FRAME_VIEW);
                }}
              >
                3D
              </button>
              <button
                aria-pressed={plan}
                onClick={() => {
                  setPlan(true);
                  setNavigationTool("select");
                  moveCamera(INITIAL_FRAME_VIEW);
                }}
              >
                Plan
              </button>
            </div>
            {mobile ? (
              <button
                className="sfMobileSave"
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
            ) : null}
          </header>
          <div
            className={mobile ? "sfMobileModelTools" : "sfDesktopDisplayHost"}
          >
            {mobile ? (
              <>
                <button
                  aria-label="Select members"
                  aria-pressed={navigationTool === "select"}
                  onClick={() => setNavigationTool("select")}
                >
                  <span aria-hidden="true">↖</span>Select
                </button>
                <button
                  aria-label="Rotate model"
                  aria-pressed={navigationTool === "orbit"}
                  disabled={plan}
                  onClick={() => setNavigationTool("orbit")}
                >
                  <span aria-hidden="true">⟳</span>Orbit
                </button>
                <button
                  aria-label="Switch model view"
                  onClick={() => {
                    setPlan(!plan);
                    setNavigationTool("select");
                    moveCamera(INITIAL_FRAME_VIEW);
                  }}
                >
                  <span aria-hidden="true">▱</span>
                  {plan ? "3D" : "Plan"}
                </button>
              </>
            ) : null}
            <FrameDisplayPanel
              dimensions={showDimensions}
              onDimensions={setShowDimensions}
              members={showMembers}
              onMembers={setShowMembers}
              dismissWhen={mobile && sheetOpen}
              onOpen={() => {
                if (mobile) setSheetOpen(false);
              }}
            />
            {mobile ? (
              <button
                aria-label="Fit model"
                onClick={() => moveCamera(INITIAL_FRAME_VIEW)}
              >
                <span aria-hidden="true">⛶</span>Fit
              </button>
            ) : null}
          </div>
          <svg
            ref={svgRef}
            viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
            data-navigation-tool={navigationTool}
            data-thick-members={display.extrudedSections}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              suppressClick.current = false;
              if (e.pointerType === "touch") {
                touchPoints.current.set(e.pointerId, {
                  x: e.clientX,
                  y: e.clientY,
                });
                if (touchPoints.current.size >= 2) {
                  for (const pointerId of touchPoints.current.keys())
                    e.currentTarget.setPointerCapture?.(pointerId);
                  const [a, b] = [...touchPoints.current.values()];
                  pinch.current = {
                    view: cameraRef.current,
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2,
                    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                  };
                  gesture.current = null;
                  suppressClick.current = true;
                  return;
                }
              }
              const kind =
                e.button === 1 ||
                e.button === 2 ||
                e.shiftKey ||
                navigationTool === "pan"
                  ? "pan"
                  : navigationTool === "orbit"
                    ? "orbit"
                    : null;
              gesture.current = {
                x: e.clientX,
                y: e.clientY,
                view: cameraRef.current,
                ...angles,
                kind,
              };
              if (kind) {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              if (
                e.pointerType === "touch" &&
                touchPoints.current.has(e.pointerId)
              ) {
                touchPoints.current.set(e.pointerId, {
                  x: e.clientX,
                  y: e.clientY,
                });
                if (pinch.current && touchPoints.current.size >= 2) {
                  const [a, b] = [...touchPoints.current.values()];
                  suppressClick.current = true;
                  moveCamera(
                    pinchFrame(
                      pinch.current.view,
                      e.currentTarget.getBoundingClientRect(),
                      pinch.current,
                      {
                        x: (a.x + b.x) / 2,
                        y: (a.y + b.y) / 2,
                        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                      },
                    ),
                  );
                  return;
                }
              }
              const start = gesture.current;
              if (!start) return;
              const dx = e.clientX - start.x,
                dy = e.clientY - start.y;
              if (Math.hypot(dx, dy) < 4) return;
              suppressClick.current = true;
              if (start.kind === "pan") {
                const bounds = e.currentTarget.getBoundingClientRect();
                const a = framePoint(start.view, bounds, start.x, start.y),
                  b = framePoint(start.view, bounds, e.clientX, e.clientY);
                moveCamera({
                  ...start.view,
                  x: start.view.x + a.x - b.x,
                  y: start.view.y + a.y - b.y,
                });
              } else if (start.kind === "orbit")
                setAngles({
                  yaw: start.yaw + dx * 0.008,
                  tilt: Math.max(0.1, Math.min(1.3, start.tilt + dy * 0.005)),
                });
            }}
            onPointerUp={(e) => {
              touchPoints.current.delete(e.pointerId);
              if (pinch.current) {
                pinch.current = null;
                suppressClick.current = true;
              }
              gesture.current = null;
              if (e.currentTarget.hasPointerCapture?.(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              touchPoints.current.clear();
              pinch.current = null;
              gesture.current = null;
              suppressClick.current = true;
            }}
            onClickCapture={(e) => {
              if (suppressClick.current || navigationTool !== "select") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedId(null);
                setEdit(null);
                if (mobile) setSheetOpen(false);
              }
            }}
            aria-label="Interactive structural frame: click dimensions to edit"
            role="group"
          >
            {display.grids &&
              xs.map((x, i) =>
                line(p(x, 0, 0), p(x, depth, 0), `gx${i}`, "sfGrid"),
              )}
            {display.grids &&
              ys.map((y, j) =>
                line(p(0, y, 0), p(width, y, 0), `gy${j}`, "sfGrid"),
              )}
            {showMembers &&
              model.members
                .filter(
                  (m) =>
                    (filter === "all" || m.type === filter) &&
                    (!plan ||
                      m.type !== "column" ||
                      m.levelId === model.levels.at(-1)?.id),
                )
                .map((member) => {
                  const a = model.nodes.find(
                      (n) => n.id === member.startNodeId,
                    )!,
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
                        pickMember(member.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          pickMember(member.id);
                        }
                      }}
                    >
                      <rect
                        className="sfMemberBounds"
                        x={Math.min(start.x, end.x) - 7}
                        y={Math.min(start.y, end.y) - 7}
                        width={Math.max(14, Math.abs(end.x - start.x) + 14)}
                        height={Math.max(14, Math.abs(end.y - start.y) + 14)}
                        fill="transparent"
                        pointerEvents="none"
                      />
                      {display.memberNumbers ? (
                        <text
                          className="sfMemberLabel"
                          x={(start.x + end.x) / 2}
                          y={(start.y + end.y) / 2 - 7}
                          textAnchor="middle"
                        >
                          {member.type} ·{" "}
                          {section?.designation ?? member.sectionId}
                        </text>
                      ) : null}
                      <title>
                        {member.type} ·{" "}
                        {section?.designation ?? member.sectionId}
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
            {(display.nodes || display.nodeNumbers) &&
              model.nodes
                .filter((n) => !plan || n.levelId === model.levels.at(-1)?.id)
                .map((node) => {
                  const q = p(
                    node.position.x,
                    node.position.y,
                    node.position.z,
                  );
                  return (
                    <g key={node.id} className="sfNodeDisplay">
                      {display.nodes ? (
                        <circle cx={q.x} cy={q.y} r={3} />
                      ) : null}
                      {display.nodeNumbers ? (
                        <text x={q.x + 5} y={q.y - 5}>
                          {node.id}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
            {display.grids &&
              xs.flatMap((x, i) =>
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
            {display.grids &&
              ys.flatMap((y, j) =>
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
            {showDimensions &&
              layout.x.map((_, i) =>
                dimension(
                  "x",
                  i,
                  { x: p(xs[i], 0, 0).x, y: p(xs[i], 0, 0).y + 80 },
                  { x: p(xs[i + 1], 0, 0).x, y: p(xs[i + 1], 0, 0).y + 80 },
                ),
              )}
            {showDimensions &&
              layout.y.map((_, j) =>
                dimension(
                  "y",
                  j,
                  { x: p(0, ys[j], 0).x - 80, y: p(0, ys[j], 0).y },
                  { x: p(0, ys[j + 1], 0).x - 80, y: p(0, ys[j + 1], 0).y },
                ),
              )}
            {showDimensions &&
              !plan &&
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
          {!mobile ? memberEditor : null}
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
          {!mobile ? (
            dimensionEditor
          ) : (
            <p className="sfTouchHint">
              Two fingers: zoom &amp; pan · Tap a member to edit
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
      {mobile ? (
        <MobileFrameSheet
          tab={mobileTab}
          open={sheetOpen}
          title={
            edit
              ? "Edit dimension"
              : mobileTab === "plan"
                ? "Plan & levels"
                : mobileTab === "project"
                  ? "Project settings"
                  : selected
                    ? "Member properties"
                    : "Members"
          }
          onClose={() => setSheetOpen(false)}
          onTab={(tab) => {
            if (tab === mobileTab && sheetOpen) {
              setSheetOpen(false);
              return;
            }
            setEdit(null);
            showPanel(tab);
          }}
        >
          {edit
            ? dimensionEditor
            : mobileTab === "plan"
              ? setupPanel
              : mobileTab === "project"
                ? catalogPanel
                : selected
                  ? memberEditor
                  : memberBrowser}
          {error ? <p role="alert">{error}</p> : null}
        </MobileFrameSheet>
      ) : null}
    </div>
  );
}
