import React, { useCallback, useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ModelTools from "../../components/ModelToolsV05";
import Viewport from "../../components/ThatOpenViewportV07";
import Bridge from "../../components/CopyInteractionBridgeV01";
import { createStarterModelV05 } from "../../lib/default-model-v05";
import { assertCanonicalV05 } from "../../lib/core-v05";
import { publishSelection } from "../../lib/editor/selection-store";
import { getInteractionState } from "../../lib/editor/interaction-store";
import { getModelingPointTool } from "../../lib/editor/member-draw-events";
import type { StructuralModel } from "@linkoteq/structural-core";

export { act, getInteractionState, getModelingPointTool, publishSelection };
export function mount(host: HTMLElement) {
  let current = createStarterModelV05();
  const initial = structuredClone(current);
  const messages: string[] = [];
  function Harness() {
    const [model, setModel] = useState(current);
    const change = useCallback((next: StructuralModel, status: string) => {
      assertCanonicalV05(next);
      current = next;
      messages.push(status);
      setModel(next);
    }, []);
    return <>
      <ModelTools model={model} onModelChange={change} />
      <Viewport model={model} selection={null} onSelect={publishSelection} />
      <Bridge model={model} onModelChange={change} />
      <div className="architectQuickActions">{["Select", "View", "Copy", "Move"].map(label =>
        <button key={label}><strong>{label}</strong></button>)}</div>
    </>;
  }
  const root = createRoot(host);
  act(() => root.render(<Harness />));
  return { initial, model: () => current, messages, unmount: () => act(() => root.unmount()) };
}
