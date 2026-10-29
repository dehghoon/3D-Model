"use client";

import { useEffect, useState } from "react";
import StructuralEditorV05 from "./StructuralEditorV05";
import SimpleFrameModeler from "./SimpleFrameModeler";
import { createSimpleFrame, DEFAULT_FRAME } from "../lib/simple-frame";
import type { StructuralModel } from "@linkoteq/structural-core";
import ViewportDisplayOptionsV05 from "./ViewportDisplayOptionsV05";

import { MODELING_COMMAND_EVENT, SURFACE_FINISH_EVENT, UTILITY_COMMAND_EVENT, usePointToolState } from "../lib/editor/member-draw-events";
import { useInteractionState } from "../lib/editor/interaction-store";
import { usePublishedSelections } from "../lib/editor/selection-store";

type WorkspaceMode = "simple" | "advanced";
type ModelingTool = "Column" | "Beam" | "Brace" | "Slab" | "Wall";
type UtilityTool = "Select" | "View" | "Move" | "Copy" | "Delete";

const modelingTools: ModelingTool[] = ["Column", "Beam", "Brace", "Slab", "Wall"];
const utilityTools: UtilityTool[] = ["Select", "View", "Move", "Copy", "Delete"];

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
  const [mobilePanel, setMobilePanel] = useState<"tools" | "setup" | "display" | "project" | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>("simple");
  const [model, setModel] = useState<StructuralModel>(() => createSimpleFrame(DEFAULT_FRAME));
  function switchMode(next: WorkspaceMode) {
    window.dispatchEvent(new Event("linkoteq:modeling-cancel"));
    window.dispatchEvent(new Event("linkoteq:view-select"));
    setMobilePanel(null);
    setMode(next);
  }
  function advancedChange(next: StructuralModel) {
    const metadata = { ...next.project.metadata };
    delete metadata.simpleFrame;
    setModel({ ...next, project: { ...next.project, metadata } });
  }
  const pointState = usePointToolState();
  const interaction = useInteractionState();
  const selections = usePublishedSelections();
  const activeModelTool = pointState.tool ? `${pointState.tool[0].toUpperCase()}${pointState.tool.slice(1)}` as ModelingTool : null;
  const [activeUtilityTool, setActiveUtilityTool] = useState<UtilityTool>("Select");

  useEffect(() => {
    const active = (event: Event) => setActiveUtilityTool((event as CustomEvent<UtilityTool>).detail);
    const select = () => setActiveUtilityTool("Select");
    window.addEventListener("linkoteq:utility-active", active);
    window.addEventListener("linkoteq:view-select", select);
    return () => { window.removeEventListener("linkoteq:utility-active", active); window.removeEventListener("linkoteq:view-select", select); };
  }, []);
  useEffect(() => {
    const close = () => setMobilePanel(null);
    window.addEventListener("linkoteq:properties-open", close);
    window.addEventListener("linkoteq:grid-panel-open", close);
    window.addEventListener("linkoteq:levels-panel-open", close);
    return () => {
      window.removeEventListener("linkoteq:properties-open", close);
      window.removeEventListener("linkoteq:grid-panel-open", close);
      window.removeEventListener("linkoteq:levels-panel-open", close);
    };
  }, []);
  function toggleMobilePanel(panel: "tools" | "setup" | "display" | "project") {
    window.dispatchEvent(new Event("linkoteq:mobile-panel-open"));
    setMobilePanel(current => current === panel ? null : panel);
  }
  function finishSurface(): void { window.dispatchEvent(new Event(SURFACE_FINISH_EVENT)); }
  function runModelTool(tool: ModelingTool): void {
    window.dispatchEvent(new CustomEvent(MODELING_COMMAND_EVENT, { detail: tool.toLowerCase() }));
  }
  function runUtilityTool(tool: UtilityTool): void {
    window.dispatchEvent(new CustomEvent(UTILITY_COMMAND_EVENT, { detail: tool }));
    setActiveUtilityTool(tool);
  }

  return (
    <div className={`architectEditorShell mobile-panel-${mobilePanel ?? "closed"} mode-${mode} ${activeModelTool || interaction.mode !== "select" ? "has-active-point-tool" : ""}`}>
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
            onClick={() => switchMode("simple")}
          >
            Simple Mode
          </button>
          <button
            type="button"
            className={mode === "advanced" ? "active" : ""}
            onClick={() => switchMode("advanced")}
          >
            Advanced Mode
          </button>
        </div>
        {mode === "advanced" ? <div className="architectTopActions" aria-label="Project actions">
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
        : <span className="sfTopBadge">Automatic frame · SI / m</span>}
      </header>

      {mode === "advanced" ? <>
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
        {activeModelTool === "Slab" || activeModelTool === "Wall" ? (
          <button type="button" onClick={finishSurface}>Finish {activeModelTool}</button>
        ) : null}
        {mode === "advanced" ? utilityTools.map(tool => <button key={tool} type="button" onClick={() => runUtilityTool(tool)}>{tool}</button>) : null}
        {selections.length ? <button type="button" onClick={() => window.dispatchEvent(new Event("linkoteq:properties-open"))}>Properties ({selections.length})</button> : null}
      </nav>

      <div className="architectContextbar">
        <span className="architectContextTitle">3D Workspace</span>
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

      <div className="advancedMobileControls" aria-label="Mobile viewport tools">
        <button type="button" onClick={() => {runUtilityTool("Select"); window.dispatchEvent(new Event("linkoteq:view-select"));}}>Select</button>
        <button type="button" onClick={() => {runUtilityTool("View"); window.dispatchEvent(new Event("linkoteq:view-cycle"));}}>Orbit</button>
        <select aria-label="Mobile view" defaultValue="3d" onChange={event => window.dispatchEvent(new CustomEvent("linkoteq:view-preset", {detail:event.target.value}))}>
          <option value="3d">3D</option><option value="bottom">Bottom</option><option value="front">Front</option><option value="right">Right</option>
        </select>
        <button type="button" onClick={() => toggleMobilePanel("display")}>Display</button>
        <button type="button" onClick={() => window.dispatchEvent(new Event("linkoteq:view-fit"))}>Fit</button>
      </div>
      <div className="architectWorkspaceFrame">
        {mode === "advanced" ? (
          <aside className="architectQuickPanel" aria-label="Setup and quick tools">
            <button type="button" className="advancedSheetClose" aria-label="Collapse panel" onClick={() => setMobilePanel(null)}>⌄ Close</button>
            <div className="architectPanelHeading">
              <div>
                <span className="architectEyebrow">MODEL</span>
                <h2>Setup &amp; Tools</h2>
              </div>
              <span className="architectPanelBadge">Advanced</span>
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
            <div className="advancedDisplayContent"><ViewportDisplayOptionsV05 /></div>
            <div className="advancedToolContent">{modelingTools.map(tool => <button type="button" key={tool} onClick={() => {runModelTool(tool); setMobilePanel(null);}}>{tool}</button>)}
            {utilityTools.map(tool => <button type="button" key={tool} onClick={() => {runUtilityTool(tool); setMobilePanel(null);}}>{tool}</button>)}
            {activeModelTool === "Slab" || activeModelTool === "Wall" ? <button type="button" onClick={finishSurface}>Finish {activeModelTool}</button> : null}
            <button type="button" disabled={!selections.length} onClick={() => window.dispatchEvent(new Event("linkoteq:properties-open"))}>Properties ({selections.length})</button></div>
            <div className="advancedProjectContent">{(["New", "Open", "Save"] as const).map(action => <button type="button" key={action} onClick={() => clickProjectAction(action)}>{action} project</button>)}</div>
          </aside>
        ) : null}

        <div className="architectViewportColumn">
          <div className="architectViewportStage">
            <div className="engineeringEditorStage">
              <StructuralEditorV05 model={model} onModelChange={advancedChange} />
            </div>
          </div>
          <div className="architectStatusbar" role="status" aria-live="polite">
            <span>
              <strong>Utility:</strong> {interaction.operation ?? activeUtilityTool} · {selections.length} selected
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
      <nav className="advancedMobileTabs" aria-label="Advanced mobile panels">
        {([ ["setup", "Plan & levels"], ["tools", "Members & tools"], ["project", "Project"] ] as const).map(([panel, label]) => <button type="button" key={panel} aria-expanded={mobilePanel === panel} onClick={() => toggleMobilePanel(panel)}>{label}</button>)}
      </nav>
      </> : <SimpleFrameModeler model={model} onChange={setModel} onAdvanced={() => switchMode("advanced")} />}
    </div>
  );
}
