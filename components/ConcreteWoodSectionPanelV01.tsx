"use client";

import { useEffect, useState } from "react";
import type { Section, StructuralModel } from "@linkoteq/structural-core";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

type Mode = "concrete" | "wood";

const OPEN_EVENT = "linkoteq:section-panel-open";

function positive(text: string, label: string): number {
  const value = Number(text);
  if (!text.trim() || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label}_MUST_BE_POSITIVE`);
  }
  return value;
}

function finite(text: string, label: string): number {
  const value = Number(text);
  if (!text.trim() || !Number.isFinite(value)) {
    throw new Error(`${label}_MUST_BE_FINITE`);
  }
  return value;
}

function optionalCount(text: string, label: string): number | undefined {
  if (!text.trim()) return undefined;
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label}_MUST_BE_NONNEGATIVE_INTEGER`);
  }
  return value;
}

function optionalPositive(text: string, label: string): number | undefined {
  if (!text.trim()) return undefined;
  return positive(text, label);
}

export default function ConcreteWoodSectionPanelV01({
  model,
  onModelChange,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<Mode>("concrete");
  const [designation, setDesignation] = useState("");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [lengthUnit, setLengthUnit] = useState("mm");
  const [A, setA] = useState("");
  const [Iy, setIy] = useState("");
  const [Iz, setIz] = useState("");
  const [J, setJ] = useState("");
  const [areaUnit, setAreaUnit] = useState("mm2");
  const [inertiaUnit, setInertiaUnit] = useState("mm4");
  const [reinforcementMaterialId, setReinforcementMaterialId] = useState("");
  const [cover, setCover] = useState("");
  const [topCount, setTopCount] = useState("");
  const [topDiameter, setTopDiameter] = useState("");
  const [bottomCount, setBottomCount] = useState("");
  const [bottomDiameter, setBottomDiameter] = useState("");
  const [perimeterCount, setPerimeterCount] = useState("");
  const [perimeterDiameter, setPerimeterDiameter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const open = () => setVisible(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  if (!visible) return null;

  const inputStyle = { width: "100%", boxSizing: "border-box" as const };
  const steelMaterials = model.materials.filter((material) => material.type === "steel");

  const reset = (next: Mode = mode) => {
    setMode(next);
    setDesignation(next === "concrete" ? "Rectangular RC Section" : "Rectangular Wood Section");
    setWidth("");
    setDepth("");
    setA("");
    setIy("");
    setIz("");
    setJ("");
    setReinforcementMaterialId("");
    setCover("");
    setTopCount("");
    setTopDiameter("");
    setBottomCount("");
    setBottomDiameter("");
    setPerimeterCount("");
    setPerimeterDiameter("");
    setError("");
  };

  const bars = (countText: string, diameterText: string, label: string) => {
    const count = optionalCount(countText, `${label}_COUNT`);
    const diameter = optionalPositive(diameterText, `${label}_DIAMETER`);
    if (count === undefined && diameter === undefined) return undefined;
    if (count === undefined || diameter === undefined) {
      throw new Error(`${label}_COUNT_AND_DIAMETER_REQUIRED_TOGETHER`);
    }
    return { count, diameter: { value: diameter, unit: lengthUnit } };
  };

  const save = () => {
    try {
      const id = `SEC-${mode === "concrete" ? "RC" : "WOOD"}-${Date.now().toString(36).toUpperCase()}`;
      const section: Section = {
        id,
        family: mode === "concrete" ? "RC-RECT" : "WOOD-RECT",
        designation: designation.trim() || (mode === "concrete" ? "Rectangular RC Section" : "Rectangular Wood Section"),
        geometry: {
          shape: "rectangular",
          width: { value: positive(width, "SECTION_WIDTH"), unit: lengthUnit },
          depth: { value: positive(depth, "SECTION_DEPTH"), unit: lengthUnit },
        },
        analysis: {
          A: { value: finite(A, "SECTION_A"), unit: areaUnit },
          Iy: { value: finite(Iy, "SECTION_IY"), unit: inertiaUnit },
          Iz: { value: finite(Iz, "SECTION_IZ"), unit: inertiaUnit },
          J: { value: finite(J, "SECTION_J"), unit: inertiaUnit },
        },
        design:
          mode === "wood"
            ? {
                materialClass: "wood",
                sectionShape: "rectangular",
                representationVersion: "0.1",
              }
            : {
                materialClass: "concrete",
                reinforcedConcrete: {
                  representationVersion: "0.1",
                  shape: "rectangular",
                  analysisCoupling: "none",
                  ...(reinforcementMaterialId ? { reinforcementMaterialId } : {}),
                  ...(cover.trim()
                    ? { cover: { value: positive(cover, "REBAR_COVER"), unit: lengthUnit } }
                    : {}),
                  longitudinalBars: {
                    ...(bars(topCount, topDiameter, "TOP_REBAR")
                      ? { top: bars(topCount, topDiameter, "TOP_REBAR") }
                      : {}),
                    ...(bars(bottomCount, bottomDiameter, "BOTTOM_REBAR")
                      ? { bottom: bars(bottomCount, bottomDiameter, "BOTTOM_REBAR") }
                      : {}),
                    ...(bars(perimeterCount, perimeterDiameter, "PERIMETER_REBAR")
                      ? { perimeter: bars(perimeterCount, perimeterDiameter, "PERIMETER_REBAR") }
                      : {}),
                  },
                },
              },
        metadata: {
          source: "custom",
          representationOnly: mode === "concrete",
        },
      };

      onModelChange(
        { ...model, sections: [...model.sections, section] },
        `${section.designation} added to the section library.`,
      );
      reset(mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "SECTION_CREATE_FAILED");
    }
  };

  return (
    <aside
      aria-label="Concrete and wood section creator"
      style={{
        position: "fixed",
        left: 16,
        top: 112,
        zIndex: 2020,
        width: "min(390px, 92vw)",
        maxHeight: "calc(100vh - 132px)",
        overflowY: "auto",
        background: "#fff",
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        boxShadow: "0 18px 45px rgba(15,23,42,.22)",
        padding: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Concrete / Wood Sections</strong>
        <button type="button" onClick={() => setVisible(false)}>Close</button>
      </div>

      <p style={{ fontSize: 12 }}>
        Geometry and rebar are representation data. A/Iy/Iz/J remain explicit Core inputs.
      </p>

      <label>
        Type
        <select
          style={inputStyle}
          value={mode}
          onChange={(event) => reset(event.target.value as Mode)}
        >
          <option value="concrete">Concrete Rectangular + Rebar</option>
          <option value="wood">Wood Rectangular</option>
        </select>
      </label>

      <label>
        Designation
        <input style={inputStyle} value={designation} onChange={(event) => setDesignation(event.target.value)} />
      </label>
      <label>
        Width
        <input style={inputStyle} type="number" step="any" value={width} onChange={(event) => setWidth(event.target.value)} />
      </label>
      <label>
        Depth
        <input style={inputStyle} type="number" step="any" value={depth} onChange={(event) => setDepth(event.target.value)} />
      </label>
      <label>
        Length Unit
        <input style={inputStyle} value={lengthUnit} onChange={(event) => setLengthUnit(event.target.value)} />
      </label>

      {mode === "concrete" ? (
        <fieldset>
          <legend>Rebar Layout</legend>
          <label>
            Reinforcement Material
            <select style={inputStyle} value={reinforcementMaterialId} onChange={(event) => setReinforcementMaterialId(event.target.value)}>
              <option value="">Not assigned</option>
              {steelMaterials.map((material) => (
                <option key={material.id} value={material.id}>{material.name}</option>
              ))}
            </select>
          </label>
          <label>
            Cover
            <input style={inputStyle} type="number" step="any" value={cover} onChange={(event) => setCover(event.target.value)} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <label>Top Count<input style={inputStyle} type="number" min="0" step="1" value={topCount} onChange={(event) => setTopCount(event.target.value)} /></label>
            <label>Top Diameter<input style={inputStyle} type="number" min="0" step="any" value={topDiameter} onChange={(event) => setTopDiameter(event.target.value)} /></label>
            <label>Bottom Count<input style={inputStyle} type="number" min="0" step="1" value={bottomCount} onChange={(event) => setBottomCount(event.target.value)} /></label>
            <label>Bottom Diameter<input style={inputStyle} type="number" min="0" step="any" value={bottomDiameter} onChange={(event) => setBottomDiameter(event.target.value)} /></label>
            <label>Column/Perimeter Count<input style={inputStyle} type="number" min="0" step="1" value={perimeterCount} onChange={(event) => setPerimeterCount(event.target.value)} /></label>
            <label>Column/Perimeter Diameter<input style={inputStyle} type="number" min="0" step="any" value={perimeterDiameter} onChange={(event) => setPerimeterDiameter(event.target.value)} /></label>
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend>Explicit Analysis Properties</legend>
        <label>A<input style={inputStyle} type="number" step="any" value={A} onChange={(event) => setA(event.target.value)} /></label>
        <label>Area Unit<input style={inputStyle} value={areaUnit} onChange={(event) => setAreaUnit(event.target.value)} /></label>
        <label>Iy<input style={inputStyle} type="number" step="any" value={Iy} onChange={(event) => setIy(event.target.value)} /></label>
        <label>Iz<input style={inputStyle} type="number" step="any" value={Iz} onChange={(event) => setIz(event.target.value)} /></label>
        <label>J<input style={inputStyle} type="number" step="any" value={J} onChange={(event) => setJ(event.target.value)} /></label>
        <label>Inertia Unit<input style={inputStyle} value={inertiaUnit} onChange={(event) => setInertiaUnit(event.target.value)} /></label>
      </fieldset>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      <button type="button" onClick={save}>Add Section</button>
    </aside>
  );
}
