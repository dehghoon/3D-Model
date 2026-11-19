import type { StructuralModel } from "@linkoteq/structural-core";
import { assertCanonicalV06, readProjectV06 } from "../core-v06";
import { readSapHandoff, type SapHandoff } from "./sap2000-handoff";

/** Include the byte-exact source and unmapped engineering data in saved SAP projects. */
export function serializeSapProject(model: StructuralModel, source?: SapHandoff | null): string {
  assertCanonicalV06(model);
  const current = source && model.project.metadata?.sourceHash === source.sourceHash;
  return JSON.stringify(current ? {format:"linkoteq-project",model,sap2000Source:source} : model, null, 2);
}

export function readSapProject(value: unknown): {model:StructuralModel; source:SapHandoff|null} {
  const model = readProjectV06(value);
  const record = value as {format?:unknown;sap2000Source?:unknown};
  if (record?.format !== "linkoteq-project" || record.sap2000Source === undefined) return {model,source:null};
  const source = readSapHandoff(record.sap2000Source);
  if (model.project.metadata?.sourceHash !== source.sourceHash) throw new Error("SAP_PROJECT_SOURCE_HASH_MISMATCH");
  return {model,source};
}
