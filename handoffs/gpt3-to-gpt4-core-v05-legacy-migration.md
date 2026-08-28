# Core v0.5 Legacy Migration Handoff

## Scope

This handoff records the verified integration status of the 3D Model repository for legacy Core v0.2 project migration to the canonical Core v0.5 contract.

No engineering calculation logic, formulas, warnings, ratios, unit semantics, or applicability rules were recreated in this migration. The work is limited to the Core integration boundary, migration validation, and regression coverage.

## Canonical Source

- Core repository: `dehghoon/linkoteq-structural-core`
- Core contract: `0.5`
- Core contract file: `CORE_CONTRACT.md`
- 3D Model Core dependency ref: `a7c7103e46bb98035d907624b92ff8c21931f496`

## Verified Migration Behavior

The legacy import boundary migrates Core v0.2 projects to Core v0.5 and new saves use schema `0.5`. Regression coverage verifies:

- stable ID preservation across nodes, materials, sections, members, supports, surfaces, load sources, load cases, loads, and load combinations
- explicit material migration preserving canonical analysis properties, including `E`, `G`, `nu`, `rho`, and optional `fy`
- explicit section migration preserving `A`, `Iy`, `Iz`, and `J`
- load source migration with identity and provenance preservation
- load case and load combination migration with stable references
- legacy nodal, line, and area load conversion to canonical v0.5 load primitives only when the mapping is unambiguous
- explicit rejection of ambiguous, orphaned, missing-target, duplicate-ID, missing-material, and unsupported/lossy legacy shapes
- v0.5 round-trip identity through save/export and reopen/import
- Snow v0.5 integration preserving canonical `surface-pressure` output, units, and provenance, with lossy surface mapping rejected

## Analysis Boundary

The 3D Model domain does not call PyNite directly. The canonical boundary remains:

```text
3D Model -> Core Analysis Adapter -> PyNite -> Canonical Analysis Results
```

PyNite solver-native classes are not part of the 3D Model domain model.

## Verification Evidence

- Repository: `dehghoon/3D-Model`
- Branch: `main`
- Verified CI run: `#94`
- CI status: `SUCCESS`
- CI duration: `51s`
- Verified head commit: `f73c581aa42bcffb060fced9eef1230c2e32a2b6`
- `npm test`: `PASSED`
- `npm run typecheck`: `PASSED`
- `npm run build`: `PASSED`
- Public CI evidence did not surface a reliable test count, so no test count is claimed in this handoff.

## Remaining Blockers

- Preservation and verification of the legacy 3D editor UX after the `StructuralEditorV05` transition.
- Deployment verification.
- Production smoke test.

## Release Status

`Production Verification: NOT_COMPLETE`

The Core v0.5 legacy migration boundary is verified by the recorded CI gate, but production verification must not be marked complete until the remaining deployment, smoke, and legacy-editor UX verification work is completed.
