"use client";

import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { Grid, Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type { GridLine, Load, LoadCase, Member, Node, StructuralModel, Surface } from "@linkoteq/structural-core";

type Tool = "select" | "beam" | "column" | "brace" | "wall" | "slab";
type UploadKind = "ai" | "dxf" | "ifc";
type LoadCategory = "dead" | "live" | "wind" | "seismic";
type GridAxis = "X" | "Y";

const initialX = [0, 6, 12];
const initialY = [0, 4, 8];
const initialLevels = [
  { id: "L0", name: "Ground", elevation: 0 },
  { id: "L1", name: "Level 1", elevation: 3.5 }
];

function alphaLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function makeGridLines(xs: number[], ys: number[]): GridLine[] {
  const minX = Math.min(...xs, 0) - 1;
  const maxX = Math.max(...xs, 0) + 1;
  const minY = Math.min(...ys, 0) - 1;
  const maxY = Math.max(...ys, 0) + 1;
  return [
    ...xs.map((x, i) => ({ id: `GX${i + 1}`, label: alphaLabel(i), start: { x, y: minY, z: 0 }, end: { x, y: maxY, z: 0 } })),
    ...ys.map((y, i) => ({ id: `GY${i + 1}`, label: `${i + 1}`, start: { x: minX, y, z: 0 }, end: { x: maxX, y, z: 0 } }))
  ];
}

function nodeKey(x: number, y: number, z: number) {
  return `${x.toFixed(4)}|${y.toFixed(4)}|${z.toFixed(4)}`;
}

function makeNodes(xs: number[], ys: number[], levels: StructuralModel["levels"]): Node[] {
  const nodes: Node[] = [];
  let index = 1;
  for (const level of levels) {
    for (const y of ys) {
      for (const x of xs) {
        nodes.push({ id: `N${index++}`, position: { x, y, z: level.elevation }, levelId: level.id });
      }
    }
  }
  return nodes;
}

function findNode(nodes: Node[], x: number, y: number, z: number) {
  const key = nodeKey(x, y, z);
  return nodes.find((node) => nodeKey(node.position.x, node.position.y, node.position.z) === key);
}

function createBaseModel(): StructuralModel {
  const nodes = makeNodes(initialX, initialY, initialLevels);
  const n000 = findNode(nodes, 0, 0, 0)!;
  const n600 = findNode(nodes, 6, 0, 0)!;
  const n0035 = findNode(nodes, 0, 0, 3.5)!;
  const n6035 = findNode(nodes, 6, 0, 3.5)!;
  return {
    schemaVersion: "0.1",
    project: { id: "P001", name: "3D Model Prototype", units: "SI" },
    levels: initialLevels,
    grids: makeGridLines(initialX, initialY),
    nodes,
    members: [
      { id: "C1", type: "column", startNodeId: n000.id, endNodeId: n0035.id },
      { id: "C2", type: "column", startNodeId: n600.id, endNodeId: n6035.id },
      { id: "B1", type: "beam", startNodeId: n0035.id, endNodeId: n6035.id, levelId: "L1" }
    ],
    surfaces: [], diaphragms: [], materials: [], sections: [], supports: [], loadCases: [], loads: [], loadCombinations: []
  };
}

const baseModel = createBaseModel();

function toVector(node: Node) {
  return new THREE.Vector3(node.position.x, node.position.z, node.position.y);
}

function nextId(prefix: string, count: number) {
  return `${prefix}${count + 1}`;
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
    if (!length) return null;
    const g = new THREE.BoxGeometry(0.22, length, 0.22);
    g.translate(0, length / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
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
    const [a, b] = pts;
    const length = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
    const angle = Math.atan2(b.position.y - a.position.y, b.position.x - a.position.x);
    const nextLevel = 3.5;
    return <mesh position={[(a.position.x + b.position.x) / 2, a.position.z + nextLevel / 2, (a.position.y + b.position.y) / 2]} rotation={[0, -angle, 0]} castShadow>
      <boxGeometry args={[length, nextLevel, 0.15]} /><meshStandardMaterial color="#8b5e3c" transparent opacity={0.65} />
    </mesh>;
  }
  return null;
}

function ModelGrid({ grid, elevation }: { grid: GridLine; elevation: number }) {
  const points = useMemo<[number, number, number][]>(() => [
    [grid.start.x, elevation + 0.01, grid.start.y],
    [grid.end.x, elevation + 0.01, grid.end.y]
  ], [grid, elevation]);
  return <Line points={points} color="#667085" lineWidth={1} dashed dashSize={0.2} gapSize={0.12} />;
}

function NodePoint({ node, selected, onClick }: { node: Node; selected: boolean; onClick: (node: Node) => void }) {
  const p = toVector(node);
  return <group position={p}>
    <mesh onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(node); }}>
      <sphereGeometry args={[selected ? 0.16 : 0.105, 18, 18]} />
      <meshStandardMaterial color={selected ? "#f97316" : "#2563eb"} />
    </mesh>
    <Html position={[0, 0.22, 0]} center distanceFactor={11} style={{ pointerEvents: "none" }}>
      <span className="nodeLabel">{node.id}</span>
    </Html>
  </group>;
}

