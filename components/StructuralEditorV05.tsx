"use client";

import StructuralEditorV07 from "./StructuralEditorV07";
import ReferenceStatusOverlay from "./ReferenceStatusOverlay";

export default function StructuralEditorV05({
  mode = "advanced",
}: {
  mode?: "simple" | "advanced";
}) {
  return (
    <>
      <StructuralEditorV07 mode={mode} />
      <ReferenceStatusOverlay />
    </>
  );
}
