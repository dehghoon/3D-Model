import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Section quick tool is present and wired to the canonical library panel", () => {
  const quickTools = source("components/ViewportDisplayOptionsV05.tsx");
  const wrapper = source("components/ElementProperties.tsx");

  assert.match(quickTools, /label="Section"/);
  assert.match(quickTools, /Open canonical section library/);
  assert.match(quickTools, /linkoteq:section-panel-open/);
  assert.match(wrapper, /SectionQuickPanelV05/);
  assert.match(wrapper, /linkoteq:section-panel-open/);
});

test("Section library reuses approved CISC data and keeps AISC reference-only", () => {
  const panel = source("components/SectionQuickPanelV05.tsx");

  assert.match(panel, /CiscSectionSelectorV05/);
  assert.match(panel, /AISC Reference Families/);
  assert.match(
    panel,
    /Reference only\. No AISC engineering properties are injected without an approved dataset\./,
  );
  assert.doesNotMatch(panel, /W14x|W310x|HSS8x8/);
});

test("Canonical Section editor exposes PyNite properties and preserves geometry", () => {
  const panel = source("components/SectionQuickPanelV05.tsx");

  assert.match(panel, /SECTION_A/);
  assert.match(panel, /SECTION_IY/);
  assert.match(panel, /SECTION_IZ/);
  assert.match(panel, /SECTION_J/);
  assert.match(panel, /previous\?\.geometry/);
  assert.match(panel, /previous\?\.libraryRef/);
  assert.match(panel, />Edit</);
  assert.match(panel, />Copy</);
  assert.match(panel, />Assign</);
  assert.match(panel, /Default Section/);
});

test("CISC adapter remains the approved source of CISC section properties", () => {
  const adapter = source("lib/cisc-section-library-v05.ts");

  assert.match(adapter, /ciscRecordToCoreSection/);
  assert.match(adapter, /analysis:/);
  assert.match(adapter, /libraryRef:/);
  assert.match(adapter, /dataset_version/);
});
