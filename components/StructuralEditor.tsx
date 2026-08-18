"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useState } from "react";
import type { Member, Node, StructuralModel, Surface } from "@linkoteq/structural-core";

type Tool = "select" | "beam" | "column" | "brace" | "wall" | "slab";

const baseModel: StructuralModel = {
  schemaVersion: "0.1",
  project: { id: "P001", name: "3D Model Prototype", units: "SI" },
  levels: [
    { id: "L0", name: "Ground", elevation: 0 },
    { id: "L1", name: "Level 1", elevation: 3.5 }
  ],
  grids: [],
  nodes: [
    { id: "N1", position: { x: 0, y: 0, z: 0 }, levelId: "L0" },
    { id: "N2", position: { x: 6, y: 0, z: 0 }, levelId: "L0" },
    { id: "N3", position: { x: 0, y: 0, z: 3.5 }, levelId: "L1" },
    { id: "N4", position: { x: 6, y: 0, z: 3.5 }, levelId: "L1" }
  ],
  members: [
    { id: "C1", type: "column", startNodeId: "N1", endNodeId: "N3" },
    { id: "C2", type: "column", startNodeId: "N2", endNodeId: "N4" },
    { id: "B1", type: "beam", startNodeId: "N3", endNodeId: "N4", levelId: "L1" }
  ],
  surfaces: [], diaphragms: [], materials: [], sections: [], supports: [], loadCases: [], loads: [], loadCombinations: []
};

function toVector(node: Node) {
  const { x, y, z } = node.position;
  return new THREE.Vector3(x, z, y);
}

function MemberMesh({ member, nodes }: { member: Member; nodes: Node[] }) {
  const startNode = nodes.find((n) => n.id === member.startNodeId);
  const endNode = nodes.find((n) => n.id === member.endNodeId);
  const geometry = useMemo(() => {
    if (!startNode || !endNode) return null;
    const a = toVector(startNode);
    const b = toVector(endNode);
    const direction = b.clone().sub(a);
    const length = direction.length();
    const g = new THREE.BoxGeometry(0.22, length, 0.22);
    g.translate(0, length / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    return g;
  }, [startNode, endNode]);
  if (!geometry) return null;
  const color = member.type === "column" ? "#2367a8" : member.type === "brace" ? "#d97706" : "#3f7d4f";
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} metalness={0.25} roughness={0.55} /></mesh>;
}

function SurfaceMesh({ surface, nodes }: { surface: Surface; nodes: Node[] }) {
  const pts = surface.boundaryNodeIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as Node[];
  if (pts.length < 3) return null;
  if (surface.type === "slab") {
    const xs = pts.map((n) => n.position.x); const ys = pts.map((n) => n.position.y); const zs = pts.map((n) => n.position.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), z = zs[0];
    return <mesh position={[(minX + maxX) / 2, z, (minY + maxY) / 2]} receiveShadow>
      <boxGeometry args={[maxX - minX, 0.12, maxY - minY]} /><meshStandardMaterial color="#9ca3af" transparent opacity={0.55} />
    </mesh>;
  }
  const a = pts[0], b = pts[1];
  const ax = a.position.x, ay = a.position.y, az = a.position.z;
  const bx = b.position.x, by = b.position.y;
  const length = Math.hypot(bx - ax, by - ay);
  const angle = Math.atan2(by - ay, bx - ax);
  return <mesh position={[(ax + bx) / 2, az + 1.75, (ay + by) / 2]} rotation={[0, -angle, 0]} receiveShadow castShadow>
    <boxGeometry args={[length, 3.5, 0.15]} /><meshStandardMaterial color="#8b5e3c" transparent opacity={0.65} />
  </mesh>;
}

function Scene({ model }: { model: StructuralModel }) {
  return <Canvas shadows camera={{ position: [10, 8, 12], fov: 45 }}>
    <color attach="background" args={["#edf2f7"]} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[8, 12, 6]} intensity={2} castShadow />
    {model.members.map((m) => <MemberMesh key={m.id} member={m} nodes={model.nodes} />)}
    {model.surfaces.map((s) => <SurfaceMesh key={s.id} surface={s} nodes={model.nodes} />)}
    <Grid position={[3, -0.02, 2]} args={[18, 18]} cellSize={1} sectionSize={6} infiniteGrid fadeDistance={28} />
    <OrbitControls makeDefault target={[3, 1.5, 2]} />
  </Canvas>;
}

