# Validator sanity notes

The Chinese Room specimen remains valid under the hardened `horn-document/0.1` contract:

- authored document with explicit `after` metadata
- one explicitly authored node
- mapped citations on all debate nodes
- cartographic provenance present at document level
- authored gloss cites cartographic sources directly
- unique node numbers and relation IDs
- all relation endpoints resolve
- all node and region rectangles remain inside the 2600×1960 canvas
- reading path contains each referenced node once

The validator intentionally does **not** infer topology from claim numbering and does not perform automatic layout or geometry repair.
