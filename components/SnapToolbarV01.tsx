"use client";

import {
  setSnapSetting,
  useSnapSettings,
  type SnapKindPreference,
} from "../lib/editor/snap-settings";

const options: Array<{ key: SnapKindPreference; label: string }> = [
  { key: "endpoint", label: "End" },
  { key: "midpoint", label: "Middle" },
  { key: "perpendicular", label: "Perpendicular" },
  { key: "grid", label: "Grid" },
  { key: "node", label: "Node" },
];

export default function SnapToolbarV01() {
  const settings = useSnapSettings();
  const enabled = Object.values(settings).some(Boolean);

  return (
    <div
      aria-label="Snap settings"
      style={{
        position: "absolute",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 10px",
        border: "1px solid rgba(148,163,184,.45)",
        borderRadius: 8,
        background: "rgba(15,23,42,.88)",
        color: "#f8fafc",
        fontSize: 12,
        whiteSpace: "nowrap",
        backdropFilter: "blur(8px)",
      }}
    >
      <strong>Snap: {enabled ? "ON" : "OFF"}</strong>
      {options.map(({ key, label }) => (
        <label
          key={key}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(event) => setSnapSetting(key, event.target.checked)}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
