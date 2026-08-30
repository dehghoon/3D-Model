import type { EditorSelection } from "./selection";

export type EditorTool =
  | "select"
  | "move"
  | "grid"
  | "column"
  | "beam"
  | "brace"
  | "slab"
  | "wall"
  | "support"
  | "measure";

export interface EditorInteractionState {
  activeTool: EditorTool;
  selection: EditorSelection;
  hovered: EditorSelection;
  pickedEntityIds: string[];
}

export function createInitialInteractionState(): EditorInteractionState {
  return {
    activeTool: "select",
    selection: null,
    hovered: null,
    pickedEntityIds: [],
  };
}

export function setActiveTool(
  state: EditorInteractionState,
  activeTool: EditorTool,
): EditorInteractionState {
  return {
    ...state,
    activeTool,
    hovered: null,
    pickedEntityIds:
      activeTool === state.activeTool ? state.pickedEntityIds : [],
  };
}

export function setSelection(
  state: EditorInteractionState,
  selection: EditorSelection,
): EditorInteractionState {
  return { ...state, selection };
}

export function setHovered(
  state: EditorInteractionState,
  hovered: EditorSelection,
): EditorInteractionState {
  return { ...state, hovered };
}

export function addPickedEntityId(
  state: EditorInteractionState,
  id: string,
): EditorInteractionState {
  const normalizedId = id.trim();
  if (!normalizedId) {
    throw new Error("Picked entity id is required.");
  }

  if (state.pickedEntityIds.includes(normalizedId)) {
    return state;
  }

  return {
    ...state,
    pickedEntityIds: [...state.pickedEntityIds, normalizedId],
  };
}

export function clearTemporaryInteraction(
  state: EditorInteractionState,
): EditorInteractionState {
  return {
    ...state,
    hovered: null,
    pickedEntityIds: [],
  };
}
