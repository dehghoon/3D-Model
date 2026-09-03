"use client";

import { ChangeEvent, useRef, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";

import ElementProperties from "./ElementProperties";
import LoadManager from "./LoadManager";
import ModelToolsV05 from "./ModelToolsV05";
import NodeCreatorV05 from "./NodeCreatorV05";
import SelectedNodeSupportV05 from "./SelectedNodeSupportV05";
import ThatOpenViewportV01 from "./ThatOpenViewportV01";
import { assertCanonicalV05, migrateProjectToV05 } from "../lib/core-v05";
import { deleteSelection } from "../lib/editor/commands";
import {
  clearSelection,
  createSelection,
  getSelectionLabel,
  reconcileSelection,
  type EditorSelection,
} from "../lib/editor/selection";
import {
  getPublishedSelections,
  publishSelection,
  publishSelections,
  usePublishedSelections,
} from "../lib/editor/selection-store";

type ConcreteSelection = Exclude<EditorSelection, null>;

function emptyModel(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "PROJECT001", name: "3D Model", units: "SI" },
    levels: [],
    grids: [],
    nodes: [],
    members: [],
    surfaces: [],
    diaphragms: [],
    materials: [],
    sections: [],
    supports: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
  };
}

function downloadModel(model: StructuralModel): void {
  assertCanonicalV05(model);
  const blob = new Blob([JSON.stringify(model, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${model.project.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function StructuralEditorV06() {
  const [model, setModel] = useState<StructuralModel>(() => emptyModel());
  const [selection, setSelection] = useState<EditorSelection>(null);
  const selections = usePublishedSelections();
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [message, setMessage] = useState(
    "Core v0.5 model ready. That Open interaction active.",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  function setCanonicalSelection(next: EditorSelection): void {
    if (!next) {
      const cleared = clearSelection();
      setSelection(cleared);
      publishSelection(cleared);
      setPropertiesOpen(false);
      return;
    }

    const canonical = createSelection(next.type, next.id);
    setSelection(canonical);
    publishSelection(canonical);
    setPropertiesOpen(true);
  }

  function clearCanonicalSelection(): void {
    const cleared = clearSelection();
    setSelection(cleared);
    publishSelection(cleared);
    setPropertiesOpen(false);
  }

  function reconcileSelections(next: StructuralModel): void {
    const reconciled = getPublishedSelections()
      .map((item) => reconcileSelection(next, item))
      .filter((item): item is ConcreteSelection => Boolean(item));

    publishSelections(reconciled);
    setSelection(reconciled.at(-1) ?? null);
    if (!reconciled.length) setPropertiesOpen(false);
  }

  async function importProject(file: File): Promise<void> {
    const parsed = JSON.parse(await file.text()) as unknown;
    const migrated = migrateProjectToV05(parsed);
    assertCanonicalV05(migrated.model);
    setModel(migrated.model as StructuralModel);
    publishSelections([]);
    setSelection(null);
    setPropertiesOpen(false);
    setMessage(
      migrated.warnings.length
        ? migrated.warnings.join(" ")
        : "Core v0.5 project imported.",
    );
  }

  function applyModelChange(next: StructuralModel, status: string): void {
    try {
      assertCanonicalV05(next);
      setModel(next);
      reconcileSelections(next);
      setMessage(status);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Core v0.5 model update failed.",
      );
    }
  }

  function deleteSelections(): void {
    const targets = getPublishedSelections();
    const effective = targets.length ? targets : selection ? [selection] : [];
    if (!effective.length) return;

    try {
      let next = model;
      for (const target of effective) {
        next = deleteSelection(next, target).model;
      }
      assertCanonicalV05(next);
      setModel(next);
      clearCanonicalSelection();
      setMessage(
        `${effective.length} selected element${effective.length === 1 ? "" : "s"} deleted.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Delete blocked: ${error.message}`
          : "Delete blocked by model validation.",
      );
    }
  }

  const selectedNode =
    selection?.type === "node"
      ? model.nodes.find((item) => item.id === selection.id)
      : undefined;
  const selectedMember =
    selection?.type === "member"
      ? model.members.find((item) => item.id === selection.id)
      : undefined;
  const selectedSurface =
    selection?.type === "surface"
      ? model.surfaces.find((item) => item.id === selection.id)
      : undefined;

  const selectedNodes = selections
    .filter((item) => item.type === "node")
    .map((item) => model.nodes.find((node) => node.id === item.id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const selectedMembers = selections
    .filter((item) => item.type === "member")
    .map((item) => model.members.find((member) => member.id === item.id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const selectedSurfaces = selections
    .filter((item) => item.type === "surface")
    .map((item) => model.surfaces.find((surface) => surface.id === item.id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const selectedLabel =
    selections.length > 1
      ? `${selections.length} elements selected`
      : getSelectionLabel(selection);

  return (
    <div className="appShell">
      <header className="topbar">
        <strong>Linkoteq 3D Structural Editor</strong>
        <div className="topActions">
          <button
            onClick={() => {
              setModel(emptyModel());
              clearCanonicalSelection();
              setMessage("New Core v0.5 project created.");
            }}
          >
            New
          </button>
          <button onClick={() => inputRef.current?.click()}>Open</button>
          <button onClick={() => downloadModel(model)}>Save</button>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept=".json,.ltq,application/json"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (file) {
                importProject(file).catch((error: unknown) => {
                  setMessage(
                    error instanceof Error ? error.message : "Import failed.",
                  );
                });
              }
              event.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="importbar">
        <span>Core schema: {model.schemaVersion}</span>
        <span>Project: {model.project.id}</span>
        <span className="statusText">{message}</span>
      </div>

      <main className="workspace">
        <aside className="toolbar">
          <ModelToolsV05
            model={model}
            selectedNodeId={selectedNode?.id}
            onModelChange={applyModelChange}
          />

          <NodeCreatorV05
            model={model}
            onModelChange={applyModelChange}
            onNodeCreated={(nodeId) =>
              setCanonicalSelection({ type: "node", id: nodeId })
            }
          />

          <SelectedNodeSupportV05
            model={model}
            selectedNodes={selectedNodes}
            onModelChange={applyModelChange}
          />

          <section className="panelBlock">
            <h3>Selection</h3>
            <div className="selectionText">{selectedLabel}</div>
            <button
              onClick={clearCanonicalSelection}
              disabled={!selections.length}
            >
              Clear selection
            </button>
            <button onClick={deleteSelections} disabled={!selections.length}>
              Delete selected
            </button>
          </section>
        </aside>

        <section
          className="viewport"
          onContextMenu={(event) => event.preventDefault()}
          style={{ position: "relative" }}
        >
          <ThatOpenViewportV01
            model={model}
            selection={selection}
            onSelect={setCanonicalSelection}
          />
        </section>

        <aside className="inspector">
          <h2>Inspector</h2>
          <p className="selectionText">{selectedLabel}</p>
          <details>
            <summary>Core Model JSON</summary>
            <pre>{JSON.stringify(model, null, 2)}</pre>
          </details>
        </aside>
      </main>

      <ElementProperties
        model={model}
        selections={selections}
        node={selectedNode}
        member={selectedMember}
        surface={selectedSurface}
        open={Boolean(selections.length) && propertiesOpen}
        onClose={() => setPropertiesOpen(false)}
        onModelChange={applyModelChange}
      />

      <LoadManager
        model={model}
        selectedSurfaces={selectedSurfaces}
        selectedMembers={selectedMembers}
        selectedNodes={selectedNodes}
        onModelChange={(next, status) => {
          assertCanonicalV05(next);
          setModel(next);
          reconcileSelections(next);
          if (status) setMessage(status);
        }}
        onBeginTargetSelection={() =>
          setMessage("Select one or more model targets for load assignment.")
        }
        onEndTargetSelection={() =>
          setMessage("Load target selection finished.")
        }
      />
    </div>
  );
}
