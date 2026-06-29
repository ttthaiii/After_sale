# Compact System — Audit & Redesign Spec
> Source: Explore map (this session) + in-context reads of CLAUDE.md / AGENTS.md / mece_plan_schema.md.
> Purpose: implementation spec for the NEXT (fresh) session. Implement in phases A→B→C.
> Lens: same audit principles used on the mece per-section invariants (hoist-once, reference-everywhere)
>       + the pre-compact "recommendation not command" pattern the user liked.

## Audit — what's wrong

### A. Redundancy (same rule restated in N places → silent drift)
- C0.5 LOOP_WEIGHT gate (30/50 thresholds) defined **4×**: `.claude/settings.json:8` · `AGENTS.md:46` · `Implement/03_config.md:105-110` · `docs/session_templates/mece_plan_schema.md:88-91` (now in §Per-Section Invariants after item-2 collapse).
- `[compact-required] → STOP` rule stated in **4 files** (same list). No authoritative source.
- `compact_size = int(CHAT_TOTAL × 0.52)` copy-pasted **5×**: AGENTS.md · 03_config.md · mece_plan_schema.md:129/244 · token_tracker/SKILL.md:84.
- "TOKEN PAUSE >60k" restated in **8 files**.
- **6 independent "should I compact?" decision gates** (settings.json hook · C0.5 BC in AGENTS · C0.5 in 03_config · R3 table · Phase-3 Token Pause BC · Completion Gate close-gate) — no arbitration order when they disagree.

### B. Real bugs (contradictions, not just duplication)
- **BUG-1 · CHAT_TOTAL threshold conflict:** `AGENTS.md:218` says "compact before CHAT_TOTAL >80k"; `03_config.md:166-167` + session_tokens template say "warn >120k, mandatory >180k". Three different "must compact" numbers — a model obeying all three cannot know which wins.
- **BUG-2 · chat_tokens.md contradiction:** `token_tracker/SKILL.md:143` says `.sessions/chat_tokens.md` "does NOT exist", but `scripts/session_compactor.py:27` validates it as REQUIRED and `bootstrap_sessions.py:47` CREATES it. CHAT_TOTAL is duplicated in `session_tokens.md` AND `chat_tokens.md`.
- **BUG-3 · LOOP_WEIGHT never resets on session close** (only on /compact): a heavy prior session leaves LOOP_WEIGHT high, so a FRESH session fires `[compact-required]` on turn 1 before any work. OBSERVED LIVE this session: hook reports LOOP_W=84; the file showed 101 (also evidence of the subagent-pollution wart below).

### C. Dumbness (vs. a good human recommendation)
- **LOOP_WEIGHT counts tool CALLS, not token COST** — 50 heavy WebSearches == 50 light Writes. Wrong proxy for context pressure.
- **`[compact-required]` is a binary STOP** — no reason, no cost estimate, no MUST-vs-SHOULD, no user choice.
- **`×0.52` is a tuned magic constant** (history 0.30→0.45→0.52); it re-seeds the next session's CHAT_TOTAL, so a bad seed compounds across sessions.
- **Subagent pollution:** subagents write `session_tokens.md`, corrupting LOOP_WEIGHT; AGENTS.md works around this ("use hook value, not the file") instead of fixing the source — subagents should not write the main LOOP_WEIGHT.

## Design — the fix

### Principle 1 · Single Source of Truth (same move as mece §Per-Section Invariants)
- Define ALL compact thresholds + signals + the compact_size formula ONCE: `Implement/03_config.md §Compact` (one canonical table).
- Every other file REFERENCES it (`→ 03_config.md §Compact`) — never restates numbers.
- `.claude/settings.json` keeps numbers (it is executable code) but is the ONLY other copy, with a comment `# MUST match 03_config.md §Compact`.
- Net: change a threshold in 1 place, not 8.

