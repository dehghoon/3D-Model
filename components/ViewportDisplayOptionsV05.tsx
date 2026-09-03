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
    <section
      aria-label="Viewport display options"
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid #e4e9f0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 7,
        }}
      >
        <strong style={{ fontSize: 11, color: "#263445" }}>Display</strong>
        <span style={{ fontSize: 8, color: "#798493" }}>VIEW</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 5,
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
              onChange={(event) =>
                setDisplayOption(item.key, event.target.checked)
              }
              style={{ margin: 0, accentColor: "#356efc" }}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
