import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("concrete and wood section workflow preserves explicit analysis inputs", () => {
  const panel = source("components/ConcreteWoodSectionPanelV01.tsx");

  assert.match(panel, /RC-RECT/);
  assert.match(panel, /WOOD-RECT/);
  assert.match(panel, /shape:\s*"rectangular"/);
  assert.match(panel, /analysisCoupling:\s*"none"/);
  assert.match(panel, /longitudinalBars/);
  assert.match(panel, /reinforcementMaterialId/);
  assert.match(panel, /A:\s*\{\s*value:\s*finite\(A/);
  assert.doesNotMatch(panel, /width\s*\*\s*depth/);
});

test("rectangular concrete and wood sections use the centralized profile renderer", () => {
  const renderer = source("lib/visualization/section-profile-geometry.ts");

  assert.match(renderer, /RC-RECT/);
  assert.match(renderer, /WOOD-RECT/);
  assert.match(renderer, /solidRectShape/);
  assert.match(renderer, /shapeName\s*===\s*"rectangular"/);
});

test("snap toolbar exposes selectable transform snap modes", () => {
  const toolbar = source("components/SnapToolbarV01.tsx");
  const resolver = source("lib/visualization/snap-resolver.ts");
  const settings = source("lib/editor/snap-settings.ts");

  for (const label of ["End", "Middle", "Perpendicular", "Grid", "Node"]) {
    assert.match(toolbar, new RegExp(label));
  }

  for (const key of ["endpoint", "midpoint", "perpendicular", "grid", "node"]) {
    assert.match(settings, new RegExp(`${key}: boolean`));
  }

  assert.match(resolver, /getSnapSettings/);
  assert.match(resolver, /perpendicularCandidates/);
});

test("non-extruded selected members use selection-store highlighting", () => {
  const display = source("lib/visualization/display-options-scene.ts");

  assert.match(display, /getPublishedSelections/);
  assert.match(display, /SELECTED_COLOR/);
  assert.match(display, /LineBasicMaterial/);
  assert.match(display, /selectedMemberIds\.has\(member\.id\)/);
});
