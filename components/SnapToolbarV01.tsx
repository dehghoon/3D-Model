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
    <div className="architectSnapControls" aria-label="Snap settings">
      <span className="architectSnapStatus">Snap: {enabled ? "ON" : "OFF"}</span>
      <div className="architectSnapOptions">
        {options.map(({ key, label }) => (
          <label key={key} className="architectSnapOption">
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(event) => setSnapSetting(key, event.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
