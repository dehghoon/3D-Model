"use client";

import { useEffect, useRef, useState } from "react";
import type { StructuralModel } from "@linkoteq/structural-core";

import type { EditorSelection } from "../lib/editor/selection";
import ThatOpenViewportV07 from "./ThatOpenViewportV07";

interface Props {
  model: StructuralModel;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onMultiSelect?: (
    selections: Array<Exclude<EditorSelection, null>>,
  ) => void;
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
  const [viewToolActive, setViewToolActive] = useState(false);

  useEffect(() => {
    const activateView = () => setViewToolActive(true);
    const deactivateView = () => setViewToolActive(false);
    const handleToolClick = (event: MouseEvent) => {
      if (isNonViewToolButton(event.target)) deactivateView();
    };

    window.addEventListener("linkoteq:view-cycle", activateView);
    window.addEventListener("linkoteq:view-select", deactivateView);
    document.addEventListener("click", handleToolClick, true);

    return () => {
      window.removeEventListener("linkoteq:view-cycle", activateView);
      window.removeEventListener("linkoteq:view-select", deactivateView);
      document.removeEventListener("click", handleToolClick, true);
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

  return (
    <div
      ref={hostRef}
      className={`thatOpenViewportToolHost ${
        viewToolActive ? "view-tool-active" : ""
      }`}
    >
      <ThatOpenViewportV07 {...props} />
    </div>
  );
}
