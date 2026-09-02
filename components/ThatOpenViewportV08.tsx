"use client";

import { useEffect, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";

import type { EditorSelection } from "../lib/editor/selection";
import ThatOpenViewportV07 from "./ThatOpenViewportV07";

interface Props {
  model: StructuralModel;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onMultiSelect?: (
    selections: Array<Exclude<EditorSelection, null>>,
  ) => void;
}

export default function ThatOpenViewportV08(props: Props) {
  const [viewToolActive, setViewToolActive] = useState(false);

  useEffect(() => {
    const activateView = () => setViewToolActive(true);
    const deactivateView = () => setViewToolActive(false);

    window.addEventListener("linkoteq:view-cycle", activateView);
    window.addEventListener("linkoteq:view-select", deactivateView);

    return () => {
      window.removeEventListener("linkoteq:view-cycle", activateView);
      window.removeEventListener("linkoteq:view-select", deactivateView);
    };
  }, []);

  return (
    <div
      className={`thatOpenViewportToolHost ${
        viewToolActive ? "view-tool-active" : ""
      }`}
    >
      <ThatOpenViewportV07 {...props} />
    </div>
  );
}
