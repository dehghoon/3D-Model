import { Box3, Vector3 } from "three";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { SapHandoff } from "../import/sap2000-handoff";

function geometryBounds(nodes: Map<string, Vec3>, ids: Iterable<string>): Box3 {
  const bounds = new Box3();
  const add = (p?: Vec3) => {
    if (p && [p.x,p.y,p.z].every(Number.isFinite)) bounds.expandByPoint(new Vector3(p.x,p.z,p.y));
  };
  for (const id of ids) add(nodes.get(id));
  if (bounds.isEmpty()) for (const point of nodes.values()) add(point);
  return bounds;
}

export function editableSapFitBounds(model: StructuralModel): Box3 {
  const ids = new Set(model.members.flatMap(m=>[m.startNodeId,m.endNodeId]));
  for (const surface of model.surfaces) for (const id of surface.boundaryNodeIds) ids.add(id);
  return geometryBounds(new Map(model.nodes.map(n=>[n.id,n.position])),ids);
}

export function sourceSapFitBounds(source: SapHandoff): Box3 {
  const {nodes,members,areas} = source.geometryPreview;
  const ids = new Set(members.flatMap(m=>[m.startNodeId,m.endNodeId]));
  for (const area of areas ?? []) for (const id of area.boundaryNodeIds) ids.add(id);
  return geometryBounds(new Map(nodes.map(n=>[n.sourceId,n.position])),ids);
}
