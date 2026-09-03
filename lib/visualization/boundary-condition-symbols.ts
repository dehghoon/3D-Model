import * as THREE from "three";
import type { MemberEndRelease, StructuralModel } from "@linkoteq/structural-core";

function toThreePosition(position: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(position.x, position.z, position.y);
}

function hasRelease(release: MemberEndRelease | undefined): boolean {
  return release ? Object.values(release).some(Boolean) : false;
}

function modelScale(model: StructuralModel): number {
  if (!model.nodes.length) return 0.25;
  const xs = model.nodes.map((node) => node.position.x);
  const ys = model.nodes.map((node) => node.position.y);
  const zs = model.nodes.map((node) => node.position.z);
  const span = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    Math.max(...zs) - Math.min(...zs),
    1,
  );
  return Math.min(
    Math.max(span * 0.018, 0.14),
    0.42,
  );
}

function makeReleaseSymbol(position: THREE.Vector3, memberDirection: THREE.Vector3, size: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(size * 0.42, size * 0.09, 8, 28),
    material,
  );
  ring.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    memberDirection.clone().normalize(),
  );
  ring.position.copy(position);
  ring.renderOrder = 120;
  group.add(ring);
  return group;
}

function makeSupportSymbol(position: THREE.Vector3, size: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0x2563eb,
    depthTest: false,
    depthWrite: false,
  });
  const y = position.y;
  const points = [
    new THREE.Vector3(position.x, y, position.z),
    new THREE.Vector3(position.x - size * 0.55, y - size * 0.8, position.z),
    new THREE.Vector3(position.x + size * 0.55, y - size * 0.8, position.z),
    new THREE.Vector3(position.x, y, position.z),
  ];
  const triangle = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    material,
  );
  triangle.renderOrder = 120;
  group.add(triangle);

  const base = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(position.x - size * 0.75, y - size * 0.92, position.z),
      new THREE.Vector3(position.x + size * 0.75, y - size * 0.92, position.z),
    ]),
    material,
  );
  base.renderOrder = 120;
  group.add(base);
  return group;
}

export function buildBoundaryConditionSymbols(model: StructuralModel): THREE.Group {
  const root = new THREE.Group();
  root.name = "core-boundary-condition-symbols";
  const size = modelScale(model);
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));

  for (const support of model.supports) {
    const node = nodes.get(support.nodeId);
    if (!node) continue;
    const symbol = makeSupportSymbol(toThreePosition(node.position), size);
    symbol.name = `support-symbol:${support.id}`;
    root.add(symbol);
  }

  for (const member of model.members) {
    const startNode = nodes.get(member.startNodeId);
    const endNode = nodes.get(member.endNodeId);
    if (!startNode || !endNode) continue;
    const start = toThreePosition(startNode.position);
    const end = toThreePosition(endNode.position);
    const direction = end.clone().sub(start);
    if (direction.lengthSq() < 1e-12) continue;

    if (hasRelease(member.startRelease)) {
      const symbol = makeReleaseSymbol(start, direction, size);
      symbol.name = `release-symbol:${member.id}:start`;
      root.add(symbol);
    }

    if (hasRelease(member.endRelease)) {
      const symbol = makeReleaseSymbol(end, direction, size);
      symbol.name = `release-symbol:${member.id}:end`;
      root.add(symbol);
    }
  }

  return root;
}
