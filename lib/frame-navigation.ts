export interface FrameView {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const INITIAL_FRAME_VIEW: FrameView = {
  x: 0,
  y: 0,
  width: 820,
  height: 590,
};
export function zoomFrame(
  view: FrameView,
  factor: number,
  anchor: { x: number; y: number },
): FrameView {
  const width = Math.min(8200, Math.max(82, view.width * factor)),
    ratio = width / view.width;
  return {
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
    width,
    height: view.height * ratio,
  };
}
export function framePoint(
  view: FrameView,
  bounds: { left: number; top: number; width: number; height: number },
  x: number,
  y: number,
) {
  const scale =
    Math.min(bounds.width / view.width, bounds.height / view.height) || 1;
  return {
    x:
      view.x +
      (x - bounds.left - (bounds.width - view.width * scale) / 2) / scale,
    y:
      view.y +
      (y - bounds.top - (bounds.height - view.height * scale) / 2) / scale,
  };
}
