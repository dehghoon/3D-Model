import * as THREE from "three";
import type { StructuralModel } from "@linkoteq/structural-core";
import {
  getDisplayOptions,
  type DisplayOptions,
} from "./display-options-store";
import { getObjectSelection } from "./core-scene";

const OVERLAY_ROOT = "core-display-overlays";
const ANALYTICAL_GROUP = "display-analytical-members";
const NODE_LABEL_GROUP = "display-node-labels";
const MEMBER_LABEL_GROUP = "display-member-labels";

function toThree(position: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(position.x, position.z, position.y);
}

function modelScale(model: StructuralModel): number {
  if (!model.nodes.length) return 0.3;
  const xs = model.nodes.map((node) => node.position.x);
  const ys = model.nodes.map((node) => node.position.y);
  const zs = model.nodes.map((node) => node.position.z);
  const span = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    Math.max(...zs) - Math.min(...zs),
    1,
  );
  return Math.min(Math.max(span * 0.025, 0.18), 0.65);
}

function makeLabel(text: string, scale: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 96;

  if (!context) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
    sprite.name = `label:${text}`;
    return sprite;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "600 34px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.94)";
  context.strokeStyle = "rgba(30,41,59,0.85)";
  context.lineWidth = 8;
  context.lineJoin = "round";
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillStyle = "#0f172a";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = `label:${text}`;
  sprite.scale.set(scale * 2.6, scale, 1);
  sprite.renderOrder = 130;
  return sprite;
}

export function buildDisplayOptionOverlays(model: StructuralModel): THREE.Group {
  const root = new THREE.Group();
  root.name = OVERLAY_ROOT;

  const analytical = new THREE.Group();
  analytical.name = ANALYTICAL_GROUP;
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x334155,
    transparent: true,
    opacity: 0.9,
  });

  const nodeLabels = new THREE.Group();
  nodeLabels.name = NODE_LABEL_GROUP;
  const memberLabels = new THREE.Group();
  memberLabels.name = MEMBER_LABEL_GROUP;

  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const labelScale = modelScale(model);

  for (const node of model.nodes) {
    const label = makeLabel(node.id, labelScale);
    label.position.copy(toThree(node.position));
    label.position.y += labelScale * 0.9;
    nodeLabels.add(label);
  }

  for (const member of model.members) {
    const start = nodes.get(member.startNodeId);
    const end = nodes.get(member.endNodeId);
    if (!start || !end) continue;

    const a = toThree(start.position);
    const b = toThree(end.position);
    const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geometry, lineMaterial);
    line.name = `analytical-member:${member.id}`;
    analytical.add(line);

    const label = makeLabel(member.id, labelScale);
    label.position.copy(a.clone().lerp(b, 0.5));
    label.position.y += labelScale * 0.85;
    memberLabels.add(label);
  }

  root.add(analytical, nodeLabels, memberLabels);
  return root;
}

export function applyDisplayOptionsToScene(
  root: THREE.Object3D,
  options: DisplayOptions = getDisplayOptions(),
): void {
  const analytical = root.getObjectByName(ANALYTICAL_GROUP);
  if (analytical) analytical.visible = !options.extrudedSections;

  const nodeLabels = root.getObjectByName(NODE_LABEL_GROUP);
  if (nodeLabels) nodeLabels.visible = options.nodeNumbers;

  const memberLabels = root.getObjectByName(MEMBER_LABEL_GROUP);
  if (memberLabels) memberLabels.visible = options.memberNumbers;

  const grids = root.getObjectByName("core-grids");
  if (grids) grids.visible = options.grids;

  const guides = root.getObjectByName("linkoteq-structural-guides");
  if (guides) guides.visible = options.grids;

  root.traverse((object) => {
    if (object.name.startsWith("support-symbol:")) {
      object.visible = options.supports;
      return;
    }
    if (object.name.startsWith("release-symbol:")) {
      object.visible = options.releases;
      return;
    }

    const selection = getObjectSelection(object);
    if (!selection) return;

    const mesh = object as THREE.Mesh;
    const material = mesh.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;

    if (selection.type === "member") {
      object.visible = options.extrudedSections;
    } else if (selection.type === "node") {
      object.visible = options.nodes;
    } else if (selection.type === "surface") {
      object.visible = options.surfaces;
    }
  });
}

export function disposeDisplayOptionOverlays(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();

    const material = mesh.material;
    const materials = Array.isArray(material)
      ? material
      : material
        ? [material]
        : [];
    for (const item of materials) {
      const spriteMaterial = item as THREE.SpriteMaterial;
      spriteMaterial.map?.dispose();
      item.dispose();
    }
  });
}
