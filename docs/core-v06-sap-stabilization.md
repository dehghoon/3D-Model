# Structural Core 0.6 and SAP2000 stabilization

Review target is existing draft PR #6 and its SAP2000 feature branch. Production release requires owner approval.

## Audit

The baseline is 10ae760f2ecf8e7864099d9348ada589d9ba35bf. Its deployment dpl_FQHXHSfPLssvW5sWE871SGSwrAyf was confirmed READY and points to that SHA. Subsequent main commits were incorporated into the existing feature branch to preserve current navigation, access checks, SEO metadata and starter-model behavior.

Core tag v0.6.0 is an official, published GitHub Release. The tag resolves to 83f30b505997c77fed3d3984267027a1bae5c7ad. The package exports Core schema 0.6 and supports 0.5. The current Core registry authority on main still says 0.5 while the compatibility manifest says 0.6. Core PR #6 contains the registry correction, with individual legacy consumers remaining explicitly recorded at their current schema. This correction needs review and merge before consumers reading Core main receive it.

The original SAP importer implementation branch and importer PR #4 use different heads. PR #4 originally contains the migration handoff, while gpt2/core-v06-sap-migration contains the parser implementation. The two histories must be incorporated into the existing PR rather than opening a replacement.

## Migration matrix

| Component | Current / required contract | Difference and implementation | Verification / blocker | Responsible repository |
| --- | --- | --- | --- | --- |
| Core release | package 0.6.0, schema 0.6, supported 0.5 | Published tag and public exports confirmed. Registry authority correction prepared in existing Core PR #6. | Build, typecheck and 8 contract tests pass. Canonical main registry correction awaits approval. | linkoteq-structural-core |
| 3D Model | exact released Core SHA / schema 0.6 | Existing native 0.6 editor preserved. Load edits keep the active schema and support creation accepts 0.6. | Unit, typecheck, build, CI and browser evidence recorded below. | 3D-Model |
| Saved projects | 0.5 and 0.6 input / 0.6 editor | Additive 0.5 promotion preserves IDs, geometry, units and optional records. | Round-trip tests. Pre-0.5 models still use the existing legacy migration boundary. | 3D-Model |
| Importer | geometry handoff v1 / target Core 0.6 | Source geometry and engineering source records remain separate. No certified analytical model is returned. Unnamed GLOBAL Cartesian grids get explicit display labels. | Private real-file regression and synthetic grid test. Parser service release remains separate. | linkoteq-structural-importer |
| Simple Model | 0.6 shared model | Retains imported geometry on mode changes and identifies it through project metadata. | Existing UI interaction regressions and browser checks. | 3D-Model |
| Advanced Model | 0.6 mutations and serialization | Node/member/surface edits, load edits, supports, section changes preserve shared contract. | Existing editor tests plus added migration regressions. | 3D-Model |
| Visualization | Core Node/Member/Surface/Grid/Level references | All valid shell boundaries render. Local polygon origins retain precision, surfaces are double-sided, dense nodes share picking geometry and use a single points draw. | Triangulation, picking, selection, fit and performance tests. | 3D-Model |
| Joists | Core 0.6 JoistSpecification | Existing geometry-only and unverified capacity behavior retained. | Existing joist tests. Analytical capacity certification remains outside this change. | 3D-Model / structural-core |
| Snow Load | recorded schema 0.5 / 0.6 target | Deployed 0.5 calculation interface remains recorded. Added versioned 0.6 boundary reuses the existing verified engine. | Core 0.6 endpoint added in Snow PR #16. 46 engine/backend tests pass locally, including equality with legacy pressure output. Canonical-main compatibility gate awaits Core review. | Snow-Calculator |
| W-Section | recorded schema 0.5 / 0.6 target | Added versioned 0.6 boundary reuses the existing 0.5 design integration and engineering engine. | Core 0.6 endpoint added in W-Section PR #8. 30 engine/backend tests pass locally, including equality with legacy checks and utilization. Canonical-main compatibility gate awaits Core review. | steel-verification |
| Other tools | inventory dependent | Existing Core migration audit lists unverified consumers. | No blanket compatibility claim. | Core orchestration matrix |

