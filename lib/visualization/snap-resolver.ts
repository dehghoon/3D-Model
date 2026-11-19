import * as THREE from "three";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";
import { getSnapSettings, type SnapSettings } from "../editor/snap-settings";
import type { SnapPoint } from "../editor/interaction-store";

interface ScreenPointer {
  clientX: number;
  clientY: number;
}

export interface SnapCandidateEventDetail {
  active: boolean;
  clientX?: number;
  clientY?: number;
  kind?: SnapPoint["kind"];
  label?: string;
}

function emitSnapCandidate(detail: SnapCandidateEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SnapCandidateEventDetail>("linkoteq:snap-candidate", {
      detail,
    }),
  );
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

function workPlanePoint(
  pointer: ScreenPointer,
  model: StructuralModel,
  selection: EditorSelection,
  camera: THREE.Camera,
  rect: DOMRect,
  elevation: number,
  origin?: Vec3,
  fixedPlane = false,
): SnapPoint | null {
  const ndc = new THREE.Vector2(
    ((pointer.clientX - rect.left) / rect.width) * 2 - 1,
    -((pointer.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);

  // Elevation views need a vertical construction plane: a horizontal plane
  // is parallel to their rays and cannot yield a point.
  const normal = new THREE.Vector3(0, 1, 0);
  if (!fixedPlane && Math.abs(raycaster.ray.direction.y) < 1e-6) {
    camera.getWorldDirection(normal);
  }
  const anchor = selection?.type === "node"
    ? model.nodes.find((node) => node.id === selection.id)?.position
    : undefined;
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    normal, toThree(fixedPlane ? { x: 0, y: 0, z: elevation } : origin ?? anchor ?? { x: 0, y: 0, z: elevation }),
  );
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

// Editing produces a new model snapshot. Keep only the last grid elevation per snapshot.
const modelSnapGeometry = new WeakMap<StructuralModel, {
  members: ReturnType<typeof memberPoints>;
  lastCandidates?: { settings: SnapSettings; elevation: number; points: SnapPoint[] };
}>();

function uniqueCandidates(
  model: StructuralModel,
  members: ReturnType<typeof memberPoints>,
  elevation: number,
  settings: SnapSettings,
): SnapPoint[] {
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

  for (const member of members) {
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
          point: { x: vertical.x, y: horizontal.y, z: elevation },
          kind: "grid",
          label: `Grid ${vertical.label}/${horizontal.label}`,
        });
      }
    }
  }

  return [...candidates.values()];
}

function perpendicularCandidates(members: ReturnType<typeof memberPoints>, cursor: Vec3): SnapPoint[] {
  return members.flatMap(({ memberId, start, end }) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    if (lengthSquared <= 1e-18) return [];

    const dot = (cursor.x - start.x) * dx + (cursor.y - start.y) * dy + (cursor.z - start.z) * dz;
    const t = THREE.MathUtils.clamp(dot / lengthSquared, 0, 1);

    return [{
      point: { x: start.x + dx * t, y: start.y + dy * t, z: start.z + dz * t },
      kind: "perpendicular" as const,
      label: `Perpendicular ${memberId}`,
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
  origin?: Vec3,
  fixedElevation?: number,
): SnapPoint | null {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height ||
      pointer.clientX < rect.left || pointer.clientX > rect.right ||
      pointer.clientY < rect.top || pointer.clientY > rect.bottom) {
    emitSnapCandidate({ active: false });
    return null;
  }
  const elevation = fixedElevation ?? origin?.z ?? selectedElevation(model, selection);
  const workPlane = workPlanePoint(pointer, model, selection, camera, rect, elevation, origin, fixedElevation !== undefined);
  const settings = getSnapSettings();
  let geometry = modelSnapGeometry.get(model);
  if (!geometry) {
    geometry = { members: memberPoints(model) };
    modelSnapGeometry.set(model, geometry);
  }
  const gridElevation = settings.grid ? elevation : 0;
  if (geometry.lastCandidates?.settings !== settings || geometry.lastCandidates.elevation !== gridElevation) {
    geometry.lastCandidates = {
      settings,
      elevation: gridElevation,
      points: uniqueCandidates(model, geometry.members, gridElevation, settings),
    };
  }

  let best: {
    candidate: SnapPoint;
    distance: number;
    screen: { x: number; y: number };
  } | null = null;

  const projected = new THREE.Vector3();
  const consider = (candidates: SnapPoint[]) => {
    for (const candidate of candidates) {
      const { x, y, z } = candidate.point;
      if (fixedElevation !== undefined && Math.abs(z - fixedElevation) > 1e-8) continue;
      projected.set(x, z, y).project(camera);
      if (projected.z < -1 || projected.z > 1) continue;
      const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
      const screenY = rect.top + ((1 - projected.y) / 2) * rect.height;
      const distance = Math.hypot(pointer.clientX - screenX, pointer.clientY - screenY);
      if (distance <= tolerancePx && (!best || distance < best.distance)) {
        best = { candidate, distance, screen: { x: screenX, y: screenY } };
      }
    }
    return best;
  };

  let match = consider(geometry.lastCandidates.points);
  if (workPlane && settings.perpendicular) {
    match = consider(perpendicularCandidates(geometry.members, workPlane.point));
  }

  if (match) {
    emitSnapCandidate({
      active: true,
      clientX: match.screen.x,
      clientY: match.screen.y,
      kind: match.candidate.kind,
      label: match.candidate.label,
    });
    return { ...match.candidate, point: { ...match.candidate.point } };
  }

  emitSnapCandidate({ active: false });
  return workPlane;
}
