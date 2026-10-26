# Simple frame modeling

Simple now opens a dedicated parametric frame workspace. The former manual point-entry workspace and its quick tools live in Advanced. Both modes share the canonical model in the shell.

## Behavior

- Default plan: 15 × 10 m, four X grids, three Y grids, two 3 m storeys.
- Plan dimensions use 5 m bays and a final remainder. Very small remainders merge into the preceding bay. More than 20 bays are distributed evenly.
- Adding a grid extends the plan by a 5 m bay; adding a storey adds 3 m. Removing the last grid/storey shortens the frame.
- Every grid intersection has a column through each storey; every elevated grid line has beams between adjacent intersections. Base grid lines are reference lines, not beams.
- Clicking or keyboard-activating a dimension opens a spacing/height input. Apply rebuilds one canonical frame with shared nodes. Later grid coordinates/elevations shift cumulatively; geometry IDs remain stable for unchanged topology.
- The interactive isometric/plan SVG uses the same parametric geometry as the canonical generator. Simple does not require WebGL. Advanced retains the existing WebGL renderer, point tools, group transforms, properties, grids and levels.
- Save exports canonical JSON including the private layout in project metadata. Advanced edits invalidate the layout marker. Returning to Simple then requires the explicit Create quick frame action before geometry can be replaced. Merely switching modes never replaces geometry.
- Limits: 1–20 bays per axis and 1–20 storeys; each span/height 0.1–1000 m. SI metres only in Simple. Materials and sections reuse existing records or the existing starter records. No supports, loads, surfaces or solver outputs are invented by the frame generator.

## Verification

- Pure tests: canonical validation, exact member/node counts, no duplicate edges, shared connectivity, stable IDs after spacing edits, cumulative levels, default additions, limits and JSON metadata round trip.
- DOM test: starts without manual menus, edits an on-model dimension, adds grids/storeys, inspects the same canonical geometry in Advanced, returns with layout intact, and protects manually edited geometry from implicit regeneration.
- Existing viewport interaction suite runs in Advanced and continues testing manual member/surface creation and group transforms.
