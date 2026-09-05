import type { MemberType, StructuralModel, Vec3 } from "@linkoteq/structural-core";
import {
  createMemberFromCanonicalRefs,
  createNodeFromGlobalCoordinates,
} from "../editor-modeling-v05";
import type { SnapPoint } from "./interaction-store";

const POSITION_TOLERANCE = 1e-8;

function distanceSquared(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function findNodeAtPoint(model: StructuralModel, point: Vec3): string | null {
  const toleranceSquared = POSITION_TOLERANCE * POSITION_TOLERANCE;
  return (
    model.nodes.find((node) => distanceSquared(node.position, point) <= toleranceSquared)?.id ??
    null
  );
}

function ensureNodeAtPoint(
  model: StructuralModel,
  point: Vec3,
): { model: StructuralModel; nodeId: string } {
  const existing = findNodeAtPoint(model, point);
  if (existing) return { model, nodeId: existing };

  const created = createNodeFromGlobalCoordinates(model, point);
  return { model: created.model, nodeId: created.node.id };
}

export function createMemberFromSnapPoints(
  model: StructuralModel,
  input: {
    type: MemberType;
    materialId: string;
    sectionId: string;
    start: SnapPoint;
    end: SnapPoint;
  },
): { model: StructuralModel; memberId: string } {
  if (distanceSquared(input.start.point, input.end.point) <= POSITION_TOLERANCE ** 2) {
    throw new Error("MEMBER_DRAW_POINTS_MUST_BE_DISTINCT");
  }

  const start = ensureNodeAtPoint(model, input.start.point);
  const end = ensureNodeAtPoint(start.model, input.end.point);

  if (start.nodeId === end.nodeId) {
    throw new Error("MEMBER_DRAW_POINTS_MUST_BE_DISTINCT");
  }

  const created = createMemberFromCanonicalRefs(end.model, {
    type: input.type,
    startNodeId: start.nodeId,
    endNodeId: end.nodeId,
    materialId: input.materialId,
    sectionId: input.sectionId,
  });

  return { model: created.model, memberId: created.member.id };
}
