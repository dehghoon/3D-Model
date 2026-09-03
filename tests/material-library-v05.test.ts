import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("material reference library is reference-only", () => {
  const src = source("lib/material-reference-library-v05.ts");
  for (const token of [
    "ASTM A992",
    "CSA G40.21 350W",
    "ACI 318 Normal-Weight Concrete",
    "Douglas Fir-Larch",
    "CSA O86 / NLGA",
  ]) {
    assert.match(src, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(src, /analysis\s*:/);
  assert.doesNotMatch(src, /\bE\s*:\s*\{/);
  assert.doesNotMatch(src, /\brho\s*:\s*\{/);
});

test("material panel supports edit copy templates and modeling defaults", () => {
  const src = source("components/MaterialQuickPanelV05.tsx");
  assert.match(src, />Edit</);
  assert.match(src, />Copy</);
  assert.match(src, /North American Reference Library/);
  assert.match(src, /Default Material/);
  assert.match(src, /Default Section/);
  assert.match(src, /setModelingDefaults/);
  assert.match(src, /AssignmentPropertiesV05/);
  assert.match(src, /MATERIAL_E/);
  assert.match(src, /MATERIAL_G/);
  assert.match(src, /MATERIAL_NU/);
  assert.match(src, /MATERIAL_RHO/);
});

test("modeling default preferences stay in Core-compatible project metadata", () => {
  const src = source("lib/modeling-default-preferences-v05.ts");
  assert.match(src, /Record<string, string \| number \| boolean \| null>/);
  assert.match(src, /defaultMaterialId/);
  assert.match(src, /defaultSectionId/);
  assert.match(src, /DEFAULT_MATERIAL_NOT_FOUND/);
  assert.match(src, /DEFAULT_SECTION_NOT_FOUND/);
});
