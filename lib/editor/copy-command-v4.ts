import type { Node, StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "./selection";

export interface CopySelectionResult {
  model: StructuralModel;
  selection: Exclude<EditorSelection, null>;
  createdNodeIds: string[];
}

function nextId(base: string, existing: Set<string>): string {
  let candidate = `${base}-copy`;
  let index = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-copy-${index}`;
    index += 1;
  }
  existing.add(candidate);
  return candidate;
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

function cloneNode(
  model: StructuralModel,
  node: Node,
  delta: Vec3,
  existingIds: Set<string>,
): Node {
  return {
    ...node,
    id: nextId(node.id, existingIds),
    position: translated(node.position, delta),
    levelId: translatedLevelId(model, node.levelId, delta.z),
  };
}

function requireNode(model: StructuralModel, id: string, context: string): Node {
  const node = model.nodes.find((item) => item.id === id);
  if (!node) throw new Error(`${context}:${id}`);
  return node;
}

export function copySelection(
  model: StructuralModel,
  selection: EditorSelection,
  delta: Vec3,
): CopySelectionResult {
  if (!selection) throw new Error("SELECTION_REQUIRED");
  if (![delta.x, delta.y, delta.z].every(Number.isFinite)) {
    throw new Error("COPY_DELTA_INVALID");
  }
  if (Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z) < 1e-12) {
    throw new Error("COPY_DELTA_ZERO");
  }

  const nodeIds = new Set(model.nodes.map((item) => item.id));
  const memberIds = new Set(model.members.map((item) => item.id));
  const surfaceIds = new Set(model.surfaces.map((item) => item.id));

  if (selection.type === "node") {
    const source = requireNode(model, selection.id, "UNKNOWN_NODE");
    const node = cloneNode(model, source, delta, nodeIds);
    return {
      model: { ...model, nodes: [...model.nodes, node] },
      selection: { type: "node", id: node.id },
      createdNodeIds: [node.id],
    };
  }

  if (selection.type === "member") {
    const source = model.members.find((item) => item.id === selection.id);
    if (!source) throw new Error(`UNKNOWN_MEMBER:${selection.id}`);

    const sourceStart = requireNode(
      model,
      source.startNodeId,
      `MEMBER_NODE_REFERENCE_INVALID:${source.id}`,
    );
    const sourceEnd = requireNode(
      model,
      source.endNodeId,
      `MEMBER_NODE_REFERENCE_INVALID:${source.id}`,
    );
    const newStart = cloneNode(model, sourceStart, delta, nodeIds);
    const newEnd = cloneNode(model, sourceEnd, delta, nodeIds);
    const memberId = nextId(source.id, memberIds);
    const member = {
      ...source,
      id: memberId,
      startNodeId: newStart.id,
      endNodeId: newEnd.id,
      levelId: translatedLevelId(model, source.levelId, delta.z),
    };

    return {
      model: {
        ...model,
        nodes: [...model.nodes, newStart, newEnd],
        members: [...model.members, member],
      },
      selection: { type: "member", id: memberId },
      createdNodeIds: [newStart.id, newEnd.id],
    };
  }

  const source = model.surfaces.find((item) => item.id === selection.id);
  if (!source) throw new Error(`UNKNOWN_SURFACE:${selection.id}`);

  const nodeMap = new Map<string, Node>();
  for (const sourceNodeId of source.boundaryNodeIds) {
    const sourceNode = requireNode(
      model,
      sourceNodeId,
      `SURFACE_NODE_REFERENCE_INVALID:${source.id}`,
    );
    if (!nodeMap.has(sourceNodeId)) {
      nodeMap.set(sourceNodeId, cloneNode(model, sourceNode, delta, nodeIds));
    }
  }

  const boundaryNodeIds = source.boundaryNodeIds.map((sourceNodeId) => {
    const mapped = nodeMap.get(sourceNodeId);
    if (!mapped) {
      throw new Error(`SURFACE_NODE_REFERENCE_INVALID:${source.id}:${sourceNodeId}`);
    }
    return mapped.id;
  });

  const surfaceId = nextId(source.id, surfaceIds);
  const surface = {
    ...source,
    id: surfaceId,
    boundaryNodeIds,
    levelId: translatedLevelId(model, source.levelId, delta.z),
  };
  const newNodes = [...nodeMap.values()];

  return {
    model: {
      ...model,
      nodes: [...model.nodes, ...newNodes],
      surfaces: [...model.surfaces, surface],
    },
    selection: { type: "surface", id: surfaceId },
    createdNodeIds: newNodes.map((node) => node.id),
  };
}
