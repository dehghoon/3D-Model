"use client";

import { useEffect, useRef, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";

import type { EditorSelection } from "../lib/editor/selection";
import {
  getPublishedSelections,
  publishSelections,
} from "../lib/editor/selection-store";
import ThatOpenViewportV07 from "./ThatOpenViewportV07";

interface Props {
  model: StructuralModel;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onMultiSelect?: (
    selections: Array<Exclude<EditorSelection, null>>,
  ) => void;
}

function selectionKey(
  selection: Exclude<EditorSelection, null>,
): string {
  return `${selection.type}:${selection.id}`;
}

function isNonViewToolButton(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  const button = target.closest<HTMLButtonElement>(
    ".architectQuickActions button, .architectToolstrip button",
  );
  if (!button) return false;

  const label =
    button.querySelector("strong")?.textContent?.trim() ??
    button.textContent?.trim() ??
    "";

  return label !== "View";
}

export default function ThatOpenViewportV08(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const additiveSelectRef = useRef(false);
  const [viewToolActive, setViewToolActive] = useState(false);

  useEffect(() => {
    const activateView = () => setViewToolActive(true);
    const deactivateView = () => setViewToolActive(false);
    const handleToolClick = (event: MouseEvent) => {
      if (isNonViewToolButton(event.target)) deactivateView();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      additiveSelectRef.current = event.ctrlKey || event.metaKey;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      additiveSelectRef.current = event.ctrlKey || event.metaKey;
    };
    const clearModifiers = () => {
      additiveSelectRef.current = false;
    };

    window.addEventListener("linkoteq:view-cycle", activateView);
    window.addEventListener("linkoteq:view-select", deactivateView);
    document.addEventListener("click", handleToolClick, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearModifiers);

    return () => {
      window.removeEventListener("linkoteq:view-cycle", activateView);
      window.removeEventListener("linkoteq:view-select", deactivateView);
      document.removeEventListener("click", handleToolClick, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearModifiers);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const syncNavigator = () => {
      const navigator =
        host.querySelector<HTMLElement>(".viewportReferenceNavigator");
      if (!navigator) return;
      navigator.hidden = !viewToolActive;
      navigator.style.display = viewToolActive ? "" : "none";
    };

    syncNavigator();

    const observer = new MutationObserver(syncNavigator);
    observer.observe(host, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [viewToolActive]);

  const handleSelect = (selection: EditorSelection) => {
    if (!additiveSelectRef.current) {
      props.onSelect(selection);
      return;
    }

    if (!selection) return;

    const current = getPublishedSelections();
    const key = selectionKey(selection);
    const exists = current.some((item) => selectionKey(item) === key);
    const next = exists
      ? current.filter((item) => selectionKey(item) !== key)
      : [...current, selection];

    if (props.onMultiSelect) {
      props.onMultiSelect(next);
    } else {
      publishSelections(next);
      props.onSelect(next.at(-1) ?? null);
    }
  };

  return (
    <div
      ref={hostRef}
      className={`thatOpenViewportToolHost ${
        viewToolActive ? "view-tool-active" : ""
      }`}
    >
      <ThatOpenViewportV07
        {...props}
        onSelect={handleSelect}
      />
    </div>
  );
}
