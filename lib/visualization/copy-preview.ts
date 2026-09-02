import * as THREE from "three";
import type { Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";

function matchesSelection(object: THREE.Object3D, selection: Exclude<EditorSelection, null>): boolean {
  const value = object.userData.linkoteqSelection as
    | { type?: string; id?: string }
    | undefined;
  return value?.type === selection.type && value.id === selection.id;
}

function clonePreviewMesh(source: THREE.Mesh): THREE.Mesh | null {
  const sourceMaterials = Array.isArray(source.material) ? source.material : [source.material];
  if (!sourceMaterials.length) return null;

  const visibleMaterial = sourceMaterials.some((material) => {
    const opacity = "opacity" in material ? Number(material.opacity) : 1;
    return Number.isFinite(opacity) && opacity > 0.02;
  });
  if (!visibleMaterial) return null;

  const materials = sourceMaterials.map((material) => {
    const clone = material.clone();
    clone.transparent = true;
    clone.opacity = 0.28;
    clone.depthWrite = false;
    if ("color" in clone) {
      (clone as THREE.MeshBasicMaterial).color = new THREE.Color(0x0ea5e9);
    }
    return clone;
  });

  const mesh = new THREE.Mesh(
    source.geometry.clone(),
    Array.isArray(source.material) ? materials : materials[0],
  );
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(source.matrixWorld);
  mesh.renderOrder = 90;
  return mesh;
}

export function buildCopyPreview(
  sceneRoot: THREE.Object3D,
  selection: EditorSelection,
  delta: Vec3,
): THREE.Group | null {
  if (!selection) return null;

  sceneRoot.updateMatrixWorld(true);
  const preview = new THREE.Group();
  preview.name = "linkoteq-copy-preview";

  sceneRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !matchesSelection(object, selection)) return;
    const mesh = clonePreviewMesh(object);
    if (mesh) preview.add(mesh);
  });

  if (!preview.children.length) return null;

  preview.position.set(delta.x, delta.z, delta.y);
  return preview;
}

export function disposeCopyPreview(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}