function CameraRig({ zoomSignal, resetSignal }: { zoomSignal: number; resetSignal: number }) {
  const { camera } = useThree();
  const lastZoom = useRef(zoomSignal);
  const lastReset = useRef(resetSignal);
  const target = useMemo(() => new THREE.Vector3(6, 1.8, 4), []);

  useEffect(() => {
    if (resetSignal !== lastReset.current) {
      camera.position.set(16, 10, 16);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      lastReset.current = resetSignal;
    }
  }, [camera, resetSignal, target]);

  useEffect(() => {
    const delta = zoomSignal - lastZoom.current;
    if (!delta) return;
    const offset = camera.position.clone().sub(target);
    offset.multiplyScalar(delta > 0 ? 0.78 : 1.28);
    camera.position.copy(target.clone().add(offset));
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    lastZoom.current = zoomSignal;
  }, [camera, target, zoomSignal]);
  return null;
}

function Scene({ model, selectedIds, onNodeClick, zoomSignal, resetSignal }: { model: StructuralModel; selectedIds: string[]; onNodeClick: (node: Node) => void; zoomSignal: number; resetSignal: number }) {
  return <Canvas shadows camera={{ position: [16, 10, 16], fov: 44 }} onPointerMissed={() => undefined}>
    <CameraRig zoomSignal={zoomSignal} resetSignal={resetSignal} />
    <color attach="background" args={["#edf2f7"]} />
    <ambientLight intensity={1.15} />
    <directionalLight position={[10, 14, 8]} intensity={2} castShadow />
    {model.levels.map((level) => model.grids.map((grid) => <ModelGrid key={`${level.id}-${grid.id}`} grid={grid} elevation={level.elevation} />))}
    {model.nodes.map((node) => <NodePoint key={node.id} node={node} selected={selectedIds.includes(node.id)} onClick={onNodeClick} />)}
    {model.members.map((member) => <MemberMesh key={member.id} member={member} nodes={model.nodes} />)}
    {model.surfaces.map((surface) => <SurfaceMesh key={surface.id} surface={surface} nodes={model.nodes} />)}
    <Grid position={[6, -0.02, 4]} args={[24, 20]} cellSize={1} sectionSize={4} infiniteGrid fadeDistance={40} />
    <OrbitControls makeDefault target={[6, 1.8, 4]} enableZoom zoomSpeed={1.15} enableDamping dampingFactor={0.08} minDistance={3} maxDistance={60} />
  </Canvas>;
}

function uniqueSorted(values: number[]) {
  return [...new Set(values.map((v) => Number(v.toFixed(4))))].sort((a, b) => a - b);
}

function extractGridCoordinates(grids: GridLine[]) {
  const xs = grids.filter((g) => Math.abs(g.start.x - g.end.x) < 1e-6).map((g) => g.start.x);
  const ys = grids.filter((g) => Math.abs(g.start.y - g.end.y) < 1e-6).map((g) => g.start.y);
  return { xs: uniqueSorted(xs), ys: uniqueSorted(ys) };
}

