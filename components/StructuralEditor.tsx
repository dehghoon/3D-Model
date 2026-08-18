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
type ContextMenuState = { x: number; y: number; entity: SelectedEntity } | null;
type ClipboardEntity = { type: "member"; value: Member } | { type: "surface"; value: Surface } | null;
type LtqPackage = { format: "linkoteq-project"; version: 1; savedAt: string; model: StructuralModel };

const initialX = [0, 6, 12];
const initialY = [0, 4, 8];
const initialLevels = [{ id: "L0", name: "Ground", elevation: 0 }, { id: "L1", name: "Level 1", elevation: 3.5 }];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const nextId = (prefix: string, count: number) => `${prefix}${count + 1}`;
const uniqueSorted = (values: number[]) => [...new Set(values.map((v) => Number(v.toFixed(4))))].sort((a, b) => a - b);
const nodeKey = (x: number, y: number, z: number) => `${x.toFixed(4)}|${y.toFixed(4)}|${z.toFixed(4)}`;
const toVector = (node: Node) => new THREE.Vector3(node.position.x, node.position.z, node.position.y);

function makeGridLines(xs: number[], ys: number[], xLabels?: string[], yLabels?: string[]): GridLine[] {
  const minX = Math.min(...xs, 0) - 1, maxX = Math.max(...xs, 0) + 1;
  const minY = Math.min(...ys, 0) - 1, maxY = Math.max(...ys, 0) + 1;
  return [
    ...xs.map((x, i) => ({ id: `GX${i + 1}`, label: xLabels?.[i] || String.fromCharCode(65 + i), start: { x, y: minY, z: 0 }, end: { x, y: maxY, z: 0 } })),
    ...ys.map((y, i) => ({ id: `GY${i + 1}`, label: yLabels?.[i] || `${i + 1}`, start: { x: minX, y, z: 0 }, end: { x: maxX, y, z: 0 } }))
  ];
}
function makeNodes(xs: number[], ys: number[], levels: StructuralModel["levels"]): Node[] {
  const nodes: Node[] = []; let index = 1;
  for (const level of levels) for (const y of ys) for (const x of xs) nodes.push({ id: `N${index++}`, position: { x, y, z: level.elevation }, levelId: level.id });
  return nodes;
}
function findNode(nodes: Node[], x: number, y: number, z: number) { const key = nodeKey(x, y, z); return nodes.find((n) => nodeKey(n.position.x, n.position.y, n.position.z) === key); }
function createBaseModel(): StructuralModel {
  const nodes = makeNodes(initialX, initialY, initialLevels);
  const n000 = findNode(nodes, 0, 0, 0)!, n600 = findNode(nodes, 6, 0, 0)!, n0035 = findNode(nodes, 0, 0, 3.5)!, n6035 = findNode(nodes, 6, 0, 3.5)!;
  return { schemaVersion: "0.1", project: { id: "P001", name: "3D Model Prototype", units: "SI" }, levels: clone(initialLevels), grids: makeGridLines(initialX, initialY), nodes, members: [
    { id: "C1", type: "column", startNodeId: n000.id, endNodeId: n0035.id },
    { id: "C2", type: "column", startNodeId: n600.id, endNodeId: n6035.id },
    { id: "B1", type: "beam", startNodeId: n0035.id, endNodeId: n6035.id, levelId: "L1" }
  ], surfaces: [], diaphragms: [], materials: [], sections: [], supports: [], loadCases: [], loads: [], loadCombinations: [] };
}
const baseModel = createBaseModel();
function extractGridCoordinates(grids: GridLine[]) {
  const xGrids = grids.filter((g) => Math.abs(g.start.x - g.end.x) < 1e-6).sort((a, b) => a.start.x - b.start.x);
  const yGrids = grids.filter((g) => Math.abs(g.start.y - g.end.y) < 1e-6).sort((a, b) => a.start.y - b.start.y);
  return { xs: uniqueSorted(xGrids.map((g) => g.start.x)), ys: uniqueSorted(yGrids.map((g) => g.start.y)), xGrids, yGrids };
}

