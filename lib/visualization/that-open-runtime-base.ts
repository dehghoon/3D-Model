import * as OBC from "@thatopen/components";
import * as THREE from "three";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";
import { getInteractionState } from "../editor/interaction-store";
import { buildCoreScene, disposeCoreScene, getObjectSelection, type CoreSceneBuild } from "./core-scene-v2";
import { buildCopyPreview, disposeCopyPreview } from "./copy-preview";
import { pickSamples } from "./mobile-picking";
import { resolveSnapPoint } from "./snap-resolver";
export type ViewMode = "3d" | "front" | "left" | "right" | "bottom";

export interface ThatOpenRuntime {
  components: OBC.Components;
  scene: THREE.Scene;
  camera: OBC.OrthoPerspectiveCamera;
  caster: OBC.SimpleRaycaster;
  renderer: OBC.SimpleRenderer;
  build: CoreSceneBuild | null;
  transient: THREE.Group | null;
  fitted: boolean;
  viewMode: ViewMode;
  axisIndex: number;
  levelIndex: number;
}
function box(runtime: ThatOpenRuntime): THREE.Box3 | null {
  if (!runtime.build) return null;
  const value = new THREE.Box3().setFromObject(runtime.build.root);
  return value.isEmpty() ? null : value;
}

function frame(runtime: ThatOpenRuntime) {
  const bounds = box(runtime);
  if (!bounds) return null;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  return { center, distance: Math.max(Math.max(size.x, size.y, size.z, 8) * 1.8, 14) };
}
export function createThatOpenRuntime(container: HTMLDivElement): ThatOpenRuntime {
  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = new THREE.Color(0xf8fafc);
  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.OrthoPerspectiveCamera(components);
  components.init();
  world.camera.updateAspect();
  const caster = components.get(OBC.Raycasters).get(world);
  world.renderer.three.domElement.style.touchAction = "none";
  return {
    components,
    scene: world.scene.three,
    camera: world.camera,
    caster,
    renderer: world.renderer,
    build: null,
    transient: null,
    fitted: false,
    viewMode: "3d",
    axisIndex: 0,
    levelIndex: 0,
  };
}
export function rebuildThatOpenScene(
  runtime: ThatOpenRuntime,
  model: StructuralModel,
  selection: EditorSelection,
): void {
  clearTransformPreview(runtime);
  if (runtime.build) {
    runtime.scene.remove(runtime.build.root);
    disposeCoreScene(runtime.build.root);
  }
  runtime.build = buildCoreScene(model, selection);
  runtime.scene.add(runtime.build.root);
  if (!runtime.fitted && (model.nodes.length || model.members.length || model.surfaces.length || model.grids.length || model.levels.length)) {
    setThatOpenView(runtime, "3d");
    runtime.fitted = true;
  }
}
export function setThatOpenView(runtime: ThatOpenRuntime, mode: ViewMode): void {
  const data = frame(runtime);
  if (!data) return;
  const { center, distance } = data;
  runtime.viewMode = mode;
  runtime.axisIndex = 0;
  runtime.levelIndex = 0;
  runtime.camera.three.up.set(0, mode === "bottom" ? 0 : 1, mode === "bottom" ? 1 : 0);
  const offset =
    mode === "3d" ? new THREE.Vector3(distance, distance * 0.72, distance) :
    mode === "front" ? new THREE.Vector3(0, 0, distance) :
    mode === "left" ? new THREE.Vector3(-distance, 0, 0) :
    mode === "right" ? new THREE.Vector3(distance, 0, 0) :
    new THREE.Vector3(0.001, -distance, 0.001);
  void runtime.camera.controls.setLookAt(
    center.x + offset.x, center.y + offset.y, center.z + offset.z,
    center.x, center.y, center.z, true,
  );
}
function gridOffsets(model: StructuralModel, axis: "x" | "y"): number[] {
  const eps = 1e-9;
  const values = model.grids.flatMap((grid) => {
    const dx = Math.abs(grid.end.x - grid.start.x);
    const dy = Math.abs(grid.end.y - grid.start.y);
    if (axis === "x" && dx < eps && dy > eps) return [grid.start.x];
    if (axis === "y" && dy < eps && dx > eps) return [grid.start.y];
    return [];
  });
  return [...new Set(values.map((value) => Number(value.toFixed(9))))].sort((a, b) => a - b);
}
export function stepThatOpenAxis(runtime: ThatOpenRuntime, model: StructuralModel, step: -1 | 1): void {
  if (runtime.viewMode === "3d") return;
  const axis = runtime.viewMode === "left" || runtime.viewMode === "right" ? "y" : "x";
  const offsets = gridOffsets(model, axis);
  if (!offsets.length) return;
  runtime.axisIndex = (runtime.axisIndex + step + offsets.length) % offsets.length;
  const target = runtime.camera.controls.getTarget(new THREE.Vector3());
  const position = runtime.camera.three.position.clone();
  const next = offsets[runtime.axisIndex];
  const delta = axis === "x" ? next - target.x : next - target.z;
  if (axis === "x") { target.x = next; position.x += delta; }
  else { target.z = next; position.z += delta; }
  void runtime.camera.controls.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, true);
}
export function stepThatOpenLevel(runtime: ThatOpenRuntime, model: StructuralModel, step: -1 | 1): void {
  if (runtime.viewMode === "3d" || !model.levels.length) return;
  const levels = [...model.levels].sort((a, b) => a.elevation - b.elevation);
  runtime.levelIndex = (runtime.levelIndex + step + levels.length) % levels.length;
  const target = runtime.camera.controls.getTarget(new THREE.Vector3());
  const position = runtime.camera.three.position.clone();
  const elevation = levels[runtime.levelIndex].elevation;
  position.y += elevation - target.y;
  target.y = elevation;
  void runtime.camera.controls.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, true);
}
export async function pickThatOpen(
  runtime: ThatOpenRuntime,
  event: PointerEvent,
): Promise<EditorSelection> {
  if (!runtime.build) return null;
  const rect = runtime.renderer.three.domElement.getBoundingClientRect();
  for (const sample of pickSamples(event.clientX, event.clientY, rect, event.pointerType)) {
    const hit = await runtime.caster.castRay({ items: runtime.build.pickables, position: sample.position });
    if (!hit) continue;
    const selected = getObjectSelection(hit.object);
    if (selected) return selected;
  }
  return null;
}
export function snapThatOpen(
  runtime: ThatOpenRuntime,
  event: PointerEvent,
  model: StructuralModel,
  selection: EditorSelection,
) {
  const state = getInteractionState();
  return resolveSnapPoint(
    { clientX: event.clientX, clientY: event.clientY },
    model,
    state.selection ?? selection,
    runtime.camera.three,
    runtime.renderer.three.domElement,
    event.pointerType === "touch" ? 30 : 13,
  );
}
export function deltaBetween(base: Vec3, target: Vec3): Vec3 {
  return { x: target.x - base.x, y: target.y - base.y, z: target.z - base.z };
}

