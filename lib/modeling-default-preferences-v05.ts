import type { StructuralModel } from "@linkoteq/structural-core";

const DEFAULT_MATERIAL_KEY = "defaultMaterialId";
const DEFAULT_SECTION_KEY = "defaultSectionId";

function metadata(model: StructuralModel): Record<string, unknown> {
  return (model.project.metadata ?? {}) as Record<string, unknown>;
}

export function getDefaultMaterialId(model: StructuralModel): string {
  const value = metadata(model)[DEFAULT_MATERIAL_KEY];
  if (typeof value === "string" && model.materials.some((item) => item.id === value)) return value;
  return model.materials[0]?.id ?? "";
}

export function getDefaultSectionId(model: StructuralModel): string {
  const value = metadata(model)[DEFAULT_SECTION_KEY];
  if (typeof value === "string" && model.sections.some((item) => item.id === value)) return value;
  return model.sections[0]?.id ?? "";
}

export function setModelingDefaults(
  model: StructuralModel,
  values: { materialId?: string; sectionId?: string },
): StructuralModel {
  const nextMetadata: Record<string, unknown> = {
    ...metadata(model),
  };

  if (values.materialId !== undefined) {
    if (values.materialId && !model.materials.some((item) => item.id === values.materialId)) {
      throw new Error("DEFAULT_MATERIAL_NOT_FOUND");
    }
    if (values.materialId) nextMetadata[DEFAULT_MATERIAL_KEY] = values.materialId;
    else delete nextMetadata[DEFAULT_MATERIAL_KEY];
  }

  if (values.sectionId !== undefined) {
    if (values.sectionId && !model.sections.some((item) => item.id === values.sectionId)) {
      throw new Error("DEFAULT_SECTION_NOT_FOUND");
    }
    if (values.sectionId) nextMetadata[DEFAULT_SECTION_KEY] = values.sectionId;
    else delete nextMetadata[DEFAULT_SECTION_KEY];
  }

  return {
    ...model,
    project: {
      ...model.project,
      metadata: nextMetadata,
    },
  };
}