function MemberMesh({ member, nodes, selected, onClick, onContextMenu }: { member: Member; nodes: Node[]; selected: boolean; onClick: (member: Member) => void; onContextMenu: (member: Member, x: number, y: number) => void }) {
  const startNode = nodes.find((n) => n.id === member.startNodeId), endNode = nodes.find((n) => n.id === member.endNodeId);
  const geometry = useMemo(() => {
    if (!startNode || !endNode) return null;
    const a = toVector(startNode), b = toVector(endNode), direction = b.clone().sub(a), length = direction.length(); if (!length) return null;
    const g = new THREE.BoxGeometry(selected ? 0.3 : 0.22, length, selected ? 0.3 : 0.22); g.translate(0, length / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())); g.translate(a.x, a.y, a.z); return g;
  }, [startNode, endNode, selected]);
  if (!geometry) return null;
  const baseColor = member.type === "column" ? "#2367a8" : member.type === "brace" ? "#d97706" : "#3f7d4f";
  return <mesh geometry={geometry} castShadow receiveShadow onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(member); }} onContextMenu={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); e.nativeEvent.preventDefault(); onContextMenu(member, e.nativeEvent.clientX, e.nativeEvent.clientY); }}><meshStandardMaterial color={selected ? "#f97316" : baseColor} metalness={0.25} roughness={0.55} /></mesh>;
}
function SurfaceMesh({ surface, nodes, levels, selected, onClick, onContextMenu }: { surface: Surface; nodes: Node[]; levels: StructuralModel["levels"]; selected: boolean; onClick: (surface: Surface) => void; onContextMenu: (surface: Surface, x: number, y: number) => void }) {
  const pts = surface.boundaryNodeIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as Node[];
  const common = { onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(surface); }, onContextMenu: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); e.nativeEvent.preventDefault(); onContextMenu(surface, e.nativeEvent.clientX, e.nativeEvent.clientY); } };
  if (surface.type === "slab" && pts.length >= 3) {
    const shape = new THREE.Shape(); pts.forEach((n, i) => i === 0 ? shape.moveTo(n.position.x, n.position.y) : shape.lineTo(n.position.x, n.position.y)); shape.closePath(); const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2);
    return <mesh {...common} geometry={geometry} position={[0, pts[0].position.z + 0.02, 0]} receiveShadow><meshStandardMaterial color={selected ? "#f97316" : "#9ca3af"} transparent opacity={0.5} side={THREE.DoubleSide} /></mesh>;
  }
  if (surface.type === "wall" && pts.length >= 2) {
    const [a, b] = pts, sorted = [...levels].sort((x, y) => x.elevation - y.elevation), li = sorted.findIndex((l) => l.id === surface.levelId), height = li >= 0 && sorted[li + 1] ? sorted[li + 1].elevation - sorted[li].elevation : 3.5;
    const length = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y), angle = Math.atan2(b.position.y - a.position.y, b.position.x - a.position.x);
    return <mesh {...common} position={[(a.position.x + b.position.x) / 2, a.position.z + height / 2, (a.position.y + b.position.y) / 2]} rotation={[0, -angle, 0]} castShadow><boxGeometry args={[length, height, 0.15]} /><meshStandardMaterial color={selected ? "#f97316" : "#8b5e3c"} transparent opacity={0.65} /></mesh>;
  }
  return null;
}
function ModelGrid({ grid, elevation, showLabel }: { grid: GridLine; elevation: number; showLabel: boolean }) {
  const points = useMemo<[number, number, number][]>(() => [[grid.start.x, elevation + 0.01, grid.start.y], [grid.end.x, elevation + 0.01, grid.end.y]], [grid, elevation]);
  const isX = Math.abs(grid.start.x - grid.end.x) < 1e-6, labelPosition: [number, number, number] = isX ? [grid.start.x, elevation + 0.05, grid.start.y - 0.45] : [grid.start.x - 0.45, elevation + 0.05, grid.start.y];
  return <><Line points={points} color="#667085" lineWidth={1} dashed dashSize={0.2} gapSize={0.12} />{showLabel && <Html position={labelPosition} center distanceFactor={12} style={{ pointerEvents: "none" }}><span className="gridLabel">{grid.label}</span></Html>}</>;
}
function NodePoint({ node, selected, onClick, showLabel }: { node: Node; selected: boolean; onClick: (node: Node) => void; showLabel: boolean }) {
  return <group position={toVector(node)}><mesh onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(node); }}><sphereGeometry args={[selected ? 0.16 : 0.105, 18, 18]} /><meshStandardMaterial color={selected ? "#f97316" : "#2563eb"} /></mesh>{showLabel && <Html position={[0, 0.22, 0]} center distanceFactor={11} style={{ pointerEvents: "none" }}><span className="nodeLabel">{node.id}</span></Html>}</group>;
}
function DimensionLabels({ model, onGridDimension, onLevelDimension }: { model: StructuralModel; onGridDimension: (axis: GridAxis, index: number, current: number) => void; onLevelDimension: (index: number, current: number) => void }) {
  const { xs, ys } = extractGridCoordinates(model.grids), levels = [...model.levels].sort((a, b) => a.elevation - b.elevation);
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 0), minY = Math.min(...ys, 0); const labels: React.ReactNode[] = [];
  for (let i = 0; i < xs.length - 1; i++) { const d = xs[i + 1] - xs[i]; labels.push(<Html key={`dx-${i}`} position={[(xs[i] + xs[i + 1]) / 2, 0.06, minY - 0.9]} center distanceFactor={12} style={{ pointerEvents: "auto" }}><button className="dimLabel dimButton" onClick={(e) => { e.stopPropagation(); onGridDimension("X", i, d); }}>{d.toFixed(2)} m</button></Html>); }
  for (let i = 0; i < ys.length - 1; i++) { const d = ys[i + 1] - ys[i]; labels.push(<Html key={`dy-${i}`} position={[minX - 0.9, 0.06, (ys[i] + ys[i + 1]) / 2]} center distanceFactor={12} style={{ pointerEvents: "auto" }}><button className="dimLabel dimButton" onClick={(e) => { e.stopPropagation(); onGridDimension("Y", i, d); }}>{d.toFixed(2)} m</button></Html>); }
  for (let i = 0; i < levels.length - 1; i++) { const d = levels[i + 1].elevation - levels[i].elevation, x = maxX + 1.1; labels.push(<group key={`lz-${i}`}><Line points={[[x, levels[i].elevation, minY], [x, levels[i + 1].elevation, minY]]} color="#475467" lineWidth={1} /><Html position={[x, (levels[i].elevation + levels[i + 1].elevation) / 2, minY]} center distanceFactor={12} style={{ pointerEvents: "auto" }}><button className="dimLabel dimButton levelDim" onClick={(e) => { e.stopPropagation(); onLevelDimension(i, d); }}>{d.toFixed(2)} m</button></Html></group>); }
  return <>{labels}</>;
}
function CameraRig({ zoomSignal, resetSignal }: { zoomSignal: number; resetSignal: number }) {
  const { camera, size } = useThree(); const lastZoom = useRef(zoomSignal), lastReset = useRef(resetSignal), mobile = size.width < 720; const target = useMemo(() => new THREE.Vector3(6, 1.8, 4), []);
  useEffect(() => { if (resetSignal !== lastReset.current) { camera.position.set(mobile ? 17 : 16, mobile ? 10.5 : 10, mobile ? 17 : 16); camera.lookAt(target); camera.updateProjectionMatrix(); lastReset.current = resetSignal; } }, [camera, resetSignal, target, mobile]);
  useEffect(() => { const delta = zoomSignal - lastZoom.current; if (!delta) return; const offset = camera.position.clone().sub(target).multiplyScalar(delta > 0 ? 0.78 : 1.28); camera.position.copy(target.clone().add(offset)); camera.lookAt(target); camera.updateProjectionMatrix(); lastZoom.current = zoomSignal; }, [camera, target, zoomSignal]); return null;
}
function Scene(props: { model: StructuralModel; selectedNodeIds: string[]; selectedEntity: SelectedEntity; onNodeClick: (n: Node) => void; onMemberClick: (m: Member) => void; onMemberContext: (m: Member, x: number, y: number) => void; onSurfaceClick: (s: Surface) => void; onSurfaceContext: (s: Surface, x: number, y: number) => void; onGridDimension: (axis: GridAxis, index: number, current: number) => void; onLevelDimension: (index: number, current: number) => void; zoomSignal: number; resetSignal: number }) {
  const { width } = useThree((s) => s.size), compact = width < 720, ground = [...props.model.levels].sort((a, b) => a.elevation - b.elevation)[0];
  const visibleNodes = compact ? props.model.nodes.filter((n) => n.levelId === ground?.id || props.selectedNodeIds.includes(n.id)) : props.model.nodes;
  return <><CameraRig zoomSignal={props.zoomSignal} resetSignal={props.resetSignal} /><color attach="background" args={["#edf2f7"]} /><ambientLight intensity={1.15} /><directionalLight position={[10, 14, 8]} intensity={2} castShadow />
    {props.model.grids.map((g) => <ModelGrid key={`ground-${g.id}`} grid={g} elevation={ground?.elevation || 0} showLabel={!compact} />)}
    {!compact && props.model.levels.filter((l) => l.id !== ground?.id).map((l) => props.model.grids.map((g) => <ModelGrid key={`${l.id}-${g.id}`} grid={g} elevation={l.elevation} showLabel={false} />))}
    {!compact && <DimensionLabels model={props.model} onGridDimension={props.onGridDimension} onLevelDimension={props.onLevelDimension} />}
    {visibleNodes.map((n) => <NodePoint key={n.id} node={n} selected={props.selectedNodeIds.includes(n.id)} onClick={props.onNodeClick} showLabel={!compact} />)}
    {props.model.members.map((m) => <MemberMesh key={m.id} member={m} nodes={props.model.nodes} selected={props.selectedEntity?.type === "member" && props.selectedEntity.id === m.id} onClick={props.onMemberClick} onContextMenu={props.onMemberContext} />)}
    {props.model.surfaces.map((s) => <SurfaceMesh key={s.id} surface={s} nodes={props.model.nodes} levels={props.model.levels} selected={props.selectedEntity?.type === "surface" && props.selectedEntity.id === s.id} onClick={props.onSurfaceClick} onContextMenu={props.onSurfaceContext} />)}
    <Grid position={[6, -0.02, 4]} args={[24, 20]} cellSize={1} sectionSize={4} infiniteGrid fadeDistance={40} /><OrbitControls makeDefault target={[6, 1.8, 4]} enableZoom zoomSpeed={1.15} enableDamping dampingFactor={0.08} minDistance={3} maxDistance={70} /></>;
}

