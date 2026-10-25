# Viewport modeling interaction repair

## Scope
Repository: dehghoon/3D-Model. Base: main. Core remains v0.5.

The active route resolves through StructuralEditorShellV2 -> StructuralEditorShellV3 -> StructuralEditorV05 -> StructuralEditorV07 -> ThatOpenViewportV01 -> ThatOpenViewportV03 -> ThatOpenViewportV08 -> ThatOpenViewportV07.

## Findings and changes
- The active viewport never dispatched the existing member-draw point event. Route tapped snap points into the modeling tools before ordinary selection. Hover now resolves snap candidates during drawing. Preserve normal selection outside drawing.
- Beam, column and brace reuse the existing canonical node/member creation controller. Slab and wall accept ordered snapped boundary points, reusing existing nodes or creating canonical nodes. Expose Finish in the visible shell, including Simple Mode.
- Tool switches cancel conflicting transform/draw state. Escape and project New/Open reset pending modeling state. Reject non-primary-button clicks and drag gestures as drawing/placement taps.
- Copy/Move use the source selection captured at activation. The bridge validates and acknowledges successful writeback; the viewport no longer finishes a failed operation unconditionally.
- Existing transform implementations operate on one entity. Reject multiple selections explicitly rather than silently modifying only the last selected entity. Group transforms are not implemented by this repair.
- Front/side orthographic rays parallel to the horizontal work plane now use a vertical construction plane. Grid snap candidates follow the selected elevation instead of always using z=0.
- Fix the starter model's misspelled `diaphhragms` collection to canonical `diaphragms`.

## Verification
- 25 focused tests pass: snapped member geometry, distinct endpoints, copy/move identity/reference preservation, wall/slab boundary references, front-view free-point picking, and existing drawing/transform/surface tests.
- Production Next.js build passes locally.
- Application-only TypeScript check passes using a scratch verification configuration excluding the pre-existing malformed test files.
- The installed pinned Core Git dependency lacked dist declarations after an install with scripts disabled. For local type verification, its exact pinned `typescript/index.ts` was fetched through the direct GitHub connector into node_modules as declarations. No package/dependency changes are included.
- Full suite on original main snapshot: 97 passed, 11 failed. With repair and six new regression cases: 104 passed, 10 failed. The fixed existing test is the no-selection Copy message. Remaining failures are pre-existing, including malformed test syntax, stale source assertions, legacy migration expectations, and selection-window expectations. They are not waived or represented as passing.

## Limits and release state
- Local geometry/function tests and build are verified; browser/WebGL click-through and deployed behavior are not yet verified.
- Group Copy/Move remain unsupported. Moving shared nodes retains the existing connected-topology behavior.
- Work plane elevation follows selected geometry; this does not introduce a new explicit construction-plane/floor selection UI.
- Existing delete/reference validation behavior, grid/level service behavior, engineering engines, analysis adapters, and canonical Core contracts are not redesigned.
- Keep this change as a draft review until remaining CI failures are resolved and browser interaction verification is completed. No production deployment or merge is claimed.
