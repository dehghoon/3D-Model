"use client";

import type {
  Load,
  Member,
  Node,
  StructuralModel,
  Surface,
} from "@linkoteq/structural-core";

import type { EditorSelection } from "../lib/editor/selection";

type ConcreteSelection = Exclude<EditorSelection, null>;

type Props = {
  model: StructuralModel;
  selections?: ConcreteSelection[];
  member?: Member;
  surface?: Surface;
  node?: Node;
  open: boolean;
  onClose: () => void;
  onModelChange?: (model: StructuralModel, status: string) => void;
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
  gridTemplateColumns: "104px minmax(0, 1fr)",
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
    case "diaphragm":
      return load.forceUnit;
  }
}

function keyOf(selection: ConcreteSelection): string {
  return `${selection.type}:${selection.id}`;
}

function uniqueSelections(selections: ConcreteSelection[]): ConcreteSelection[] {
  return Array.from(new Map(selections.map((item) => [keyOf(item), item])).values());
}

function commonValue<T>(values: T[]): { value: T | undefined; mixed: boolean } {
  if (!values.length) return { value: undefined, mixed: false };
  const first = values[0];
  return {
    value: values.every((value) => value === first) ? first : undefined,
    mixed: !values.every((value) => value === first),
  };
}

function selectionLabel(count: number, types: Set<string>): string {
  if (count === 1) {
    const type = Array.from(types)[0] ?? "element";
    return `1 ${type} selected`;
  }
  if (types.size === 1) {
    const type = Array.from(types)[0] ?? "element";
    return `${count} ${type}s selected`;
  }
  return `${count} elements selected`;
}

