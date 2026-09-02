"use client";

import { useEffect, useRef } from "react";
import * as OBC from "@thatopen/components";
import * as THREE from "three";
import type { StructuralModel } from "@linkoteq/structural-core";
import type { EditorSelection } from "../lib/editor/selection";
import {
  buildCoreScene,
  disposeCoreScene,
  getObjectSelection,
  type CoreSceneBuild,
} from "../lib/visualization/core-scene-v2";

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

export default function ThatOpenViewportV02({
  model,
  selection,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
    };
    runtimeRef.current = runtime;

    let pointerStart:
      | { x: number; y: number; pointerType: string; pointerId: number }
      | null = null;

    const onPointerDown = (event: PointerEvent) => {
      pointerStart = {
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
        pointerId: event.pointerId,
      };
    };

    const onPointerCancel = () => {
      pointerStart = null;
    };

    const onPointerUp = async (event: PointerEvent) => {
      const start = pointerStart;
      pointerStart = null;
      if (!start || start.pointerId !== event.pointerId) return;

      const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      const tapTolerance = start.pointerType === "touch" ? 18 : 7;
      if (movement > tapTolerance) return;

      const current = runtimeRef.current;
      if (!current?.build) return;

      const hit = await current.caster.castRay({
        items: current.build.pickables,
      });

      onSelectRef.current(hit ? getObjectSelection(hit.object) : null);
    };

    container.addEventListener("pointerdown", onPointerDown, { passive: true });
    container.addEventListener("pointerup", onPointerUp, { passive: true });
    container.addEventListener("pointercancel", onPointerCancel, { passive: true });

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerCancel);

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
      (model.nodes.length || model.members.length || model.surfaces.length || model.grids.length)
    ) {
      fitCamera(runtime, build.root);
      runtime.fitted = true;
    }
  }, [model, selection]);

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
          padding: "5px 8px",
          borderRadius: 6,
          background: "rgba(255,255,255,0.88)",
          fontSize: 11,
          color: "#475569",
          boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
        }}
      >
        That Open · Touch / Pick / Orbit / Pan / Zoom
      </div>
    </div>
  );
}
