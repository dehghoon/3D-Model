# Viewport modeling interaction repair

## Scope and current status
Repository: dehghoon/3D-Model. Branch: fix/viewport-modeling-point-picking. PR: #2. Core remains v0.5. No engine, solver, Core contract or hosting configuration changes.

The active route resolves through StructuralEditorShellV2 -> StructuralEditorShellV3 -> StructuralEditorV05 -> StructuralEditorV07 -> ThatOpenViewportV01 -> ThatOpenViewportV03 -> ThatOpenViewportV08 -> ThatOpenViewportV07.

## Interaction changes
- Forward tapped snap points to the modeling tools before ordinary selection; resolve hover candidates while drawing.
- Beam, column and brace reuse the canonical node/member creation controller. Slab and wall accept ordered snapped boundary points, reuse existing nodes or create canonical nodes, and expose Finish in Simple Mode.
- Tool switches cancel conflicting draw/transform state. Escape and project New/Open reset pending modeling state. Non-primary-button clicks and drags do not become drawing/placement taps.
- Copy/Move use the selection captured at activation and finish only after validated successful writeback. Failed writeback retains the target step.
- Reject multiple transform selections explicitly instead of modifying only the last selection. Group Copy/Move are not implemented.
- Front/side orthographic rays parallel to the horizontal work plane use a vertical construction plane. Grid candidates follow selected elevation.
- Fix the starter model's `diaphhragms` typo to canonical `diaphragms`.
- Catch renderer initialization errors inside the viewport. Keep the rest of the editor mounted with a readable WebGL/graphics message and allow model saving. Dispose partially initialized runtime components on initialization failure.

## Verification
- All 119 tests pass, including existing grid/level, selection, node/member/surface, transform, boundary-condition, import/export, and Core integration checks.
- Full `npm run typecheck` passes with all tests included; no test exclusions or bypasses. Track the standard `next-env.d.ts` so a fresh checkout can load Next/styled-jsx declarations before its first build. CI exposed this missing initialization file after all 119 tests passed.
- Local production Next.js build passes.
- New DOM integration test mounts the real React modeling tools, viewport and transform bridge. It sends canvas pointer events through the real snap resolver into canonical writeback. It covers column/beam/brace creation, ordered slab/wall completion, drag rejection, Copy/Move, failed transform retention, Escape, and preservation of the editor on renderer failure. Only the graphics runtime and unrelated library dialogs are test doubles. This is not a real WebGL rendering test.
- Six additional geometry regression cases verify canonical identity/reference preservation and front-view free-point picking.
- Test repairs correct malformed regex/syntax, legacy v0.2 fixture fields in v0.5 tests, a misspelled fixture source ID, the NDC center expectation, the current unified section panel, whitespace-sensitive source assertions, and window selection expectations that omitted selected nodes. No failing tests were removed or skipped.
- Test-only dependencies: jsdom, its types, and esbuild. Production dependency pins are unchanged. A normal install prepares the exact pinned Core package successfully; no hand-written declaration workaround is required.

## Browser observation and remaining limits
The existing Vercel preview was opened through the cloud browser. Console evidence showed WebGL disabled and `Error creating WebGL context`; before the error-handling repair this crashed the entire page. The updated preview was reloaded and its accessibility tree confirmed the editor, Save project control, and explanatory WebGL message remain visible. This browser cannot verify real 3D rendering or GPU picking. Its limitation does not establish that the user's browser has the same failure.

Group transforms remain unsupported. Shared-node movement preserves existing connected-topology semantics. Work-plane elevation follows selected geometry; this repair does not add an explicit construction-plane/floor UI. Delete/reference policies and engineering analysis behavior are not redesigned.

Changes are for review in PR #2. Production merge/deployment and real WebGL interaction verification are not claimed. CI and preview state must be checked against the final commit.
