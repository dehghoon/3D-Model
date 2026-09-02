import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelInteraction,
  getInteractionState,
  setCopyBase,
  setCopyPreview,
  startMoveInteraction,
} from "../lib/editor/interaction-store";
import { createSelection } from "../lib/editor/selection";

test("move interaction reuses snapped base-target workflow without changing selection identity", () => {
  cancelInteraction();
  const selection = createSelection("member", "M1");

  startMoveInteraction(selection);
  assert.equal(getInteractionState().mode, "copy-base");
  assert.equal(getInteractionState().operation, "move");
  assert.deepEqual(getInteractionState().selection, selection);

  const base = {
    point: { x: 0, y: 0, z: 0 },
    kind: "endpoint" as const,
    label: "Endpoint M1",
  };
  const target = {
    point: { x: 4, y: 0, z: 0 },
    kind: "grid" as const,
    label: "Grid 2/A",
  };

  setCopyBase(base);
  setCopyPreview(target);

  assert.equal(getInteractionState().mode, "copy-target");
  assert.equal(getInteractionState().operation, "move");
  assert.deepEqual(getInteractionState().base, base);
  assert.deepEqual(getInteractionState().preview, target);

  cancelInteraction();
});
