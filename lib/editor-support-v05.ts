import type { StructuralDOF, StructuralModel, Support, SupportRestraints } from "@linkoteq/structural-core";

const DOFS: StructuralDOF[] = ["DX", "DY", "DZ", "RX", "RY", "RZ"];

export interface CreateSupportInput {
  nodeId: string;
  restraints: SupportRestraints;
}

function nextSupportId(supports: Support[]): string {
  const used = new Set(supports.map((support) => support.id));
  let index = 1;
  while (used.has(`SUP${index}`)) index += 1;
  return `SUP${index}`;
}

function normalizeRestraints(restraints: SupportRestraints): SupportRestraints {
  return DOFS.reduce<SupportRestraints>(
    (result, dof) => ({ ...result, [dof]: Boolean(restraints[dof]) }),
    { DX: false, DY: false, DZ: false, RX: false, RY: false, RZ: false },
  );
}

export function createSupportFromCanonicalNode(
  model: StructuralModel,
  input: CreateSupportInput,
): { model: StructuralModel; support: Support } {
  if (model.schemaVersion !== "0.5") {
    throw new Error(`CORE_V05_REQUIRED:${model.schemaVersion}`);
  }

  const nodeId = input.nodeId.trim();
  if (!nodeId) throw new Error("SUPPORT_NODE_ID_REQUIRED");
  if (!model.nodes.some((node) => node.id === nodeId)) {
    throw new Error(`UNKNOWN_SUPPORT_NODE:${nodeId}`);
  }
  if (model.supports.some((support) => support.nodeId === nodeId)) {
    throw new Error(`SUPPORT_ALREADY_EXISTS_FOR_NODE:${nodeId}`);
  }

  const support: Support = {
    id: nextSupportId(model.supports),
    nodeId,
    restraints: normalizeRestraints(input.restraints),
  };

  return {
    model: { ...model, supports: [...model.supports, support] },
    support,
  };
}