### Principle 2 · Recommendation, not binary STOP (the pattern the user liked)
Replace `[compact-required] → STOP` with a structured `[compact-rec]` the model emits:
```
Recommend /compact: <now | after this step | not yet>
Why: session ~<N>k on this task · <what's heavy> · pending task self-contained? <yes/no>
MUST vs SHOULD: MUST only at the hard ceiling (SESSION_TOTAL >90k OR provider context near cap) · else SHOULD
Resume brief: <paste-ready, ≤5 lines>
Your call: "/compact" to do it now · "ทำต่อ" to continue (re-check in <N> steps)
```
- Hard STOP reserved for the genuine ceiling only. Everything below = a recommendation WITH a choice.

### Principle 3 · Fix the proxy
- Trigger on **CHAT_TOTAL growth** (actual context size) as primary; demote LOOP_WEIGHT to a secondary "many-calls" hint.
- OR weight LOOP_WEIGHT by per-turn tool-output tokens (the turn math already exists) so it tracks cost, not call-count.

### Bug fixes
- **BUG-1:** pick ONE CHAT_TOTAL policy (recommend: warn >80k · mandatory >120k · drop 180k) → make 03_config.md + AGENTS.md:218 + session_tokens template agree.
- **BUG-2:** READ `session_compactor.py` + `bootstrap_sessions.py` FIRST, then choose (a) delete chat_tokens.md, point session_compactor at session_tokens.md, fix bootstrap — fewer files, kills the duplicate [PREFERRED]; or (b) keep chat_tokens.md canonical and fix token_tracker:143's false claim. Do NOT pre-decide before reading the scripts.
- **BUG-3 [smallest fix, highest daily value — kills the turn-1 nag]:** B1 already resets SESSION_TOTAL when `phase ≠ in_progress`; add `LOOP_WEIGHT=0` to that SAME reset. Also add LOOP_WEIGHT=0 to PATH A/C close. Confirm subagents stop writing LOOP_WEIGHT (or scope their writes).

## Phased implementation (each phase independently shippable)
- **Phase A — BUGS** ✅ DONE (2026-06-08): BUG-3 → BUG-1 → BUG-2. All sandbox-verified.
    - BUG-3: B1 now force-zeroes LOOP_WEIGHT after the if/elif (python normalization) → covers the in_progress-resume path. Files: `AGENTS.md:10` (+ doc note) · `Implement/03_config.md` (both B1 copies L12+L619, via replace_all). Verified: bash -n OK + all 3 boot paths (in_progress preserves SESSION_TOTAL, zeroes LW; compact_restore & fresh-done unaffected). bootstrap CLEAN_INIT upgraded to 6 fields so LW exists from a fresh clone.
    - BUG-1: R3 table lowered to CHAT_TOTAL >80k recommend / >120k mandatory → now agrees with the "compact before 80k" prose (`03_config.md:168` + `AGENTS.md:218`). Was 120k/180k.
    - BUG-2: `chat_tokens.md` duplicate deleted (template + live). `session_compactor.py` (REQUIRED_FILES + MUST_EXIST) and `bootstrap_sessions.py` (TEMPLATE_MAP + CLEAN_INIT) no longer reference it — CHAT_TOTAL validated via session_tokens.md. Doc sweep: REPO_MAP.md ×2 · 02_setup.md ×2 (count 8→7) · harness-file-role-map.md · index_files.json. token_tracker/SKILL.md:143 left as-is (its "file does NOT exist" claim is now true). Scripts AST-parse + run clean; JSON valid.
    - NOTE for Phase B: `03_config.md` has TWO B1 copies (L12, L619) and L12 is missing the `sys_fixed=$(...)` definition — pre-existing latent bug. Phase B SSOT should collapse all 3 B1 copies (AGENTS.md is the operative/correct one) into one canonical source.
