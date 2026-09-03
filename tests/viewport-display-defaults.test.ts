import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Quick Tools exposes viewport display controls and starts in View", () => {
  const shell = source("components/StructuralEditorShellV3.tsx");
  const display = source("components/ViewportDisplayOptionsV05.tsx");

  assert.match(shell, /useState<UtilityTool>\("View"\)/);
  assert.match(shell, /<ViewportDisplayOptionsV05 \/>/);

  for (const label of [
    "Extrude",
    "Nodes",
    "Node Numbers",
    "Member Numbers",
    "Supports",
    "Releases",
    "Grid",
    "Surfaces",
  ]) {
    assert.match(display, new RegExp(`label: "${label}"`));
  }

  assert.match(display, /linkoteq:view-cycle/);
});

test("Base support defaults restrain translations only", () => {
  const defaults = source("lib/base-support-defaults-v05.ts");

  assert.match(defaults, /level\.name\.trim\(\)\.toLowerCase\(\) === "base"/);
  assert.match(defaults, /DX: true/);
  assert.match(defaults, /DY: true/);
  assert.match(defaults, /DZ: true/);
  assert.match(defaults, /RX: false/);
  assert.match(defaults, /RY: false/);
  assert.match(defaults, /RZ: false/);
  assert.match(defaults, /createSupportFromCanonicalNode/);
});

test("default portal models and newly created Base nodes receive the support policy", () => {
  const portal = source("components/SelectedNodeSupportV05.tsx");
  const nodeCreator = source("components/NodeCreatorV05.tsx");

  assert.match(portal, /defaultModel !== "portal-frame"/);
  assert.match(portal, /applyDefaultBaseSupports\(model\)/);

  assert.match(nodeCreator, /applyDefaultBaseSupports\(result\.model/);
  assert.match(nodeCreator, /onlyNodeIds: new Set\(\[result\.node\.id\]\)/);
});

test("display options are wired into the active Core scene", () => {
  const scene = source("lib/visualization/core-scene-v2.ts");
  const displayScene = source("lib/visualization/display-options-scene.ts");

  assert.match(scene, /buildDisplayOptionOverlays\(model\)/);
  assert.match(scene, /subscribeDisplayOptions/);
  assert.match(scene, /applyDisplayOptionsToScene\(build\.root\)/);

  assert.match(displayScene, /options\.extrudedSections/);
  assert.match(displayScene, /options\.nodes/);
  assert.match(displayScene, /options\.nodeNumbers/);
  assert.match(displayScene, /options\.memberNumbers/);
  assert.match(displayScene, /options\.supports/);
  assert.match(displayScene, /options\.releases/);
  assert.match(displayScene, /options\.grids/);
  assert.match(displayScene, /options\.surfaces/);
});
