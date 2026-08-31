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

function closeTemporaryPanels() {
  document
    .querySelectorAll(".architect-revealed-panel")
    .forEach((element) => {
      element.classList.remove("architect-revealed-panel");
    });
}

function openGridPanel() {
  const panel = document.querySelector<HTMLElement>(
    ".engineeringEditorStage .lgPanel",
  );
  if (!panel) return;

  closeTemporaryPanels();
  panel.classList.add("architect-revealed-panel");

  window.setTimeout(() => {
    panel
      .querySelector<HTMLInputElement | HTMLSelectElement>("input, select")
      ?.focus();
  }, 80);
}

export default function ContextualHelperController() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>(
        ".architectToolsStrip button",
      );
      if (!button) return;

      const label = button.textContent?.trim();
      if (!label || !MODELING_TOOLS.has(label)) return;

      if (label === "Grid") {
        window.setTimeout(openGridPanel, 0);
        return;
      }

      closeTemporaryPanels();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTemporaryPanels();
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
