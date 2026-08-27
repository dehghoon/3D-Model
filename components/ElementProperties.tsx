"use client";

import { createPortal } from "react-dom";
import type { Load, Member, Node, StructuralModel, Surface } from "@linkoteq/structural-core";

type Props = {
  model: StructuralModel;
  member?: Member;
  surface?: Surface;
  node?: Node;
  open: boolean;
  onClose: () => void;
};

const card: React.CSSProperties = {
  border: "1px solid #e4e7ec",
  borderRadius: 8,
  padding: 9,
  background: "#fbfcfd",
  display: "grid",
  gap: 6,
};
const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "100px 1fr",
  gap: 8,
  fontSize: 10,
  alignItems: "start",
};
const label: React.CSSProperties = { color: "#667085" };

function memberLength(model: StructuralModel, member: Member) {
  const a = model.nodes.find((n) => n.id === member.startNodeId)?.position;
  const b = model.nodes.find((n) => n.id === member.endNodeId)?.position;
  if (!a || !b) return undefined;
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function wallLength(model: StructuralModel, surface: Surface) {
  const a = model.nodes.find((n) => n.id === surface.boundaryNodeIds[0])?.position;
  const b = model.nodes.find((n) => n.id === surface.boundaryNodeIds[1])?.position;
  if (!a || !b) return undefined;
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function loadTargets(load: Load): string[] {
  switch (load.type) {
    case "nodal":
      return [load.nodeId];
    case "member-point":
    case "member-distributed":
      return [load.memberId];
    case "surface-pressure":
      return [load.surfaceId];
    case "self-weight":
      return load.targetMemberIds ?? [];
    case "level":
      return [load.levelId];
    case "diaphragm":
      return [load.diaphragmId];
  }
}

function loadSummary(load: Load): string {
  switch (load.type) {
    case "nodal":
      return Object.entries(load.components)
        .map(([key, value]) => `${key} ${value?.value ?? ""} ${value?.unit ?? ""}`.trim())
        .join(", ");
    case "member-point":
      return `${load.direction} ${load.magnitude.value} ${load.magnitude.unit} @ ${load.x.value} ${load.x.unit}`;
    case "member-distributed":
      return `${load.direction} ${load.w1.value}→${load.w2.value} ${load.w1.unit}`;
    case "surface-pressure":
      return `${load.pressure.value} ${load.pressure.unit}`;
    case "self-weight":
      return `${load.globalDirection} × ${load.factor}`;
    case "level":
      return load.forceUnit;
    case "diaphragm":
      return load.forceUnit;
  }
}

export default function ElementProperties({ model, member, surface, node, open, onClose }: Props) {
  if (!open || typeof document === "undefined") return null;
  const id = member?.id || surface?.id || node?.id;
  if (!id) return null;

  const loads = model.loads.filter((load) => loadTargets(load).includes(id));
  const section = member?.sectionId ? model.sections.find((s) => s.id === member.sectionId) : undefined;
  const materialId = member?.materialId || surface?.materialId;
  const material = materialId ? model.materials.find((m) => m.id === materialId) : undefined;
  const type = member?.type || surface?.type || "node";
  const length = member
    ? memberLength(model, member)
    : surface?.type === "wall"
      ? wallLength(model, surface)
      : undefined;

  return createPortal(
    <div className="propertiesBackdrop" onPointerDown={onClose}>
      <aside className="propertiesDrawer" onPointerDown={(event) => event.stopPropagation()}>
        <div className="propertiesHeader">
          <div>
            <strong>Properties</strong>
            <span> · {id}</span>
          </div>
          <button onClick={onClose}>×</button>
        </div>

        <div className="propertiesBody">
          <div style={card}>
            <div style={row}><span style={label}>Element No.</span><b>{id}</b></div>
            <div style={row}><span style={label}>Type</span><span>{type}</span></div>
            {member && (
              <>
                <div style={row}><span style={label}>Start node</span><span>{member.startNodeId}</span></div>
                <div style={row}><span style={label}>End node</span><span>{member.endNodeId}</span></div>
              </>
            )}
            {surface && (
              <div style={row}>
                <span style={label}>Boundary nodes</span>
                <span>{surface.boundaryNodeIds.join(", ")}</span>
              </div>
            )}
            {node && (
              <div style={row}>
                <span style={label}>Coordinates</span>
                <span>{node.position.x.toFixed(3)}, {node.position.y.toFixed(3)}, {node.position.z.toFixed(3)} m</span>
              </div>
            )}
            {(member || surface) && (
              <div style={row}>
                <span style={label}>Level</span>
                <span>{member?.levelId || surface?.levelId || "—"}</span>
              </div>
            )}
            {length !== undefined && (
              <div style={row}><span style={label}>Length</span><b>{length.toFixed(3)} m</b></div>
            )}
            {member && (
              <div style={row}>
                <span style={label}>Section</span>
                <span>{section?.designation || member.sectionId || "Not assigned"}</span>
              </div>
            )}
            {(member || surface) && (
              <div style={row}>
                <span style={label}>Material</span>
                <span>{material?.name || materialId || "Not assigned"}</span>
              </div>
            )}
          </div>

          <div style={card}>
            <strong style={{ fontSize: 11 }}>Assigned loads</strong>
            {loads.length ? (
              loads.map((load) => (
                <div key={load.id} style={{ fontSize: 10 }}>
                  <b>{load.loadCaseId}</b> · {loadSummary(load)} · {load.type}
                </div>
              ))
            ) : (
              <span style={{ fontSize: 10, color: "#98a2b3" }}>No loads assigned.</span>
            )}
          </div>

          <div style={card}>
            <strong style={{ fontSize: 11 }}>References</strong>
            {member && (
              <>
                <div style={row}>
                  <span style={label}>Section ID</span>
                  <span>{member.sectionId || "—"}</span>
                </div>
                <div style={row}>
                  <span style={label}>Material ID</span>
                  <span>{member.materialId || "—"}</span>
                </div>
              </>
            )}
            {surface && (
              <div style={row}>
                <span style={label}>Load transfer</span>
                <span>{surface.loadTransfer?.method || "—"}</span>
              </div>
            )}
            {loads.map((load) => (
              <div key={`ref-${load.id}`} style={row}>
                <span style={label}>{load.id}</span>
                <span>{load.provenance?.sourceId || "manual"}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
