"use client";

import MemberDrawStatusBarV01 from "./MemberDrawStatusBarV01";
import SnapToolbarV01 from "./SnapToolbarV01";
import ThatOpenViewportV08 from "./ThatOpenViewportV08";
import {
  publishSelection,
  publishSelections,
} from "../lib/editor/selection-store";
import type { StructuralModel } from "@linkoteq/structural-core";
import type { SapHandoff } from "../lib/import/sap2000-handoff";
import type { EditorSelection } from "../lib/editor/selection";

interface Props {
  model: StructuralModel;
  sapHandoff?: SapHandoff | null;
  onSapMemberSelect?: (id:string|null)=>void;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onMultiSelect?: (selections: Array<Exclude<EditorSelection, null>>) => void;
}

export default function ThatOpenViewportV03(props: Props) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <SnapToolbarV01 />
      <MemberDrawStatusBarV01 />
      <ThatOpenViewportV08
        {...props}
        onSelect={(selection) => {
          publishSelection(selection);
          props.onSelect(selection);
        }}
        onMultiSelect={(selections) => {
          publishSelections(selections);
          if (props.onMultiSelect) props.onMultiSelect(selections);
          else props.onSelect(selections.at(-1) ?? null);
        }}
      />
    </div>
  );
}
