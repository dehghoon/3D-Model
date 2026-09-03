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

// NOTE: The remaining runtime exports are unchanged from the current main branch.
