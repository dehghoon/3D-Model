import assert from "node:assert/strict";
import test from "node:test";
import { readSapHandoff } from "../lib/importers/sap2000-handoff";

const sample = () => ({
  format: "linkoteq-sap2000-gpt3-handoff-v1",
  canonicalMappingValidated: false,
  analysisReady: false,
  geometryPreview: {
    sourceUnits: "kN, m", coordinatesConvertedToSI: false,
    nodes: [
      { sourceId: "J1", position: { x: 0, y: 0, z: 0 } },
      { sourceId: "J2", position: { x: 4, y: 0, z: 0 } },
    ],
    members: [{ sourceId: "F1", startNodeId: "J1", endNodeId: "J2", renderable: true }],
    grids: [], sourceLevels: [], inferredLevels: [],
  },
  engineeringData: { sourceLoads: [] },
  importFidelity: { sourceGridPreview: [] },
  diagnostics: { blockers: [] },
  sourceArchive: { filename: "example.$2k", encoding: "base64", bytesBase64: "QQ==", sha256: "abc" },
});

test("retains source geometry, connectivity and full handoff metadata", () => {
  const payload = sample();
  assert.equal(readSapHandoff(payload), payload);
  assert.equal(readSapHandoff(payload).geometryPreview.members[0].endNodeId, "J2");
});
test("rejects missing connectivity rather than silently dropping a frame", () => {
  const payload = sample();
  payload.geometryPreview.members[0].endNodeId = "MISSING";
  assert.throws(() => readSapHandoff(payload), /CONNECTIVITY_INVALID/);
});
test("never accepts an importer payload claiming analysis readiness", () => {
  const payload = sample();
  payload.analysisReady = true;
  assert.throws(() => readSapHandoff(payload), /UNEXPECTED_VALIDATION_STATUS/);
});
test("rejects nonfinite source coordinates", () => {
  const payload = sample();
  payload.geometryPreview.nodes[0].position.x = Infinity;
  assert.throws(() => readSapHandoff(payload), /NODE_INVALID/);
});
