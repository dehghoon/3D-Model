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

function activateModelTool(
  label: "Select" | "Beam" | "Column" | "Brace" | "Wall" | "Slab",
): boolean {
  return clickExistingButton(".engineeringEditorStage .toolbar", label);
}

export default function StructuralEditor() {
  const [mode, setMode] = useState<WorkspaceMode>("simple");
  const [activeModelTool, setActiveModelTool] = useState<ModelingTool | null>(null);
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
      { id: "grid", label: "Grid", short: "G", action: () => true },
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
    if (command.action()) {
      setActiveUtilityTool(command.id);
      if (command.id === "select" || command.id === "view") setActiveModelTool(null);
    }
  }

  const utilityLabel =
    [...utilityTools, ...floatingTools].find((item) => item.id === activeUtilityTool)?.label ??
    "Select";

  const modelLabel =
    activeModelTool
      ? modelingTools.find((item) => item.id === activeModelTool)?.label ?? "None"
      : "None";

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
        <span className="architectContextHint">Add: {modelLabel} Â· Utility: {utilityLabel}</span>
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
                  key={command.id }
                  type="button"
                  className={activeUtilityTool === command.id ? "active" : ""}
                  onClick={() => runUtilityCommand(command)}
                  disabled={command.disabled}
                  title={command.title}
                >
                  <span className="architectQuickIcon">{command.short}</span>
                  <span#à¢Ç7G&öæsç¶6öÖÖæBæÆ&VÇÓÂ÷7G&öæsà¢Ç6ÖÆÃà¢¶6öÖÖæBæ–BÓÓÒ'6VÆV7B ¢ò%–6²âö&¦V7B ¢¢6öÖÖæBæ–BÓÓÒ'f–Wr ¢ò$æf–vFRF†RÖöFVÂ ¢¢6öÖÖæBæ–BÓÓÒ&FVÆWFR ¢ò%&VÖ÷fR6VÆV7F–öâ ¢¢$6öÖ–æræW‡B'Ð¢Â÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’—Ð¢ÂöF—cà¢Âö6–FSà¢’¢çVÆÇÐ ¢ÆF—b6Æ74æÖSÒ&&6†—FV7Ef–Ww÷'D6öÇVÖâ#à¢ÆF—b6Æ74æÖSÒ&&6†—FV7Ef–Ww÷'E7FvR#à¢ÆF—b6Æ74æÖSÒ&Væv–æVW&–ætVF—F÷%7FvR#à¢Å7G'V7GW&ÄVF—F÷%cP¢v÷&·76TÖöFS×¶ÖöFWÐ¢7F—fTÖöFVÅFööÃ×¶7F—fTÖöFVÅFööÇÐ¢öä6Æ÷6T6öçFW‡EæVÃ×²‚’Óâ6WD7F—fTÖöFVÅFööÂ†çVÆÆ—Ð¢óà¢ÂöF—cà ¢¶ÖöFRÓÓÒ'6–×ÆR"bb7F—fTÖöFVÅFööÂÓÒ&w&–B"ò€¢ÆF—b6Æ74æÖSÒ&&6†—FV7DfÆöF–æuFööÇ2"&–ÖÆ&VÃÒ%f–Ww÷'BFööÇ2#à¢¶fÆöF–æuFööÇ2æÖ‚†6öÖÖæB’Óâ€¢Æ'WGFöà¢¶W“×¶6öÖÖæBæ–GÐ¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶7F—fUWF–Æ—G•FööÂÓÓÒ6öÖÖæBæ–Bò&7F—fR"¢"'Ð¢öä6Æ–6³×²‚’Óâ'VåWF–Æ—G”6öÖÖæB†6öÖÖæB—Ð¢F—6&ÆVC×¶6öÖÖæBæF—6&ÆVGÐ¢F—FÆS×¶6öÖÖæBçF—FÆWÐ¢à¢Ç7â6Æ74æÖSÒ&&6†—FV7DfÆöF–æt–6öâ"&–Ö†–FFVãÒ'G'VR#ç¶6öÖÖæBç6†÷'GÓÂ÷7ãà¢Ç7â>{command.label}</span>
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
  </div>
  );
}
