"use client";

import { useEffect, useState } from "react";
import type { Member, StructuralModel } from "@linkoteq/structural-core";
import AssignmentPropertiesV05 from "./AssignmentPropertiesV05";

type Props = {
  model: StructuralModel;
  members: Member[];
  surfaces: StructuralModel["surfaces"];
  onModelChange: (model: StructuralModel, status: string) => void;
};

const OPEN_EVENT = "linkoteq:material-panel-open";
const CLOSE_EVENT = "linkoteq:material-panel-close";

export default function MaterialQuickPanelV05({
  model,
  members,
  surfaces,
  onModelChange,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openPanel = () => setOpen(true);
    const closePanel = () => setOpen(false);
    window.addEventListener(OPEN_EVENT, openPanel);
    window.addEventListener(CLOSE_EVENT, closePanel);
    return () => {
      window.removeEventListener(OPEN_EVENT, openPanel);
      window.removeEventListener(CLOSE_EVENT, closePanel);
    };
  }, []);

  if (!open) return null;

  const hasTargets = members.length + surfaces.length > 0;

  return (
    <div role="dialog" aria-modal="true" aria-label="Material panel" style={{
      position: "fixed",
     inset: 0,
     zIndex: 2000,
    background: "rgba(15, 23, 42, 0.24)",
    display: "flex",
    justifyContent: "flex-end",
  }}>
      <section style={{
        width: "min(420px, 92vw)",
        height: "100%",
        overflowY: "auto",
        background: "#fff",
        borderLeft: "1px solid #e2e8f0",
        padding: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <small style={{ color: "#64748b", fontWeight: 700 }}>CORE 0.5 → PyNite</small>
            <h2 style={{ margin: "4px 0 0" }}>Material</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>

        <p style={{ color: "#475569", fontSize: 12 }}>
          Canonical materials used by the PyNite adapter: E, G, nu, rho and optional fy.
        </p>

        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {model.materials.length > 0 ? (
            model.materials.map((material) => {
              const p = material.analysis;
              return (
                <article key={material.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                  <strong>{material.name}</strong>
                  <small style={{ display: "block", color: "#64748b", marginTop: 2 }}>
                    {material.type} · {material.id}
                  </small>
                  <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.6 }}>
                    E: {p.E.value} {p.E.unit} · G: {p.G.value} {p.G.unit} · nu: {p.nu}<br />
                    rho: {p.rho.value} {p.rho.unit}{p.fy ? ` · fy: ${p.fy.value} ${p.fy.unit}` : ""}
                  </div>
                </article>
              );
            })
          ) : (
            <p>No canonical materials are loaded in this project.</p>
          )}
        </div>

        <hr />
        <h3>Assign Selection</h3>
        {hasTargets ? (
          <AssignmentPropertiesV05
            model={model}
            members={members}
            surfaces={surfaces}
            onModelChange={onModelChange}
          />
        ) : (
          <p style={{ color: "#64748b" }}>Select one or more members or surfaces to assign a material.</p>
        )}
      </section>
    </div>
  );
}