export default function ElementProperties({
  model,
  selections,
  member,
  surface,
  node,
  open,
  onClose,
  onModelChange,
}: Props) {
  if (!open) return null;

  const legacySelection: ConcreteSelection[] = member
    ? [{ type: "member", id: member.id }]
    : surface
      ? [{ type: "surface", id: surface.id }]
      : node
        ? [{ type: "node", id: node.id }]
        : [];

  const activeSelections = uniqueSelections(
    selections?.length ? selections : legacySelection,
  );

  if (!activeSelections.length) return null;

  const selectedMembers = activeSelections
    .filter((item) => item.type === "member")
    .map((item) => model.members.find((memberItem) => memberItem.id === item.id))
    .filter((item): item is Member => Boolean(item));
  const selectedSurfaces = activeSelections
    .filter((item) => item.type === "surface")
    .map((item) => model.surfaces.find((surfaceItem) => surfaceItem.id === item.id))
    .filter((item): item is Surface => Boolean(item));
  const selectedNodes = activeSelections
    .filter((item) => item.type === "node")
    .map((item) => model.nodes.find((nodeItem) => nodeItem.id === item.id))
    .filter((item): item is Node => Boolean(item));

  const ids = new Set(activeSelections.map((item) => item.id));
  const loads = model.loads.filter((load) =>
    loadTargets(load).some((target) => ids.has(target)),
  );
  const types = new Set(activeSelections.map((item) => item.type));
  const single = activeSelections.length === 1 ? activeSelections[0] : undefined;
  const singleMember = single?.type === "member" ? selectedMembers[0] : undefined;
  const singleSurface = single?.type === "surface" ? selectedSurfaces[0] : undefined;
  const singleNode = single?.type === "node" ? selectedNodes[0] : undefined;
  const singleLength = singleMember
    ? memberLength(model, singleMember)
    : singleSurface?.type === "wall"
      ? wallLength(model, singleSurface)
      : undefined;

  const assignmentTargets = [...selectedMembers, ...selectedSurfaces];
  const canEditAssignments =
    Boolean(onModelChange) &&
    assignmentTargets.length === activeSelections.length &&
    assignmentTargets.length > 0;

  const sectionState = commonValue(selectedMembers.map((item) => item.sectionId));
  const materialState = commonValue(
    assignmentTargets.map((item) => item.materialId),
  );
  const levelState = commonValue(assignmentTargets.map((item) => item.levelId));

  const updateMemberField = (
    field: "sectionId" | "materialId" | "levelId",
    value: string,
  ) => {
    if (!onModelChange || !selectedMembers.length) return;
    const targets = new Set(selectedMembers.map((item) => item.id));
    const next = {
      ...model,
      members: model.members.map((item) =>
        targets.has(item.id)
          ? { ...item, [field]: value || undefined }
          : item,
      ),
    };
    onModelChange(
      next,
      `Updated ${field} for ${selectedMembers.length} selected member${selectedMembers.length === 1 ? "" : "s"}.`,
    );
  };

  const updateAssignmentField = (
    field: "materialId" | "levelId",
    value: string,
  ) => {
    if (!onModelChange || !assignmentTargets.length) return;
    const memberIds = new Set(selectedMembers.map((item) => item.id));
    const surfaceIds = new Set(selectedSurfaces.map((item) => item.id));
    const next = {
      ...model,
      members: model.members.map((item) =>
        memberIds.has(item.id)
          ? { ...item, [field]: value || undefined }
          : item,
      ),
      surfaces: model.surfaces.map((item) =>
        surfaceIds.has(item.id)
          ? { ...item, [field]: value || undefined }
          : item,
      ),
    };
    onModelChange(
      next,
      `Updated ${field} for ${assignmentTargets.length} selected element${assignmentTargets.length === 1 ? "" : "s"}.`,
    );
  };

  const mixedOption = (mixed: boolean) =>
    mixed ? <option value="">— Multiple values —</option> : null;

  return (
    <aside
      className="propertiesSidePanel"
      aria-label="Element properties"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="propertiesHeader">
        <div>
          <strong>Properties</strong>
          <span>{selectionLabel(activeSelections.length, types)}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close properties">
          ×
        </button>
      </header>

      <div className="propertiesBody">
        {activeSelections.length > 1 ? (
          <div className="propertiesSelectionSummary" role="status">
            <strong>{activeSelections.length}</strong>
            <span>Selected</span>
            <small>
              {selectedMembers.length} members · {selectedSurfaces.length} surfaces ·{" "}
              {selectedNodes.length} nodes
            </small>
          </div>
        ) : null}

        {canEditAssignments ? (
          <section style={card}>
            <div className="propertiesSectionHeading">
              <strong>Common assignments</strong>
              <span>Applies to selection</span>
            </div>

            {selectedMembers.length === activeSelections.length ? (
              <label className="propertiesField">
                <span>Section</span>
                <select
                  value={sectionState.value ?? ""}
                  onChange={(event) =>
                    updateMemberField("sectionId", event.target.value)
                  }
                >
                  {mixedOption(sectionState.mixed)}
                  {!sectionState.mixed ? <option value="">Not assigned</option> : null}
                  {model.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.designation || section.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="propertiesField">
              <span>Material</span>
              <select
                value={materialState.value ?? ""}
                onChange={(event) =>
                  updateAssignmentField("materialId", event.target.value)
                }
              >
                {mixedOption(materialState.mixed)}
                {!materialState.mixed ? <option value="">Not assigned</option> : null}
                {model.materials.map((materialItem) => (
                  <option key={materialItem.id} value={materialItem.id}>
                    {materialItem.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="propertiesField">
              <span>Level</span>
              <select
                value={levelState.value ?? ""}
                onChange={(event) =>
                  updateAssignmentField("levelId", event.target.value)
                }
              >
                {mixedOption(levelState.mixed)}
                {!levelState.mixed ? <option value="">Not assigned</option> : null}
                {model.levels.map((levelItem) => (
                  <option key={levelItem.id} value={levelItem.id}>
                    {levelItem.name}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}

        {single ? (
          <section style={card}>
            <div style={row}>
              <span style={label}>Element ID</span>
              <b>{single.id}</b>
            </div>
            <div style={row}>
              <span style={label}>Type</span>
              <span>{single.type}</span>
            </div>

            {singleMember ? (
              <>
                <div style={row}>
                  <span style={label}>Member type</span>
                  <span>{singleMember.type}</span>
                </div>
                <div style={row}>
                  <span style={label}>Start node</span>
                  <span>{singleMember.startNodeId}</span>
                </div>
                <div style={row}>
                  <span style={label}>End node</span>
                  <span>{singleMember.endNodeId}</span>
                </div>
              </>
            ) : null}

            {singleSurface ? (
              <div style={row}>
                <span style={label}>Boundary nodes</span>
                <span>{singleSurface.boundaryNodeIds.join(", ")}</span>
              </div>
            ) : null}

            {singleNode ? (
              <div style={row}>
                <span style={label}>Coordinates</span>
                <span>
                  {singleNode.position.x.toFixed(3)}, {singleNode.position.y.toFixed(3)},{" "}
                  {singleNode.position.z.toFixed(3)} m
                </span>
              </div>
            ) : null}

            {(singleMember || singleSurface) ? (
              <div style={row}>
                <span style={label}>Level</span>
                <span>{singleMember?.levelId || singleSurface?.levelId || "—"}</span>
              </div>
            ) : null}

            {singleLength !== undefined ? (
              <div style={row}>
                <span style={label}>Length</span>
                <b>{singleLength.toFixed(3)} m</b>
              </div>
            ) : null}
          </section>
        ) : null}

        <section style={card}>
          <strong style={{ fontSize: 11 }}>Assigned loads</strong>
          {loads.length ? (
            loads.map((load) => (
              <div key={load.id} style={{ fontSize: 10 }}>
                <b>{load.loadCaseId}</b> · {loadSummary(load)} · {load.type}
              </div>
            ))
          ) : (
            <span style={{ fontSize: 10, color: "#98a2b3" }}>
              No loads assigned to this selection.
            </span>
          )}
        </section>

        <section style={card}>
          <div className="propertiesSectionHeading">
            <strong>Selection references</strong>
            <span>Canonical Core IDs</span>
          </div>
          <div className="propertiesSelectionList">
            {activeSelections.map((item) => (
              <span key={keyOf(item)}>
                <b>{item.type}</b>
                {item.id}
              </span>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
