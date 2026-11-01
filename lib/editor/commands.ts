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

/** Delete a multi-selection atomically: validate references against the final retained model. */
export function deleteSelections(
  model: StructuralModel,
  selections: readonly Exclude<EditorSelection, null>[],
): StructuralModel {
  if (!selections.length) throw new Error("SELECTION_REQUIRED");
  const nodes = new Set(selections.filter((s) => s.type === "node").map((s) => s.id));
  const members = new Set(selections.filter((s) => s.type === "member").map((s) => s.id));
  const surfaces = new Set(selections.filter((s) => s.type === "surface").map((s) => s.id));
  for (const id of nodes) if (!model.nodes.some((n) => n.id === id)) throw new Error(`UNKNOWN_NODE:${id}`);
  for (const id of members) if (!model.members.some((m) => m.id === id)) throw new Error(`UNKNOWN_MEMBER:${id}`);
  for (const id of surfaces) if (!model.surfaces.some((s) => s.id === id)) throw new Error(`UNKNOWN_SURFACE:${id}`);
  for (const member of model.members) {
    if (!members.has(member.id) && (nodes.has(member.startNodeId) || nodes.has(member.endNodeId)))
      throw new Error(`NODE_REFERENCED_BY_MEMBER:${member.id}`);
  }
  for (const surface of model.surfaces) {
    if (!surfaces.has(surface.id) && surface.boundaryNodeIds.some((id) => nodes.has(id)))
      throw new Error(`NODE_REFERENCED_BY_SURFACE:${surface.id}`);
  }
  for (const support of model.supports) if (nodes.has(support.nodeId))
    throw new Error(`NODE_REFERENCED_BY_SUPPORT:${support.id}`);
  for (const diaphragm of model.diaphragms) {
    if (diaphragm.nodeIds?.some((id) => nodes.has(id)))
      throw new Error(`NODE_REFERENCED_BY_DIAPHRAGM:${diaphragm.id}`);
    if (diaphragm.surfaceIds.some((id) => surfaces.has(id)))
      throw new Error(`SURFACE_REFERENCED_BY_DIAPHRAGM:${diaphragm.id}`);
  }
  for (const load of model.loads) {
    if (load.type === "nodal" && nodes.has(load.nodeId))
      throw new Error(`NODE_REFERENCED_BY_LOAD:${load.id}`);
    if ((load.type === "member-point" || load.type === "member-distributed") && members.has(load.memberId))
      throw new Error(`MEMBER_REFERENCED_BY_LOAD:${load.id}`);
    if (load.type === "surface-pressure" && surfaces.has(load.surfaceId))
      throw new Error(`SURFACE_REFERENCED_BY_LOAD:${load.id}`);
  }
  for (const spring of model.supportSprings ?? []) if (nodes.has(spring.nodeId))
    throw new Error(`NODE_REFERENCED_BY_SPRING:${spring.id}`);
  for (const displacement of model.enforcedNodeDisplacements ?? []) if (nodes.has(displacement.nodeId))
    throw new Error(`NODE_REFERENCED_BY_DISPLACEMENT:${displacement.id}`);
  return {
    ...model,
    nodes: model.nodes.filter((item) => !nodes.has(item.id)),
    members: model.members.filter((item) => !members.has(item.id)),
    surfaces: model.surfaces.filter((item) => !surfaces.has(item.id)),
  };
}
