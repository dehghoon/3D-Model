"use client";
import { useEffect, useRef } from "react";
import type { StructuralModel, Vec3 } from "@linkoteq/structural-core";
import { assertCanonicalV05 } from "../lib/core-v05";
import { deleteSelection } from "../lib/editor/commands";
import {
  finishCopyInteraction,
  getInteractionState,
  startCopyInteraction,
  startMoveInteraction,
  setTransformMessage,
} from "../lib/editor/interaction-store";
import { transformGroup } from "../lib/editor/group-transform";
import {
  getPublishedSelections,
  publishSelections,
} from "../lib/editor/selection-store";
import { UTILITY_COMMAND_EVENT } from "../lib/editor/member-draw-events";

type Utility = "Select" | "View" | "Copy" | "Move" | "Delete";
interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
}
export default function CopyInteractionBridgeV01({
  model,
  onModelChange,
}: Props) {
  const latest = useRef({ model, onModelChange });
  latest.current = { model, onModelChange };
  useEffect(() => {
    const commit = (event: Event) => {
      const state = getInteractionState();
      const delta = (event as CustomEvent<{ delta?: Vec3 }>).detail?.delta;
      if (state.mode !== "copy-target" || !delta || !state.operation) return;
      try {
        const result = transformGroup(
          latest.current.model,
          state.selections,
          delta,
          state.operation,
        );
        const message = `${state.operation === "move" ? "Moved" : "Copied"} ${state.selections.length} selected objects. Shared nodes transformed once. ${result.warnings.join(" ")}`;
        latest.current.model = result.model;
        publishSelections(result.selections);
        latest.current.onModelChange(result.model, message);
        finishCopyInteraction();
        setTransformMessage(message);
      } catch (error) {
        const raw =
          error instanceof Error ? error.message : "Transform failed.";
        const message =
          raw === "TRANSFORM_DELTA_ZERO"
            ? "Target point must differ from the base point."
            : raw === "TRANSFORM_DELTA_INVALID"
              ? "Enter finite X, Y and Z coordinates."
              : raw;
        setTransformMessage(message);
        latest.current.onModelChange(latest.current.model, message);
      }
    };
    const run = (tool: Utility) => {
      const selections = [...getPublishedSelections()];
      window.dispatchEvent(new Event("linkoteq:modeling-cancel"));
      window.dispatchEvent(
        new CustomEvent("linkoteq:utility-active", { detail: tool }),
      );
      if (tool === "Copy" || tool === "Move") {
        window.dispatchEvent(new Event("linkoteq:view-select"));
        if (tool === "Copy") startCopyInteraction(selections);
        else startMoveInteraction(selections);
      } else if (tool === "Select" || tool === "View") {
        window.dispatchEvent(
          new Event(
            tool === "View" ? "linkoteq:view-cycle" : "linkoteq:view-select",
          ),
        );
      } else {
        if (!selections.length) {
          setTransformMessage("Select objects before Delete.");
          return;
        }
        try {
          let next = latest.current.model;
          for (const selection of [...selections].sort(
            (a, b) => Number(a.type === "node") - Number(b.type === "node"),
          ))
            next = deleteSelection(next, selection).model;
          const ids = new Set(next.nodes.map((node) => node.id));
          if (
            next.surfaces.some((surface) =>
              surface.boundaryNodeIds.some((id) => !ids.has(id)),
            )
          )
            throw new Error(
              "Delete the connected surface before removing its boundary nodes.",
            );
          assertCanonicalV05(next);
          latest.current.model = next;
          publishSelections([]);
          latest.current.onModelChange(
            next,
            `Deleted ${selections.length} selected objects.`,
          );
        } catch (error) {
          latest.current.onModelChange(
            latest.current.model,
            error instanceof Error ? error.message : "Delete failed.",
          );
        }
      }
    };
    const command = (event: Event) => {
      const tool = (event as CustomEvent<Utility>).detail;
      if (["Select", "View", "Copy", "Move", "Delete"].includes(tool))
        run(tool);
    };
    // Compatibility for older quick-tool surfaces. New shell buttons use explicit commands.
    const click = (event: MouseEvent) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>(
              ".architectQuickActions button",
            )
          : null;
      if (!button || button.disabled || button.dataset.utilityCommand) return;
      const tool = button
        .querySelector("strong")
        ?.textContent?.trim() as Utility;
      if (!["Select", "View", "Copy", "Move", "Delete"].includes(tool)) return;
      event.preventDefault();
      event.stopPropagation();
      run(tool);
    };
    window.addEventListener("linkoteq:copy-commit", commit);
    window.addEventListener(UTILITY_COMMAND_EVENT, command);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("linkoteq:copy-commit", commit);
      window.removeEventListener(UTILITY_COMMAND_EVENT, command);
      document.removeEventListener("click", click, true);
    };
  }, []);
  return null;
}
