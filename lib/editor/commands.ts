import type { StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "./selection";

export interface DeleteSelectionResult {
  model: StructuralModel;
  deleted: Exclude<EditorSelection, null>;
}

export function deleteSelection(
  model: StructuralModel,
  selection: EditorSelection,
): DeleteSelectionResult {
  if (!selection) {
    throw new Error("SELECTION_REQUIRED");
  }

  switch (selection.type) {
    case "node": {
      if (!model.nodes.some((item) => item.id === selection.id)) {
        throw new Error(`UNKNOWN_NODE:${selection.id}`);
      }
      return {
        model: {
          ...model,
          nodes: model.nodes.filter((item) => item.id !== selection.id),
        },
        deleted: selection,
      };
    }

    case "member": {
      if (!model.members.some((item) => item.id === selection.id)) {
        throw new Error(`UNKNOWN_MEMBER:${selection.id}`);
      }
      return {
        model: {
          ...model,
          members: model.members.filter((item) => item.id !== selection.id),
        },
        deleted: selection,
      };
    }

    case "surface": {
      if (!model.surfaces.some((item) => item.id === selection.id)) {
        throw new Error(`UNKNOWN_SURFACE:${selection.id}`);
      }
      return {
        model: {
          ...model,
          surfaces: model.surfaces.filter((item) => item.id !== selection.id),
        },
        deleted: selection,
      };
    }
  }
}
