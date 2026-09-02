"use client";

import { useEffect, useRef, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "../lib/editor/selection";
import {
  getPublishedSelections,
  publishSelections,
} from "../lib/editor/selection-store";
import {
  cancelInteraction,
  finishCopyInteraction,
  getInteractionState,
  setCopyBase,
  setCopyPreview,
  useInteractionState,
} from "../lib/editor/interaction-store";
import { isTapGesture } from "../lib/visualization/mobile-picking";
import {
  selectMembersInWindow,
  type SelectionWindow,
} from "../lib/visualization/selection-window";
import {
  clearTransformPreview,
  createThatOpenRuntime,
  deltaBetween,
  disposeThatOpenRuntime,
  pickThatOpen,
  rebuildThatOpenScene,
  renderTransformPreview,
  setThatOpenView,
  snapThatOpen,
  stepThatOpenAxis,
  stepThatOpenLevel,
  type ThatOpenRuntime,
  type ViewMode,
} from "../lib/visualization/that-open-runtime";

interface Props {
  model: StructuralModel;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onMultiSelect?: (
    selections: Array<Exclude<EditorSelection, null>>,
  ) => void;
}

interface PointerStart {
  x: number;
  y: number;
  pointerType: string;
  pointerId: number;
}

const viewButtons: Array<[ViewMode, string, string]> = [
  ["front", "F", "Front"],
  ["left", "L", "Left"],
  ["right", "R", "Right"],
  ["bottom", "B", "Bottom"],
  ["3d", "3D", "3D"],
];

export default function ThatOpenViewportV07({
  model,
  selection,
  onSelect,
  onMultiSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ThatOpenRuntime | null>(null);
  const modelRef = useRef(model);
  const selectionRef = useRef(selection);
  const onSelectRef = useRef(onSelect);
  const onMultiSelectRef = useRef(onMultiSelect);
  const toolModeRef = useRef<"select" | "view">("select");

  const interaction = useInteractionState();
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [toolMode, setToolMode] = useState<"select" | "view">("select");
  const [marquee, setMarquee] = useState<SelectionWindow | null>(null);
  const [selectionCount, setSelectionCount] = useState(0);

  modelRef.current = model;
  selectionRef.current = selection;
  onSelectRef.current = onSelect;
  onMultiSelectRef.current = onMultiSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const runtime = createThatOpenRuntime(container);
    runtimeRef.current = runtime;
    runtime.camera.controls.enabled = false;
    const canvas = runtime.renderer.three.domElement;
    let start: PointerStart | null = null;

    const resolveSnap = (event: PointerEvent) =>
      snapThatOpen(runtime, event, modelRef.current, selectionRef.current);

    const pointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      start = {
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
        pointerId: event.pointerId,
      };
    };

    const pointerMove = (event: PointerEvent) => {
      const state = getInteractionState();

      if (state.mode === "copy-target") {
        setCopyPreview(resolveSnap(event));
        renderTransformPreview(runtime);
        return;
      }

      if (
        !start ||
        toolModeRef.current !== "select" ||
        runtime.camera.controls.enabled ||
        state.mode !== "select"
      ) {
        return;
      }

      const distance = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      const threshold = start.pointerType === "touch" ? 14 : 6;
      if (distance < threshold) return;

      setMarquee({
        start: { x: start.x, y: start.y },
        end: { x: event.clientX, y: event.clientY },
      });
    };

    const pointerUp = async (event: PointerEvent) => {
      const origin = start;
      start = null;
      if (!origin || origin.pointerId !== event.pointerId) return;

      const state = getInteractionState();

      if (state.mode === "copy-base") {
        const point = resolveSnap(event);
        if (!point) return;
        setCopyBase(point);
        setCopyPreview(point);
        renderTransformPreview(runtime);
        return;
      }

      if (state.mode === "copy-target") {
        const point = resolveSnap(event);
        if (!point || !state.base) return;

        setCopyPreview(point);
        const delta = deltaBetween(state.base.point, point.point);
        if (
          Math.abs(delta.x) +
            Math.abs(delta.y) +
            Math.abs(delta.z) <=
          1e-10
        ) {
          return;
        }

        window.dispatchEvent(
          new CustomEvent("linkoteq:copy-commit", {
            detail: { delta },
          }),
        );
        finishCopyInteraction();
        clearTransformPreview(runtime);
        return;
      }

      if (
        toolModeRef.current === "view" ||
        runtime.camera.controls.enabled
      ) {
        setMarquee(null);
        return;
      }

      const distance = Math.hypot(
        event.clientX - origin.x,
        event.clientY - origin.y,
      );
      const threshold = origin.pointerType === "touch" ? 14 : 6;

      if (distance >= threshold) {
        const windowSelection: SelectionWindow = {
          start: { x: origin.x, y: origin.y },
          end: { x: event.clientX, y: event.clientY },
        };

        const selected = selectMembersInWindow(
          modelRef.current,
          runtime.camera.three,
          canvas.getBoundingClientRect(),
          windowSelection,
        );

        const combined = event.shiftKey
          ? [...getPublishedSelections(), ...selected]
          : selected;

        const unique = Array.from(
          new Map(
            combined.map((item) => [
              `${item.type}:${item.id}`,
              item,
            ]),
          ).values(),
        );

        if (onMultiSelectRef.current) {
          onMultiSelectRef.current(unique);
        } else {
          publishSelections(unique);
          onSelectRef.current(unique.at(-1) ?? null);
        }

        setSelectionCount(unique.length);
        setMarquee(null);
        return;
      }

      if (
        !isTapGesture(
          origin.x,
          origin.y,
          event.clientX,
          event.clientY,
          origin.pointerType,
        )
      ) {
        return;
      }

      const picked = await pickThatOpen(runtime, event);
      onSelectRef.current(picked);
      setSelectionCount(picked ? 1 : 0);
      setMarquee(null);
    };

    const pointerCancel = () => {
      start = null;
      setMarquee(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelInteraction();
      clearTransformPreview(runtime);
      setMarquee(null);
    };

    const enableSelect = () => {
      toolModeRef.current = "select";
      runtime.camera.controls.enabled = false;
      setToolMode("select");
    };

    const enableView = () => {
      toolModeRef.current = "view";
      runtime.camera.controls.enabled = true;
      setToolMode("view");
    };

    canvas.addEventListener("pointerdown", pointerDown, { passive: true });
    canvas.addEventListener("pointermove", pointerMove, { passive: true });
    canvas.addEventListener("pointerup", pointerUp, { passive: true });
    canvas.addEventListener("pointercancel", pointerCancel, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("linkoteq:view-select", enableSelect);
    window.addEventListener("linkoteq:view-cycle", enableView);

    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("linkoteq:view-select", enableSelect);
      window.removeEventListener("linkoteq:view-cycle", enableView);
      disposeThatOpenRuntime(runtime);
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    rebuildThatOpenScene(runtime, model, selection);
    renderTransformPreview(runtime);
  }, [model, selection]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    const shouldEnableCamera =
      interaction.mode === "select" && toolMode === "view";

    toolModeRef.current = toolMode;
    runtime.camera.controls.enabled = shouldEnableCamera;

    if (interaction.mode === "copy-target") {
      renderTransformPreview(runtime);
    } else {
      clearTransformPreview(runtime);
    }
  }, [
    interaction.mode,
    interaction.base,
   interaction.preview,
   interaction.operation,
   toolMode,
  ]);

  const chooseView = (mode: ViewMode) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    setThatOpenView(runtime, mode);
    setViewMode(mode);
  };

  return (
    <div
      ref={containerRef}
      className="thatOpenViewport"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
      }}
      aria-label="That Open structural viewport"
    >
      <div
        className="viewportViewTools"
        aria-label="View orientation"
      >
        {viewButtons.map(([mode, icon, label]) => (
          <button
            key={mode}
            type="button"
            className={viewMode === mode ? "active" : ""}
            title={`${label} view`}
            aria-label={`${label} view`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => chooseView(mode)}
          >
            {icon}
          </button>
        ))}
      </div>

      {viewMode !== "3d" ? (
        <div
          className="viewportReferenceNavigator"
          aria-label="Reference navigation"
        >
          <button
            type="button"
            title="Previous axis"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              runtimeRef.current &&
              stepThatOpenAxis(
                runtimeRef.current,
                modelRef.current,
                -1,
              )
            }
          >
            ←
          </button>
          <span>Axis</span>
          <button
            type="button"
            title="Next axis"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              runtimeRef.current &&
              stepThatOpenAxis(
                runtimeRef.current,
                modelRef.current,
                1,
              )
            }
          >
            →
          </button>

          <button
            type="button"
            title="Previous level"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              runtimeRef.current &&
              stepThatOpenLevel(
                runtimeRef.current,
                modelRef.current,
                -1,
              )
            }
          >
            ↓
          </button>
          <span>Level</span>
          <button
            type="button"
            title="Next level"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              runtimeRef.current &&
              stepThatOpenLevel(
                runtimeRef.current,
                modelRef.current,
                1,
              )
            }
          >
            ↑
          </button>
        </div>
      ) : null}

      {marquee ? (
        <div
          className={`viewportSelectionWindow ${
            marquee.end.x < marquee.start.x
              ? "crossing"
              : "contained"
          }`}
          style={{
            left: Math.min(marquee.start.x, marquee.end.x),
            top: Math.min(marquee.start.y, marquee.end.y),
            width: Math.abs(marquee.end.x - marquee.start.x),
            height: Math.abs(marquee.end.y - marquee.start.y),
          }}
          aria-hidden="true"
        />
      ) : null}

      <div className="viewportInteractionStatus">
        {interaction.mode === "select"
          ? toolMode === "select"
            ? `Select · Tap or drag window${
                selectionCount > 1
                  ? ` · ${selectionCount} selected`
                  : ""
              }`
            : "View · Orbit / Pan / Zoom"
          : interaction.message}
        {interaction.preview
          ? ` · ${interaction.preview.label}`
          : ""}
      </div>
    </div>
  );
}
