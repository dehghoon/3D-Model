"use client";

import { useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";

type WorkspaceMode = "simple" | "advanced";

type QuickCommand = {
  id: string;
  label: string;
  short: string;
  action: () => boolean;
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

function clickFirst(selector: string): boolean {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return false;
  element.click();
  return true;
}

function revealToolPanel(title: string): boolean {
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>(".engineeringEditorStage .toolbar h3"),
  );
  const heading = headings.find((item) => item.textContent?.trim() === title);
  const panel = heading?.closest<HTMLElement>(".panelBlock, section");
  if (!panel) return false;

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
  const [activeCommand, setActiveCommand] = useState("select");

  const commands: QuickCommand[] = [
    { id: "select", label: "Select", short: "S", action: () => activateModelTool("Select") },
    { id: "grid", label: "Grid", short: "G", action: () => revealToolPanel("Levels / Grids") },
    { id: "column", label: "Column", short: "C", action: () => activateModelTool("Column") },
    { id: "beam", label: "Beam", short: "B", action: () => activateModelTool("Beam") },
    { id: "brace", label: "Brace", short: "BR", action: () => activateModelTool("Brace") },
    { id: "slab", label: "Slab", short: "SL", action: () => activateModelTool("Slab") },
    { id: "wall", label: "Wall", short: "W", action: () => activateModelTool("Wall") },
    { id: "support", label: "Support", short: "SP", action: () => revealToolPanel("Node Support") },
    { id: "loads", label: "Loads", short: "L", action: () => clickFirst(".loadManagerLauncher") },
  ];

  function runCommand(command: QuickCommand) {
    if (command.action()) setActiveCommand(command.id);
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
          <button type="button" className={mode === "simple" ? "active" : ""} onClick={() => setMode("simple")}>
            Simple Mode
          </button>
          <button type="button" className={mode === "advanced" ? "active" : ""} onClick={() => setMode("advanced")}>
            Advanced Mode
          </button>
        </div>

        <div className="architectTopActions">
          <button type="button" onClick={() => clickExistingButton(".topActions", "Save")}>Save</button>
          <button type="button" disabled title="Analysis will be connected in a later stage.">Analyze</button>
        </div>
      </header>

      <nav className="architectToolstrip" aria-label="Modeling tools">
        {commands.map((command) => (
          <button
            key={command.id}
            type="button"
            className={activeCommand === command.id ? "active" : ""}
            onClick={() => runCommand(command)}
          >
            <span className="architectToolIcon" aria-hidden="true">{command.short}</span>
            <span>{command.label}</span>
          </button>
        ))}
      </nav>

      <div className="architectContextbar">
        <span className="architectContextTitle">3D Workspace</span>
        <span className="architectContextHint">
          {activeCommand === "select"
            ? "Select an object to inspect and edit its properties."
            : `${commands.find((item) => item.id === activeCommand)?.label ?? "Tool"} tool active.`}
        </span>
        <div className="architectViewPills" aria-label="View status">
          <span>Perspective</span>
          <span>Snap: ON</span>
        </div>
      </div>

      <div className="engineeringEditorStage">
        <StructuralEditorV05 />
      </div>
    </div>
  );
}
