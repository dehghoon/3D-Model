"use client";

import { useEffect, useMemo, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import {
  addCiscSectionToModel,
  ciscRecordMissingCoreProperties,
  DEFAULT_CISC_DESIGNATION,
  isCiscRecordCoreAssignable,
  loadApprovedCiscSections,
  type CiscSectionRecord,
} from "../lib/cisc-section-library-v05";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
  onCatalogLoaded?: (sections: CiscSectionRecord[]) => void;
}

export default function CiscSectionSelectorV05({
  model,
  onModelChange,
  onCatalogLoaded,
}: Props) {
  const [sections, setSections] = useState<CiscSectionRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [family, setFamily] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Loading approved CISC section catalog...");

  useEffect(() => {
    let cancelled = false;

    loadApprovedCiscSections()
      .then(({ datasetVersion, sections: loaded }) => {
        if (cancelled) return;
        setSections(loaded);

        const defaultRecord =
          loaded.find(
            (item) =>
              item.designation.toUpperCase() === DEFAULT_CISC_DESIGNATION &&
              isCiscRecordCoreAssignable(item),
          ) ??
          loaded.find(isCiscRecordCoreAssignable) ??
          loaded[0];

        setSelectedId(defaultRecord?.id ?? "");

        const familyCount = new Set(loaded.map((item) => item.family)).size;
        const assignableCount = loaded.filter(isCiscRecordCoreAssignable).length;
        setStatus(
          `CISC dataset ${datasetVersion}: ${loaded.length} sections across ${familyCount} families; ${assignableCount} Core-assignable.`,
        );
        onCatalogLoaded?.(loaded);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(
          error instanceof Error ? error.message : "CISC dataset load failed.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [onCatalogLoaded]);

  const families = useMemo(
    () => [...new Set(sections.map((item) => item.family))].sort((a, b) => a.localeCompare(b)),
    [sections],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sections.filter((item) => {
      if (family && item.family !== family) return false;
      if (!normalizedQuery) return true;
      return [
        item.designation,
        item.designation_metric ?? "",
        item.designation_imperial ?? "",
        item.family,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [family, query, sections]);

  const selected = useMemo(
    () => sections.find((item) => item.id === selectedId),
    [sections, selectedId],
  );
  const selectedAssignable = selected ? isCiscRecordCoreAssignable(selected) : false;
  const missing = selected ? ciscRecordMissingCoreProperties(selected) : [];

  function addSelectedSection() {
    if (!selected || !selectedAssignable) return;
    const next = addCiscSectionToModel(model, selected);
    onModelChange(
      next,
      `CISC section ${selected.designation} (${selected.dataset_version}) added to the Core v0.5 model.`,
    );
  }

  return (
    <section className="panelBlock">
      <h3>CISC Section Catalog</h3>

      <label>
        Family
        <select
          value={family}
          onChange={(event) => {
            setFamily(event.target.value);
            setSelectedId("");
          }}
        >
          <option value="">All families</option>
          {families.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <label>
        Search
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Designation or family"
        />
      </label>

      <label>
        Approved section
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Select section</option>
          {filtered.map((section) => (
            <option key={section.id} value={section.id}>
              {section.family} · {section.designation_metric ?? section.designation}
              {section.designation_imperial ? ` / ${section.designation_imperial}` : ""}
              {isCiscRecordCoreAssignable(section) ? "" : " · reference only"}
            </option>
          ))}
        </select>
      </label>

      {selected && !selectedAssignable ? (
        <p className="selectionText">
          Reference only: canonical {missing.join(", ")} is not present in the approved
          record. Assignment requires an approved Agent #2 specification; no engineering
          property is derived in the client.
        </p>
      ) : null}

      <button
        type="button"
        onClick={addSelectedSection}
        disabled={!selected || !selectedAssignable}
      >
        Add Section to Model
      </button>

      <p className="selectionText">
        {filtered.length} matching section(s). {status}
      </p>
    </section>
  );
}
