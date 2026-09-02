"use client";

import { useEffect } from "react";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import { copySelection } from "../lib/editor/copy-command";
import {
  finishCopyInteraction,
  getInteractionState,
  startCopyInteraction,
} from "../lib/editor/interaction-store";
import {
  getPublishedSelection,
  publishSelection,
} from "../lib/editor/selection-store";
import { isTapGesture } from "../lib/visualization/mobile-picking";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}

interface CopyCommitDetail {
  delta?: Vec3;
}

interface PointerStart {
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
}

function isShellCopyButton(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>(".architectQuickActions button");
  if (!button || button.disabled) return false;
  const label = button.querySelector("strong")?.textContent?.trim();
  return label === "Copy";
}

function isViewportTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(".thatOpenViewport"));
}

function deltaBetween(base: Vec3, target: Vec3): Vec3 {
  return {
    x: target.x - base.x,
    y: target.y - base.y,
    z: target.z - base.z,
  };
}

function hasDisplacement(delta: Vec3): boolean {
  return Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z) > 1e-10;
}

export default function CopyInteractionBridgeV01({
  model,
  onModelChange,
}: Props) {
  useEffect(() => {
    let pointerStart: PointerStart | null = null;

    const commitCopy = (delta: Vec3): boolean => {
      const selection = getPublishedSelection();
      if (!selection) {
        onModelChange(model, "Copy requires an active selection.");
        return false;
      }

      if (!hasDisplacement(delta)) {
        onModelChange(model, "Copy target must differ from the base point.");
        return false;
      }

      try {
        const result = copySelection(model, selection, delta);
        publishSelection(result.selection);
        onModelChange(
          result.model,
          `Copied ${selection.type} ${selection.id} by snapped displacement.`,
        );
        return true;
      } catch (error) {
        onModelChange(
          model,
          error instanceof Error ? error.message : "Copy failed.",
        );
        return false;
      }
    };

    const onCopyCommit = (event: Event) => {
      const custom = event as CustomEvent<CopyCommitDetail>;
      const delta = custom.detail?.delta;
      if (!delta) return;

      if (commitCopy(delta)) {
        finishCopyInteraction();
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

    const onPointerDownCapture = (event: PointerEvent) => {
      if (!isViewportTarget(event.target) || !event.isPrimary) return;

      pointerStart = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
      };
    };

    const onPointerUpCapture = (event: PointerEvent) => {
      const start = pointerStart;
      pointerStart = null;

      if (
        !start ||
        start.pointerId !== event.pointerId ||
        !isViewportTarget(event.target)
      ) {
        return;
      }

      const interaction = getInteractionState();
      if (
        interaction.mode !== "copy-target" ||
        !interaction.base ||
        !interaction.preview
      ) {
        return;
      }

      if (
        !isTapGesture(
          start.x,
          start.y,
          event.clientX,
          event.clientY,
          start.pointerType,
        )
      ) {
        return;
      }

      const delta = deltaBetween(
        interaction.base.point,
        interaction.preview.point,
      );

      if (!commitCopy(delta)) return;

      finishCopyInteraction();
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerCancelCapture = () => {
      pointerStart = null;
    };

    window.addEventListener("linkoteq:copy-commit", onCopyCommit);
    document.addEventListener("click", onDocumentClickCapture, true);
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    document.addEventListener("pointerup", onPointerUpCapture, true);
    document.addEventListener("pointercancel", onPointerCancelCapture, true);

    return () => {
      window.removeEventListener("linkoteq:copy-commit", onCopyCommit);
      document.removeEventListener("click", onDocumentClickCapture, true);
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      document.removeEventListener("pointerup", onPointerUpCapture, true);
      document.removeEventListener("pointercancel", onPointerCancelCapture, true);
    };
  }, [model, onModelChange]);

  return null;
}
