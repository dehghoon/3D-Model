"use client";

import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { Grid, Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type { GridLine, Load, LoadCase, Member, Node, Section, StructuralModel, Surface } from "@linkoteq/structural-core";

type Tool = "select" | "beam" | "column" | "brace" | "wall" | "slab";
type UploadKind = "ai" | "dxf" | "ifc";
type LoadCategory = "dead" | "live" | "wind" | "seismic";
type GridAxis = "X" | "Y";
type SectionOption = { id: string; designation: string; designation_metric?: string | null; designation_imperial?: string | null; family: string; properties: Record<string, number | string | null> };
type SelectedEntity = { type: "member" | "surface"; id: string } | null;

const initialX = [0, 6, 12];
const initialY = [0, 4, 8];
const initialLevels = [
  { id: "L0", name: "Ground", elevation: 0 },
  { id: "L1", name: "Level 1", elevation: 3.5 }
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const nextId = (prefix: string, count: number) => `${prefix}${count + 1}`;
const uniqueSorted = (values: number[]) => [...new Set(values.map((v) => Number(v.toFixed(4))))].sort((a, b) => a - b);
const nodeKey = (x: number, y: number, z: number) => `${x.toFixed(4)}|${y.toFixed(4)}|${z.toFixed(4)}`;
const toVector = (node: Node) => new THREE.Vector3(node.position.x, node.position.z, node.position.y);

function makeGridLines(xs: number[], ys: number[], xLabels?: string[], yLabels?: string[]): GridLine[] {
  const minX = Math.min(...xs, 0) - 1;
  const maxX = Math.max(...xs, 0) + 1;
  const minY = Math.min(...ys, 0) - 1;
  const maxY = Math.max(...ys, 0) + 1;
  return [
    ...xs.map((x, i) => ({ id: `GX${i + 1}`, label: xLabels?.[i] || String.fromCharCode(65 + i), start: { x, y: minY, z: 0 }, end: { x, y: maxY, z: 0 } })),
    ...ys.map((y, i) => ({ id: `GY${i + 1}`, label: yLabels?.[i] || `${i + 1}`, start: { x: minX, y, z: 0 }, end: { x: maxX, y, z: 0 } }))
  ];
}

function makeNodes(xs: number[], ys: number[], levels: StructuralModel["levels"]): Node[] {
  const nodes: Node[] = [];
  let index = 1;
  for (const level of levels) for (const y of ys) for (const x of xs) {
    nodes.push({ id: `N${index++}`, position: { x, y, z: level.elevation }, levelId: level.id });
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

function extractGridCoordinates(grids: GridLine[]) {
  const xGrids = grids.filter((g) => Math.abs(g.start.x - g.end.x) < 1e-6).sort((a, b) => a.start.x - b.start.x);
  const yGrids = grids.filter((g) => Math.abs(g.start.y - g.end.y) < 1e-6).sort((a, b) => a.start.y - b.start.y);
  return { xs: uniqueSorted(xGrids.map((g) => g.start.x)), ys: uniqueSorted(yGrids.map((g) => g.start.y)), xGrids, yGrids };
}

function MemberMesh({ member, nodes, selected, onClick }: { member: Member; nodes: Node[]; selected: boolean; onClick: (member: Member) => void }) {
  const startNode = nodes.find((n) => n.id === member.startNodeId);
  const endNode = nodes.find((n) => n.id === member.endNodeId);
  const geometry = useMemo(() => {
    if (!startNode || !endNode) return null;
    const a = toVector(startNode);
    const b = toVector(endNode);
    const direction = b.clone().sub(a);
    const length = direction.length();
    if (!length) return null;
    const g = new THREE.BoxGeometry(selected ? 0.3 : 0.22, length, selected ? 0.3 : 0.22);
    g.translate(0, length / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    g.translate(a.x, a.y, a.z);
    return g;
  }, [startNode, endNode, selected]);
  if (!geometry) return null;
  const baseColor = member.type === "column" ? "#2367a8" : member.type === "brace" ? "#d97706" : "#3f7d4f";
  return <mesh geometry={geometry} castShadow receiveShadow onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(member); }}>
    <meshStandardMaterial color={selected ? "#f97316" : baseColor} metalness={0.25} roughness={0.55} />
  </mesh>;
}

function SurfaceMesh({ surface, nodes, levels, selected, onClick }: { surface: Surface; nodes: Node[]; levels: StructuralModel["levels"]; selected: boolean; onClick: (surface: Surface) => void }) {
  const pts = surface.boundaryNodeIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as Node[];
  if (surface.type === "slab" && pts.length >= 3) {
    const shape = new THREE.Shape();
    pts.forEach((n, i) => i === 0 ? shape.moveTo(n.position.x, n.position.y) : shape.lineTo(n.position.x, n.position.y));
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    return <mesh geometry={geometry} position={[0, pts[0].position.z + 0.02, 0]} receiveShadow onClick={(e) => { e.stopPropagation(); onClick(surface); }}>
      <meshStandardMaterial color={selected ? "#f97316" : "#9ca3af"} transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>;
  }
  if (surface.type === "wall" && pts.length >= 2) {
    const [a, b] = pts;
    const level = levels.find((l) => l.id === surface.levelId);
    const sorted = [...levels].sort((x, y) => x.elevation - y.elevation);
    const li = level ? sorted.findIndex((l) => l.id === level.id) : -1;
    const height = li >= 0 && sorted[li + 1] ? sorted[li + 1].elevation - sorted[li].elevation : 3.5;
    const length = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
    const angle = Math.atan2(b.position.y - a.position.y, b.position.x - a.position.x);
    return <mesh position={[(a.position.x + b.position.x) / 2, a.position.z + height / 2, (a.position.y + b.position.y) / 2]} rotation={[0, -angle, 0]} castShadow onClick={(e) => { e.stopPropagation(); onClick(surface); }}>
      <boxGeometry args={[length, height, 0.15]} /><meshStandardMaterial color={selected ? "#f97316" : "#8b5e3c"} transparent opacity={0.65} />
    </mesh>;
  }
  return null;
}

function ModelGrid({ grid, elevation, showLabel }: { grid: GridLine; elevation: number; showLabel: boolean }) {
  const points = useMemo<[number, number, number][]>(() => [[grid.start.x, elevation + 0.01, grid.start.y], [grid.end.x, elevation + 0.01, grid.end.y]], [grid, elevation]);
  const isX = Math.abs(grid.start.x - grid.end.x) < 1e-6;
  const labelPosition: [number, number, number] = isX ? [grid.start.x, elevation + 0.05, grid.start.y - 0.45] : [grid.start.x - 0.45, elevation + 0.05, grid.start.y];
  return <>
    <Line points={points} color="#667085" lineWidth={1} dashed dashSize={0.2} gapSize={0.12} />
    {showLabel && <Html position={labelPosition} center distanceFactor={12} style={{ pointerEvents: "none" }}><span className="gridLabel">{grid.label}</span></Html>}
  </>;
}

function NodePoint({ node, selected, onClick, showLabel }: { node: Node; selected: boolean; onClick: (node: Node) => void; showLabel: boolean }) {
  return <group position={toVector(node)}>
    <mesh onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(node); }}>
      <sphereGeometry args={[selected ? 0.16 : 0.105, 18, 18]} />
      <meshStandardMaterial color={selected ? "#f97316" : "#2563eb"} />
    </mesh>
    {showLabel && <Html position={[0, 0.22, 0]} center distanceFactor={11} style={{ pointerEvents: "none" }}><span className="nodeLabel">{node.id}</span></Html>}
  </group>;
}

function DimensionLabels({ model, onGridDimension, onLevelDimension, compact }: { model: StructuralModel; onGridDimension: (axis: GridAxis, index: number, current: number) => void; onLevelDimension: (index: number, current: number) => void; compact: boolean }) {
  const { xs, ys } = extractGridCoordinates(model.grids);
  const levels = [...model.levels].sort((a, b) => a.elevation - b.elevation);
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 0), minY = Math.min(...ys, 0), maxY = Math.max(...ys, 0);
  const labels: React.ReactNode[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const d = xs[i + 1] - xs[i];
    labels.push(<Html key={`dx-${i}`} position={[(xs[i] + xs[i + 1]) / 2, 0.06, minY - (compact ? 0.45 : 0.9)]} center distanceFactor={compact ? 16 : 12} style={{ pointerEvents: "auto" }}><button className="dimLabel dimButton" onClick={(e) => { e.stopPropagation(); onGridDimension("X", i, d); }}>{d.toFixed(2)} m</button></Html>);
  }
  for (let i = 0; i < ys.length - 1; i++) {
    const d = ys[i + 1] - ys[i];
    labels.push(<Html key={`dy-${i}`} position={[minX - (compact ? 0.45 : 0.9), 0.06, (ys[i] + ys[i + 1]) / 2]} center distanceFactor={compact ? 16 : 12} style={{ pointerEvents: "auto" }}><button className="dimLabel dimButton" onClick={(e) => { e.stopPropagation(); onGridDimension("Y", i, d); }}>{d.toFixed(2)} m</button></Html>);
  }
  for (let i = 0; i < levels.length - 1; i++) {
    const d = levels[i + 1].elevation - levels[i].elevation;
    const x = maxX + (compact ? 0.55 : 1.1);
    const y = compact ? maxY : minY;
    labels.push(<group key={`lz-${i}`}>
      <Line points={[[x, levels[i].elevation, y], [x, levels[i + 1].elevation, y]]} color="#475467" lineWidth={1} />
      <Html position={[x, (levels[i].elevation + levels[i + 1].elevation) / 2, y]} center distanceFactor={compact ? 16 : 12} style={{ pointerEvents: "auto" }}><button className="dimLabel dimButton levelDim" onClick={(e) => { e.stopPropagation(); onLevelDimension(i, d); }}>{d.toFixed(2)} m</button></Html>
    </group>);
  }
  return <>{labels}</>;
}

