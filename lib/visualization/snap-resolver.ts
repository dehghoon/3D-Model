import * as THREE from "three";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";
import { getSnapSettings } from "../editor/snap-settings";
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

function memberPoints(model: StructuralModel): Array<{
  memberId: string;
  start: Vec3;
  end: Vec3;
}> {
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  return model.members.flatMap((member) => {
    const start = nodes.get(member.startNodeId);
    const end = nodes.get(member.endNodeId);
    return start && end
      ? [{ memberId: member.id, start: start.position, end: end.position }]
      : [];
  });
}

function uniqueCandidates(model: StructuralModel): SnapPoint[] {
  const settings = getSnapSettings();
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

  if (settings.node) {
    for (const node of model.nodes) {
      add({
        point: { ...node.position },
        kind: "node",
        label: `Node ${node.id}`,
      });
    }
  }

  for (const member of memberPoints(model)) {
    if (settings.endpoint) {
      add({
        point: { ...member.start },
        kind: "endpoint",
        label: `Endpoint ${member.memberId}`,
      });
      add({
        point: { ...member.end },
        kind: "endpoint",
        label: `Endpoint ${member.memberId}`,
      });
    }

    if (settings.midpoint) {
      add({
        point: {
          x: (member.start.x + member.end.x) / 2,
          y: (member.start.y + member.end.y) / 2,
          z: (member.start.z + member.end.z) / 2,
        },
        kind: "midpoint",
        label: `Midpoint ${member.memberId}`,
      });
    }
  }

  if (settings.grid) {
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
  }

  return [...candidates.values()];
}

function perpendicularCandidates(model: StructuralModel, cursor: Vec3): SnapPoint[] {
  if (!getSnapSettings().perpendicular) return [];

  return memberPoints(model).flatMap((member) => {
    const a = new THREE.Vector3(member.start.x, member.start.y, member.start.z);
    const b = new THREE.Vector3(member.end.x, member.end.y, member.end.z);
    const p = new THREE.Vector3(cursor.x, cursor.y, cursor.z);
    const ab = b.clone().sub(a);
    const lengthSquared = ab.lengthSq();
    if (lengthSquared <= 1e-18) return [];

    const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / lengthSquared, 0, 1);
    const projected = a.addScaledVector(ab, t);
    return [{
      point: { x: projected.x, y: projected.y, z: projected.z },
      kind: "perpendicular" as const,
      label: `Perpendicular ${member.memberId}`,
    }];
  });
}

export function resolveSnapPoint(
  pointer: ScreenPointer,
  model: StructuralModel,
  selection: EditorSelection,
  camera: THREE.Camera,
  element: HTMLElement,
  tolerancePx: number,
): SnapPoint | null {
  const workPlane = workPlanePoint(pointer, model, selection, camera, element);
  const candidates = [
    ...uniqueCandidates(model),
    ...(workPlane ? perpendicularCandidates(model, workPlane.point) : []),
  ];

  let best: { candidate: SnapPoint; distance: number } | null = null;
  for (const candidate of candidates) {
    const screen = screenPosition(candidate.point, camera, element);
    if (!screen) continue;

    const distance = Math.hypot(
      pointer.clientX - screen.x,
      pointer.clientY - screen.y,
    );
    if (distance <= tolerancePx && (!best || distance < best.distance)) {
      best = { candidate, distance };
    }
  }

  return best?.candidate ?? workPlane;
}
