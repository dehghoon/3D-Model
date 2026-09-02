import * as THREE from "three";
import type { StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";
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

export function buildCoreScene(
  model: StructuralModel,
  selection: EditorSelection,
): CoreSceneBuild {
  const build = buildBaseCoreScene(model, selection);
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
