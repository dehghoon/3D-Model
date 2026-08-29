"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Member, Node, StructuralModel, Surface } from "@linkoteq/structural-core";
import CiscSectionSelectorV05 from "./CiscSectionSelectorV05";
import LevelGridEditorV05 from "./LevelGridEditorV05";
import LoadManager from "./LoadManager";
import MemberCreatorV05 from "./MemberCreatorV05";
import NodeCreatorV05 from "./NodeCreatorV05";
import SelectedNodeSupportV05 from "./SelectedNodeSupportV05";
import SurfaceCreatorV05 from "./SurfaceCreatorV05";
import { assertCanonicalV05, migrateProjectToV05 } from "../lib/core-v05";
import {
  createDefaultPortalFrame,
  DEFAULT_CISC_DESIGNATION,
  loadApprovedCiscSections,
  type CiscSectionRecord,
} from "../lib/cisc-section-library-v05";

type Selection =
  | { type: "node"; id: string }
  | { type: "member"; id: string }
  | { type: "surface"; id: string }
  | null;

function emptyModel(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "PROJECT001", name: "3D Model", units: "SI" },
    levels: [],
    grids: [],
    nodes: [],
    members: [],
    surfaces: [],
    diaphragms: [],
    materials: [],
    sections: [],
    supports: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
  };
}

function downloadModel(model: StructuralModel) {
  assertCanonicalV05(model);
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${model.project.id}.jsong;
  anchor.click();
  URL.revokeObjectURL(url);
}

function displayPosition(node: Node): [number, number, number] {
  // Core keeps global X/Y/Z. Three.js uses Y as the screen-up axis, so global Z is displayed vertically.
  return [node.position.x, node.position.z, node.position.y];
}

function MemberMesh({
  member,
  nodes,
  selected,
  onSelect,
}: {
  member: Member;
  nodes: Node[];
  selected: boolean;
  onSelect: () => void;
}) {
  const start = nodes.find((node) => node.id === member.startNodeId);
  const end = nodes.find((node) => node.id === member.endNodeId);

  const geometry = useMemo(() => {
    if (!start || !end) return null;
    const a = new THREE.Vector3(...displayPosition(start));
    const b = new THREE.Vector3(...displayPosition(end));
    const direction = b.clone().sub(a);
    const length = direction.length();
    if (!length) return null;

    const box = new THREE.BoxGeometry(selected ? 0.28 : 0.22, length, selected ? 0.28 : 0.22);
    box.translate(0, length / 2, 0);
    box.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      ),
    );
    box.translate(a.x, a.y, a.z);
    return box;
  }, [start, end, selected]);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <meshStandardMaterial
        color={selected ? "#f97316" : member.type === "column" ? "#2563eb" : "#26734d"}
      />
    </mesh>
  );
}

function buildSurfaceGeometry(points: Node[]): THREE.BufferGeometry | null {
  if (points.length < 3) return null;

  const vertices = points.map((node) => new THREE.Vector3(...displayPosition(node)));
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

  const firstOffset = vertices.find(
    (vertex, index) => index > 0 && vertex.distanceToSquared(origin) > 1e-12,
  );
  if (!firstOffset) return null;

  const uAxis = firstOffset.clone().sub(origin).normalize();
  const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
  const contour = vertices.map((vertex) => {
    const relative = vertex.clone().sub(origin);
    return new THREE.Vector2(relative.dot(uAxis), relative.dot(vAxis));
  });

  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  if (!faces.length) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.zet]),
      3,
    ),
  );
  geometry.setIndex(faces.flat());
  geometry.computeVertexNormals();
  return geometry;
}

function SurfaceMesh({
  surface,
  nodes,
  selected,
  onSelect,
}: {
  surface: Surface;
  nodes: Node[];
  selected: boolean;
  onSelect: () => void;
}) {
  const points = useMemo(
    () =>
      surface.boundaryNodeIds
        .map((id) => nodes.find((node) => node.id === id))
        .filter((node): node is Node => Boolean(node)),
    [surface.boundaryNodeIds, nodes],
  );
  const geometry = useMemo(() => buildSurfaceGeometry(points), [points]);
  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <meshStandardMaterial
        color={selected ? "#f97316" : "#9ca3af"}
        transparent
        opacity={0.48}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Scene({
  model,
  selection,
  onSelect,
}: {
  model: StructuralModel;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[10, 14, 8]} intensity={1.8} />

      {model.surfaces.map((surface) => (
        <SurfaceMesh
          key={surface.id}
          surface={surface}
          nodes={model.nodes}
          selected={selection?.type === "surface" && selection.id === surface.id}
          onSelect={() => onSelect({ type: "surface", id: surface.id })}
        />
      ))}

      {model.members.map((member) => (
        <MemberMesh
          key={member.id}
          member={member}
          nodes={model.nodes}
          selected={selection?.type === "member" && selection.id === member.id}
          onSelect={() => onSelect({ type: "member", id: member.id })}
        />
      ))}

      {model.nodes.map((node) => {
        const selected = selection?.type === "node" && selection.id === node.id;
        return (
          <mesh
            key={node.id}
            position={displayPosition(node)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect({ type: "node", id: node.id });
            }}
          >
            <sphereGeometry args={[selected ? 0.15 : 0.095, 16, 16]} />
            <meshStandardMaterial color={selected ? "#f97316" : "#2563eb"} />
          </mesh>
        );
      })}

      <Grid args={[40, 40]} cellSize={1} sectionSize={5} fadeDistance={45} />
      <OrbitControls makeDefault enablePan enableZoom />
    </>
  );
}

