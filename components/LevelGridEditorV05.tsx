"use client";
import type { StructuralModel } from "@linkoteq/structural-core";
import CopyInteractionBridgeV01 from "./CopyInteractionBridgeV01";
import CopyTool from "./CopyToolV05";
import GridEditor from "./LevelGridEditorV05New";

export default function LevelGridEditorV05({
  model,
  onModelChange,
}: {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}) {
  return (
    <>
      <CopyInteractionBridgeV01 model={model} onModelChange={onModelChange} />
      <GridEditor model={model} onModelChange={onModelChange} />
      <CopyTool model={model} onModelChange={onModelChange} />
    </>
  );
}
