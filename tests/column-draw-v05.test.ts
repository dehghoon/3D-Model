import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("column draw resolves canonical defaults at activation time", () => {
  const tools = source("components/ModelToolsV05.tsx");

  assert.match(
    tools,
    /const resolvedMaterialId = materialId \|\| defaultMaterialId;/,
  );
  assert.match(
    tools,
    /const resolvedSectionId = sectionId \|\| defaultSectionId;/,
  );
  assert.match(
    tools,
    /beginMemberDraw\(\{[\s\S]*type: next as MemberType,[\s\S]*materialId: resolvedMaterialId,[\s\S]*sectionId: resolvedSectionId,/,
  );
});

test("member draw ignores the selection that existed before tool activation", () => {
  const tools = source("components/ModelToolsV05.tsx");

  assert.match(
    tools,
    /ignoredSelectionRef\.current = selectedNodeId \?\? null;/,
  );
  assert.match(
    tools,
    /if \(selectedNodeId === ignoredSelectionRef\.current\) \{[\s\S]*return;/,
  );
  assert.match(tools, /setMemberDrawStart\(snap\);/);
  assert.match(tools, /pick second point/);
});

test("column remains a canonical member tool", () => {
  const tools = source("components/ModelToolsV05.tsx");
  const controller = source("lib/editor/member-draw-controller.ts");

  assert.match(
    tools,
    /tool === "beam" \|\| tool === "column" \|\| tool === "brace"/,
  );
  assert.match(controller, /createMemberFromCanonicalRefs/);
  assert.match(controller, /startNodeId:/);
  assert.match(controller, /endNodeId:/);
});
