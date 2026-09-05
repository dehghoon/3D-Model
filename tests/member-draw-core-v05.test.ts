import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("member drawing stays on Core canonical node/member helpers", () => {
  const controller = source("lib/editor/member-draw-controller.ts");

  assert.match(controller, /createNodeFromGlobalCoordinates/);
  assert.match(controller, /createMemberFromCanonicalRefs/);
  assert.match(controller, /findNodeAtPoint/);
  assert.match(controller, /startNodeId:\s*start\.nodeId/);
  assert.match(controller, /endNodeId:\s*end\.nodeId/);
  assert.match(controller, /materialId:\s*input\.materialId/);
  assert.match(controller, /sectionId:\s*input\.sectionId/);
  assert.match(controller, /MEMBER_DRAW_POINTS_MUST_BE_DISTINCT/);
});

test("member tools use the shared draw state and preserve surface creation", () => {
  const tools = source("components/ModelToolsV05.tsx");

  assert.match(tools, /beginMemberDraw/);
  assert.match(tools, /createMemberFromSnapPoints/);
  assert.match(tools, /continueMemberDraw/);
  assert.match(tools, /createSurfaceFromCanonicalRefs/);
  assert.match(tools, /selectedNodeId/);
  assert.doesNotMatch(tools, /selectedNoideId/);
  assert.doesNotMatch(tools, /levelId\s*:\s*\{\}/);
});

test("member draw state is separate from selection state", () => {
  const drawStore = source("lib/editor/member-draw-store.ts");

  assert.match(drawStore, /MemberDrawState/);
  assert.match(drawStore, /beginMemberDraw/);
  assert.match(drawStore, /cancelMemberDraw/);
  assert.doesNotMatch(drawStore, /selection-store/);
  assert.doesNotMatch(drawStore, /publishSelection/);
});