function nextId(prefix: string, count: number) { return `${prefix}${count + 1}`; }

export default function StructuralEditor() {
  const [tool, setTool] = useState<Tool>("select");
  const [model, setModel] = useState<StructuralModel>(baseModel);

  function addDemo(type: Exclude<Tool, "select">) {
    setTool(type);
    setModel((m) => {
      const nodes = [...m.nodes]; const members = [...m.members]; const surfaces = [...m.surfaces];
      const n = nodes.length;
      if (type === "beam") {
        nodes.push({ id: nextId("N", n), position: { x: 0, y: 4, z: 3.5 }, levelId: "L1" }, { id: nextId("N", n + 1), position: { x: 6, y: 4, z: 3.5 }, levelId: "L1" });
        members.push({ id: nextId("B", members.filter(x => x.type === "beam").length), type: "beam", startNodeId: nodes[n].id, endNodeId: nodes[n + 1].id, levelId: "L1" });
      } else if (type === "column") {
        nodes.push({ id: nextId("N", n), position: { x: 6, y: 4, z: 0 }, levelId: "L0" }, { id: nextId("N", n + 1), position: { x: 6, y: 4, z: 3.5 }, levelId: "L1" });
        members.push({ id: nextId("C", members.filter(x => x.type === "column").length), type: "column", startNodeId: nodes[n].id, endNodeId: nodes[n + 1].id });
      } else if (type === "brace") {
        members.push({ id: nextId("BR", members.filter(x => x.type === "brace").length), type: "brace", startNodeId: "N1", endNodeId: "N4" });
      } else if (type === "wall") {
        nodes.push({ id: nextId("N", n), position: { x: 0, y: 4, z: 0 }, levelId: "L0" }, { id: nextId("N", n + 1), position: { x: 6, y: 4, z: 0 }, levelId: "L0" });
        surfaces.push({ id: nextId("W", surfaces.filter(x => x.type === "wall").length), type: "wall", boundaryNodeIds: [nodes[n].id, nodes[n + 1].id], levelId: "L0", thickness: 0.15 });
      } else if (type === "slab") {
        const ids: string[] = [];
        [[0,0],[6,0],[6,4],[0,4]].forEach(([x,y], i) => { const id = nextId("N", n + i); ids.push(id); nodes.push({ id, position: { x, y, z: 3.5 }, levelId: "L1" }); });
        surfaces.push({ id: nextId("S", surfaces.filter(x => x.type === "slab").length), type: "slab", boundaryNodeIds: ids, levelId: "L1", thickness: 0.18 });
      }
      return { ...m, nodes, members, surfaces };
    });
  }

  return <main className="appShell">
    <header className="topbar"><div><strong>Linkoteq 3D Structural Model</strong><span>Core contract v{model.schemaVersion}</span></div><button onClick={() => setModel(baseModel)}>Reset</button></header>
    <section className="workspace">
      <aside className="toolbar">
        <button className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}>Select</button>
        {(["beam","column","brace","wall","slab"] as const).map((t) => <button key={t} className={tool === t ? "active" : ""} onClick={() => addDemo(t)}>+ {t[0].toUpperCase() + t.slice(1)}</button>)}
        <div className="stats"><span>{model.nodes.length} nodes</span><span>{model.members.length} members</span><span>{model.surfaces.length} surfaces</span></div>
      </aside>
      <div className="viewport"><Scene model={model} /><div className="hint">Drag to orbit · Scroll to zoom · Tool buttons add test entities</div></div>
      <aside className="inspector"><h2>Model JSON</h2><pre>{JSON.stringify({ members: model.members, surfaces: model.surfaces }, null, 2)}</pre></aside>
    </section>
  </main>;
}
