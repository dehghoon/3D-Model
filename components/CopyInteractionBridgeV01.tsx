"use client";

import { useEffect } from "react";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import { copySelection } from "../lib/editor/copy-command";
import { startCopyInteraction } from "../lib/editor/interaction-store";
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

function isShellCopyButton(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>(".architectQuickActions button");
  if (!button || button.disabled) return false;
  const label = button.querySelector("strong")?.textContent?.trim();
  return label === "Copy";
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

    const onDocumentClickCapture = (event: MouseEvent) => {
      if (!isShellCopyButton(event.target)) return;

      event.preventDefault();
      event.stopPropagation();

      const selection = getPublishedSelection();
      startCopyInteraction(selection);

      if (!selection) {
        onModelChange(model, "Select an object before Copy.");
      }
    };

    window.addEventListener("linkoteq:copy-commit", onCopyCommit);
    document.addEventListener("click", onDocumentClickCapture, true);

    return () => {
      window.removeEventListener("linkoteq:copy-commit", onCopyCommit);
      document.removeEventListener("click", onDocumentClickCapture, true);
    };
  }, [model, onModelChange]);

  return null;
}
