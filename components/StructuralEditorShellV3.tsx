"use client";

import { useEffect, useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";
import ViewportDisplayOptionsV05 from "./ViewportDisplayOptionsV05";

import {
  MODELING_COMMAND_EVENT,
  SURFACE_FINISH_EVENT,
  UTILITY_COMMAND_EVENT,
  usePointToolState,
} from "../lib/editor/member-draw-events";
import { useInteractionState } from "../lib/editor/interaction-store";
import { usePublishedSelections } from "../lib/editor/selection-store";

type WorkspaceMode = "simple" | "advanced";
type ModelingTool = "Column" | "Beam" | "Brace" | "Slab" | "Wall";
type UtilityTool = "Select" | "View" | "Move" | "Copy" | "Delete";

const modelingTools: ModelingTool[] = [
  "Column",
  "Beam",
  "Brace",
  "Slab",
  "Wall",
];
const utilityTools: UtilityTool[] = [
  "Select",
  "View",
  "Move",
  "Copy",
  "Delete",
];

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
  const pointState = usePointToolState();
  const interaction = useInteractionState();
  const selections = usePublishedSelections();
  const activeModelTool = pointState.tool
    ? (`${pointState.tool[0].toUpperCase()}${pointState.tool.slice(1)}` as ModelingTool)
    : null;
  const [activeUtilityTool, setActiveUtilityTool] =
    useState<UtilityTool>("View");

  useEffect(() => {
    const active = (event: Event) =>
      setActiveUtilityTool((event as CustomEvent<UtilityTool>).detail);
    const select = () => setActiveUtilityTool("Select");
    window.addEventListener("linkoteq:utility-active", active);
    window.addEventListener("linkoteq:view-select", select);
    return () => {
      window.removeEventListener("linkoteq:utility-active", active);
      window.removeEventListener("linkoteq:view-select", select);
    };
  }, []);
  function finishSurface(): void {
    window.dispatchEvent(new Event(SURFACE_FINISH_EVENT));
  }
  function runModelTool(tool: ModelingTool): void {
    window.dispatchEvent(
      new CustomEvent(MODELING_COMMAND_EVENT, { detail: tool.toLowerCase() }),
    );
  }
  function runUtilityTool(tool: UtilityTool): void {
    window.dispatchEvent(
      new CustomEvent(UTILITY_COMMAND_EVENT, { detail: tool }),
    );
    setActiveUtilityTool(tool);
  }

  return (
    <div
      className={`architectEditorShell mode-${mode} ${activeModelTool || interaction.mode !== "select" ? "has-active-point-tool" : ""}`}
    >
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
            aria-pressed={mode === "simple"}
            onClick={() => {
              window.dispatchEvent(new Event("linkoteq:modeling-cancel"));
              setMode("simple");
            }}
          >
            Simple Mode
          </button>
          <button
            type="button"
            className={mode === "advanced" ? "active" : ""}
            aria-pressed={mode === "advanced"}
            onClick={() => {
              window.dispatchEvent(new Event("linkoteq:modeling-cancel"));
              setMode("advanced");
            }}
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
        {modelingTools
          .filter((tool) => mode === "advanced" || tool !== "Brace")
          .map((tool) => (
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
        {activeModelTool === "Slab" || activeModelTool === "Wall" ? (
          <button type="button" onClick={finishSurface}>
            Finish {activeModelTool}
          </button>
        ) : null}
        {mode === "advanced"
          ? utilityTools.map((tool) => (
              <button
                key={tool}
                type="button"
                onClick={() => runUtilityTool(tool)}
              >
                {tool}
              </button>
            ))
          : null}
        {selections.length ? (
          <button
            type="button"
            onClick={() => {
              if (mode === "simple") {
                window.dispatchEvent(new Event("linkoteq:modeling-cancel"));
                setMode("advanced");
              }
              window.dispatchEvent(new Event("linkoteq:properties-open"));
            }}
          >
            {mode === "simple" ? "Edit in Advanced" : "Properties"} (
            {selections.length})
          </button>
        ) : null}
      </nav>

      <div className="architectContextbar">
        <span className="architectContextTitle">
          {mode === "simple" ? "Building workspace" : "3D Workspace"}
        </span>
        <span className="architectContextHint">
          {activeModelTool
            ? activeModelTool === "Slab" || activeModelTool === "Wall"
              ? `Add: ${activeModelTool} · Pick boundary points in order, then Finish`
              : `Add: ${activeModelTool}`
            : activeUtilityTool === "View"
              ? "Orbit / pan / zoom"
              : interaction.message}
        </span>
        <div className="architectViewPills" aria-label="View status">
          <span>That Open</span>
          <span>Snap: ON</span>
        </div>
      </div>

      <div className="architectWorkspaceFrame">
        {mode === "simple" ? (
          <aside
            className="architectQuickPanel"
            aria-label="Setup and quick tools"
          >
            <div className="architectPanelHeading">
              <div>
                <span className="architectEyebrow">MODEL</span>
                <h2>Build your model</h2>
              </div>
              <span className="architectPanelBadge">
                {mode === "simple" ? "Simple" : "Advanced"}
              </span>
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
                  <small>Floors and heights</small>
                </span>
              </button>
              {utilityTools.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  className={activeUtilityTool === tool ? "active" : ""}
                  data-utility-command={tool}
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
            <details>
              <summary>Display options</summary>
              <ViewportDisplayOptionsV05 />
            </details>
          </aside>
        ) : null}

        <div className="architectViewportColumn">
          <div className="architectViewportStage">
            <div className="engineeringEditorStage">
              <StructuralEditorV05 mode={mode} />
            </div>
          </div>
          <div className="architectStatusbar" role="status" aria-live="polite">
            <span>
              <strong>Utility:</strong>{" "}
              {interaction.operation ?? activeUtilityTool} · {selections.length}{" "}
              selected
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
              <strong>Mode:</strong>{" "}
              {mode === "advanced" ? "Advanced" : "Simple"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
