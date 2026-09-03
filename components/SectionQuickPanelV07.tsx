"use client";

import { useEffect, useState } from "react";
import type { Member, Section, StructuralModel } from "@linkoteq/structural-core";
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
  Iy: string;
  Iz: string;
  J: string;
  areaUnit: string;
  inertiaUnit: string;
};

const OPEN_EVENT = "linkoteq:section-panel-open";
const box = { border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, marginBottom: 8 } as const;

function draftFrom(section: Section): Draft {
  return {
    id: section.id,
    family: section.family,
    designation: section.designation ?? section.id,
    A: String(section.analysis.A.value),
    Iy: String(section.analysis.Iy.value),
    Iz: String(section.analysis.Iz.value),
    J: String(section.analysis.J.value),
    areaUnit: section.analysis.A.unit,
    inertiaUnit: section.analysis.Iy.unit,
  };
}

function numberValue(value: string, label: string): number {
  const numeric = Number(value);
  if (!value.trim() || !Number.isFinite(numeric)) {
    throw new Error(label + "_MUST_BE_FINITE");
  }
  return numeric;
}

function sectionFrom(draft: Draft, previous?: Section): Section {
  if (!draft.id.trim() || !draft.family.trim() || !draft.designation.trim()) {
    throw new Error("SECTION_ID_FAMILY_DESIGNATION_REQUIRED");
  }
  if (!draft.areaUnit.trim() || !draft.inertiaUnit.trim()) {
    throw new Error("SECTION_UNITS_REQUIRED");
  }
  return {
    ...(previous ?? {}),
    id: draft.id.trim(),
    family: draft.family.trim(),
    designation: draft.designation.trim(),
    analysis: {
      ...(previous?.analysis ?? {}),
      A: { value: numberValue(draft.A, "SECTION_A"), unit: draft.areaUnit.trim() },
      Iy: { value: numberValue(draft.Iy, "SECTION_IY"), unit: draft.inertiaUnit.trim() },
      Iz: { value: numberValue(draft.Iz, "SECTION_IZ"), unit: draft.inertiaUnit.trim() },
      J: { value: numberValue(draft.J, "SECTION_J"), unit: draft.inertiaUnit.trim() },
    },
    ...(previous?.geometry ? { geometry: previous.geometry } : {}),
    ...(previous?.design ? { design: previous.design } : {}),
    ...(previous?.libraryRef ? { libraryRef: previous.libraryRef } : {}),
    metadata: { ...(previous?.metadata ?? {}), source: previous?.libraryRef ? "approved-library" : "custom" },
  };
}

function newDraft(): Draft {
  return {
    id: "SEC-CUSTOM-" + Date.now().toString(36).toUpperCase(),
    family: "custom",
    designation: "Custom Section",
    A: "",
    Iy: "",
    Iz: "",
    J: "",
    areaUnit: "mm2",
    inertiaUnit: "mm4",
  };
}

function copiedId(model: StructuralModel, id: string): string {
  let next = id + "-COPY";
  let n = 2;
  while (model.sections.some((section) => section.id === next)) {
    next = id + "-COPY-" + n;
    n += 1;
  }
  return next;
}

