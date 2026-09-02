"use client";

import { useEffect } from "react";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import { copySelection } from "../lib/editor/copy-command";
import {
  getPublishedSelection,
  publishSelection,
} from "../lib/editor/selection-store";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

interface CopyCommitDetail {
  delta?: Vec3;
}

export default function CopyInteractionBridgeV01({
  model,
  onModelChange,
}: Props) {
  useEffect(() => {
    const onCopyCommit = (event: Event) => {
      const custom = event as CustomEvent<CopyCommitDetail>;
      const delta = custom.detail?.delta;
      const selection = getPublishedSelection();

      if (!delta || !selection) {
        onModelChange(model, "Copy requires an active selection.");
        return;
      }

      try {
        const result = copySelection(model, selection, delta);
        publishSelection(result.selection);
        onModelChange(
          result.model,
          `Copied ${selection.type} ${selection.id} by snapped displacement.`,
        );
      } catch (error) {
        onModelChange(
          model,
          error instanceof Error ? error.message : "Copy failed.",
        );
      }
    };

    window.addEventListener("linkoteq:copy-commit", onCopyCommit);
    return () => {
      window.removeEventListener("linkoteq:copy-commit", onCopyCommit);
    };
  }, [model, onModelChange]);

  return null;
}
