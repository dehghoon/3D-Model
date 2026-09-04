import type { StructuralModel } from "@linkoteq/structural-core";
import {
  createDefaultPortalFrame,
  type CiscSectionRecord,
} from "./cisc-section-library-v05";

const VERIFIED_LEGACY_W310X39: CiscSectionRecord = {
  id: "SEC1",
  designation: "W310x39",
  designation_metric: "W310x39",
  designation_imperial: null,
  family: "W",
  source: "3D-Model/tests/fixtures/legacy-v02-project.json",
  dataset_version: "legacy-v02-verified-fixture",
  units: {
    length: "mm",
    area: "mm2",
    inertia: "mm4",
    section_modulus: "mm3",
  },
  properties: {
    gross_area: 4960,
    moment_of_inertia_major: 85000000,
    moment_of_inertia_minor: 8500000,
    torsional_constant: 185000,
    plastic_modulus_major: 550000,
  },
};

export function createStarterModelV05(): StructuralModel {
  return createDefaultPortalFrame(VERIFIED_LEGACY_W310X39);
}