export default function SectionQuickPanelV07({ model, members, onModelChange }: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  if (!open) return null;

  const setField = (key: keyof Draft, value: string) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const assign = (sectionId: string) => {
    if (!members.length) return;
    const ids = new Set(members.map((member) => member.id));
    onModelChange(
      {
        ...model,
        members: model.members.map((member) =>
          ids.has(member.id) ? { ...member, sectionId } : member,
        ),
      },
      "Assigned section to " + members.length + " selected member(s).",
    );
  };

  const save = () => {
    if (!draft) return;
    try {
      const previous = editingId
        ? model.sections.find((section) => section.id === editingId)
        : undefined;
      const section = sectionFrom(draft, previous);
      if (!editingId && model.sections.some((item) => item.id === section.id)) {
        throw new Error("SECTION_ID_ALREADY_EXISTS");
      }
      const sections = editingId
        ? model.sections.map((item) => (item.id === editingId ? section : item))
        : [...model.sections, section];
      onModelChange({ ...model, sections }, "Section saved.");
      setDraft(null);
      setEditingId(null);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "SECTION_UPDATE_FAILED");
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Section library" style={{
      position: "fixed", inset: 0, zIndex: 2010, background: "rgba(15,23,42,.24)",
      display: "flex", justifyContent: "flex-end"
    }}>
      <section style={{ width: "min(600px,96vw)", height: "100%", overflowY: "auto", background: "#fff", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><small>Core 0.5 · PyNite A, Iy, Iz, J · That Open geometry</small><h2>Section Library</h2></div>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>

        <div style={box}>
          <h3>Modeling Default</h3>
          <select
            aria-label="Default Section"
            value={getDefaultSectionId(model)}
            onChange={(event) => onModelChange(
              setModelingDefaults(model, { sectionId: event.target.value }),
              "Default section updated."
            )}
          >
            <option value="">No default</option>
            {model.sections.map((section) => (
              <option key={section.id} value={section.id}>{section.designation ?? section.id}</option>
            ))}
          </select>
        </div>

        <CiscSectionSelectorV05 model={model} onModelChange={onModelChange} />

        <details style={box}>
          <summary>AISC Reference Families</summary>
          <p>Reference only. No AISC engineering properties are injected without an approved dataset.</p>
          <p>W / I Shapes · HSS / RHS / SHS · PIPE / CHS · Channels · Angles</p>
        </details>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Canonical Sections</h3>
          <button type="button" onClick={() => { setEditingId(null); setDraft(newDraft()); setError(""); }}>
            New Custom
          </button>
        </div>

        {model.sections.map((section) => (
          <article key={section.id} style={box}>
            <strong>{section.designation ?? section.id}</strong>
            <small style={{ display: "block" }}>{section.family} · {section.libraryRef?.library ?? "Custom"}</small>
            <div>
              A {section.analysis.A.value} {section.analysis.A.unit} · Iy {section.analysis.Iy.value} {section.analysis.Iy.unit}
              <br />
              Iz {section.analysis.Iz.value} {section.analysis.Iz.unit} · J {section.analysis.J.value} {section.analysis.J.unit}
            </div>
            <button type="button" onClick={() => { setEditingId(section.id); setDraft(draftFrom(section)); setError(""); }}>Edit</button>
            <button type="button" onClick={() => {
              const next = draftFrom(section);
              next.id = copiedId(model, section.id);
              next.designation = next.designation + " Copy";
              setEditingId(null);
              setDraft(next);
              setError("");
            }}>Copy</button>
            <button type="button" disabled={!members.length} onClick={() => assign(section.id)}>Assign</button>
          </article>
        ))}

        {draft ? (
          <div style={{ ...box, background: "#eff6ff" }}>
            <h3>{editingId ? "Edit Section" : "Create Section"}</h3>
            <label>ID<input value={draft.id} readOnly={Boolean(editingId)} onChange={(e) => setField("id", e.target.value)} /></label>
            <label>Family<input value={draft.family} onChange={(e) => setField("family", e.target.value)} /></label>
            <label>Designation<input value={draft.designation} onChange={(e) => setField("designation", e.target.value)} /></label>
            <label>A<input type="number" step="any" value={draft.A} onChange={(e) => setField("A", e.target.value)} /></label>
            <label>Area Unit<input value={draft.areaUnit} onChange={(e) => setField("areaUnit", e.target.value)} /></label>
            <label>Iy<input type="number" step="any" value={draft.Iy} onChange={(e) => setField("Iy", e.target.value)} /></label>
            <label>Iz<input type="number" step="any" value={draft.Iz} onChange={(e) => setField("Iz", e.target.value)} /></label>
            <label>J<input type="number" step="any" value={draft.J} onChange={(e) => setField("J", e.target.value)} /></label>
            <label>Inertia Unit<input value={draft.inertiaUnit} onChange={(e) => setField("inertiaUnit", e.target.value)} /></label>
            {error ? <p>{error}</p> : null}
            <button type="button" onClick={save}>Save Section</button>
            <button type="button" onClick={() => { setDraft(null); setEditingId(null); setError(""); }}>Cancel</button>
          </div>
        ) : null}

        <p>{members.length ? String(members.length) + " member(s) selected." : "Select members to assign a section."}</p>
      </section>
    </div>
  );
}
