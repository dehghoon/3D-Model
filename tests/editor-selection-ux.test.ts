import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("properties panel composes Core v0.5 multi-selection editors", () => {
  const route = source("components/ElementProperties.tsx");
  const properties = source("components/ElementPropertiesV05.tsx");
  const assignments = source("components/AssignmentPropertiesV05.tsx");
  const members = source("components/MemberPropertiesV05.tsx");
  const nodes = source("components/NodeBoundaryPropertiesV05.tsx");
  const editor = source("components/StructuralEditorV06.tsx");

  assert.match(route, /ElementPropertiesV05/);
  assert.match(properties, /AssignmentPropertiesV05/);
  assert.match(properties, /MemberPropertiesV05/);
  assert.match(properties, /NodeBoundaryPropertiesV05/);
  assert.match(assignments, /Multiple values/);
  assert.match(assignments, /materialId/);
  assert.match(assignments, /sectionId/);
  assert.match(members, /rotationDeg/);
  assert.match(members, /startRelease/);
  assert.match(members, /endRelease/);
  assert.match(nodes, /SupportRestraints/);
  assert.match(nodes, /supportSprings/);
  assert.match(nodes, /enforcedNodeDisplacements/);
  assert.match(nodes, /tension-only/);
  assert.match(nodes, /compression-only/);
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

test("property editor styles are loaded by the root layout", () => {
  const layout = source("app/layout.tsx");
  const baseStyles = source("app/editor-selection-ux.css");
  const engineeringStyles = source("app/engineering-properties-v05.css");

  assert.match(layout, /editor-selection-ux\.css/);
  assert.match(layout, /engineering-properties-v05\.css/);
  assert.match(baseStyles, /\.propertiesSidePanel/);
  assert.match(engineeringStyles, /\.propertyActionCard/);
  assert.match(engineeringStyles, /\.propertyActionGrid/);
  assert.match(engineeringStyles, /@media \(max-width: 720px\)/);
});
