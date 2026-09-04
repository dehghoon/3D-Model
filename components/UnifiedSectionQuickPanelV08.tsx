"use client";

import { useEffect, useState } from "react";
import type { Member, StructuralModel } from "@linkoteq/structural-core";
import CiscSectionSelectorV05 from "./CiscSectionSelectorV05";
import {
  getDefaultSectionId,
  setModelingDefaults,
} from "../lib/modeling-default-preferences-v05";

type Props = {
  model: StructuralModel;
  members: Member[];
  onModelChange: (model: StructuralModel, status: string) => void;
};

type SectionKind = "steel" | "concrete" | "wood";

const OPEN_EVENT = "linkoteq:section-panel-open";
const box = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  marginBottom: 8,
} as const;

function isConcreteFamily(family: string): boolean {
  const value = family.trim().toUpperCase();
  return value === "RC-RECT" || value.startsWith("RC");
}

function isWoodFamily(family: string): boolean {
  return family.trim().toUpperCase().startsWith("WOOD");
}

export default function UnifiedSectionQuickPanelV08({
  model,
  members,
  onModelChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SectionKind>("steel");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [lengthUnit, setLengthUnit] = useState("mm");
  const [cover, setCover] = useState("");
  const [topCount, setTopCount] = useState("");
  const [topDiameter, setTopDiameter] = useState("");
  const [bottomCount, setBottomCount] = useState("");
  const [bottomDiameter, setBottomDiameter] = useState("");
  const [perimeterCount, setPerimeterCount] = useState("");
  const [perimeterDiameter, setPerimeterDiameter] = useState("");

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_EVENT, handleOpen);
  }, []);

  const visibleSections = model.sections.filter((section) =>
    kind === "concrete"
      ? isConcreteFamily(section.family)
      : kind === "wood"
        ? isWoodFamily(section.family)
        : !isConcreteFamily(section.family) && !isWoodFamily(section.family),
  );

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
      `Assigned section to ${members.length} selected member(s).`,
    );
  };

  if (!open) return null;

  const tabStyle = (active: boolean) => ({
    flex: 1,
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: active ? "#0f172a" : "#ffffff",
    color: active ? "#ffffff" : "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  });

  const inputStyle = { width: "100%", boxSizing: "border-box" as const };

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
          width: "min(620px,96vw)",
          height: "100%",
          overflowY: "auto",
          background: "#fff",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <small>Core 0.5 · Unified Section Library</small>
            <h2>Section Library</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>

        <div aria-label="Section material type" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" style={tabStyle(kind === "steel")} onClick={() => setKind("steel")}>Steel</button>
          <button type="button" style={tabStyle(kind === "concrete")} onClick={() => setKind("concrete")}>Concrete</button>
          <button type="button" style={tabStyle(kind === "wood")} onClick={() => setKind("wood")}>Wood</button>
        </div>

        {kind === "steel" ? (
          <CiscSectionSelectorV05 model={model} onModelChange={onModelChange} />
        ) : (
          <>
            <div style={box}>
              <h3>{kind === "concrete" ? "Concrete Rectangular + Rebar" : "Wood Rectangular"}</h3>
              <p style={{ marginTop: 0, fontSize: 12, color: "#475569" }}>
                Family: {kind === "concrete" ? "RC-RECT" : "WOOD-RECT"}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label>Width<input style={inputStyle} type="number" step="any" value={width} onChange={(event) => setWidth(event.target.value)} /></label>
                <label>Depth<input style={inputStyle} type="number" step="any" value={depth} onChange={(event) => setDepth(event.target.value)} /></label>
                <label>Length unit
                  <select style={inputStyle} value={lengthUnit} onChange={(event) => setLengthUnit(event.target.value)}>
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="in">in</option>
                    <option value="ft">ft</option>
                  </select>
                </label>
              </div>
            </div>

            {kind === "concrete" ? (
              <fieldset style={{ ...box, marginTop: 10 }}>
                <legend>Rebar Layout</legend>
                <label>Cover<input style={inputStyle} type="number" step="any" value={cover} onChange={(event) => setCover(event.target.value)} /></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label>Top count<input style={inputStyle} type="number" min="0" step="1" value={topCount} onChange={(event) => setTopCount(event.target.value)} /></label>
                  <label>Top diameter<input style={inputStyle} type="number" min="0" step="any" value={topDiameter} onChange={(event) => setTopDiameter(event.target.value)} /></label>
                  <label>Bottom count<input style={inputStyle} type="number" min="0" step="1" value={bottomCount} onChange={(event) => setBottomCount(event.target.value)} /></label>
                  <label>Bottom diameter<input style={inputStyle} type="number" min="0" step="any" value={bottomDiameter} onChange={(event) => setBottomDiameter(event.target.value)} /></label>
                  <label>Column/perimeter count<input style={inputStyle} type="number" min="0" step="1" value={perimeterCount} onChange={(event) => setPerimeterCount(event.target.value)} /></label>
                  <label>Column/perimeter diameter<input style={inputStyle} type="number" min="0" step="any" value={perimeterDiameter} onChange={(event) => setPerimeterDiameter(event.target.value)} /></label>
                </div>
              </fieldset>
            ) : null}

            <div role="status" style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#fff7ed", border: "1px solid #fdba74", fontSize: 12 }}>
              Geometry input is ready. Canonical A, Iy, Iz, J, Zy and Zz are intentionally not derived in the viewer. Saving a new {kind} section requires the approved Agent #2 section-property engine.
            </div>

            <button
              type="button"
              disabled
              title="Requires approved Agent #2 section-property engine"
              style={{ marginTop: 10 }}
            >
              Add {kind === "concrete" ? "Concrete" : "Wood"} Section
            </button>

            <div style={box}>
              <h3>Existing {kind === "concrete" ? "Concrete" : "Wood"} Sections</h3>
              {visibleSections.length ? (
                visibleSections.map((section) => (
                  <article key={section.id} style={{ ...box, background: "#f8fafc" }}>
                    <strong>{section.designation ?? section.id}</strong>
                    <small style={{ display: "block" }}>{section.family}</small>
                    <button type="button" disabled={!members.length} onClick={() => assign(section.id)}>Assign</button>
                  </article>
                ))
              ) : (
                <p>No canonical {kind} sections are available in this model yet.</p>
              )}
            </div>
          </>
        )}

        <div style={box}>
          <h3>Modeling Default</h3>
          <select
            aria-label="Default Section"
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
        </div>
      </section>
    </div>
  );
}
