import * as THREE from "three";
import type { StructuralModel } from "@linkoteq/structural-core";

interface PlanBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function planBounds(model: StructuralModel): PlanBounds {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const grid of model.grids) {
    xs.push(grid.start.x, grid.end.x);
    ys.push(grid.start.y, grid.end.y);
  }

  for (const node of model.nodes) {
    xs.push(node.position.x);
    ys.push(node.position.y);
  }

  if (!xs.length || !ys.length) {
    return { minX: -5, maxX: 5, minY: -5, maxY: 5 };
  }

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function makeLabelSprite(
  text: string,
  options: {
    bubble?: boolean;
    fontSize?: number;
    foreground?: string;
    background?: string;
    scale?: number;
  } = {},
): THREE.Sprite {
  const {
    bubble = false,
    fontSize = 34,
    foreground = "#1f2937",
    background = "rgba(255,255,255,0.94)",
    scale = 0.75,
  } = options;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_2D_CONTEXT_UNAVAILABLE");

  const padding = bubble ? 18 : 16;
  context.font = `600 ${fontSize}px Arial, sans-serif`;
  const metrics = context.measureText(text);
  const contentWidth = Math.ceil(metrics.width);
  const diameter = Math.max(fontSize + padding * 2, contentWidth + padding * 2);

  canvas.width = bubble ? diameter : Math.max(96, contentWidth + padding * 2);
  canvas.height = bubble ? diameter : fontSize + padding * 2;

  context.clearRect(0, 0, canvas.width, canvas.height);

  if (bubble) {
    context.fillStyle = background;
    context.strokeStyle = "#64748b";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 3, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    const radius = 9;
    context.fillStyle = background;
    context.beginPath();
    context.roundRect(1, 1, canvas.width - 2, canvas.height - 2, radius);
    context.fill();
  }

  context.fillStyle = foreground;
  context.font = `600 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(scale * aspect, scale, 1);
  sprite.renderOrder = 100;
  return sprite;
}

function buildGridLabels(model: StructuralModel): THREE.Group {
  const group = new THREE.Group();
  group.name = "core-grid-labels";

  for (const grid of model.grids) {
    const start = makeLabelSprite(grid.label, { bubble: true, scale: 0.62 });
    start.position.set(grid.start.x, 0.08, grid.start.y);
    group.add(start);

    const end = makeLabelSprite(grid.label, { bubble: true, scale: 0.62 });
    end.position.set(grid.end.x, 0.08, grid.end.y);
    group.add(end);
  }

  return group;
}

function buildLevels(model: StructuralModel): THREE.Group {
  const group = new THREE.Group();
  group.name = "core-level-guides";

  if (!model.levels.length) return group;

  const bounds = planBounds(model);
  const margin = 1.5;
  const minX = bounds.minX - margin;
  const maxX = bounds.maxX + margin;
  const minY = bounds.minY - margin;
  const maxY = bounds.maxY + margin;
  const width = Math.max(maxX - minX, 4);
  const depth = Math.max(maxY - minY, 4);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  for (const level of model.levels) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.035,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(centerX, level.elevation, centerY);
    plane.name = `level-plane:${level.id}`;
    group.add(plane);

    const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(minX, level.elevation + 0.015, minY),
      new THREE.Vector3(maxX, level.elevation + 0.015, minY),
      new THREE.Vector3(maxX, level.elevation + 0.015, maxY),
      new THREE.Vector3(minX, level.elevation + 0.015, maxY),
      new THREE.Vector3(minX, level.elevation + 0.015, minY),
    ]);
    const outline = new THREE.Line(
      outlineGeometry,
      new THREE.LineBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.42,
      }),
    );
    outline.name = `level-outline:${level.id}`;
    group.add(outline);

    const label = makeLabelSprite(`${level.name}  ${level.elevation}`, {
      fontSize: 30,
      scale: 0.7,
      background: "rgba(239,246,255,0.94)",
      foreground: "#1d4ed8",
    });
    label.position.set(minX, level.elevation + 0.18, minY);
    label.name = `level-label:${level.id}`;
    group.add(label);
  }

  return group;
}

export function buildStructuralGuides(model: StructuralModel): THREE.Group {
  const root = new THREE.Group();
  root.name = "linkoteq-structural-guides";
  root.add(buildGridLabels(model));
  root.add(buildLevels(model));
  return root;
}

export function disposeStructuralGuides(root: THREE.Object3D): void {
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];

    for (const material of materials) {
      const map = (material as THREE.SpriteMaterial).map;
      if (map && !disposedTextures.has(map)) {
        map.dispose();
        disposedTextures.add(map);
      }
      if (!disposedMaterials.has(material)) {
        material.dispose();
        disposedMaterials.add(material);
      }
    }
  });
}
