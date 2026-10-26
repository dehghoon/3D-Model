import React, { useCallback, useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ModelTools from "../../components/ModelToolsV05";
import Viewport from "../../components/ThatOpenViewportV07";
import PointInputPanel from "../../components/PointInputPanel";
import Shell from "../../components/StructuralEditorShellV3";
import Bridge from "../../components/CopyInteractionBridgeV01";
import { createStarterModelV05 } from "../../lib/default-model-v05";
import { assertCanonicalV05 } from "../../lib/core-v05";
import { publishSelection, publishSelections, getPublishedSelections } from "../../lib/editor/selection-store";
import { getInteractionState, cancelInteraction } from "../../lib/editor/interaction-store";
import { getModelingPointTool, setModelingPointTool, getPointToolState } from "../../lib/editor/member-draw-events";
import { cancelMemberDraw } from "../../lib/editor/member-draw-store";
import type { StructuralModel } from "@linkoteq/structural-core";

export { act, getInteractionState, getModelingPointTool, getPointToolState, publishSelection, publishSelections, getPublishedSelections };
let current: StructuralModel;
let messages: string[];
export function EditorHarness() {
  const [model,setModel]=useState(current);
  const change=useCallback((next:StructuralModel,status:string)=>{
    assertCanonicalV05(next);current=next;messages.push(status);setModel(next);
  },[]);
  return <div className="appShell"><aside className="toolbar"><ModelTools model={model} onModelChange={change}/></aside>
    <section className="viewport"><PointInputPanel model={model}/><Viewport model={model} selection={null} onSelect={publishSelection}/></section>
    <Bridge model={model} onModelChange={change}/></div>;
}
export function mount(host:HTMLElement){
  cancelInteraction();cancelMemberDraw();setModelingPointTool(null);publishSelections([]);
  current=createStarterModelV05();messages=[];
  const initial=structuredClone(current);
  const root=createRoot(host);
  act(()=>root.render(<Shell/>));
  act(()=>[...host.querySelectorAll<HTMLButtonElement>("button")].find(button=>button.textContent?.trim()==="Advanced Mode")!.click());
  return {initial,model:()=>current,messages,unmount:()=>act(()=>root.unmount())};
}
