import * as THREE from "three";
import type { StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface SelectionWindow {
  start: ScreenPoint;
  end: ScreenPoint;
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function rectOf(window: SelectionWindow): Rect {
  return {
    left: Math.min(window.start.x, window.end.x),
    right: Math.max(window.start.x, window.end.x),
    top: Math.min(window.start.y, window.end.y),
    bottom: Math.max(window.start.y, window.end.y),
  };
}

function inside(point: ScreenPoint, rect: Rect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function orientation(a: ScreenPoint, b: ScreenPoint, c: ScreenPoint): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a: ScreenPoint, b: ScreenPoint, c: ScreenPoint): boolean {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y)
  );
}

function segmentsIntersect(
  p1: ScreenPoint,
  q1: ScreenPoint,
  p2: ScreenPoint,
  q2: ScreenPoint,
): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  const epsilon = 1e-9;
  if (Math.abs(o1) < epsilon && onSegment(p1, p2, q1)) return true;
  if (Math.abs(o2) < epsilon && onSegment(p1, q2, q1)) return true;
  if (Math.abs(o3) < epsilon && onSegment(p2, p1, q2)) return true;
  if (Math.abs(o4) < epsilon && onSegment(p2, q1, q2)) return true;
  return false;
}

function segmentIntersectsRect(a: ScreenPoint, b: ScreenPoint, rect: Rect): boolean {
  if (inside(a, rect) || inside(b, rect)) return true;
  const tl = { x: rect.left, y: rect.top };
  const tr = { x: rect.right, y: rect.top };
  const br = { x: rect.right, y: rect.bottom };
  const bl = { x: rect.left, y: rect.bottom };
  return (
    segmentsIntersect(a, b, tl, tr) ||
    segmentsIntersect(a, b, tr, br) ||
    segmentsIntersect(a, b, br, bl) ||
    segmentsIntersect(a, b, bl, tl)
  );
}

function project(
  position: { x: number; y: number; z: number },
  camera: THREE.Camer,
  rect: DOMRect,
): ScreenPoint | null {
  const projected = new THREE.Vector3(position.x, position.z, position.y).project(camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - projected.y) / 2) * rect.height,
  };
}

export function selectMembersInWindow(
  model: StructuralModel,
  camera: THREE.Camera,
  canvasRect: DOMRect,
  window: SelectionWindow,
): Array<Exclude<EditorSelection, null>> {
  const selectionRect = rectOf(window);
  const crossing = window.end.x < window.start.x;
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));

  return model.members.flatMap((member) => {
    const start = nodes.get(member.startNodeId);
    const end = nodes.get(member.endNodeId);
    if (!start || !end) return [];

    const a = project(start.position, camera, canvasRect);
    const b = project(end.position, camera, canvasRect);
    if (!a || !b) return [];

    const selected = crossing
      ? segmentIntersectsRect(a, b, selectionRect)
      : inside(a, selectionRect) && inside(b, selectionRect);

    return selected ? [{ type: "member" as const, id: member.id }] : [];
  });
}

export function selectNodesInWindow(
  model: StructuralModel,
  camera: THREE.Camer,
  canvasRect: DOMRect,
  window: SelectionWindow,
): Array<Exclude<EditorSelection, null>> {
  const selectionRect = rectOf(window);

  return model.nodes.flatMap((node) => {
    const point = project(node.position, camera, canvasRect);
    return point && inside(point, selectionRect)
      ? [{ type: "node" as const, id: node.id }]
      : [];
  });
}

export function selectElementsInWindow(
  model: StructuralModel,
  camera: THREE.Camera,
  canvasRect: DOMRect,
  window: SelectionWindow,
): Array<Exclude<EditorSelection, null>> {
  return [
    ...selectMembersInWindow(model, camera, canvasRect, window),
    ...selectNodesInWindow(model, camera, canvasRect, window),
  ];
}
