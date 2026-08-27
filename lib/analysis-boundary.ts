import type { AnalysisRequest, StructuralModel } from "@linkoteq/structural-core";
import { assertCanonicalV05 } from "./core-v05";

export type CoreAnalysisSubmission = {
  projectId: string;
  requestId: string;
  model: StructuralModel;
  request: AnalysisRequest;
};

export function buildAnalysisSubmission(
  projectId: string,
  model: StructuralModel,
  request: AnalysisRequest,
): CoreAnalysisSubmission {
  assertCanonicalV05(model);
  if (!projectId || !request.id) {
    throw new Error("ANALYSIS_IDENTITY_REQUIRED");
  }
  return { projectId, requestId: request.id, model, request };
}

// Solver implementations (including PyNite) are intentionally not imported here.
// This module only builds canonical Core v0.5 payloads for the Core Analysis Adapter.
