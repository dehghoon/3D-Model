import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV05 } from "../lib/default-model-v05";
import { transformGroup } from "../lib/editor/group-transform";
import { getPublishedSelections, publishSelections } from "../lib/editor/selection-store";
import { getInteractionState, startCopyInteraction, startMoveInteraction, setCopyBase, cancelInteraction } from "../lib/editor/interaction-store";

test("multiple selection deduplicates members and is retained for Move", () => {
  const model = createStarterModelV05();
  assert.ok(model.members.length >= 2);
  const a = { type: "member" as const, id: model.members[0].id };
  const b = { type: "member" as const, id: model.members[1].id };
  publishSelections([a, b, a]);
  assert.deepEqual(getPublishedSelections(), [a, b]);
  startMoveInteraction(getPublishedSelections());
  assert.equal(getInteractionState().mode, "copy-base");
  assert.equal(getInteractionState().operation, "move");
  assert.equal(getInteractionState().selections.length, 2);
  setCopyBase({ point: { x: 0, y: 0, z: 0 }, kind: "work-plane", label: "origin" });
  assert.equal(getInteractionState().mode, "copy-target");
  cancelInteraction();
  publishSelections([]);
});

for (const operation of ["move", "copy"] as const) {
  test(`${operation} transforms two members and preserves original model immutability`, () => {
    const model = createStarterModelV05();
    assert.ok(model.members.length >= 2);
    const selections = model.members.slice(0, 2).map(member => ({ type: "member" as const, id: member.id }));
    const delta = { x: 20, y: 10, z: 0 };
    const result = transformGroup(model, selections, delta, operation);
    assert.equal(result.selections.length, 2);
    if (operation === "copy") {
      assert.equal(result.model.members.length, model.members.length + 2);
      for (const member of result.model.members.slice(-2)) {
        assert.ok(result.model.nodes.some(node => node.id === member.startNodeId));
        assert.ok(result.model.nodes.some(node => node.id === member.endNodeId));
      }
    } else {
      assert.equal(result.model.members.length, model.members.length);
      const nodeId = model.members[0].startNodeId;
      const before = model.nodes.find(node => node.id === nodeId)!.position;
      const after = result.model.nodes.find(node => node.id === nodeId)!.position;
      assert.deepEqual(after, { x: before.x + 20, y: before.y + 10, z: before.z });
    }
    assert.notEqual(result.model, model);
  });
}

test("Copy requires a selection and preserves selection through base-point step", () => {
  const model = createStarterModelV05();
  const selection = { type: "member" as const, id: model.members[0].id };
  startCopyInteraction([selection]);
  assert.equal(getInteractionState().mode, "copy-base");
  assert.deepEqual(getInteractionState().selections, [selection]);
  setCopyBase({ point: { x: 1, y: 2, z: 3 }, kind: "work-plane", label: "base" });
  assert.equal(getInteractionState().mode, "copy-target");
  assert.deepEqual(getInteractionState().selections, [selection]);
  cancelInteraction();
});
