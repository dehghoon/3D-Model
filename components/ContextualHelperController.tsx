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

export default function ContextualHelperController() {
  useEffect(() => {
    const root = document.querySelector(".architectToolstrip");
    if (!root) return;

    const handleClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>("button");
      const label = button.textContent?.trim();
      if (!label || !MODELING_TOOLS.has(label)) return;
      if (label === "Grid") return;

      document.querySelectorAll(".architect-revealed-panel").forEach((element) => {
        element.classList.remove("architect-revealed-panel");
      });
    };

    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
  }, []);

  return null;
}
