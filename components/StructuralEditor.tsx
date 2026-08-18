"use client";

import { Canvas, ThreeEvent } from "@react-three/fiber";
import { Grid, Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import type { GridLine, Load, LoadCase, Member, Node, StructuralModel, Surface } from "@linkoteq/structural-core";

type Tool = "select" | "beam" | "column" | "brace" | "wall" | "slab";
type UploadKind = "ai" | "dxf" | "ifc";
type LoadCategory = "dead" | "live" | "wind" | "seismic";

const X_GRID = [0, 6, 12];
const Y_GRID = [0, 4, 8];
const LEVELS = [
  { id: "L0", name: "Ground", elevation: 0 },
  { id: "L1", name: "Level 1", elevation: 3.5 }
];

function buildGridLines(): GridLine[] {
  const xLines = X_GRID.map((x, i) => ({ id: `GX${i + 1}`, label: String.fromCharCode(65 + i), start: { x, y: -1, z: 0 }, end: { x, y: 9, z: 0 } }));
  const yLines = Y_GRID.map((y, i) => ({ id: `GY${i + 1}`, label: `${i + 1}`, start: { x: -1, y, z: 0 }, end: { x: 13, y, z: 0 } }));
  return [...xLines, ...yLines];
}

function buildGridNodes(): Node[] {
  const nodes: Node[] = [];
  let index = 1;
  for (const level of LEVELS) {
    for (const y of Y_GRID) {
      for (const x of X_GRID) {
        nodes.push({ id: `N${index++}`, position: { x, y, z: level.elevation }, levelId: level.id });
      }
    }
  }
  return nodes;
}

const baseModel: StructuralModel = {
  schemaVersion: "0.1",
  project: { id: "P001", name: "3D Model Prototype", units: "SI" },
  levels: LEVELS,
  grids: buildGridLines(),
  nodes: buildGridNodes(),
  members: [],
  surfaces: [],
  diaphragms: [], materials: [], sections: [], supports: [], loadCases: [], loads: [], loadCombinations: []
};

function toVector(node: Node) {
  const { x, y, z } = node.position;
  return new THREE.Vector3(x, z, y);
}

function nextId(prefix: string, count: number) { return `${prefix}${count + 1}`; }

function MemberMesh({ member, nodes }: { member: Member; nodes: Node[] }) {
  const startNode = nodes.find((n) => n.id === member.startNodeId);
  const endNode = nodes.find((n) => n.id === member.endNodeId);
  const geometry = useMemo(() => {
    if (!startNode || !endNode) return null;
    const a = toVector(startNode);
    const b = toVector(endNode);
    const direction = b.clone().sub(a);
    const length = direction.length();
    if (!length) return null;
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
  if (surface.type === "slab" && pts.length >= 3) {
    const shape = new THREE.Shape();
    pts.forEach((n, i) => i === 0 ? shape.moveTo(n.position.x, n.position.y) : shape.lineTo(n.position.x, n.position.y));
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    return <mesh geometry={geometry} position={[0, pts[0].position.z + 0.02, 0]} receiveShadow>
      <meshStandardMaterial color="#9ca3af" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>;
  }
  if (surface.type === "wall" && pts.length >= 2) {
    const a = pts[0], b = pts[1];
    const length = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
    const angle = Math.atan2(b.position.y - a.position.y, b.position.x - a.position.x);
    return <mesh position={[(a.position.x + b.position.x) / 2, a.position.z + 1.75, (a.position.y + b.position.y) / 2]} rotation={[0, -angle, 0]} castShadow>
      <boxGeometry args={[length, 3.5, 0.15]} /><meshStandardMaterial color="#8b5e3c" transparent opacity={0.65} />
    </mesh>;
  }
  return null;
}

function ModelGrid({ grid, elevation = 0 }: { grid: GridLine; elevation?: number }) {
  const points = useMemo<[number, number, number][]>(() => [
    [grid.start.x, elevation + 0.01, grid.start.y],
    [grid.end.x, elevation + 0.01, grid.end.y]
  ], [grid, elevation]);
  return <Line points={points} color="#6b7280" lineWidth={1} dashed dashSize={0.18} gapSize={0.12} />;
}

function NodePoint({ node, selected, onClick }: { node: Node; selected: boolean; onClick: (node: Node) => void }) {
  const p = toVector(node);
  return <group position={p}>
    <mesh onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(node); }}>
      <sphereGeometry args={[selected ? 0.16 : 0.11, 20, 20]} />
      <meshStandardMaterial color={selected ? "#f97316" : "#1d4ed8"} emissive={selected ? "#7c2d12" : "#000000"} />
    </mesh>
    <Html position={[0, 0.24, 0]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
      <span className="nodeLabel">{node.id}</span>
    </Html>
  </group>;
}

function Scene({ model, selectedIds, onNodeClick }: { model: StructuralModel; selectedIds: string[]; onNodeClick: (node: Node) => void }) {
  return <Canvas shadows camera={{ position: [16, 10, 16], fov: 44 }}>
    <color attach="background" args={["#edf2f7"]} />
    <ambientLight intensity={1.15} />
    <directionalLight position={[10, 14, 8]} intensity={2} castShadow />
    {model.levels.map((level) => model.grids.map((g) => <ModelGrid key={`${level.id}-${g.id}`} grid={g} elevation={level.elevation} />))}
    {model.nodes.map((n) => <NodePoint key={n.id} node={n} selected={selectedIds.includes(n.id)} onClick={onNodeClick} />)}
    {model.members.map((m) => <MemberMesh key={m.id} member={m} nodes={model.nodes} />)}
    {model.surfaces.map((s) => <SurfaceMesh key={s.id} surface={s} nodes={model.nodes} />)}
    <Grid position={[6, -0.02, 4]} args={[20, 16]} cellSize={1} sectionSize={4} infiniteGrid fadeDistance={34} />
    <OrbitControls makeDefault target={[6, 1.8, 4]} />
  </Canvas>;
}

export default function StructuralEditor() {
  const [tool, setTool] = useState<Tool>("select");
  const [model, setModel] = useState<StructuralModel>(baseModel);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState("Choose a tool, then click grid nodes.");
  const [uploaded, setUploaded] = useState<string[]>([]);
  const aiInput = useRef<HTMLInputElement>(null);
  const dxfInput = useRef<HTMLInputElement>(null);
  const ifcInput = useRef<HTMLInputElement>(null);

  function chooseTool(next: Tool) {
    setTool(next);
    setSelectedIds([]);
    setStatus(next === "select" ? "Select mode." : `${next}: click required grid nodes.`);
  }

  function createFromSelection(ids: string[]) {
    const selectedNodes = ids.map((id) => model.nodes.find((n) => n.id === id)).filter(Boolean) as Node[];
    if (tool === "slab") {
      if (selectedNodes.length < 4) { setStatus(`Slab: select ${4 - selectedNodes.length} more node(s).`); return; }
      const sameLevel = selectedNodes.every((n) => n.levelId === selectedNodes[0].levelId);
      if (!sameLevel) { setStatus("Slab nodes must be on the same level."); setSelectedIds([]); return; }
      setModel((m) => ({ ...m, surfaces: [...m.surfaces, { id: nextId("S", m.surfaces.filter((s) => s.type === "slab").length), type: "slab", boundaryNodeIds: ids.slice(0, 4), levelId: selectedNodes[0].levelId, thickness: 0.18 }] }));
      setSelectedIds([]); setStatus("Slab created from 4 selected grid nodes."); return;
    }
    if (selectedNodes.length < 2) { setStatus(`${tool}: select one more node.`); return; }
    const [a, b] = selectedNodes;
    if (a.id === b.id) return;
    if (tool === "beam" && a.levelId !== b.levelId) { setStatus("Beam endpoints must be on the same level."); setSelectedIds([]); return; }
    if (tool === "column" && (a.position.x !== b.position.x || a.position.y !== b.position.y || a.levelId === b.levelId)) { setStatus("Column requires vertically aligned nodes on different levels."); setSelectedIds([]); return; }
    if (tool === "wall" && a.levelId !== b.levelId) { setStatus("Wall base nodes must be on the same level."); setSelectedIds([]); return; }
    if (tool === "wall") {
      setModel((m) => ({ ...m, surfaces: [...m.surfaces, { id: nextId("W", m.surfaces.filter((s) => s.type === "wall").length), type: "wall", boundaryNodeIds: [a.id, b.id], levelId: a.levelId, thickness: 0.15 }] }));
      setSelectedIds([]); setStatus("Wall created between selected nodes."); return;
    }
    if (tool === "beam" || tool === "column" || tool === "brace") {
      const prefix = tool === "beam" ? "B" : tool === "column" ? "C" : "BR";
      const member: Member = { id: nextId(prefix, model.members.filter((m) => m.type === tool).length), type: tool, startNodeId: a.id, endNodeId: b.id, levelId: tool === "beam" ? a.levelId : undefined };
      setModel((m) => ({ ...m, members: [...m.members, member] }));
      setSelectedIds([]); setStatus(`${tool} created between ${a.id} and ${b.id}.`);
    }
  }

  function onNodeClick(node: Node) {
    if (tool === "select") { setSelectedIds([node.id]); setStatus(`Selected ${node.id}.`); return; }
    setSelectedIds((current) => {
      const next = current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id];
      queueMicrotask(() => createFromSelection(next));
      return next;
    });
  }

  function handleUpload(kind: UploadKind, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploaded((u) => [...u, ...files.map((f) => f.name)]);
    setStatus(kind === "ai" ? `${files.length} PDF/image file(s) staged for AI extraction.` : kind === "dxf" ? `${files.length} DXF file(s) staged for ezdxf adapter.` : `${files.length} IFC file(s) staged for IFC adapter.`);
    event.target.value = "";
  }

  function addLoad(category: LoadCategory) {
    setModel((m) => {
      const caseId = `LC_${category.toUpperCase()}`;
      const loadCases: LoadCase[] = m.loadCases.some((lc) => lc.id === caseId) ? m.loadCases : [...m.loadCases, { id: caseId, name: `${category[0].toUpperCase()}${category.slice(1)} Load`, category }];
      const targetId = selectedIds[0] ?? m.members[0]?.id ?? m.nodes[0]?.id;
      if (!targetId) return m;
      const loads: Load[] = [...m.loads, { id: nextId("LOAD", m.loads.length), type: "line", targetId, loadCaseId: caseId, direction: { x: 0, y: 0, z: -1 }, magnitude: category === "dead" ? 5 : category === "live" ? 3 : 2, unit: "kN/m" }];
      return { ...m, loadCases, loads };
    });
    setStatus(`${category} load added to selected/default target.`);
  }

  return <main className="appShell">
    <header className="topbar">
      <div><strong>Linkoteq 3D Structural Model</strong><span>Core contract v{model.schemaVersion}</span></div>
      <div className="topActions"><button className="runButton" onClick={() => setStatus("Run requested. PyNite + calculator adapters are not connected yet.")}>▶ Run</button><button onClick={() => window.print()}>Print Results</button><button onClick={() => setStatus("IFC export requested. IFC writer adapter is not connected yet.")}>Export IFC</button><button onClick={() => { setModel(baseModel); setSelectedIds([]); setUploaded([]); setStatus("Reset complete."); }}>Reset</button></div>
    </header>
    <section className="importbar">
      <strong>Import / AI</strong>
      <button onClick={() => aiInput.current?.click()}>PDF / Image → AI</button><button onClick={() => dxfInput.current?.click()}>Import DXF</button><button onClick={() => ifcInput.current?.click()}>Import IFC</button>
      <input ref={aiInput} hidden type="file" accept="application/pdf,image/*" multiple onChange={(e) => handleUpload("ai", e)} />
      <input ref={dxfInput} hidden type="file" accept=".dxf,application/dxf" multiple onChange={(e) => handleUpload("dxf", e)} />
      <input ref={ifcInput} hidden type="file" accept=".ifc" multiple onChange={(e) => handleUpload("ifc", e)} />
      <span className="statusText">{status}</span>
    </section>
    <section className="workspace">
      <aside className="toolbar">
        <div className="toolGroup"><span>MODEL TOOLS</span>{(["select","beam","column","brace","wall","slab"] as const).map((t) => <button key={t} className={tool === t ? "active" : ""} onClick={() => chooseTool(t)}>{t === "select" ? "Select" : `+ ${t[0].toUpperCase()}${t.slice(1)}`}</button>)}</div>
        <div className="selectionBox"><strong>Snap to grid nodes</strong><span>{selectedIds.length ? `Selected: ${selectedIds.join(", ")}` : "Click blue nodes in the 3D view"}</span><button onClick={() => setSelectedIds([])}>Clear selection</button></div>
        <div className="toolGroup"><span>LOADS</span>{(["dead","live","wind","seismic"] as const).map((c) => <button key={c} onClick={() => addLoad(c)}>+ {c[0].toUpperCase() + c.slice(1)}</button>)}</div>
        <div className="stats"><span>{model.grids.length} grid lines</span><span>{model.nodes.length} snap nodes</span><span>{model.members.length} members</span><span>{model.surfaces.length} surfaces</span><span>{model.loads.length} loads</span></div>
      </aside>
      <div className="viewport"><Scene model={model} selectedIds={selectedIds} onNodeClick={onNodeClick} /><div className="hint">Blue = snap node · Orange = selected · Beam/Wall: 2 same-level nodes · Column: 2 vertically aligned nodes · Slab: 4 nodes</div></div>
      <aside className="inspector"><h2>Model</h2>{uploaded.length > 0 && <div className="uploads"><strong>Uploads</strong>{uploaded.map((name, i) => <span key={`${name}-${i}`}>{name}</span>)}</div>}<pre>{JSON.stringify({ selected: selectedIds, grids: model.grids, nodes: model.nodes, members: model.members, surfaces: model.surfaces, loadCases: model.loadCases, loads: model.loads }, null, 2)}</pre></aside>
    </section>
  </main>;
}
