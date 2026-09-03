import * as THREE from "three";
import type { EditorSelection } from "../editor/selection";
import type { ThatOpenRuntime } from "./that-open-runtime";
import { getObjectSelection } from "./core-scene-v2";
import { pickSamples } from "./mobile-picking";

function selectionKey(object: THREE.Object3D) {
  return getObjectSelection(object);
}

function pickFromItems(
  raycaster: THREE.Raycaster,
  items: THREE.Object3D[],
): EditorSelection {
  const hits = raycaster.intersectObjects(items, true);
  for (const hit of hits) {
    const selection = selectionKey(hit.object);
    if (selection) return selection;
  }
  return null;
}

export async function pickCoreThree(
  runtime: ThatOpenRuntime,
  event: PointerEvent,
): Promise<EditorSelection> {
  if (!runtime.build) return null;

  const dom = runtime.renderer.three.domElement;
  const rect = dom.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const nodes = runtime.build.pickables.filter(
    (object) => getObjectSelection(object)?.type === "node",
  );
  const others = runtime.build.pickables.filter(
    (object) => getObjectSelection(object)?.type !== "node",
 );

  const raycaster = new THREE.Raycaster();
  for (const sample of pickSamples(
    event.clientX,
    event.clientY,
    rect,
    event.pointerType,
  )) {
    const ndc = new THREE.Vector2(
      ((sample.position.x - rect.left) / rect.width) * 2 - 1,
      -((sample.position.y - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, runtime.camera.three);

    const node = pickFromItems(raycaster, nodes);
    if (node) return node;

    const other = pickFromItems(raycaster, others);
    if (other) return other;
  }

  return null;
}
