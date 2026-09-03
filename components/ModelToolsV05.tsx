"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MemberType, StructuralModel, SurfaceType } from "@linkoteq/structural-core";
import CiscSectionSelectorV05 from "./CiscSectionSelectorV05";
import LevelGridEditorV05 from "./LevelGridEditorV05";
import { createMemberFromCanonicalRefs } from "../lib/editor-modeling-v05";
import { createSurfaceFromCanonicalRefs } from "../lib/editor-surface-v05";
import {
  createDefaultPortalFrame,
  DEFAULT_CISC_DESIGNATION,
  loadApprovedCiscSections,
} from "../lib/cisc-section-library-v05";
import {
  getDefaultMaterialId,
  getDefaultSectionId,
} from "../lib/modeling-default-preferences-v05";

type Tool = "select" | "beam" | "column" | "brace" | "wall" | "slab";

interface Props {
  model: StructuralModel;
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

function isUninitializedModel(model: StructuralModel): boolean {
  return (
    model.nodes.length === 0 &&
    model.members.length === 0 &&
    model.surfaces.length === 0 &&
    model.materials.length === 0 &&
    model.sections.length === 0 &&
    model.levels.length === 0 &&
    model.grids.length === 0
  );
}

export default function ModelToolsV05({ model, selectedNodeId, onModelChange }: Props) {
  const [tool, setTool] = useState<Tool>("select");
  const [pickedNodeIds, setPickedNodeIds] = useState<string[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [status, setStatus] = useState("Select a modeling tool.");
  const initializingDefaultRef = useRef(false);
  const previousDefaultMaterialRef = useRef("");
  const previousDefaultSectionRef = useRef("");

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
        const defaultSection =
          sections.find(
            (item) => item.designation.toUpperCase() === DEFAULT_CISC_DESIGNATION,
          ) ?? sections[0];

        if (!defaultSection) {
          throw new Error("CISC_DEFAULT_SECTION_NOT_FOUND");
        }

        onModelChange(
          createDefaultPortalFrame(defaultSection),
          `Default portal frame restored with ${defaultSection.designation} from approved CISC dataset ${defaultSection.dataset_version}.`,
        );
      })
      .catch((error: unknown) => {
        initializingDefaultRef.current = false;
        setStatus(
          error instanceof Error
            ? error.message
            : "Approved CISC dataset could not be loaded.",
        );
      });
  }, [model, onModelChange]);

  useEffect(() => {
    setMaterialId((current) => {
      const previousDefault = previousDefaultMaterialRef.current;
      if (!current || current === previousDefault) return defaultMaterialId;
      return current;
    });
    previousDefaultMaterialRef.current = defaultMaterialId;
  }, [defaultMaterialId]);

  useEffect(() => {
    setSectionId((current) => {
      const previousDefault = previousDefaultSectionRef.current;
      if (!current || current === previousDefault) return defaultSectionId;
      return current;
    });
    previousDefaultSectionRef.current = defaultSectionId;
  }, [defaultSectionId]);

  const pickedLabel = useMemo(
    () => (pickedNodeIds.length ? pickedNodeIds.join(" -> ") : "None"),
    [pickedNodeIds],
  );

  function chooseTool(next: Tool) {
    setTool(next);
    setPickedNodeIds([]);

    if (next === "select") {
      setStatus("Selection mode.");
      return;
    }

    if (next === "wall" || next === "slab") {
      setStatus(
        `${next === "wall" ? "Wall" : "Slab"} tool: select boundary nodes in order, then finish.`,
      );
      return;
    }

    setStatus(`${next[0].toUpperCase()}${next.slice(1)} tool: select start and end nodes.`);
  }

  useEffect(() => {
    if (tool === "select" || !selectedNodeId) return;
    if (!model.nodes.some((node) => node.id === selectedNodeId)) return;

    setPickedNodeIds((current) => {
      if (current.includes(selectedNodeId)) return current;
      const next = [...current, selectedNodeId];

      if (isMemberTool && next.length === 2) {
        if (!materialId || !sectionId) {
          setStatus(
            "Choose approved canonical material and section records before creating a member.",
          );
          return next;
        }

        try {
          const result = createMemberFromCanonicalRefs(model, {
            type: tool as MemberType,
            startNodeId: next[0],
            endNodeId: next[1],
            materialId,
            sectionId,
          });
          onModelChange(
            result.model,
            `Created ${result.member.type} ${result.member.id} from viewport node picks.`,
          );
          setStatus(
            `Created ${result.member.type} ${result.member.id}. Select two nodes for another.`,
          );
          return [];
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "Member creation failed.");
          return [];
        }
      }

      setStatus(`${next.length} node${next.length === 1 ? "" : "s"} picked.`);
      return next;
    });
  }, [selectedNodeId, tool, model, isMemberTool, materialId, sectionId, onModelChange]);

  function finishSurface() {
    if (!isSurfaceTool || pickedNodeIds.length < 3) {
      setStatus("Select at least three distinct boundary nodes.");
      return;
    }

    try {
      const firstNode = model.nodes.find((node) => node.id === pickedNodeIds[0]);
      const sameLevel = Boolean(
        firstNode?.levelId &&
          pickedNodeIds.every(
            (id) => model.nodes.find((node) => node.id === id)?.levelId === firstNode.levelId,
          ),
      );
      const result = createSurfaceFromCanonicalRefs(model, {
        type: tool as SurfaceType,
        boundaryNodeIds: pickedNodeIds,
        ...(sameLevel && firstNode?.levelId ? { levelId: firstNode.levelId } : {}),
      });
      onModelChange(
        result.model,
        `Created ${result.surface.type} ${result.surface.id} from viewport boundary picks.`,
      );
      setPickedNodeIds([]);
      setStatus(`Created ${result.surface.type} ${result.surface.id}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Surface creation failed.");
    }
  }

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
              <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
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
              <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
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
            <p className="selectionText">{status}</p>
            <p className="selectionText">Picked: {pickedLabel}</p>
            {isSurfaceTool ? (
              <button
                className="primaryWide"
                onClick={finishSurface}
                disabled={pickedNodeIds.length < 3}
              >
                Finish {tool === "wall" ? "Wall" : "Slab"} ({pickedNodeIds.length})
              </button>
            ) : null}
            {pickedNodeIds.length ? (
              <button
                onClick={() => {
                  setPickedNodeIds([]);
                  setStatus("Node picks cleared.");
                }}
              >
                Clear Picks
              </button>
            ) : null}
          </>
        ) : (
          <p className="selectionText">Use the viewport to select model entities.</p>
        )}
      </section>
    </>
  );
}
