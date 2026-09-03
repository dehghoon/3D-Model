import type { StructuralModel } from "@linkoteq/structural-core";
import { createSupportFromCanonicalNode } from "./editor-support-v05";

const ELEVATION_EPSILON = 1e-9;

export interface DefaultBaseSupportOptions {
  onlyNodeIds?: ReadonlySet<string>;
}

export function applyDefaultBaseSupports(
  model: StructuralModel,
  options: DefaultBaseSupportOptions = {},
): StructuralModel {
  const base = model.levels.find(
    (level) => level.name.trim().toLowerCase() === "base",
  );
  if (!base) return model;

  const supportedNodeIds = new Set(
    model.supports.map((support) => support.nodeId),
  );

  const candidates = model.nodes.filter((node) => {
    if (supportedNodeIds.has(node.id)) return false;
    if (options.onlyNodeIds && !options.onlyNodeIds.has(node.id)) return false;

    if (node.levelId) return node.levelId === base.id;
    return Math.abs(node.position.z - base.elevation) <= ELEVATION_EPSILON;
  });

  let next = model;
  for (const node of candidates) {
    next = createSupportFromCanonicalNode(next, {
      nodeId: node.id,
      restraints: {
        DX: true,
        DY: true,
        DZ: true,
        RX: false,
        RY: false,
        RZ: false,
      },
    }).model;
  }

  return next;
}
