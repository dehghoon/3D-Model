import type { Node, StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "./selection";

export interface MoveSelectionResult {
  model: StructuralModel;
  selection: Exclude<EditorSelection, null>;
  movedNodeIds: string[];
}

function translated(position: Vec3, delta: Vec3): Vec3 {
  return {
    x: position.x + delta.x,
    y: position.y + delta.y,
    z: position.z + delta.z,
  };
}

function translatedLevelId(
  model: StructuralModel,
  sourceLevelId: string | undefined,
  deltaZ: number,
): string | undefined {
  if (!sourceLevelId || Math.abs(deltaZ) < 1e-9) return sourceLevelId;
  const source = model.levels.find((level) => level.id === sourceLevelId);
  if (!source) return undefined;

  const targetElevation = source.elevation + deltaZ;
  return model.levels.find(
    (level) => Math.abs(level.elevation - targetElevation) < 1e-9,
  )?.id;
}

function movedNode(model: StructuralModel, node: Node, delta: Vec3): Node {
  return {
    ...node,
    position: translated(node.position, delta),
    levelId: translatedLevelId(model, node.levelId, delta.z),
  };
}

export function moveSelection(
  model: StructuralModel,
  selection: EditorSelection,
  delta: Vec3,
): MoveSelectionResult {
  if (!selection) throw new Error("SELECTION_REQUIRED");
  if (![delta.x, delta.y, delta.z].every(Number.isFinite)) {
    throw new Error("MOVE_DELTA_INVALID");
  }
  if (Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z) < 1e-12) {
    throw new Error("MOVE_DELTA_ZERO");
  }

  const nodeIds = new Set<string>();

  if (selection.type === "node") {
    if (!model.nodes.some((node) => node.id === selection.id)) {
      throw new Error(`UNKNOWN_NODE:${selection.id}`);
    }
    nodeIds.add(selection.id);
  } else if (selection.type === "member") {
    const member = model.members.find((item) => item.id === selection.id);
    if (!member) throw new Error(`UNKNOWN_MEMBER:${selection.id}`);
    nodeIds.add(member.startNodeId);
    nodeIds.add(member.endNodeId);
  } else {
    const surface = model.surfaces.find((item) => item.id === selection.id);
    if (!surface) throw new Error(`UNKNOWN_SURFACE:${selection.id}`);
    surface.boundaryNodeIds.forEach((id) => nodeIds.add(id));
  }

  for (const id of nodeIds) {
    if (!model.nodes.some((node) => node.id === id)) {
      throw new Error(`MOVE_NODE_REFERENCE_INVALID:${selection.type}:${selection.id}:${id}`);
    }
  }

  const nodes = model.nodes.map((node) =>
    nodeIds.has(node.id) ? movedNode(model, node, delta) : node,
  );

  const members =
    selection.type === "member"
      ? model.members.map((member) =>
          member.id === selection.id
            ? {
                ...member,
                levelId: translatedLevelId(model, member.levelId, delta.z),
              }
            : member,
        )
      : model.members;

  const surfaces =
    selection.type === "surface"
      ? model.surfaces.map((surface) =>
          surface.id === selection.id
            ? {
                ...surface,
                levelId: translatedLevelId(model, surface.levelId, delta.z),
              }
            : surface,
        )
      : model.surfaces;

  return {
    model: {
      ...model,
      nodes,
      members,
      surfaces,
    },
    selection,
    movedNodeIds: [...nodeIds],
  };
}
