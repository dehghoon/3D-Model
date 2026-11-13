"use client";

import StructuralEditorV07 from "./StructuralEditorV07";
import ReferenceStatusOverlay from "./ReferenceStatusOverlay";

import type { SapHandoff } from "../lib/import/sap2000-handoff";
import type { StructuralModel } from "@linkoteq/structural-core";

export default function StructuralEditorV05(props: { model?: StructuralModel; onModelChange?: (model: StructuralModel) => void; sapHandoff?: SapHandoff | null; simpleMode?: boolean; onSapMemberSelect?: (id:string|null)=>void }) {
  return (
    <>
      <StructuralEditorV07 {...props} />
      <ReferenceStatusOverlay />
    </>
  );
}

