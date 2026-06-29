dt: 2026-06-25  s: 40k  cfp: 43
task: T-274 — backlink-graph click-to-read panel (preview desc + clickable backlink navigation + open-file). Plan DONE + skeptical-reviewed + revised (2 findings folded). Resume straight to Phase 3 S1.
sk: coder  sk_h: 432ca0d2  mece_h: 039d9e5a
p1: done  p2: done  p3: pending
section: S1  step: edit build_model in scripts/build_backlink_graph.py to embed `desc` (description[:240]) per node
resume_at: S1:step:embed desc per node → S2 panel UI (showDetail + neighbor-navigate + open-file bonus) → S3 generate + Verify-3a..3f (3f = real browser click-test via Claude Preview, manual fallback). Full spec in .sessions/mece_plan.md Phase 3.
compact_size: 31500
session_reset: consumed
mece_plan_hash: 039d9e5a

## Context carried (do NOT re-derive)
- Generator scripts/build_backlink_graph.py already builds: nodes {id,label,topic,color,wdeg}, edges (dedup related), JS adj set, cooling sim (T-273). ADDITIVE only — Core + cooling must stay intact.
- index_files.json: 212 entries · description present on ONLY 94/212 (avg 75 ch) → panel MUST fallback "no summary — open file" for the other 118.
- Neighbor links = reuse JS `adj.get(node)` (no new data). Open-file href = "../../"+id (html at knowledge/diagrams/). desc is the ONLY new embedded field.
- Surgical scope: scripts/build_backlink_graph.py + knowledge/diagrams/backlink-graph.html (regen) + index_files.json (desc touch). Nothing else.
- skeptical_reviewer verdict was `revise` (2 fixes applied): Verify-3f browser click-test added; open-file reframed as bonus (raw file, may download).
