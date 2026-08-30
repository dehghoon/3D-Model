import assert from "node:assert/strict";
import test from "node:test";

import type { StructuralModel } from "@linkoteq/structural-core";
import { deleteSelection } from "../lib/editor/commands";
import {
  addPickedEntityId,
  clearTemporaryInteraction,
  createInitialInteractionState,
  setActiveTool,
  setHovered,
  setSelection,
} from "../lib/editor/interaction-state";
import { createSelection } from "../lib/editor/selection";

function modelFixture(): StructuralModel {
  return {
    schemaVersion: "0.5",
    project: { id: "PROJECT001", name: "Editor Command Test", units: "SI" },
    levels: [],
    grids: [],
    nodes: [
      { id: "N1", position: { x: 0, y: 0, z: 0 } },
      { id: "N2", position: { x: 4, y: 0, z: 0 } },
    ],
    members: [],
    surfaces: [],
    diaphragms: [],
    materials: [],
    sections: [],
    supports: [],
    loadSources: [],
    loadCases: [],
    loads: [],
    loadCombinations: [],
  } as StructuralModel;
}

test("initial interaction state starts in select mode", () => {
  assert.deepEqual(createInitialInteractionState(), {
    activeTool: "select",
    selection: null,
    hovered: null,
    pickedEntityIds: [],
  });
});

test("interaction state keeps temporary picks separate from selection", () => {
  const selected = createSelection("node", "N1");
  const hovered = createSelection("node", "N2");

  let state = createInitialInteractionState();
  state = setSelection(state, selected);
  state = setHovered(state, hovered);
  state = addPickedEntityId(state, "N1");
  state = addPickedEntityId(state, "N1");

  assert.deepEqual(state.selection, selected);
  assert.deepEqual(state.hovered, hovered);
  assert.deepEqual(state.pickedEntityIds, ["N1"]);

  const cleared = clearTemporaryInteraction(state);
  assert.deepEqual(cleared.selection, selected);
  assert.equal(cleared.hovered, null);
  assert.deepEqual(cleared.pickedEntityIds, []);
});

test("changing tools clears command-local picks", () => {
  let state = createInitialInteractionState();
  state = addPickedEntityId(state, "N1");
  state = setActiveTool(state, "beam");

  assert.equal(state.activeTool, "beam");
  assert.deepEqual(state.pickedEntityIds, []);
});

test("deleteSelection removes an existing selected entity", () => {
  const model = modelFixture();
  const result = deleteSelection(model, createSelection("node", "N2"));

  assert.equal(result.deleted?.id, "N2");
  assert.deepEqual(result.model.nodes.map((node) => node.id), ["N1"]);
});

test("deleteSelection rejects missing and unknown selections", () => {
  const model = modelFixture();

  assert.throws(() => deleteSelection(model, null), /SELECTION_REQUIRED/);
  assert.throws(
    () => deleteSelection(model, createSelection("node", "N404")),
    /UNKNOWN_NODE:N404/,
  );
});
