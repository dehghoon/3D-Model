import assert from "node:assert/strict";
import { test } from "node:test";
import { readSapSourcePreview, createSapPreviewDrawing } from "../lib/import/sap2000-source-preview";

const valid = () => ({
  contract: "linkoteq.import-result", version: "0.1.0", sourceFormat: "sap2000",
  coreMappingStatus: "not-validated", coreModel: null,
  source: { sourceHash: "a".repeat(64), originalFilename: "sample.s2k" },
  sourceUnitsDeclaration: "METER",
  sourceViews: {
    nodes: [
      {id:"n1",sourceId:"J1",coordinatesSourceUnits:["0","0","0"]},
      {id:"n2",sourceId:"J2",coordinatesSourceUnits:["4","0","3"]},
    ],
    frames: [{id:"f1",sourceId:"F1",startSourceId:"J1",endSourceId:"J2"}],
  },
  importFidelity: {
    sourceGridAudit: {sourceRecordCount:1,sourceRecords:[{rawRecord:"original grid"}]},
    sourceLevelAudit: {sourceRecordCount:1,sourceRecords:[{rawRecord:"original level"}]},
  },
  diagnostics: ["UNRESOLVED_SECTION"],
});

test("SAP preview keeps source IDs and raw audits; never exports a Core model", () => {
  const result = readSapSourcePreview(valid());
  assert.equal(result.analysisReady, false);
  assert.equal(result.kind, "sap2000-source-preview-not-analysis-ready");
  assert.equal(result.frames[0].startNodeId, "n1");
  assert.equal(result.nodes[1].positionSourceUnits.z, 3);
  assert.deepEqual(result.gridAudit, valid().importFidelity.sourceGridAudit);
  assert.deepEqual(result.levelAudit, valid().importFidelity.sourceLevelAudit);
  assert.equal(createSapPreviewDrawing(result).segments.length, 1);
  assert.equal("schemaVersion" in result, false);
});

test("rejects certified claims and unresolved connectivity", () => {
  const bad = valid();
  assert.throws(() => readSapSourcePreview({...bad,coreModel:{}}), /CONTRACT_REQUIRED/);
  assert.throws(() => readSapSourcePreview({...bad,sourceViews:{...bad.sourceViews,frames:[{id:"f1",sourceId:"F1",startSourceId:"J1",endSourceId:"missing"}]}}), /UNRESOLVED_FRAME_NODE/);
  assert.throws(() => readSapSourcePreview({...bad,sourceViews:{...bad.sourceViews,nodes:[...bad.sourceViews.nodes,{id:"n3",sourceId:"J1",coordinatesSourceUnits:["0","0","0"]}]}}), /DUPLICATE_NODE/);
  assert.throws(() => readSapSourcePreview({...bad,sourceViews:{...bad.sourceViews,nodes:[{id:"n1",sourceId:"J1",coordinatesSourceUnits:["NaN","0","0"]}]}}), /NON|SAP_PREVIEW_/);
});

test("hash-matched gate fidelity preserves source grids and levels", () => {
  const input = valid();
  const { importFidelity: _unused, ...bare } = input;
  const gate = {
    sourceHash: input.source.sourceHash, coreModel: null,
    canonicalMappingValidated: false, analysisReady: false,
    importFidelity: input.importFidelity,
  };
  const loaded = readSapSourcePreview({...bare, sap2000V06GateReport:gate});
  assert.deepEqual(loaded.gridAudit, input.importFidelity.sourceGridAudit);
  assert.deepEqual(loaded.levelAudit, input.importFidelity.sourceLevelAudit);
  assert.throws(() => readSapSourcePreview({...bare, sap2000V06GateReport:{...gate,sourceHash:"b".repeat(64)}}),/GATE_REPORT_MISMATCH/);
});
