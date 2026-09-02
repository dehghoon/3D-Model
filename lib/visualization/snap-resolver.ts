import * as THREE from "three";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";
import type { SnapPoint } from "../editor/interaction-store";

interface ScreenPointer {
  clientX: number;
  clientY: number;
}

function toThree(point: Vec3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.z, point.y);
}

function fromThree(point: THREE.Vector3): Vec3 {
  return { x: point.x, y: point.z, z: point.y };
}

function selectedElevation(model: StructuralModel, selection: EditorSelection): number {
  if (!selection) return 0;

  if (selection.type === "node") {
    return model.nodes.find((node) => node.id === selection.id)?.position.z ?? 0;
  }

  if (selection.type === "member") {
    const member = model.members.find((item) => item.id === selection.id);
    const node = member
      ? model.nodes.find((item) => item.id === member.startNodeId)
      : undefined;
    return node?.position.z ?? 0;
  }

  const surface = model.surfaces.find((item) => item.id === selection.id);
  const node = surface?.boundaryNodeIds.length
    ? model.nodes.find((item) => item.id === surface.boundaryNodeIds[0])
    : undefined;
  return node?.position.z ?? 0;
}

function screenPosition(
  point: Vec3,
  camera: THREE.Camera,
  element: HTMLElement,
): { x: number; y: number } | null {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const projected = toThree(point).project(camera);
  if (projected.z < -1 || projected.z > 1) return null;

  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - projected.y) / 2) * rect.height,
  };
}

function uniqueCandidates(model: StructuralModel): SnapPoint[] {
  const candidates = new Map<string, SnapPoint>();

  const add = (candidate: SnapPoint): void => {
    const key = [
      candidate.point.x.toFixed(9),
      candidate.point.y.toFixed(9),
      candidate.point.z.toFixed(9),
      candidate.kind,
    ].join(":");
    if (!candidates.has(key)) candidates.set(key, candidate);
  };

  for (const node of model.nodes) {
    add({
      point: { ...node.position },
      kind: "node",
      label: `Node ${node.id}`,
    });
  }

  for (const member of model.members) {
    const start = model.nodes.find((node) => node.id === member.startNodeId);
    const end = model.nodes.find((node) => node.id === member.endNodeId);
    if (!start || !end) continue;

    add({
      point: { ...start.position },
      kind: "endpoint",
      label: `Endpoint ${member.id}`,
    });
    add({
      point: { ...end.position },
      kind: "endpoint",
      label: `Endpoint ${member.id}`,
    });
    add({
      point: {
        x: (start.position.x + end.position.x) / 2,
        y: (start.position.y + end.position.y) / 2,
        z: (start.position.z + end.position.z) / 2,
      },
      kind: "midpoint",
      label: `Midpoint ${member.id}`,
    });
  }

  const verticals: Array<{ x: number; label: string }> = [];
  const horizontals: Array<{ y: number; label: string }> = [];
  const epsilon = 1e-9;

  for (const grid of model.grids) {
    const dx = Math.abs(grid.end.x - grid.start.x);
    const dy = Math.abs(grid.end.y - grid.start.y);
    if (dx < epsilon && dy > epsilon) {
      verticals.push({ x: grid.start.x, label: grid.label });
    } else if (dy < epsilon && dx > epsilon) {
      horizontals.push({ y: grid.start.y, label: grid.label });
    }
  }

  for (const vertical of verticals) {
    for (const horizontal of horizontals) {
      add({
        point: { x: vertical.x, y: horizontal.y, z: 0 },
        kind: "grid",
        label: `Grid ${vertical.label}/${horizontal.label}`,
      });
    }
  }

  return [...candidates.values()];
}

function workPlanePoint(
  pointer: ScreenPointer,
  model: StructuralModel,
  selection: EditorSelection,
  camera: THREE.Camera,
  element: HTMLElement,
): SnapPoint | null {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const ndc = new THREE.Vector2(
    ((pointer.clientX - rect.left) / rect.width) * 2 - 1,
    -((pointer.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);

  const elevation = selectedElevation(model, selection);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevation);
  const intersection = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, intersection)) return null;

  return {
    point: fromThree(intersection),
    kind: "work-plane",
    label: `Work plane ${elevation}`,
  };
}

export function resolveSnapPoint(
  pointer: ScreenPointer,
  model: StructuralModel,
  selection: EditorSelection,
  camera: THREE.Camera,
  element: HTMLElement,
  tolerancePx: number,
): SnapPoint | null {
  let best: { candidate: SnapPoint; distance: number } | null = null;

  for (const candidate of uniqueCandidates(model)) {
    const screen = screenPosition(candidate.point, camera, element);
    if (!screen) continue;
    const distance = Math.hypot(pointer.clientX - screen.x, pointer.clientY - screen.y);
    if (distance <= tolerancePx && (!best || distance < best.distance)) {
      best = { candidate, distance };
    }
  }

  return best?.candidate ?? workPlanePoint(pointer, model, selection, camera, element);
}
