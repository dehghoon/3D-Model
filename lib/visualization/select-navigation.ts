/** Pure mouse navigation math; does not mutate the viewport or selection. */
export function wheelDollyStep(deltaY: number, deltaMode: number, viewportHeight: number, cameraDistance: number): number {
  if (![deltaY, deltaMode, viewportHeight, cameraDistance].every(Number.isFinite)) return 0;
  const factor = deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(viewportHeight, 1) : 1;
  const distance = Math.max(cameraDistance, 0.1);
  const normalized = deltaY * factor;
  return -Math.max(-distance * 0.3, Math.min(distance * 0.3, normalized * distance * 0.001));
}

export function middlePanTruck(
  start: { x: number; y: number },
  end: { x: number; y: number },
  viewportHeight: number,
  cameraDistance: number,
): { x: number; y: number } {
  const scale = Math.max(cameraDistance, 1) / Math.max(viewportHeight, 1);
  return { x: (start.x - end.x) * scale, y: (end.y - start.y) * scale };
}
