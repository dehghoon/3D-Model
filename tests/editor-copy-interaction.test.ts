import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelInteraction,
  getInteractionState,
  setCopyBase,
  setCopyPreview,
  startCopyInteraction,
} from "../lib/editor/interaction-store";
import { createSelection } from "../lib/editor/selection";

test("copy interaction follows select-base-target state sequence", () => {
  cancelInteraction();

  const selection = createSelection("member", "M1");
  startCopyInteraction(selection);

  assert.equal(getInteractionState().mode, "copy-base");
  assert.deepEqual(getInteractionState().selection, selection);

  const base = {
    point: { x: 0, y: 0, z: 0 },
    kind: "endpoint" as const,
    label: "Endpoint M1",
  };
  setCopyBase(base);

  assert.equal(getInteractionState().mode, "copy-target");
  assert.deepEqual(getInteractionState().base, base);

  const target = {
    point: { x: 4, y: 0, z: 0 },
    kind: "grid" as const,
    label: "Grid 2/A",
  };
  setCopyPreview(target);

  assert.deepEqual(getInteractionState().preview, target);

  cancelInteraction();
  assert.equal(getInteractionState().mode, "select");
});

test("copy interaction refuses to start without selection", () => {
  cancelInteraction();
  startCopyInteraction(null);

  assert.equal(getInteractionState().mode, "select");
  assert.match(getInteractionState().message, /Select an object before Copy/);
});
