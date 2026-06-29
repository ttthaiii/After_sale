gather_complete — T-274 backlink-graph click-to-read panel
date: 2026-06-25
skill: coder (extend the existing generator + emitted HTML)

## Task
Turn the backlink graph from "look-only map" into a "walkable wiki": click a node →
side panel showing the file's summary + clickable connected-file links (navigate in-graph)
+ an "open file" link to read the real file. Offline single-file preserved.

## G1/G2 findings (verified from index_files.json — python probe, not full read)
- 212 entries (nodes). Per-node fields available: description, topics, references[],
  related[{path,strength,score}], backlinks[].
- COVERAGE (the design driver): description present on only 94/212 (avg 75 chars, max 604).
  → panel MUST degrade gracefully: show summary if present, else "no summary — open file".
- Connected-file list: reuse the JS `adj` set already built from edges (symmetric, covers
  both related[] and incoming) — no new data needed for neighbor links.
- Open-file href: HTML lives at knowledge/diagrams/ → repo root is `../../` → href = "../../"+id
  (uniform prefix for every node; opens raw file via file:// offline). Verified path shape.

## G3 design decision
- ONLY new embedded data needed = `desc` per node (truncate ~240 chars, ascii-safe). Everything
  else (neighbors, open-file path) is computable in-browser from existing data → minimal size add.
- Additive: Core graph + cooling (T-273) must keep working unchanged; panel is new UI only.
- Single file, offline, idempotent — same invariants as T-273.

## Scope (1 file)
scripts/build_backlink_graph.py only (regenerates knowledge/diagrams/backlink-graph.html).
NOT backfilling the 118 missing descriptions (separate future task).

## Affected files
- scripts/build_backlink_graph.py (edit) → regenerates knowledge/diagrams/backlink-graph.html

## Acceptance criteria
- Click node → panel with: title · path · topic · summary-or-fallback · clickable neighbor list · open-file link
- Click a neighbor name → focuses that node + recenters (in-graph navigation)
- Still 0 network refs · idempotent · 212 nodes · JS syntax valid

[✓ gather]
