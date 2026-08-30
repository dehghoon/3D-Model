export { deleteSelection } from "./commands";
export type { DeleteSelectionResult } from "./commands";

export {
  addPickedEntityId,
  clearTemporaryInteraction,
  createInitialInteractionState,
  setActiveTool,
  setHovered,
  setSelection,
} from "./interaction-state";
export type {
  EditorInteractionState,
  EditorTool,
} from "./interaction-state";

export {
  clearSelection,
  createSelection,
  getSelectionLabel,
  isSameSelection,
  reconcileSelection,
  selectionExists,
} from "./selection";
export type { EditorSelection } from "./selection";