## Geometry and performance

Local private regression uses the supplied SCIENC file and its expected SHA-256. The original file and generated handoff remain outside git.

- 2,949 nodes, 250 frames, 2,620 areas.
- Area sections preserved as source metadata, including Fon550 1,148, W600 852, W250 422, W350 102 and Deck 96.
- All 2,620 valid surfaces produce triangles. Geometry classification yields 1,244 horizontal slabs and 1,376 vertical walls.
- Source contains 27 GLOBAL Cartesian grids. Eight lack a source GridID. There are 22 X/Y lines and five Z elevation grids. Explicit unnamed labels preserve the distinction from original names, and original source fields remain archived.
- Source contains no explicit story records. Five explicit GLOBAL Z grid elevations are used as guides in this file. For files without them, tolerance clustering reduces noise while marking inferred guides. Coordinates are unchanged.
- Baseline scene construction median 644 ms across five local Node.js runs. Updated median 76 ms in the same process and fixture, before the final grid-label change. Final grid/elevation processing produced a 52 ms median in a later local run.
- Visible scene objects containing geometry drop from 9,037 to 3,140. Node raycast targets retain per-node identity with shared geometry.
- These are CPU construction timings. GPU frame rate and physical mobile responsiveness require browser/device measurements.
- Local geometry classification identifies shape orientation only. Foundation, deck, material, stiffness and analysis behavior continue to require source semantic mapping and engineering verification.

## Source preservation

The handoff retains the byte-exact original SAP source archive. Area IDs, GUIDs, section and material names remain attached to editable surfaces. Unsupported loads, springs, modifiers and other tables are retained in the original archive. Source data and geometry edits do not establish verified analytical mappings. Saved SAP projects use the existing project envelope with the complete handoff alongside the Core model, and hash matching is checked when reopening.

## Verification

- Baseline model tests after integrating main: 222 pass.
- Updated model tests: 231 pass, including source-preserving project save/reopen.
- Added synthetic regressions cover horizontal/vertical areas, precision at large offsets, winding, source metadata, stale support cleanup, saved Core 0.5 promotion, Core 0.6 supports, camera bounds and dense-node picking/highlighting/disposal.
- Importer baseline including private regression: 136 tests and 9 subtests pass.
- Updated importer including unnamed-grid regression: 137 tests and 9 subtests pass.
- Existing checked-in importer handoff fixture script passes.
- Dependency security review found legacy Next.js and transitive package advisories. Next.js was updated to 15.5.29 with compatible React 18 support, and the transitive PostCSS and XML parser dependencies were pinned to patched versions. Final npm audit reports zero advisories. The lockfile records reproducible dependencies.
- Local production build passes on Next.js 15.5.29.
- Chromium browser renders the private geometry through the normal file input with the locally generated importer response supplied to the request. This validates UI and geometry, with network service deployment tracked separately.
- Desktop 1440x1000 and mobile portrait 390x844 tested. Mobile portrait canvas is 388x509 CSS pixels. Mobile landscape 844x390 canvas is 634x151 CSS pixels. The portrait import-to-screenshot measurement is about 6 seconds, including an explicit 2.5 second settling interval under software WebGL.
- Mobile Simple/Advanced switching retains all geometry. Downloaded project contains all 2,620 surfaces and its source archive bytes match the original handoff.
- Physical-device GPU and touch behavior remain unverified. Headless Chromium uses software rendering.
- Initial CI run 44450587425 and Vercel preview of a7b73297501293ac8b9833bc4e5151416a0388dd passed. The final follow-up commit reruns CI and creates the review preview reported in PR #6.

## Release assessment

Preview review is authorized. Production merge and production deploy require the owner's explicit approval. Analytical mapping, calculator-wide 0.6 migration and physical mobile validation must remain visible as independent readiness items.
