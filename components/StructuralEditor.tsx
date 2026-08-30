"use client";

import { useEffect, useMemo, useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";

type WorkspaceMode = "simple" | "advanced";
type UtilityTool = "select" | "view" | "move" | "copy" | "delete" | "orbit" | "measure";
type ModelingTool = "grid" | "column" | "beam" | "brace" | "slab" | "wall";

type ToolCommand<T extends string> = {
  id: T;
  label: string;
  short: string;
  action: () => boolean;
  disabled?: boolean;
  title?: string;
};

function findButton(containerSelector: string, label: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(`${containerSelector} button`),
  ).find((button) => button.textContent?.trim() === label);
}

function clickExistingButton(containerSelector: string, label: string): boolean {
  const button = findButton(containerSelector, label);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function revealToolPanel(title: string): boolean {
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>(".engineeringEditorStage .toolbar h3"),
  );
  const heading = headings.find((item) => item.textContent?.trim() === title);
  const panel = heading?.closest<HTMLElement>(".panelBlock, section");
  if (!panel) return false;

  panel.classList.add("architect-revealed-panel");
  panel.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  const input = panel.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
  window.setTimeout(() => input?.focus(), 120);
  return true;
}

function activateModelTool(
  label: "Select" | "Beam" | "Column" | "Brace" | "Wall" | "Slab",
): boolean {
  return clickExistingButton(".engineeringEditorStage .toolbar", label);
}

