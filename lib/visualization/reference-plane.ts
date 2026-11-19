import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";

export const referenceTolerance = 1e-8;

export function gridReferences(model: StructuralModel, axis: "x" | "y") {
  const along = axis === "x" ? "y" : "x";
  return model.grids
    .filter(({ start, end }) => Math.abs(start[axis] - end[axis]) <= referenceTolerance &&
      Math.abs(start[along] - end[along]) > referenceTolerance)
    .map(grid => ({ id: grid.id, label: grid.label, coordinate: grid.start[axis] }))
    .sort((a, b) => a.coordinate - b.coordinate);
}

export function geometryAtReference(model: StructuralModel, axis: keyof Vec3, coordinate: number): StructuralModel {
  const onReference = (value: number) => Math.abs(value - coordinate) <= referenceTolerance;
  const nodes = model.nodes.filter(node => onReference(node.position[axis]));
  const nodeIds = new Set(nodes.map(node => node.id));
  return {
    ...model,
    nodes,
    members: model.members.filter(member => nodeIds.has(member.startNodeId) && nodeIds.has(member.endNodeId)),
    surfaces: model.surfaces.filter(surface => surface.boundaryNodeIds.every(id => nodeIds.has(id))),
    levels: axis === "z" ? model.levels.filter(level => onReference(level.elevation)) : model.levels,
  };
}
