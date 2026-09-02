"use client";
import type { StructuralModel } from "@linkoteq/structural-core";
import CopyTool from "./CopyToolV05";
import GridEditor from "./LevelGridEditorV05New";
import LevelEditor from "./LevelEditorV06";

export default function LevelGridEditorV05({
  model,
  onModelChange,
}: {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}) {
  return (
    <>
      <GridEditor model={model} onModelChange={onModelChange} />
      <LevelEditor model={model} onModelChange={onModelChange} />
      <CopyTool model={model} onModelChange={onModelChange} />
    </>
  );
}
