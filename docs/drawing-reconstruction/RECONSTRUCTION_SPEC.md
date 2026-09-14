# GPT-6 Drawing Reconstruction Specification

## Objective
Convert PDF/image structural drawings into reviewed, Core-compatible structural geometry. CV outputs are evidence, not canonical engineering facts.

## Core baseline
Authoritative source: `dehghoon/linkoteq-structural-core`.
Target schema: `0.5`.

Boundary rules:
- geometry written to Core is global;
- canonical references use stable IDs;
- engineering dimensions are resolved to project units before writeback;
- importer-private CV/OCR schemas may exist internally but must not conflict with Core;
- the importer must not call PyNite directly; analysis remains behind the PyNite Analysis Adapter.

## MVP canonical output
- `Level`
- `GridLine`
- `Node`
- `Member(type="column")`
- `Member(type="beam")`

Surfaces, openings, supports, materials, sections, loads and analysis are later phases unless reliable extraction rules are explicitly added.

## Pipeline
```text
PDF/Image
-> classify vector/raster/mixed input
-> preprocessing + transform tracking
-> grid geometry extraction
-> bubble/OCR grid labeling
-> structural object detection
-> geometry-semantic fusion
-> scale calibration
-> topology reconstruction
-> validation / human review
-> Core mapper
-> StructuralModel 0.5
```

## Input and transforms
Preserve vector geometry/text when available. Rasterize only where CV requires it. Record page identity, source dimensions, DPI when known, and every geometric transform.

Maintain a deterministic chain:
```text
source pixel/vector coordinates
-> normalized drawing coordinates
-> calibrated engineering coordinates
-> global model coordinates
```
Each page should expose `T_source_to_model` or an equivalent transform record.

## Grid geometry
Grid axes are geometric lines, not YOLO bounding boxes.

Candidate algorithms include Probabilistic Hough Transform, LSD and EDLines. Processing should extract segments, cluster dominant directions, merge collinear segments, rank long candidates, test spacing regularity, associate endpoint bubbles/labels, and calculate confidence.

Grid evidence may include line length, orientation consistency, regular spacing, bubble evidence, OCR evidence and parallel-family membership. A missing bubble must not automatically invalidate a strong grid candidate.

## OCR/grid labeling
Run OCR mainly on targeted ROIs around candidate endpoints/bubbles. Keep raw OCR text, normalized label, confidence, source ROI and associated grid-candidate ID.

## Structural object detection
Initial semantic classes: `column`, `beam`.

The detector may be YOLO, YOLO-OBB, segmentation or another approved model. Record detector name, model version, source page, class, confidence and source-space geometry.

Detector output is not final engineering geometry.

## Geometry-semantic fusion
Column:
```text
detection -> center -> candidate grid intersection
-> distance/context checks
-> auto-accept | review | preserve off-grid
```

Beam:
```text
detection -> centerline -> endpoints
-> candidate structural nodes
-> connectivity checks
-> accepted member | review
```

Never snap every object blindly. Intentional eccentric/off-grid elements must remain representable.

## Scale calibration
Pixel coordinates are not engineering coordinates. Supported evidence can include vector-PDF geometry, printed scale, OCR dimensions, known grid spacing and explicit user calibration.

Calibration records should include source, units, transform parameters, confidence and measurable residual/error.

## Topology
Topology owns connectivity. Intersections may become node candidates. Beam endpoints reference stable node IDs. Near-coincident nodes are resolved deterministically using engineering tolerances. Ambiguity triggers review rather than silent guessing.

Suggested review states:
- `auto-accepted`
- `review-required`
- `rejected`
- `preserved-off-grid`

## Column vertical extent
A plan-view column detection gives horizontal position only. A canonical column `Member` requires start/end nodes or valid level/elevation evidence. Do not invent vertical extent from a single plan.

## Human review
Canonical writeback is blocked for unresolved scale, ambiguous OCR, competing associations, excessive snap distance, unresolved beam endpoints, conflicting duplicates, low-confidence detections or topology inconsistencies.

## Acceptance tests
Controlled fixtures should verify:
- grid counts/labels and intersections;
- scale tolerance;
- off-grid-column preservation;
- column associations;
- beam endpoint connectivity;
- no unintended duplicate nodes;
- stable deterministic IDs;
- valid Core output;
- no direct PyNite dependency.

## Implementation order
1. Core mapper fixtures and contract tests
2. source normalization + transform tracking
3. grid extraction
4. OCR/grid labels
5. scale calibration
6. column detection/association
7. beam reconstruction/connectivity
8. human-review contract/UI
9. additional classes

## Security boundary
GPT-5 owns upload/file security, model-artifact integrity, hostile-file handling, dependency/security scanning, tenant isolation and privacy review. GPT-6 owns reconstruction functionality.
