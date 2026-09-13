"use client";

import { useEffect } from "react";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import { copySelection } from "../lib/editor/copy-command";
import { deleteSelection } from "../lib/editor/commands";
import {
  finishCopyInteraction,
  getInteractionState,
  startCopyInteraction,
  startMoveInteraction,
} from "../lib/editor/interaction-store";
import { moveSelection } from "../lib/editor/move-command";
import {
  getPublishedSelection,
  publishSelection,
} from "../lib/editor/selection-store";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

interface TransformCommitDetail {
  delta?: Vec3;
}

function isUtilityButton(target: EventTarget | null, label: string): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>(".architectQuickActions button");
  if (!button || button.disabled) return false;
  return button.querySelector("strong")?.textContent?.trim() === label;
}

function hasDisplacement(delta: Vec3): boolean {
  return Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z) > 1e-10;
}

export default function CopyInteractionBridgeV01({
  model,
  onModelChange,
}: Props) {
  useEffect(() => {
    const commitTransform = (delta: Vec3): boolean => {
      const selection = getPublishedSelection();
      const interaction = getInteractionState();

      if (!selection) {
        onModelChange(model, "Select an object before using Move or Copy.");
        return false;
      }

      if (!hasDisplacement(delta)) {
        onModelChange(model, "Target point must differ from the base point.");
        return false;
      }

      try {
        if (interaction.operation === "move") {
          const result = moveSelection(model, selection, delta);
          publishSelection(result.selection);
          onModelChange(
            result.model,
            `Moved ${selection.type} ${selection.id} by snapped displacement.`,
          );
        } else {
          const result = copySelection(model, selection, delta);
          publishSelection(result.selection);
          onModelChange(
            result.model,
            `Copied ${selection.type} ${selection.id} by snapped displacement.`,
          );
        }
        return true;
      } catch (error) {
        onModelChange(
          model,
          error instanceof Error ? error.message : "Transform failed.",
        );
        return false;
      }
    };

    const onTransformCommit = (event: Event) => {
      const custom = event as CustomEvent<TransformCommitDetail>;
      const delta = custom.detail?.delta;
      if (!delta) return;
      if (commitTransform(delta)) finishCopyInteraction();
    };

    const onDocumentClickCapture = (event: MouseEvent) => {
      const selection = getPublishedSelection();

      if (isUtilityButton(event.target, "Copy")) {
        event.preventDefault();
        event.stopPropagation();
        startCopyInteraction(selection);
        if (!selection) onModelChange(model, "Select an object before Copy.");
        return;
      }

      if (isUtilityButton(event.target, "Move")) {
        event.preventDefault();
        event.stopPropagation();
        startMoveInteraction(selection);
        if (!selection) onModelChange(model, "Select an object before Move.");
        return;
      }

      if (isUtilityButton(event.target, "Delete")) {
        event.preventDefault();
        event.stopPropagation();
        if (!selection) {
          onModelChange(model, "Select an object before Delete.");
          return;
        }
        try {
          const result = deleteSelection(model, selection);
          publishSelection(null);
          onModelChange(
            result.model,
            `Deleted ${result.deleted.type} ${result.deleted.id}.`,
          );
        } catch (error) {
          onModelChange(
            model,
            error instanceof Error ? error.message : "Delete failed.",
          );
        }
        return;
      }

      if (isUtilityButton(event.target, "Select")) {
        event.preventDefault();
        event.stopPropagation();
        finishCopyInteraction();
        window.dispatchEvent(new Event("linkoteq:view-select"));
        return;
      }

      if (isUtilityButton(event.target, "View")) {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new Event("linkoteq:view-cycle"));
      }
    };

    window.addEventListener("linkoteq:copy-commit", onTransformCommit);
    document.addEventListener("click", onDocumentClickCapture, true);

    return () => {
      window.removeEventListener("linkoteq:copy-commit", onTransformCommit);
      document.removeEventListener("click", onDocumentClickCapture, true);
    };
  }, [model, onModelChange]);

  return null;
}