export default function StructuralEditor() {
  const [tool, setTool] = useState<Tool>("select");
  const [model, setModel] = useState<StructuralModel>(baseModel);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState("Ready — choose a tool or click a node.");
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [gridAxis, setGridAxis] = useState<GridAxis>("X");
  const [gridCoordinate, setGridCoordinate] = useState("18");
  const [levelName, setLevelName] = useState("Level 2");
  const [levelElevation, setLevelElevation] = useState("7");
  const [zoomSignal, setZoomSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const aiInput = useRef<HTMLInputElement>(null);
  const dxfInput = useRef<HTMLInputElement>(null);
  const ifcInput = useRef<HTMLInputElement>(null);

  function chooseTool(next: Tool) {
    setTool(next);
    setSelectedIds([]);
    setStatus(next === "select" ? "Select mode." : `${next}: click the required node(s).`);
  }

  function createFromSelection(ids: string[]) {
    const selectedNodes = ids.map((id) => model.nodes.find((n) => n.id === id)).filter(Boolean) as Node[];
    if (tool === "slab") {
      if (selectedNodes.length < 4) { setStatus(`Slab: select ${4 - selectedNodes.length} more node(s).`); return; }
      if (!selectedNodes.every((n) => n.levelId === selectedNodes[0].levelId)) { setStatus("Slab nodes must be on the same level."); setSelectedIds([]); return; }
      setModel((m) => ({ ...m, surfaces: [...m.surfaces, { id: nextId("S", m.surfaces.filter((s) => s.type === "slab").length), type: "slab", boundaryNodeIds: ids.slice(0, 4), levelId: selectedNodes[0].levelId, thickness: 0.18 }] }));
      setSelectedIds([]); setStatus("Slab created."); return;
    }
    if (selectedNodes.length < 2) { setStatus(`${tool}: select one more node.`); return; }
    const [a, b] = selectedNodes;
    if (tool === "beam" && a.levelId !== b.levelId) { setStatus("Beam endpoints must be on the same level."); setSelectedIds([]); return; }
    if (tool === "column" && (Math.abs(a.position.x - b.position.x) > 1e-6 || Math.abs(a.position.y - b.position.y) > 1e-6 || a.levelId === b.levelId)) { setStatus("Column needs vertically aligned nodes on different levels."); setSelectedIds([]); return; }
    if (tool === "wall" && a.levelId !== b.levelId) { setStatus("Wall base nodes must be on the same level."); setSelectedIds([]); return; }
    if (tool === "wall") {
      setModel((m) => ({ ...m, surfaces: [...m.surfaces, { id: nextId("W", m.surfaces.filter((s) => s.type === "wall").length), type: "wall", boundaryNodeIds: [a.id, b.id], levelId: a.levelId, thickness: 0.15 }] }));
      setSelectedIds([]); setStatus("Wall created."); return;
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

  function addGrid() {
    const coordinate = Number(gridCoordinate);
    if (!Number.isFinite(coordinate)) { setStatus("Grid coordinate must be a number."); return; }
    setModel((current) => {
      const { xs, ys } = extractGridCoordinates(current.grids);
      const nextXs = gridAxis === "X" ? uniqueSorted([...xs, coordinate]) : xs;
      const nextYs = gridAxis === "Y" ? uniqueSorted([...ys, coordinate]) : ys;
      if (nextXs.length === xs.length && nextYs.length === ys.length) { setStatus("A grid already exists at that coordinate."); return current; }
      const oldByKey = new Map(current.nodes.map((node) => [nodeKey(node.position.x, node.position.y, node.position.z), node]));
      let nextNodeNumber = current.nodes.reduce((max, node) => Math.max(max, Number(node.id.replace(/\D/g, "")) || 0), 0) + 1;
      const nodes: Node[] = [];
      for (const level of current.levels) {
        for (const y of nextYs) {
          for (const x of nextXs) {
            const key = nodeKey(x, y, level.elevation);
            const existing = oldByKey.get(key);
            nodes.push(existing ?? { id: `N${nextNodeNumber++}`, position: { x, y, z: level.elevation }, levelId: level.id });
          }
        }
      }
      return { ...current, grids: makeGridLines(nextXs, nextYs), nodes };
    });
    setStatus(`${gridAxis}-grid added at ${coordinate} m.`);
  }

  function addLevel() {
    const elevation = Number(levelElevation);
    const name = levelName.trim();
    if (!name || !Number.isFinite(elevation)) { setStatus("Enter a level name and numeric elevation."); return; }
    if (model.levels.some((level) => Math.abs(level.elevation - elevation) < 1e-6)) { setStatus("A level already exists at that elevation."); return; }
    setModel((current) => {
      const { xs, ys } = extractGridCoordinates(current.grids);
      const newLevel = { id: `L${current.levels.length}`, name, elevation };
      const levels = [...current.levels, newLevel].sort((a, b) => a.elevation - b.elevation);
      let nextNodeNumber = current.nodes.reduce((max, node) => Math.max(max, Number(node.id.replace(/\D/g, "")) || 0), 0) + 1;
      const newNodes: Node[] = [];
      for (const y of ys) for (const x of xs) newNodes.push({ id: `N${nextNodeNumber++}`, position: { x, y, z: elevation }, levelId: newLevel.id });
      return { ...current, levels, nodes: [...current.nodes, ...newNodes] };
    });
    setLevelName(`Level ${model.levels.length + 1}`);
    setLevelElevation(String(elevation + 3.5));
    setStatus(`${name} added at ${elevation} m.`);
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

  function resetAll() {
    setModel(createBaseModel());
    setSelectedIds([]);
    setUploaded([]);
    setResetSignal((value) => value + 1);
    setStatus("Reset to starter frame.");
  }

  return <main className="appShell">
    <header className="topbar">
      <div><strong>Linkoteq 3D Structural Model</strong><span>Core contract v{model.schemaVersion}</span></div>
      <div className="topActions">
        <button className="runButton" onClick={() => setStatus("Run requested. PyNite + calculator adapters are not connected yet.")}>▶ Run</button>
        <button onClick={() => window.print()}>Print Results</button>
        <button onClick={() => setStatus("IFC export requested. IFC writer adapter is not connected yet.")}>Export IFC</button>
        <button onClick={resetAll}>Reset</button>
      </div>
    </header>

    <section className="importbar">
      <strong>IMPORT</strong>
      <button onClick={() => aiInput.current?.click()}>PDF / Image → AI</button>
      <button onClick={() => dxfInput.current?.click()}>Import DXF</button>
      <button onClick={() => ifcInput.current?.click()}>Import IFC</button>
      <input ref={aiInput} hidden type="file" accept="application/pdf,image/*" multiple onChange={(e) => handleUpload("ai", e)} />
      <input ref={dxfInput} hidden type="file" accept=".dxf,application/dxf" multiple onChange={(e) => handleUpload("dxf", e)} />
      <input ref={ifcInput} hidden type="file" accept=".ifc" multiple onChange={(e) => handleUpload("ifc", e)} />
      <span className="statusText">{status}</span>
    </section>

    <section className="workspace">
      <aside className="toolbar">
        <section className="panelBlock">
          <h3>Build</h3>
          <div className="toolGrid">
            {(["select", "beam", "column", "brace", "wall", "slab"] as const).map((t) => <button key={t} className={tool === t ? "active" : ""} onClick={() => chooseTool(t)}>{t === "select" ? "Select" : `+ ${t[0].toUpperCase()}${t.slice(1)}`}</button>)}
          </div>
          <p className="helper">Choose a tool, then click blue nodes. Selected nodes turn orange.</p>
        </section>

        <section className="panelBlock">
          <h3>Grid</h3>
          <div className="inlineFields">
            <select value={gridAxis} onChange={(e) => setGridAxis(e.target.value as GridAxis)}><option value="X">X grid</option><option value="Y">Y grid</option></select>
            <input type="number" step="0.1" value={gridCoordinate} onChange={(e) => setGridCoordinate(e.target.value)} aria-label="Grid coordinate" />
          </div>
          <button className="primaryWide" onClick={addGrid}>+ Add Grid</button>
        </section>

        <section className="panelBlock">
          <h3>Levels</h3>
          <input value={levelName} onChange={(e) => setLevelName(e.target.value)} placeholder="Level name" />
          <div className="fieldWithUnit"><input type="number" step="0.1" value={levelElevation} onChange={(e) => setLevelElevation(e.target.value)} aria-label="Level elevation" /><span>m</span></div>
          <button className="primaryWide" onClick={addLevel}>+ Add Level</button>
        </section>

        <section className="panelBlock">
          <h3>Loads</h3>
          <div className="toolGrid twoCol">{(["dead", "live", "wind", "seismic"] as const).map((category) => <button key={category} onClick={() => addLoad(category)}>+ {category[0].toUpperCase() + category.slice(1)}</button>)}</div>
        </section>
      </aside>

      <div className="viewport">
        <Scene model={model} selectedIds={selectedIds} onNodeClick={onNodeClick} zoomSignal={zoomSignal} resetSignal={resetSignal} />
        <div className="viewControls">
          <button onClick={() => setZoomSignal((value) => value + 1)} title="Zoom in">＋</button>
          <button onClick={() => setZoomSignal((value) => value - 1)} title="Zoom out">−</button>
          <button onClick={() => setResetSignal((value) => value + 1)} title="Reset camera">⌂</button>
        </div>
        <div className="hint">Drag = orbit · Right-drag = pan · Wheel or ＋/− = zoom</div>
      </div>

      <aside className="inspector">
        <h2>Model Summary</h2>
        <div className="summaryCards">
          <div><b>{model.levels.length}</b><span>Levels</span></div><div><b>{model.grids.length}</b><span>Grid lines</span></div><div><b>{model.nodes.length}</b><span>Nodes</span></div><div><b>{model.members.length}</b><span>Members</span></div>
        </div>
        <h3>Levels</h3>
        <div className="simpleList">{model.levels.map((level) => <div key={level.id}><span>{level.name}</span><b>{level.elevation.toFixed(2)} m</b></div>)}</div>
        <h3>Selection</h3><p className="selectionText">{selectedIds.length ? selectedIds.join(", ") : "None"}</p>
        {uploaded.length > 0 && <><h3>Uploads</h3><div className="simpleList">{uploaded.map((name, index) => <div key={`${name}-${index}`}><span>{name}</span></div>)}</div></>}
        <details><summary>Core model JSON</summary><pre>{JSON.stringify({ grids: model.grids, levels: model.levels, members: model.members, surfaces: model.surfaces, loadCases: model.loadCases, loads: model.loads }, null, 2)}</pre></details>
      </aside>
    </section>
  </main>;
}
