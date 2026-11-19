import * as THREE from "three";
import { gridDisplayEndpoints } from "./grid-display";
import type { GridLine, Node, StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "../editor/selection";

export interface CoreSceneBuild {
  root: THREE.Group;
  pickables: THREE.Object3D[];
  denseNodeHits?: Map<string, THREE.Mesh>;
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
  nodeById: ReadonlyMap<string, Node>,
): THREE.Group | null {
  const startNode = nodeById.get(member.startNodeId);
  const endNode = nodeById.get(member.endNodeId);
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
  nodeById: ReadonlyMap<string, Node>,
): THREE.Mesh | null {
  const nodes = surface.boundaryNodeIds.map(id => nodeById.get(id));
  if (nodes.length < 3 || nodes.some(node => !node)) return null;
  const origin = toThree(nodes[0]!);
  const vertices = nodes.map(node => toThree(node!).sub(origin));
  const normal = new THREE.Vector3();

  for (let index = 1; index < vertices.length - 1; index += 1) {
    normal.add(
      new THREE.Vector3().crossVectors(
        vertices[index],
        vertices[index + 1],
      ),
    );
  }

  if (normal.lengthSq() < 1e-12) return null;
  normal.normalize();

  const offset = vertices.find(
    (vertex, index) =>
      index > 0 && vertex.lengthSq() > 1e-12,
  );
  if (!offset) return null;

  const u = offset.clone().normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  const contour = vertices.map((vertex) => {
    return new THREE.Vector2(vertex.dot(u), vertex.dot(v));
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
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.copy(origin);
  tag(mesh, "surface", surface.id);
  mesh.name = `surface:${surface.id}`;
  return mesh;
}

function gridObject(grids: GridLine[], nodes: Node[]): THREE.Group {
  const group = new THREE.Group();
  group.name = "core-grids";
  const material = new THREE.LineBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.75,
  });

  for (const reference of grids) {
    const grid = gridDisplayEndpoints(reference, nodes);
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
  // Large SAP imports contain thousands of areas; avoid linear node searches
  // for every shell vertex and frame endpoint during each scene rebuild.
  const nodeById = new Map(model.nodes.map(node => [node.id, node]));

  root.add(new THREE.AmbientLight(0xffffff, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(10, 14, 8);
  root.add(key);
  root.add(gridObject(model.grids, model.nodes));

  for (const surface of model.surfaces) {
    const object = surfaceObject(model, surface, selection, nodeById);
    if (!object) continue;
    root.add(object);
    pickables.push(object);
  }

  for (const member of model.members) {
    const object = memberObject(model, member, selection, nodeById);
    if (!object) continue;
    root.add(object);
    for (const child of object.children) pickables.push(child);
  }

  const dense = model.nodes.length >= 500;
  const denseNodeHits = dense ? new Map<string, THREE.Mesh>() : undefined;
  const hitGeometry = new THREE.SphereGeometry(0.34, 10, 8);
  const hitMaterial = new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const markerGeometry = new THREE.SphereGeometry(0.095, 16, 16);
  for (const node of model.nodes) {
    if (!dense) {
      const visible = new THREE.Mesh(markerGeometry, new THREE.MeshStandardMaterial({
        color: selectionMatches(selection,"node",node.id) ? 0xf97316 : 0x2563eb,
      }));
      visible.position.copy(toThree(node));
      tag(visible,"node",node.id);
      root.add(visible);
    }
    const hit = new THREE.Mesh(hitGeometry, hitMaterial);
    hit.visible = false;
    hit.position.copy(toThree(node));
    tag(hit,"node",node.id);
    root.add(hit);
    pickables.push(hit);
    denseNodeHits?.set(node.id,hit);
  }
  if (denseNodeHits) {
    const points = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(model.nodes.map(toThree)),
      new THREE.PointsMaterial({color:0x2563eb,size:2,sizeAttenuation:false,
        opacity:0.42,transparent:true,depthWrite:false}),
    );
    points.name = "core-dense-node-points";
    root.add(points);
    const markers = new THREE.Group();
    markers.name = "core-dense-node-selection";
    root.add(markers);
  }
  if (!model.nodes.length) {hitGeometry.dispose();hitMaterial.dispose();}
  if (dense || !model.nodes.length) markerGeometry.dispose();
  const build = {root, pickables, denseNodeHits};
  if (selection?.type === "node") syncDenseNodeSelection(build, [selection.id]);
  return build;
}

export function syncDenseNodeSelection(build: CoreSceneBuild, ids: string[]): void {
  const markers = build.root.getObjectByName("core-dense-node-selection");
  if (!markers || !build.denseNodeHits) return;
  disposeCoreScene(markers);
  markers.clear();
  for (const id of ids) {
    const hit = build.denseNodeHits.get(id);
    if (!hit) continue;
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.13,12,10),
      new THREE.MeshBasicMaterial({color:0xf97316,depthTest:false}));
    marker.position.copy(hit.position);
    tag(marker,"node",id);
    markers.add(marker);
  }
}

export function disposeCoreScene(root: THREE.Object3D): void {
  const disposedMaterials = new Set<THREE.Material>();
  const disposedGeometries = new Set<THREE.BufferGeometry>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
      mesh.geometry.dispose();
      disposedGeometries.add(mesh.geometry);
    }

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

