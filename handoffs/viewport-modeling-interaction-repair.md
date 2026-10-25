# Point entry and group modeling workflows

Repository: dehghoon/3D-Model. Branch: fix/viewport-modeling-point-picking. PR #2. Canonical Core remains v0.5.

## User-visible behavior
- Beam, column and brace accept model clicks, absolute global XYZ coordinates, or relative ΔX/ΔY/ΔZ from the start point. First points can also be entered as coordinates.
- Columns additionally accept an end level after choosing the base point. This preserves base X/Y and uses the selected level elevation as global Z. Clicking a second point, absolute coordinates, and relative offsets remain available.
- Slab and wall activation immediately opens a visible point panel with ordered boundary coordinates, an in-scene marker/edge preview, Undo point, Finish and Cancel. Coordinates and offsets can be mixed with clicks. Points remain UI-only until successful completion; cancellation does not leave orphan nodes. Distinct, non-collinear, planar, non-crossing boundaries are validated before canonical writeback.
- Move/Copy capture the full selected group, ask for a base point and then a target, and accept clicks or coordinates; target offsets are measured from the base. Shared nodes are transformed/cloned exactly once. Copy leaves source geometry unchanged and reuses canonical material/section identities. Failed operations retain the target step and do not partially change the model.
- Multiple selection is available with Ctrl/Cmd/Shift-click, a persistent Multiple selection toggle, or window selection. Windows include nodes, members and surfaces. Quick actions are available in Simple and Advanced modes. Properties open on request rather than covering the point workflow automatically.
- Status, stage, selection count and coordinate units are visible. Relative-entry preference is retained for successive points. Pending geometry and the full group transform receive previews. Escape, Cancel, New and Open clear pending command state.
- Renderer initialization failure preserves the editor and numeric point controls. Real WebGL rendering is still required for visible 3D graphics and canvas picking.

## Implementation boundaries
The shell and context menu use explicit modeling/utility commands rather than searching hidden toolbar buttons. `ModelToolsV05` consumes the same picked-point event for clicks and numeric entry. `PointInputPanel` is mounted inside the actual editor viewport. Separate UI stores hold transient point/command state; canonical geometry is written only through existing Core-compatible helpers.

`transformGroup` validates the entire group, maps each unique source node once, assigns collision-free copy IDs, preserves copied surface openings, and rejects movement that collapses any connected member. Move retains existing shared-node topology, including effects on unselected incident elements. Copy is geometry-only: it does not duplicate loads, supports or diaphragms. Copied surface support-member links are mapped only when those members are copied; otherwise a warning requests reassignment. No engineering engine, Core contract or solver adapter is modified.

## Verification
- 128 tests pass locally, including all existing checks, geometry/group regressions, and the expanded DOM integration scenario.
- Full `npm run typecheck` and production Next.js build pass locally.
- DOM integration mounts the real public shell, modeling tools, point input panel, viewport interaction code and transform bridge. It covers tool activation; clicked member and surface creation; numeric first/end points; column end-level selection; relative beam coordinates; staged numeric slab completion/cancellation; the multiple-selection toggle; numeric group Copy/Move; shared-node identity; drag rejection; failure retention; Escape; and renderer failure. Only the graphics runtime and unrelated catalog dialogs are test doubles. Its picker double exercises selection routing, not GPU raycasting.
- Pure tests cover mixed node/member/surface group transforms, immutability, unique IDs, shared-node deduplication, surface openings, collapse prevention, coordinate validation, and invalid surface boundaries.
- The standard next-env.d.ts remains tracked so CI typechecking works before a first build. No tests are excluded or skipped.

## Release scope
This work updates PR #2 and its preview. Production merge is not claimed. CI and Vercel status must be checked for the final commit. The cloud browser has WebGL disabled. Actual preview UI testing nevertheless created column C3 from (20,10,0) to Roof (Z=3.5), created slab S1 from four absolute/relative points, selected all 15 objects, copied by ΔX=100 and moved the copied group by ΔZ=2. The browser-exported JSON contained 20 nodes, 8 members and 2 surfaces. Every copied node equaled its retained original plus (100,0,2), with valid member/surface references. This verifies numeric UI and actual canonical writeback, not GPU rendering or pointer picking. The selection count now subscribes directly to selection state, including when renderer initialization fails. Solver-dependent production acceptance remains outside this geometry/UI change.
