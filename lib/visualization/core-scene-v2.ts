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
import { buildRealMemberGeometry } from "./section-profile-geometry";
import {
  buildStructuralGuides,
  disposeStructuralGuides,
} from "./structural-guides";

export type { CoreSceneBuild };

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
    if (selection.type === "surface") {
      material.opacity = 0.72;
    }
  });
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
  build.root.add(buildStructuralGuides(model));
  build.root.add(buildBoundaryConditionSymbols(model));
  return build;
}

export function disposeCoreScene(root: THREE.Object3D): void {
  const boundarySymbols = root.getObjectByName("core-boundary-condition-symbols");
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
