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
  document.querySelectorAll(".architect-revealed-panel").forEach((element) => {
    element.classList.remove("architect-revealed-panel");
  });
}

function toggleGridPanel() {
  const panel = document.querySelector<HTMLElement>(
    ".engineeringEditorStage .lgPanel",
  );
  if (!panel) return;

  const isOpen = panel.classList.contains("architect-revealed-panel");
  closeTemporaryPanels();

  if (!isOpen) {
    panel.classList.add("architect-revealed-panel");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(
      () => panel.querySelector<HTMLInputElement>("input")?.focus(),
      120,
    );
  }
}

export default function ContextualHelperController() {
  useEffect(() => {
    const root = document.querySelector(".architectToolstrip");
    if (!root) return;

    const handleClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>("button");
      if (!button) return;

      const label = button.textContent?.trim();
      if (!label || !MODELING_TOOLS.has(label)) return;

      if (label === "Grid") {
        window.setTimeout(toggleGridPanel, 0);
        return;
      }

      closeTemporaryPanels();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTemporaryPanels();
    };

    root.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      root.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
