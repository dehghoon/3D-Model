"use client";

import { useEffect, useRef } from "react";
import * as OBC from "@thatopen/components";
import * as THREE from "three";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import type { EditorSelection } from "../lib/editor/selection";
import {
  cancelInteraction,
  finishCopyInteraction,
  getInteractionState,
  setCopyBase,
  setCopyPreview,
  useInteractionState,
} from "../lib/editor/interaction-store";
import {
  buildCoreScene,
  disposeCoreScene,
  getObjectSelection,
  type CoreSceneBuild,
} from "../lib/visualization/core-scene-v2";
import {
  buildCopyPreview,
  disposeCopyPreview,
} from "../lib/visualization/copy-preview";
import { isTapGesture, pickSamples } from "../lib/visualization/mobile-picking";
import { resolveSnapPoint } from "../lib/visualization/snap-resolver";

interface Props {
  model: StructuralModel;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
}

interface Runtime {
  components: OBC.Components;
  scene: THREE.Scene;
  camera: OBC.OrthoPerspectiveCamera;
  caster: OBC.SimpleRaycaster;
  renderer: OBC.SimpleRenderer;
  build: CoreSceneBuild | null;
  fitted: boolean;
  transient: THREE.Group | null;
}

interface PointerStart {
  x: number;
  y: number;
  pointerType: string;
  pointerId: number;
}

function fitCamera(runtime: Runtime, root: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 8);
  const distance = Math.max(span * 1.8, 14);
  void runtime.camera.controls.setLookAt(
    center.x + distance,
    center.y + distance * 0.72,
    center.z + distance,
    center.x,
    center.y,
    center.z,
    false,
  );
}

function deltaBetween(base: Vec3, target: Vec3): Vec3 {
  return {
    x: target.x - base.x,
    y: target.y - base.y,
    z: target.z - base.z,
  };
}

function nonZero(delta: Vec3): boolean {
  return Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z) > 1e-10;
}

function clearTransient(runtime: Runtime): void {
  if (!runtime.transient) return;
  runtime.scene.remove(runtime.transient);
  disposeCopyPreview(runtime.transient);
  runtime.transient = null;
}

function addMarker(group: THREE.Group, point: Vec3): void {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 14, 14),
    new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      depthTest: false,
      depthWrite: false,
    }),
  );
  marker.position.set(point.x, point.z, point.y);
  marker.renderOrder = 120;
  group.add(marker);
}

function addGuideLine(group: THREE.Group, base: Vec3, target: Vec3): void {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(base.x, base.z, base.y),
    new THREE.Vector3(target.x, target.z, target.y),
  ]);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    }),
  );
  line.renderOrder = 119;
  group.add(line);
}

function renderCopyPreview(runtime: Runtime): void {
  clearTransient(runtime);
  const interaction = getInteractionState();
  if (
    interaction.mode !== "copy-target" ||
    !interaction.selection ||
    !interaction.base ||
    !interaction.preview ||
    !runtime.build
  ) {
    return;
  }

  const delta = deltaBetween(interaction.base.point, interaction.preview.point);
  const transient = new THREE.Group();
  transient.name = "linkoteq-copy-interaction-preview";

  if (nonZero(delta)) {
    const ghost = buildCopyPreview(runtime.build.root, interaction.selection, delta);
    if (ghost) transient.add(ghost);
  }

  addGuideLine(transient, interaction.base.point, interaction.preview.point);
  addMarker(transient, interaction.preview.point);
  runtime.scene.add(transient);
  runtime.transient = transient;
}

async function pickStructuralObject(
  runtime: Runtime,
  event: PointerEvent,
): Promise<EditorSelection> {
  if (!runtime.build) return null;

  const canvas = runtime.renderer.three.domElement;
  const rect = canvas.getBoundingClientRect();
  const samples = pickSamples(
    event.clientX,
    event.clientY,
    rect,
    event.pointerType,
  );

  for (const sample of samples) {
    const hit = await runtime.caster.castRay({
      items: runtime.build.pickables,
      position: sample.position,
    });
    if (!hit) continue;

    const selection = getObjectSelection(hit.object);
    if (selection) return selection;
  }

  return null;
}