export default function StructuralEditor() {
  const [tool, setTool] = useState<Tool>("select"), [model, setModel] = useState<StructuralModel>(baseModel), [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]), [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null), [status, setStatus] = useState("Ready — choose a tool or click an element."), [uploaded, setUploaded] = useState<string[]>([]);
  const [gridAxis, setGridAxis] = useState<GridAxis>("X"), [gridName, setGridName] = useState("D"), [gridCoordinate, setGridCoordinate] = useState("18"), [levelName, setLevelName] = useState("Level 2"), [levelElevation, setLevelElevation] = useState("7"), [zoomSignal, setZoomSignal] = useState(0), [resetSignal, setResetSignal] = useState(0);
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]), [sectionLoading, setSectionLoading] = useState(true), [past, setPast] = useState<StructuralModel[]>([]), [future, setFuture] = useState<StructuralModel[]>([]), [contextMenu, setContextMenu] = useState<ContextMenuState>(null), [clipboard, setClipboard] = useState<ClipboardEntity>(null);
  const aiInput = useRef<HTMLInputElement>(null), dxfInput = useRef<HTMLInputElement>(null), ifcInput = useRef<HTMLInputElement>(null), projectInput = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch("/api/w-sections").then((r) => r.json()).then((d) => setSectionOptions(Array.isArray(d.sections) ? d.sections : [])).catch(() => setStatus("Could not load W-section library.")).finally(() => setSectionLoading(false)); }, []);
  function commit(next: StructuralModel, message?: string) { setPast((p) => [...p.slice(-49), clone(model)]); setFuture([]); setModel(next); if (message) setStatus(message); }
  function undo() { if (!past.length) return; const previous = past[past.length - 1]; setFuture((f) => [clone(model), ...f].slice(0, 50)); setPast((p) => p.slice(0, -1)); setModel(previous); setSelectedEntity(null); setSelectedNodeIds([]); setStatus("Undo."); }
  function redo() { if (!future.length) return; const next = future[0]; setPast((p) => [...p.slice(-49), clone(model)]); setFuture((f) => f.slice(1)); setModel(next); setSelectedEntity(null); setSelectedNodeIds([]); setStatus("Redo."); }
  function chooseTool(next: Tool) { setTool(next); setSelectedNodeIds([]); setSelectedEntity(null); setContextMenu(null); setStatus(next === "select" ? "Select mode." : `${next}: click the required node(s).`); }

  function finishSlab() {
    if (tool !== "slab" || selectedNodeIds.length < 3) return;
    const ids = selectedNodeIds.slice(0, 4), nodes = ids.map((id) => model.nodes.find((n) => n.id === id)).filter(Boolean) as Node[];
    if (!nodes.every((n) => n.levelId === nodes[0].levelId)) { setStatus("Slab nodes must be on the same level."); return; }
    commit({ ...model, surfaces: [...model.surfaces, { id: nextId("S", model.surfaces.filter((s) => s.type === "slab").length), type: "slab", boundaryNodeIds: ids, levelId: nodes[0].levelId, thickness: 0.18 }] }, `${ids.length}-point slab created.`); setSelectedNodeIds([]);
  }
  function createFromSelection(ids: string[]) {
    const selectedNodes = ids.map((id) => model.nodes.find((n) => n.id === id)).filter(Boolean) as Node[];
    if (tool === "slab") { if (selectedNodes.length === 3) { setStatus("Slab: 3 points selected. Click Finish Slab for triangle, or select a 4th point."); return; } if (selectedNodes.length >= 4) { finishSlab(); return; } setStatus(`Slab: select ${3 - selectedNodes.length} more point(s) minimum.`); return; }
    if (selectedNodes.length < 2) { setStatus(`${tool}: select one more node.`); return; }
    const [a, b] = selectedNodes;
    if (tool === "beam" && a.levelId !== b.levelId) { setStatus("Beam endpoints must be on the same level."); setSelectedNodeIds([]); return; }
    if (tool === "column" && (Math.abs(a.position.x - b.position.x) > 1e-6 || Math.abs(a.position.y - b.position.y) > 1e-6 || a.levelId === b.levelId)) { setStatus("Column needs vertically aligned nodes on different levels."); setSelectedNodeIds([]); return; }
    if (tool === "wall" && a.levelId !== b.levelId) { setStatus("Wall base nodes must be on the same level."); setSelectedNodeIds([]); return; }
    if (tool === "wall") { commit({ ...model, surfaces: [...model.surfaces, { id: nextId("W", model.surfaces.filter((s) => s.type === "wall").length), type: "wall", boundaryNodeIds: [a.id, b.id], levelId: a.levelId, thickness: 0.15 }] }, "Wall created."); setSelectedNodeIds([]); return; }
    if (tool === "beam" || tool === "column" || tool === "brace") { const prefix = tool === "beam" ? "B" : tool === "column" ? "C" : "BR"; const member: Member = { id: nextId(prefix, model.members.filter((m) => m.type === tool).length), type: tool, startNodeId: a.id, endNodeId: b.id, levelId: tool === "beam" ? a.levelId : undefined }; commit({ ...model, members: [...model.members, member] }, `${tool} created.`); setSelectedNodeIds([]); }
  }
  function onNodeClick(node: Node) { if (tool === "select") { setSelectedNodeIds([node.id]); setSelectedEntity(null); return; } const next = selectedNodeIds.includes(node.id) ? selectedNodeIds : [...selectedNodeIds, node.id]; setSelectedNodeIds(next); createFromSelection(next); }

  function addGrid() {
    const coordinate = Number(gridCoordinate);
    if (!Number.isFinite(coordinate)) return setStatus("Grid coordinate must be numeric.");
    const { xs, ys, xGrids, yGrids } = extractGridCoordinates(model.grids);
    if ((gridAxis === "X" ? xs : ys).some((v) => Math.abs(v - coordinate) < 1e-6)) return setStatus("A grid already exists there.");
    const nextXs = gridAxis === "X" ? uniqueSorted([...xs, coordinate]) : xs;
    const nextYs = gridAxis === "Y" ? uniqueSorted([...ys, coordinate]) : ys;
    const xLabels = nextXs.map((x) => gridAxis === "X" && Math.abs(x - coordinate) < 1e-6 ? gridName.trim() || `X${nextXs.indexOf(x)+1}` : xGrids.find((g) => Math.abs(g.start.x-x)<1e-6)?.label || `X${nextXs.indexOf(x)+1}`);
    const yLabels = nextYs.map((y) => gridAxis === "Y" && Math.abs(y - coordinate) < 1e-6 ? gridName.trim() || `Y${nextYs.indexOf(y)+1}` : yGrids.find((g) => Math.abs(g.start.y-y)<1e-6)?.label || `Y${nextYs.indexOf(y)+1}`);
    const nodes = [...model.nodes];
    let idx = nodes.length + 1;
    for (const level of model.levels) {
      if (gridAxis === "X") {
        for (const y of nextYs) {
          if (!findNode(nodes, coordinate, y, level.elevation)) nodes.push({ id: `N${idx++}`, position: { x: coordinate, y, z: level.elevation }, levelId: level.id });
        }
      } else {
        for (const x of nextXs) {
          if (!findNode(nodes, x, coordinate, level.elevation)) nodes.push({ id: `N${idx++}`, position: { x, y: coordinate, z: level.elevation }, levelId: level.id });
        }
      }
    }
    commit({ ...model, grids: makeGridLines(nextXs, nextYs, xLabels, yLabels), nodes }, `Grid ${gridName} added.`);
  }
  function addLevel(){ const elevation=Number(levelElevation); if(!Number.isFinite(elevation)) return setStatus("Level elevation must be numeric."); if(model.levels.some((l)=>Math.abs(l.elevation-elevation)<1e-6)) return setStatus("A level already exists there."); const {xs,ys}=extractGridCoordinates(model.grids),id=`L${model.levels.length}`,level={id,name:levelName.trim()||`Level ${model.levels.length}`,elevation},nodes=[...model.nodes]; let idx=nodes.length+1; for(const y of ys) for(const x of xs) nodes.push({id:`N${idx++}`,position:{x,y,z:elevation},levelId:id}); commit({...model,levels:[...model.levels,level].sort((a,b)=>a.elevation-b.elevation),nodes},`${level.name} added.`); }
  function editGridDimension(axis:GridAxis,index:number,current:number){ const raw=window.prompt(`New ${axis}-grid spacing (m)`,current.toFixed(2)); if(raw===null)return; const desired=Number(raw); if(!Number.isFinite(desired)||desired<=0)return setStatus("Spacing must be > 0."); const {xs,ys,xGrids,yGrids}=extractGridCoordinates(model.grids),coords=axis==="X"?xs:ys,threshold=coords[index+1],delta=desired-current,shifted=coords.map((v,i)=>i>index?v+delta:v),nextXs=axis==="X"?shifted:xs,nextYs=axis==="Y"?shifted:ys,nodes=model.nodes.map((n)=>({...n,position:{...n.position,...(axis==="X"&&n.position.x>=threshold-1e-6?{x:n.position.x+delta}:{}),...(axis==="Y"&&n.position.y>=threshold-1e-6?{y:n.position.y+delta}:{})}})); commit({...model,grids:makeGridLines(nextXs,nextYs,xGrids.map(g=>g.label),yGrids.map(g=>g.label)),nodes},"Grid spacing updated; structure adjusted."); }
  function editLevelDimension(index:number,current:number){ const levels=[...model.levels].sort((a,b)=>a.elevation-b.elevation),raw=window.prompt("New level-to-level height (m)",current.toFixed(2)); if(raw===null)return; const desired=Number(raw); if(!Number.isFinite(desired)||desired<=0)return setStatus("Height must be > 0."); const delta=desired-current,ids=new Set(levels.slice(index+1).map(l=>l.id)); commit({...model,levels:model.levels.map(l=>ids.has(l.id)?{...l,elevation:l.elevation+delta}:l).sort((a,b)=>a.elevation-b.elevation),nodes:model.nodes.map(n=>n.levelId&&ids.has(n.levelId)?{...n,position:{...n.position,z:n.position.z+delta}}:n)},"Level spacing updated; upper structure adjusted."); }

  function deleteSelected(){ if(!selectedEntity)return setStatus("Select an element first."); const id=selectedEntity.id; commit(selectedEntity.type==="member"?{...model,members:model.members.filter(m=>m.id!==id),loads:model.loads.filter(l=>l.targetId!==id)}:{...model,surfaces:model.surfaces.filter(s=>s.id!==id),loads:model.loads.filter(l=>l.targetId!==id)},`${id} deleted.`); setSelectedEntity(null); setContextMenu(null); }
  function copySelected(){ if(!selectedEntity)return; setClipboard(selectedEntity.type==="member"?{type:"member",value:clone(model.members.find(m=>m.id===selectedEntity.id)!)}:{type:"surface",value:clone(model.surfaces.find(s=>s.id===selectedEntity.id)!)}); setStatus(`${selectedEntity.id} copied.`); setContextMenu(null); }
  function pasteCopied(){ if(!clipboard)return setStatus("Nothing copied yet."); if(clipboard.type==="member"){ const p=clipboard.value.type==="beam"?"B":clipboard.value.type==="column"?"C":"BR",value={...clone(clipboard.value),id:nextId(p,model.members.filter(m=>m.type===clipboard.value.type).length)}; commit({...model,members:[...model.members,value]},`${value.id} pasted at original location.`); setSelectedEntity({type:"member",id:value.id}); } else { const p=clipboard.value.type==="slab"?"S":"W",value={...clone(clipboard.value),id:nextId(p,model.surfaces.filter(s=>s.type===clipboard.value.type).length)}; commit({...model,surfaces:[...model.surfaces,value]},`${value.id} pasted at original location.`); setSelectedEntity({type:"surface",id:value.id}); } setContextMenu(null); }
  function assignSection(sectionId:string){ if(!selectedEntity||selectedEntity.type!=="member")return; const option=sectionOptions.find(s=>s.id===sectionId); if(!option)return; const section:Section={id:option.id,family:option.family||"W",materialType:"steel",designation:option.designation_metric||option.designation,geometry:{},properties:option.properties},sections=model.sections.some(s=>s.id===section.id)?model.sections:[...model.sections,section],members=model.members.map(m=>m.id===selectedEntity.id?{...m,sectionId:section.id}:m); commit({...model,members,sections},`${section.designation} assigned.`); }
  function addLoad(category:LoadCategory){ const target=selectedEntity?.id||model.members[0]?.id;if(!target)return setStatus("Add or select an element first.");const caseId=`LC_${category.toUpperCase()}`,loadCases:LoadCase[]=model.loadCases.some(c=>c.id===caseId)?model.loadCases:[...model.loadCases,{id:caseId,name:category[0].toUpperCase()+category.slice(1),category}],load:Load={id:`LOAD_${model.loads.length+1}`,type:"line",targetId:target,loadCaseId:caseId,direction:{x:0,y:0,z:-1},magnitude:category==="dead"?5:category==="live"?3:1,unit:"kN/m"};commit({...model,loadCases,loads:[...model.loads,load]},`${category} load added.`); }
  function onUpload(kind:UploadKind,e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;setUploaded(u=>[...u,`${kind.toUpperCase()}: ${file.name}`]);setStatus(`${file.name} staged for ${kind==="ai"?"AI extraction":kind.toUpperCase()+" import"}.`);e.target.value="";}

  function saveProject(){ const pkg:LtqPackage={format:"linkoteq-project",version:1,savedAt:new Date().toISOString(),model}; const blob=new Blob([JSON.stringify(pkg,null,2)],{type:"application/vnd.linkoteq.project+json"}),url=URL.createObjectURL(blob),a=document.createElement("a"); a.href=url;a.download=`${model.project.name.replace(/[^a-z0-9_-]+/gi,"-")||"project"}.ltq`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus("Project saved as .ltq."); }
  async function openProject(e:ChangeEvent<HTMLInputElement>){ const file=e.target.files?.[0]; if(!file)return; try{const raw=JSON.parse(await file.text()) as LtqPackage|StructuralModel; const incoming=(raw as LtqPackage).format==="linkoteq-project"?(raw as LtqPackage).model:raw as StructuralModel; if(!incoming||incoming.schemaVersion!=="0.1"||!Array.isArray(incoming.nodes)||!Array.isArray(incoming.members))throw new Error("invalid"); setPast(p=>[...p.slice(-49),clone(model)]);setFuture([]);setModel(incoming);setSelectedEntity(null);setSelectedNodeIds([]);setStatus(`${file.name} opened.`);setResetSignal(r=>r+1);}catch{setStatus("Could not open this .ltq project.");} finally{e.target.value="";} }
  function newProject(){ if(!window.confirm("Start a new project? Unsaved changes will be lost."))return; commit(createBaseModel(),"New project created.");setResetSignal(r=>r+1); }

  useEffect(()=>{ const onKey=(e:KeyboardEvent)=>{const t=e.target as HTMLElement|null;if(t?.tagName==="INPUT"||t?.tagName==="SELECT"||t?.tagName==="TEXTAREA")return;const mod=e.ctrlKey||e.metaKey;if((e.key==="Delete"||e.key==="Backspace")&&!mod){e.preventDefault();deleteSelected();}else if(mod&&e.key.toLowerCase()==="z"&&e.shiftKey){e.preventDefault();redo();}else if(mod&&e.key.toLowerCase()==="z"){e.preventDefault();undo();}else if(mod&&e.key.toLowerCase()==="y"){e.preventDefault();redo();}else if(mod&&e.key.toLowerCase()==="c"){e.preventDefault();copySelected();}else if(mod&&e.key.toLowerCase()==="v"){e.preventDefault();pasteCopied();}else if(mod&&e.key.toLowerCase()==="s"){e.preventDefault();saveProject();}else if(e.key==="Enter"&&tool==="slab"&&selectedNodeIds.length>=3){e.preventDefault();finishSlab();}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[model,past,future,selectedEntity,clipboard,tool,selectedNodeIds]);
  useEffect(()=>{const close=()=>setContextMenu(null);window.addEventListener("pointerdown",close);return()=>window.removeEventListener("pointerdown",close);},[]);

  const selectedMember=selectedEntity?.type==="member"?model.members.find(m=>m.id===selectedEntity.id):undefined,currentSection=selectedMember?.sectionId?model.sections.find(s=>s.id===selectedMember.sectionId):undefined;
  const {xs,ys}=extractGridCoordinates(model.grids),levels=[...model.levels].sort((a,b)=>a.elevation-b.elevation);
  return <div className="appShell">
    <header className="topbar"><div><strong>Linkoteq 3D Structural Editor</strong><span>SI geometry · metres</span></div><div className="topActions fileActions"><button onClick={newProject}>New</button><button onClick={()=>projectInput.current?.click()}>Open</button><button onClick={saveProject}>Save</button><button onClick={undo} disabled={!past.length}>↶</button><button onClick={redo} disabled={!future.length}>↷</button><button className="dangerButton" onClick={deleteSelected}>⌫</button><button className="runButton" onClick={()=>setStatus("Run adapter placeholder: Core → PyNite → Calculators.")}>Run</button><button onClick={()=>window.print()}>Print</button><button onClick={()=>setStatus("IFC export adapter is not connected yet.")}>IFC</button></div><input ref={projectInput} hidden type="file" accept=".ltq,application/json" onChange={openProject}/></header>
    <div className="importbar"><strong>IMPORT</strong><button onClick={()=>aiInput.current?.click()}>PDF/Image → AI</button><button onClick={()=>dxfInput.current?.click()}>DXF</button><button onClick={()=>ifcInput.current?.click()}>IFC</button><input ref={aiInput} hidden type="file" accept=".pdf,image/*" onChange={e=>onUpload("ai",e)}/><input ref={dxfInput} hidden type="file" accept=".dxf" onChange={e=>onUpload("dxf",e)}/><input ref={ifcInput} hidden type="file" accept=".ifc" onChange={e=>onUpload("ifc",e)}/><span className="statusText">{status}</span></div>
    <main className="workspace"><aside className="toolbar"><section className="panelBlock"><h3>Model tools</h3><div className="toolGrid twoCol">{(["select","beam","column","brace","wall","slab"] as Tool[]).map(t=><button key={t} className={tool===t?"active":""} onClick={()=>chooseTool(t)}>{t==="select"?"Select":`+ ${t[0].toUpperCase()}${t.slice(1)}`}</button>)}</div>{tool==="slab"&&selectedNodeIds.length>=3&&<button className="primaryWide" onClick={finishSlab}>Finish Slab ({selectedNodeIds.length})</button>}</section>
      <section className="panelBlock"><h3>Add Grid</h3><div className="inlineFields"><select value={gridAxis} onChange={e=>setGridAxis(e.target.value as GridAxis)}><option value="X">X</option><option value="Y">Y</option></select><input value={gridName} onChange={e=>setGridName(e.target.value)} placeholder="Name"/></div><div className="fieldWithUnit"><input type="number" step="0.1" value={gridCoordinate} onChange={e=>setGridCoordinate(e.target.value)}/><span>m</span></div><button className="primaryWide" onClick={addGrid}>Add Grid</button></section>
      <section className="panelBlock"><h3>Add Level</h3><input value={levelName} onChange={e=>setLevelName(e.target.value)}/><div className="fieldWithUnit"><input type="number" step="0.1" value={levelElevation} onChange={e=>setLevelElevation(e.target.value)}/><span>m</span></div><button className="primaryWide" onClick={addLevel}>Add Level</button></section>
      <section className="panelBlock"><h3>Loads</h3><div className="toolGrid twoCol">{(["dead","live","wind","seismic"] as LoadCategory[]).map(x=><button key={x} onClick={()=>addLoad(x)}>+ {x}</button>)}</div></section></aside>
      <section className="viewport" onContextMenu={e=>e.preventDefault()}><Canvas shadows camera={{position:[16,10,16],fov:44}}><Scene model={model} selectedNodeIds={selectedNodeIds} selectedEntity={selectedEntity} onNodeClick={onNodeClick} onMemberClick={m=>{setTool("select");setSelectedNodeIds([]);setSelectedEntity({type:"member",id:m.id});}} onMemberContext={(m,x,y)=>{setTool("select");setSelectedNodeIds([]);setSelectedEntity({type:"member",id:m.id});setContextMenu({x,y,entity:{type:"member",id:m.id}});}} onSurfaceClick={s=>{setTool("select");setSelectedNodeIds([]);setSelectedEntity({type:"surface",id:s.id});}} onSurfaceContext={(s,x,y)=>{setTool("select");setSelectedNodeIds([]);setSelectedEntity({type:"surface",id:s.id});setContextMenu({x,y,entity:{type:"surface",id:s.id}});}} onGridDimension={editGridDimension} onLevelDimension={editLevelDimension} zoomSignal={zoomSignal} resetSignal={resetSignal}/></Canvas>
        <div className="viewControls"><button onClick={()=>setZoomSignal(z=>z+1)}>+</button><button onClick={()=>setZoomSignal(z=>z-1)}>−</button><button onClick={()=>setResetSignal(r=>r+1)}>⌂</button></div>
        <div className="mobileDimensions"><div><b>X</b>{xs.slice(0,-1).map((x,i)=><button key={`mx${i}`} onClick={()=>editGridDimension("X",i,xs[i+1]-x)}>{model.grids.filter(g=>Math.abs(g.start.x-g.end.x)<1e-6).sort((a,b)=>a.start.x-b.start.x)[i]?.label}–{model.grids.filter(g=>Math.abs(g.start.x-g.end.x)<1e-6).sort((a,b)=>a.start.x-b.start.x)[i+1]?.label}: {(xs[i+1]-x).toFixed(2)}m</button>)}</div><div><b>Y</b>{ys.slice(0,-1).map((y,i)=><button key={`my${i}`} onClick={()=>editGridDimension("Y",i,ys[i+1]-y)}>{(ys[i+1]-y).toFixed(2)}m</button>)}</div><div><b>L</b>{levels.slice(0,-1).map((l,i)=><button key={`ml${i}`} onClick={()=>editLevelDimension(i,levels[i+1].elevation-l.elevation)}>{l.name}→{levels[i+1].name}: {(levels[i+1].elevation-l.elevation).toFixed(2)}m</button>)}</div></div>
      </section>
      <aside className="inspector"><h2>Model Inspector</h2><div className="summaryCards"><div><b>{model.members.length}</b><span>Members</span></div><div><b>{model.levels.length}</b><span>Levels</span></div><div><b>{model.grids.length}</b><span>Grids</span></div><div><b>{model.loads.length}</b><span>Loads</span></div></div><h3>Selection</h3><p className="selectionText">{selectedEntity?`${selectedEntity.type}: ${selectedEntity.id}`:selectedNodeIds.length?selectedNodeIds.join(", "):"Nothing selected"}</p>{selectedMember&&<><h3>Steel W-section</h3><select className="sectionSelect" value={selectedMember.sectionId||""} disabled={sectionLoading} onChange={e=>assignSection(e.target.value)}><option value="">{sectionLoading?"Loading…":"Select W-section…"}</option>{sectionOptions.map(s=><option key={s.id} value={s.id}>{s.designation_metric||s.designation}</option>)}</select><p className="helper">Assigned: {currentSection?.designation||"None"}</p></>}<h3>Levels</h3><div className="simpleList">{levels.map(l=><div key={l.id}><b>{l.name}</b><span>{l.elevation.toFixed(2)} m</span></div>)}</div>{uploaded.length>0&&<><h3>Uploaded</h3><div className="simpleList">{uploaded.map((u,i)=><div key={i}>{u}</div>)}</div></>}<details><summary>Core Model JSON</summary><pre>{JSON.stringify(model,null,2)}</pre></details></aside></main>
    {contextMenu&&<div className="contextMenu" style={{left:contextMenu.x,top:contextMenu.y}} onPointerDown={e=>e.stopPropagation()}><button onClick={copySelected}>Copy <span>Ctrl+C</span></button><button onClick={pasteCopied} disabled={!clipboard}>Paste <span>Ctrl+V</span></button>{contextMenu.entity?.type==="member"&&<button onClick={()=>{setContextMenu(null);document.querySelector<HTMLSelectElement>(".sectionSelect")?.focus();}}>Assign section…</button>}<hr/><button className="contextDanger" onClick={deleteSelected}>Delete <span>Del</span></button></div>}
  </div>;
}
