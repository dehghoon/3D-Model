"use client";

import { useEffect } from "react";

function buttonByText(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim().toLowerCase().includes(text.toLowerCase()));
}

function saveLtq() {
  const pre = document.querySelector<HTMLPreElement>(".inspector pre");
  if (!pre?.textContent) return;
  try {
    const model = JSON.parse(pre.textContent);
    const packageData = { format: "linkoteq-project", version: 1, savedAt: new Date().toISOString(), model };
    const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: "application/vnd.linkoteq.project+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${model?.project?.name || "project"}.ltq`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* model inspector is the canonical visible snapshot for this prototype */ }
}

export default function EditorShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA";
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if ((e.key === "Delete" || e.key === "Backspace") && !mod) { e.preventDefault(); buttonByText("Delete")?.click(); }
      else if (mod && e.key.toLowerCase() === "z" && e.shiftKey) { e.preventDefault(); buttonByText("Redo")?.click(); }
      else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); buttonByText("Undo")?.click(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); buttonByText("Redo")?.click(); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveLtq(); }
    };
    window.addEventListener("keydown", onKey);
    const saveHandler = () => saveLtq();
    window.addEventListener("linkoteq-save", saveHandler);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("linkoteq-save", saveHandler); };
  }, []);
  return null;
}
