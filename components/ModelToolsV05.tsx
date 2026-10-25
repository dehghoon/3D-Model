"use client";
import { useEffect, useRef, useState } from "react";
import type { MemberType, StructuralModel } from "@linkoteq/structural-core";
import CiscSectionSelectorV05 from "./CiscSectionSelectorV05";
import LevelGridEditorV05 from "./LevelGridEditorV05";
import {
  createDefaultPortalFrame,
  DEFAULT_CISC_DESIGNATION,
  loadApprovedCiscSections,
} from "../lib/cisc-section-library-v05";
import {
  getDefaultMaterialId,
  getDefaultSectionId,
} from "../lib/modeling-default-preferences-v05";
import {
  beginMemberDraw,
  cancelMemberDraw,
  continueMemberDraw,
  getMemberDrawState,
  setMemberDrawStart,
  updateMemberDrawReferences,
} from "../lib/editor/member-draw-store";
import { createMemberFromSnapPoints } from "../lib/editor/member-draw-controller";
import { createSurfaceFromPoints } from "../lib/editor/surface-draw-controller";
import {
  cancelInteraction,
  type SnapPoint,
} from "../lib/editor/interaction-store";
import {
  MEMBER_DRAW_PICK_EVENT,
  MODELING_COMMAND_EVENT,
  SURFACE_FINISH_EVENT,
  getPointToolState,
  setModelingPointTool,
  setSurfacePoints,
  setPointToolMessage,
  usePointToolState,
} from "../lib/editor/member-draw-events";
import { assertCanonicalV05 } from "../lib/core-v05";

import {
  buildingLevels,
  simpleBoundary,
  type SimpleBuildingSettings,
} from "../lib/editor/simple-building";

