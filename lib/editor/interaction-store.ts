"use client";

import { useSyncExternalStore } from "react";
import type { Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "./selection";

export type TransformOperation = "copy" | "move";
export type InteractionMode = "select" | "copy-base" | "copy-target";

export interface SnapPoint {
  point: Vec3;
  kind:
    "node" | "endpoint" | "midpoint" | "perpendicular" | "grid" | "work-plane";
  label: string;
}

export interface InteractionState {
  mode: InteractionMode;
  operation: TransformOperation | null;
  selection: EditorSelection;
  selections: Exclude<EditorSelection, null>[];
  base: SnapPoint | null;
  preview: SnapPoint | null;
  message: string;
}

let state: InteractionState = {
  mode: "select",
  operation: null,
  selection: null,
  selections: [],
  base: null,
  preview: null,
  message: "Select an object.",
};

const listeners = new Set<() => void>();

function emit(next: InteractionState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function startTransformInteraction(
  operation: TransformOperation,
  input: EditorSelection | Exclude<EditorSelection, null>[],
): void {
  const selections = (Array.isArray(input) ? input : input ? [input] : []).map(
    (item) => ({ ...item }),
  );
  const selection = selections.at(-1) ?? null;
  const label = operation === "copy" ? "Copy" : "Move";
  if (!selection) {
    emit({
      mode: "select",
      operation: null,
      selection: null,
      selections: [],
      base: null,
      preview: null,
      message: `Select an object before ${label}.`,
    });
    return;
  }

  emit({
    mode: "copy-base",
    operation,
    selection,
    selections,
    base: null,
    preview: null,
    message: `${label}: ${selections.length} selected. Pick a base point or enter coordinates.`,
  });
}

export function getInteractionState(): InteractionState {
  return state;
}

export function startCopyInteraction(
  selection: EditorSelection | Exclude<EditorSelection, null>[],
): void {
  startTransformInteraction("copy", selection);
}

export function startMoveInteraction(
  selection: EditorSelection | Exclude<EditorSelection, null>[],
): void {
  startTransformInteraction("move", selection);
}

export function setCopyBase(base: SnapPoint): void {
  const label = state.operation === "move" ? "Move" : "Copy";
  emit({
    ...state,
    mode: "copy-target",
    base,
    preview: base,
    message: `${label}: move to a target point and tap/click to place.`,
  });
}

export function setCopyPreview(preview: SnapPoint | null): void {
  if (state.mode !== "copy-target") return;
  emit({ ...state, preview });
}

export function setTransformMessage(message: string): void {
  emit({ ...state, message });
}

export function finishCopyInteraction(): void {
  const label = state.operation === "move" ? "Move" : "Copy";
  emit({
    mode: "select",
    operation: null,
    selection: null,
    selections: [],
    base: null,
    preview: null,
    message: `${label} complete. Select an object.`,
  });
}

export function cancelInteraction(): void {
  emit({
    mode: "select",
    operation: null,
    selection: null,
    selections: [],
    base: null,
    preview: null,
    message: "Select an object.",
  });
}

export function useInteractionState(): InteractionState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}
