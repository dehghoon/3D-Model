import type { Member, MemberType, StructuralModel } from "@linkoteq/structural-core";

export interface CreateMemberInput {
  type: MemberType;
  startNodeId: string;
  endNodeId: string;
  materialId: string;
  sectionId: string;
}

export interface CreateMemberResult {
  model: StructuralModel;
  member: Member;
}

function requireId(value: string, code: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(code);
  return trimmed;
}

function nextMemberId(type: MemberType, members: Member[]): string {
  const prefix = type === "beam" ? "B" : type === "column" ? "C" : type === "brace" ? "BR" : "M";
  const used = new Set(members.map((member) => member.id));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export function createMemberFromCanonicalRefs(
  model: StructuralModel,
  input: CreateMemberInput,
): CreateMemberResult {
  if (model.schemaVersion !== "0.5") {
    throw new Error(`CORE_V05_REQUIRED:${model.schemaVersion}`);
  }

  const startNodeId = requireId(input.startNodeId, "START_NODE_ID_REQUIRED");
  const endNodeId = requireId(input.endNodeId, "END_NODE_ID_REQUIRED");
  const materialId = requireId(input.materialId, "MATERIAL_ID_REQUIRED");
  const sectionId = requireId(input.sectionId, "SECTION_ID_REQUIRED");

  if (startNodeId === endNodeId) throw new Error("DISTINCT_MEMBER_NODES_REQUIRED");
  if (!model.nodes.some((node) => node.id === startNodeId)) {
    throw new Error(`UNKNOWN_START_NODE:${startNodeId}`);
  }
  if (!model.nodes.some((node) => node.id === endNodeId)) {
    throw new Error(`UNKNOWN_END_NODE:${endNodeId}`);
  }
  if (!model.materials.some((material) => material.id === materialId)) {
    throw new Error(`UNKNOWN_MATERIAL:${materialId}`);
  }
  if (!model.sections.some((section) => section.id === sectionId)) {
    throw new Error(`UNKNOWN_SECTION:${sectionId}`);
  }

  const member: Member = {
    id: nextMemberId(input.type, model.members),
    type: input.type,
    startNodeId,
    endNodeId,
    materialId,
    sectionId,
  };

  return {
    model: {
      ...model,
      members: [...model.members, member],
    },
    member,
  };
}
