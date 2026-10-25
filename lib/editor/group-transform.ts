import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "./selection";
import { assertCanonicalV05 } from "../core-v05";

type Selection = Exclude<EditorSelection, null>;
export interface GroupTransformResult {
  model: StructuralModel;
  selections: Selection[];
  nodeIds: string[];
  warnings: string[];
}

function levelAt(
  model: StructuralModel,
  id: string | undefined,
  dz: number,
): string | undefined {
  if (!id || Math.abs(dz) < 1e-9) return id;
  const source = model.levels.find((item) => item.id === id);
  return source
    ? model.levels.find(
        (item) => Math.abs(item.elevation - source.elevation - dz) < 1e-9,
      )?.id
    : undefined;
}

/** Transform selected geometry atomically; each shared node is visited once.
 * Move preserves connected topology (including unselected incident elements).
 * Copy duplicates geometry only, preserving the existing no-load/support-copy policy.
 */
export function transformGroup(
  model: StructuralModel,
  input: Selection[],
  delta: Vec3,
  operation: "move" | "copy",
): GroupTransformResult {
  assertCanonicalV05(model);
  if (!input.length) throw new Error("SELECTION_REQUIRED");
  if (![delta.x, delta.y, delta.z].every(Number.isFinite))
    throw new Error("TRANSFORM_DELTA_INVALID");
  if (Math.hypot(delta.x, delta.y, delta.z) < 1e-10)
    throw new Error("TRANSFORM_DELTA_ZERO");
  const selections = [
    ...new Map(input.map((item) => [`${item.type}:${item.id}`, item])).values(),
  ];
  const nodeIds = new Set<string>();
  const warnings: string[] = [];
  const members = new Set<string>();
  const surfaces = new Set<string>();
  for (const item of selections) {
    if (item.type === "node") {
      if (!model.nodes.some((node) => node.id === item.id))
        throw new Error(`UNKNOWN_NODE:${item.id}`);
      nodeIds.add(item.id);
    } else if (item.type === "member") {
      const member = model.members.find((member) => member.id === item.id);
      if (!member) throw new Error(`UNKNOWN_MEMBER:${item.id}`);
      members.add(item.id);
      nodeIds.add(member.startNodeId);
      nodeIds.add(member.endNodeId);
    } else {
      const surface = model.surfaces.find((surface) => surface.id === item.id);
      if (!surface) throw new Error(`UNKNOWN_SURFACE:${item.id}`);
      surfaces.add(item.id);
      surface.boundaryNodeIds.forEach((id) => nodeIds.add(id));
      // Openings are geometry belonging to the selected host surface.
      model.openings
        ?.filter((opening) => opening.hostSurfaceId === item.id)
        .forEach((opening) =>
          opening.boundaryNodeIds.forEach((id) => nodeIds.add(id)),
        );
    }
  }
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  for (const id of nodeIds)
    if (!nodesById.has(id))
      throw new Error(`TRANSFORM_NODE_REFERENCE_INVALID:${id}`);
  const translate = (p: Vec3): Vec3 => {
    const result = { x: p.x + delta.x, y: p.y + delta.y, z: p.z + delta.z };
    if (!Object.values(result).every(Number.isFinite))
      throw new Error("Transformed coordinates must be finite.");
    return result;
  };
  let next: StructuralModel;
  let resultSelections = selections;
  let resultNodeIds: string[];
  if (operation === "move") {
    next = {
      ...model,
      nodes: model.nodes.map((node) =>
        nodeIds.has(node.id)
          ? {
              ...node,
              position: translate(node.position),
              levelId: levelAt(model, node.levelId, delta.z),
            }
          : node,
      ),
      members: model.members.map((member) =>
        members.has(member.id) ||
        (nodeIds.has(member.startNodeId) && nodeIds.has(member.endNodeId))
          ? { ...member, levelId: levelAt(model, member.levelId, delta.z) }
          : member,
      ),
      surfaces: model.surfaces.map((surface) =>
        surfaces.has(surface.id) ||
        surface.boundaryNodeIds.every((id) => nodeIds.has(id))
          ? { ...surface, levelId: levelAt(model, surface.levelId, delta.z) }
          : surface,
      ),
    };
    resultNodeIds = [...nodeIds];
  } else {
    const allIds = new Set<string>();
    for (const records of Object.values(model)) {
      if (Array.isArray(records))
        for (const record of records) if (record?.id) allIds.add(record.id);
    }
    const fresh = (id: string): string => {
      let next = `${id}-copy`,
        index = 2;
      while (allIds.has(next)) next = `${id}-copy-${index++}`;
      allIds.add(next);
      return next;
    };
    const nodeMap = new Map([...nodeIds].map((id) => [id, fresh(id)]));
    const memberMap = new Map([...members].map((id) => [id, fresh(id)]));
    const surfaceMap = new Map([...surfaces].map((id) => [id, fresh(id)]));
    const mappedNode = (id: string): string => {
      const mapped = nodeMap.get(id);
      if (!mapped) throw new Error(`TRANSFORM_NODE_REFERENCE_INVALID:${id}`);
      return mapped;
    };
    if (
      model.surfaces.some(
        (surface) =>
          surfaces.has(surface.id) &&
          surface.loadTransfer?.supportingMemberIds?.some(
            (id) => !members.has(id),
          ),
      )
    )
      warnings.push(
        "Supporting-member links outside the copied selection were not copied. Reassign surface load transfer before analysis.",
      );
    next = {
      ...model,
      nodes: [
        ...model.nodes,
        ...model.nodes
          .filter((node) => nodeIds.has(node.id))
          .map((node) => ({
            ...node,
            id: mappedNode(node.id),
            position: translate(node.position),
            levelId: levelAt(model, node.levelId, delta.z),
          })),
      ],
      members: [
        ...model.members,
        ...model.members
          .filter((member) => members.has(member.id))
          .map((member) => ({
            ...member,
            id: memberMap.get(member.id)!,
            startNodeId: mappedNode(member.startNodeId),
            endNodeId: mappedNode(member.endNodeId),
            levelId: levelAt(model, member.levelId, delta.z),
          })),
      ],
      surfaces: [
        ...model.surfaces,
        ...model.surfaces
          .filter((surface) => surfaces.has(surface.id))
          .map((surface) => ({
            ...surface,
            id: surfaceMap.get(surface.id)!,
            boundaryNodeIds: surface.boundaryNodeIds.map(mappedNode),
            levelId: levelAt(model, surface.levelId, delta.z),
            loadTransfer: surface.loadTransfer
              ? {
                  ...surface.loadTransfer,
                  // Preserve only support relationships copied into the new geometry.
                  supportingMemberIds:
                    surface.loadTransfer.supportingMemberIds?.flatMap((id) =>
                      memberMap.has(id) ? [memberMap.get(id)!] : [],
                    ),
                }
              : undefined,
          })),
      ],
      ...(model.openings
        ? {
            openings: [
              ...model.openings,
              ...model.openings
                .filter((opening) => surfaces.has(opening.hostSurfaceId))
                .map((opening) => ({
                  ...opening,
                  id: fresh(opening.id),
                  hostSurfaceId: surfaceMap.get(opening.hostSurfaceId)!,
                  boundaryNodeIds: opening.boundaryNodeIds.map(mappedNode),
                })),
            ],
          }
        : {}),
    };
    resultSelections = selections.map((item) => ({
      ...item,
      id:
        item.type === "node"
          ? mappedNode(item.id)
          : item.type === "member"
            ? memberMap.get(item.id)!
            : surfaceMap.get(item.id)!,
    }));
    resultNodeIds = [...nodeMap.values()];
  }
  // Refuse a movement that collapses any connected member, including an unselected one.
  const outputNodes = new Map(next.nodes.map((node) => [node.id, node]));
  for (const member of next.members) {
    const a = outputNodes.get(member.startNodeId)?.position;
    const b = outputNodes.get(member.endNodeId)?.position;
    if (a && b && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-8)
      throw new Error(`TRANSFORM_COLLAPSES_MEMBER:${member.id}`);
  }
  assertCanonicalV05(next);
  return {
    model: next,
    selections: resultSelections,
    nodeIds: resultNodeIds,
    warnings,
  };
}