export default function StructuralEditorV05() {
  const [model, setModel] = useState<StructuralModel>(() => emptyModel());
  const [selection, setSelection] = useState<Selection>(null);
  const [message, setMessage] = useState("Loading approved CISC data...");
  const [ciscCatalog, setCiscCatalog] = useState<CiscSectionRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const buildDefaultModel = useCallback((sections: CiscSectionRecord[]) => {
    const record =
      sections.find(
        (item) => item.designation.toUpperCase() === DEFAULT_CISC_DESIGNATION,
      ) ?? sections[0];
    if (!record) throw new Error("CISC_DEFAULT_SECTION_NOT_FOUND");
    const next = createDefaultPortalFrame(record);
    assertCanonicalV05(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadApprovedCiscSections()
      .then(({ datasetVersion, sections }) => {
        if (cancelled) return;
        setCiscCatalog(sections);
        if (!initializedRef.current) {
          const next = buildDefaultModel(sections);
          initializedRef.current = true;
          setModel(next);
          setSelection(null);
          setMessage(
            `Default portal frame restored from approved CISC dataset ${datasetVersion}.`,
          );
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Approved CISC dataset could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [buildDefaultModel]);

  async function importProject(file: File) {
    const parsed = JSON.parse(await file.text()) as unknown;
    const migrated = migrateProjectToV05(parsed);
    assertCanonicalV05(migrated.model);
    initializedRef.current = true;
    setModel(migrated.model as StructuralModel);
    setSelection(null);
    setMessage(
      migrated.warnings.length
        ? migrated.warnings.join(" ")
        : "Core v0.5 project imported.",
    );
  }

  function applyModelChange(next: StructuralModel, status: string) {
    try {
      assertCanonicalV05(next);
      initializedRef.current = true;
      setModel(next);
      setMessage(status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Core v0.5 model update failed.");
    }
  }

  function createNewProject() {
    try {
      if (!ciscCatalog.length) {
        setMessage("Waiting for approved CISC dataset before creating the default frame.");
        return;
      }
      const next = buildDefaultModel(ciscCatalog);
      initializedRef.current = true;
      setModel(next);
      setSelection(null);
      setMessage("New default portal frame created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "New project creation failed.");
    }
  }

  const selectedNodes =
    selection?.type === "node"
      ? model.nodes.filter((item) => item.id === selection.id)
      : [];

  const selectedLabel = selection ? `${selection.type}: ${selection.id}` : "None";

  return (
    <div className="appShell">
      <header className="topbar">
        <strong>Linkoteq 3D Structural Editor</strong>
        <div className="topActions">
          <button onClick={createNewProject}>New</button>
          <button onClick={() => inputRef.current?.click()}>Open</button>
          <button onClick={() => downloadModel(model)}>Save</button>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept=".json,.ltq,application/json"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (file) {
                importProject(file).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Import failed."));
              }
              event.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="importbar">
        <span>Core schema: {model.schemaVersion}</span>
        <span>Project: {model.project.id}</span>
        <span>Model: {model.nodes.length} nodes · {model.members.length} members · {model.surfaces.length} surfaces · {model.grids.length} grids</span>
        <span className="statusText">{message}</span>
      </div>

      <main className="workspace">
        <aside className="toolbar">
          <CiscSectionSelectorV05 model={model} onModelChange={applyModelChange} />

          <LevelGridEditorV05 model={model} onModelChange={applyModelChange} />

          <NodeCreatorV05
            model={model}
            onModelChange={applyModelChange}
            onNodeCreated={(nodeId) => setSelection({ type: "node", id: nodeId })}
          />

          <MemberCreatorV05
            model={model}
            onModelChange={applyModelChange}
            onMemberCreated={(memberId) => setSelection({ type: "member", id: memberId })}
          />

          <SurfaceCreatorV05
            model={model}
            selectedNodeId={selection?.type === "node" ? selection.id : undefined}
            onModelChange={applyModelChange}
            onSurfaceCreated={(surfaceId) => setSelection({ type: "surface", id: surfaceId })}
          />

          <SelectedNodeSupportV05
            model={model}
            selectedNodes={selectedNodes}
            onModelChange={applyModelChange}
          />

          <section className="panelBlock">
            <h3>Selection</h3>
            <div className="selectionText">{selectedLabel}</div>
            <button onClick={() => setSelection(null)} disabled={!selection}>
              Clear Selection
            </button>
          </section>
        </aside>

        <section
          className="viewport"
          onContextMenu={(event) => event.preventDefault()}
        >
          <Canvas
            shadows
            camera={{ position: [18, 12, 18], fov: 45 }}
            onPointerMissed={() => setSelection(null)}
          >
            <Scene
              model={model}
              selection={selection}
              onSelect={setSelection}
            />
          </Canvas>
          <div className="viewControls">Orbit ÷ Pan · Zoom</div>
        </section>

        <aside className="inspector">
          <h2>Inspector</h2>
          <p className="selectionText">{selectedLabel}</p>
          <details>
            <summary>Core Model JSON</summary>
            <pre>{JSON.stringify(model, null, 2)}</pre>
          </details>
        </aside>
      </main>

      <LoadManager
        model={model}
        selectedSurfaces={
          selection?.type === "surface"
            ? model.surfaces.filter((item) => item.id === selection.id)
            : []
        }
        selectedMembers={
          selection?.type === "member"
            ? model.members.filter((item) => item.id === selection.id)
            : []
        }
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
