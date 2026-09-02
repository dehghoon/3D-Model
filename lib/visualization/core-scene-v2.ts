import * as THREE from "three";
import type { StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";
import { getPublishedSelections } from "../editor/selection-store";
import {
  buildCoreScene as buildBaseCoreScene,
  disposeCoreScene as disposeBaseCoreScene,
  getObjectSelection,
  type CoreSceneBuild,
} from "./core-scene";
import {
  buildStructuralGuides,
  disposeStructuralGuides,
} from "./structural-guides";

export type { CoreSceneBuild };

function selectionKey(
  selection: Exclude<EditorSelection, null>,
): string {
  return `${selection.type}:${selection.id}`;
}

function syncMultiSelectionHighlight(
  build: CoreSceneBuild,
  model: StructuralModel,
): void {
  const selections = getPublishedSelections();
  if (selections.length <= 1) return;

  const selectedKeys = new Set(selections.map(selectionKey));
  build.root.traverse((object) => {
    const selection = getObjectSelection(object);
    if (!selection || !selectedKeys.has(selectionKey(selection))) return;

    const mesh = object as THREE.Mesh;
    const material = mesh.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;

    material.color.setHex(0xf97316);
    if (selection.type === "surface") {
      material.opacity = 0.72;
    }
  });
}

export function buildCoreScene(
  model: StructuralModel,
  selection: EditorSelection,
): CoreSceneBuild {
  const build = buildBaseCoreScene(model, selection);
  syncMultiSelectionHighlight(build, model);
  build.root.add(buildStructuralGuides(model));
  return build;
}

export function disposeCoreScene(root: THREE.Object3D): void {
  const guides = root.getObjectByName("linkoteq-structural-guides");
  if (guides) {
    disposeStructuralGuides(guides);
    root.remove(guides);
  }
  disposeBaseCoreScene(root);
}

export { getObjectSelection };
