"use client";
import { useState } from "react";
import type {
  Material,
  Section,
  StructuralModel,
} from "@linkoteq/structural-core";
import {
  type FrameCatalogs,
  REQUESTED_FRAME_SECTIONS,
  requestedSection,
} from "../lib/core-frame-catalogs";
import type { FrameLayout } from "../lib/simple-frame";
export function FrameSectionPicker({
  label,
  value,
  catalogs,
  model,
  onChange,
}: {
  label: string;
  value: string;
  catalogs: FrameCatalogs | null;
  model: StructuralModel;
  onChange: (section: Section) => void;
}) {
  const [query, setQuery] = useState("");
  const available = new Map(
    [...model.sections, ...(catalogs?.sections ?? [])].map((s) => [s.id, s]),
  );
  const records =
    catalogs?.records ??
    model.sections.map((s) => ({
      id: s.id,
      designation: s.designation ?? s.id,
      family: s.family,
    }));
  const selected = available.get(value);
  return (
    <label className="sfCatalogField">
      {label}
      <input
        type="search"
        aria-label={`Search ${label}`}
        placeholder="Search section…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          const section = available.get(e.target.value);
          if (section) onChange(section);
        }}
      >
        <option value="">Select a complete section</option>
        {selected && !records.some((r) => r.id === value) ? (
          <option value={value}>
            {selected.designation ?? value} (current)
          </option>
        ) : null}
        {records
          .filter(
            (r) =>
              r.id === value ||
              r.designation.toLowerCase().includes(query.toLowerCase()),
          )
          .map((r) => (
            <option key={r.id} value={r.id} disabled={!available.has(r.id)}>
              {r.designation}
              {!available.has(r.id) ? " · incomplete Core properties" : ""}
            </option>
          ))}
      </select>
    </label>
  );
}
export default function FrameCatalogToolbar({
  model,
  layout,
  catalogs,
  error,
  onRetry,
  onLayout,
  onMaterial,
  onLocation,
}: {
  model: StructuralModel;
  layout: FrameLayout;
  catalogs: FrameCatalogs | null;
  error: string;
  onRetry: () => void;
  onLayout: (layout: FrameLayout, section?: Section) => void;
  onMaterial: (material: Material) => void;
  onLocation: (id: string) => void;
}) {
  const locationId = String(model.project.metadata?.locationId ?? "");
  const location = catalogs?.locations.find((l) => l.id === locationId);
  const [region, setRegion] = useState("");
  const province = location?.provinceOrTerritory ?? region;
  const [templateId, setTemplateId] = useState("");
  const [materialError, setMaterialError] = useState("");
  const template = catalogs?.materials.find((m) => m.id === templateId);
  const steel = model.materials.find((m) => m.type === "steel");
  const materialId =
    layout.defaults?.materialId ?? steel?.id ?? model.materials[0]?.id ?? "";
  return (
    <section
      className="sfCatalogToolbar"
      aria-label="Project location and member defaults"
    >
      <div className="sfCatalogRow">
        <label>
          Province / territory
          <select
            aria-label="Province / territory"
            value={province}
            disabled={!catalogs}
            onChange={(e) => {
              setRegion(e.target.value);
              onLocation("");
            }}
          >
            <option value="">Choose province</option>
            {[
              ...new Set(
                catalogs?.locations.map((l) => l.provinceOrTerritory) ?? [],
              ),
            ]
              .sort()
              .map((p) => (
                <option key={p}>{p}</option>
              ))}
          </select>
        </label>
        <label>
          Project location
          <select
            aria-label="Project location"
            value={locationId}
            disabled={!province || !catalogs}
            onChange={(e) => onLocation(e.target.value)}
          >
            <option value="">Choose location</option>
            {catalogs?.locations
              .filter((l) => l.provinceOrTerritory === province)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.location}
                </option>
              ))}
          </select>
        </label>
        <label>
          Material
          <select
            aria-label="Default material"
            value={templateId ? `template:${templateId}` : materialId}
            onChange={(e) => {
              if (e.target.value.startsWith("template:")) {
                setTemplateId(e.target.value.slice(9));
                setMaterialError("");
              } else {
                setTemplateId("");
                const m = model.materials.find((m) => m.id === e.target.value);
                if (m) onMaterial(m);
              }
            }}
          >
            <optgroup label="Project materials">
              {model.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.type}
                </option>
              ))}
            </optgroup>
            <optgroup label="Core material reference templates">
              {catalogs?.materials.map((m) => (
                <option key={m.id} value={`template:${m.id}`}>
                  {m.name} ({m.jurisdiction})
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {(["beam", "column", "brace"] as const).map((type) => (
          <div key={type}>
            <FrameSectionPicker
              label={`Default ${type} section`}
              value={
                layout.defaults?.[type] ??
                (type === "brace" ? "" : (model.sections[0]?.id ?? ""))
              }
              catalogs={catalogs}
              model={model}
              onChange={(section) =>
                onLayout(
                  {
                    ...layout,
                    defaults: { ...layout.defaults, [type]: section.id },
                  },
                  section,
                )
              }
            />
            {catalogs && !requestedSection(catalogs, type) ? (
              <small className="sfCatalogWarning">
                Requested {REQUESTED_FRAME_SECTIONS[type]} is absent or
                incomplete. Choose a catalog section.
              </small>
            ) : null}
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert">
          {error} <button onClick={onRetry}>Retry catalogs</button>
        </p>
      ) : !catalogs ? (
        <p role="status">
          Loading Core location, material and section catalogs…
        </p>
      ) : (
        <small>
          Core catalogs · {catalogs.locations.length} Canadian locations ·{" "}
          {catalogs.datasetVersion}
        </small>
      )}
      {template ? (
        <form
          className="sfMaterialForm"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const data = new FormData(e.currentTarget);
              const n = (key: string) => Number(data.get(key));
              const E = n("E"),
                G = n("G"),
                nu = n("nu"),
                rho = n("rho"),
                fy = n("fy");
              if (
                ![E, G, rho].every((v) => Number.isFinite(v) && v > 0) ||
                !Number.isFinite(nu) ||
                nu <= -1 ||
                nu >= 0.5 ||
                (template.type === "steel" && (!Number.isFinite(fy) || fy <= 0))
              )
                throw new Error("Enter valid project material properties.");
              const material: Material = {
                id: `SF-MAT-${template.id}`,
                type: template.type,
                name: template.name,
                analysis: {
                  E: { value: E, unit: "MPa" },
                  G: { value: G, unit: "MPa" },
                  nu,
                  rho: { value: rho, unit: "kg/m3" },
                  ...(template.type === "steel"
                    ? { fy: { value: fy, unit: "MPa" } }
                    : {}),
                },
                ...(template.type === "steel"
                  ? { steel: { grade: template.grade } }
                  : {}),
                metadata: {
                  coreTemplateId: template.id,
                  coreCatalogRef: catalogs?.ref,
                  analysisPropertySource: "User-supplied project properties",
                },
              };
              onMaterial(material);
              setTemplateId("");
              setMaterialError("");
            } catch (err) {
              setMaterialError((err as Error).message);
            }
          }}
        >
          <strong>{template.name}</strong>
          <span>
            Core lists this grade as a reference template. Enter its project
            properties to assign it.
          </span>
          {[
            "E",
            "G",
            "nu",
            "rho",
            ...(template.type === "steel" ? ["fy"] : []),
          ].map((key) => (
            <label key={key}>
              {key}
              {key === "rho" ? " (kg/m³)" : key === "nu" ? "" : " (MPa)"}
              <input
                name={key}
                aria-label={`Material ${key}`}
                type="number"
                step="any"
                required
              />
            </label>
          ))}
          <button type="submit">Apply material</button>
          <button type="button" onClick={() => setTemplateId("")}>
            Cancel
          </button>
          {materialError ? <p role="alert">{materialError}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
