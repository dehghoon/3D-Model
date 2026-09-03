"use client";

import { useEffect } from "react";
import type { StructuralModel, Node } from "@linkoteq/structural-core";
import { applyDefaultBaseSupports } from "../lib/base-support-defaults-v05";
import SupportEditorV05 from "./SupportEditorV05";
import SurfaceCreatorV05 from "./SurfaceCreatorV05";

interface Props {
  model: StructuralModel;
  selectedNodes: Node[];
  onModelChange: (model: StructuralModel, status: string) => void;
}

export default function SelectedNodeSupportV05({ model, selectedNodes, onModelChange }: Props) {
  const selectedNodeId = selectedNodes.length === 1 ? selectedNodes[0].id : undefined;

  useEffect(() => {
    if (model.project.metadata?.defaultModel !== "portal-frame") return;
    const next = applyDefaultBaseSupports(model);
    if (next === model) return;
    onModelChange(
      next,
      "Default Base restraints applied: DX, DY and DZ restrained.",
    );
  }, [model, onModelChange]);

  return (
    <>
      <SupportEditorV05
        model={model}
        selectedNodeId={selectedNodeId}
        onModelChange={onModelChange}
      />
      <SurfaceCreatorV05
        model={model}
        selectedNodeId={selectedNodeId}
        onModelChange={onModelChange}
      />
    </>
  );
}
