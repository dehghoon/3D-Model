"use client";

import ThatOpenViewportV07 from "./ThatOpenViewportV07";
import {
  publishSelection,
  publishSelections,
} from "../lib/editor/selection-store";
import type { StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "../lib/editor/selection";

interface Props {
  model: StructuralModel;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
}

export default function ThatOpenViewportV03(props: Props) {
  return (
    <ThatOpenViewportV07
      {...props}
      onSelect={(selection) => {
        publishSelection(selection);
        props.onSelect(selection);
      }}
      onMultiSelect={(selections) => {
        props.onSelect(selections.at(-1) ?? null);
        publishSelections(selections);
      }}
    />
  );
}
