import { useSyncExternalStore } from "react";
import type { Level } from "@linkoteq/structural-core";

let levels: Level[] = [];
const listeners = new Set<() => void>();

export function publishLevels(next: Level[]) {
  levels = next;
  listeners.forEach((listener) => listener());
}

export function usePublishedLevels(): Level[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => levels,
    () => levels,
  );
}
