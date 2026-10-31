# Advanced Model — Engineering Acceptance Checklist

Status: **NOT VERIFIED**. This checklist defines merge gates; checked items require linked test evidence, not merely implementation claims.

## Scope and principles
- Advanced Model supports **manual creation and editing independently** of Import Result. Import Result is an additional input path to the same canonical Core engineering model.
- Use released Structural Core contract as source of truth. Record potential missing Core capabilities in the [Core Gap Register](https://github.com/dehghoon/linkoteq-structural-core/blob/docs/consolidated-core-gap-register/docs/CORE_GAP_REGISTER.md); do not modify Core yet.
- Preserve source data and provenance; unknown or unsupported properties must be visible in fidelity diagnostics and never silently replaced. Display-only fallbacks must be labeled.
- Distinguish **implemented**, **tested**, **blocked**, and **not verified**. Evidence includes commit, test command/result, screenshots or reproduction, and Core contract reference.

## Acceptance gates
| ID | Area | Acceptance / test evidence required | Initial status |
|---|---|---|---|
| AM-01 | Core dependency | package.json, lockfile, project-status and actual contract version agree; build/typecheck passes | NOT VERIFIED; prior mismatch reported |
| AM-02 | Manual model creation | Add/edit beam, column, brace; pick both endpoints, enter absolute coordinates or relative ΔX/ΔY/ΔZ; column end level; correct connectivity | NOT VERIFIED |
| AM-03 | Selection / editing | Default Select, point/member pick, multi-select, Move/Copy using base and destination points; undo/redo if supported; correct model update | NOT VERIFIED; prior defects |
| AM-04 | Walls and slabs | Preview, create, edit, openings/geometry as applicable; correct Core surfaces | NOT VERIFIED; prior defects |
| AM-05 | Loads | Signed nodal FX/FY/FZ, MX/MY/MZ; member point/distributed loads with positions, local/global direction and units; surface loads; cases and combinations; validate invalid inputs | IN PR #5; TESTS PENDING |
| AM-06 | Releases and offsets | Six-DOF end releases, pin/fixed presets, member start/end, rigid offsets and sign conventions; round-trip | NOT VERIFIED |
| AM-07 | Diaphragms | Define/edit node memberships and slab-linked diaphragms; visualize, persist and round-trip | NOT VERIFIED |
| AM-08 | Supports and springs | Fixed/pinned/roller and custom six-DOF restraints, elastic springs and imposed displacements where supported; edit and round-trip | NOT VERIFIED |
| AM-09 | Sections and materials | Catalog selection from Core, custom values retained, assign/change section by clicking member; no silent fallback | NOT VERIFIED |
| AM-10 | Grids, levels and display | Visible offset grid labels including edge grids, display toggles, zoom/pan/select, responsive desktop/mobile | NOT VERIFIED; prior defects |
| AM-11 | Persistence | Save, reopen and compare geometry, IDs, releases, diaphragms, loads, supports, units, custom properties and provenance | NOT VERIFIED |
| AM-12 | IFC4 | Export valid IFC4; geometry, materials, sections, physical/analytical representation where supported; explicit omissions; validate by independent reader | NOT VERIFIED |
| AM-13 | Import Result adapter | SAP2000/ETABS/STAAD Import Result enters same Core model as manual creation; immediate preview; unresolved diagnostics; stable IDs and preservation | BLOCKED on GPT-2 validated output |
| AM-14 | Performance and UX | Smooth viewport and selection on representative large model; mobile touch/zoom/pan; no blocking UI regressions | NOT VERIFIED |
| AM-15 | Deployment | CI/typecheck/unit/regression/e2e tests, preview smoke tests and production readiness; verify actual deployed Core version | NOT VERIFIED |

## Evidence matrix to complete for each gate
- Core contract/version and relevant type:
- Test fixture (manual model and imported fixture if applicable):
- Exact expected behavior:
- Actual result and linked evidence:
- Status (PASS / FAIL / BLOCKED / NOT TESTED):
- Owner and follow-up PR:
- Core gap ID if genuinely missing:

## Merge and handoff policy
1. Finish and validate feature changes on draft PRs; do not merge untested changes.
2. Run complete end-to-end manual-model round-trip and IFC validation before Advanced Model release.
3. Importer-specific tests must wait for GPT-2 validated SAP2000/ETABS/STAAD artifacts; manual modeling must not wait.
4. Any confirmed Core gaps go into shared register; **no Core revision** until the importer has assessed all three formats and a consolidated proposal is approved.
5. Document residual limitations, Core compatibility and deployment evidence before merge.

This is an acceptance plan, **not a statement that tests passed**.
