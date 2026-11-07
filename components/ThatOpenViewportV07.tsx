"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildStructuralGuides, disposeStructuralGuides } from "../lib/visualization/structural-guides";
import type { StructuralModel } from "@linkoteq/structural-core";
import type { SapHandoff } from "../lib/import/sap2000-handoff";
import type { EditorSelection } from "../lib/editor/selection";
import {
  getPublishedSelections,
  usePublishedSelections,
  publishSelections,
} from "../lib/editor/selection-store";
import {
  cancelInteraction,
  getInteractionState,
  setCopyBase,
  setCopyPreview,
  setTransformMessage,
  useInteractionState,
} from "../lib/editor/interaction-store";
import { MEMBER_DRAW_PICK_EVENT, getModelingPointTool, setPointToolMessage, usePointToolState } from "../lib/editor/member-draw-events";
import { useMemberDrawState } from "../lib/editor/member-draw-store";
import { isTapGesture } from "../lib/visualization/mobile-picking";
import { wheelDollyStep, middlePanTruck } from "../lib/visualization/select-navigation";
import {
  selectMembersInWindow,
  type SelectionWindow,
} from "../lib/visualization/selection-window";
import {
  clearTransformPreview,
  createThatOpenRuntime,
  deltaBetween,
  disposeThatOpenRuntime,
  pickThatOpen,
  rebuildThatOpenScene,
  renderTransformPreview,
  renderModelingPreview,
  setThatOpenView,
  snapThatOpen,
  stepThatOpenAxis,
  stepThatOpenLevel,
  type ThatOpenRuntime,
  type ViewMode,
} from "../lib/visualization/that-open-runtime";

interface Props {
  model: StructuralModel;
  sapHandoff?: SapHandoff | null;
  onSapMemberSelect?: (id:string|null)=>void;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onMultiSelect?: (
    selections: Array<Exclude<EditorSelection, null>>,
  ) => void;
}

interface PointerStart {
  x: number;
  y: number;
  pointerType: string;
  pointerId: number;
}

type ConcreteSelection = Exclude<EditorSelection, null>;

const viewButtons: Array<[ViewMode, string, string]> = [
  ["front", "F", "Front"],
  ["left", "L", "Left"],
  ["right", "R", "Right"],
  ["bottom", "B", "Bottom"],
  ["3d", "3D", "3D"],
];

function selectionKey(selection: ConcreteSelection): string {
  return `${selection.type}:${selection.id}`;
}

function uniqueSelections(
  selections: ConcreteSelection[],
): ConcreteSelection[] {
  return Array.from(
    new Map(
      selections.map((item) => [selectionKey(item), item]),
    ).values(),
  );
}

function syncSelectionHighlight(
  runtime: ThatOpenRuntime,
  model: StructuralModel,
  selections: ConcreteSelection[],
): void {
  if (!runtime.build) return;

  const selectedKeys = new Set(selections.map(selectionKey));
  const membersById = new Map(model.members.map((member) => [member.id, member]));

  runtime.build.root.traverse((object) => {
    const tagged = object.userData.linkoteqSelection as
      | { type?: "node" | "member" | "surface"; id?: string }
      | undefined;
    if (!tagged?.type || !tagged.id) return;

    const mesh = object as THREE.Mesh;
    const material = mesh.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;

    const selected = selectedKeys.has(`${tagged.type}:${tagged.id}`);
    if (selected) {
      material.color.setHex(0xf97316);
      if (tagged.type === "surface") material.opacity = 0.72;
      return;
    }

    if (tagged.type === "member") {
      const member = membersById.get(tagged.id);
      material.color.setHex(member?.type === "column" ? 0x2563eb : 0x26734d);
      return;
    }

    if (tagged.type === "surface") {
      material.color.setHex(0x9ca3af);
      material.opacity = 0.48;
      return;
    }

    material.color.setHex(0x2563eb);
  });
}

