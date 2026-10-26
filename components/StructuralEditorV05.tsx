"use client";

import StructuralEditorV07 from "./StructuralEditorV07";
import ReferenceStatusOverlay from "./ReferenceStatusOverlay";

import type { StructuralModel } from "@linkoteq/structural-core";

export default function StructuralEditorV05(props: { model?: StructuralModel; onModelChange?: (model: StructuralModel) => void }) {
  return (
    <>
      <StructuralEditorV07 {...props} />
      <ReferenceStatusOverlay />
    </>
  );
}

