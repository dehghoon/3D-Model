"use client";

import { useSyncExternalStore } from "react";

export type SnapKindPreference = "endpoint" | "midpoint" | "perpendicular" | "grid" | "node";

export interface SnapSettings {
  endpoint: boolean;
  midpoint: boolean;
  perpendicular: boolean;
  grid: boolean;
  node: boolean;
}

let settings: SnapSettings = {
  endpoint: true,
  midpoint: true,
  perpendicular: true,
  grid: true,
  node: true,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getSnapSettings(): SnapSettings {
  return settings;
}

export function setSnapSetting(kind: SnapKindPreference, enabled: boolean): void {
  if (settings[kind] === enabled) return;
  settings = { ...settings, [kind]: enabled };
  emit();
}

export function subscribeSnapSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSnapSettings(): SnapSettings {
  return useSyncExternalStore(subscribeSnapSettings, getSnapSettings, getSnapSettings);
}
