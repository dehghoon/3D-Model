# Simple building workspace

## Behavior

The existing Simple and Advanced tabs edit one mounted canonical Core v0.5 model. Mode switches cancel pending operations without changing committed geometry. Advanced keeps the existing explicit point, boundary, property and engineering tools.

Simple adds a GPU-independent SVG floor plan, working-floor and higher-end-floor controls, and a 3D preview switch. Floor clicks use SVG screen-to-model coordinates; nearby existing floor nodes snap without projecting nodes from other floors. Columns use one base point and the selected higher floor. Beams use two explicit floor points. Rectangular slabs use opposite corners. Walls use two base ends and the higher floor. Surface boundaries remain previews until Finish. Wrong-floor, degenerate or invalid coordinates are rejected atomically by existing canonical controllers.

Simple includes multiple selection and existing group Move/Copy/Delete commands, optional coordinate entry, and model Undo/Redo (50 recent states). Geometry edits made in Advanced participate in the same history. Import/New reset history. Members retain existing assigned section/material defaults; Simple does not imply analysis readiness. Detailed property editing opens Advanced.

## Validation

- 130 tests passed, including actual Simple SVG click-to-column writeback, wall/slab boundary completion, shared-model tab switches, off-floor rejection, Undo/Redo and Advanced two-point regression.
- TypeScript passed.
- Production Next.js build passed.
- Existing canvas/group-transform regression tests continue in Advanced.
- DOM tests replace unrelated dialogs and WebGL; they are not GPU or visual-layout evidence.

## Limits

Direct dimension editing, automated engineering readiness checks and one-click whole-floor replication are not part of this change. Group copy remains geometry-only with the existing load/support policy. Simple wall thickness and engineering assignments are edited in Advanced. No solver, Core contract or hosting configuration changes.

Browser visual QA could not run locally because the Chromium download returned invalid archives. Desktop/mobile layout and 3D preview still need a real-browser check before merge.
