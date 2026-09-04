import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Section quick tool is present and wired to the active canonical library panel", () => {
  const quickTools = source("components/ViewportDisplayOptionsV05.tsx");
  const wrapper = source("components/ElementProperties.tsx");

  assert.match(quickTools, /label="Section"/);
  assert.match(quickTools, /Open canonical section library/);
  assert.match(quickTools, /linkoteq:section-panel-open/);
  assert.match(wrapper, /SectionQuickPanelV07/);
});

test("CISC catalog uses the approved API and does not hardcode engineering records", () => {
  const adapter = source("lib/cisc-section-library-v05.ts");
  const proxy = source("app/api/cisc-sections/route.ts");

  assert.match(adapter, /APPROVED_CISC_DATASET_URL = "\/api\/cisc-sections"/);
  assert.match(proxy, /\/api\/v1\/sections/);
  assert.match(proxy, /CISC_SECTION_API_BASE_URL/);
  assert.match(adapter, /ciscRecordToCoreSection/);
  assert.match(adapter, /dataset_version/);
  assert.doesNotMatch(adapter, /family === "W"/);
  assert.doesNotMatch(adapter, /W14x|W310x39\s*:\s*\{/);
});

test("All approved CISC families are browsable while incomplete canonical records remain reference-only", () => {
  const selector = source("components/CiscSectionSelectorV05.tsx");
  const adapter = source("lib/cisc-section-library-v05.ts");

  assert.match(selector, /All families/);
  assert.match(selector, /Designation or family/);
  assert.match(selector, /reference only/);
  assert.match(selector, /isCiscRecordCoreAssignable/);
  assert.match(adapter, /moment_of_inertia_minor/);
  assert.match(adapter, /ciscRecordMissingCoreProperties/);
});

test("W-section verification remains isolated from the general CISC catalog", () => {
  const route = source("app/api/w-sections/route.ts");

  assert.match(route, /calculations\/w-section\/core/);
  assert.match(route, /W-section design service/);
  assert.doesNotMatch(route, /cisc-sections/);
});

test("Section library keeps AISC reference-only and preserves canonical editing", () => {
  const panel = source("components/SectionQuickPanelV07.tsx");

  assert.match(panel, /CiscSectionSelectorV05/);
  assert.match(panel, /AISC Reference Families/);
  assert.match(
    panel,
    /Reference only\. No AISC engineering properties are injected without an approved dataset\./,
  );
  assert.match(panel, /SECTION_A/);
  assert.match(panel, /SECTION_IY/);
  assert.match(panel, /SECTION_IZ/);
  assert.match(panel, /SECTION_J/);
  assert.match(panel, /previous\?\.geometry/);
  assert.match(panel, /previous\?\.libraryRef/);
  assert.match(panel, />Assign</);
  assert.match(panel, /Default Section/);
});
