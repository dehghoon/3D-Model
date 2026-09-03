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
import { buildBoundaryConditionSymbols } from "./boundary-condition-symbols";
import {
  applyDisplayOptionsToScene,
  buildDisplayOptionOverlays,
  disposeDisplayOptionOverlays,
} from "./display-options-scene";
import { subscribeDisplayOptions } from "./display-options-store";
import { buildRealMemberGeometry } from "./section-profile-geometry";
import {
  buildStructuralGuides,
  disposeStructuralGuides,
} from "./structural-guides";

export type { CoreSceneBuild };

const DISPLAY_UNSUBSCRIBE_KEY = "linkoteqDisplayOptionsUnsubscribe";
const DISPLAY_OVERLAY_ROOT = "core-display-overlays";

function selectionKey(selection: Exclude<EditorSelection, null>): string {
  return `${selection.type}:${selection.id}`;
}

function replaceMemberDisplayGeometry(
  build: CoreSceneBuild,
  model: StructuralModel,
): void {
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));

  for (const member of model.members) {
    const startNode = nodes.get(member.startNodeId);
    const endNode = nodes.get(member.endNodeId);
    if (!startNode || !endNode) continue;

    const start = new THREE.Vector3(
      startNode.position.x,
      startNode.position.z,
      startNode.position.y,
    );
    const end = new THREE.Vector3(
      endNode.position.x,
      endNode.position.z,
      endNode.position.y,
    );
    const geometry = buildRealMemberGeometry(model, member, start, end);
    if (!geometry) continue;

    const group = build.root.getObjectByName(`member:${member.id}`);
    if (!group) {
      geometry.dispose();
      continue;
    }

    const visible = group.children.find((child) => {
      const mesh = child as THREE.Mesh;
      return (
        mesh.isMesh &&
        mesh.material instanceof THREE.MeshStandardMaterial
      );
    }) as THREE.Mesh | undefined;

    if (!visible) {
      geometry.dispose();
      continue;
    }

    visible.geometry.dispose();
    visible.geometry = geometry;
  }
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
    if (selection.type === "surface") material.opacity = 0.72;
  });
}

function prioritizeNodePickables(build: CoreSceneBuild): void {
  const rank = (object: THREE.Object3D): number => {
    const selection = getObjectSelection(object);
    if (selection?.type === "node") return 0;
    if (selection?.type === "member") return 1;
    if (selection?.type === "surface") return 2;
    return 3;
  };

  build.pickables = build.pickables
    .map((object, index) => ({ object, index }))
    .sort((a, b) => rank(a.object) - rank(b.object) || a.index - b.index)
    .map(({ object }) => object);
}

function disposeBoundaryConditionSymbols(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else if (material instanceof THREE.Material) {
      material.dispose();
    }
  });
}

export function buildCoreScene(
  model: StructuralModel,
  selection: EditorSelection,
): CoreSceneBuild {
  const build = buildBaseCoreScene(model, selection);
  replaceMemberDisplayGeometry(build, model);
  syncMultiSelectionHighlight(build, model);
  prioritizeNodePickables(build);

  build.root.add(buildStructuralGuides(model));
  build.root.add(buildBoundaryConditionSymbols(model));
  build.root.add(buildDisplayOptionOverlays(model));
  applyDisplayOptionsToScene(build.root);

  const unsubscribe = subscribeDisplayOptions(() => {
    applyDisplayOptionsToScene(build.root);
  });
  build.root.userData[DISPLAY_UNSUBSCRIBE_KEY] = unsubscribe;

  return build;
}

export function disposeCoreScene(root: THREE.Object3D): void {
  const unsubscribe = root.userData[DISPLAY_UNSUBSCRIBE_KEY];
  if (typeof unsubscribe === "function") unsubscribe();
  delete root.userData[DISPLAY_UNSUBSCRIBE_KEY];

  const displayOverlays = root.getObjectByName(DISPLAY_OVERLAY_ROOT);
  if (displayOverlays) {
    disposeDisplayOptionOverlays(displayOverlays);
    root.remove(displayOverlays);
  }

  const boundarySymbols = root.getObjectByName(
    "core-boundary-condition-symbols",
  );
  if (boundarySymbols) {
    disposeBoundaryConditionSymbols(boundarySymbols);
    root.remove(boundarySymbols);
  }

  const guides = root.getObjectByName("linkoteq-structural-guides");
  if (guides) {
    disposeStructuralGuides(guides);
    root.remove(guides);
  }

  disposeBaseCoreScene(root);
}

export { getObjectSelection };
