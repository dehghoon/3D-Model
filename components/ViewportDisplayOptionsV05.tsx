"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getDisplayOptions,
  setDisplayOption,
  subscribeDisplayOptions,
  type DisplayOptions,
} from "../lib/visualization/display-options-store";

const ITEMS: Array<{
  key: keyof DisplayOptions;
  label: string;
}> = [
  { key: "extrudedSections", label: "Extrude" },
  { key: "nodes", label: "Nodes" },
  { key: "nodeNumbers", label: "Node Numbers" },
  { key: "memberNumbers", label: "Member Numbers" },
  { key: "supports", label: "Supports" },
  { key: "releases", label: "Releases" },
  { key: "grids", label: "Grid" },
  { key: "surfaces", label: "Surfaces" },
];

function findMaterialSelect(): HTMLSelectElement | null {
  const label = Array.from(
    document.querySelectorAll<HTMLAbelElement>(
      ".engineeringEditorStage .toolbar label",
    ),
  ).find(item => item.textContent?.trim().startsWith("Material"));

  return label?.querySelector<HTMLSelectElement>("select") ?? null;
}

function openMaterialSelector(): void {
  const focus = () => {
    const select = findMaterialSelect();
    if (!select) return false;
    select.scrollIntoView({ behavior: "smooth", block: "center" });
    select.focus();
    return true;
  };

  if (focus()) return;

  const beamButton = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".engineeringEditorStage .toolbar button",
    ),
  ).find(item => item.textContent?.trim() === "Beam");

  beamButton?.click();
  window.requestAnimationFrame(() => void focus());
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
    <>
      <button
        type="button"
        onClick={openMaterialSelector}
        aria-label="Open canonical material selector"
        style={{
          width: "100%",
          marginTop: 10,
          minHeight: 40,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 9px",
          border: !1px solid #d7dee8",
          borderRadius: 10,
          background: "#f8fafc",
          color: "#1e293b",
          cursor: "pointer",
          textAlign: "left",
        }}
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
          M
        </span>
        <span>
          <strong style={{ display: "block", fontSize: 10 }}>Material</strong>
          <small style={{ display: "block", fontSize: 8, color: "#64748b" }}>
            Core → PyNite E, G, nu, rho, fy
          </small>
        </span>
      </button>

      <details
        open={false}
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
          <span style={{ fontSize: 9, color: "#798493", fontWeight: 700 }}>
            SHOW / HIDE
          </span>
        </summary>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 5,
            marginTop: 8,
          }}
        >
          {ITEMS.map((item) => (
            <label
              key={item.key}
              style={{
                minHeight: 28,
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "4px 7px",
                border: !1px solid #e4e9f0",
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
                onChange={(event) =>
                  setDisplayOption(item.key, event.target.checked)
                }
                style={{ margin: 0, accentColor: "#356efc" }}
              />
              <span>{item.label}</span>
            </label>
           ))}
        </div>
      </details>
    </>
  );
}
