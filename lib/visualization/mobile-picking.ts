import * as THREE from "three";

export interface PointerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PointerSample {
  position: THREE.Vector2;
  distancePx: number;
}

export function pointerToNdc(
  clientX: number,
  clientY: number,
  rect: PointerRect,
): THREE.Vector2 {
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  return new THREE.Vector2(
    ((clientX - rect.left) / width) * 2 - 1,
    -((clientY - rect.top) / height) * 2 + 1,
  );
}

export function tapTolerance(pointerType: string): number {
  if (pointerType === "touch") return 22;
  if (pointerType === "pen") return 12;
  return 7;
}

export function isTapGesture(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pointerType: string,
): boolean {
  return Math.hypot(endX - startX, endY - startY) <= tapTolerance(pointerType);
}

export function pickSamples(
  clientX: number,
  clientY: number,
  _rect: PointerRect,
  pointerType: string,
): PointerSample[] {
  const offsets =
    pointerType === "touch"
      ? [
          [0, 0],
          [14, 0],
          [-14, 0],
          [0, 14],
          [0, -14],
          [22, 0],
          [-22, 0],
          [0, 22],
          [0, -22],
          [14, 14],
          [14, -14],
          [-14, 14],
          [-14, -14],
        ]
      : [[0, 0]];

  return offsets.map(([dx, dy]) => ({
    // That Open SimpleRaycaster 3.4.x expects raw screen/client coordinates
    // and performs its own conversion to normalized device coordinates.
    position: new THREE.Vector2(clientX + dx, clientY + dy),
    distancePx: Math.hypot(dx, dy),
  }));
}
