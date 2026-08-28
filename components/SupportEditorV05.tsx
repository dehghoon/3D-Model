"use client";

import { useEffect, useState } from "react";
import type { StructuralDOF, StructuralModel, SupportRestraints } from "@linkoteq/structural-core";
import { createSupportFromCanonicalNode } from "../lib/editor-support-v05";

interface Props {
  model: StructuralModel;
  selectedNodeId?: string;
  onModelChange: (model: StructuralModel, status: string) => void;
}

const DOFS: StructuralDOF[] = ["DX", "DY", "DZ", "RX", "RY", "RZ"];

const FREE: SupportRestraints = {
  DX: false,
  DY: false,
  DZ: false,
  RX: false,
  RY: false,
  RZ: false,
};

export default function SupportEditorV05({ model, selectedNodeId, onModelChange }: Props) {
  const [restraints, setRestraints] = useState<SupportRestraints>(FREE);

  useEffect(() => {
    if (!selectedNodeId) {
      setRestraints(FREE);
      return;
    }
    const existing = model.supports.find((support) => support.nodeId === selectedNodeId);
    setRestraints(existing?.restraints ?? FREE);
  }, [model.supports, selectedNodeId]);

  function toggle(dof: StructuralDOF) {
    setRestraints((current) => ({ ...current, [dof]: !current[dof] }));
  }

  function createSupport() {
    if (!selectedNodeId) return;
    try {
      const result = createSupportFromCanonicalNode(model, {
        nodeId: selectedNodeId,
        restraints,
      });
      onModelChange(result.model, `Canonical Core v0.5 support ${result.support.id} created for ${selectedNodeId}.`);
    } catch (error) {
      onModelChange(model, error instanceof Error ? error.message : "Support creation failed.");
    }
  }

  const existing = selectedNodeId
    ? model.supports.find((support) => support.nodeId === selectedNodeId)
    : undefined;

  return (
    <section className="panelBlock">
      <h3>Node Support</h3>
      <div className="selectionText">Node: {selectedNodeId ?? "Select a node in the viewport"}</div>
      <div className="supportDofGrid">
        {DOFS.map((dof) => (
          <label key={dof}>
            <input
              type="checkbox"
              checked={restraints[dof]}
              onChange={() => toggle(dof)}
              disabled={!selectedNodeId || Boolean(existing)}
            />
            {dof}
          </label>
        ))}
      </div>
      <button onClick={createSupport} disabled={!selectedNodeId || Boolean(existing)}>
        {existing ? `Support ${existing.id} assigned` : "Create Support"}
      </button>
      <p className="selectionText">
        Restraints use the canonical Core six-DOF contract. The UI does not infer support behavior.
      </p>
    </section>
  );
}
