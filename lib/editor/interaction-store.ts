"use client";

import { useSyncExternalStore } from "react";
import type { Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "./selection";

export type InteractionMode = "select" | "copy-base" | "copy-target";

export interface SnapPoint {
  point: Vec3;
  kind: "node" | "endpoint" | "midpoint" | "grid" | "work-plane";
  label: string;
}

export interface InteractionState {
  mode: InteractionMode;
  selection: EditorSelection;
  base: SnapPoint | null;
  preview: SnapPoint | null;
  message: string;
}

let state: InteractionState = {
  mode: "select",
  selection: null,
  base: null,
  preview: null,
  message: "Select an object.",
};

const listeners = new Set<() => void>();

function emit(next: InteractionState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getInteractionState(): InteractionState {
  return state;
}

export function startCopyInteraction(selection: EditorSelection): void {
  if (!selection) {
    emit({
      mode: "select",
      selection: null,
      base: null,
      preview: null,
      message: "Select an object before Copy.",
    });
    return;
  }

  emit({
    mode: "copy-base",
    selection,
    base: null,
    preview: null,
    message: "Copy: pick a base point.",
  });
}

export function setCopyBase(base: SnapPoint): void {
  emit({
    ...state,
    mode: "copy-target",
    base,
    preview: base,
    message: "Copy: move to a target point and tap/click to place.",
  });
}

export function setCopyPreview(preview: SnapPoint | null): void {
  if (state.mode !== "copy-target") return;
  emit({ ...state, preview });
}

export function finishCopyInteraction(): void {
  emit({
    mode: "select",
    selection: null,
    base: null,
    preview: null,
    message: "Copy complete. Select an object.",
  });
}

export function cancelInteraction(): void {
  emit({
    mode: "select",
    selection: null,
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
