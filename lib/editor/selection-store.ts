"use client";

import { useSyncExternalStore } from "react";
import type { EditorSelection } from "./selection";

let currentSelection: EditorSelection = null;
let currentSelections: Exclude<EditorSelection, null>[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function normalize(
  selections: Array<Exclude<EditorSelection, null>>,
): Array<Exclude<EditorSelection, null>> {
  const seen = new Set<string>();
  const result: Array<Exclude<EditorSelection, null>> = [];
  for (const selection of selections) {
    const key = `${selection.type}:${selection.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(selection);
  }
  return result;
}

export function publishSelection(selection: EditorSelection): void {
  currentSelection = selection;
  currentSelections = selection ? [selection] : [];
  emit();
}

export function publishSelections(
  selections: Array<Exclude<EditorSelection, null>>,
): void {
  currentSelections = normalize(selections);
  currentSelection = currentSelections.at(-1) ?? null;
  emit();
}

export function addPublishedSelection(
  selection: Exclude<EditorSelection, null>,
): void {
  publishSelections([...currentSelections, selection]);
}

export function getPublishedSelection(): EditorSelection {
  return currentSelection;
}

export function getPublishedSelections(): Array<Exclude<EditorSelection, null>> {
  return currentSelections;
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

export function usePublishedSelections(): Array<Exclude<EditorSelection, null>> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentSelections,
    () => [],
  );
}
