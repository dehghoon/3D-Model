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
      const member = model.members.find((item) => item.startNodeId === selection.id || item.endNodeId === selection.id);
      if (member) throw new Error(`NODE_REFERENCED_BY_MEMBER:${member.id}`);
      const surface = model.surfaces.find((item) => item.boundaryNodeIds.includes(selection.id));
      if (surface) throw new Error(`NODE_REFERENCED_BY_SURFACE:${surface.id}`);
      const support = model.supports.find((item) => item.nodeId === selection.id);
      if (support) throw new Error(`NODE_REFERENCED_BY_SUPPORT:${support.id}`);
      const diaphragm = model.diaphragms.find((item) => item.nodeIds?.includes(selection.id));
      if (diaphragm) throw new Error(`NODE_REFERENCED_BY_DIAPHRAGM:${diaphragm.id}`);
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
      const memberLoad = model.loads.find((load) =>
        (load.type === "member-point" || load.type === "member-distributed") && load.memberId === selection.id,
      );
      if (memberLoad) throw new Error(`MEMBER_REFERENCED_BY_LOAD:${memberLoad.id}`);
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
      const diaphragm = model.diaphragms.find((item) => item.surfaceIds.includes(selection.id));
      if (diaphragm) throw new Error(`SURFACE_REFERENCED_BY_DIAPHRAGM:${diaphragm.id}`);
      const surfaceLoad = model.loads.find((load) => load.type === "surface-pressure" && load.surfaceId === selection.id);
      if (surfaceLoad) throw new Error(`SURFACE_REFERENCED_BY_LOAD:${surfaceLoad.id}`);
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
