import type { GridLine, Level, Member, MemberType, Node, StructuralModel, Vec3 } from "@linkoteq/structural-core";

export interface CreateNodeInput {
  x: number;
  y: number;
 z: number;
}

export interface CreateLevelInput {
  name: string;
  elevation: number;
}

export interface CreateGridLineInput {
  label: string;
  start: Vec3;
  end: Vec3;
}

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

function nextId(prefix: string, ids: string[]): string {
  const used = new Set(ids);
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

function assertV05(model: StructuralModel) {
  if (model.schemaVersion !== "0.5") {
    throw new Error(`CORE_V05_REQUIRED:${model.schemaVersion}`);
  }
}

function assertFiniteVec3(value: Vec3, code: string) {
  if (![value.x, value.y, value.z].every(Number.isFinite)) throw new Error(code);
}

export function createNodeFromGlobalCoordinates(
  model: StructuralModel,
  input: CreateNodeInput,
): { model: StructuralModel; node: Node } {
  assertV05(model);
  const values = [input.x, input.y, input.z];
  if (!values.every(Number.isFinite)) throw new Error("NODE_COORDINATES_MUST_BE_FINITE");
  const node: Node = {
    id: nextId("N", model.nodes.map((item) => item.id)),
    position: { x: input.x, y: input.y, z: input.z },
  };
  return { model: { ...model, nodes: [...model.nodes, node] }, node };
}

export function createLevel(
  model: StructuralModel,
  input: CreateLevelInput,
): { model: StructuralModel; level: Level } {
  assertV05(model);
  const name = requireId(input.name, "LEVEL_NAME_REQUIRED");
  if (!Number.isFinite(input.elevation)) throw new Error("LEVEL_ELEVATION_MUST_BE_FINITE");

  const level: Level = {
    id: nextId("L", model.levels.map((item) => item.id)),
    name,
    elevation: input.elevation,
  };

  return { model: { ...model, levels: [...model.levels, level] }, level };
}

export function createGridLine(
  model: StructuralModel,
  input: CreateGridLineInput,
): { model: StructuralModel; grid: GridLine } {
  assertV05(model);
  const label = requireId(input.label, "GRID_LABEL_REQUIRED");
  assertFiniteVec3(input.start, "GRID_START_MUST_BE_FINITE");
  assertFiniteVec3(input.end, "GRID_END_MUST_BE_FINITE");

  if (
    input.start.x === input.end.x &&
    input.start.y === input.end.y &&
    input.start.z === input.end.z
  ) {
    throw new Error("GRID_DISTINCT_POINTS_REQUIRED");
  }

  const grid: GridLine = {
    id: nextId("G", model.grids.map((item) => item.id)),
    label,
    start: { ...input.start },
    end: { ...input.end },
  };

  return { model: { ...model, grids: [...model.grids, grid] }, grid };
}

function nextMemberId(type: MemberType, members: Member[]): string {
  const prefix = type === "beam" ? "B" : type === "column" ? "C" : type === "brace" ? "BR" : "M";
  return nextId(prefix, members.map((member) => member.id));
}

export function createMemberFromCanonicalRefs(
  model: StructuralModel,
  input: CreateMemberInput,
): CreateMemberResult {
  assertV05(model);
  const startNodeId = requireId(input.startNodeId, "START_NODE_ID_REQUIRED");
  const endNodeId = requireId(input.endNodeId, "END_NODE_ID_REQUIRED");
  const materialId = requireId(input.materialId, "MATERIAL_ID_REQUIRED");
  const sectionId = requireId(input.sectionId, "SECTION_ID_REQUIRED");

  if (startNodeId === endNodeId) throw new Error("DISTINCT_MEMBER_NODES_REQUIRED");
  if (!model.nodes.some((node) => node.id === startNodeId)) throw new Error(`UNKNOWN_START_NODE:${startNodeId}`);
  if (!model.nodes.some((node) => node.id === endNodeId)) throw new Error(`UNKNOWN_END_NODE:${endNodeId}`);
  if (!model.materials.some((material) => material.id === materialId)) throw new Error(`UNKNOWN_MATERIAL:${materialId}`);
  if (!model.sections.some((section) => section.id === sectionId)) throw new Error(`UNKNOWN_SECTION:${sectionId}`);

  const member: Member = {
    id: nextMemberId(input.type, model.members),
    type: input.type,
    startNodeId,
    endNodeId,
    materialId,
    sectionId,
  };
  return { model: { ...model, members: [...model.members, member] }, member };
}
