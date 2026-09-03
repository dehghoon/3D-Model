"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type ConcreteSelection = Exclude<EditorSelection, null>;

type VisibilityCommand = {
  action: "hide" | "isolate" | "show-all";
  selections?: ConcreteSelection[];
};

function selectionKey(selection: ConcreteSelection): string {
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
  const rightClickSelectionsRef = useRef<ConcreteSelection[]>([]);
  const [viewToolActive, setViewToolActive] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());
  const [isolateKeys, setIsolateKeys] = useState<Set<string> | null>(null);

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

  useEffect(() => {
    const handleVisibility = (event: Event) => {
      const detail = (event as CustomEvent<VisibilityCommand>).detail;
      if (!detail) return;

      if (detail.action === "show-all") {
        setHiddenKeys(new Set());
        setIsolateKeys(null);
        return;
      }

      const keys = new Set((detail.selections ?? []).map(selectionKey));
      if (!keys.size) return;

      if (detail.action === "isolate") {
        setIsolateKeys(keys);
        return;
      }

      setIsolateKeys(null);
      setHiddenKeys((current) => {
        const next = new Set(current);
        keys.forEach((key) => next.add(key));
        return next;
      });
    };

    window.addEventListener(
      "linkoteq:viewport-visibility",
      handleVisibility as EventListener,
    );
    return () =>
      window.removeEventListener(
        "linkoteq:viewport-visibility",
        handleVisibility as EventListener,
      );
  }, []);

  const viewportModel = useMemo<StructuralModel>(() => {
    const visible = (selection: ConcreteSelection) => {
      const key = selectionKey(selection);
      if (isolateKeys) return isolateKeys.has(key);
      return !hiddenKeys.has(key);
    };

    return {
      ...props.model,
      members: props.model.members.filter((item) =>
        visible({ type: "member", id: item.id }),
      ),
      surfaces: props.model.surfaces.filter((item) =>
        visible({ type: "surface", id: item.id }),
      ),
    };
  }, [props.model, hiddenKeys, isolateKeys]);

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

  const handlePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 2) {
      rightClickSelectionsRef.current = [...getPublishedSelections()];
    }
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const before = rightClickSelectionsRef.current;
    const after = getPublishedSelections();
    const picked = after.at(-1) ?? null;

    if (
      before.length > 1 &&
      picked &&
      before.some((item) => selectionKey(item) === selectionKey(picked))
    ) {
      publishSelections(before);
    }

    window.dispatchEvent(
      new CustomEvent("linkoteq:viewport-context-menu", {
        detail: {
          clientX: event.clientX,
          clientY: event.clientY,
          selection: picked,
        },
      }),
    );
  };

  return (
    <div
      ref={hostRef}
      className={`thatOpenViewportToolHost ${
        viewToolActive ? "view-tool-active" : ""
      }`}
      onPointerDownCapture={handlePointerDownCapture}
      onContextMenu={handleContextMenu}
    >
      <ThatOpenViewportV07
        {...props}
        model={viewportModel}
        onSelect={handleSelect}
      />
    </div>
  );
}
