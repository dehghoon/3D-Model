import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("properties panel consumes the shared multi-selection set", () => {
  const properties = source("components/ElementProperties.tsx");
  const editor = source("components/StructuralEditorV06.tsx");

  assert.match(properties, /selections\?: ConcreteSelection\[\]/);
  assert.match(properties, /Common assignments/);
  assert.match(properties, /Multiple values/);
  assert.match(properties, /Selection references/);
  assert.match(editor, /usePublishedSelections/);
  assert.match(editor, /selectedMembers=\{selectedMembers\}/);
  assert.match(editor, /selectedSurfaces=\{selectedSurfaces\}/);
  assert.match(editor, /selectedNodes=\{selectedNodes\}/);
});

test("viewport context menu preserves selection-oriented commands", () => {
  const viewport = source("components/ThatOpenViewportV08.tsx");

  assert.match(viewport, /onContextMenu=\{handleContextMenu\}/);
  assert.match(viewport, /Properties/);
  assert.match(viewport, /Assign Section \/ Material \/ Level/);
  assert.match(viewport, /Isolate Selection/);
  assert.match(viewport, /Hide Selection/);
  assert.match(viewport, /Show All/);
  assert.match(viewport, /Delete Selection/);
  assert.match(viewport, /rightClickSelectionsRef/);
  assert.match(viewport, /publishSelections\(before\)/);
});

test("selection UX stylesheet is loaded by the root layout", () => {
  const layout = source("app/layout.tsx");
  const styles = source("app/editor-selection-ux.css");

  assert.match(layout, /editor-selection-ux\.css/);
  assert.match(styles, /\.propertiesSidePanel/);
  assert.match(styles, /\.viewportContextMenu/);
  assert.match(styles, /@media \(max-width: 720px\)/);
});
