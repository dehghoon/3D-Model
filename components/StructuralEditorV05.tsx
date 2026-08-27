"use client";

import { useRef, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";
import LoadManager from "./LoadManager";
import { assertCanonicalV05, migrateProjectToV05 } from "../lib/core-v05";

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

function downloadModel(model: StructuralModel) {
  assertCanonicalV05(model);
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${model.project.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function StructuralEditorV05() {
  const [model, setModel] = useState<StructuralModel>(() => emptyModel());
  const [message, setMessage] = useState("Core v0.5 model ready.");
  const inputRef = useRef<HTMLInputElement>(null);

  async function importProject(file: File) {
    const parsed = JSON.parse(await file.text()) as unknown;
    const migrated = migrateProjectToV05(parsed);
    assertCanonicalV05(migrated.model);
    setModel(migrated.model as unknown as StructuralModel);
    setMessage(migrated.warnings.length ? migrated.warnings.join(" ") : "Core v0.5 project imported.");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "100vh" }}>
      <aside style={{ padding: 16, borderRight: "1px solid #ddd" }}>
        <h2>3D Model</h2>
        <p>Core schema: {model.schemaVersion}</p>
        <p>Project: {model.project.id}</p>
        <p>{message}</p>
        <button onClick={() => inputRef.current?.click()}>Open project</button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              importProject(file).catch((error) => {
                setMessage(error instanceof Error ? error.message : "Import failed.");
              });
            }
          }}
        />
        <button onClick={() => downloadModel(model)}>Save / export v0.5</button>
      </aside>
      <main style={{ padding: 16 }}>
        <h3>Structural model</h3>
        <p>Nodes: {model.nodes.length}</p>
        <p>Members: {model.members.length}</p>
        <p>Surfaces: {model.surfaces.length}</p>
        <LoadManager
          model={model}
          selectedSurfaces={[]}
          selectedMembers={[]}
          selectedNodes={[]}
          onModelChange={(next, status) => {
            assertCanonicalV05(next);
            setModel(next);
            if (status) setMessage(status);
          }}
          onBeginTargetSelection={() => setMessage("Target selection is unavailable in recovery view.")}
          onEndTargetSelection={() => undefined}
        />
      </main>
    </div>
  );
}
