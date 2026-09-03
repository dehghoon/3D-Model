import * as THREE from "three";
import type { GridLine, Node, StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";

export interface CoreSceneBuild {
  root: THREE.Group;
  pickables: THREE.Object3D[];
}

function toThree(node: Node): THREE.Vector3 {
  return new THREE.Vector3(node.position.x, node.position.z, node.position.y);
}

function selectionMatches(
  selection: EditorSelection,
  type: "node" | "member" | "surface",
  id: string,
): boolean {
  return Boolean(selection && selection.type === type && selection.id === id);
}

function tag(
  object: THREE.Object3D,
  type: "node" | "member" | "surface",
  id: string,
): void {
  object.userData.linkoteqSelection = { type, id };
}

function orientedBox(
  start: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  width: number,
): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(width, length, width);
  geometry.translate(0, length / 2, 0);
  geometry.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    ),
  );
  geometry.translate(start.x, start.y, start.z);
  return geometry;
}

function memberObject(
  model: StructuralModel,
  member: StructuralModel["members"][number],
  selection: EditorSelection,
): THREE.Group | null {
  const startNode = model.nodes.find((node) => node.id === member.startNodeId);
  const endNode = model.nodes.find((node) => node.id === member.endNodeId);
  if (!startNode || !endNode) return null;

  const start = toThree(startNode);
  const end = toThree(endNode);
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 1e-9) return null;

  const selected = selectionMatches(selection, "member", member.id);
  const group = new THREE.Group();
  group.name = `member:${member.id}`;

  const geometry = orientedBox(
    start,
    direction,
    length,
    selected ? 0.28 : 0.22,
  );
  const visible = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color:
        selected
          ? 0xf97316
          : member.type === "column"
            ? 0x2563eb
            : 0x26734d,
    }),
  );
  tag(visible, "member", member.id);
  group.add(visible);

  // Keep member hit geometry away from its end nodes so node picking is
  // unambiguous at structural joints. The visible member remains full length.
  const endClearance = Math.min(0.34, length * 0.22);
  const hitLength = Math.max(length - endClearance * 2, length * 0.4);
  const actualClearance = (length - hitLength) / 2;
  const hitStart = start
    .clone()
    .add(direction.clone().normalize().multiplyScalar(actualClearance));
  const hitGeometry = orientedBox(hitStart, direction, hitLength, 0.42);

  const hit = new THREE.Mesh(
    hitGeometry,
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  tag(hit, "member", member.id);
  group.add(hit);

  return group;
}

function surfaceObject(
  model: StructuralModel,
  surface: StructuralModel["surfaces"][number],
  selection: EditorSelection,
): THREE.Mesh | null {
  const nodes = surface.boundaryNodeIds
    .map((id) => model.nodes.find((node) => node.id === id))
    .filter((node): node is Node => Boolean(node));

  if (nodes.length < 3) return null;

  const vertices = nodes.map(toThree);
  const origin = vertices[0];
  const normal = new THREE.Vector3();

  for (let index = 1; index < vertices.length - 1; index += 1) {
    normal.add(
      new THREE.Vector3().crossVectors(
        vertices[index].clone().sub(origin),
        vertices[index + 1].clone().sub(origin),
      ),
    );
  }

  if (normal.lengthSq() < 1e-12) return null;
  normal.normalize();

  const offset = vertices.find(
    (vertex, index) =>
      index > 0 && vertex.distanceToSquared(origin) > 1e-12,
  );
  if (!offset) return null;

  const u = offset.clone().sub(origin).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  const contour = vertices.map((vertex) => {
    const relative = vertex.clone().sub(origin);
    return new THREE.Vector2(relative.dot(u), relative.dot(v));
  });

  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  if (!faces.length) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      vertices.flatMap((point) => [point.x, point.y, point.z]),
      3,
    ),
  );
  geometry.setIndex(faces.flat());
  geometry.computeVertexNormals();

  const selected = selectionMatches(selection, "surface", surface.id);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: selected ? 0xf97316 : 0x9ca3af,
      transparent: true,
      opacity: selected ? 0.72 : 0.48,
      side: THREE.DoubleSide,
    }),
  );
  tag(mesh, "surface", surface.id);
  mesh.name = `surface:${surface.id}`;
  return mesh;
}

function gridObject(grids: GridLine[]): THREE.Group {
  const group = new THREE.Group();
  group.name = "core-grids";
  const material = new THREE.LineBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.75,
  });

  for (const grid of grids) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(grid.start.x, 0.02, grid.start.y),
      new THREE.Vector3(grid.end.x, 0.02, grid.end.y),
    ]);
    group.add(new THREE.Line(geometry, material));
  }

  return group;
}

export function buildCoreScene(
  model: StructuralModel,
  selection: EditorSelection,
): CoreSceneBuild {
  const root = new THREE.Group();
  root.name = "linkoteq-core-scene";
  const pickables: THREE.Object3D[] = [];

  root.add(new THREE.AmbientLight(0xffffff, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(10, 14, 8);
  root.add(key);
  root.add(gridObject(model.grids));

  for (const surface of model.surfaces) {
    const object = surfaceObject(model, surface, selection);
    if (!object) continue;
    root.add(object);
    pickables.push(object);
  }

  for (const member of model.members) {
    const object = memberObject(model, member, selection);
    if (!object) continue;
    root.add(object);
    for (const child of object.children) pickables.push(child);
  }

  for (const node of model.nodes) {
    const selected = selectionMatches(selection, "node", node.id);

    const visible = new THREE.Mesh(
      new THREE.SphereGeometry(selected ? 0.15 : 0.095, 16, 16),
      new THREE.MeshStandardMaterial({
        color: selected ? 0xf97316 : 0x2563eb,
      }),
    );
    visible.position.copy(toThree(node));
    tag(visible, "node", node.id);
    root.add(visible);
    pickables.push(visible);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 14, 14),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    hit.position.copy(toThree(node));
    tag(hit, "node", node.id);
    root.add(hit);
    pickables.push(hit);
  }

  return { root, pickables };
}

export function disposeCoreScene(root: THREE.Object3D): void {
  const disposedMaterials = new Set<THREE.Material>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => {
        if (!disposedMaterials.has(item)) {
          item.dispose();
          disposedMaterials.add(item);
        }
      });
    } else if (material && !disposedMaterials.has(material)) {
      material.dispose();
      disposedMaterials.add(material);
    }
  });
}

export function getObjectSelection(
  object: THREE.Object3D,
): Exclude<EditorSelection, null> | null {
  let current: THREE.Object3D | null = object;

  while (current) {
    const value = current.userData.linkoteqSelection as
      | {
          type?: "node" | "member" | "surface";
          id?: string;
        }
      | undefined;

    if (value?.type && value.id) {
      return { type: value.type, id: value.id };
    }

    current = current.parent;
  }

  return null;
}
