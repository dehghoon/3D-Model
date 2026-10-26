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

## Core catalogs, bracing and on-model edits

- A separate horizontal Simple toolbar reads 678 Canadian location identities and 22 material reference templates from Core commit `b1f25a6b735f4e3c586d4d8497298ebd6f656126` through `/api/core-catalogs`. Location ID, source ref and climate pointer are preserved in project metadata; no climate loads or geocoding are inferred.
- Section dropdowns reuse the approved section API and require its dataset version to match the Core CISC manifest. They search by designation and disable records missing canonical analysis properties. No new bulk catalog copy is stored in the application.
- Requested column W250x49 is available and applied automatically on first catalog load. Requested beam W310x32 and brace 2L70x70x6.4 do not exist in the Core dataset. They remain explicit unavailable requests; the UI shows the actual current beam section and leaves brace generation pending until a complete section is chosen. No substitute is silently assigned.
- Core double-angle record 2LE76x76x6.4 exists but lacks `moment_of_inertia_minor`; it is disabled. No missing property is derived or fabricated. The existing verified Steel 350W remains the initial canonical material. Other Core material templates require user-supplied numerical properties because the catalog supplies identities, not analysis-ready materials.
- Left controls separately count X/Y braced bays. Each row selects the frame grid, along-direction start/end grids, one/all storeys and /, reverse diagonal or X pattern. X creates two members per storey; crossing diagonals do not create an invented joint. Duplicated diagonals and out-of-frame placements are rejected atomically. Pending rows are saved even before a brace section is selected.
- Clicking a beam/column/brace in the Simple model opens its member editor: catalog section, project material, section rotation, omit/restore and reset to defaults. A type filter makes overlapping projected members accessible. Per-member overrides and all bracing settings persist through dimensional regeneration and canonical JSON export.
- Both renderers extend display grids beyond physical nodes. Advanced uses one shared endpoint helper for dashed reference lines and label bubbles; snap and canonical grid geometry remain unchanged. Simple shows every numbered/lettered grid at both ends with offset bubbles.
- Added source-backed catalog fixture, exact default-availability tests, bracing connectivity/pattern/storey tests, duplicate/out-of-range rejection, override persistence and first/last grid offset tests. The DOM flow selects a Core location, configures bracing, changes a clicked beam section and checks the same canonical model in Advanced.