function CameraRig({ zoomSignal, resetSignal }: { zoomSignal: number; resetSignal: number }) {
  const { camera, size } = useThree();
  const lastZoom = useRef(zoomSignal), lastReset = useRef(resetSignal);
  const mobile = size.width < 720;
  const target = useMemo(() => new THREE.Vector3(6, 1.8, 4), []);
  useEffect(() => {
    if (resetSignal !== lastReset.current) {
      camera.position.set(mobile ? 20 : 16, mobile ? 13 : 10, mobile ? 20 : 16);
      camera.lookAt(target); camera.updateProjectionMatrix(); lastReset.current = resetSignal;
    }
  }, [camera, resetSignal, target, mobile]);
  useEffect(() => {
    const delta = zoomSignal - lastZoom.current;
    if (!delta) return;
    const offset = camera.position.clone().sub(target).multiplyScalar(delta > 0 ? 0.78 : 1.28);
    camera.position.copy(target.clone().add(offset)); camera.lookAt(target); camera.updateProjectionMatrix(); lastZoom.current = zoomSignal;
  }, [camera, target, zoomSignal]);
  return null;
}

function Scene({ model, selectedNodeIds, selectedEntity, onNodeClick, onMemberClick, onSurfaceClick, onGridDimension, onLevelDimension, zoomSignal, resetSignal }: {
  model: StructuralModel; selectedNodeIds: string[]; selectedEntity: SelectedEntity; onNodeClick: (node: Node) => void; onMemberClick: (member: Member) => void; onSurfaceClick: (surface: Surface) => void; onGridDimension: (axis: GridAxis, index: number, current: number) => void; onLevelDimension: (index: number, current: number) => void; zoomSignal: number; resetSignal: number;
}) {
  const { width } = useThree((s) => s.size);
  const compact = width < 720;
  const ground = [...model.levels].sort((a, b) => a.elevation - b.elevation)[0];
  const visibleNodes = compact ? model.nodes.filter((n) => n.levelId === ground?.id || selectedNodeIds.includes(n.id)) : model.nodes;
  return <>
    <CameraRig zoomSignal={zoomSignal} resetSignal={resetSignal} />
    <color attach="background" args={["#edf2f7"]} />
    <ambientLight intensity={1.15} />
    <directionalLight position={[10, 14, 8]} intensity={2} castShadow />
    {model.grids.map((grid) => <ModelGrid key={`ground-${grid.id}`} grid={grid} elevation={ground?.elevation || 0} showLabel />)}
    {!compact && model.levels.filter((l) => l.id !== ground?.id).map((level) => model.grids.map((grid) => <ModelGrid key={`${level.id}-${grid.id}`} grid={grid} elevation={level.elevation} showLabel={false} />))}
    <DimensionLabels model={model} onGridDimension={onGridDimension} onLevelDimension={onLevelDimension} compact={compact} />
    {visibleNodes.map((node) => <NodePoint key={node.id} node={node} selected={selectedNodeIds.includes(node.id)} onClick={onNodeClick} showLabel={!compact} />)}
    {model.members.map((member) => <MemberMesh key={member.id} member={member} nodes={model.nodes} selected={selectedEntity?.type === "member" && selectedEntity.id === member.id} onClick={onMemberClick} />)}
    {model.surfaces.map((surface) => <SurfaceMesh key={surface.id} surface={surface} nodes={model.nodes} levels={model.levels} selected={selectedEntity?.type === "surface" && selectedEntity.id === surface.id} onClick={onSurfaceClick} />)}
    <Grid position={[6, -0.02, 4]} args={[24, 20]} cellSize={1} sectionSize={4} infiniteGrid fadeDistance={40} />
    <OrbitControls makeDefault target={[6, 1.8, 4]} enableZoom zoomSpeed={1.15} enableDamping dampingFactor={0.08} minDistance={3} maxDistance={70} />
  </>;
}