export default function StructuralEditor() {
  const [mode, setMode] = useState<WorkspaceMode>("simple");
  const [activeModelTool, setActiveModelTool] = useState<ModelingTool>("grid");
  const [activeUtilityTool, setActiveUtilityTool] = useState<UtilityTool>("select");
  const [selectionLabel, setSelectionLabel] = useState("No object selected");

  useEffect(() => {
    const root = document.querySelector(".engineeringEditorStage");
    if (!root) return;

    const syncSelection = () => {
      const value =
        root.querySelector<HTMLElement>(".inspector .selectionText")?.textContent?.trim() ||
        "No object selected";
      setSelectionLabel(value);
    };

    syncSelection();
    const observer = new MutationObserver(syncSelection);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const modelingTools = useMemo<ToolCommand<ModelingTool>[]>(
    () => [
      { id: "grid", label: "Grid", short: "G", action: () => revealToolPanel("Levels / Grids") },
      { id: "column", label: "Column", short: "C", action: () => activateModelTool("Column") },
      { id: "beam", label: "Beam", short: "B", action: () => activateModelTool("Beam") },
      { id: "brace", label: "Brace", short: "BR", action: () => activateModelTool("Brace") },
      { id: "slab", label: "Slab", short: "SL", action: () => activateModelTool("Slab") },
      { id: "wall", label: "Wall", short: "W", action: () => activateModelTool("Wall") },
    ],
    [],
  );

  const utilityTools = useMemo<ToolCommand<UtilityTool>[]>(
    () => [
      { id: "select", label: "Select", short: "S", action: () => activateModelTool("Select") },
      { id: "view", label: "View", short: "V", action: () => true, title: "Use orbit, pan, and zoom in the 3D workspace." },
      { id: "move", label: "Move", short: "M", action: () => false, disabled: true, title: "Move will be connected to the modeling command service." },
      { id: "copy", label: "Copy", short: "CP", action: () => false, disabled: true, title: "Copy will be connected to the modeling command service." },
      { id: "delete", label: "Delete", short: "D", action: () => clickExistingButton(".engineeringEditorStage .toolbar", "Delete selected") },
    ],
    [],
  );

  const floatingTools = useMemo<ToolCommand<UtilityTool>[]>(
    () => [
      { id: "select", label: "Select", short: "S", action: () => activateModelTool("Select") },
      { id: "move", label: "Move", short: "M", action: () => false, disabled: true, title: "Move will be enabled after the move command service is complete." },
      { id: "orbit", label: "Orbit", short: "O", action: () => true, title: "Orbit is available directly in the R3F viewport." },
      { id: "measure", label: "Measure", short: "ME", action: () => false, disabled: true, title: "Measure will be enabled through the visualization adapter." },
    ],
    [],
  );

  function runModelCommand(command: ToolCommand<ModelingTool>) {
    if (command.disabled) return;
    if (command.action()) setActiveModelTool(command.id);
  }

  function runUtilityCommand(command: ToolCommand<UtilityTool>) {
    if (command.disabled) return;
    if (command.action()) setActiveUtilityTool(command.id);
  }

  const utilityLabel =
    [...utilityTools, ...floatingTools].find((item) => item.id === activeUtilityTool)?.label ??
    "Select";
  const modelLabel =
    modelingTools.find((item) => item.id === activeModelTool)?.label ?? "Grid";

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

        <div className="architectTopActions">
          <button type="button" onClick={() => clickExistingButton(".engineeringEditorStage .topActions", "Open")}>Open</button>
          <button type="button" onClick={() => clickExistingButton(".engineeringEditorStage .topActions", "Save")}>Save</button>
          <button type="button" disabled title="Analysis will be connected in the analysis stage.">Analyze</button>
          <button type="button" disabled title="PDF report generation requires the approved report and entitlement workflow.">Report PDF</button>
        </div>
      </header>

      <nav className="architectToolstrip" aria-label="Add model elements">
        {modelingTools.map((command) => (
          <button
            key={command.id}
            type="button"
            className={activeModelTool === command.id ? "active" : ""}
            onClick={() => runModelCommand(command)}
            title={command.title}
          >
            <span className="architectToolIcon" aria-hidden="true">{command.short}</span>
            <span>{command.label}</span>
          </button>
        ))}
      </nav>

      <div className="architectContextbar">
        <span className="architectContextTitle">3D Workspace</span>
        <span className="architectContextHint">Add: {modelLabel} · Utility: {utilityLabel}</span>
        <div className="architectViewPills" aria-label="View status">
          <span>Perspective</span>
          <span>Snap: ON</span>
        </div>
      </div>

      <div className="architectWorkspaceFrame">
        {mode === "simple" ? (
          <aside className="architectQuickPanel">
            <div className="architectPanelHeading">
              <div>
                <span className="architectEyebrow">TOOLS</span>
                <h2>Quick Tools</h2>
              </div>
              <span className="architectPanelBadge">Simple</span>
            </div>

            <div className="architectQuickActions">
              {utilityTools.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  className={activeUtilityTool === command.id ? "active" : ""}
                  onClick={() => runUtilityCommand(command)}
                  disabled={command.disabled}
                  title={command.title}
                >
                  <span className="architectQuickIcon">{command.short}</span>
                  <span>
                    <strong>{command.label}</strong>
                    <small>
                      {command.id === "select"
                        ? "Pick an object"
                        : command.id === "view"
                          ? "Navigate the model"
                          : command.id === "delete"
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

            {mode === "simple" ? (
              <div className="architectFloatingTools" aria-label="Viewport tools">
                {floatingTools.map((command) => (
                  <button
                    key={command.id}
                    type="button"
                    className={activeUtilityTool === command.id ? "active" : ""}
                    onClick={() => runUtilityCommand(command)}
                    disabled={command.disabled}
                    title={command.title}
                  >
                    <span className="architectFloatingIcon" aria-hidden="true">{command.short}</span>
                    <span>{command.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="architectStatusbar" role="status" aria-live="polite">
            <span><strong>Status:</strong> {selectionLabel}</span>
            <span className="architectStatusDivider" aria-hidden="true">|</span>
            <span><strong>Tool:</strong> {utilityLabel}</span>
            <span className="architectStatusDivider" aria-hidden="true">|</span>
            <span><strong>Add:</strong> {modelLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
