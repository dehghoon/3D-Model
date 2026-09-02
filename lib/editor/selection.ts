import type { StructuralModel } from "@linkoteq/structural-core";
import { publishSelection } from "./selection-store";

export type EditorSelection =
  | { type: "node"; id: string }
  | { type: "member"; id: string }
  | { type: "surface"; id: string }
  | null;

export function createSelection(
  type: Exclude<EditorSelection, null>["type"],
  id: string,
): EditorSelection {
  const normalizedId = id.trim();
  if (!normalizedId) {
    throw new Error("Selection id is required.");
  }

  const selection = { type, id: normalizedId } as EditorSelection;
  publishSelection(selection);
  return selection;
}

export function clearSelection(): EditorSelection {
  publishSelection(null);
  return null;
}

export function isSameSelection(
  left: EditorSelection,
  right: EditorSelection,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return left.type === right.type && left.id === right.id;
}

export function selectionExists(
  model: StructuralModel,
  selection: EditorSelection,
): boolean {
  if (!selection) return false;

  switch (selection.type) {
    case "node":
      return model.nodes.some((item) => item.id === selection.id);
    case "member":
      return model.members.some((item) => item.id === selection.id);
    case "surface":
      return model.surfaces.some((item) => item.id === selection.id);
  }
}

export function reconcileSelection(
  model: StructuralModel,
  selection: EditorSelection,
): EditorSelection {
  const reconciled = selectionExists(model, selection) ? selection : null;
  publishSelection(reconciled);
  return reconciled;
}

export function getSelectionLabel(selection: EditorSelection): string {
  if (!selection) return "None";
  return `${selection.type}: ${selection.id}`;
}
