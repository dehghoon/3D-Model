"use client";

import { useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";

type RibbonTabId =
  | "file"
  | "geometry"
  | "view"
  | "select"
  | "specification"
  | "loading"
  | "analysis"
  | "utilities";

type RibbonItem = {
  id: string;
  label: string;
  action?: () => void;
  disabled?: boolean;
};

type RibbonGroup = {
  title: string;
  items: RibbonItem[];
};

const tabs: Array<{ id: RibbonTabId; label: string }> = [
  { id: "file", label: "File" },
  { id: "geometry", label: "Geometry" },
  { id: "view", label: "View" },
  { id: "select", label: "Select" },
  { id: "specification", label: "Specification" },
  { id: "loading", label: "Loading" },
  { id: "analysis", label: "Analysis and Design" },
  { id: "utilities", label: "Utilities" },
];

function findButton(containerSelector: string, label: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(`${containerSelector} button`),
  ).find((button) => button.textContent?.trim() === label);
}

function clickExistingButton(containerSelector: string, label: string) {
  const button = findButton(containerSelector, label);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function clickFirst(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return false;
  element.click();
  return true;
}

function revealToolbarPanel(title: string) {
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

function activateModelTool(label: "Select" | "Beam" | "Column" | "Brace" | "Wall" | "Slab") {
  return clickExistingButton(".engineeringEditorStage .toolbar", label);
}

export default function StructuralEditor() {
  const [activeTab, setActiveTab] = useState<RibbonTabId>("geometry");

  const groups: Record<RibbonTabId, RibbonGroup[]> = {
    file: [
      {
        title: "Project",
        items: [
          { id: "new", label: "New", action: () => clickExistingButton(".topActions", "New") },
          { id: "open", label: "Open", action: () => clickExistingButton(".topActions", "Open") },
          { id: "save", label: "Save", action: () => clickExistingButton(".topActions", "Save") },
        ],
      },
    ],
    geometry: [
      {
        title: "Create",
        items: [
          { id: "node", label: "Node", action: () => revealToolbarPanel("Create Node") },
          { id: "beam", label: "Beam", action: () => activateModelTool("Beam") },
          { id: "column", label: "Column", action: () => activateModelTool("Column") },
          { id: "brace", label: "Brace", action: () => activateModelTool("Brace") },
          { id: "wall", label: "Wall", action: () => activateModelTool("Wall") },
          { id: "slab", label: "Slab", action: () => activateModelTool("Slab") },
        ],
      },
      {
        title: "Model Setup",
        items: [
          { id: "levels", label: "Levels", action: () => revealToolbarPanel("Levels / Grids") },
          { id: "grids", label: "Grids", action: () => revealToolbarPanel("Levels / Grids") },
          { id: "sections", label: "CISC Sections", action: () => revealToolbarPanel("CISC W Sections") },
        ],
      },
    ],
    view: [
      {
        title: "Navigation",
        items: [
          { id: "orbit", label: "Orbit", disabled: true },
          { id: "pan", label: "Pan", disabled: true },
          { id: "zoom", label: "Zoom", disabled: true },
        ],
      },
    ],
    select: [
      {
        title: "Selection",
        items: [
          { id: "select-tool", label: "Select", action: () => activateModelTool("Select") },
          {
            id: "clear-selection",
            label: "Clear Selection",
            action: () => clickExistingButton(".engineeringEditorStage .toolbar", "Clear selection"),
          },
        ],
      },
    ],
    specification: [
      {
        title: "Definitions",
        items: [
          { id: "sections", label: "CISC Sections", action: () => revealToolbarPanel("CISC W Sections") },
          { id: "levels-spec", label: "Levels", action: () => revealToolbarPanel("Levels / Grids") },
          { id: "grids-spec", label: "Grids", action: () => revealToolbarPanel("Levels / Grids") },
        ],
      },
      {
        title: "Assignments",
        items: [
          { id: "supports", label: "Supports", action: () => revealToolbarPanel("Support") },
        ],
      },
    ],
    loading: [
      {
        title: "Loading",
        items: [
          { id: "load-manager", label: "Load Manager", action: () => clickFirst(".loadManagerLauncher") },
          { id: "load-items", label: "Load Items", action: () => clickFirst(".loadManagerLauncher") },
          { id: "load-cases", label: "Load Cases", action: () => clickFirst(".loadManagerLauncher") },
          { id: "combinations", label: "Combinations", action: () => clickFirst(".loadManagerLauncher") },
        ],
      },
      {
        title: "Load Generation",
        items: [
          { id: "snow", label: "Snow Load", action: () => clickFirst(".loadManagerLauncher") },
          { id: "wind", label: "Wind Load", disabled: true },
          { id: "seismic", label: "Seismic", disabled: true },
        ],
      },
    ],
    analysis: [
      {
        title: "Analysis",
        items: [
          { id: "analysis-run", label: "Run Analysis", disabled: true },
          { id: "analysis-results", label: "Results", disabled: true },
        ],
      },
      {
        title: "Design",
        items: [
          { id: "design", label: "Design Check", disabled: true },
          { id: "design-results", label: "Design Results", disabled: true },
        ],
      },
    ],
    utilities: [
      {
        title: "Utilities",
        items: [
          { id: "export-json", label: "Export JSON", action: () => clickExistingButton(".topActions", "Save") },
          { id: "loads", label: "Loads", action: () => clickFirst(".loadManagerLauncher") },
        ],
      },
    ],
  };

  return (
    <div className={`engineeringRibbonHost ribbonTab-${activeTab}`}>
      <section className="engineeringRibbon" aria-label="Engineering application ribbon">
        <div className="ribbonTitleRow">
          <strong>Linkoteq 3D Structural Editor</strong>
          <span>Core schema 0.5</span>
        </div>

        <nav className="ribbonTabs" aria-label="Application menu">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "ribbonTab active" : "ribbonTab"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
           ))}
        </nav>

        <div className="ribbonPanel" role="region" aria-label={`${activeTab} commands`}>
          {groups[activeTab].map((group) => (
            <section key={group.title} className="ribbonGroup">
              <div className="ribbonGroupCommands">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="ribbonCommand"
                    disabled={item.disabled}
                    onClick={item.action}
                    title={
                      item.disabled
                        ? "This command is not connected in the current repository yet."
                        : item.label
                    }
                  >
                    <span className="ribbonCommandIcon" aria-hidden="true">
                      {item.label.slice(0, 1)}
                    </span>
                    <span>{item.label}</span>
                  </button>
                 ))}
              </div>
              <div className="ribbonGroupTitle">{group.title}</div>
            </section>
          ))}
        </div>
      </section>

      <div className="engineeringEditorStage">
        <StructuralEditorV05 />
      </div>
    </div>
  );
}