export default function ThatOpenViewportV07({
  model,
  sapHandoff,
  onSapMemberSelect,
  selection,
  onSelect,
  onMultiSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ThatOpenRuntime | null>(null);
  const sourceLinesRef = useRef<THREE.LineSegments | null>(null);
  const sourceSelectRef = useRef(onSapMemberSelect);
  sourceSelectRef.current = onSapMemberSelect;
  const sourceHandoffRef = useRef(sapHandoff);
  sourceHandoffRef.current = sapHandoff;
  const modelRef = useRef(model);
  const selectionRef = useRef(selection);
  const onSelectRef = useRef(onSelect);
  const onMultiSelectRef = useRef(onMultiSelect);
  const toolModeRef = useRef<"select" | "view">("select");

  const interaction = useInteractionState();
  const pointTool = usePointToolState();
  const draw = useMemberDrawState();
  const [additive, setAdditive] = useState(false);
  const [subtract, setSubtract] = useState(false);
  const [windowPick, setWindowPick] = useState(false);
  const windowPickRef = useRef(false);
  windowPickRef.current = windowPick;
  const windowStartRef = useRef<{x:number;y:number}|null>(null);
  const additiveRef = useRef(false);
  additiveRef.current = additive;
  const subtractRef = useRef(false);
  subtractRef.current = subtract;
  const [runtimeError, setRuntimeError] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [toolMode, setToolMode] = useState<"select" | "view">("select");
  const [marquee, setMarquee] = useState<SelectionWindow | null>(null);
  const selectionCount = usePublishedSelections().length;

  const commitSelectionsFromToolbar = () => {
    const runtime = runtimeRef.current;
    onMultiSelectRef.current?.([]);
    if (!onMultiSelectRef.current) { onSelectRef.current(null); publishSelections([]); }
    if (runtime) syncSelectionHighlight(runtime, modelRef.current, []);
  };

  modelRef.current = model;
  selectionRef.current = selection;
  onSelectRef.current = onSelect;
  onMultiSelectRef.current = onMultiSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let runtime: ThatOpenRuntime;
    try {
      runtime = createThatOpenRuntime(container);
    } catch {
      setRuntimeError(true);
      return;
    }
    runtimeRef.current = runtime;
    // CameraControls must stay enabled for its update loop to apply programmatic
    // dolly/rotate/truck while editing. Disable only native mouse gestures.
    const nativeMouseButtons = { ...runtime.camera.controls.mouseButtons };
    const syncCameraMouseButtons = (mode: "select" | "view") => {
      const buttons = runtime.camera.controls.mouseButtons;
      // Some test runtimes provide a minimal camera-controls mock without mouseButtons.
      if (!buttons) {
        runtime.camera.controls.enabled = true;
        return;
      }
      if (mode === "select") {
        buttons.left = 0;
        buttons.middle = 0;
        buttons.right = 0;
      } else {
        Object.assign(buttons, nativeMouseButtons);
      }
      runtime.camera.controls.enabled = true;
    };
    syncCameraMouseButtons("select");
    const canvas = runtime.renderer.three.domElement;
    let start: PointerStart | null = null;
    const touches = new Map<number, { x: number; y: number }>();
    let pinching = false;
    const touchPair = () => {
      const [a, b] = [...touches.values()];
      return a && b ? { x: (a.x+b.x)/2, y: (a.y+b.y)/2, distance: Math.hypot(a.x-b.x,a.y-b.y) } : null;
    };
    const navigateTouch = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      const before = touchPair();
      if (event.type === "pointerdown" || event.type === "pointermove") touches.set(event.pointerId, {x:event.clientX,y:event.clientY});
      else touches.delete(event.pointerId);
      const after = touchPair();
      if (touches.size >= 2 || pinching) {
        start = null; setMarquee(null);
        if (touches.size >= 2) pinching = true;
        if (before && after && event.type === "pointermove" && toolModeRef.current === "select") {
          const controls = runtime.camera.controls;
          const scale = Math.max(controls.distance, 1) / Math.max(canvas.clientHeight, 1);
          void controls.truck((before.x-after.x)*scale, (after.y-before.y)*scale, false);
          if (before.distance > 0 && after.distance > 0) void controls.dolly(Math.log(after.distance/before.distance)*Math.max(controls.distance,1), false);
        }
        if (!touches.size) pinching = false;
      }
    };
    const preset = (event: Event) => { void setThatOpenView(runtime, (event as CustomEvent<ViewMode>).detail); };
    const fit = () => { void setThatOpenView(runtime, runtime.viewMode); };


    const commitSelections = (selections: ConcreteSelection[]) => {
      const unique = uniqueSelections(selections);

      if (onMultiSelectRef.current) {
        onMultiSelectRef.current(unique);
      } else {
        onSelectRef.current(unique.at(-1) ?? null);
        publishSelections(unique);
      }

      syncSelectionHighlight(runtime, modelRef.current, unique);
    };

    const resolveSnap = (event: PointerEvent) =>
      snapThatOpen(runtime, event, modelRef.current, selectionRef.current);

    // Keep left-button picking/marquee in Select mode while allowing
    // wheel zoom and middle-button pan without switching to View mode.
    let panPointer: { id: number; x: number; y: number } | null = null;
    let orbitPointer: { id: number; x: number; y: number } | null = null;
    const selectNavigationEnabled = () => toolModeRef.current === "select";
    const wheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const controls = runtime.camera.controls;
      void controls.dolly(wheelDollyStep(event.deltaY, event.deltaMode, canvas.clientHeight, controls.distance), false);
    };
    const middlePanDown = (event: PointerEvent) => {
      if (event.button !== 1 || !selectNavigationEnabled()) return;
      event.preventDefault();
      panPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
    };
    const middlePanMove = (event: PointerEvent) => {
      if (!panPointer || event.pointerId !== panPointer.id) return;
      event.preventDefault();
      const delta = middlePanTruck(panPointer, { x: event.clientX, y: event.clientY }, canvas.clientHeight, runtime.camera.controls.distance);
      void runtime.camera.controls.truck(delta.x, delta.y, false);
      panPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const orbitDown = (event: PointerEvent) => {
      if (event.button !== 2 || !selectNavigationEnabled()) return;
      event.preventDefault();
      orbitPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
    };
    const orbitMove = (event: PointerEvent) => {
      if (!orbitPointer || event.pointerId !== orbitPointer.id) return;
      event.preventDefault();
      const speed = 2 * Math.PI / Math.max(canvas.clientHeight, 1);
      void runtime.camera.controls.rotate(
        (orbitPointer.x - event.clientX) * speed,
        (orbitPointer.y - event.clientY) * speed,
        false,
      );
      orbitPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const orbitEnd = (event: PointerEvent) => {
      if (orbitPointer?.id !== event.pointerId) return;
      orbitPointer = null;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const preventContextMenu = (event: MouseEvent) => {
      if (selectNavigationEnabled()) event.preventDefault();
    };
    const middlePanEnd = (event: PointerEvent) => {
      if (panPointer?.id !== event.pointerId) return;
      panPointer = null;
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };
    const pointerDown = (event: PointerEvent) => {
      if (pinching || !event.isPrimary || event.button !== 0) return;
      canvas.setPointerCapture?.(event.pointerId);
      start = {
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
        pointerId: event.pointerId,
      };
    };

    const pointerMove = (event: PointerEvent) => {
      if (windowPickRef.current && windowStartRef.current) {
        setMarquee({start: windowStartRef.current, end: {x:event.clientX,y:event.clientY}});
        return;
      }
      const state = getInteractionState();

      if (getModelingPointTool()) {
        const snap = resolveSnap(event);
        renderModelingPreview(runtime, snap?.point);
        return;
      }

      if (state.mode === "copy-target") {
        setCopyPreview(resolveSnap(event));
        renderTransformPreview(runtime);
        return;
      }

      if (
        !start ||
        toolModeRef.current !== "select" ||
        state.mode !== "select"
      ) {
        return;
      }

      const distance = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      const threshold = start.pointerType === "touch" ? 14 : 6;
      if (distance < threshold) return;

      setMarquee({
        start: { x: start.x, y: start.y },
        end: { x: event.clientX, y: event.clientY },
      });
    };

    const pointerUp = async (event: PointerEvent) => {
      const origin = start;
      start = null;
      if (!origin || origin.pointerId !== event.pointerId) return;

      const source = sourceHandoffRef.current;
      if (source && sourceLinesRef.current) {
        const rect=canvas.getBoundingClientRect();
        const ndc=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
        const raycaster=new THREE.Raycaster();
        raycaster.params.Line={threshold:Math.max(0.12,runtime.camera.controls.distance*0.008)};
        raycaster.setFromCamera(ndc,runtime.camera.three);
        const hits=raycaster.intersectObject(sourceLinesRef.current,false);
        const member=hits[0]?.index === undefined ? null : source.geometryPreview.members[hits[0].index];
        sourceSelectRef.current?.(member?.sourceId ?? null);
        setMarquee(null);
        return;
      }
      const state = getInteractionState();
      if (windowPickRef.current && state.mode === "select" && !getModelingPointTool()) {
        const point = {x:event.clientX,y:event.clientY};
        if (!windowStartRef.current) {
          windowStartRef.current = point;
          setMarquee({start:point,end:point});
        } else {
          const windowSelection = {start:windowStartRef.current,end:point};
          const selected = selectMembersInWindow(modelRef.current,runtime.camera.three,canvas.getBoundingClientRect(),windowSelection);
          const keys = new Set(selected.map(selectionKey));
          const next = subtractRef.current
            ? getPublishedSelections().filter(item => !keys.has(selectionKey(item)))
            : additiveRef.current ? [...getPublishedSelections(),...selected] : selected;
          commitSelections(next);
          windowStartRef.current = null;
          setMarquee(null);
          setWindowPick(false);
          windowPickRef.current = false;
        }
        return;
      }
      const drawing = Boolean(getModelingPointTool());
      if ((drawing || state.mode !== "select") && !isTapGesture(
        origin.x, origin.y, event.clientX, event.clientY, origin.pointerType,
      )) return;

      if (drawing && getModelingPointTool() === "joist" && window.sessionStorage.getItem("linkoteq:joist-bay-mode") === "active") {
        const rect = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, runtime.camera.three);
        const model = modelRef.current;
        const nodeById = new Map(model.nodes.map(n=>[n.id,n.position]));
        const beamElevations = model.members.filter(m=>m.type==="beam").flatMap(m=>{
          const a=nodeById.get(m.startNodeId),b=nodeById.get(m.endNodeId);
          return a&&b&&Math.abs(a.z-b.z)<1e-5?[a.z]:[];
        });
        const levels = [...new Set(beamElevations)].sort((a,b)=>b-a);
        const candidates = levels.flatMap(z=>{
          const hit = new THREE.Vector3();
          return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-z),hit) ? [{x:hit.x,y:hit.y,z}] : [];
        });
        window.dispatchEvent(new CustomEvent("linkoteq:joist-bay-ray-pick",{detail:candidates}));
        return;
      }
      if (drawing) {
        const point = resolveSnap(event);
        if (point) {
          window.dispatchEvent(new CustomEvent(MEMBER_DRAW_PICK_EVENT, { detail: point }));
        } else {
          setPointToolMessage("No valid snap point at this location. Pick a node/grid/work plane or enter XYZ coordinates.");
        }
        return;
      }

      if (state.mode === "copy-base") {
        const point = resolveSnap(event);
        if (!point) {
          setTransformMessage("No valid base point. Pick a node/grid/work plane or enter XYZ coordinates.");
          return;
        }
        setCopyBase(point);
        setCopyPreview(point);
        renderTransformPreview(runtime);
        return;
      }

      if (state.mode === "copy-target") {
        const point = resolveSnap(event);
        if (!point || !state.base) {
          setTransformMessage("No valid target point. Pick a snap point or enter XYZ coordinates.");
          return;
        }
        setCopyPreview(point);
        const delta = deltaBetween(state.base.point, point.point);
        if (
          Math.abs(delta.x) +
            Math.abs(delta.y) +
            Math.abs(delta.z) <=
          1e-10
        ) {
          return;
        }

        window.dispatchEvent(
          new CustomEvent("linkoteq:copy-commit", {
            detail: { delta },
          }),
        );
        if (getInteractionState().mode === "select") clearTransformPreview(runtime);
        return;
      }

      if (toolModeRef.current === "view") {
        setMarquee(null);
        return;
      }

      const distance = Math.hypot(
        event.clientX - origin.x,
        event.clientY - origin.y,
      );
      const threshold = origin.pointerType === "touch" ? 14 : 6;

      if (distance >= threshold) {
        const windowSelection: SelectionWindow = {
          start: { x: origin.x, y: origin.y },
          end: { x: event.clientX, y: event.clientY },
        };

        const selected = selectMembersInWindow(
          modelRef.current,
          runtime.camera.three,
          canvas.getBoundingClientRect(),
          windowSelection,
        );

        const selectedKeys = new Set(selected.map(selectionKey));
        const combined = subtractRef.current
          ? getPublishedSelections().filter(item => !selectedKeys.has(selectionKey(item)))
          : event.shiftKey || additiveRef.current
            ? [...getPublishedSelections(), ...selected]
            : selected;

        commitSelections(combined);
        setMarquee(null);
        return;
      }

      if (
        !isTapGesture(
          origin.x,
          origin.y,
          event.clientX,
          event.clientY,
          origin.pointerType,
        )
      ) {
        return;
      }

      const picked = await pickThatOpen(runtime, event);
      if (subtractRef.current) {
        if (picked) commitSelections(getPublishedSelections().filter(item => selectionKey(item) !== selectionKey(picked)));
        setMarquee(null);
        return;
      }
      const toggle = event.ctrlKey || event.metaKey || event.shiftKey || additiveRef.current;

      if (toggle) {
        if (!picked) {
          setMarquee(null);
          return;
        }

        const current = getPublishedSelections();
        const key = selectionKey(picked);
        const alreadySelected = current.some(
          (item) => selectionKey(item) === key,
        );
        const next = alreadySelected
          ? current.filter((item) => selectionKey(item) !== key)
          : [...current, picked];

        commitSelections(next);
        setMarquee(null);
        return;
      }

      if (picked) {
        commitSelections([picked]);
        if (origin.pointerType === "touch") queueMicrotask(() => window.dispatchEvent(new Event("linkoteq:properties-open")));
      } else {
        commitSelections([]);
      }
      setMarquee(null);
    };

    const pointerCancel = () => {
      start = null;
      setMarquee(null);
      if (getModelingPointTool()) renderModelingPreview(runtime);
      else if (getInteractionState().mode === "copy-target") {
        setCopyPreview(null);
        renderTransformPreview(runtime);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      const state = getInteractionState();
      const wasSelecting = state.mode === "select";

      cancelInteraction();
      clearTransformPreview(runtime);
      setMarquee(null);

      if (wasSelecting) {
        commitSelections([]);
      }
    };

    const enableSelect = () => {
      toolModeRef.current = "select";
      syncCameraMouseButtons("select");
      setToolMode("select");
    };

    const enableView = () => {
      toolModeRef.current = "view";
      syncCameraMouseButtons("view");
      setToolMode("view");
    };

    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) canvas.addEventListener(type, navigateTouch as EventListener, true);
    window.addEventListener("linkoteq:view-fit", fit);
    window.addEventListener("linkoteq:view-preset", preset);
    canvas.addEventListener("wheel", wheelZoom, { passive: false });
    canvas.addEventListener("contextmenu", preventContextMenu);
    canvas.addEventListener("pointerdown", orbitDown);
    canvas.addEventListener("pointermove", orbitMove);
    canvas.addEventListener("pointerup", orbitEnd);
    canvas.addEventListener("pointercancel", orbitEnd);
    canvas.addEventListener("pointerleave", orbitEnd);
    canvas.addEventListener("pointerdown", middlePanDown);
    canvas.addEventListener("pointermove", middlePanMove);
    canvas.addEventListener("pointerup", middlePanEnd);
    canvas.addEventListener("pointercancel", middlePanEnd);
    canvas.addEventListener("pointerleave", middlePanEnd);
    canvas.addEventListener("pointerdown", pointerDown, { passive: true });
    canvas.addEventListener("pointermove", pointerMove, { passive: true });
    canvas.addEventListener("pointerup", pointerUp, { passive: true });
    canvas.addEventListener("pointercancel", pointerCancel, { passive: true });
    canvas.addEventListener("pointerleave", pointerCancel, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("linkoteq:view-select", enableSelect);
    window.addEventListener("linkoteq:view-cycle", enableView);

    return () => {
      canvas.removeEventListener("wheel", wheelZoom);
      canvas.removeEventListener("contextmenu", preventContextMenu);
      canvas.removeEventListener("pointerdown", orbitDown);
      canvas.removeEventListener("pointermove", orbitMove);
      canvas.removeEventListener("pointerup", orbitEnd);
      canvas.removeEventListener("pointercancel", orbitEnd);
      canvas.removeEventListener("pointerleave", orbitEnd);
      canvas.removeEventListener("pointerdown", middlePanDown);
      canvas.removeEventListener("pointermove", middlePanMove);
      canvas.removeEventListener("pointerup", middlePanEnd);
      canvas.removeEventListener("pointercancel", middlePanEnd);
      canvas.removeEventListener("pointerleave", middlePanEnd);
      for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) canvas.removeEventListener(type, navigateTouch as EventListener, true);
      window.removeEventListener("linkoteq:view-fit", fit);
      window.removeEventListener("linkoteq:view-preset", preset);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerCancel);
      canvas.removeEventListener("pointerleave", pointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("linkoteq:view-select", enableSelect);
      window.removeEventListener("linkoteq:view-cycle", enableView);
      disposeThatOpenRuntime(runtime);
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    rebuildThatOpenScene(runtime, model, selection);
    syncSelectionHighlight(runtime, model, getPublishedSelections());
    if (getModelingPointTool()) renderModelingPreview(runtime);
    else renderTransformPreview(runtime);
  }, [model, selection]);

  useEffect(() => {
    const runtime=runtimeRef.current;
    if (!runtime) return;
    if (sourceLinesRef.current) {
      runtime.scene.remove(sourceLinesRef.current);
      sourceLinesRef.current.geometry.dispose();
      (sourceLinesRef.current.material as THREE.Material).dispose();
      sourceLinesRef.current=null;
    }
    if (!sapHandoff) {
      if (runtime.build) runtime.build.root.visible=true;
      return;
    }
    const nodes=new Map(sapHandoff.geometryPreview.nodes.map(n=>[n.sourceId,n.position]));
    const coords:number[]=[];
    const pointCoords:number[]=[];
    for(const n of sapHandoff.geometryPreview.nodes){
      const p=n.position;
      if([p.x,p.y,p.z].every(Number.isFinite)) pointCoords.push(p.x,p.z,p.y);
    }
    for(const m of sapHandoff.geometryPreview.members){
      const a=nodes.get(m.startNodeId),b=nodes.get(m.endNodeId);
      if(!a||!b) continue;
      if(![a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite)) continue;
      coords.push(a.x,a.z,a.y,b.x,b.z,b.y);
    }
    // Render source geometry independently of the unvalidated Core model.
    // Keep points visible even when the imported file has no renderable frames.
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(coords,3));
    const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x0f766e}));
    const pointsGeometry=new THREE.BufferGeometry();
    pointsGeometry.setAttribute("position",new THREE.Float32BufferAttribute(pointCoords,3));
    const points=new THREE.Points(pointsGeometry,new THREE.PointsMaterial({
      color:0x2563eb,size:5,sizeAttenuation:false,depthTest:false,
    }));
    // Grid lines and labels share the same Linkoteq guide geometry and endpoints.
    const nativeGridGuides=buildStructuralGuides({...model,levels:[]},{showGridLines:true,sourceGridOnly:true});
    runtime.scene.add(nativeGridGuides);
    sourceLinesRef.current=lines;
    runtime.scene.add(lines);
    runtime.scene.add(points);
    if(runtime.build) runtime.build.root.visible=coords.length===0 && pointCoords.length===0;
    const bounds=new THREE.Box3();
    if(coords.length) bounds.expandByObject(lines);
    if(pointCoords.length) bounds.expandByObject(points);
    if(!bounds.isEmpty()){
      const center=bounds.getCenter(new THREE.Vector3());
      const size=bounds.getSize(new THREE.Vector3());
      const d=Math.max(size.x,size.y,size.z,8)*1.8;
      void runtime.camera.controls.setLookAt(center.x+d,center.y+d*0.72,center.z+d,center.x,center.y,center.z,false);
    } else {
      console.error("SAP2000_VIEWPORT_NO_RENDERABLE_GEOMETRY",{
        nodes:sapHandoff.geometryPreview.nodes.length,
        members:sapHandoff.geometryPreview.members.length,
      });
    }
    return ()=>{
      runtime.scene.remove(lines);
      runtime.scene.remove(nativeGridGuides);
      disposeStructuralGuides(nativeGridGuides);
      runtime.scene.remove(points);
      geometry.dispose();
      pointsGeometry.dispose();
      (lines.material as THREE.Material).dispose();
      (points.material as THREE.Material).dispose();
      if(sourceLinesRef.current===lines) sourceLinesRef.current=null;
      if(runtime.build) runtime.build.root.visible=true;
    };
  },[sapHandoff,model]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    toolModeRef.current = toolMode;
    // Keep camera updates active even during point picking, Move and Copy.
    // The Select-mode mouse mappings are disabled on initialization.
    runtime.camera.controls.enabled = true;

    if (pointTool.tool) {
      renderModelingPreview(runtime);
    } else if (interaction.mode === "copy-target") {
      renderTransformPreview(runtime);
    } else {
      clearTransformPreview(runtime);
    }
  }, [
    pointTool.tool,
    pointTool.points,
    draw.start,
    interaction.mode,
    interaction.base,
    interaction.preview,
    interaction.operation,
    toolMode,
  ]);

  const chooseView = (mode: ViewMode) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    setThatOpenView(runtime, mode);
    setViewMode(mode);
  };

  return (
    <div
      ref={containerRef}
      className="thatOpenViewport"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
      }}
      aria-label="That Open structural viewport"
    >
      {!pointTool.tool && interaction.mode === "select" ? <div className="viewportSelectionActions" style={{
        position:"absolute", top: 56, left: 12, right: 12, zIndex: 55,
        display:"flex", flexWrap:"wrap", alignItems:"center", gap: 6, pointerEvents:"none"
      }}>
        <button type="button" className={`viewportMultiSelect ${additive ? "active" : ""}`}
          style={{position:"static", pointerEvents:"auto", maxWidth:"none", whiteSpace:"nowrap"}}
          aria-pressed={additive} onClick={() => {setAdditive(value => !value);setSubtract(false);}}>
          {additive ? "Multiple selection ON" : "Multiple selection"} · {selectionCount} selected
        </button>
        <button type="button" aria-pressed={subtract} style={{pointerEvents:"auto"}}
          onClick={() => {setSubtract(value => !value);setAdditive(false);}}>
          {subtract ? "Deselect ON" : "Deselect"}
        </button>
        <button type="button" aria-pressed={windowPick} style={{pointerEvents:"auto"}}
          onClick={() => {windowStartRef.current=null;setMarquee(null);setWindowPick(value=>!value);}}>
          {windowPick ? "Window: pick 2 corners" : "Window select"}
        </button>
      </div> : null}
      {runtimeError ? (
        <div role="alert" style={{ position: "absolute", inset: 24, zIndex: 70,
          padding: 20, background: "#fff", color: "#0f172a" }}>
          <strong>3D view could not start</strong>
          <p>WebGL is unavailable or the graphics renderer could not initialize.
            Enable hardware acceleration or try another browser, then reload.
            You can still save your model.</p>
        </div>
      ) : null}
      <div
        className="viewportViewTools"
        aria-label="View orientation"
      >
        {viewButtons.map(([mode, icon, label]) => (
          <button
            key={mode}
            type="button"
            className={viewMode === mode ? "active" : ""}
            title={`${label} view`}
            aria-label={`${label} view`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => chooseView(mode)}
          >
            {icon}
          </button>
        ))}
      </div>

      {viewMode !== "3d" ? (
        <div
          className="viewportReferenceNavigator"
          aria-label="Reference navigation"
        >
          <button
            type="button"
            title="Previous axis"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              runtimeRef.current &&
              stepThatOpenAxis(
                runtimeRef.current,
                modelRef.current,
                -1,
              )
            }
          >
            ←
          </button>
          <span>Axis</span>
          <button
            type="button"
            title="Next axis"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              runtimeRef.current &&
              stepThatOpenAxis(
                runtimeRef.current,
                modelRef.current,
                1,
              )
            }
          >
            →
          </button>

          <button
            type="button"
            title="Previous level"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              runtimeRef.current &&
              stepThatOpenLevel(
                runtimeRef.current,
                modelRef.current,
                -1,
              )
            }
          >
            ↓
          </button>
          <span>Level</span>
          <button
            type="button"
            title="Next level"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              runtimeRef.current &&
              stepThatOpenLevel(
                runtimeRef.current,
                modelRef.current,
                1,
              )
            }
          >
            ↑
          </button>
        </div>
      ) : null}

      {marquee ? (
        <div
          className={`viewportSelectionWindow ${
            marquee.end.x < marquee.start.x
              ? "crossing"
              : "contained"
          }`}
          style={{
            left: Math.min(marquee.start.x, marquee.end.x) - (containerRef.current?.getBoundingClientRect().left ?? 0),
            top: Math.min(marquee.start.y, marquee.end.y) - (containerRef.current?.getBoundingClientRect().top ?? 0),
            width: Math.abs(marquee.end.x - marquee.start.x),
            height: Math.abs(marquee.end.y - marquee.start.y),
          }}
          aria-hidden="true"
        />
      ) : null}

      <div className="viewportInteractionStatus">
        {interaction.mode === "select"
          ? toolMode === "select"
            ? `Select · Click, Ctrl/Cmd+Click, or drag window${
                selectionCount > 1
                  ? ` · ${selectionCount} selected`
                  : ""
              }`
            : "View · Orbit / Pan / Zoom"
          : interaction.message}
        {interaction.preview
          ? ` · ${interaction.preview.label}`
          : ""}
      </div>
    </div>
  );
}