export function clearTransformPreview(runtime: ThatOpenRuntime): void {
  if (!runtime.transient) return;
  runtime.scene.remove(runtime.transient);
  disposeCopyPreview(runtime.transient);
  runtime.transient = null;
}
export function renderTransformPreview(runtime: ThatOpenRuntime): void {
  clearTransformPreview(runtime);
  const state = getInteractionState();
  if (state.mode !== "copy-target" || !state.selection || !state.base || !state.preview || !runtime.build) return;
  const delta = deltaBetween(state.base.point, state.preview.point);
  const group = new THREE.Group();
  if (Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z) > 1e-10) {
    const ghost = buildCopyPreview(runtime.build.root, state.selection, delta);
    if (ghost) group.add(ghost);
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(state.base.point.x, state.base.point.z, state.base.point.y),
      new THREE.Vector3(state.preview.point.x, state.preview.point.z, state.preview.point.y),
    ]),
    new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.85, depthTest: false }),
  );
  group.add(line);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0x0ea5e9, depthTest: false, depthWrite: false }),
  );
  marker.position.set(state.preview.point.x, state.preview.point.z, state.preview.point.y);
  group.add(marker);
  runtime.scene.add(group);
  runtime.transient = group;
}
export function disposeThatOpenRuntime(runtime: ThatOpenRuntime): void {
  clearTransformPreview(runtime);
  if (runtime.build) {
    runtime.scene.remove(runtime.build.root);
    disposeCoreScene(runtime.build.root);
  }
  runtime.components.dispose();
}
