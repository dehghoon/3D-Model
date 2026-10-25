"use client";
import { useSyncExternalStore } from "react";
import type { SnapPoint } from "./interaction-store";
export const MEMBER_DRAW_PICK_EVENT = "linkoteq:member-draw-pick";
export const MODELING_COMMAND_EVENT = "linkoteq:modeling-command";
export const SURFACE_FINISH_EVENT = "linkoteq:surface-finish";
export const UTILITY_COMMAND_EVENT = "linkoteq:utility-command";
export type ModelingPointTool = "beam" | "column" | "brace" | "wall" | "slab";
interface PointToolState {
  tool: ModelingPointTool | null;
  points: SnapPoint[];
  message: string;
}
let state: PointToolState = { tool: null, points: [], message: "" };
const listeners = new Set<() => void>();
function emit(next: PointToolState) {
  state = next;
  listeners.forEach((listener) => listener());
}
export function setModelingPointTool(tool: ModelingPointTool | null): void {
  emit({
    tool,
    points: [],
    message: tool
      ? `Pick the first ${tool === "slab" || tool === "wall" ? "boundary " : ""}point, or enter coordinates.`
      : "",
  });
}
export function getModelingPointTool() {
  return state.tool;
}
export function getPointToolState() {
  return state;
}
export function setPointToolMessage(message: string) {
  emit({ ...state, message });
}
export function setSurfacePoints(points: SnapPoint[]) {
  emit({
    ...state,
    points,
    message: `${points.length} boundary points. Add another point or finish.`,
  });
}
export function usePointToolState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}
