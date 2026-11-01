# Advanced Model — Joist bay placement contract

Status: approved product requirements; implementation IN PROGRESS. This document does not claim browser readiness.

## Two workflows

1. **Plan bay tool (Joist)**: enabled in horizontal plan at the active visible level only. Click inside a closed beam-framed bay. Detect the four surrounding supporting beams from their actual endpoints, connectivity, coordinates and level; do not assume grid rectangles are beams. Show detected boundary and require a direction (span between one pair of opposite beams), joist catalog designation, and **either** count or spacing. Preview all members and their support endpoints before explicit confirmation. Create independent Core `Member.type="joist"` records at the active level, with stable IDs, correct material/section refs, and provenance/bay association where supported. Do not create members outside the bay.
2. **Single-member Beam workflow**: Beam's two-point interaction may select a verified joist section. If the selected section is a joist, the resulting Core member MUST be `type="joist"` with JoistSpecification, not a beam with a misleading section. Do not infer a joist from a section name alone without catalog classification.

## Geometry and safety

- Plan-only bay creation; exclude beams at other levels or elevations.
- Require a geometrically closed, unambiguous four-beam boundary. Reject gaps, crossings, duplicate boundaries and multiple candidate bays rather than guessing.
- Direction defines which opposing pair are the supporting beams; distribute joists between the other pair, with positive integer count or positive finite spacing and predictable edge offsets.
- Preview must show actual endpoint snaps and exact count/spacing. Preserve manually assigned support eccentricity if explicitly provided; never infer it.
- Nonrectangular, skewed, or segmented perimeter beams require explicit geometric support and tests before being marked supported. Provide a clear diagnostic and manual boundary selection fallback.
- If a catalog joist section is not available, block creation with an actionable message. Never use a generic beam section silently.
- New joists: default rotational releases RX, RY, RZ at both ends; translational DOFs remain connected. Beam default remains unreleased. Imported source releases are authoritative and must never be overwritten by a creation default.
- Preserve joist designation and analysis status; no capacity or PyNite analysis claims without validated mapping.

## Acceptance tests (required)

1. Closed rectangular bay on active level; both directions; count and spacing; expected coordinates and stable IDs.
2. Different-level beam excluded; incomplete/open perimeter rejected; overlapping candidate bays rejected.
3. Preview vs committed coordinates identical; cancellation creates nothing; repeat placement avoids duplicates.
4. Single-member joist through Beam uses Core joist type and default pins; regular beam remains unreleased.
5. Save/reopen preserves member IDs, joist specs, releases, level and bay provenance.
6. Browser E2E: mobile and desktop, plan/3D mode switching, clicking bay, direction, preview, confirm, save and reopen.

Current implementation evidence: independent Joist member creation and pinned-by-default behavior committed. Automatic four-beam bay detection, plan-only interaction, preview/confirm and Beam-section switching are **not yet implemented**.
