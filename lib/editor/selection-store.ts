"use client";

import { useSyncExternalStore } from "react";
import type { EditorSelection } from "./selection";

let currentSelection: EditorSelection = null;
const listeners = new Set<() => void>();

export function publishSelection(selection: EditorSelection): void {
  currentSelection = selection;
  listeners.forEach((listener) => listener());
}

export function getPublishedSelection(): EditorSelection {
  return currentSelection;
}

export function usePublishedSelection(): EditorSelection {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentSelection,
    () => null,
  );
}
