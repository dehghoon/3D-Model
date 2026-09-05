"use client";

import { useSyncExternalStore } from "react";
import type { MemberType } from "@linkoteq/structural-core";
import type { SnapPoint } from "./interaction-store";

export interface MemberDrawState {
  active: boolean;
  type: MemberType | null;
  materialId: string;
  sectionId: string;
  start: SnapPoint | null;
  message: string;
}

let state: MemberDrawState = {
  active: false,
  type: null,
  materialId: "",
  sectionId: "",
  start: null,
  message: "Member drawing inactive.",
};

const listeners = new Set<() => void>();

function emit(next: MemberDrawState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getMemberDrawState(): MemberDrawState {
  return state;
}

export function beginMemberDraw(input: {
  type: MemberType;
  materialId: string;
  sectionId: string;
}): void {
  emit({
    active: true,
    type: input.type,
    materialId: input.materialId,
    sectionId: input.sectionId,
    start: null,
    message: `${input.type}: pick a snapped start point.`,
  });
}

export function updateMemberDrawReferences(materialId: string, sectionId: string): void {
  if (!state.active) return;
  emit({ ...state, materialId, sectionId });
}

export function setMemberDrawStart(point: SnapPoint): void {
  if (!state.active || !state.type) return;
  emit({
    ...state,
    start: point,
    message: `${state.type}: start ${point.label}; pick a snapped end point.`,
  });
}

export function continueMemberDraw(point: SnapPoint, memberId: string): void {
  if (!state.active || !state.type) return;
  emit({
    ...state,
    start: point,
    message: `Created ${memberId}. Continue from ${point.label} or press Escape.`,
  });
}

export function cancelMemberDraw(): void {
  emit({
    active: false,
    type: null,
    materialId: "",
    sectionId: "",
    start: null,
    message: "Member drawing inactive.",
  });
}

export function subscribeMemberDraw(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMemberDrawState(): MemberDrawState {
  return useSyncExternalStore(subscribeMemberDraw, getMemberDrawState, getMemberDrawState);
}
