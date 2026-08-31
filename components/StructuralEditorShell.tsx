"use client";

import { useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";

type ModelingTool = "grid" | "column" | "beam" | "brace" | "slab" | "wall";

const tools: Array<{ id: ModelingTool; label: string; short: string }> = [
  { id: "grid", label: "Grid", short: "G" },
  { id: "column", label: "Column", short: "C" },
  { id: "beam", label: "Beam", short: "B" },
  { id: "brace", label: "Brace", short: "BR" },
  { id: "slab", label: "Slab", short: "SL" },
  { id: "wall", label: "Wall", short: "W" },
];

function clickLegacyTool(label: string): boolean {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".engineeringEditorStage .toolbar button",
    ),
  ).find((item) => item.textContent?.trim() === label);

  if (!button || button.disabled) return false;
  button.click();
  return true;
}

export default function StructuralEditorShell() {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [activeTool, setActiveTool] = useState<ModelingTool | null>(null);

  function activateTool(tool: ModelingTool) {
    if (tool === "grid") {
      window.dispatchEvent(new Event("linkoteq:grid-panel-open"));
      setActiveTool("grid");
      return;
    }

    const labels: Record<Exclude<ModelingTool, "grid">, string> = {
      column: "Column",
      beam: "Beam",
      brace: "Brace",
      slab: "Slab",
      wall: "Wall",
    };

    if (clickLegacyTool(labels[tool])) setActiveTool(tool);
  }

  return (
    <div className={`architectEditorShell mode-${mode}`}>
      <header className="architectTopbar">
        <div className="architectBrand">
          <span className="architectBrandMark" aria-hidden="true">L</span>
          <div>
            <strong>Structural Concept Modeler</strong>
            <span>Core 0.5</span>
          </div>
        </div>

        <div className="architectModeSwitch" aria-label="Workspace mode">
          <button
            type="button"
            className={mode === "simple" ? "active" : ""}
            onClick={() => setMode("simple")}
          >
            Simple Mode
          </button>
          <button
            type="button"
            className={mode === "advanced" ? "active" : ""}
            onClick={() => setMode("advanced")}
          >
            Advanced Mode
          </button>
        </div>
      </header>

      <nav className="architectToolstrip" aria-label="Add model elements">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={activeTool === tool.id ? "active" : ""}
            onClick={() => activateTool(tool.id)}
          >
            <span className="architectToolIcon" aria-hidden="true">{tool.short}</span>
            <span>{tool.label}</span>
          </button>
        ))}
      </nav>

      <div className="architectContextbar">
        <span className="architectContextTitle">3D Workspace</span>
        <span className="architectContextHint">
          Add: {activeTool ?? "None"}
        </span>
        <div className="architectViewPills" aria-label="View status">
          <span>Perspective</span>
          <span>Snap: ON</span>
        </div>
      </div>

      <div className="architectWorkspaceFrame">
        <div className="architectViewportColumn">
          <div className="architectViewportStage">
            <div className="engineeringEditorStage">
              <StructuralEditorV05 />
            </div>
          </div>
          <div className="architectStatusbar" role="status" aria-live="polite">
            <span><strong>Add:</strong> {activeTool ?? "None"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
