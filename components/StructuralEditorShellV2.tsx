"use client";

import { useEffect, useRef, useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";

type WorkspaceMode = "simple" | "advanced";
type ModelingTool = "Column" | "Beam" | "Brace" | "Slab" | "Wall";
type UtilityTool = "Select" | "View" | "Move" | "Copy" | "Delete";

const modelingTools: ModelingTool[] = ["Column", "Beam", "Brace", "Slab", "Wall"];
const utilityTools: Array<{ label: UtilityTool; disabled?: boolean }> = [
  { label: "Select" },
  { label: "View" },
  { label: "Move", disabled: true },
  { label: "Copy" },
  { label: "Delete" },
];

function clickEditorButton(label: string): boolean {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".engineeringEditorStage .toolbar button"),
  ).find((item) => item.textContent?.trim() === label);

  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function openGrid(): void {
  window.dispatchEvent(new Event("linkoteq:grid-panel-open"));
}

function openLevels(): void {
  window.dispatchEvent(new Event("linkoteq:levels-panel-open"));
}

export default function StructuralEditorShellV2() {
  const [mode, setMode] = useState<WorkspaceMode>("simple");
  const [activeModelTool, setActiveModelTool] = useState<ModelingTool | null>(null);
  const [activeUtilityTool, setActiveUtilityTool] = useState<UtilityTool>("Select");
  const copyFocusPending = useRef(false);

  useEffect(() => {
    if (!copyFocusPending.current || mode !== "advanced") return;
    copyFocusPending.current = false;

    window.setTimeout(() => {
      const copyHeading = Array.from(
        document.querySelectorAll<HTMLElement>(".engineeringEditorStage .panelBlock h3"),
      ).find((item) => item.textContent?.trim() === "Copy");
      copyHeading?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }, [mode]);

  function runModelTool(tool: ModelingTool): void {
    if (clickEditorButton(tool)) {
      setActiveModelTool(tool);
      setActiveUtilityTool("Select");
    }
  }

  function runUtilityTool(tool: UtilityTool): void {
    if (tool === "Move") return;

    if (tool === "Copy") {
      copyFocusPending.current = true;
      setMode("advanced");
      setActiveUtilityTool("Copy");
      setActiveModelTool(null);
      return;
    }

    if (tool === "Select") {
      clickEditorButton("Select");
      setActiveUtilityTool("Select");
      setActiveModelTool(null);
      return;
    }

    if (tool === "Delete") {
      clickEditorButton("Delete selected");
      setActiveUtilityTool("Delete");
      return;
    }

    setActiveUtilityTool("View");
    setActiveModelTool(null);
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

      <nav className="architectToolstrip" aria-label="Add structural elements">
        {modelingTools.map((tool) => (
          <button
            key={tool}
            type="button"
            className={activeModelTool === tool ? "active" : ""}
            onClick={() => runModelTool(tool)}
          >
            <span className="architectToolIcon" aria-hidden="true">{tool.slice(0, 2)}</span>
            <span>{tool}</span>
          </button>
        ))}
      </nav>

      <div className="architectContextbar">
        <span className="architectContextTitle">3D Workspace</span>
        <span className="architectContextHint">
          {activeModelTool ? `Add: ${activeModelTool}` : "Model setup and drawing tools"}
        </span>
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

              {utilityTools.map((record) => (
                <button
                  key={record.label}
                  type="button"
                  className={activeUtilityTool === record.label ? "active" : ""}
                  disabled={record.disabled}
                  onClick={() => runUtilityTool(record.label)}
                >
                  <span className="architectQuickIcon" aria-hidden="true">
                    {record.label === "Copy" ? "CP" : record.label[0]}
                  </span>
                  <span>
                    <strong>{record.label}</strong>
                    <small>
                      {record.label === "Select"
                          ? "Pick objects"
                          : record.label === "View"
                            ? "Navigate"
                            : record.label === "Copy"
                              ? "Duplicate selection"
                              : record.label === "Delete"
                                ? "Remove selection"
                                : "Coming next"}
                    </small>
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
