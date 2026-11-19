import * as THREE from "three";
import type { GridLine, StructuralModel } from "@linkoteq/structural-core";

import * as Base from "./that-open-runtime-base";

export {
  clearTransformPreview,
  deltaBetween,
  pickThatOpen,
  rebuildThatOpenScene,
  renderTransformPreview,
  renderModelingPreview,
  snapThatOpen,
} from "./that-open-runtime-base";

export type ThatOpenRuntime = Base.ThatOpenRuntime;
export type ViewMode = Base.ViewMode;

export interface ReferenceStatus {
  kind: "view" | "grid" | "level";
  label: string;
}

interface RuntimeObservers {
  resize?: ResizeObserver;
  shell?: MutationObserver;
  frameId?: number;
}

const runtimeObservers = new WeakMap<ThatOpenRuntime, RuntimeObservers>();
const viewRequests = new WeakMap<ThatOpenRuntime, object>();

function emitReferenceStatus(status: ReferenceStatus): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ReferenceStatus>("linkoteq:reference-status", {
      detail: status,
    }),
  );
}

function frame(runtime: ThatOpenRuntime) {
  if (!runtime.build) return null;
  const bounds = (runtime.build.root.userData.sapFitBounds as THREE.Box3 | undefined) ?? new THREE.Box3().setFromObject(runtime.build.root);
  if (bounds.isEmpty()) return null;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const distance = Math.max(Math.max(size.x, size.y, size.z, 8) * 1.8, 14);
  return { center, distance, bounds };
}

function scheduleViewportRefresh(runtime: ThatOpenRuntime): void {
  const observers = runtimeObservers.get(runtime) ?? {};
  if (observers.frameId !== undefined) {
    cancelAnimationFrame(observers.frameId);
  }

  observers.frameId = requestAnimationFrame(() => {
    runtime.renderer.resize();
    runtime.camera.updateAspect();

    const bounds = runtime.build?.root.userData.sapFitBounds as THREE.Box3 | undefined;
    if (runtime.viewMode === "3d" && bounds && !bounds.isEmpty()) {
      void runtime.camera.controls.fitToSphere(bounds.getBoundingSphere(new THREE.Sphere()),false);
    }
  });

  runtimeObservers.set(runtime, observers);
}