type Tool = "select" | "beam" | "column" | "brace" | "wall" | "slab";
interface Props {
  model: StructuralModel;
  simple?: SimpleBuildingSettings;
  selectedNodeId?: string;
  onModelChange: (model: StructuralModel, status: string) => void;
}
const TOOLS: Array<{ id: Tool; label: string }> = [
  { id: "select", label: "Select" },
  { id: "beam", label: "Beam" },
  { id: "column", label: "Column" },
  { id: "brace", label: "Brace" },
  { id: "wall", label: "Wall" },
  { id: "slab", label: "Slab" },
];
function isUninitializedModel(model: StructuralModel) {
  return (
    !model.nodes.length &&
    !model.members.length &&
    !model.surfaces.length &&
    !model.materials.length &&
    !model.sections.length &&
    !model.levels.length &&
    !model.grids.length
  );
}
export default function ModelToolsV05({
  model,
  simple,
  selectedNodeId,
  onModelChange,
}: Props) {
  const pointState = usePointToolState();
  const tool = pointState.tool ?? "select";
  const [materialId, setMaterialId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [status, setStatus] = useState("Select a modeling tool.");
  const modelRef = useRef(model);
  const ignoredSelectionRef = useRef<string | null>(null);
  const initializingDefaultRef = useRef(false);
  const handlersRef = useRef<{
    choose: (tool: Tool) => void;
    pick: (point: SnapPoint) => void;
    finish: () => void;
  } | null>(null);
  modelRef.current = model;
  const isMemberTool = tool === "beam" || tool === "column" || tool === "brace";
  const isSurfaceTool = tool === "wall" || tool === "slab";
  const defaultMaterialId = getDefaultMaterialId(model);
  const defaultSectionId = getDefaultSectionId(model);
  useEffect(() => {
    if (!isUninitializedModel(model)) {
      initializingDefaultRef.current = false;
      return;
    }
    if (initializingDefaultRef.current) return;
    initializingDefaultRef.current = true;
    loadApprovedCiscSections()
      .then(({ sections }) => {
        if (!isUninitializedModel(modelRef.current)) return;
        const section =
          sections.find(
            (item) =>
              item.designation.toUpperCase() === DEFAULT_CISC_DESIGNATION,
          ) ?? sections[0];
        if (!section) throw new Error("CISC_DEFAULT_SECTION_NOT_FOUND");
        onModelChange(
          createDefaultPortalFrame(section),
          `Default portal frame restored with ${section.designation}.`,
        );
      })
      .catch((error: unknown) => {
        initializingDefaultRef.current = false;
        setStatus(
          error instanceof Error
            ? error.message
            : "Section catalog unavailable.",
        );
      });
  }, [model, onModelChange]);
  useEffect(() => {
    setMaterialId((current) =>
      model.materials.some((item) => item.id === current)
        ? current
        : defaultMaterialId,
    );
  }, [model.materials, defaultMaterialId]);
  useEffect(() => {
    setSectionId((current) =>
      model.sections.some((item) => item.id === current)
        ? current
        : defaultSectionId,
    );
  }, [model.sections, defaultSectionId]);
  useEffect(() => {
    updateMemberDrawReferences(
      materialId || defaultMaterialId,
      sectionId || defaultSectionId,
    );
  }, [materialId, sectionId, defaultMaterialId, defaultSectionId]);
  function cancel() {
    cancelInteraction();
    cancelMemberDraw();
    setModelingPointTool(null);
    ignoredSelectionRef.current = null;
  }
  function commit(next: StructuralModel, message: string) {
    assertCanonicalV05(next);
    modelRef.current = next;
    onModelChange(next, message);
    setStatus(message);
    setPointToolMessage(message);
  }
  function chooseTool(next: Tool) {
    cancel();
    window.dispatchEvent(new Event("linkoteq:view-select"));
    if (next === "select") return;
    const resolvedMaterialId = materialId || defaultMaterialId;
    const resolvedSectionId = sectionId || defaultSectionId;
    if (
      next !== "wall" &&
      next !== "slab" &&
      (!resolvedMaterialId || !resolvedSectionId)
    ) {
      setStatus("Choose an approved material and section before drawing.");
      setPointToolMessage(
        "Choose an approved material and section before drawing.",
      );
      return;
    }
    ignoredSelectionRef.current = selectedNodeId ?? null;
    setModelingPointTool(next);
    if (next !== "wall" && next !== "slab")
      beginMemberDraw({
        type: next as MemberType,
        materialId: resolvedMaterialId,
        sectionId: resolvedSectionId,
      });
  }
  function acceptPoint(snap: SnapPoint) {
    const active = getPointToolState();
    if (!active.tool) return;
    try {
      if (!Object.values(snap.point).every(Number.isFinite))
        throw new Error("Coordinates must be finite.");
      if (simple) {
        const { level, end } = buildingLevels(modelRef.current, simple);
        if (!level) throw new Error("Add a working floor first using Levels.");
        if (Math.abs(snap.point.z - level.elevation) > 1e-8)
          throw new Error(
            "Choose a point on the working floor, or use Advanced for other elevations.",
          );
        if (active.tool === "column") {
          if (!end) throw new Error("Add or choose a higher end floor first.");
          const result = createMemberFromSnapPoints(modelRef.current, {
            type: "column",
            materialId: materialId || defaultMaterialId,
            sectionId: sectionId || defaultSectionId,
            start: snap,
            end: { ...snap, point: { ...snap.point, z: end.elevation } },
          });
          commit(
            result.model,
            `Created column ${result.memberId} from ${level.name} to ${end.name}. Pick another column position.`,
          );
          return;
        }
        if (active.tool === "wall" || active.tool === "slab") {
          if (!active.points.length) {
            setSurfacePoints([snap]);
            return;
          }
          if (active.points.length > 1)
            throw new Error(
              "Review the boundary and Finish, or Undo point to redraw.",
            );
          const points = simpleBoundary(
            active.tool,
            active.points[0].point,
            snap.point,
            end?.elevation,
          );
          setSurfacePoints(
            points.map((point) => ({
              point,
              kind: "work-plane",
              label: "Building boundary",
            })),
          );
          setPointToolMessage(
            `Boundary preview ready. Finish ${active.tool} to create it, or Undo point to redraw.`,
          );
          return;
        }
      }
      if (active.tool === "wall" || active.tool === "slab") {
        if (
          active.points.some(
            (item) =>
              Math.hypot(
                item.point.x - snap.point.x,
                item.point.y - snap.point.y,
                item.point.z - snap.point.z,
              ) < 1e-8,
          )
        )
          throw new Error(
            "This boundary point is already selected. Choose another point or Finish.",
          );
        setSurfacePoints([...active.points, snap]);
        return;
      }
      const draw = getMemberDrawState();
      if (!draw.active || !draw.type) return;
      if (!draw.start) {
        setMemberDrawStart(snap);
        setPointToolMessage(
          "Start point set. Pick second point, enter coordinates/offsets, or choose an end level for a column.",
        );
        return;
      }
      const result = createMemberFromSnapPoints(modelRef.current, {
        type: draw.type,
        materialId: draw.materialId,
        sectionId: draw.sectionId,
        start: draw.start,
        end: snap,
      });
      commit(
        result.model,
        `Created ${draw.type} ${result.memberId}. Continue from the last point or Cancel.`,
      );
      continueMemberDraw(snap, result.memberId);
    } catch (error) {
      setPointToolMessage(
        error instanceof Error
          ? error.message === "MEMBER_DRAW_POINTS_MUST_BE_DISTINCT"
            ? "End point must differ from the start point."
            : error.message
          : "Point could not be used.",
      );
    }
  }
  function finishSurface() {
    const active = getPointToolState();
    if (active.tool !== "wall" && active.tool !== "slab") return;
    try {
      const result = createSurfaceFromPoints(
        modelRef.current,
        active.tool,
        active.points.map((item) => item.point),
      );
      commit(result.model, `Created ${active.tool} ${result.surface.id}.`);
      setSurfacePoints([]);
      setPointToolMessage(
        `Created ${active.tool} ${result.surface.id}. Pick points for another surface or Cancel.`,
      );
    } catch (error) {
      setPointToolMessage(
        error instanceof Error ? error.message : "Surface creation failed.",
      );
    }
  }
  handlersRef.current = {
    choose: chooseTool,
    pick: acceptPoint,
    finish: finishSurface,
  };
  useEffect(() => {
    const choose = (event: Event) => {
      const next = (event as CustomEvent<Tool>).detail;
      if (TOOLS.some((item) => item.id === next))
        handlersRef.current?.choose(next);
    };
    const pick = (event: Event) => {
      const point = (event as CustomEvent<SnapPoint>).detail;
      if (point?.point) handlersRef.current?.pick(point);
    };
    const finish = () => handlersRef.current?.finish();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener(MODELING_COMMAND_EVENT, choose);
    window.addEventListener(MEMBER_DRAW_PICK_EVENT, pick);
    window.addEventListener(SURFACE_FINISH_EVENT, finish);
    window.addEventListener("linkoteq:modeling-cancel", cancel);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener(MODELING_COMMAND_EVENT, choose);
      window.removeEventListener(MEMBER_DRAW_PICK_EVENT, pick);
      window.removeEventListener(SURFACE_FINISH_EVENT, finish);
      window.removeEventListener("linkoteq:modeling-cancel", cancel);
      window.removeEventListener("keydown", key);
      cancelMemberDraw();
      setModelingPointTool(null);
    };
  }, []);
  // Existing-node selection remains a compatibility path; canvas picks use the explicit point event.
  useEffect(() => {
    if (!selectedNodeId) return;
    if (selectedNodeId === ignoredSelectionRef.current) {
      return;
    }
    ignoredSelectionRef.current = selectedNodeId;
    const node = modelRef.current.nodes.find(
      (item) => item.id === selectedNodeId,
    );
    if (node)
      handlersRef.current?.pick({
        point: { ...node.position },
        kind: "node",
        label: `Node ${node.id}`,
      });
  }, [selectedNodeId]);
  return (
    <>
      <CiscSectionSelectorV05 model={model} onModelChange={onModelChange} />
      <LevelGridEditorV05 model={model} onModelChange={onModelChange} />

      <section className="panelBlock">
        <h3>Model Tools</h3>
        <div className="toolGrid twoCol">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              className={tool === item.id ? "active" : ""}
              onClick={() => chooseTool(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isMemberTool ? (
          <>
            <label>
              Material
              <select
                value={materialId}
                onChange={(event) => setMaterialId(event.target.value)}
              >
                <option value="">Select material</option>
                {model.materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Section
              <select
                value={sectionId}
                onChange={(event) => setSectionId(event.target.value)}
              >
                <option value="">Select section</option>
                {model.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.designation ?? section.id}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {tool !== "select" ? (
          <>
            <p className="selectionText">{pointState.message || status}</p>

            {isSurfaceTool ? (
              <>
                <p className="selectionText">
                  Picked:{" "}
                  {pointState.points
                    .map(
                      (point) =>
                        `(${point.point.x}, ${point.point.y}, ${point.point.z})`,
                    )
                    .join(" → ") || "None"}
                </p>
                <button
                  className="primaryWide"
                  onClick={finishSurface}
                  disabled={pointState.points.length < 3}
                >
                  Finish {tool === "wall" ? "Wall" : "Slab"} (
                  {pointState.points.length})
                </button>
              </>
            ) : null}
          </>
        ) : (
          <p className="selectionText">
            Use the viewport to select model entities.
          </p>
        )}
      </section>
    </>
  );
}
