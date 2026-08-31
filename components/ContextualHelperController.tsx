"use client";

import { useEffect } from "react";

const MODELING_TOOLS = new Set([
  "Grid",
  "Column",
  "Beam",
  "Brace",
  "Slab",
  "Wall",
]);

function getToolLabel(button: HTMLButtonElement): string {
  const explicitLabel = button
    .querySelector<HTMLElement>("span:last-child")
    ?.textContent?.trim();

  return explicitLabel || button.textContent?.trim() || "";
}

export default function ContextualHelperController() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>(
        ".architectToolstrip button",
      );
      if (!button) return;

      const label = getToolLabel(button);
      if (!MODELING_TOOLS.has(label)) return;

      if (label === "Grid") {
        window.dispatchEvent(new Event("linkoteq:grid-panel-open"));
        return;
      }

      window.dispatchEvent(new Event("linkoteq:grid-panel-close"));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.dispatchEvent(new Event("linkoteq:grid-panel-close"));
      }
    };

    document.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