export function createThatOpenRuntime(
  container: HTMLDivElement,
): ThatOpenRuntime {
  const runtime = Base.createThatOpenRuntime(container);
  const observers: RuntimeObservers = {};

  if (typeof ResizeObserver !== "undefined") {
    let previousWidth = Math.round(container.clientWidth);
    let previousHeight = Math.round(container.clientHeight);

    observers.resize = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      const width = Math.round(rect?.width ?? container.clientWidth);
      const height = Math.round(rect?.height ?? container.clientHeight);

      if (width <= 0 || height <= 0) return;
      if (width === previousWidth && height === previousHeight) return;

      previousWidth = width;
      previousHeight = height;
      scheduleViewportRefresh(runtime);
    });
    observers.resize.observe(container);
  }

  if (typeof MutationObserver !== "undefined") {
    const shell = container.closest(".architectEditorShell");
    if (shell) {
      observers.shell = new MutationObserver(() => {
        scheduleViewportRefresh(runtime);
      });
      observers.shell.observe(shell, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  }

  runtimeObservers.set(runtime, observers);
  return runtime;
}

export function disposeThatOpenRuntime(runtime: ThatOpenRuntime): void {
  const observers = runtimeObservers.get(runtime);
  if (observers?.resize) observers.resize.disconnect();
  if (observers?.shell) observers.shell.disconnect();
  if (observers?.frameId !== undefined) {
    cancelAnimationFrame(observers.frameId);
  }
  runtimeObservers.delete(runtime);
  Base.disposeThatOpenRuntime(runtime);
}

export async function setThatOpenView(
  runtime: ThatOpenRuntime,
  mode: ViewMode,
  model?: StructuralModel,
): Promise<void> {
  const modelBounds = model?.nodes.length ? new THREE.Box3() : null;
  if (modelBounds && model) {
    const point = new THREE.Vector3();
    for (const { position } of model.nodes) modelBounds.expandByPoint(point.set(position.x, position.z, position.y));
  }
  const data = modelBounds ? {
    bounds: modelBounds,
    center: modelBounds.getCenter(new THREE.Vector3()),
    distance: Math.max(modelBounds.getSize(new THREE.Vector3()).length() * 1.8, 14),
  } : frame(runtime);
  if (!data) return;

  const { center, distance, bounds } = data;
  const request = {};
  viewRequests.set(runtime, request);
  runtime.viewMode = mode;
  runtime.camera.controls.stop();
  await runtime.camera.projection.set(mode === "3d" ? "Perspective" : "Orthographic");
  if (viewRequests.get(runtime) !== request) return;

  const offset = {
    "3d": [1, 0.72, 1],
    front: [0, 0, 1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    bottom: [0, -1, 0],
    top: [0, 1, 0],
  }[mode];
  if (mode === "top" || mode === "bottom") runtime.camera.three.up.set(0, 0, mode === "top" ? -1 : 1);
  else runtime.camera.three.up.set(0, 1, 0);
  runtime.camera.controls.updateCameraUp();
  await runtime.camera.controls.setLookAt(
    center.x + offset[0] * distance, center.y + offset[1] * distance, center.z + offset[2] * distance,
    center.x, center.y, center.z, false,
  );
  if (viewRequests.get(runtime) !== request) return;
  await runtime.camera.controls.fitToBox(bounds, false, { paddingTop: 0.8, paddingBottom: 0.8, paddingLeft: 0.8, paddingRight: 0.8 });
  if (viewRequests.get(runtime) !== request) return;
  emitReferenceStatus({ kind: "view", label: mode === "3d" ? "3D" : mode === "top" ? "Plan" : mode[0].toUpperCase() + mode.slice(1) });
}

function gridCoordinate(
  grid: GridLine,
  axis: "x" | "y",
): number | null {
  const epsilon = 1e-9;
  const dx = Math.abs(grid.end.x - grid.start.x);
  const dy = Math.abs(grid.end.y - grid.start.y);

  if (axis === "x" && dx < epsilon && dy > epsilon) return grid.start.x;
  if (axis === "y" && dy < epsilon && dx > epsilon) return grid.start.y;
  return null;
}

function sortedGrids(
  model: StructuralModel,
  axis: "x" | "y",
): GridLine[] {
  return model.grids
    .map((grid) => ({ grid, coordinate: gridCoordinate(grid, axis) }))
    .filter(
      (
        entry,
      ): entry is { grid: GridLine; coordinate: number } =>
        entry.coordinate !== null,
    )
    .sort((a, b) => a.coordinate - b.coordinate)
    .map((entry) => entry.grid);
}

export function stepThatOpenAxis(
  runtime: ThatOpenRuntime,
  model: StructuralModel,
  step: -1 | 1,
): void {
  if (runtime.viewMode === "3d") return;

  const axis = runtime.viewMode === "left" ? "y" : "x";
  const grids = sortedGrids(model, axis);
  if (!grids.length) return;

  runtime.axisIndex =
    (runtime.axisIndex + step + grids.length) % grids.length;

  const grid = grids[runtime.axisIndex];
  const next = gridCoordinate(grid, axis);
  if (next === null) return;

  const target = runtime.camera.controls.getTarget(
    new THREE.Vector3(),
  );
  const position = runtime.camera.three.position.clone();

  if (axis === "x") {
    const delta = next - target.x;
    target.x = next;
    position.x += delta;
  } else {
    const delta = next - target.z;
    target.z = next;
    position.z += delta;
  }

  void runtime.camera.controls.setLookAt(
    position.x,
    position.y,
    position.z,
    target.x,
    target.y,
    target.z,
    true,
  );

  emitReferenceStatus({
    kind: "grid",
    label: `Grid ${grid.label}`,
  });
}

export function stepThatOpenLevel(
  runtime: ThatOpenRuntime,
  model: StructuralModel,
  step: -1 | 1,
): void {
  if (runtime.viewMode === "3d" || !model.levels.length) return;

  const levels = [...model.levels].sort(
    (a, b) => a.elevation - b.elevation,
  );
  runtime.levelIndex =
    (runtime.levelIndex + step + levels.length) % levels.length;

  const level = levels[runtime.levelIndex];
  const target = runtime.camera.controls.getTarget(
    new THREE.Vector3(),
  );
  const position = runtime.camera.three.position.clone();
  const delta = level.elevation - target.y;

  target.y = level.elevation;
  position.y += delta;

  void runtime.camera.controls.setLookAt(
    position.x,
    position.y,
    position.z,
    target.x,
    target.y,
    target.z,
    true,
  );

  emitReferenceStatus({
    kind: "level",
    label: `${level.name} · ${level.elevation}`,
  });
}

