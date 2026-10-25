export const MEMBER_DRAW_PICK_EVENT = "linkoteq:member-draw-pick";


// UI-only tool state; canonical geometry stays in StructuralModel.
export type ModelingPointTool = "beam" | "column" | "brace" | "wall" | "slab";
let pointTool: ModelingPointTool | null = null;
export function setModelingPointTool(tool: ModelingPointTool | null): void {
  pointTool = tool;
}
export function getModelingPointTool(): ModelingPointTool | null {
  return pointTool;
}
