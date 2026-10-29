"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getDisplayOptions,
  subscribeDisplayOptions,
  setDisplayOption,
  type DisplayOptions,
} from "../lib/visualization/display-options-store";
export default function FrameDisplayPanel({
  dimensions,
  onDimensions,
  members,
  onMembers,
  onOpen,
  dismissWhen,
}: {
  onOpen?: () => void;
  dismissWhen?: boolean;
  dimensions: boolean;
  onDimensions: (v: boolean) => void;
  members: boolean;
  onMembers: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (dismissWhen) setOpen(false);
  }, [dismissWhen]);
  const options = useSyncExternalStore(
    subscribeDisplayOptions,
    getDisplayOptions,
    getDisplayOptions,
  );
  const items: Array<{ key: keyof DisplayOptions; label: string }> = [
    { key: "grids", label: "Grids" },
    { key: "nodes", label: "Nodes" },
    { key: "nodeNumbers", label: "Node numbers" },
    { key: "memberNumbers", label: "Member labels" },
    { key: "extrudedSections", label: "Member thickness" },
  ];
  return (
    <aside className="sfDisplayPanel" aria-label="Simple display controls">
      <button
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
      >
        Display · ON / OFF
      </button>
      {open ? (
        <div>
          <label>
            <input
              type="checkbox"
              checked={members}
              onChange={(e) => onMembers(e.target.checked)}
            />
            Members
          </label>
          {items.map(({ key, label }) => (
            <label key={key}>
              <input
                type="checkbox"
                aria-label={label}
                checked={options[key]}
                onChange={(e) => setDisplayOption(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={dimensions}
              onChange={(e) => onDimensions(e.target.checked)}
            />
            Dimensions
          </label>
        </div>
      ) : null}
    </aside>
  );
}
