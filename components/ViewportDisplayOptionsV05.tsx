"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getDisplayOptions,
  setDisplayOption,
  subscribeDisplayOptions,
  type DisplayOptions,
} from "../lib/visualization/display-options-store";

const ITEMS: Array<{ key: keyof DisplayOptions; label: string }> = [
  { key: "extrudedSections", label: "Extrude" },
  { key: "nodes", label: "Nodes" },
  { key: "nodeNumbers", label: "Node Numbers" },
  { key: "memberNumbers", label: "Member Numbers" },
  { key: "supports", label: "Supports" },
  { key: "releases", label: "Releases" },
  { key: "grids", label: "Grid" },
  { key: "surfaces", label: "Surfaces" },
];

const buttonStyle = {
  width: "100%",
  marginTop: 10,
  minHeight: 40,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 9px",
  border: "1px solid #d7dee8",
  borderRadius: 10,
  background: "#f8fafc",
  color: "#1e293b",
  cursor: "pointer",
  textAlign: "left",
} as const;

function QuickLibraryButton({
  label,
  caption,
  icon,
  ariaLabel,
  eventName,
}: {
  label: string;
  caption: string;
  icon: string;
  ariaLabel: string;
  eventName: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => window.dispatchEvent(new Event(eventName))}
      style={buttonStyle}
    >
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          background: "#eff6ff",
          color: "#2563eb",
          fontWeight: 800,
        }}
      >
        {icon}
      </span>
      <span>
        <strong style={{ display: "block", fontSize: 10 }}>{label}</strong>
        <small style={{ display: "block", fontSize: 8, color: "#64748b" }}>{caption}</small>
      </span>
    </button>
  );
}

export default function ViewportDisplayOptionsV05() {
  const options = useSyncExternalStore(
    subscribeDisplayOptions,
    getDisplayOptions,
    getDisplayOptions,
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("linkoteq:view-cycle"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div>
      <QuickLibraryButton
        label="Material"
        caption="Core → PyNite E, G, nu, rho, fy"
        icon="M"
        ariaLabel="Open canonical material selector"
        eventName="linkoteq:material-panel-open"
      />

      <QuickLibraryButton
        label="Section"
        caption="Core → PyNite A, Iy, Iz, J → 3D geometry"
        icon="S"
        ariaLabel="Open canonical section library"
        eventName="linkoteq:section-panel-open"
      />

      <details
        aria-label="Viewport display options"
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid #e4e9f0",
        }}
      >
        <summary
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            cursor: "pointer",
            listStyle: "none",
            userSelect: "none",
          }}
        >
          <strong style={{ fontSize: 11, color: "#263445" }}>Display</strong>
          <span style={{ fontSize: 9, color: "#798493", fontWeight: 700 }}>SHOW / HIDE</span>
        </summary>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 5, marginTop: 8 }}>
          {ITEMS.map((item) => (
            <label
              key={item.key}
              style={{
                minHeight: 28,
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "4px 7px",
                border: "1px solid #e4e9f0",
                borderRadius: 8,
                background: "#f9fbfd",
                color: "#344254",
                fontSize: 9,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={options[item.key]}
                onChange={(event) => setDisplayOption(item.key, event.target.checked)}
                style={{ margin: 0, accentColor: "#356efc" }}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
