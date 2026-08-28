"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import type { Member, Node, StructuralModel, Surface } from "@linkoteq/structural-core";
import LoadManager from "./LoadManager";
import MemberCreatorV05 from "./MemberCreatorV05";
import NodeCreatorV05 from "./NodeCreatorV05";
import SelectedNodeSupportV05 from "./SelectedNodeSupportV05";
import { assertCanonicalV05, migrateProjectToV05 } from "../lib/core-v05";

type Selection =
  | { type: "node"; id: string }
  | { type: "member"; id: string }
  | { type: "surface"; id: string }
  | null;

function emptyModel(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "PROJECT001", name: "3D Model", units: "SI" },
    levels: [], grids: [], nodes: [], members: [], surfaces: [], diaphragms: [],
    materials: [], sections: [], supports: [], loadSources: [], loadCases: [],
    loads: [], loadCombinations: [],
  };
}

function downloadModel(model: StructuralModel) {
  assertCanonicalV05(model);
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${model.project.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function position(node: Node): [number, number, number] {
  return [node.position.x, node.position.z, node.position.y];
}

function MemberMesh({ member, nodes, selected, onSelect }: {
  member: Member; nodes: Node[]; selected: boolean; onSelect: () => void;
}) {
  const a = nodes.find((node) => node.id === member.startNodeId);
  const b = nodes.find((node) => node.id === member.endNodeId);
  const geometry = useMemo(() => {
    if (!a || !b) return null;
    const p = new THREE.Vector3(...position(a));
    const q = new THREE.Vector3(...position(b));
    const direction = q.clone().sub(p);
    const length = direction.length();
    if (!length) return null;
    const result = new THREE.BoxGeometry(selected ? 0.28 : 0.22, length, selected ? 0.28 : 0.22);
    result.translate(0, length / 2, 0);
    result.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), direction.normalize(),
    ));
    result.translate(p.x, p.y, p.z);
    return result;
  }, [a, b, selected]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <meshStandardMaterial color={selected ? "#f97316" : member.type === "column" ? "#2563eb" : "#26734d"} />
    </mesh>
  );
}

function buildSurfaceGeometry(points: Node[]): THREE.BufferGeometry | null {
  if (points.length < 3) return null;
  const vertices = points.map((node) => new THREE.Vector3(...position(node)));
  const origin = vertices[0];
  const normal = new THREE.Vector3();
  for (let i = 1; i < vertices.length - 1; i += 1) {
    normal.add(new THREE.Vector3().crossVectors(
      vertices[i].clone().sub(origin), vertices[i + 1].clone().sub(origin),
    ));
  }
  if (normal.lengthSq() < 1e-12) return null;
  normal.normalize();
  const u = vertices.find((v, index) => index > 0 && v.distanceToSquared(origin) > 1e-12);
  if (!u) return null;
  const uAxis = u.clone().sub(origin).normalize();
  const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
  const contour = vertices.map((v) => {
    const relative = v.clone().sub(origin);
    return new THREE.Vector2(relative.dot(uAxis), relative.dot(vAxis));
  });
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  if (!faces.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(
    vertices.flatMap((v) => [v.x, v.y, v.z]), 3,
  ));
  geometry.setIndex(faces.flat());
  geometry.computeVertexNormals();
  return geometry;
}

