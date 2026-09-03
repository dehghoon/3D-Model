import type { MaterialType } from "@linkoteq/structural-core";

export interface MaterialReferenceTemplateV05 {
  id: string;
  type: MaterialType;
  name: string;
  jurisdiction: "US" | "CA";
  standard: string;
  grade?: string;
  notes?: string;
}

export const MATERIAL_REFERENCE_LIBRARY_V05: readonly MaterialReferenceTemplateV05[] = [
  { id: "US-ASTM-A36", type: "steel", name: "ASTM A36", jurisdiction: "US", standard: "ASTM A36/A36M" },
  { id: "US-ASTM-A572-G50", type: "steel", name: "ASTM A572 Grade 50", jurisdiction: "US", standard: "ASTM A572/A572M", grade: "50" },
  { id: "US-ASTM-A992", type: "steel", name: "ASTM A992", jurisdiction: "US", standard: "ASTM A992/A992M", grade: "A992" },
  { id: "US-ASTM-A500-GC", type: "steel", name: "ASTM A500 Grade C", jurisdiction: "US", standard: "ASTM A500/A500M", grade: "C" },
  { id: "US-ASTM-A1085", type: "steel", name: "ASTM A1085", jurisdiction: "US", standard: "ASTM A1085/A1085M", grade: "A1085" },
  { id: "US-ASTM-A913-G65", type: "steel", name: "ASTM A913 Grade 65", jurisdiction: "US", standard: "ASTM A913/A913M", grade: "65" },

  { id: "CA-CSA-G40-21-300W", type: "steel", name: "CSA G40.21 300W", jurisdiction: "CA", standard: "CSA G40.21", grade: "300W" },
  { id: "CA-CSA-G40-21-350W", type: "steel", name: "CSA G40.21 350W", jurisdiction: "CA", standard: "CSA G40.21", grade: "350W" },
  { id: "CA-CSA-G40-21-380W", type: "steel", name: "CSA G40.21 380W", jurisdiction: "CA", standard: "CSA G40.21", grade: "380W" },
  { id: "CA-ASTM-A992", type: "steel", name: "ASTM A992", jurisdiction: "CA", standard: "ASTM A992/A992M", grade: "A992" },
  { id: "CA-ASTM-A500-GC", type: "steel", name: "ASTM A500 Grade C", jurisdiction: "CA", standard: "ASTM A500/A500M", grade: "C" },
  { id: "CA-ASTM-A913-G65", type: "steel", name: "ASTM A913 Grade 65", jurisdiction: "CA", standard: "ASTM A913/A913M", grade: "65" },

  { id: "US-ACI318-NWC", type: "concrete", name: "ACI 318 Normal-Weight Concrete", jurisdiction: "US", standard: "ACI 318", notes: "Enter project-approved analysis properties and concrete strength before saving." },
  { id: "CA-CSA-A23-3-NDC", type: "concrete", name: "CSA A23.3 Normal-Density Concrete", jurisdiction: "CA", standard: "CSA A23.3", notes: "Enter project-approved analysis properties and concrete strength before saving." },

  { id: "US-NDS-DFL", type: "wood", name: "Douglas Fir-Larch", jurisdiction: "US", standard: "AWC NDS" },
  { id: "US-NDS-SP", type: "wood", name: "Southern Pine", jurisdiction: "US", standard: "AWC NDS" },
  { id: "US-NDS-HF", type: "wood", name: "Hem-Fir", jurisdiction: "US", standard: "AWC NDS" },
  { id: "US-NDS-SPF", type: "wood", name: "Spruce-Pine-Fir", jurisdiction: "US", standard: "AWC NDS" },

  { id: "CA-O86-DFL-N", type: "wood", name: "D Fir-L (N)", jurisdiction: "CA", standard: "CSA O86 / NLGA" },
  { id: "CA-O86-HF-N", type: "wood", name: "Hem-Fir (N)", jurisdiction: "CA", standard: "CSA O86 / NLGA" },
  { id: "CA-O86-SPF", type: "wood", name: "S-P-F", jurisdiction: "CA", standard: "CSA O86 / NLGA" },
  { id: "CA-O86-NORTH", type: "wood", name: "North Species", jurisdiction: "CA", standard: "CSA O86 / NLGA" },
] as const;
