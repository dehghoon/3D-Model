"use client";

import type { Member, Node, StructuralModel, Surface } from "@linkoteq/structural-core";
import type { EditorSelection } from "../lib/editor/selection";
import AssignmentPropertiesV05 from "./AssignmentPropertiesV05";
import MemberPropertiesV05 from "./MemberPropertiesV05";
import NodeBoundaryPropertiesV05 from "./NodeBoundaryPropertiesV05";

type Selection = Exclude<EditorSelection, null>;
type Props = {
  model: StructuralModel;
  selections?: Selection[];
  member?: Member;
  surface?: Surface;
  node?: Node;
  open: boolean;
  onClose: () => void;
  onModelChange?: (model: StructuralModel, status: string) => void;
};

function unique(selections: Selection[]) {
  return Array.from(new Map(selections.map((item) => [`${item.type}:${item.id}`, item])).values());
}

export default function ElementPropertiesV05({
  model,
  selections,
  member,
  surface,
  node,
  open,
  onClose,
  onModelChange,
}: Props) {
  const fallback: Selection[] = member
    ? [{ type: "member", id: member.id }]
    : surface
      ? [{ type: "surface", id: surface.id }]
      : node
        ? [{ type: "node", id: node.id }]
        : [];
  const active = unique(selections?.length ? selections : fallback);

  if (!open || !active.length) return null;

  const members = active
    .filter((item) => item.type === "member")
    .map((item) => model.members.find((candidate) => candidate.id === item.id))
    .filter((item): item is Member => Boolean(item));
  const surfaces = active
    .filter((item) => item.type === "surface")
    .map((item) => model.surfaces.find((candidate) => candidate.id === item.id))
    .filter((item): item is Surface => Boolean(item));
  const nodes = active
    .filter((item) => item.type === "node")
    .map((item) => model.nodes.find((candidate) => candidate.id === item.id))
    .filter((item): item is Node => Boolean(item));

  const ids = new Set(active.map((item) => item.id));
  const assignedLoads = model.loads.filter((load) => {
    switch (load.type) {
      case "nodal": return ids.has(load.nodeId);
      case "member-point":
      case "member-distributed": return ids.has(load.memberId);
      case "surface-pressure": return ids.has(load.surfaceId);
      case "self-weight": return (load.targetMemberIds ?? []).some((id) => ids.has(id));
      case "level": return ids.has(load.levelId);
      case "diaphragm": return ids.has(load.diaphragmId);
    }
  });

  return (
    <aside className="propertiesSidePanel" aria-label="Element properties" onPointerDown={(event) => event.stopPropagation()}>
      <header className="propertiesHeader">
        <div><strong>Properties</strong><span>{active.length} selected · Core v0.5</span></div>
        <button type="button" onClick={onClose} aria-label="Close properties">×</button>
      </header>

      <div className="propertiesBody">
        <section className="propertyActionCard">
          <div className="propertiesSectionHeading"><strong>Selection</strong><span>Canonical Core IDs</span></div>
          <div className="propertyCoreSummary">
            <small>{members.length} member(s) · {surfaces.length} surface(s) · {nodes.length} node(s)</small>
            {active.map((item) => <small key={`${item.type}:${item.id}`}><b>{item.type}</b> · {item.id}</small>)}
          </div>
        </section>

        <AssignmentPropertiesV05
          model={model}
          members={members}
          surfaces={surfaces}
          onModelChange={onModelChange}
        />

        {members.length === active.length ? (
          <MemberPropertiesV05 model={model} members={members} onModelChange={onModelChange} />
        ) : null}

        {nodes.length === active.length ? (
          <NodeBoundaryPropertiesV05 model={model} nodes={nodes} onModelChange={onModelChange} />
        ) : null}

        <section className="propertyActionCard">
          <div className="propertiesSectionHeading"><strong>Assigned Loads</strong><span>Read-only summary</span></div>
          <div className="propertyCoreSummary">
            <small>{assignedLoads.length} load record(s) target this selection.</small>
            {assignedLoads.map((load) => <small key={load.id}><b>{load.loadCaseId}</b> · {load.type} · {load.id}</small>)}
          </div>
        </section>
      </div>
    </aside>
  );
}