function SurfaceMesh({ surface, nodes, selected, onSelect }: {
  surface: Surface; nodes: Node[]; selected: boolean; onSelect: () => void;
}) {
  const points = useMemo(
    () => surface.boundaryNodeIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is Node => Boolean(node)),
    [surface.boundaryNodeIds, nodes],
  );
  const geometry = useMemo(() => buildSurfaceGeometry(points), [points]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <meshStandardMaterial color={selected ? "#f97316" : "#9ca3af"} transparent opacity={0.48} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Scene({ model, selection, onSelect }: {
  model: StructuralModel; selection: Selection; onSelect: (selection: Selection) => void;
}) {
  return (
    <>
      <color attach="background" args={["#eef3f8"]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[10, 14, 8]} intensity={1.8} />
      {model.grids.map((grid) => {
        const points = [
          new THREE.Vector3(grid.start.x, grid.start.z + 0.01, grid.start.y),
          new THREE.Vector3(grid.end.x, grid.end.z + 0.01, grid.end.y),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <lineSegments key={grid.id} geometry={geometry}>
            <lineBasicMaterial color="#64748b" transparent opacity={0.7} />
          </lineSegments>
        );
      })}
      {model.surfaces.map((surface) => (
        <SurfaceMesh key={surface.id} surface={surface} nodes={model.nodes}
          selected={selection?.type === "surface" && selection.id === surface.id}
          onSelect={() => onSelect({ type: "surface", id: surface.id })} />
      ))}
      {model.members.map((member) => (
        <MemberMesh key={member.id} member={member} nodes={model.nodes}
          selected={selection?.type === "member" && selection.id === member.id}
          onSelect={() => onSelect({ type: "member", id: member.id })} />
      )}
      {model.nodes.map((node) => (
        <mesh key={node.id} position={position(node)}
          onClick={(event) => { event.stopPropagation(); onSelect({ type: "node", id: node.id }); }}>
          <sphereGeometry args={[selection?.type === "node" && selection.id === node.id ? 0.15 : 0.095, 16, 16]} />
          <meshStandardMaterial color={selection?.type === "node" && selection.id === node.id ? "#f97316" : "#2563eb"} />
        </mesh>
      ))}
      <Grid args={[40, 40]} cellSize={1} sectionSize={5} fadeDistance={45} />
      <OrbitControls makeDefault enablePan enableZoom />
    </>
  );
}

export default function StructuralEditorV05() {
  const [model, setModel] = useState<StructuralModel>(() => emptyModel());
  const [selection, setSelection] = useState<Selection>(null);
  const [message, setMessage] = useState("Core v0.5 model ready.");
  const inputRef = useRef<HTMLInputElement>(null);

  async function importProject(file: File) {
    const parsed = JSON.parse(await file.text()) as unknown;
    const migrated = migrateProjectToV05(parsed);
    assertCanonicalV05(migrated.model);
    setModel(migrated.model as StructuralModel);
    setSelection(null);
    setMessage(migrated.warnings.length ? migrated.warnings.join(" ") : "Core v0.5 project imported.");
  }

  function selectedLabel() {
    if (!selection) return "None";
    return `${selection.type}: ${selection.id}`;
  }

  function applyModelChange(next: StructuralModel, status: string) {
    try {
      assertCanonicalV05(next);
      setModel(next);
      setMessage(status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Core v0.5 model update failed.");
    }
  }

  const selectedNodes = selection?.type === "node"
    ? model.nodes.filter((item) => item.id === selection.id)
    : [];

  return (
    <div className="appShell">
      <header className="topbar">
        <strong>Linkoteq 3D Structural Editor</strong>
        <div className="topActions">
          <button onClick={() => {
            setModel(emptyModel()); setSelection(null); setMessage("New Core v0.5 project created.");
          }}>New</button>
          <button onClick={() => inputRef.current?.click()}>Open</button>
          <button onClick={() => downloadModel(model)}>Save</button>
          <input ref={inputRef} hidden type="file" accept=".json,.ltq,application/json"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (file) importProject(file).catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : "Import failed.");
              });
              event.target.value = "";
            }} />
        </div>
      </header>
      <div className="importbar">
        <span>Core schema: {model.schemaVersion}</span>
        <span>Project: {model.project.id}</span>
        <span className="statusText">{message}</span>
      </div>
      <main className="workspace">
        <aside className="toolbar">
          <section className="panelBlock">
            <h3>Model</h3>
            <div className="selectionText">Nodes: {model.nodes.length}</div>
            <div className="selectionText">Members: {model.members.length}</div>
            <div className="selectionText">Surfaces: {model.surfaces.length}</div>
            <div className="selectionText">Materials: {model.materials.length}</div>
            <div className="selectionText">Sections: {model.sections.length}</div>
          </section>
          <NodeCreatorV05 model={model} onModelChange={applyModelChange}
            onNodeCreated={(nodeId) => setSelection({ type: "node", id: nodeId })} />
          <MemberCreatorV05 model={model} onModelChange={applyModelChange}
            onMemberCreated={(memberId) => setSelection({ type: "member", id: memberId })} />
          <SelectedNodeSupportV05
            model={model}
            selectedNodes={selectedNodes}
            onModelChange={applyModelChange}
          />
          <section className="panelBlock">
            <h3>Selection</h3>
            <div className="selectionText">{selectedLabel()}</div>
            <button onClick={() => setSelection(null)} disabled={!selection}>Clear selection</button>
          </section>
          <section className="panelBlock">
            <h3>Core v0.5</h3>
            <p className="selectionText">
              Geometry is edited only through canonical Core entities. Engineering properties are never synthesized by the UI.
            </p>
          </section>
        </aside>
        <section className="viewport" onContextMenu={(event) => event.preventDefault()}>
          <Canvas shadows camera={{ position: [18, 12, 18], fov: 45 }} onPointerMissed={() => setSelection(null)}>
            <Scene model={model} selection={selection} onSelect={setSelection} />
          </Canvas>
          <div className="viewControls">Orbit · Pan · Zoom</div>
        </section>
        <aside className="inspector">
          <h2>Inspector</h2>
          <p className="selectionText">{selectedLabel()}</p>
          <details><summary>Core Model JSON</summary><pre>{JSON.stringify(model, null, 2)}</pre></details>
        </aside>
      </main>
      <LoadManager
        model={model}
        selectedSurfaces={selection?.type === "surface" ? model.surfaces.filter((item) => item.id === selection.id) : []}
        selectedMembers={selection?.type === "member" ? model.members.filter((item) => item.id === selection.id) : []}
        selectedNodes={selectedNodes}
        onModelChange={(next, status) => {
          assertCanonicalV05(next);
          setModel(next);
          if (status) setMessage(status);
        }}
        onBeginTargetSelection={() => setMessage("Select a model target for load assignment.")}
        onEndTargetSelection={() => setMessage("Load target selection finished.")}
      />
    </div>
  );
}
