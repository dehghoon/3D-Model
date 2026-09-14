# GPT-6 Core Mapping

Target: `linkoteq-structural-core` schema `0.5`.
If Core changes, the latest released Core contract overrides this document.

## Mapping table

| Reconstruction fact | Core type | Rule |
|---|---|---|
| Project/import context | `ProjectInfo` | Preserve stable project ID and unit system. |
| Storey/floor | `Level` | Requires stable ID and engineering elevation; page order alone is insufficient. |
| Accepted grid axis | `GridLine` | Write calibrated global start/end geometry plus label. Bounding boxes are not grid geometry. |
| Accepted structural point | `Node` | Write global position with stable ID. |
| Column | `Member(type="column")` | Requires valid start/end nodes; plan position alone cannot invent vertical extent. |
| Beam | `Member(type="beam")` | Requires reconstructed start/end nodes and stable references. |
| Brace | `Member(type="brace")` | Future scope. |
| Slab/wall | `Surface` | Future scope; boundary node IDs define geometry. |
| Opening | `Opening` | Future scope; requires host surface and boundary node IDs. |

## Coordinate gate
Never write pixel coordinates into Core geometry.

Required chain:
```text
source -> normalized drawing -> engineering coordinates -> global model
```

Core mapping occurs only after scale and global placement are resolved.

## Unit gate
`ProjectInfo.units` declares the project unit system. Pixel values, DPI, OCR boxes and detector boxes remain importer-private. If physical scale is unresolved, canonical physical geometry must be deferred rather than guessed.

## Stable identity
Canonical IDs are stable references, not display labels or transient array indexes. Labels such as `B-3`, `C12` or `Beam 4` may be metadata, but references use stable IDs.

Recommended deterministic ID inputs include project/import identity, drawing/page identity, accepted semantic type and normalized topological identity.

## GridLine
An accepted grid requires:
- stable ID;
- label;
- calibrated global start;
- calibrated global end.

Grid label evidence may originate from OCR/review; axis geometry originates from geometric reconstruction.

## Node
Grid intersections or accepted off-grid points may become nodes when structurally required. Merge near-coincident nodes with deterministic engineering tolerances. Do not force every column to a grid intersection.

## Column
To emit a canonical column member, vertical/topological evidence must establish its start/end nodes or levels/elevations. Until then, keep an accepted plan-location candidate inside the reconstruction workflow.

## Beam
A canonical beam requires stable member ID, `type="beam"`, `startNodeId` and `endNodeId`. Do not map bounding-box corners directly to endpoints; use reconstructed centerline/endpoints and topology.

## Materials/sections
MVP does not infer `Material` or `Section` unless reliable source information and explicit mapping exist. Never invent properties or assignments.

## Supports/loads/analysis
The importer does not own analysis and must not call PyNite directly. Future support/load extraction must map to current canonical Core primitives with traceability.

## Confidence/provenance
Confidence and review state remain importer workflow data unless Core explicitly defines a canonical field. Before writeback retain source page/artifact, detector/model version, OCR evidence, geometric evidence, calibration evidence, association decision and review status.

Only accepted engineering facts cross the Core boundary.

## Writeback gates
Canonical writeback requires:
1. current Core schema confirmed;
2. project unit system known;
3. required scale resolved;
4. global placement resolved;
5. stable IDs assigned;
6. all member node references resolve;
7. no duplicate/conflicting IDs;
8. ambiguous candidates excluded or reviewed;
9. output validates against current Core;
10. no solver/PyNite dependency crosses the importer boundary.

## Required initial fixtures
- simple orthogonal grid;
- grid with missing bubbles;
- intentionally off-grid column;
- beam spanning two accepted nodes;
- ambiguous beam endpoint requiring review;
- unresolved-scale drawing that must not emit physical geometry;
- multi-level case before column-member writeback.

## Core migration rule
On Core change, update affected mapping, tests and migration notes. Preserve verified CV/reconstruction behavior unless reconstruction requirements themselves change.