- **Phase B — SSOT** ✅ DONE (2026-06-08) — reinterpreted after an architecture discovery:
    - DISCOVERY: `Implement/03_config.md` is a template-megadoc (§4 CLAUDE.md template · §11 AGENTS.md template · §12 INVARIANTS · §13 REPO_MAP) → its 2 B1 copies are template instances, not runtime drift. Most "LOOP_WEIGHT gate ×4 / TOKEN PAUSE ×8" copies are the INTENTIONAL CLAUDE.md-summary + Implement/-full caching pattern (CLAUDE.md always-loaded; Implement/ on-demand). Flattening them → forces an on-demand read for every quick check = regression. Post-BUG-1 they're consistent, not contradictory. → deliberately NOT flattened.
    - FIXED (the one genuinely harmful dup): `compact_size = int(CHAT_TOTAL × 0.52)` magic constant — documented drift history (0.30→0.45→0.52), executable in 3+ places, one BROKEN (`import re,open as o`). Extracted to `scripts/compute_compact_size.py` (RETENTION=0.52 lives there ONLY). Wired 4 call sites: mece_plan_schema.md:130+245 · 03_config.md:525 · token_tracker/SKILL.md:84. Verified: matches old working one-liner (CHAT 50000→26000) · 0.52 now in 1 runtime place · index_files.json entry added (valid JSON) · live run 23991→12475. tool-manifest unchanged (utility scripts aren't listed there).
    - ✅ DONE (2026-06-08) template sync: both 03_config template B1 copies (§4 L12 · §11 L624) synced to the operative AGENTS.md B1 — they were missing ONLY the `sys_fixed=$(python3 ...)` definition (the BUG-3 LOOP_WEIGHT norm was already present from Phase A's replace_all; the earlier "no BUG-3 fix" note was inaccurate). All 3 B1 copies now byte-identical (len 1525 · verified by /tmp/b1diff.py). OBSERVATION (flagged, not acted on): §4 is the CLAUDE.md-gateway template yet embeds a full B1 — in the real project CLAUDE.md defers B1 to AGENTS.md, so this copy may be vestigial. Inherent drift risk remains (B1 is literal bash → can't be SSOT'd across template boundaries); keep the 2 template copies in sync on any future B1 edit.
- **Phase C — Smart recommendation** ✅ DONE (2026-06-08): three-tier model replaces the binary STOP. LOOP_WEIGHT demoted from a hard STOP to a RECOMMENDATION trigger; hard STOP moved to the genuine token ceiling.
    - Model: LW >30 → `[compact-rec]` light hint (optional, no STOP) · LW >50 → `[compact-rec]` strong (5-field recommendation + user choice, NOT a STOP) · SESSION_TOTAL >90k OR CHAT_TOTAL >120k → `[compact-STOP]` (the ONLY hard stop). Softener: LW>50 but SESSION<10k → downgrade to light hint. Precedence: ceiling > strong > light.
    - Ceiling numbers reuse existing thresholds (90k = token_tracker R3 HALT · 120k = BUG-1 mandatory) — unified into the hook, not invented.
    - Stage 1 (core 3, behavioral SoT): `.claude/settings.json` hook rewritten (reuses already-grepped st/ct vars, no new grep · raw-replace = 3-line diff · JSON re-validated · sandbox-tested all 6 tiers incl. precedence A–F) · `AGENTS.md` C0.5 L47 + L180-182 + L24 doc-note · `Implement/03_config.md` C0.5 BC L107-115 (added Softener+Precedence) + R3 table L169-170 + hard-STOP note.
    - Stage 2 (8 instructing files, drift-prevention · transactional 2-phase script): CLAUDE.md (always-loaded summary, +CHAT>120k HALT) · token_tracker/SKILL.md ×2 (thresholds + Tone-Keep list) · token_auditor/SKILL.md (audit row) · agent/SKILL.md ×4 (cycle gating → rec, forced-defer only at ceiling) · mece_plan_schema.md BC block · 06_orchestrator.md BC block · 08_checklist.md item · harness_health_checklist.md ×3 +new [compact-STOP] row.
    - Verified: 11 files carry new signals · old signals confined to 5 historical-record files (CFP-026 · index_cfp_fix.json · master_roadmap · 2 dated knowledge snapshots) + AGENTS.md L24's explicit "pre-Phase-C" label — all intentional, no drift · settings.json valid JSON.
    - Scoped OUT (flagged, not silently skipped): (1) Principle 3 proxy fix (LW counts calls not tokens) = separate Phase D; (2) Completion-gate close-check LW>50 (AGENTS L203) left as-is — it's a close-time trigger with a CFP-037 user-wait, not a mid-work STOP, and uses the numeric value not the renamed signal; (3) template-sync §4/§11 in 03_config (carried over from Phase B flag).
- **Phase D — Fix the proxy (Principle 3)** ✅ DONE (2026-06-08): D-A (CHAT_TOTAL primary) + D-C-harden (corruption-proof hook). SUPERSEDES Phase C's trigger mapping — the [compact-rec]/[compact-STOP] mechanism + 5-field format are KEPT; only WHAT triggers each tier changed.
    - D-A (spec Principle 3a): CHAT_TOTAL (real context size) is now the PRIMARY strong-rec trigger at >80k · LOOP_WEIGHT >50 demoted to a SECONDARY light hint only · LW>30 tier dropped · Softener removed. Final tiers: CHAT >80k → [compact-rec] strong · LW >50 → [compact-rec] light · SESSION >90k OR CHAT >120k → [compact-STOP]. 80k reuses the BUG-1 "recommend" threshold (0 new magic numbers). Hook (UserPromptSubmit) raw-replaced · sandbox-tested 5 tiers incl. CHAT-wins-over-LW precedence + LW>30-tier-gone · confirmed LIVE this session (UserPromptSubmit reloads mid-session). Docs: same 10 instructing files re-touched via transactional script (22 edits) to swap the mapping · verified stale Phase-C mapping fully removed + CHAT>80k present across all.
    - D-C (subagent pollution) REFRAMED by a live test: a 5-call subagent EMPTIED session_tokens.md to 0 bytes. Root cause: PostToolUse did read→modify→open('w')(truncate)→write; open('w') truncates immediately, so a hook killed at its 5s timeout mid-write (or a concurrent writer) leaves 0 bytes. PROVEN: `open(f,'w')` truncated a 32-byte file to 0 before any write.
        - FIX = C-harden (corruption-proof · field-independent · verifiable now): (1) GUARD — read empty / no LOOP_WEIGHT / malformed → exit without writing (never clobber a mid-update file); (2) ATOMIC write — tempfile + os.replace (live file never in a truncated state; interrupt before replace leaves it intact — PROVEN). No stdin read → no hang; hook stays env-only (TOOL_NAME). Unit-tested standalone: weights correct (Bash+1/Agent+3/Write+2/mcp+2) · all 3 guards fire · fields+order preserved · 25–30-parallel keeps file valid. Synthetic before/after race repro was inconclusive (python-startup jitter prevents tight overlap) — fix is sound BY CONSTRUCTION + matches the real observed corruption.
        - DEFERRED (low value now · needs restart): the original "subagent skips its increment" needs the subagent-marker field, which can't be probed mid-session — PostToolUse hooks snapshot at startup in this env (confirmed: a probe hook added mid-session never fired; only UserPromptSubmit reloads). D-A already demoted LOOP_WEIGHT to a low-impact secondary, so subagent INFLATION no longer causes false stops; C-harden fixes the only SEVERE part (corruption). To finish: re-add probe → restart once → read real field → skip on it.
    - ⚠️ Caveat: PostToolUse hook edits take effect only after a Claude Code RESTART in this env (mid-session PostToolUse reload is inert). C-harden goes live next session — verify by re-running the subagent test (file must NOT empty).

## Validation after each phase
- grep: each threshold appears in ONE canonical place + pointers elsewhere.
- Boot runs: B1 bash parses session_tokens.md (6 fields) with no error.
- `.claude/settings.json` is valid JSON; hooks still fire.
- A fresh session does NOT emit `[compact-required]` on turn 1 (proves BUG-3 fixed).

## Read these first in the impl session (NOT yet read this session)
`.claude/settings.json` · `scripts/session_compactor.py` · `scripts/bootstrap_sessions.py` · `scripts/write_context_cache.sh` · `Implement/03_config.md §R3 + §Token Tracking` · `.agents/skills/knowledge/session_manager/SKILL.md §3`