export default function ThatOpenViewportV04({ model, selection, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const onSelectRef = useRef(onSelect);
  const modelRef = useRef(model);
  const selectionRef = useRef(selection);
  const interaction = useInteractionState();

  onSelectRef.current = onSelect;
  modelRef.current = model;
  selectionRef.current = selection;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const components = new OBC.Components();
    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<
      OBC.SimpleScene,
      OBC.OrthoPerspectiveCamera,
      OBC.SimpleRenderer
    >();

    world.scene = new OBC.SimpleScene(components);
    world.scene.setup();
    world.scene.three.background = new THREE.Color(0xf8fafc);
    world.renderer = new OBC.SimpleRenderer(components, container);
    world.camera = new OBC.OrthoPerspectiveCamera(components);
    components.init();
    world.camera.updateAspect();

    const caster = components.get(OBC.Raycasters).get(world);
    const runtime: Runtime = {
      components,
      scene: world.scene.three,
      camera: world.camera,
      caster,
      renderer: world.renderer,
      build: null,
      fitted: false,
      transient: null,
    };
    runtimeRef.current = runtime;

    const canvas = world.renderer.three.domElement;
    canvas.style.touchAction = "none";

    let pointerStart: PointerStart | null = null;

    const resolve = (event: PointerEvent) => {
      const current = runtimeRef.current;
      if (!current) return null;
      const state = getInteractionState();
      return resolveSnapPoint(
        { clientX: event.clientX, clientY: event.clientY },
        modelRef.current,
        state.selection ?? selectionRef.current,
        current.camera.three,
        current.renderer.three.domElement,
        event.pointerType === "touch" ? 30 : 13,
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      pointerStart = {
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
        pointerId: event.pointerId,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const state = getInteractionState();
      if (state.mode !== "copy-target") return;
      const snap = resolve(event);
      setCopyPreview(snap);
      const current = runtimeRef.current;
      if (current) renderCopyPreview(current);
    };

    const onPointerUp = async (event: PointerEvent) => {
      const start = pointerStart;
      pointerStart = null;
      if (!start || start.pointerId !== event.pointerId) return;
      if (!isTapGesture(start.x, start.y, event.clientX, event.clientY, start.pointerType)) {
        return;
      }

      const state = getInteractionState();

      if (state.mode === "copy-base") {
        const snap = resolve(event);
        if (!snap) return;
        setCopyBase(snap);
        setCopyPreview(snap);
        const current = runtimeRef.current;
        if (current) renderCopyPreview(current);
        return;
      }

      if (state.mode === "copy-target") {
        const snap = resolve(event);
        if (!snap || !state.base) return;
        const delta = deltaBetween(state.base.point, snap.point);
        if (!nonZero(delta)) return;

        window.dispatchEvent(
          new CustomEvent("linkoteq:copy-commit", {
            detail: { delta },
          }),
        );
        finishCopyInteraction();
        const current = runtimeRef.current;
        if (current) clearTransient(current);
        return;
      }

      const current = runtimeRef.current;
      if (!current) return;
      const picked = await pickStructuralObject(current, event);
      onSelectRef.current(picked);
    };

    const onPointerCancel = () => {
      pointerStart = null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelInteraction();
      const current = runtimeRef.current;
      if (current) clearTransient(current);
    };

    canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerup", onPointerUp, { passive: true });
    canvas.addEventListener("pointercancel", onPointerCancel, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);

      clearTransient(runtime);
      if (runtime.build) {
        runtime.scene.remove(runtime.build.root);
        disposeCoreScene(runtime.build.root);
      }
      components.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    if (runtime.build) {
      runtime.scene.remove(runtime.build.root);
      disposeCoreScene(runtime.build.root);
    }

    const build = buildCoreScene(model, selection);
    runtime.build = build;
    runtime.scene.add(build.root);

    if (
      !runtime.fitted &&
      (model.nodes.length ||
        model.members.length ||
        model.surfaces.length ||
        model.grids.length ||
        model.levels.length)
    ) {
      fitCamera(runtime, build.root);
      runtime.fitted = true;
    }

    renderCopyPreview(runtime);
  }, [model, selection]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    runtime.camera.controls.enabled = interaction.mode === "select";
    if (interaction.mode !== "copy-target") {
      clearTransient(runtime);
    } else {
      renderCopyPreview(runtime);
    }
  }, [interaction.mode, interaction.base, interaction.preview]);

  return (
    <div
      ref={containerRef}
      className="thatOpenViewport"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
        background: "#f8fafc",
      }}
      aria-label="That Open structural viewport"
    >
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 10,
          zIndex: 5,
          pointerEvents: "none",
          padding: "6px 9px",
          borderRadius: 6,
          background: "rgba(255,255,255,0.92)",
          fontSize: 11,
          color: "#475569",
          boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
          maxWidth: "80%",
        }}
      >
        {interaction.mode === "select"
          ? "That Open · Touch Select / Orbit / Pan / Zoom"
          : interaction.message}
        {interaction.preview ? ` · ${interaction.preview.label}` : ""}
      </div>
    </div>
  );
}
