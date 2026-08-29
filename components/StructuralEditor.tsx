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

function clickExistingButton(containerSelector: string, label: string) {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(`${containerSelector} button`),
  );
  buttons.find((button) => button.textContent?.trim() === label)?.click();
}

function clickFirst(selector: string) {
  document.querySelector<HTMLElement>(selector)?.click();
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
        title: "Model Geometry",
        items: [
          { id: "model-tools", label: "Model Tools" },
          { id: "node", label: "Node" },
          { id: "member", label: "Member" },
          { id: "surface", label: "Surface" },
          { id: "support", label: "Support" },
        ],
      },
      {
        title: "Editing",
        items: [
          { id: "levels", label: "Levels" },
          { id: "grids", label: "Grids" },
        ],
      },
    ],
    view: [
      {
        title: "Navigation",
        items: [
          { id: "orbit", label: "Orbit" },
          { id: "pan", label: "Pan" },
          { id: "zoom", label: "Zoom" },
        ],
      },
      {
        title: "Display",
        items: [
          { id: "model-view", label: "3D View" },
          { id: "fit-view", label: "Fit View", disabled: true },
        ],
      },
    ],
    select: [
      {
        title: "Selection",
        items: [
          { id: "node-selection", label: "Nodes" },
          { id: "member-selection", label: "Members" },
          { id: "surface-selection", label: "Surfaces" },
          { id: "clear-selection", label: "Clear Selection", action: () => clickExistingButton(".toolbar", "Clear selection") },
        ],
      },
    ],
    specification: [
      {
        title: "Definitions",
        items: [
          { id: "materials", label: "Materials", disabled: true },
          { id: "sections", label: "Sections", disabled: true },
          { id: "levels-spec", label: "Levels" },
          { id: "grids-spec", label: "Grids" },
        ],
      },
      {
        title: "Assignments",
        items: [
          { id: "supports-spec", label: "Supports" },
          { id: "releases", label: "Releases", disabled: true },
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
          { id: "analysis-cases", label: "Analysis Cases", disabled: true },
          { id: "results", label: "Results", disabled: true },
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
          { id: "loads-utility", label: "Loads", action: () => clickFirst(".loadManagerLauncher") },
          { id: "model-json", label: "Model JSON", disabled: true },
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
