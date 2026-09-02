"use client";

import ThatOpenViewportV04 from "./ThatOpenViewportV04";
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
    <ThatOpenViewportV04
      {...props}
      onSelect={(selection) => {
        publishSelection(selection);
        props.onSelect(selection);
      }}
    />
  );
}