export default function StructuralEditor() {
  const [tool, setTool] = useState<Tool>("select");
  const [model, setModel] = useState<StructuralModel>(baseModel);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [status, setStatus] = useState("Ready — choose a tool or click an element.");
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [gridAxis, setGridAxis] = useState<GridAxis>("X");
  const [gridName, setGridName] = useState("D");
  const [gridCoordinate, setGridCoordinate] = useState("18");
  const [levelName, setLevelName] = useState("Level 2");
  const [levelElevation, setLevelElevation] = useState("7");
  const [zoomSignal, setZoomSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);
  const [sectionLoading, setSectionLoading] = useState(true);
  const [past, setPast] = useState<StructuralModel[]>([]);
  const [future, setFuture] = useState<StructuralModel[]>([]);
  const aiInput = useRef<HTMLInputElement>(null), dxfInput = useRef<HTMLInputElement>(null), ifcInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/w-sections").then((r) => r.json()).then((data) => setSectionOptions(Array.isArray(data.sections) ? data.sections : [])).catch(() => setStatus("Could not load W-section library.")).finally(() => setSectionLoading(false));
  }, []);

  function commit(next: StructuralModel, message?: string) {
    setPast((p) => [...p.slice(-49), clone(model)]);
    setFuture([]);
    setModel(next);
    if (message) setStatus(message);
  }

  function undo() {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setFuture((f) => [clone(model), ...f].slice(0, 50));
    setPast((p) => p.slice(0, -1));
    setModel(previous); setSelectedEntity(null); setSelectedNodeIds([]); setStatus("Undo.");
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    setPast((p) => [...p.slice(-49), clone(model)]);
    setFuture((f) => f.slice(1));
    setModel(next); setSelectedEntity(null); setSelectedNodeIds([]); setStatus("Redo.");
  }

  function chooseTool(next: Tool) {
    setTool(next); setSelectedNodeIds([]); setSelectedEntity(null);
    setStatus(next === "select" ? "Select mode." : `${next}: click the required node(s).`);
  }

  function createFromSelection(ids: string[]) {
    const selectedNodes = ids.map((id) => model.nodes.find((n) => n.id === id)).filter(Boolean) as Node[];
    if (tool === "slab") {
      if (selectedNodes.length < 4) { setStatus(`Slab: select ${4 - selectedNodes.length} more node(s).`); return; }
      if (!selectedNodes.every((n) => n.levelId === selectedNodes[0].levelId)) { setStatus("Slab nodes must be on the same level."); setSelectedNodeIds([]); return; }
      commit({ ...model, surfaces: [...model.surfaces, { id: nextId("S", model.surfaces.filter((s) => s.type === "slab").length), type: "slab", boundaryNodeIds: ids.slice(0, 4), levelId: selectedNodes[0].levelId, thickness: 0.18 }] }, "Slab created.");
      setSelectedNodeIds([]); return;
    }
    if (selectedNodes.length < 2) { setStatus(`${tool}: select one more node.`); return; }
    const [a, b] = selectedNodes;
    if (tool === "beam" && a.levelId !== b.levelId) { setStatus("Beam endpoints must be on the same level."); setSelectedNodeIds([]); return; }
    if (tool === "column" && (Math.abs(a.position.x - b.position.x) > 1e-6 || Math.abs(a.position.y - b.position.y) > 1e-6 || a.levelId === b.levelId)) { setStatus("Column needs vertically aligned nodes on different levels."); setSelectedNodeIds([]); return; }
    if (tool === "wall" && a.levelId !== b.levelId) { setStatus("Wall base nodes must be on the same level."); setSelectedNodeIds([]); return; }
    if (tool === "wall") {
      commit({ ...model, surfaces: [...model.surfaces, { id: nextId("W", model.surfaces.filter((s) => s.type === "wall").length), type: "wall", boundaryNodeIds: [a.id, b.id], levelId: a.levelId, thickness: 0.15 }] }, "Wall created.");
      setSelectedNodeIds([]); return;
    }
    if (tool === "beam" || tool === "column" || tool === "brace") {
      const prefix = tool === "beam" ? "B" : tool === "column" ? "C" : "BR";
      const member: Member = { id: nextId(prefix, model.members.filter((m) => m.type === tool).length), type: tool, startNodeId: a.id, endNodeId: b.id, levelId: tool === "beam" ? a.levelId : undefined };
      commit({ ...model, members: [...model.members, member] }, `${tool} created between ${a.id} and ${b.id}.`);
      setSelectedNodeIds([]);
    }
  }

  function onNodeClick(node: Node) {
    if (tool === "select") { setSelectedNodeIds([node.id]); setSelectedEntity(null); setStatus(`${node.id} selected.`); return; }
    const next = selectedNodeIds.includes(node.id) ? selectedNodeIds : [...selectedNodeIds, node.id];
    setSelectedNodeIds(next); createFromSelection(next);
  }

  function addGrid() {
    const coordinate = Number(gridCoordinate);
    if (!Number.isFinite(coordinate)) { setStatus("Grid coordinate must be numeric."); return; }
    const { xs, ys, xGrids, yGrids } = extractGridCoordinates(model.grids);
    if ((gridAxis === "X" ? xs : ys).some((v) => Math.abs(v - coordinate) < 1e-6)) { setStatus("A grid already exists at that coordinate."); return; }
    const nextXs = gridAxis === "X" ? uniqueSorted([...xs, coordinate]) : xs;
    const nextYs = gridAxis === "Y" ? uniqueSorted([...ys, coordinate]) : ys;
    const newGridLabelsX = nextXs.map((x) => Math.abs(x - coordinate) < 1e-6 && gridAxis === "X" ? gridName.trim() || `X${nextXs.indexOf(x) + 1}` : xGrids.find((g) => Math.abs(g.start.x - x) < 1e-6)?.label || `X${nextXs.indexOf(x) + 1}`);
    const newGridLabelsY = nextYs.map((y) => Math.abs(y - coordinate) < 1e-6 && gridAxis === "Y" ? gridName.trim() || `Y${nextYs.indexOf(y) + 1}` : yGrids.find((g) => Math.abs(g.start.y - y) < 1e-6)?.label || `Y${nextYs.indexOf(y) + 1}`);
    const nodes = [...model.nodes]; let idx = nodes.length + 1;
    for (const level of model.levels) {
      if (gridAxis === "X") for (const y of nextYs) if (!findNode(nodes, coordinate, y, level.elevation)) nodes.push({ id: `N${idx++}`, position: { x: coordinate, y, z: level.elevation }, levelId: level.id });
      else for (const x of nextXs) if (!findNode(nodes, x, coordinate, level.elevation)) nodes.push({ id: `N${idx++}`, position: { x, y: coordinate, z: level.elevation }, levelId: level.id });
    }
    commit({ ...model, grids: makeGridLines(nextXs, nextYs, newGridLabelsX, newGridLabelsY), nodes }, `Grid ${gridName || "new"} added at ${coordinate.toFixed(2)} m.`);
  }

  function addLevel() {
    const elevation = Number(levelElevation);
    if (!Number.isFinite(elevation)) { setStatus("Level elevation must be numeric."); return; }
    if (model.levels.some((l) => Math.abs(l.elevation - elevation) < 1e-6)) { setStatus("A level already exists at that elevation."); return; }
    const { xs, ys } = extractGridCoordinates(model.grids);
    const id = `L${model.levels.length}`;
    const level = { id, name: levelName.trim() || `Level ${model.levels.length}`, elevation };
    const nodes = [...model.nodes]; let idx = nodes.length + 1;
    for (const y of ys) for (const x of xs) nodes.push({ id: `N${idx++}`, position: { x, y, z: elevation }, levelId: id });
    commit({ ...model, levels: [...model.levels, level].sort((a, b) => a.elevation - b.elevation), nodes }, `${level.name} added at ${elevation.toFixed(2)} m.`);
  }

  function editGridDimension(axis: GridAxis, index: number, current: number) {
    const raw = window.prompt(`New ${axis}-grid spacing (m)`, current.toFixed(2));
    if (raw === null) return;
    const desired = Number(raw);
    if (!Number.isFinite(desired) || desired <= 0) { setStatus("Grid spacing must be greater than zero."); return; }
    const { xs, ys, xGrids, yGrids } = extractGridCoordinates(model.grids);
    const coords = axis === "X" ? xs : ys;
    const threshold = coords[index + 1];
    const delta = desired - current;
    const shifted = coords.map((v, i) => i > index ? v + delta : v);
    const nextXs = axis === "X" ? shifted : xs, nextYs = axis === "Y" ? shifted : ys;
    const xLabels = xGrids.map((g) => g.label), yLabels = yGrids.map((g) => g.label);
    const nodes = model.nodes.map((n) => ({ ...n, position: { ...n.position, ...(axis === "X" && n.position.x >= threshold - 1e-6 ? { x: n.position.x + delta } : {}), ...(axis === "Y" && n.position.y >= threshold - 1e-6 ? { y: n.position.y + delta } : {}) } }));
    commit({ ...model, grids: makeGridLines(nextXs, nextYs, xLabels, yLabels), nodes }, `${axis}-grid spacing changed to ${desired.toFixed(2)} m. Structure adjusted.`);
  }

  function editLevelDimension(index: number, current: number) {
    const levels = [...model.levels].sort((a, b) => a.elevation - b.elevation);
    const raw = window.prompt("New level-to-level height (m)", current.toFixed(2));
    if (raw === null) return;
    const desired = Number(raw);
    if (!Number.isFinite(desired) || desired <= 0) { setStatus("Level height must be greater than zero."); return; }
    const delta = desired - current;
    const shiftedIds = new Set(levels.slice(index + 1).map((l) => l.id));
    const nextLevels = model.levels.map((l) => shiftedIds.has(l.id) ? { ...l, elevation: l.elevation + delta } : l);
    const nodes = model.nodes.map((n) => n.levelId && shiftedIds.has(n.levelId) ? { ...n, position: { ...n.position, z: n.position.z + delta } } : n);
    commit({ ...model, levels: nextLevels.sort((a, b) => a.elevation - b.elevation), nodes }, `Level spacing changed to ${desired.toFixed(2)} m. Upper structure adjusted.`);
  }

  function deleteSelected() {
    if (!selectedEntity) { setStatus("Select a beam, column, brace, wall, or slab first."); return; }
    if (selectedEntity.type === "member") commit({ ...model, members: model.members.filter((m) => m.id !== selectedEntity.id), loads: model.loads.filter((l) => l.targetId !== selectedEntity.id) }, `${selectedEntity.id} deleted.`);
    else commit({ ...model, surfaces: model.surfaces.filter((s) => s.id !== selectedEntity.id), loads: model.loads.filter((l) => l.targetId !== selectedEntity.id) }, `${selectedEntity.id} deleted.`);
    setSelectedEntity(null);
  }

  function assignSection(sectionId: string) {
    if (!selectedEntity || selectedEntity.type !== "member") return;
    const option = sectionOptions.find((s) => s.id === sectionId);
    if (!option) return;
    const section: Section = { id: option.id, family: option.family || "W", materialType: "steel", designation: option.designation_metric || option.designation, geometry: {}, properties: option.properties };
    const sections = model.sections.some((s) => s.id === section.id) ? model.sections : [...model.sections, section];
    const members = model.members.map((m) => m.id === selectedEntity.id ? { ...m, sectionId: section.id } : m);
    commit({ ...model, members, sections }, `${option.designation_metric || option.designation} assigned to ${selectedEntity.id}.`);
  }

  function addLoad(category: LoadCategory) {
    const target = selectedEntity?.id || model.members[0]?.id;
    if (!target) { setStatus("Add or select an element first."); return; }
    const caseId = `LC_${category.toUpperCase()}`;
    const loadCases: LoadCase[] = model.loadCases.some((c) => c.id === caseId) ? model.loadCases : [...model.loadCases, { id: caseId, name: category[0].toUpperCase() + category.slice(1), category }];
    const load: Load = { id: `LOAD_${model.loads.length + 1}`, type: "line", targetId: target, loadCaseId: caseId, direction: { x: 0, y: 0, z: -1 }, magnitude: category === "dead" ? 5 : category === "live" ? 3 : 1, unit: "kN/m" };
    commit({ ...model, loadCases, loads: [...model.loads, load] }, `${category} load added to ${target}.`);
  }

  function onUpload(kind: UploadKind, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploaded((u) => [...u, `${kind.toUpperCase()}: ${file.name}`]);
    setStatus(kind === "ai" ? `${file.name} staged for AI plan extraction.` : `${file.name} staged for ${kind.toUpperCase()} import adapter.`);
    e.target.value = "";
  }

  const selectedMember = selectedEntity?.type === "member" ? model.members.find((m) => m.id === selectedEntity.id) : undefined;
  const currentSection = selectedMember?.sectionId ? model.sections.find((s) => s.id === selectedMember.sectionId) : undefined;

  return <div className="appShell">
    <header className="topbar"><div><strong>Linkoteq 3D Structural Editor</strong><span>SI geometry · dimensions in metres</span></div><div className="topActions">
      <button onClick={undo} disabled={!past.length}>↶ Undo</button><button onClick={redo} disabled={!future.length}>↷ Redo</button><button className="dangerButton" onClick={deleteSelected}>Delete</button>
      <button className="runButton" onClick={() => setStatus("Run adapter placeholder: Core Model → PyNite → Calculators.")}>Run</button><button onClick={() => window.print()}>Print Results</button><button onClick={() => setStatus("IFC export adapter is not connected yet.")}>Export IFC</button>
    </div></header>
    <div className="importbar"><strong>IMPORT</strong><button onClick={() => aiInput.current?.click()}>PDF / Image → AI</button><button onClick={() => dxfInput.current?.click()}>DXF</button><button onClick={() => ifcInput.current?.click()}>IFC</button><input ref={aiInput} hidden type="file" accept=".pdf,image/*" onChange={(e) => onUpload("ai", e)} /><input ref={dxfInput} hidden type="file" accept=".dxf" onChange={(e) => onUpload("dxf", e)} /><input ref={ifcInput} hidden type="file" accept=".ifc" onChange={(e) => onUpload("ifc", e)} /><span className="statusText">{status}</span></div>
    <main className="workspace">
      <aside className="toolbar">
        <section className="panelBlock"><h3>Model tools</h3><div className="toolGrid twoCol">{(["select", "beam", "column", "brace", "wall", "slab"] as Tool[]).map((t) => <button key={t} className={tool === t ? "active" : ""} onClick={() => chooseTool(t)}>{t === "select" ? "Select" : `+ ${t[0].toUpperCase()}${t.slice(1)}`}</button>)}</div><p className="helper">Beam/column/brace tools snap to grid nodes.</p></section>
        <section className="panelBlock"><h3>Add Grid</h3><div className="inlineFields"><select value={gridAxis} onChange={(e) => setGridAxis(e.target.value as GridAxis)}><option value="X">X grid</option><option value="Y">Y grid</option></select><input value={gridName} onChange={(e) => setGridName(e.target.value)} placeholder="Name" /></div><div className="fieldWithUnit"><input type="number" step="0.1" value={gridCoordinate} onChange={(e) => setGridCoordinate(e.target.value)} /><span>m</span></div><button className="primaryWide" onClick={addGrid}>Add Grid</button></section>
        <section className="panelBlock"><h3>Add Level</h3><input value={levelName} onChange={(e) => setLevelName(e.target.value)} placeholder="Level name" /><div className="fieldWithUnit"><input type="number" step="0.1" value={levelElevation} onChange={(e) => setLevelElevation(e.target.value)} /><span>m</span></div><button className="primaryWide" onClick={addLevel}>Add Level</button><p className="helper">Click any dimension label in the model to change spacing and adjust connected structure.</p></section>
        <section className="panelBlock"><h3>Loads</h3><div className="toolGrid twoCol"><button onClick={() => addLoad("dead")}>+ Dead</button><button onClick={() => addLoad("live")}>+ Live</button><button onClick={() => addLoad("wind")}>+ Wind</button><button onClick={() => addLoad("seismic")}>+ Seismic</button></div></section>
      </aside>
      <section className="viewport"><Canvas shadows camera={{ position: [16, 10, 16], fov: 44 }}><Scene model={model} selectedNodeIds={selectedNodeIds} selectedEntity={selectedEntity} onNodeClick={onNodeClick} onMemberClick={(m) => { setTool("select"); setSelectedNodeIds([]); setSelectedEntity({ type: "member", id: m.id }); setStatus(`${m.type} ${m.id} selected.`); }} onSurfaceClick={(s) => { setTool("select"); setSelectedNodeIds([]); setSelectedEntity({ type: "surface", id: s.id }); setStatus(`${s.type} ${s.id} selected.`); }} onGridDimension={editGridDimension} onLevelDimension={editLevelDimension} zoomSignal={zoomSignal} resetSignal={resetSignal} /></Canvas><div className="viewControls"><button onClick={() => setZoomSignal((z) => z + 1)}>+</button><button onClick={() => setZoomSignal((z) => z - 1)}>−</button><button onClick={() => setResetSignal((r) => r + 1)}>⌂</button></div><div className="hint">Orbit · pan · wheel zoom · click dimensions to edit</div></section>
      <aside className="inspector"><h2>Model Inspector</h2><div className="summaryCards"><div><b>{model.members.length}</b><span>Members</span></div><div><b>{model.levels.length}</b><span>Levels</span></div><div><b>{model.grids.length}</b><span>Grids</span></div><div><b>{model.loads.length}</b><span>Loads</span></div></div>
        <h3>Selection</h3><p className="selectionText">{selectedEntity ? `${selectedEntity.type}: ${selectedEntity.id}` : selectedNodeIds.length ? selectedNodeIds.join(", ") : "Nothing selected"}</p>
        {selectedMember && <><h3>Steel W-section</h3><select className="sectionSelect" value={selectedMember.sectionId || ""} disabled={sectionLoading} onChange={(e) => assignSection(e.target.value)}><option value="">{sectionLoading ? "Loading CISC sections…" : "Select W-section…"}</option>{sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.designation_metric || s.designation}{s.designation_imperial ? ` · ${s.designation_imperial}` : ""}</option>)}</select><p className="helper">Assigned: {currentSection?.designation || "None"}</p></>}
        <h3>Levels</h3><div className="simpleList">{[...model.levels].sort((a, b) => a.elevation - b.elevation).map((l) => <div key={l.id}><b>{l.name}</b><span>{l.elevation.toFixed(2)} m</span></div>)}</div>
        {uploaded.length > 0 && <><h3>Uploaded</h3><div className="simpleList">{uploaded.map((u, i) => <div key={`${u}-${i}`}>{u}</div>)}</div></>}
        <details><summary>Core Model JSON</summary><pre>{JSON.stringify(model, null, 2)}</pre></details>
      </aside>
    </main>
  </div>;
}
