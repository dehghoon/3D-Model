"use client";

import { useEffect, useState } from "react";
import type { Member, Section, StructuralModel, UnitValue } from "@linkoteq/structural-core";
import CiscSectionSelectorV05 from "./CiscSectionSelectorV05";
import { getDefaultSectionId, setModelingDefaults } from "../lib/modeling-default-preferences-v05";

type Props = {
  model: StructuralModel;
  members: Member[];
  onModelChange: (model: StructuralModel, status: string) => void;
};

type Draft = {
  id: string;
  family: string;
  designation: string;
  A: string;
  Au: string;
  Iy: string;
  Iyu: string;
  Iz: string;
  Izu: string;
  J: string;
 Ju: string;
};

const OPEN_EVENT = "linkoteq:section-panel-open";

const AISC_REFERENCE_FAMILIES = [
  "W / I Shapes",
  "HSS / RHS / SHS",
  "PIPE / CHS",
  "Channels",
  "Angles",
] as const;

function freshDraft(): Draft {
  return {
    id: `SEC-CUSTOM-${Date.now().toString(36).toUpperCase()}`,
    family: "custom",
    designation: "Custom Section",
    A: "",
    Au: "mm2",
    Iy: "",
    Iyu: "mm4",
    Iz: "",
    Izu: "mm4",
    J: "",
    Ju: "mm4",
  };
}

function fromSection(section: Section): Draft {
  return {
    id: section.id,
    family: section.family,
    designation: section.designation ?? section.id,
    A: String(section.analysis.A.value),
    Au: section.analysis.A.unit,
    Iy: String(section.analysis.Iy.value),
    Iyu: section.analysis.Iy.unit,
    Iz: String(section.analysis.Iz.value),
    Izu: section.analysis.Iz.unit,
    J: String(section.analysis.J.value),
    Ju: section.analysis.J.unit,
  };
}

function finite(value: string, label: string): number {
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number)) throw new Error(`${label}_MUST_BE_FINITE`);
  return number;
}

