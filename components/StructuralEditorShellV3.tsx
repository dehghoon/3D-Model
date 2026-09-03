"use client";

import { useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";
import ViewportDisplayOptionsV05 from "./ViewportDisplayOptionsV05";

type WorkspaceMode = "simple" | "advanced";
type ModelingTool = "Column" | "Beam" | "Brace" | "Slab" | "Wall";
type UtilityTool = "Select" | "View" | "Move" | "Copy" | "Delete";

const modelingTools: ModelingTool[] = ["Column", "Beam", "Brace", "Slab", "Wall"];
const utilityTools: UtilityTool[] = ["Select", "View", "Move", "Copy", "Delete"];

function clickEditorButton(label: string): boolean {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".engineeringEditorStage .toolbar button",
    ),
  ).find((item) => item.textContent?.trim() === label);

  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function clickProjectAction(label: "New" | "Open" | "Save"): void {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".engineeringEditorStage .appShell > .topbar button",
    ),
  ).find((item) => item.textContent?.trim() === label);

  button?.click();
}

function openGrid(): void {
  window.dispatchEvent(new Event("linkoteq:grid-panel-open"));
}

function openLevels(): void {
  window.dispatchEvent(new Event("linkoteq:levels-panel-open"));
}

function utilityDescription(tool: UtilityTool): string {
  switch (tool) {
    case "Select":
      return "Tap or window select";
    case "View":
      return "Orbit, pan and zoom";
    case "Move":
      return "Snap move selection";
    case "Copy":
      return "Snap copy selection";
    case "Delete":
      return "Remove selection";
  }
}

export default function StructuralEditorShellV3() {
  const [mode, setMode] = useState<WorkspaceMode>("simple");
  const [activeModelTool, setActiveModelTool] = useState<ModelingTool | null>(null);
  const [activeUtilityTool, setActiveUtilityTool] = useState<UtilityTool>("View");

  function runModelTool(tool: ModelingTool): void {
    if (clickEditorButton(tool)) {
      setActiveModelTool(tool);
      setActiveUtilityTool("Select");
    }
  }

  function runUtilityTool(tool: UtilityTool): void {
    setActiveUtilityTool(tool);
    setActiveModelTool(null);

    if (tool === "Select") {
      window.dispatchEvent(new Event("linkoteq:view-select"));
    }
    if (tool === "View") {
      window.dispatchEvent(new Event("linkoteq:view-cycle"));
    }
  }

  return (
    <div className={`architectEditorShell mode-${mode}`}>
      <header className="architectTopbar">
        <div className="architectBrand">
          <span className="architectBrandMark" aria-hidden="true">
            L
          </span>
          <div>
            <strong>Structural Concept Modeler</strong>
            <span>Core 0.5 · That Open</span>
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
        <div className="architectTopActions" aria-label="Project actions">
          <button
            type="button"
            className="architectIconAction"
            title="New project"
            aria-label="New project"
            onClick={() => clickProjectAction("New")}
          >
            ＋
          </button>
          <button
            type="button"
            className="architectIconAction"
            title="Open project"
            aria-label="Open project"
            onClick={() => clickProjectAction("Open")}
          >
            ⌑
          </button>
          <button
            type="button"
            className="architectIconAction architectSaveAction"
            title="Save project"
            aria-label="Save project"
            onClick={() => clickProjectAction("Save")}
          >
            ⇩
          </button>
        </div>
      </header>

      <nav className="architectToolstrip" aria-label="Add structural elements">
        {modelingTools.map((tool) => (
          <button
            key={tool}
            type="button"
            className={activeModelTool === tool ? "active" : ""}
            onClick={() => runModelTool(tool)}
          >
            <span className="architectToolIcon" aria-hidden="true">
              {tool.slice(0, 2)}
            </span>
            <span>{tool}</span>
          </button>
        ))}
      </nav>

      <div className="architectContextbar">
        <span className="architectContextTitle">3D Workspace</span>
        <span className="architectContextHint">
          {activeModelTool
            ? `Add: ${activeModelTool}`
            : activeUtilityTool === "View"
              ? "That Open navigation active"
              : "That Open selection and snap tools"}
        </span>
        <div className="architectViewPills" aria-label="View status">
          <span>That Open</span>
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
                <span className="architectQuickIcon" aria-hidden="true">
                  G
                </span>
                <span>
                  <strong>Grid</strong>
                  <small>Plan axes</small>
                </span>
              </button>
              <button type="button" onClick={openLevels}>
                <span className="architectQuickIcon" aria-hidden="true">
                  L
                </span>
                <span>
                  <strong>Levels</strong>
                  <small>Elevations</small>
                </span>
              </button>
              {utilityTools.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  className={activeUtilityTool === tool ? "active" : ""}
                  onPointerDown={() => {
                    setActiveUtilityTool(tool);
                    setActiveModelTool(null);
                  }}
                  onClick={() => runUtilityTool(tool)}
                >
                  <span className="architectQuickIcon" aria-hidden="true">
                    {tool === "Copy" ? "CP" : tool === "Move" ? "MV" : tool[0]}
                  </span>
                  <span>
                    <strong>{tool}</strong>
                    <small>{utilityDescription(tool)}</small>
                  </span>
                </button>
              ))}
            </div>
            <ViewportDisplayOptionsV05 />
          </aside>
        ) : null}

        <div className="architectViewportColumn">
          <div className="architectViewportStage">
            <div className="engineeringEditorStage">
              <StructuralEditorV05 />
            </div>
          </div>
          <div className="architectStatusbar" role="status" aria-live="polite">
            <span>
              <strong>Utility:</strong> {activeUtilityTool}
            </span>
            <span className="architectStatusDivider" aria-hidden="true">
              |
            </span>
            <span>
              <strong>Add:</strong> {activeModelTool ?? "None"}
            </span>
            <span className="architectStatusDivider" aria-hidden="true">
              |
            </span>
            <span>
              <strong>Mode:</strong> {mode === "advanced" ? "Advanced" : "Simple"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
