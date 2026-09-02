"use client";

import StructuralEditorV06 from "./StructuralEditorV06";
import ReferenceStatusOverlay from "./ReferenceStatusOverlay";

export default function StructuralEditorV05() {
  return (
    <div className="structuralEditorViewportHost">
      <StructuralEditorV06 />
      <ReferenceStatusOverlay />
    </div>
  );
}
