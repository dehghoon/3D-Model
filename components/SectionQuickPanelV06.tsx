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
  AUnit: string;
  Iy: string;
  IyUnit: string;
  Iz: string;
  IzUnit: string;
  J: string;
  JUnit: string;
};

const OPEN_EVENT = "linkoteq:section-panel-open";
const panelBox = { border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, marginBottom: 8 } as const;

function valueOf(value: string, unit: string, label: string): UnitValue {
  const numeric = Number(value);
  if (!value.trim() || !Number.isFinite(numeric)) throw new Error(label + "_MUST_BE_FINITE");
  if (!unit.trim()) throw new Error(label + "_UNIT_REQUIRED");
  return { value: numeric, unit: unit.trim() };
}

function toDraft(section: Section): Draft {
  return {
    id: section.id,
    family: section.family,
    designation: section.designation ?? section.id,
    A: String(section.analysis.A.value),
    AUnit: section.analysis.A.unit,
    Iy: String(section.analysis.Iy.value),
    IyUnit: section.analysis.Iy.unit,
    Iz: String(section.analysis.Iz.value),
    IzUnit: section.analysis.Iz.unit,
    J: String(section.analysis.J.value),
    JUnit: section.analysis.J.unit,
  };
}

function newDraft(): Draft {
  return {
    id: "SEC-CUSTOM-" + Date.now().toString(36).toUpperCase(),
    family: "custom",
    designation: "Custom Section",
    A: "",
    AUnit: "mm2",
    Iy: "",
    IyUnit: "mm4",
    Iz: "",
    IzUnit: "mm4",
    J: "",
    JUnit: "mm4",
  };
}

function copyId(model: StructuralModel, baseId: string): string {
  let candidate = baseId + "-COPY";
  let index = 2;
  while (model.sections.some((section) => section.id === candidate)) {
    candidate = baseId + "-COPY-" + index;
    index += 1;
  }
  return candidate;
}

function buildSection(draft: Draft, previous?: Section): Section {
  if (!draft.id.trim() || !draft.family.trim() || !draft.designation.trim()) {
    throw new Error,"SECTION_ID_FAMILY_DESIGNATION_REQUIRED");
  }
  return {
    ...(previous ?? {}),
    id: draft.id.trim(),
    family: draft.family.trim(),
    designation: draft.designation.trim(),
    analysis: {
      ...(previous?.analysis ?? {}),
      A: valueOf(draft.A, draft.AUnit, "SECTION_A"),
      Iy: valueOf(draft.Iy, draft.IyUnit, "SECTION_IY"),
      Iz: valueOf(draft.Iz, draft.IzUnit, "SECTION_IZ"),
      J: valueOf(draft.J, draft.JUnit, "SECTION_J"),
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

export default function SectionQuickPanelV06({ model, members, onModelChange }: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  if (!open) return null;

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
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
      const nextSection = buildSection(draft, previous);
      if (!editingId && model.sections.some((section) => section.id === nextSection.id)) {
        throw new Error("SECTION_ID_ALREADY_EXISTS");
      }
      const sections = editingId
        ? model.sections.map((section) => (section.id === editingId ? nextSection : section))
        : [...model.sections, nextSection];
      onModelChange(
        { ...model, sections },
        "Section " + (nextSection.designation ?? nextSection.id) + (editingId ? " updated." : " added."),
      );
      setDraft(null);
      setEditingId(null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SECTION_UPDATE_FAILED");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Section library"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2010,
        background: "rgba(15,23,42,.24)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <section
        style={{
          width: "min(600px,96vw)",
          height: "100%",
          overflowY: "auto",
          background: "#fff",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <small>CORE 0.5 → PyNite A, Iy, Iz, J → That Open geometry</small>
            <h2>Section Library</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>

        <div style={panelBox}>
          <h3>Modeling Default</h3>
          <label>
            Default Section
            <select
              value={getDefaultSectionId(model)}
              onChange={(event) =>
                onModelChange(
                  setModelingDefaults(model, { sectionId: event.target.value }),
                  "Default section updated.",
                )
              }
            >
              <option value="">No default</option>
              {model.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.designation ?? section.id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <CiscSectionSelectorV05 model={model} onModelChange={onModelChange} />

        <details style={panelBox}>
          <summary>AISC Reference Families</summary>
          <p>Reference only. No AISC engineering properties are injected without an approved dataset.</p>
          <ul>
            <li>W / I Shapes</li>
            <li>HSS / RHS / SHS</li>
            <li>PIPE / CHS</li>
            <li>Channels</li>
            <li>Angles</li>
          </ul>
        </details>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Canonical Sections</h3>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setDraft(newDraft());
              setMessage("");
            }}
          >
            New Custom
          </button>
        </div>

        {model.sections.map((section) => (
          <article key={section.id} style={panelBox}>
            <strong>{section.designation ?? section.id}</strong>
            <small style={{ display: "block" }}>
              {section.family} · {section.libraryRef?.library ?? "Custom"}
            </small>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              A {section.analysis.A.value} {section.analysis.A.unit} · Iy {section.analysis.Iy.value} {section.analysis.Iy.unit}
              <br />
              Iz {section.analysis.Iz.value} {section.analysis.Iz.unit} · J {section.analysis.J.value} {section.analysis.J.unit}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setEditingId(section.id);
                  setDraft(toDraft(section));
                  setMessage("");
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = toDraft(section);
                  next.id = copyId(model, section.id);
                  next.designation = next.designation + " Copy";
                  setEditingId(null);
                  setDraft(next);
                  setMessage("");
                }}
              >
                Copy
              </button>
              <button type="button" disabled={!members.length} onClick={() => assign(section.id)}>
                Assign
              </button>
            </div>
          </article>
        ))}

        {draft ? (
          <div style={{ ...panelBox, background: "#eff6ff" }}>
            <h3>{editingId ? "Edit Section" : "Create Section"}</h3>
            <label>
              ID
              <input
                value={draft.id}
                readOnly={Boolean(editingId)}
                onChange={(event) => updateDraft("id", event.target.value)}
              />
            </label>
            <label>
              Family
              <input value={draft.family} onChange={(event) => updateDraft("family", event.target.value)} />
            </label>
            <label>
              Designation
              <input
                value={draft.designation}
                onChange={(event) => updateDraft("designation", event.target.value)}
              />
            </label>

            {([
              ["A", "AUnit"],
              ["Iy", "IyUnit"],
              ["Iz", "IzUnit"],
              ["J", "JUnit"],
            ] as const).map(([valueKey, unitKey]) => (
              <div key={valueKey}>
                <label>
                  {valueKey}
                  <input
                    type="number"
                    step="any"
                    value={draft[valueKey]}
                    onChange={(event) => updateDraft(valueKey, event.target.value)}
                  />
                </label>
                <label>
                  Unit
                  <input
                    value={draft[unitKey]}
                    onChange={(event) => updateDraft(unitKey, event.target.value)}
                  />
                </label>
              </div>
            ))}

            {message ? <p>{message}</p> : null}
            <button type="button" onClick={save}>Save Section</button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setEditingId(null);
                setMessage("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}

        <p>
          {members.length
            ? String(members.length) + " member(s) selected for section assignment."
            : "Select one or more members to assign a section."}
        </p>
      </section>
    </div>
  );
}
