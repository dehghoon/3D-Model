"use client";

import type { Material, Member, StructuralModel } from "@linkoteq/structural-core";

type Props = {
  model: StructuralModel;
  members: Member[];
  surfaces: StructuralModel["surfaces"];
  onModelChange?: (model: StructuralModel, status: string) => void;
};

function common<T>(values: T[]) {
  if (!values.length) return { value: undefined as T | undefined, mixed: false };
  const same = values.every((value) => value === values[0]);
  return { value: same ? values[0] : undefined, mixed: !same };
}

function MaterialInfo({ material }: { material?: Material }) {
  if (!material) return <small>No common material assigned.</small>;
  const p = material.analysis;
  return (
    <div className="propertyCoreSummary">
      <b>{material.name} · {material.type}</b>
      <small>E: {p.E.value} {p.E.unit} · G: {p.G.value} {p.G.unit} · ν: {p.nu}</small>
      <small>ρ: {p.rho.value} {p.rho.unit}{p.fy ? ` · Fy: ${p.fy.value} ${p.fy.unit}` : ""}</small>
    </div>
  );
}

export default function AssignmentPropertiesV05({ model, members, surfaces, onModelChange }: Props) {
  const targets = [...members, ...surfaces];
  if (!targets.length) return null;

  const materialState = common(targets.map((item) => item.materialId));
  const sectionState = common(...members.map((item) => item.sectionId)]);
  const levelState = common(targets.map((item) => item.levelId));
  const material = materialState.value
    ? model.materials.find((item) => item.id === materialState.value)
    : undefined;

  const setMaterial = (value: string) => {
    if (!onModelChange || (members.length && !value)) return;
    const memberIds = new Set(members.map((item) => item.id));
    const surfaceIds = new Set(surfaces.map((item) => item.id));
    onModelChange({
      ...model,
      members: model.members.map((item) =>
        memberIds.has(item.id) ? { ...item, materialId: value } : item),
      surfaces: model.surfaces.map((item) =>
        surfaceIds.has(item.id) ? { ...item, materialId: value || undefined } : item),
    }, "Updated canonical Core v0.5 material assignment.");
  };

  const setSection = (value: string) => {
    if (!onModelChange || !value) return;
    const ids = new Set(members.map((item) => item.id));
    onModelChange({
      ...model,
      members: model.members.map((item) =>
        ids.has(item.id) ? { ...item, sectionId: value } : item),
    }, "Updated canonical Core v0.5 section assignment.");
  };

  const setLevel = (value: string) => {
    if (!onModelChange) return;
    const memberIds = new Set(members.map((item) => item.id));
    const surfaceIds = new Set(surfaces.map((item) => item.id));
    onModelChange({
      ...model,
      members: model.members.map((item) =>
        memberIds.has(item.id) ? { ...item, levelId: value || undefined } : item),
      surfaces: model.surfaces.map((item) =>
        surfaceIds.has(item.id) ? { ...item, levelId: value || undefined } : item),
    }, "Updated canonical Core v0.5 level assignment.");
  };

  return (
    <section className="propertyActionCard">
      <div className="propertiesSectionHeading"><strong>Assignments</strong><span>Core v0.5</span></div>
      {members.length === targets.length ? (
        <label className="propertiesField">
          <span>Section</span>
          <select value={sectionState.value ?? ""} onChange={(event) => setSection(event.target.value)}>
            {sectionState.mixed ? <option value="">— Multiple values —</option> : null}
            {model.sections.map((item) => (
              <option key={item.id} value={item.id}>{item.designation || item.id}</option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="propertiesField">
        <span>Material</span>
        <select value={materialState.value ?? ""} onChange={(event) => setMaterial(event.target.value)}>
          {materialState.mixed ? <option value="">— Multiple values —</option> : null}
          {!members.length ? <option value="">Not assigned</option> : null}
          {model.materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>

      <label className="propertiesField">
        <span>Level</span>
        <select value={levelState.value ?? ""} onChange={(event) => setLevel(event.target.value)}>
          {levelState.mixed ? <option value="">— Multiple values —</option> : null}
          <option value="">Not assigned</option>
          {model.levels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>

      <MaterialInfo material={material} />
    </section>
  );
}
