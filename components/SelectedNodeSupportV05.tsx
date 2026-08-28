"use client";

import type { StructuralModel, Node } from "@linkoteq/structural-core";
import SupportEditorV05 from "./SupportEditorV05";

interface Props {
  model: StructuralModel;
  selectedNodes: Node[];
  onModelChange: (model: StructuralModel, status: string) => void;
}

export default function SelectedNodeSupportV05({ model, selectedNodes, onModelChange }: Props) {
  const selectedNodeId = selectedNodes.length === 1 ? selectedNodes[0].id : undefined;

  return (
    <SupportEditorV05
      model={model}
      selectedNodeId={selectedNodeId}
      onModelChange={onModelChange}
    />
  );
}