function unitValue(value: string, unit: string, label: string): UnitValue {
  if (!unit.trim()) throw new Error(`${label}_UNIT_REQUIRED@);
  return { value: finite(value, label), unit: unit.trim() };
}

function toSection(draft: Draft, previous?: Section): Section {
  if (!draft.id.trim() || !draft.family.trim() || !draft.designation.trim()) {
    throw new Error("SECTION_ID_FAMILY_DESIGNATION_REQUIRED");
  }
  return {
    ...(previous ?? {}),
    id: draft.id.trim(),
    family: draft.family.trim(),
    designation: draft.designation.trim(),
    analysis: {
      ...(previous?.analysis ?? {}),
      A: unitValue(draft.A, draft.Au, "SECTION_A"),
      Iy: unitValue(draft.Iy, draft.Iyu, "SECTION_IY"),
      Iz: unitValue(draft.Iz, draft.Izu, "SECTION_IZ"),
      J: unitValue(draft.J, draft.Ju, "SECTION_J"),
    },
    ...(previous?.geometry ? { geometry: previous.geometry } : {}),
    ...(previous?.design ? { design: previous.design } : {}),
    ...(previous?.libraryRef ? { libraryRef: previous.libraryRef } : {}),
    metadata: {
      ...(previous?.metadata ?? {}),
      source: previous?.libraryRef ? "approved-library" : "custom",
    },
  };
}

function copyId(model: StructuralModel, id: string): string {
  let next = `${id}-COPY`;
  let index = 2;
  while (model.sections.some((section) => section.id === next)) next = `${id}-COPY-${index++}`;
  return next;
}

const box = { border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, marginBottom: 8 } as const;

export default function SectionQuickPanelV05({ model, members, onModelChange }: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, openPanel);
    return () => window.removeEventListener(OPEN_EVENT, openPanel);
  }, []);

  if (!open) return null;

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const save = () => {
    if (!draft) return;
    try {
      const previous = editingId ? model.sections.find((section) => section.id === editingId) : undefined;
      const section = toSection(draft, previous);
      if (!editingId && model.sections.some((item) => item.id === section.id)) throw new Error("SECTION_ID_ALREADY_EXISTS");
      const sections = editingId
        ? model.sections.map((item) => (item.id === editingId ? section : item))
        : [...model.sections, section];
      onModelChange({ ...model, sections }, `Section ${section.designation ?? section.id} ${editingId ? "updated" : "added"}.`);
      setDraft(null);
      setEditingId(null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SECTION_UPDATE_FAILED");
    }
  };

  const assignSection = (sectionId: string) => {
    if (!members.length) return;
    const ids = new Set(members.map((member) => member.id));
    onModelChange(
      {
        ...model,
        members: model.members.map((member) => (ids.has(member.id) ? { ...member, sectionId } : member)),
      },
      `Assigned section to ${members.length} selected member(s).`,
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Section library" style={{ position: "fixed", inset: 0, zIndex: 2010, background: "rgba(15,23,42,.24)", display: "flex", justifyContent: "flex-end" }}>
      <section style={{ width: "min(600px,96vw)", height: "100%", overflowY: "auto", background: "#fff", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><small>CORE 0.5 → PyNite A, Iy, Iz, J → That Open geometry</small><h2 style={{ margin: "4px 0" }}>Section Library</h2></div>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>

        <div style={box}>
          <h3>Modeling Default</h3>
          <label>Default Section
            <select value={getDefaultSectionId(model)} onChange={(event) => onModelChange(setModelingDefaults(model, { sectionId: event.target.value }), "Default section updated.")}>
              <option value="">No default</option>
              {model.sections.map((section) => <option key={section.id} value={section.id}>{section.designation ?? section.id}</option>)}
            </select>
          </label>
        </div>

        <CiscSectionSelectorV05 model={model} onModelChange={onModelChange} />

        <details style={box}>
          <summary>AISC Reference Families</summary>
          <p>Reference only. No AISC engineering properties are injected without an approved dataset.</p>
          <ul>{AISC_REFERENCE_FAMILIES.map((family) => <li key={family}>{family}</li>)}</ul>
        </details>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Canonical Sections</h3>
          <button type="button" onClick={() => { setEditingId(null); setDraft(freshDraft()); setMessage(""); }}>New Custom</button>
        </div>

        {model.sections.map((section) => (
          <article key={section.id} style={box}>
            <strong>{section.designation ?? section.id}</strong>
            <small style={{ display: "block" }}>{section.family} · {section.libraryRef?.library ?? "Custom"} {section.libraryRef?.version ?? ""}</small>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              A {section.analysis.A.value} {section.analysis.A.unit} · Iy {section.analysis.Iy.value} {section.analysis.Iy.unit}<br />
              Iz {section.analysis.Iz.value} {section.analysis.Iz.unit} · J {section.analysis.J.value} {section.analysis.J.unit}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button type="button" onClick={() => { setEditingId(section.id); setDraft(fromSection(section)); setMessage(""); }}>Edit</button>
              <button type="button" onClick={() => { const next = fromSection(section); next.id = copyId(model, section.id); next.designation = `${next.designation} Copy`; setEditingId(null); setDraft(next); setMessage(""); }}>Copy</button>
              <button type="button" disabled={!members.length} onClick={() => assignSection(section.id)}>Assign</button>
            </div>
          </article>
        ))}

        {draft ? (
          <div style={{ ...box, background: "#eff6ff" }}>
            <h3>{editingId ? "Edit" : "Create"} Section</h3>
            <label>ID<input value={draft.id} readOnly={Boolean(editingId)} onChange={(event) => change("id", event.target.value)} /></label>
            <label>Family<input value={draft.family} onChange={(event) => change("family", event.target.value)} /></label>
            <label>Designation<input value={draft.designation} onChange={(event) => change("designation", event.target.value)} /></label>
            {([["A","Au"],["Iy","Iyu"],["Iz","Izu"],["J","Ju"]] as const).map(([valueKey, unitKey]) => (
              <div key={valueKey}>
                <label>{valueKey}<input type="number" step="any" value={draft[valueKey]} onChange={(event) => change(valueKey, event.target.value)} /></label>
                <label>Unit<input value={draft[unitKey]} onChange={(event) => change(unitKey, event.target.value)} /></label>
              </div>
            ))}
            {editingId && model.sections.find((section) => section.id === editingId)?.libraryRef ? (
              <p><small>Editing an approved-library section creates a model-level override while preserving its library reference and geometry.</small></p>
            ) : null}
            {message ? <p>{message}</p> : null}
            <button type="button" onClick={save}>Save Section</button>
            <button type="button" onClick={() => { setDraft(null); setEditingId(null); setMessage(""); }}>Cancel</button>
          </div>
        ) : null}

        <p>{members.length ? p${members.length} member(s) selected for section assignment.` : "Select one or more members to assign a section."}</p>
      </section>
    </div>
  );
}
