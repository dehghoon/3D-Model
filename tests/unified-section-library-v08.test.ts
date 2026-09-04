import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("editor loads a verified starter model on initial open", () => {
  const editor = source("components/StructuralEditorV07.tsx");
  const entry = source("components/StructuralEditorV05.tsx");
  const starter = source("lib/default-model-v05.ts");

  assert.match(entry, /StructuralEditorV07/);
  assert.match(editor, /createStarterModelV05\(\)/);
  assert.match(editor, /useState<StructuralModel>\(\(\) => createStarterModelV05\(\)\)/);
  assert.match(starter, /tests\/fixtures\/legacy-v02-project\.json/);
  assert.match(starter, /createDefaultPortalFrame/);
});

test("section library mounts exactly one unified dialog", () => {
  const wrapper = source("components/ElementProperties.tsx");

  assert.match(wrapper, /UnifiedSectionQuickPanelV08/);
  assert.doesNotMatch(wrapper, /ConcreteWoodSectionPanelV01/);
  assert.doesNotMatch(wrapper, /SectionQuickPanelV07/);
});

test("unified section library exposes steel concrete and wood workflows", () => {
  const panel = source("components/UnifiedSectionQuickPanelV08.tsx");

  assert.match(panel, />Steel</);
  assert.match(panel, />Concrete</);
  assert.match(panel, />Wood</);
  assert.match(panel, /CiscSectionSelectorV05/);
  assert.match(panel, /RC-RECT/);
  assert.match(panel, /WOOD-RECT/);
  assert.match(panel, /Rebar Layout/);
  assert.match(panel, /Top count/);
  assert.match(panel, /Bottom count/);
  assert.match(panel, /Column\/perimeter count/);
  assert.match(panel, /Canonical A, Iy, Iz, J, Zy and Zz are intentionally not derived in the viewer/);
  assert.match(panel, /Requires approved Agent #2 section-property engine/);
});
