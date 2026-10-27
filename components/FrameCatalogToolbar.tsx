"use client";
import { useState } from "react";
import type {
  Material,
  Section,
  StructuralModel,
} from "@linkoteq/structural-core";
import {
  type FrameCatalogs,
  completeCatalogMaterials,
} from "../lib/core-frame-catalogs";
import type { FrameLayout } from "../lib/simple-frame";
export function FrameSectionPicker({
  label,
  value,
  catalogs,
  model,
  onChange,
  compact = false,
}: {
  compact?: boolean;
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
      {!compact ? (
        <input
          type="search"
          aria-label={`Search ${label}`}
          placeholder="Search section…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}
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
  const readyMaterials = completeCatalogMaterials(catalogs?.materials ?? []);
  const choices = new Map(
    [...model.materials, ...readyMaterials].map((m) => [m.id, m]),
  );
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
            value={materialId}
            onChange={(e) => {
              const material = choices.get(e.target.value);
              if (material) onMaterial(material);
            }}
          >
            <optgroup label="Project materials">
              {model.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.type}
                </option>
              ))}
            </optgroup>
            <optgroup label="Core materials">
              {catalogs?.materials.map((m) => (
                <option key={m.id} value={m.id} disabled={!choices.has(m.id)}>
                  {m.name} ({m.jurisdiction})
                  {!choices.has(m.id) ? " · properties unavailable" : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {(["beam", "column", "brace"] as const).map((type) => (
          <div key={type}>
            <FrameSectionPicker
              compact
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
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert">
          {error} <button onClick={onRetry}>Retry catalogs</button>
        </p>
      ) : !catalogs ? (
        <span className="sfCatalogLoading" role="status">
          Loading catalogs…
        </span>
      ) : null}
    </section>
  );
}
