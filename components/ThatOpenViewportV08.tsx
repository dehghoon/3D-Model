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

type ContextMenuState = {
  x: number;
  y: number;
  target: EditorSelection;
  selections: ConcreteSelection[];
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

function clickEditorButton(label: string): boolean {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".engineeringEditorStage button, .toolbar button",
    ),
  ).find((item) => item.textContent?.trim() === label);

  if (!button || button.disabled) return false;
  button.click();
  return true;
}

export default function ThatOpenViewportV08(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const additiveSelectRef = useRef(false);
  const rightClickSelectionsRef = useRef<ConcreteSelection[]>([]);
  const [viewToolActive, setViewToolActive] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());
  const [isolateKeys, setIsolateKeys] = useState<Set<string> | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    const activateView = () => setViewToolActive(true);
    const deactivateView = () => setViewToolActive(false);
    const handleToolClick = (event: MouseEvent) => {
      if (isNonViewToolButton(event.target)) deactivateView();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      additiveSelectRef.current = event.ctrlKey || event.metaKey;
      if (event.key === "Escape") setContextMenu(null);
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
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

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

  const commitSelections = (next: ConcreteSelection[]) => {
    if (props.onMultiSelect) {
      props.onMultiSelect(next);
    } else {
      publishSelections(next);
      props.onSelect(next.at(-1) ?? null);
    }
  };

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

    commitSelections(next);
  };

  const openProperties = () => {
    const selections = contextMenu?.selections ?? getPublishedSelections();
    const target = contextMenu?.target ?? selections.at(-1) ?? null;
    if (!target) return;

    props.onSelect(target);
    queueMicrotask(() => publishSelections(selections));
    setContextMenu(null);
  };

  const runEditorCommand = (label: "Move" | "Copy" | "Delete selected") => {
    clickEditorButton(label);
    setContextMenu(null);
  };

  const applyVisibility = (action: "hide" | "isolate" | "show-all") => {
    if (action === "show-all") {
      setHiddenKeys(new Set());
      setIsolateKeys(null);
    } else {
      const keys = new Set(
        (contextMenu?.selections ?? getPublishedSelections()).map(selectionKey),
      );
      if (!keys.size) return;

      if (action === "isolate") {
        setIsolateKeys(keys);
      } else {
        setIsolateKeys(null);
        setHiddenKeys((current) => new Set([...current, ...keys]));
      }
    }
    setContextMenu(null);
  };

  const selectAll = () => {
    const next: ConcreteSelection[] = [
      ...props.model.members.map((item) => ({ type: "member" as const, id: item.id })),
      ...props.model.surfaces.map((item) => ({ type: "surface" as const, id: item.id })),
      ...props.model.nodes.map((item) => ({ type: "node" as const, id: item.id })),
    ];
    commitSelections(next);
    setContextMenu(null);
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
    let active = after;

    if (
      before.length > 1 &&
      picked &&
      before.some((item) => selectionKey(item) === selectionKey(picked))
    ) {
      active = before;
      publishSelections(before);
    }

    const width = 224;
    const height = picked ? 350 : 150;
    setContextMenu({
      x: Math.min(event.clientX, Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(event.clientY, Math.max(8, window.innerHeight - height - 8)),
      target: picked,
      selections: active,
    });
  };

  return (
    <div ref={hostRef} className={`thatOpenViewportToolHost ${viewToolActive ? "view-tool-active" : ""}`}
      onPointerDownCapture={handlePointerDownCapture}
      onContextMenu={handleContextMenu}>
      <ThatOpenViewportV07 {...props} model={viewportModel} onSelect={handleSelect} />

      {contextMenu ? (
        <div className="viewportContextMenu" style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu" aria-label={contextMenu.target ? "Selection context menu" : "Viewport context menu"}
          onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
          <div className="viewportContextMenuHeader">
            {contextMenu.target ? `${contextMenu.selections.length || 1} selected` : "Viewport"}
          </div>
          {contextMenu.target ? (
            <>
              <button type="button" role="menuitem" onClick={openProperties}>Properties</button>
              <button type="button" role="menuitem" onClick={openProperties}>Assign Section / Material / Level</button>
              <div className="viewportContextDivider" />
              <button type="button" role="menuitem" onClick={() => runEditorCommand("Move")}>Move</button>
              <button type="button" role="menuitem" onClick={() => runEditorCommand("Copy")}>Copy</button>
              <div className="viewportContextDivider" />
              <button type="button" role="menuitem" onClick={() => applyVisibility("isolate")}>Isolate Selection</button>
              <button type="button" role="menuitem" onClick={() => applyVisibility("hide")}>Hide Selection</button>
              <button type="button" role="menuitem" onClick={() => applyVisibility("show-all")}>Show All</button>
              <div className="viewportContextDivider" />
              <button type="button" role="menuitem" className="viewportContextDanger"
                onClick={() => runEditorCommand("Delete selected")}>Delete Selection</button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={selectAll}>Select All</button>
              <button type="button" role="menuitem" onClick={() => { props.onSelect(null); setContextMenu(null); }}>Clear Selection</button>
              <button type="button" role="menuitem" onClick={() => applyVisibility("show-all")}>Show All</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
