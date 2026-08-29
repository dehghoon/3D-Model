"use client";

import { useEffect, useMemo, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import {
  addCiscSectionToModel,
  DEFAULT_CISC_DESIGNATION,
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
  const [status, setStatus] = useState("Loading approved CISC W-section dataset...");

  useEffect(() => {
    let cancelled = false;

    loadApprovedCiscSections()
      .then(({ datasetVersion, sections: loaded }) => {
        if (cancelled) return;
        setSections(loaded);
        const defaultRecord =
          loaded.find((item) => item.designation.toUpperCase() === DEFAULT_CISC_DESIGNATION) ??
          loaded[0];
        setSelectedId(defaultRecord?.id ?? "");
        setStatus(`CISC dataset ${datasetVersion}: ${loaded.length} W sections available.`);
        onCatalogLoaded?.(loaded);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "CISC dataset load failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [onCatalogLoaded]);

  const selected = useMemo(
    () => sections.find((item) => item.id === selectedId),
    [sections, selectedId],
  );

  function addSelectedSection() {
    if (!selected) return;
    const next = addCiscSectionToModel(model, selected);
    onModelChange(
      next,
      `CISC section ${selected.designation} (${selected.dataset_version}) added to the Core v0.5 model.`,
    );
  }

  return (
    <section className="panelBlock">
      <h3>CISC W Sections</h3>
      <label>
        Approved section
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="">Select section</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.designation_metric ?? section.designation}
              {section.designation_imperial ? ` / ${section.designation_imperial}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button onClick={addSelectedSection} disabled={!selected}>
        Add Section to Model
      </button>
      <p className="selectionText">{status}</p>
    </section>
  );
}
