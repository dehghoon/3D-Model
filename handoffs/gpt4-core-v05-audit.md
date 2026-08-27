# GPT-4 Core v0.5 Audit — 3D Model

Date: 2026-08-26
Repository: `dehghoon/3D-Model`
Core source of truth: `dehghoon/linkoteq-structural-core`
Current Core schema: `0.5`

## Executive finding
The current `3D-Model` implementation is not Core v0.5 compliant. It is still pinned to an old Structural Cor commit and hard-codes `schemaVersion: "0.2"` across model creation, project import, manual loads and Snow Calculator integration.

## Verified findings

### 1. Structural Core dependency is pinned to an old commit
`package.json` currently depends on:
```text
@linkoteq/structural-core: github:derhoon/linkoteq-structural-core#8051096350e044b15d052a57c633c652f42dbfdd
in the repository.

The authoritative Core repository now declares `0.5` as the current schema.

### 2. Structural model is explicitly created as Core 0.2
`components/StructuralEditor.tsx` creates the base model with:
```text
schemaVersion: "0.2"
```

Project open/import also normalizes incoming projects back to `"schemaVersion: \"0.2\""`.

### 3. Load manager is still Core v0.2
`components/LoadManager.tsx` visibly labels its UI `Load · Core v0.2` and creates/writes back `schemaVersion: "0.2"`.

Current manual load creation uses legacy generic load shapes and type values such as `area`, `line` and `nodal`. Core v0.5 defines explicit external load primitives: `NodalLoad`, `MemberPointLoad`, `MemberDistributedLoad`, `SurfacePressureLoad` and `SelfWeightLoad`.

### 4. Snow integration is calling the legacy Core route
@3D-Model/app/api/calculators/snow/route.ts` forwards to:
```text
POST <snow-calculator-origin>/api/v1/core/roof-snow
```
This is the legacy Snow Core v0.2 endpoint. The current Snow Calculator now exposes the canonical Core v0.5 endpoint:
```text
POST /api/v1/core/roof-snow/v0.5
```

### 5. Snow payload from 3D-Model is Core 0.2
`components/LoadManager.tsx` builds Snow requests with `modelSchemaVersion: "0.2"` and then forces the returned model back to `schemaVersion: "0.2"`.

### 6. Core v0.5 requires new model/analysis semantics
The migration must align 3D-Model with the current Core contract for at least:
- typed material analysis properties (`E`, `Ga, `nu`, `rho`, optional `fy`);
- typed section analysis properties (`A`, `Iy`, `Iz`, `J`);
- explicit six-DOF support/restraint semantics;
- member releases, behavior and local-axis orientation;
- explicit canonical load primitives;
- load cases and load combination semantics;
- stable IDs and provenance;
- analysis request modes: `linear-static`, `elastic-iterative`, `p-delta`;
- canonical analysis results, with member internal forces always in `member-local` axes.

### 7. PyNite boundary
No direct PyNite call was observed in the current 3D-Model repository artifacts inspected by GPT-4. This is correct architecturally.

Core v0.5 requires that any structural analysis must pass through the Core Analysis Adapter. PyNite is the reference engine for the first adapter but solver-native classes must not cross the platform integration boundary.

### 8. CI coverage is insufficient for Core migration
The current `.github/workflows/ci.yml` only runs:
- `npm install`
- `npm run typecheck`
- `npm run build`

There are no Core contract migration tests, no model schema round-trip tests, no Snow v0.5 integration test, and no analysis-adapter boundary tests.

## Status
Current stage: `Core v0.5 Migration Required`
Core compliance: `NO`
Production-ready under Core v0.5: `NO`


## Ownership and next action
Owner of migration implementation: `GPT-3`

Orchestration/verification: `GPT-4`

Next action:
3D-Model should be migrated at the Core integration boundary to v0.5. Preserve user/UI behavior where possible. Do not invent solver-specific schemas in the 3D-Model repo.

The migration should include:
1. update the `@linkoteq/structural-core` dependency to the current released Core reference;
2. migrate `STructuralModel` creation/import/save to 0.5;
3. replace legacy generic load records with Core v0.5 explicit load primitives;
4. migrate Snow integration to `/api/v1/core/roof-snow/v0.5`;
5. add/preserve `LoadSource` provenance and stable IDs;
6. add Core v0.5 contract/round-trip tests;
7. prepare the analysis call boundary to consume only canonical model data and return canonical results;
8. keep PyNite behind the Core Analysis Adapter boundary.
