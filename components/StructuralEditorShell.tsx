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
          <spanPerspective</span>
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
                <span#ãÇ7G&öæsäÆWfVÇ3Â÷7G&öæsãÇ6ÖÆÃäVÆWfF–öç3Â÷6ÖÆÃãÂ÷7ãà¢Âö'WGFöãà ¢·WF–Æ—G•FööÇ2æÖ‚‡FööÂ’Óâ€¢Æ'WGFöâ¶W“×·FööÂæ–GÒG—SÒ&'WGFöâ"6Æ74æÖS×¶7F—fUWF–Æ—G•FööÂÓÓÒFööÂæ–Bò&7F—fR"¢"'Òöä6Æ–6³×²‚’Óâ'VåWF–Æ—G•FööÂ‡FööÂæ–B—ÒF—6&ÆVC×·FööÂæF—6&ÆVGÓà¢Ç7â6Æ74æÖSÒ&&6†—FV7EV–6´–6öâ"&–Ö†–FFVãÒ'G'VR#ç·FööÂç6†÷'GÓÂ÷7ãà¢Ç7ãà¢Ç7G&öæsç·FööÂæÆ&VÇÓÂ÷7G&öæsà¢Ç6ÖÆÃç·FööÂæ–BÓÓÒ'6VÆV7B"ò%–6²ö&¦V7G2"¢FööÂæ–BÓÓÒ'f–Wr"ò$æf–vFR"¢FööÂæ–BÓÓÒ&FVÆWFR"ò%&VÖ÷fR6VÆV7F–öâ"¢$6öÖ–æræW‡B'ÓÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’—Ð¢ÂöF—cà¢Âö6–FSà¢’¢çVÆÇÐ ¢ÆF—b6Æ74æÖSÒ&&6†—FV7Ef–Ww÷'D6öÇVÖâ#à¢ÆF—b6Æ74æÖSÒ&&6†—FV7Ef–Ww÷'E7FvR#à¢ÆF—b6Æ74æÖSÒ&Væv–æVW&–ætVF—F÷%7FvR#ãÅ7G'V7GW&ÄVF—F÷%cRóãÂöF—cà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&6†—FV7E7FGW6&""&öÆSÒ'7FGW2"&–ÖÆ—fSÒ'öÆ—FR#à¢Ç7ããÇ7G&öæsåWF–Æ—G“£Â÷7G&öæsâ¶7F—fUWF–Æ—G•FööÇÓÂ÷7ãà¢Ç7â6Æ74æÖSÒ&&6†—FV7E7FGW4F—f–FW""&–Ö†–FFVãÒ'G'VR#çÃÂ÷7ãà¢Ç7â><strong>Add:</strong> {activeModelTool ?? "None"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
