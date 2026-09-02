"use client";

import ThatOpenViewportV02 from "./ThatOpenViewportV02";
import { publishSelection } from "../lib/editor/selection-store";
import type { StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "../lib/editor/selection";

interface Props {
  model: StructuralModel;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
}

export default function ThatOpenViewportV03(props: Props) {
  return (
    <ThatOpenViewportV02
      {...props}
      onSelect={(selection) => {
        publishSelection(selection);
        props.onSelect(selection);
      }}
    />
  );
}
