"use client";

import { useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";

type WorkspaceMode = "simple" | "advanced";
type ModelingTool = "column" | "beam" | "brace" | "slab" | "wall";
type UtilityTool = "select" | "view" | "move" | "copy" | "delete";

const modelingTools: Array<{ id: ModelingTool; label: string; short: string }> = [
  { id: "column", label: "Column", short: "C" },
  { id: "beam", label: "Beam", short: "B" },
  { id: "brace", label: "Brace", short: "BR" },
  { id: "slab", label: "Slab", short: "SL" },
  { id: "wall", label: "Wall", short: "W" },
];

const utilityTools: Array<{ id: UtilityTool; label: string; short: string; disabled?: boolean }> = [
  { id: "select", label: "Select", short: "S" },
  { id: "view", label: "View", short: "V" },
  { id: "move", label: "Move", short: "M", disabled: true },
  { id: "copy", label: "Copy", short: "CP", disabled: true },
  { id: "delete", label: "Delete", short: "D" },
];

function clickEditorButton(label: string): boolean {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".engineeringEditorStage .toolbar button"),
  ).find((item) => item.textContent?.trim() === label);

  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function openGrid() {
  window.dispatchEvent(new Event("linkoteq:grid-panel-open"));
}

function openLevels() {
  window.dispatchEvent(new Event("linkoteq:levels-panel-open"));
}

export default function StructuralEditorShell() {
  const [mode, setMode] = useState<WorkspaceMode>("simple");
  const [activeModelTool, setActiveModelTool] = useState<ModelingTool | null>(null);
  const [activeUtilityTool, setActiveUtilityTool] = useState<UtilityTool>("select");

  function runModelTool(tool: ModelingTool) {
    const labels: Record<ModelingTool, string> = {
      column: "Column",
      beam: "Beam",
      brace: "Brace",
      slab: "Slab",
      wall: "Wall",
    };
    if (clickEditorButton(labels[tool])) setActiveModelTool(tool);
  }

  function runUtilityTool(tool: UtilityTool) {
    if (tool === "move" || tool === "copy") return;
    if (tool === "select") {
      clickEditorButton("Select");
      setActiveUtilityTool("select");
      setActiveModelTool(null);
      return;
    }
    if (tool === "view") {
      setActiveUtilityTool("view");
      setActiveModelTool(null);
      return;
    }
    if (tool === "delete") {
      clickEditorButton("Delete selected");
      setActiveUtilityTool("delete");
    }
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
          <button type="button" className={mode === "simple" ? "active" : ""} onClick={() => setMode("simple")}>Simple Mode</button>
          <button type="button" className={mode === "advanced" ? "active" : ""} onClick={() => setMode("advanced")}>Advanced Mode</button>
        </div>
      </header>

      <nav className="architectToolstrip" aria-label="Add structural elements">
        {modelingTools.map((tool) => (
          <button key={tool.id} type="button" className={activeModelTool === tool.id ? "active" : ""} onClick={() => runModelTool(tool.id)}>
            <span className="architectToolIcon" aria-hidden="true">{tool.short}</span>
            <span>{tool.label}</span>
          </button>
        ))}
      </nav>

      <div className="architectContextbar">
        <span className="architectContextTitle">3D Workspace</span>
        <span className="architectContextHint">{activeModelTool ? `Add: ${activeModelTool}` : "Model setup and drawing tools"}</span>
        <div className="architectViewPills" aria-label="View status">
          <span>Perspective</span>
          <span>Snap: ON</span>
        </div>
      </div>

      <div className="architectWorkspaceFrame">
        {mode === "simple" ? (
          <aside className="architectQuickPanel" aria-label="Setup and quick tools">
            <div className="architectPanelHeading">
              <div>
                <span className="architectEyebrow">MODEL</span>
                <h2>Setup &amp; Tools</h2>
              </div>
              <span className="architectPanelBadge">Simple</span>
            </div>

            <div className="architectQuickActions">
              <button type="button" onClick={openGrid}>
                <span className="architectQuickIcon" aria-hidden="true">G</span>
                <span><strong>Grid</strong><small>Plan axes</small></span>
              </button>
              <button type="button" onClick={openLevels}>
                <span className="architectQuickIcon" aria-hidden="true">L</span>
                <span><strong>Levels</strong><small>Elevations</small></span>
              </button>

              {utilityTools.map((tool) => (
                <button key={tool.id} type="button" className={activeUtilityTool === tool.id ? "active" : ""} onClick={() => runUtilityTool(tool.id)} disabled={tool.disabled}>
                  <span className="architectQuickIcon" aria-hidden="true">{tool.short}</span>
                  <span>
                    <strong>{tool.label}</strong>
                    <small>{tool.id === "select" ? "Pick objects" : tool.id === "view" ? "Navigate" : tool.id === "delete" ? "Remove selection" : "Coming next"}</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <div className="architectViewportColumn">
          <div className="architectViewportStage">
            <div className="engineeringEditorStage">
              <StructuralEditorV05 />
            </div>
          </div>
          <div className="architectStatusbar" role="status" aria-live="polite">
            <span><strong>Utility:</strong> {activeUtilityTool}</span>
            <span className="architectStatusDivider" aria-hidden="true">|</span>
            <span><strong>Add:</strong> {activeModelTool ?? "None"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
