# SAP2000 → Advanced Model integration gate (GPT-3)

Status: contract verified; importer payload and UI adapter NOT yet verified. Do not claim integration complete.

## Authoritative contracts
- Core: `dehghoon/linkoteq-structural-core` v0.6.0; `typescript/index.ts` and `CORE_CONTRACT.md`.
- Importer handoff reference: `dehghoon/linkoteq-structural-importer` commit `3d5432dd9556894dfc3e551ba4b46ddeea819d95` (reported by GPT-2; CI not verified).
- The app already depends on `@linkoteq/structural-core#v0.6.0` in package.json.

## Canonical mapping
- `StructuralModel.levels: Level[]`: `{id,name,elevation}`; preserve source table/line, original name, units, and explicit-vs-inferred provenance in an import sidecar. Never label inferred elevations as source stories.
- `StructuralModel.grids: GridLine[]`: `{id,label,start:{x,y,z},end:{x,y,z}}`; preserve original grid system, orientation, source table/line and source identifiers in sidecar. Verify coordinate transformations and units.
- `StructuralModel.nodes: Node[]`: `{id,position:{x,y,z},levelId?}`.
- `StructuralModel.members: Member[]`: `{id,type,startNodeId,endNodeId,sectionId,materialId,levelId?}`; preserve source IDs, rotations, releases, offsets and unsupported source properties; never silently invent valid analysis properties.

## Import protocol
1. Verify exact GPT-2 output shape and import fidelity diagnostics; do not fabricate an intermediate API contract.
2. Parse and validate full canonical payload before changing UI model state. Reject duplicate IDs, missing node references, nonfinite coordinates/elevations and unsupported schema versions.
3. Retain source archive and fidelity report separately from canonical engineering entities, with stable provenance mapping.
4. Convert units once at the boundary, preserving source units. Do not change global axes without a documented reversible transform.
5. Apply an atomic import into Advanced Model, preserving existing project until success; no partial mutation on error.
6. Render grids and level labels as independent display layers, selectable/toggleable without adding analytical members.
7. Render members from node references, retaining stable IDs and source links; never derive member geometry solely from grids.
8. Surface mapped/preserved/unsupported/invalid counts and substitutions; do not silently replace missing sections or materials.
9. Keep imported source data available on save/export, including unsupported features.

## Acceptance tests
- SAP model with explicit stories and rotated/offset grids.
- SAP model without stories: inferred levels visibly marked inferred.
- Nonuniform elevations and grids; correct absolute elevations.
- Columns crossing multiple levels; beams/braces with arbitrary Z.
- Original member IDs and references survive selection, edit and save.
- Duplicate names vs stable IDs; unit changes; nonfinite/invalid geometry.
- Unknown section: geometry visible with explicit unresolved/unverified status, not fabricated analysis section.
- Undo/reimport failure does not corrupt existing model.
- Browser display toggles, zoom/pan/select and no UI regression.
- npm test, typecheck, build, GitHub CI; record exact SHAs.

## Blocking dependencies
The importer level audit module location and finalized output payload have not yet been confirmed via GitHub. Mapping must be wired only after inspecting its real code and tests. No claim of finished integration or CI pass is authorized by this document.
