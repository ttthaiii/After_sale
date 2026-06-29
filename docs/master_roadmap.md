# Master Roadmap

> Status: `[ ]` pending → `[/]` in progress → `[X]` done

---

## T-000: Harness initialized

- [X] T-000: Setup complete

---

<!-- Add project tasks below -->

## 9arm-Inspired Harness Improvements

- [X] T-001: Multi-surface Verifier — expand Reviewer prompt in mece/SKILL.md with task_type + surface table
- [X] T-002: Formal Closeout Schema — add objective/outcome/changes/validation/root_cause/follow_ups to session_manager §3 Step 4
- [X] T-003: Requirements Interviewer Upgrade — add refusal logic + output contract to AGENTS.md G0 + 03_config.md
- [X] T-004: Skill Governance Labels — add "bucket" field to skill-manifest.json
- [X] T-005: File Role Architecture Doc — create knowledge/harness-file-role-map.md
- [X] T-006: Skeptical Reviewer Phase — add M4.5 gate + new skeptical_reviewer/SKILL.md (after T-001+T-003)

## Contract Gap Audit — 6 Skills Fixed

- [X] T-007: file_manager + variable_manager — add Refusal + Workflow + Routing
- [X] T-008: self_improve — add Routing (→ return to session_manager §3)
- [X] T-009: token_tracker + token_auditor — add Refusal + Routing
- [X] T-010: ascii_flow — add Refusal + Routing
- [X] T-011: identity — declare as persona-only scope (not executable contract)
- [X] T-012: editor + coder — add File Size Contract (≤200L rule + split strategy)

- [X] T-013: editor + self_improve — split into SKILL.md (≤200L contract) + SKILL_detail.md (procedures) · attempts: 1 · tool_calls: 6



- [X] T-014: session_manager — add 5 contract elements + split 273L→92L + SKILL_detail.md · attempts: 1 · tool_calls: 5

- [X] T-015: mece — split 505L→116L + add R/O/Rt · SKILL_detail.md created · attempts: 1
- [X] T-016: coder (128L) + agent (199L) — add T/R/O/Rt contract elements · attempts: 1
- [X] T-017: harness_doctor (241L) + skeptical_reviewer (87L) — add R/O/Rt · attempts: 1
- [X] T-018: ascii_flow + token_tracker + token_auditor — add missing T/O elements · attempts: 1

- [X] T-019: token formula fix — CLAUDE.md R1 + token_tracker/SKILL.md + scripts/token_estimator.py · accuracy: 84.5% vs 137.3k actual · attempts: 1 · tool_calls: 12

- [X] T-020: MECE template behavioral contract closure — mece/SKILL.md + SKILL_detail.md + 5 MECE Constraints Blocks added · attempts: 1 · tool_calls: 18

- [X] T-021: harness_editor skill creation — new skill for harness file editing with mandatory MECE plan + index + harness_flow + Implement updates · attempts: 1 · tool_calls: 22

- [X] T-022: backlink cross-links — harness_doctor ↔ harness_editor bidirectional Routing cross-references · attempts: 1 · tool_calls: 4

- [X] T-024: populate index_files.json — 10 harness file entries (GAP-1/4/5/6) + backlinks · 12 entries total · attempts: 1 · tool_calls: 5

- [X] T-025: compact improvements — B1 CHAT_TOTAL reset + pre-compact state emit + compact_state section+step fields · attempts: 1 · tool_calls: 14


- [X] T-023: harness_doctor — add Workflow heading + split 242L → SKILL_detail.md · attempts: 1 · tool_calls: 3
- [X] T-026: harness immune system repair — S1 doctor split · S2 self_improve contract · S3 CFP detection signals · attempts: 1 · tool_calls: 12


- [X] T-027: topic-graph backlink system — topic_registry.json + 3-tier index_files.json + backlink_analyzer.py · attempts: 1 · tool_calls: 18


- [X] T-028: post-T-027 index sync + behavioral contract clarity — G1-G6 gaps closed · CFP-020 logged · 47 related[] links · attempts: 1 · tool_calls: 16

- [X] T-029: session bootstrap + template system — .gitignore fix · docs/session_templates/ · bootstrap_sessions.py · self_improve_log · 60 related[] links · attempts: 1 · tool_calls: 20

- [X] T-030: session_compactor.py health check + identity/SKILL.md schema update · attempts: 1 · tool_calls: 6

- [X] T-031: behavioral contract — ## Workflow added to 7 skills · ascii_flow split 228L→58L · 14/15 skills 5/5 · attempts: 1 · tool_calls: 18

- [X] T-032: harness_doctor — CFP-021 L5 DECIDE mece_plan update + CLAUDE.md Phase 3 step 0 · first fix recorded · attempts: 1 · tool_calls: 12

- [X] T-033: REPO_MAP.md structure tree update — 24 entries added · 114L→158L · attempts: 1 · tool_calls: 12

- [X] T-034: harness_editor Step 5B — REPO_MAP.md MANDATORY trigger added · attempts: 1 · tool_calls: 5

- [X] T-035: session-health check — Completion Gate + session_manager trigger + Output Contract · attempts: 1 · tool_calls: 10
- [X] T-036: CFP-022 — CHAT_TOTAL boot init fix · AGENTS.md+CLAUDE.md B1 CHAT_TOTAL:0→7300 · attempts: 1 · tool_calls: 12
- [X] T-037: CFP-023 + harness_editor Step 5 gate + Docs backfill T-034/035/036 · attempts: 1 · tool_calls: 28
- [X] T-038: mece_plan full Phase 0-3 template enforcement + conditional close paths (→ mece_plan_schema.md · AGENTS.md M5 · mece/SKILL.md S1-E · harness_flow Y19 · Implement/04+08) · attempts: 1 · tool_calls: 22
- [X] T-039: 08_checklist Behavioral Contract + Thai close backfill (Step 5 missed) + stale ref fix + mece_plan_schema conditional Step 5 gate (→ harness_flow Y20 · Implement/04+08 · mece_plan_schema §Close · 08 BC) · attempts: 1 · tool_calls: 18
- [X] T-040: Migration Guide — Implement/09_migration.md (298L · 4 tracks M1-M4) + 00_index.md Track C + 01_overview.md Track A/B/C + 02_setup.md §9 + harness_flow Y21 · attempts: 1 · tool_calls: 20
- [X] T-041: Asset Plan Priority 1+2 features — mece_plan_schema.md (Tool/Rollback/Data_Sent/Token fields · Files Read tables · TOKEN CHECK runtime · [mece-audit]+feedback) + AGENTS.md M1.5 (dependency_map/risk_flags) + Implement/04+08 · attempts: 1 · tool_calls: 22
- [X] T-042: Token Optimization Pack — safe_run.py (priority-first filter · 97.5% git noise reduction) + AGENTS.md (reviewer inline · compact 30k · cache note) + CLAUDE.md R3 + Implement/04+08 + docs/token_benchmark.md · attempts: 1 · tool_calls: 28
- [X] T-043: CHAT_TOTAL formula fix — compact_size field in compact_state.md + B1 reads compact_size → CHAT_TOTAL = compact_size + 7300 + triangular undercount note in R1 · attempts: 1 · tool_calls: 12

- [X] T-044: token formula accuracy fix · attempts: 1 · tool_calls: 20 — compact_size 0.30→0.45 · sys_fixed dynamic · hooks_per_turn 1300→700

- [X] T-045: token formula accuracy test · attempts: 1 · tool_calls: 8 — harness 32.3k vs actual 40.6k · error: 20.5% · ratio: 1.26× (T-044 improvement: 1.49×→1.26×)

- [X] T-046: token formula accuracy fix v2 · attempts: 1 · tool_calls: 8 — turn_tokens ×1.3 + compact_size 0.45→0.52 · expected boot error <3%

- [X] T-047: Knowledge Conflict Detection — S1 schema extension · attempts: 1 · tool_calls: 4 — 6 fields added to 28 entries (summary/key_claims/supersedes/superseded_by/key_claims_generated_at/key_claims_stale) + backlink_analyzer.py soft-warn
- [X] T-048: Knowledge Conflict Detection — S2 backfill_knowledge_index.py · attempts: 1 · tool_calls: 2 — 2-step workflow (extract+write) · scaled excerpt 60L cap · auto-supersedes from _YYYYMMDD.md pattern
- [X] T-049: Knowledge Conflict Detection — S3 knowledge_conflict_checker.py · attempts: 1 · tool_calls: 2 — 0 LLM tokens Stage 1 · phrase matching ≥3 words · verdict: clean/low_priority/review_recommended · token_estimate: 295 (budget <2000)
- [X] T-050: Knowledge Conflict Detection — S4 R8 integration · attempts: 1 · tool_calls: 3 — AGENTS.md +1L · EXCLUDE list prevents circular loop · stale key_claims rule · verdict→action mapping

## Token Efficiency & Observability — Phase 1 (T-051–T-055)

- [X] T-051: Cache hit logging infra — CACHE_READ/CACHE_WRITE fields in session_tokens.md, B1 printf, bootstrap_sessions.py, session_compactor.py · attempts:1 · tool_calls:6
- [X] T-056: Context cache Stop hook — scripts/write_context_cache.sh + .claude/settings.json Stop event → session_context_cache.md written every turn end · attempts:1
- [X] T-052: 4-bucket token attribution footer — CLAUDE.md R1 emit rule added [sys:Nk tools:Nk hist:Nk out:Nk] · attempts:1 · tool_calls:2
- [X] T-053: token_log.jsonl telemetry — write_context_cache.sh appends JSON line per Stop event · attempts:1 · tool_calls:3
- [X] T-054: Provider routing decision tree — AGENTS.md §R4 table (haiku/sonnet routing by task type+volume) · attempts:1 · tool_calls:3
- [X] T-055: 30-day token efficiency rollout — phases 1+2 complete (T-051–T-054) · phase 3 = ongoing per-session habit via CLAUDE.md R1+R3 + AGENTS.md R4 · attempts:1 · tool_calls:1

## Provider-Agnostic Model Tiers

- [X] T-057: Model tier system — MODEL_HIGH/MEDIUM/LOW · Implement/03_config.md §Model Tiers · AGENTS.md R4 + OmO · mece/SKILL_detail.md · detected.md fields · attempts:1 · tool_calls:10
- [X] T-058: Implement.md bootstrap prompt — Phase 0-5 agent instruction · Track A/B/C · Model Tiers Phase 3 · verify checklist · attempts:1 · tool_calls:4
- [X] T-059: Token Efficiency Pack v2 — Output Contracts · State-Retention · Tool Compression · Spike Detection · harness_flow Y28 · attempts:1 · tool_calls:14
- [X] T-060.1: JSONL per-turn logging rule in CLAUDE.md R1 · attempts:1 · tool_calls:2
- [X] T-060.2: Cache hit % guardrail ≥60% in CLAUDE.md · attempts:1 · tool_calls:1
- [X] T-060.3: Alert types (5 additional) in CLAUDE.md · attempts:1 · tool_calls:1
- [X] T-060.4: Fix token_estimator.py SYSTEM_FIXED dynamic + hooks_per_turn=700 · attempts:1 · tool_calls:2
- [X] T-060.5: Tool schema serialization + session_summary rule in AGENTS.md · attempts:1 · tool_calls:2
- [X] T-060.6: Rolling summary trigger (SESSION_TOTAL >40k + turns ≥8) in CLAUDE.md R3 · attempts:1 · tool_calls:2
- [X] T-060.7: Cache breakpoint hash tracking in AGENTS.md Boot · attempts:1 · tool_calls:2
- [X] T-060.8: Implement/03_config.md sync — all T-060 changes · attempts:1 · tool_calls:5

## Execution Log File System — T-061

- [X] T-061.1: exec_log dir + AGENTS.md L4.5 OFFLOAD rule · attempts:1 · tool_calls:3
- [X] T-061.2: CLAUDE.md Tool-Result Offload rule · attempts:1 · tool_calls:2
- [X] T-061.3: scripts/trim_exec_log.py (prune 24h/50 files) · attempts:1 · tool_calls:2
- [X] T-061.4: Completion Gate trim_exec_log step in AGENTS.md · attempts:1 · tool_calls:2
- [X] T-061.5: Implement/03_config.md sync — exec_log + offload rule · attempts:1 · tool_calls:2

## Harness Doctor — CFP-024 Structural Fix

- [X] T-062: harness_doctor CFP-024 — R16 MANDATORY CFP write · CLAUDE.md + Implement/03_config.md · attempts:1 · tool_calls:6

## Harness Doctor — CFP-025 Structural Fix

- [X] T-063.1: mece_plan_schema.md PATH A Clear + NEVER ad-hoc rule · attempts:1 · tool_calls:2
- [X] T-063.2: CLAUDE.md PATH A Clear enforcement rule · attempts:1 · tool_calls:1
- [X] T-063.3: AGENTS.md PATH A Clear enforcement rule · attempts:1 · tool_calls:1
- [X] T-063.4: index_cfp_fix.json CFP-025 status → fixed · attempts:1 · tool_calls:1
- [X] T-063.5: Implement/03_config.md sync · attempts:1 · tool_calls:1

## Token Formula Accuracy Fix — T-064

- [X] T-064.1: CLAUDE.md R1 — 1.3×→1.5× + cache invalidation cascade note · attempts:1 · tool_calls:2
- [X] T-064.2: AGENTS.md bucket_sys — tool schema carry-forward note · attempts:1 · tool_calls:2
- [X] T-064.3: scripts/token_estimator.py — multiplier 1.3→1.5 + --schema-drift flag · attempts:1 · tool_calls:3
- [X] T-064.4: Implement/03_config.md sync · attempts:1 · tool_calls:2

## Token System Upgrade — T-065

- [X] T-065.1: CLAUDE.md R1 — reasoning_tokens formula + Thai drift note + hooks_overhead note
- [X] T-065.2: CLAUDE.md R1 — JSONL schema extension (13→21 fields, null-safe)
- [X] T-065.3: CLAUDE.md R1 — bucket sub-attribution notes (bucket_retrieval + bucket_tool_schema)
- [X] T-065.4: CLAUDE.md R3/R10 + bootstrap — auto history cap + CHAT_TOTAL adj + session_memory.md
- [X] T-065.5: AGENTS.md Phase 3 — cache control rules + tool schema hash detection

## Token Optimization Pack — T-066

- [X] T-066.1: CLAUDE.md R4 + AGENTS.md — provider phase routing table (G1/G2→MODEL_LOW, MECE/Execute→MODEL_HIGH, Reviewer→MODEL_LOW)
- [X] T-066.2: CLAUDE.md R1 — estimated_cost_usd formula (Sonnet/Haiku price tiers)
- [X] T-066.3: CLAUDE.md R1 — bucket_retrieval active + footer [ret:Nk] display
- [X] T-066.4: AGENTS.md Phase 3 — [schema-gate] rule for mid-session SKILL.md edits
- [X] T-066.5: CLAUDE.md R1 — telemetry retention 30-day policy + trim_exec_log reference

## Loop Weight Tracking — T-067

- [X] T-067.1: session_tokens.md + B1 printf — TURN_COUNT + LOOP_WEIGHT fields
- [X] T-067.2: PostToolUse hook — LOOP_WEIGHT weight increment (S/M/L)
- [X] T-067.3: CLAUDE.md R1 footer + R3 table + AGENTS.md Phase 3 warn template
- [X] T-067.4: AGENTS.md M1.5 — proactive compact checkpoint trigger
- [X] T-067.5: mece_plan_schema.md — compact step template

## Behavior Contract Enforcement — T-068

- [X] T-068.1: CFP-026 — conditions/triggers without BC (AGENTS.md C0.5 gate + mece_plan_schema BC block + CODING_FAILURE_PATTERNS.md)

## Implement/ Docs Upgrade (T-067+T-068 Sync) — T-069

- [X] T-069.1: 03_config.md — R3 LOOP_WEIGHT rows + C0.5 BC + PostToolUse spec + compact_checkpoint formula
- [X] T-069.2: 04_skills.md — M1.5 compact_checkpoint formula + footer BC
- [X] T-069.3: 06_orchestrator.md — C0.5 BC gate + LOOP_WEIGHT cycle routing + compact_checkpoint ref
- [X] T-069.4: 08_checklist.md — T-067+T-068 verification items · attempts:1 · tool_calls:2
- [X] T-069.5: 09_migration.md — M5 migration section: TURN_COUNT+LOOP_WEIGHT fields · PostToolUse hook · compact_checkpoint · attempts:1 · tool_calls:2
- [X] T-069.6: 01_overview.md + 02_setup.md — session_tokens.md 6-field schema description · attempts:1 · tool_calls:3

## Asset Plan Harness Upgrade — T-070

- [X] T-070.1: backup old harness → AP/.sessions/harness_backup_20260601/ (8 items) · attempts:1 · tool_calls:2
- [X] T-070.2: copy core files (CLAUDE.md·AGENTS.md·CFP·REPO_MAP·INVARIANTS) · sha1 verified · attempts:1 · tool_calls:1
- [X] T-070.3: rsync .agents/ (+ harness_editor + skeptical_reviewer added) · attempts:1 · tool_calls:1
- [X] T-070.4: rsync Implement/ (+ 6 new files) · attempts:1 · tool_calls:1
- [X] T-070.5: rsync scripts/ + docs/session_templates/ + token_benchmark.md · attempts:1 · tool_calls:2
- [X] T-070.6: .gitignore append + session_tokens 6 fields + .claude/settings.json · attempts:1 · tool_calls:1

## Harness BC Gaps Fix — T-071

- [X] T-071.1: mece_plan_schema.md — PATH A + PATH C Session Close BC (Pre/Contract/Post/Enforce) · attempts:1 · tool_calls:2
- [X] T-071.2: mece/SKILL_detail.md — Phase 3 close block Session Close BC · attempts:1 · tool_calls:1
- [X] T-071.3: .claude/settings.json — UserPromptSubmit hook C0.5 LOOP_WEIGHT warn (>30) + required (>50) · attempts:1 · tool_calls:1
- [X] T-071.4: CLAUDE.md — trim R1 detail → pointer · 252L→191L (≤200L) · attempts:1 · tool_calls:1
- [X] T-071.5: AGENTS.md — trim Phase 1-3 + Sub-agent detail → pointer · 281L→200L (≤200L) · attempts:1 · tool_calls:3
- [X] T-071.6: CODING_FAILURE_PATTERNS.md — CFP-030 session close BC skipped · attempts:1 · tool_calls:1

## Cross-Platform Hooks + Dynamic Root — T-072

- [X] T-072.1: .claude/settings.json — ROOT pattern + python3 LOOP_WEIGHT + PreToolUse gate (all Edit/Write except .sessions/) · attempts:1 · tool_calls:2
- [X] T-072.2: Implement/03_config.md — PostToolUse template python3 + PreToolUse template + Cross-Platform Notes block · attempts:1 · tool_calls:1

## harness_doctor Topic Matching + BC Enforcement — T-073

- [X] T-073.1: knowledge/cfp_topics.md — canonical topic registry · 8 topics · 26 CFPs assigned · attempts:1 · tool_calls:2
- [X] T-073.2: knowledge/index_cfp_fix.json — schema update (topic/recurrences[]/count/approved_proposal) · 20 entries · attempts:1 · tool_calls:1
- [X] T-073.3: CODING_FAILURE_PATTERNS.md — CFP template block (topic:/count:/recurrences:) · attempts:1 · tool_calls:2
- [X] T-073.4: .agents/skills/harness/harness_doctor/SKILL_detail.md — §1 rewrite: BC-A Resume + BC-B Keyword + BC-C AI Judge + BC-D Exhaustion Gate + BC-E Threshold · attempts:1 · tool_calls:2
- [X] T-073.5: .agents/skills/harness/harness_doctor/SKILL.md — Resume Gate BC + Threshold BC + Output Contract 11 signals · attempts:1 · tool_calls:3

## T-076 · BC Retrofit — Behavior Contract enforcement across all harness skills
- [X] T-076.1: harness_editor/SKILL.md — 4 BC blocks: Refusal Gate · Scope Probe · MECE Gate · Docs Close · attempts:1 · tool_calls:4
- [X] T-076.2: self_improve/SKILL.md — 2 BC blocks: Cooldown Gate · Approval Gate · attempts:1 · tool_calls:2
- [X] T-076.3: self_improve/SKILL_detail.md — 3 BC blocks: Pre-Edit Backup · Hard Rules · Audit Log Write · attempts:1 · tool_calls:3
- [X] T-076.4: session_manager/SKILL.md — 2 BC blocks: Handoff Validation · 5-file Completion Gate · attempts:1 · tool_calls:2
- [X] T-076.5: mece/SKILL.md — 2 BC blocks: Validation Gate · mece-fail Halt · attempts:1 · tool_calls:2

## T-077 · harness_doctor CFP-006 — Loop_W footer reads stale boot value
- [X] T-077.1: .claude/settings.json — C0.5 hook >&2 → stdout · agent now sees [compact-warn] · attempts:1 · tool_calls:1
- [X] T-077.2: CLAUDE.md R1 footer BC — Pre strengthened: MUST read file · stale Loop_W detection · BC-footer-read enforce · attempts:1 · tool_calls:1

## T-075 — error_index redesign
- [X] T-075.1: Create knowledge/error_topics.md (6 topics: database-d1, edge-runtime, csv-parsing, auth-token, api-external, type-safety)
- [X] T-075.2: Rewrite knowledge/error_index.md (Topic→Problem→Occurrences schema + ERR-007 seed)
- [X] T-075.3: Edit CLAUDE.md R9 — Topic Lookup BC + Active Fix BC
- [X] T-075.4: R8 index sync (index_files.json + roadmap)

## T-079 — Implement/03_config.md + 04_skills.md — error_index schema + BC hooks
- [X] T-079.1: 04_skills.md ~361 — ERR-XXX template → new schema + BC Topic Lookup inline · attempts:1 · tool_calls:2
- [X] T-079.2: 04_skills.md ~480 — grep search example + it_work/topic fields + BC Active Fix note · attempts:1 · tool_calls:2
- [X] T-079.3: 03_config.md R9 — BC Topic Lookup + BC Active Fix (Pre/Contract/Post/Enforce) · attempts:1 · tool_calls:2
- [X] T-079.4: 04_skills.md Phase 2 ~740 — BC Write-Before-Present (mirror AGENTS.md) · attempts:1 · tool_calls:2

## T-080 — Implement/08_checklist.md + 09_migration.md — error_index schema + BC hooks
- [X] T-080.1: 08_checklist.md ~387 — ERR-XXX template → new schema + BC Topic Lookup + BC Active Fix · attempts:1 · tool_calls:2
- [X] T-080.2: 09_migration.md ~347 — M5 Step 5 add BC Topic Lookup + BC Active Fix + Step 6 verify · attempts:1 · tool_calls:2

## T-081 — CLAUDE.md + AGENTS.md — BC format for all enforcement points
- [X] T-081.1: CLAUDE.md — Phase Transition Gate + R8 + R12 + R14 + R15 → BC format · attempts:1 · tool_calls:5
- [X] T-081.2: AGENTS.md — schema-gate + Completion Gate → BC format · attempts:1 · tool_calls:2

## T-082 — CLAUDE.md — BC format for remaining enforcement gaps
- [X] T-082.1: Phase 3 close sequence → BC (Behavior Contract — Phase 3 Close Sequence) · attempts:1 · tool_calls:1
- [X] T-082.2: R5 Index-First Lookup → BC (Behavior Contract — Index-First Lookup) · attempts:1 · tool_calls:1
- [X] T-082.3: Never-Full-Load → BC (Behavior Contract — Never-Full-Load) · attempts:1 · tool_calls:1

## T-083 — Loop_W hook fix + mece schema enforce + BC-B find-existing-first
- [X] T-083.1: mece/SKILL.md S1-E + AGENTS.md M5 BC — schema Read mandatory before mece_plan.md write (CFP-019 fix) · attempts:1 · tool_calls:4
- [X] T-083.2: CLAUDE.md R1 footer BC — [token-state] hook inject mandate · NEVER cached/estimated (CFP-031) · attempts:1 · tool_calls:2
- [X] T-083.3: .claude/settings.json — UserPromptSubmit hook exit-0 bug fix · token-state echo before exit · attempts:1 · tool_calls:2
- [X] T-083.4: CLAUDE.md R16 BC-B — 4-step find-existing-first mandate (grep index_cfp_fix.json → cfp_topics.md → AI judge → new-topic-proposed) · attempts:1 · tool_calls:2
- [X] T-083.5: CODING_FAILURE_PATTERNS.md — CFP-031 added (Loop_W stale 0) · index_cfp_fix.json CFP-006 recurrence + CFP-028 + CFP-031 registered · attempts:1 · tool_calls:4
- [X] T-083.6: compact_state.md mece_h updated 9fec9499→039c2b26 · session_handoff + active_thread updated · attempts:1 · tool_calls:3

## T-084 — T-083 Roadmap Backfill + T-063 CFP-025 PATH A Clear Fix
- [X] T-084.1: docs/master_roadmap.md — T-083 section backfill · attempts:1 · tool_calls:2
- [X] T-084.2: mece_plan_schema.md — PATH A NEVER ad-hoc rule · attempts:1 · tool_calls:2
- [X] T-084.3: CLAUDE.md + AGENTS.md — PATH A Clear enforcement rule · attempts:1 · tool_calls:3
- [X] T-084.4: index_cfp_fix.json CFP-025 status→fixed + Implement/03_config.md sync · attempts:1 · tool_calls:3

## T-085 — BC Gaps Fix + File Size Enforcement ≤250L
- [X] T-085.1: CLAUDE.md — Boot Gate BC added · Boot section condensed · R1 formula pointer · attempts:1 · tool_calls:4
- [X] T-085.2: AGENTS.md — TOKEN PAUSE BC + C3 Topic Switch BC · 250L ✅ · attempts:1 · tool_calls:4
- [X] T-085.3: token_auditor/SKILL.md — Halt Threshold BC · agent/SKILL.md — Cycle HALT BC · attempts:1 · tool_calls:3
- [X] T-085.4: Roadmap [X] + Index Sync · attempts:1 · tool_calls:2
- [X] T-085.5: CLAUDE.md Move strategy — R3/R4/R10-R11 → 03_config.md + R13 BC · 250L ✅ · attempts:1 · tool_calls:10
- [X] T-085.6: symbol_indexer.py run → Asset Plan index 74 symbols ✅ · attempts:2 · tool_calls:3

## T-086 · Repo Researcher Skill
- [X] T-086.1: .agents/skills/knowledge/repo_researcher/SKILL.md — 91L ≤250 · 3 BCs ✅ · attempts:1 · tool_calls:2
- [X] T-086.2: scripts/repo_scout.py — clone+validate+enumerate+lang detect → JSON ✅ · attempts:1 · tool_calls:2
- [X] T-086.3: 3 research templates (summary+improvement+repo_map) ✅ · attempts:1 · tool_calls:3
- [X] T-086.4: skill-manifest.json + tool-manifest.json + knowledge/research/ ✅ · attempts:1 · tool_calls:4
- [X] T-086.5: index_files.json synced — 5 new entries ✅ · attempts:1 · tool_calls:2

## T-087 · Harness Health Checklist
- [X] T-087.1: docs/harness_health_checklist.md — 362L · 17 checks · all BC/Rule domains ✅ · attempts:1 · tool_calls:1
- [X] T-087.2: harness_doctor/SKILL.md — BC-pre-audit added · checklist ref ✅ · attempts:1 · tool_calls:1
- [X] T-087.3: index_files.json synced + roadmap [X] ✅ · attempts:1 · tool_calls:1

## T-089 · BC Enforcement: Logic Connector Skills
- [X] T-089.1: file_manager — BC-Index-Return ✅ · attempts:1 · tool_calls:1
- [X] T-089.2: variable_manager — BC-Symbol-Return ✅ · attempts:1 · tool_calls:1
- [X] T-089.3: coder — BC-Index-Sync-Gate ✅ · attempts:1 · tool_calls:1
- [X] T-089.4: editor — BC-Error-Index-Gate + BC-Symbol-Change-Gate ✅ · attempts:1 · tool_calls:1
- [X] T-089.5: ascii_flow — BC-Invoke-Gate + BC-Ascii-Return ✅ · attempts:1 · tool_calls:1
- [X] T-089.6: skeptical_reviewer — BC-Output-Format ✅ · attempts:1 · tool_calls:1
- [X] T-089.7: harness_flow Y37 + roadmap [X] ✅ · attempts:1 · tool_calls:2

## T-088 · doc_builder Skill
- [X] T-088.1: .agents/skills/content/doc_builder/SKILL.md ✅ · attempts:1 · tool_calls:1
- [X] T-088.2: .agents/skills/content/doc_builder/SKILL_detail.md ✅ · attempts:1 · tool_calls:1
- [X] T-088.3: skill-manifest.json — doc_builder entry added ✅ · attempts:1 · tool_calls:1
- [X] T-088.4: index_files.json + roadmap [X] ✅ · attempts:1 · tool_calls:2

## T-090 · project_presenter Skill
- [X] T-090.1: .agents/skills/content/project_presenter/SKILL.md ✅ · attempts:1 · tool_calls:2
- [X] T-090.2: .agents/skills/content/project_presenter/SKILL_detail.md ✅ · attempts:1 · tool_calls:1
- [X] T-090.3: docs/session_templates/storytelling_template.md ✅ · attempts:1 · tool_calls:1
- [X] T-090.4: skill-manifest.json — project_presenter entry added ✅ · attempts:1 · tool_calls:3

## T-091 · harness_doctor structural fixes P1–P5
- [X] T-091.1: index_cfp_fix.json CFP-033/034/037 count=3 status=fixing ✅ · attempts:1 · tool_calls:1
- [X] T-091.2: AGENTS.md BC-M5-verify added (P1) ✅ · attempts:2 · tool_calls:2
- [X] T-091.3: AGENTS.md close-gate-check+pre-read-L1+L4.5-purge-signal (P2+P3+P5) ✅ · attempts:1 · tool_calls:3
- [X] T-091.4: mece_plan_schema.md r8-sync-check added (P4) ✅ · attempts:1 · tool_calls:1
- [X] T-091.5: index_files.json T-090 files indexed (R8) ✅ · attempts:1 · tool_calls:1

## T-092 · Hybrid BC Migration
- [X] T-092.1: harness_editor/SKILL.md — §BC Selection Guide added · 178L · attempts:1 · tool_calls:3
- [X] T-092.2: AGENTS.md — 8→4 BCs (C3/M5-present/Bash-filter/Schema-gate → Signal Contracts) · attempts:1 · tool_calls:5
- [X] T-092.3: CLAUDE.md — 15→6 BCs (Footer/Cache/Index-First/Never-Full-Load/Index-Sync/Topic-Lookup/Active-Fix/Post-Edit/Escalation → Signal Contracts) · attempts:1 · tool_calls:7

## T-093 · Enforcement Gap Fix (3 gaps post-T-092)
- [X] T-093.1: .claude/settings.json — PreToolUse hook: add Read tool + PROHIBITED file list (never-full-load machine block) · attempts:1 · tool_calls:3
- [X] T-093.2: AGENTS.md — C0.5 BC (10L) → Signal Contract (1L) · BC count 4→3 · attempts:1 · tool_calls:2
- [X] T-093.3: docs/session_templates/mece_plan_schema.md — tick gate note (×2: S1+SN templates) · attempts:1 · tool_calls:2

## T-094 · BC Selection Guide Expand + Manifest Trigger Fix
- [X] T-094.1: harness_editor/SKILL.md — §BC Selection Guide: add Anti-patterns table + real examples + expanded decision tree
- [X] T-094.2: skill-manifest.json — harness_editor trigger + keywords: add BC/hook/signal/tier selection triggers

## T-095 · Manifest Tool Routing + MECE Schema Integration
- [X] T-095.1: skill-manifest.json — activates_at[] + tools{} added to 17 skills · attempts:1 · tool_calls:2
- [X] T-095.2: mece_plan_schema.md — Avoid: field + M2 grep note · attempts:1 · tool_calls:2
- [X] T-095.3: AGENTS.md — M2 Signal Contract added · attempts:1 · tool_calls:1

## T-096 · harness_doctor BC Upgrade + BLOCK Gate
- [X] T-096.1: mece_plan_schema.md — harness_doctor close item → full BC · attempts:1 · tool_calls:2
- [X] T-096.2: CODING_FAILURE_PATTERNS.md CFP-038 — BLOCK/HALT enforcement · attempts:1 · tool_calls:2

## T-097 · settings.json PreToolUse Close-Gate Hook
- [X] T-097.1: .claude/settings.json — close-gate block: Edit active_thread.md phase:done blocked until .close_checklist_ack exists · attempts:1 · tool_calls:2

## T-098 · mece_plan_schema.md Phase 3 Execution Complete Pause BC
- [X] T-098.1: docs/session_templates/mece_plan_schema.md — BC-exec-pause block inserted before §Close Checklist · attempts:1 · tool_calls:2

## T-099 · CFP-039 Close Checklist Output Gap
- [X] T-099.1: CODING_FAILURE_PATTERNS.md CFP-039 + index_cfp_fix.json + cfp_topics.md session-close updated · attempts:1 · tool_calls:3

## T-100 · kcc bug fix L183 AttributeError
- [X] T-100.1: scripts/knowledge_conflict_checker.py — isinstance(entry_b, dict) guard added at L183 · attempts:1 · tool_calls:2

## T-101 · BC-mece-compact — Force /compact Before Phase 3
- [X] T-101.1: AGENTS.md — BC-mece-compact added after BC-M5-verify · [mece-complete] + /compact prompt · attempts:1 · tool_calls:3
- [X] T-101.2: mece_plan_schema.md — compact note added after Phase 2 TOKEN CHECK · attempts:1 · tool_calls:2

## T-102 · skill_auditor — New Skill: Audit SKILL.md Against 9arm Framework
- [X] T-102-A.1: .agents/skills/harness/skill_auditor/SKILL.md created (197L) · 8 components + 6 connection types · adversarial stance · BC over-enforcement detection · attempts:1 · tool_calls:8
- [X] T-102-A.2: skill-manifest.json — skill_auditor entry added · keywords + on_demand_files · attempts:1 · tool_calls:1
- [X] T-102-A.3: index_files.json + harness_flow Y45 + roadmap [X] · attempts:1 · tool_calls:1

## T-105 · harness_editor SKILL.md — 9arm Framework Upgrade
- [X] T-105.1: .agents/skills/harness/harness_editor/SKILL.md — add Operating Stance + When NOT to Use + Signal Contract + Output Contract labels + Tone Guide + Hard Rules + YAML keywords

## T-106 · mece/SKILL.md — 9arm Framework Upgrade
- [X] T-106.1: .agents/skills/harness/mece/SKILL.md — add Operating Stance + Prerequisites + Hard Rules + Tone Guide + YAML keywords · 146L → 180L 🟢 · BC count: 2 (unchanged) · attempts:1 · tool_calls:6

## T-107 · Over-Prescription Fixes: AGENTS.md + CLAUDE.md + mece/SKILL.md
- [X] T-107.1: AGENTS.md — BC-M5-verify: replace 4 grep commands with principle-based assessment · attempts:1 · tool_calls:2
- [X] T-107.2: AGENTS.md — C2 freshness check: replace mechanical grep with intent-based description · attempts:1 · tool_calls:2
- [X] T-107.3: CLAUDE.md — R16 Doctor Flow: replace keyword scoring (score ≥ 2) with judgment-based matching · attempts:1 · tool_calls:2
- [X] T-107.4: mece/SKILL.md — add Signal Contract: write mece_plan.md before presenting plan to user · attempts:1 · tool_calls:1

## T-108 · Index System Fixes: variable_manager + AGENTS.md Index Sync Invariant
- [X] T-108.1: variable_manager/SKILL.md — diagnose current trigger + schema · attempts:1 · tool_calls:2
- [X] T-108.2: variable_manager/SKILL.md — judgment-based trigger + schema (used_in/signature/last_modified) · attempts:1 · tool_calls:3
- [X] T-108.3: AGENTS.md — Index Sync Invariant trigger → cross-file dependency judgment · attempts:1 · tool_calls:2
- [X] T-108.4: harness_flow + roadmap close · attempts:1 · tool_calls:2

## T-109 · mece Close/Handoff Flow Fixes: BC-exec-pause + Close Checklist + Hard Rules
- [X] T-109.1: mece_plan_schema.md — confirm BC-exec-pause line numbers · attempts:1 · tool_calls:1
- [X] T-109.2: mece_plan_schema.md — replace keyword matching with intent assessment + PATH A pointer · attempts:1 · tool_calls:2
- [X] T-109.3: mece/SKILL.md — Hard Rule 8: post-exec new task routing · attempts:1 · tool_calls:2
- [X] T-109.4: harness_flow + roadmap close · attempts:1 · tool_calls:3

## T-110 · Skill Manifest Discovery & Match Signal
- [X] T-110.1: AGENTS.md B2 — head-80 → head-160 · attempts:1 · tool_calls:2
- [X] T-110.2: AGENTS.md B2 — add skill-match/miss/explicit signal contract · attempts:1 · tool_calls:1
- [X] T-110.3: skill-manifest.json — move skill_auditor into skills{} block · attempts:1 · tool_calls:3
- [X] T-110.4: harness_flow Y49 + roadmap close · attempts:1 · tool_calls:2

## T-112 · harness_editor ↔ skill_auditor Wiring
- [X] T-112.1: harness_editor/SKILL.md Step 1 — add conditional audit wiring (Why/How/Judgment-call) · attempts:1 · tool_calls:1
- [X] T-112.2: harness_editor/SKILL.md Hard Rules — add structural-edit audit rule · attempts:1 · tool_calls:1
- [X] T-112.3: harness_flow Y50 + roadmap close · attempts:1 · tool_calls:2

## T-113 · coder + editor + skill_auditor 9arm Upgrade
- [X] T-113.1: editor/SKILL.md — Operating Stance + When NOT to Use · attempts:1 · tool_calls:2
- [X] T-113.2: editor/SKILL.md — Tone Guide + Error→Thai · attempts:1 · tool_calls:2
- [X] T-113.3: editor/SKILL.md — Cross-skill routing + Dead Loop + Hard Rules · attempts:1 · tool_calls:2
- [X] T-113.4: coder/SKILL.md — Error→editor routing + Never invent root cause · attempts:1 · tool_calls:2
- [X] T-113.5: coder/SKILL.md — Context-aware proactive offer · attempts:1 · tool_calls:2
- [X] T-113.6: skill_auditor/SKILL.md — Failure Mode Map + SKILL_detail.md split · attempts:1 · tool_calls:4

## T-114 · Editor Lightweight Fix Path + error_index Schema Extension
- [X] T-114.1: editor/SKILL.md — Lightweight path criteria in Operating Stance + Trigger · attempts:1 · tool_calls:2
- [X] T-114.2: editor/SKILL.md — Lightweight Close sub-section in Workflow Section 3 · attempts:1 · tool_calls:1
- [X] T-114.3: knowledge/error_index.md — severity field + lightweight annotation entry type + decision table · attempts:1 · tool_calls:2

## T-115 · harness_doctor + self_improve 9arm Upgrade
- [X] T-115.1: harness_doctor/SKILL.md — Operating Stance + Hard Rules + Tone Guide · attempts:1 · tool_calls:2
- [X] T-115.2: self_improve/SKILL.md — Operating Stance + Hard Rules (rename Invariants + extend) · attempts:1 · tool_calls:2
- [X] T-115.3: YAML Headers — harness_doctor + self_improve + skill-manifest.json keywords sync · attempts:1 · tool_calls:3

## T-116 · Token Tracking System Fixes
- [X] T-116.1: 03_config.md — B1 script compact-restore CHAT_TOTAL logic sync
- [X] T-116.2: AGENTS.md + 03_config.md — CHAT_TOTAL ×1.5 threshold note
- [X] T-116.3: 03_config.md — LOOP_WEIGHT tiebreak rule (LW>50 + SESSION<10k)
- [X] T-116.4: AGENTS.md + 03_config.md — Turn-1 footer note + JSONL bucket required rule

## T-117 · Token Management Skills Sync
- [X] T-117.1: token_tracker/SKILL.md — LOOP_WEIGHT + footer format + sys_fixed + CHAT_TOTAL file + compact-restore + JSONL + Hard Rules (TT-1→9)
- [X] T-117.2: token_auditor/SKILL.md — >80k threshold + path fix + LOOP_WEIGHT check + R5→R8 + CHAT_TOTAL audit (TA-1→5)
- [X] T-117.3: session_manager/SKILL.md — CHAT_TOTAL health + 6-field reset + >80k threshold (SM-1→3)
- [X] T-117.4: agent/SKILL.md — threshold sync >60k + LOOP_WEIGHT per-spawn tracking (AG-1→2)

## T-118 · Skill Behavioral Gap Fix (skill_auditor + harness_editor)
- [X] T-118.1: harness_editor/SKILL.md — add Scripts section + When new data arrives later
- [X] T-118.2: skill_auditor/SKILL.md — add When new data arrives later

## T-119 · ascii_flow/SKILL.md Behavioral Gap Fix
- [X] T-119.1: add Operating Stance + Prerequisites
- [X] T-119.2: add Output Tone + Hard Rules
- [X] T-119.3: fix framework gaps (YAML keywords + When NOT to Use redirects + Workflow stop condition)
- [X] T-119.4: close + index sync

## T-120 · doc_builder/SKILL.md Behavioral Gap Fix
- [X] T-120.1: add YAML header
- [X] T-120.2: restructure Refusal Contract → Prerequisites + When NOT to Use
- [X] T-120.3: add Operating Stance + Output Tone + Hard Rules
- [X] T-120.4: close + index sync

## T-121 · session_manager §3 Close Checklist Gate
- [X] T-121.1: add mece_plan Close Checklist pre-check to §3 Workflow
- [X] T-121.2: close + sync

## T-122 · harness_doctor Hard Rules fix_plan Mandate
- [X] T-122.1: add count≥5 fix_plan constraint to Hard Rules + Output Contract
- [X] T-122.2: close + sync

## T-123 · self_improve/SKILL.md 9arm gap fix
- [X] T-123.1: add Prerequisites checklist (3 items)
- [X] T-123.2: fix scatter cooldown + remove over-prescription §2 Step 4
- [X] T-123.3: close + sync (harness_flow Y58)

## T-124 · harness_doctor/SKILL.md 9arm gap fix
- [X] T-124.1: add Prerequisites checklist (3 items)
- [X] T-124.2: de-duplicate Trigger section + fix scatter "attempt 3"
- [X] T-124.3: close + sync (harness_flow Y59)

## T-125 · harness_editor/SKILL.md 9arm gap fix
- [X] T-125.1: fix Prerequisites Why + remove File Size Contract dup + MECE rule scatter
- [X] T-125.2: close + sync + active_thread phase:done (harness_flow Y60)

## T-126 · CFP recurrence schema — fixes[] + prior-fix logic
- [X] T-126.1: fix index_cfp_fix.json CFP-037 entry (status:fixed + fixes[] T-121+T-122)
- [X] T-126.2: close + sync

## T-127 · file_manager/SKILL.md 9arm gap fix
- [X] T-127.1: add Operating Stance + Prerequisites (2 behavioral ❌)
- [X] T-127.2: YAML triggers + Output Tone + Hard Rules consolidation (4 framework ⚠️)
- [X] T-127.3: structure fixes (emit dup A + skip scatter B + grep over-prescription C)
- [X] T-127.4: add When NOT to Use → redirect to variable_manager (redundancy clarify)
- [X] T-127.5: close + sync (harness_flow Y61)

## T-128 · skill redundancy boundary clarification
- [X] T-128.1: token_tracker/auditor "Do NOT" notes
- [X] T-128.2: coder/editor keyword dedup + boundary redirects
- [X] T-128.3: close + sync (harness_flow Y62)

## T-129 · CFP-037 structural fix — harness_editor BC-docs-close add Close Checklist gate
- [X] T-129.1: add [E] item to BC-docs-close Contract + Enforce line
- [X] T-129.2: update index_cfp_fix.json CFP-037 fixes[] + status
- [X] T-129.3: close + sync (harness_flow Y63)

## T-130 · agent/SKILL.md 9arm gap fix (Batch A)
- [X] T-130.1: add YAML triggers + When NOT to Use + Operating Stance 2→4 bullets
- [X] T-130.2: Prerequisites add Why/Missing + Output Tone section + Hard Rules 3→5
- [X] T-130.3: structure fixes (B/A/C) + close + sync (harness_flow)

## T-131 · variable_manager/SKILL.md 9arm gap fix (Batch A)
- [X] T-131.1: add YAML triggers + Operating Stance (absent → 4 bullets)
- [X] T-131.2: Prerequisites add Why/Missing + Hard Rules 1→5
- [X] T-131.3: structure fix (B/C) + close + sync (harness_flow)

## T-132 · skeptical_reviewer/SKILL.md 9arm gap fix (Batch A)
- [X] T-132.1: add YAML triggers + Prerequisites (absent → 3 items) + Operating Stance 1→4
- [X] T-132.2: Workflow stop condition + Hard Rules 1→5
- [X] T-132.3: structure fix (B/C) + close + sync (harness_flow)

## T-133 · mece/SKILL.md Cycle syntax support
- [X] T-133.1: Plan Format Cycle block syntax + S1-A.5 decision rule + Hard Rule 7 exception + On-Demand trigger row

## T-134 · session_manager/SKILL.md 9arm gap fix (Batch B)
- [X] T-134.1: YAML triggers + When NOT to Use + Operating Stance + Prerequisites + Hard Rules + Tone Guide

## T-135 · token_tracker/SKILL.md 9arm gap fix (Batch B)
- [X] T-135.1: YAML triggers + When NOT to Use + Operating Stance + Prerequisites + Tone Guide

## T-136 · token_auditor/SKILL.md 9arm gap fix (Batch B)
- [X] T-136.1: YAML triggers + When NOT to Use + Operating Stance + Prerequisites + Hard Rules + Tone Guide

## T-137 · LOOP_WEIGHT gate fix
- [X] T-137.1: AGENTS.md close-gate + LOOP_WEIGHT check → hook-value-only
- [X] T-137.2: session_manager SKILL.md Hard Rule + Step 2 → preserve on close

## T-138 · repo_researcher/SKILL.md 9arm gap fix (Batch C)
- [X] T-138.1: YAML triggers + When NOT + Op Stance + Prerequisites + Hard Rules + Tone Guide

## T-139 · project_presenter/SKILL.md 9arm gap fix (Batch C)
- [X] T-139.1: YAML triggers + When NOT + Op Stance + Prerequisites + Hard Rules + Tone Guide

## T-140 · identity/SKILL.md 9arm gap fix (Batch C)
- [X] T-140.1: YAML triggers + Prerequisites

## T-141 · ascii_flow/SKILL.md 9arm gap fix (Batch C)
- [X] T-141.1: YAML triggers + When NOT + Tone Guide

## T-142 · doc_builder/SKILL.md 9arm gap fix (Batch C)
- [X] T-142.1: YAML triggers + Tone Guide

## T-143 · self_improve/SKILL.md 9arm gap fix (Batch D)
- [X] T-143.1: When NOT to Use + Tone Guide

## T-144 · identity/SKILL.md 9arm gap fix (Batch D)
- [X] T-144.1: Invoke section ≥3 bullets + Workflow halt condition

## T-145 · editor/SKILL.md 9arm gap fix (Batch D)
- [X] T-145.1: YAML triggers array + Prerequisites section

## T-146 · coder/SKILL.md 9arm gap fix (Batch D)
- [X] T-146.1: YAML triggers fix + Prerequisites Why/Missing reformat

## T-147 · mece/SKILL.md 9arm gap fix (Batch D)
- [X] T-147.1: Invoke 3rd bullet + Refusal Contract → When NOT to Use

## T-148 · repo_researcher/SKILL.md 9arm gap fix (Batch D)
- [X] T-148.1: Prerequisites Why:/Missing: reformat

## [X] T-149 · CFP Decay System — last_seen + window_count + stale
- [X] T-149.1: Create scripts/cfp_decay.py
- [X] T-149.2: Migrate index_cfp_fix.json (30 entries)
- [X] T-149.3: Update self_improve/SKILL.md BC-B + BC-E
- [X] T-149.4: Update session_manager/SKILL.md §3 Step 0
- [X] T-149.5: Close — harness_flow Y83 + roadmap + active_thread

## T-150 · Session Index Schema Upgrade + session_analyzer.py
> Constraint: ถ้าสร้าง SKILL.md ใหม่ → ต้องผ่าน 9arm audit (9/9) ก่อน merge
- [X] T-150.1: Upgrade index_sessions.json schema — topic/skill/actions/friction/promoted fields
- [X] T-150.2: Create scripts/session_analyzer.py — cross-session pattern detection (≥3 repeats → promotions.md candidate)
- [X] T-150.3: Create .sessions/promotions.md template + seeding logic in session_manager SKILL.md
- [X] T-150.4: Harness flow Y84 + roadmap + active_thread

## T-151 · Reflection Step + Promotion Loop [X]
> Constraint: ถ้าสร้าง SKILL.md ใหม่ → ต้องผ่าน 9arm audit (9/9) ก่อน merge
- [X] T-151.1: Add reflection step to mece_plan_schema.md Close Checklist (intent/outcome/friction/lesson)
- [X] T-151.2: Add reflection write to session_manager SKILL.md §3 Step 0 (reflections.md append)
- [X] T-151.3: Promotion filter logic in promotions.md — deterministic? → tool | contextual? → skill rule
- [X] T-151.4: Harness flow Y85 + roadmap + active_thread

## T-152 · verify_runner.py — Verify-N Automation Tool [X]
> Constraint: ถ้าสร้าง SKILL.md ใหม่ → ต้องผ่าน 9arm audit (9/9) ก่อน merge
- [X] T-152.1: Create scripts/verify_runner.py — reads mece_plan.md Verify-N lines → runs each → PASS/FAIL report
- [X] T-152.2: Update AGENTS.md Phase 3 L4 — call verify_runner.py instead of inline grep (optional AI verify only)
- [X] T-152.3: Update tool-manifest.json — register verify_runner
- [X] T-152.4: Harness flow Y86 + roadmap + active_thread

## T-153 · session_close.py — 5-File Close Automation Tool
> Constraint: ถ้าสร้าง SKILL.md ใหม่ → ต้องผ่าน 9arm audit (9/9) ก่อน merge
- [X] T-153.1: Create scripts/session_close.py — writes all 5 mandatory files (session JSON + tokens + thread + handoff + index)
- [X] T-153.2: Update session_manager SKILL.md §3 Steps 1-5 — call session_close.py instead of manual file writes
- [X] T-153.3: Update tool-manifest.json — register session_close
- [X] T-153.4: Harness flow Y87 + roadmap + active_thread

## T-154 · Code Audit — session_close.py + verify_runner.py
- [X] T-154.1: Audit scripts/session_close.py — pattern · error handling · edge cases
- [X] T-154.2: Audit scripts/verify_runner.py — pattern · edge cases · condition parsing
- [X] T-154.3: Fix critical gaps found (if any) + harness_flow Y88 + close

## T-155 · user-coach Learning System — post-task quiz + adaptive glossing [X]
> Constraint: new SKILL.md → must pass 9arm audit before merge
- [X] T-155.1: knowledge/user_learning_profile.json — JSON proficiency store (global + topics[] + history[])
- [X] T-155.2: scripts/learning_profile.py — record + analyze engine (usage layer)
- [X] T-155.3: .agents/skills/user/user-coach/SKILL.md — 8-component skill, USE->QUIZ->RECORD->ADAPT
- [X] T-155.4: .claude/settings.json — additive UserPromptSubmit hook -> analyze -> [learning-state]
- [X] T-155.5: register user-coach in skill-manifest.json + skill-index.md

[X] T-156: harness_editor cycle rewrite — 5-stage lifecycle (AUDIT->PLAN->EDIT->CLOSE . CFP loop-back) + Implement-map table + trim/bugfix
  [X] T-156.1: Workflow -> 5 cyclic stages . audit-first mandatory . CFP loop-back . fix L96 grep
  [X] T-156.2: Implement-map table (edit file -> Implement doc)
  [X] T-156.3: trim redundancy + <=180L
  [X] T-156.4: sync Implement/04_skills.md
  [X] T-156.5: skill_auditor re-audit + close

## T-157 · token-tracking fix — persist-every-turn + consume-once reset marker
> Constraint: B1 boot block is load-bearing (3 copies must match) · no src/ touched · harness_editor
- [X] T-157.1: AGENTS.md B1 bash — reset SESSION_TOTAL via marker armed→consumed (not date-match) [Cycle1·serial·HIGH]
- [X] T-157.2: Implement/03_config.md §R1 + B1 mirror — sync to S2 canonical + persist-every-turn [Cycle1·serial]
- [X] T-157.3: .claude/settings.json token-state hook — marker logic consistent with B1 [Cycle1·serial·HIGH]
- [X] T-157.4: CLAUDE.md §R1 — reset 2-condition rule + persist-every-turn [Cycle2·parallel]
- [X] T-157.5: mece_plan_schema.md PATH A/B/C — reset annotations + PATH B writes session_reset=armed [Cycle2·parallel]
- [X] T-157.6: CFP-031 update + harness_flow Y-entry + roadmap [X] + close [Cycle3·serial]

## T-158 · mece skill fixes — 3 weak components (9arm audit CONDITIONAL 6/9)
- [X] T-158.1: mece/SKILL.md — consolidate Output Spec Structure (merge L54-70+L105-115+L141-154 into one block + pointer to schema) [Cycle1·serial·HIGH]
- [X] T-158.2: mece/SKILL.md — When NOT to Use: 3 refusals inline (single-file/read-only/resume + reason) [Cycle1·serial]
- [X] T-158.3: mece/SKILL.md — fix Tone Guide Prohibited (tone prohibitions, not enforcement echoes) [Cycle1·serial]

## T-159 · skill_auditor — low-tier (Haiku spawn) support
- [X] T-159.1: skill_auditor/SKILL.md — add Tier&effort block in Workflow + Routing line (mechanical-vs-judgment split + low-tier fallbacks) [Cycle1·serial]
- [X] T-159.2: re-audit (Haiku low-tier) walkthrough + Implement sync (04_skills) + harness_flow Y-entry + close [Cycle1·serial]

- [X] T-159.3: skill_auditor — add neutral-abstention line (skip != pass, bias rules apply every tier) [Cycle1·serial]

- [X] T-160: skill_auditor 2-tier finalize — S1 guard (no Sonnet<medium · false-confidence) + S2 in-file Output section labels (convergent fix 3/4 audits) [Cycle1·serial]

- [X] T-161: harness_editor Stage 3.5 BEHAVIORAL VERIFY — spawn floor(Haiku)+real(Sonnet) tiers vs edited harness, signal-grep scoring, behave_test_log.jsonl feedback log · attempts:1 · tool_calls:~16

- [X] T-162: harness_editor Stage 3.5 → 3-config effort-aware ladder (Haiku floor → Sonnet@med → Sonnet@high · sequential early-exit · reuse [behave-gap]+effort:high) · attempts:1 · tool_calls:~24

- [X] T-163: KMS backend security — write complete kms-api-secured.js Cloudflare Worker (JWT auth + PBKDF2 + 16 endpoints + D1) · attempts:1 · tool_calls:15
- [X] T-164: harness_editor Stage 3.5 dogfood — behavioral-verify 3 doctor/improvement contracts (A Doctor Flow BC · B harness_doctor approach-diff · C self_improve blocked-self-edit) · all 3 behave-pass at floor (Haiku early-exit) · no gaps · test-only · attempts:1 · tool_calls:~22 [Cycle1·serial]
- [X] T-165: BC coverage tracker — enumerate all 42 formal BCs (CLAUDE 6 · AGENTS 4 · skills 32) → knowledge/bc_coverage.md · cross-ref behave_test_log → 1/42 tested ≈ 2% · R8 index synced · test-only · attempts:1 · tool_calls:~12 [Cycle1·serial]

- [X] T-166: skill_auditor Step 4.5 Cross-Model Comprehension Probe (3-tier spawn → diff → Suggested Additions for low-mid tier) · attempts:1 · tool_calls:~9

- [X] T-167: KMS 3-role permission system (god/content_manager/content_creator) — API canWrite() + JWT managed_groups + endpoint guards + UI role dropdown + group checklist + button visibility · attempts:1 · tool_calls:~22
- [X] T-168: skill_auditor self-audit fixes (A1 Step0 pre-flight · A2 stop Class A/B split · A3 [handoff-wait] · A4 [systemic-gap]) · re-probe Haiku Q2+Q4 fixed · attempts:1 · tool_calls:~12
- [X] T-169: self_improve self-audit via skill_auditor (probe 3-tier) · fixes G1 V20-contradiction · G2 §4 fence repair · G3 [cfp-escalate] mechanism · G4 Thai-format pointer · G3b escalate cross-ref · re-probe: 3/4 RESOLVED + G3b fixed · Haiku floor Q4/Q6/Q7 now correct · 206→207L · 0 BC added · attempts:1 · tool_calls:~16
- [X] T-170: skill model-certification sweep — 3-tier probe per skill → model_routing into skill-manifest.json · Pilot 4 (agent,coder,editor,harness_editor) → scale 14
- [X] T-171: skill model-certification scale — 3-tier probe + flag-verify + model_routing for remaining 14 skills (5 cycles, /compact between) · follows T-170 pilot
- [X] T-172: provider-aware harness enhancement — detected.md provider profile fields + 03_config §Model Tiers (3 tiers x 3 providers) + NEW §Provider Profiles + R1 formula branching + 04_skills MEDIUM robustness floor

- [X] T-173: provider-aware functional — B4 auto-detect+fill provider fields (map from Known Provider Profiles, unknown->generic) + AGENTS routing sync (code edits->MODEL_MEDIUM, HIGH=opus) + 03_config table sync

- [X] T-174: close all model-coverage gaps — certify self_improve+skill_auditor (3-tier probe) + audit provider-aware additions + wire token_formula into token_estimator.py + close T-171 -> 20/20 certified
- [ ] T-175: reduce BC over-enforcement — 7 flagged (3 REMOVE/5 DOWNGRADE) · ~480 tok/invocation · findings: .sessions/bc_overenforcement_audit.md · CAUTION downgrade-not-remove: Self-Improve Gate + Symbol-Return (user-valued tracking) · attempts:0

- [X] T-176-S1: per-BC recoverability review of CLAUDE.md+AGENTS.md (10 BCs) — read-only gate
- [X] T-176-S2: apply confirmed BC downgrades (Operating Stance + soft signal)
- [X] T-176-S3: consolidate token-threshold redundancy (13 dup -> single source)
- [X] T-176-S4: verify + close

- [X] T-177-S1: confirm token_estimator CLI + PostToolUse stdin contract (read-only) · field=tool_response
- [X] T-177-S2: extend PostToolUse hook to estimate+accumulate SESSION/CHAT (→scripts/posttool_track.py · 3 standalone tests pass · live SESSION 101->201) · attempts:1
- [X] T-177-S3: resolve "never estimate" contradiction in CLAUDE.md R1 (hook-estimate = source, labelled approx) · AGENTS.md L162 already consistent
- [X] T-177-S4: verify counter moves (SESSION 0->50k, CHAT 14k->89k) + CFP-028 resolved-pending + fix-note
- [X] T-178-S1: posttool_track.py provider-aware (reuse token_estimator _M table)
- [X] T-178-S2: reword rules+CFP — provider-aware + still lower bound
- [X] T-178-S3: live verify counter + provider-switch proof
- [X] T-178-S4: close (roadmap/active_thread/Step-5/index/PATH A)
- [X] T-179-S1: extract shared audit engine -> knowledge/audit_engine_rubric.md
- [X] T-179-S2: slim skill_auditor (277L -> <230L) -> reference engine
- [X] T-179-S3: new skill harness_doc_auditor (directive-file rubric, 8 items) · attempts:1
- [X] T-179-S4: register in skill-manifest.json + index sync (manifest+index_files+REPO_MAP+registry) · attempts:1
- [X] T-179-S5: behavioural verify both auditors + close (probe FOLLOWABLE · behave 4 cited findings · both <230L) · attempts:1

[X] T-180: provider-aware compact-reset + visible [compact-reset] emit (skill: harness_editor)
  [X] T-180-S1: scripts/compact_reset.py — single-source reset logic
  [X] T-180-S2: SessionStart:compact hook in .claude/settings.json
  [X] T-180-S3: AGENTS.md C0 plain-text confirm + C0.5 stuck guard + B1 note
  [X] T-180-S4: CLAUDE.md R1/R3 cross-ref [compact-reset] emit
  [X] T-180-S5: CFP-037 stale-counter-after-compact
  [X] T-180-S6: docs + index sync (flow · Implement/03 · tool-manifest · REPO_MAP)
- [X] T-181: fix agent/SKILL.md per skill_auditor audit — collapse token thresholds (drift L118 vs L124) to AGENTS.md §C0.5 ref + add Phase 3 Close pointer · [ ]

## T-182 — Cross-file dup detection (Scan D) + auto-gen rule index (2026-06-13)
- [X] T-182-S1: add Scan D to audit_engine_rubric.md §6 (Cross-File Duplication/Drift)
- [X] T-182-S2: wire Scan D into skill_auditor/SKILL.md
- [X] T-182-S3: wire Scan D into harness_doc_auditor/SKILL.md
- [X] T-182-S4: create rule_indexer.py + rules_defined[]/rules_referenced[] in index_files.json + tool-manifest
- [X] T-182 complete: Scan D in shared engine + both auditors + rule_indexer.py cache · attempts:1 · Verify-1..4 PASS

## T-183 — index-sync reconciler: regen trigger matrix + Stop-hook drift net (2026-06-13)
- [X] T-183-S1: AGENTS.md §Index Sync — add Trigger + Regen-command columns + rule_indexer row
- [X] T-183-S2: scripts/index_reconcile.py (NEW, fail-safe) + wire Stop hook + R8 register
- [X] T-183-S3: reconciler auto-runs idempotent regenerators (rule_indexer/backlink/session) on changed source files (guarded)
- [X] T-183 complete: regen trigger matrix + fail-safe Stop-hook reconciler (index_reconcile.py) auto-runs idempotent indexers · attempts:1 · Verify-1..3 PASS

[X] T-184: mece SKILL.md polish (vocab align S1-A.5 + single-Cycle ≤120L clarify + CFP-019 gloss) · attempts:1 · tool_calls:7

## Index-system review findings (2026-06-14 · repo_researcher design review)
- [X] T-185: REPO_MAP auto-update on file add/move DONE (attempts:1 · tool_calls:~14) — repo_map_check.py (detect+--append, NOT overwrite — preserves curated descriptions, fail-safe exit 0) + flagged by index_reconcile.py Stop hook (judgment-only, never auto-regen) + AGENTS.md Index Sync row + tool-manifest entry
- [X] T-187: lookup.py CRITICAL bug — hardcoded PROJECT_ROOT="Asset Plan" (L67) → derived dynamically via Path(__file__).resolve().parent.parent (robust to rename/move) · verified ROOT="Harness Agent" + lookup returns source:index_files not grep-fallback (attempts:1 · tool_calls:~5)
- [X] T-188: backlink_analyzer.py crash FIXED (attempts:1 · related[] 0→349 links / 61 of 79 files · stray "files" wrapper flattened) — validate_topics L49 `'list' object has no attribute .get`. TRUE ROOT CAUSE: index_files.json has a stray `"files":[...]` LIST wrapper (3 entries appended in wrong shape) amid 76 correct path→dict entries → loop hits the list → crash → exits before writing related[] → backlinks empty (NOT topic_registry — that's a valid dict). Fix: normalize_index() flattens wrapper + isinstance guards (fail-safe). related[] should NOT be empty — harness files cross-reference heavily
- [ ] T-189: index coverage — wire ascii_flow + doc_builder to index · write central index schema doc · add .html to index_reconcile indexable ext · topic-vocab cleanup: ~10+ entries use off-vocabulary topics (behavior_contract vs behavioral_contract, hyphen-vs-underscore, repo-structure, session-management) → align to knowledge/topic_registry.json closed vocab (found during T-188; now WARN-not-fatal)
- [ ] T-186: dependency propagation (FUTURE — lower priority) — populate used_in[] + post-edit caller-check script. NOTE: index_variables.json empty is EXPECTED now (harness-dev repo, no app code in src/ yet) — matters once src/ has TS/Next.js code
- [X] T-190: REPO_MAP full auto-sync — repo_map_check.py --sync makes STRUCTURE mirror reality (recursive folder scan incl nested + per-folder file counts written to a marker-delimited AUTO block · git -M content-based rename detection carries curated description old→new name · descriptions NEVER auto-overwritten · fail-safe exit 0) · index_reconcile.py auto-runs --sync at Stop hook (was --dry-run flag-only) · AGENTS.md Index Sync row + safety-net note. Sections S1-S6 · rename via git (user-confirmed) · only .py/.md touched (git-reversible · R14/R15 n/a)

- [X] T-191: Topic-facet backlink schema v2 (type+topic facets · per-file major/minor · AI-tag-once hash-lock determinism) · 80 entries migrated · 0 off-vocab (was 84) · 5 sub-agents · attempts:1
- [X] T-192: Code-Linkage Index (hard-relationship) — extract structural edges (import/call/type) from code files into index, hash-locked + deterministic, distinct from semantic topic edges. S1 design spec (code_linkage_index.md) · S2 Tier-A regex import extractor (code_graph.py · 48 files, 1 real edge) · S3 integrate (tool-manifest + index_reconcile auto-run + AGENTS.md R8 row · rule_indexer ran). Tier-B AST call/type graph DESIGNED but DEFERRED until src/ has TS app code. attempts:1 · tool_calls:~22
- [X] T-193: Index-tooling audit fixes (search/research redundancy+gap pass) — (1) wired symbol_indexer.py into index_reconcile.py Stop-hook auto-run so index_variables.json self-heals like the other indexes (idempotent-verified · scans src/ only → no-op until TS lands · guarded). (2) SSOT fix: AGENTS.md safety-net prose listed `session_indexer` (never auto-run) + omitted code_graph/symbol_indexer → corrected to match code reality. (3) Two-namespace trap documented (snake_case topic_registry file-facets vs kebab-case cfp_topics CFP-classes · token_tracking≠token-tracking) in topic_facet_schema.md §9 + cfp_topics.md header pointer. Audit verdict: index system clean, no real redundancy/conflict, gaps closed. attempts:1 · tool_calls:~12
- [X] T-194: Implement/ reconcile to current CLAUDE.md/AGENTS.md (7 sections · attempts:1) — S1 AI-guided model+provider setup step (02_setup Step 4b + 07_platform · headline: AI asks user's models → maps MODEL_HIGH/MEDIUM/LOW + provider profile fields into detected.md) · S2 compact model 50k→60k + [compact-rec] recommend-not-forced (03_config·04_skills·06_orch · all 50k-compact stale gone) · S3 per-turn C0.5 block inserted (03_config) · S4 05_scripts §9 +11 new scripts w/ trigger table · S5 02_setup Step 4c all 5 hooks documented · S6 09_migration M2.5 script-check + M2.6 hooks re-wire · S7 8 action-citations prefixed knowledge/. Docs-only (no src/ · R14/R15 n/a). All fixes low/medium-tier followable (exact cmd/path/threshold inline · user hard constraint)
- [X] T-195: 08_checklist.md reconcile + install-completeness audit (attempts:1) — install audit (Explore sub-agent): scripts 18/18 ✅ · hooks 5/5 ✅ · skills 16/16 ✅ · templates ✅ (domain_rules.md by-design user-created). 5 stale checklist verify-commands fixed: L50/L51 retargeted CLAUDE.md→AGENTS.md (B1-4 + CFP_COUNT live in AGENTS.md) · L94 old "30k multi-section rule" replaced w/ current R3 model (60-80k pause·80-90k/80-120k compact-rec·>90k/>120k HALT · asserts 30k gone) · L102 stale "CHAT=7300·>180k บังคับ" → dynamic sys_fixed=(CLAUDE+AGENTS×0.3)+3500 · >120k HALT. All 5 corrected greps re-run PASS vs live canonical. Docs-only.
- [X] T-195b: deeper Implement/ stale-sweep (caught what T-194 S2 missed — grepped "50k" but old rule used "30k"/"7300") — 03_config R3 table: removed stale ">30k+sections≥3 compact" row · ">80k /compact immediately"→"80-90k [compact-rec] recommend-not-forced" · ">120k /compact บังคับ"→">120k HALT" · 04_skills L697 "Compact at 30k" → current R3 model · 09_migration L44+L134 CHAT fallback 7300→11070. index_ tree-diagram refs confirmed FALSE-positive (prefix implied by tree · no fix). Sweep re-run clean. Docs-only.

- [X] T-196: Split core harness ⟷ coding domain pack — extract coding rules/skills/tools (coder,editor,variable_manager,code_graph,symbol_indexer + DB gate/Miniflare/Edge/PapaParse/Next.js) into swappable domain/coding.md · core stays project-agnostic · plan in .sessions/mece_plan.md · EXECUTED+CLOSED 2026-06-15 · S0-S5 done · core split live · attempts:1
- [X] T-197: make Implement/09_migration.md self-contained (M0 git-clone source + VERSION stamp + replace <harness_repo> x4 + inline repo-map M1.5 + SKIP_COPY guard) · attempts:1 · tool_calls:~16
- [X] T-198: M1 re-index Asset Plan (real coding project) + symbol_indexer.py classify() upgrade. M1: ran symbol_indexer(hardcoded root)+backlink+code_graph+repo_map_check FROM Asset Plan path (dynamic-root scripts targeted wrong repo when run from Harness Agent cwd) → index_variables 87 symbols · index_files 86 files/160 import-edges · repo_map 607 folders · all JSON valid. classify(): path+keyword type inference (APIRoute/PageComponent/Middleware/Interface/Enum/Class/ReactComponent/Hook/Function) w/ upgrade-only-if-Unknown guard (never clobbers 51 curated types) → Unknown 36→9 (75%↓). synced master→Asset Plan copy. src/ untouched (read-only). remaining 9 Unknown = barrel re-exports + Next.js segment config (scan-missing, out of scope). attempts:1
- [X] T-198b: symbol_indexer.py PROJECT_ROOT hardcoded path → dynamic `Path(__file__).resolve().parent.parent` (matches repo_map_check pattern · cwd-independent · copied-in script auto-targets its own project · removes /Volumes/.../Asset Plan footgun). Verified: Asset Plan copy run from any cwd still resolves Asset Plan (87 sym/9 Unknown unchanged) · Harness Agent copy now targets self (0 sym, harmless). Q2 finding: backlink_analyzer fully regenerates derived backlinks each run (idx[p] rebuilt) — no curated field, so upgrade-only-if-Unknown guard is N/A there (nothing curated to clobber). Remaining root-resolution inconsistency: backlink+code_graph still cwd-relative (not file-based) — noted, not changed. attempts:1
- [X] T-198c: symbol_indexer.py merge guard relaxed to fully-auto (user challenge: "มันควรจะเป็น Auto เหมือนกัน"). Investigation: pre-existing types were NOT human-typed — index_variables.json is gitignored, types seeded once by "harness index enrichment" commit, old indexer wrote only "Unknown". Fix: classify() is now authoritative — overwrites existing type when confident, keeps prior only when classify returns Unknown (never regress to Unknown). Verified reproducible: re-run yields identical 87 sym / same breakdown (DBTable 12, PageComponent 16, ReactComponent 16, APIRoute 6, Function 18, Hook 3, Interface 4, Middleware 3, Unknown 9) → proves old "curated" labels were just what classify re-derives. Synced master→Asset Plan copy. Same principle as backlink (full regen, no curated field to protect). attempts:1
- [X] T-198d: Asset Plan token-management footer "not working" → root cause: `.claude/settings.json` stale (older harness version). CLAUDE.md IDENTICAL (footer rule present) but settings.json drifted — PostToolUse used OLD inline python (LOOP_WEIGHT only, NO Session/Chat accumulation) instead of calling the updated `posttool_track.py`; UserPromptSubmit used old p3-reset instead of T-180 armed-reset. posttool_track.py itself was present+identical in Asset Plan but settings.json never called it ("new tool installed, old plug still in"). Prior harness migration (M2-M4) MISSED settings.json. Fix: backed up Asset Plan settings.json→.bak, copied master→Asset Plan. Verified: calls posttool_track.py ✓ · T-180 armed-reset ✓ · valid JSON ✓ · identical to master ✓. NOTE: hooks reload only on NEW session (user must restart Asset Plan session). NOT touched src/. attempts:1

- [X] T-199: Fix session record-keeping — rich detail file + thin pointer index + reliable auto-close (S1 enrich session_close.py +--record-only · S2 thin session_indexer +dup-merge fix · S3 guarded idempotent auto-close in index_reconcile · S4 doc drift fixed · S5 verified end-to-end session_004 · S6 sync+CFP-030-recurrence) · attempts:1 · tool_calls:~22
- [X] T-200: Migration force-refreshes detected.md (Implement/09_migration.md M2.4 rewritten — back up old → reset platform/api_provider to unknown → agent runs B4 inline this run → verify no field=unknown; M0.3 run-contract + When-to-use signal row added; fixes stale model IDs/token_formula surviving old-harness migration) · attempts:1 · tool_calls:~8
- [X] T-201: Audit doc_builder via skill_auditor + fix 6 defects (F1 scope-leak·F2 runaway-loop·F3 hallucination·F4 log/token-leak·F5 not-step-by-step·F6 redundancy) + model_medium→high routing for understanding phase (→ skill_auditor re-audit PASS 0🔴) · attempts:1
[X] T-202: doc_builder cover ALL risks · S1 Coverage Gate (anti-missing-feature · inverse of Grounding Gate) · S2 cross-role single-source link (target=_blank + deep anchor + owner-by-most-used) · S3 re-audit+close · model medium→high understanding · attempts:1 · DONE 2026-06-15
- [X] T-203: Unbiased re-audit of doc_builder (T-202 changes) via neutral skill_auditor sub-agent + simplicity check → caught a real self-introduced contradiction (shared/<task>.html in SKILL_detail §6 vs owner-anchor model in SKILL.md) that the prior biased audit missed · fixed 2 T-202 bugs (shared-page contradiction + Coverage Inventory format pointer) · rule_indexer exit 0 · attempts:1 · DONE 2026-06-16
- [X] T-205: Unbiased audit of harness_editor (project skill-creator) via neutral skill_auditor sub-agent + verify 2 user principles → both ⚠️ weak (auditor-bar Q-A + minimal-output Q-B implied not explicit) · fixed +2 Operating Stance principle bullets + 2 drift cross-links (Scan A/C/D) · flow_updated · rule_indexer exit 0 · attempts:1 · DONE 2026-06-16
- [X] T-206: harness_editor single front-door rule — bundled skill-creator may scaffold a DRAFT only; every project skill must pass through harness_editor (auditor bar + R8 index wiring: backlink·index_files·skill-manifest·REPO_MAP) before it counts · +1 Operating Stance bullet (minimal · no new BC/section) · reuse ideas not files (plugin is global+overwritten-on-update+unwired) · flow Y-T206 · rule_indexer exit 0 · attempts:1 · DONE 2026-06-16
- [X] T-207: upgrade Money_Assistance harness → current via Implement/09_migration.md (Track C M0-M5) · S1 fix stale source VERSION stamp (e4494a4→1566ea7, 2026-06-16) + push · S2-S5 clone-from-GitHub + re-index + copy skills/CLAUDE/AGENTS/Implement + verify+stamp · preserved DEST domain pack (finance_agents) + master_roadmap + detected.md · never touched src/ · cleaned index junk (55→27) · MA committed 6bd5dfb on baseline 261d753 (rollback ready) · M4 verify all-present + 5 hooks + CFP 37=37 · attempts:1 · DONE 2026-06-16

- [X] T-208: fix token-tracking 1-turn display lag (CFP-041) · [token-state] is start-of-turn snapshot → mid-turn decisions use stale prior-turn value · S1 CLAUDE.md R1 mid-turn live grep + footer label · S2 AGENTS.md C0.5 heavy-tool live re-check · S3 Implement/03_config.md sync paired doc · skill:harness_editor · attempts:1 · tool_calls:~15 · Verify-1/2/3 PASS · rule validated LIVE 2× this session (caught CHAT near-ceiling + missing /compact)

- [X] T-209: tighten project_presenter SKILL.md (8 audited gaps) — port doc_builder patterns · S1 YAML name+description + hard Scope rule (output to present_output/<project>/ OUTSIDE target, was writing into customer repo) · S2 add Model Routing + Grounding Gate + Loop Guard ([present-eject]/[grounding-drop]) · S3 replace §5 bullet hints with paste-ready standalone HTML+CSS template (dark #0f172a/#38bdf8 · nav · 5-page) — main complaint · S4 convert BC-Screenshot-Check + BC-Interview-Gate to plain steps/Operating Stance + drop MECE Constraints Block (dedup) · skill:harness_editor · edit 1 file only (never doc_builder/src/) · Verify-N all PASS · attempts:1

- [X] T-210: upgrade /Volumes/BriteBrain/Projects/Asset Plan to current harness (2026-06-16) via Implement/09_migration.md Track C M0-M5 · target = old harness (no VERSION) · git repo (rollback=868f9d3c · remote 'harness'→source repo · NO push from target) · SKIP_COPY=0 full run · delegated exec to sub-agent (sonnet · 50 tool calls) · M0-M5 all done · 08_checklist 0 FAIL · VERSION stamped · detected.md re-detected (claude-code/anthropic/opus) · 21 skills + config overwritten · src/+db_migrations UNTOUCHED (diff empty) · CFP 38=38 · committed LOCAL b8741cdf (NOT pushed) · independently re-verified · attempts:1

- [X] T-204: Install + adapt Harness into Money_Assistance (Track A fresh install)
  - [X] T-204a S1: scaffold framework engine (copy live files)
  - [X] T-204b S2: reset knowledge indexes + governance docs
  - [X] T-204c S3: bootstrap .sessions/ state
  - [X] T-204d S4: configure detected.md (provider + model tiers)
  - [X] T-204e S5: create + configure domain pack (finance agent team)
  - [X] T-204f S6: wire .claude hooks + git init + .gitignore
  - [X] T-204g S7: verify install (session_compactor + 22-check)

---

# Harness Evolution Plan — 9arm comparison (2026-06-17)

> Source: outsider-perspective review (scrutinize lens) after studying `thananon/9arm-skills/skills/engineering`.
> Core insight: our harness is strong on **discipline + safety gates** but is growing **heavy** — the token-saving machinery itself consumes context (CHAT ~76k before any code is touched). 9arm proves skills can be powerful while staying tiny. Direction of travel = **trim weight + delegate cheap work**, not add more rules.
> All five are logged as `[ ]` (planning only — not yet executed). Pick up one at a time; each carries its own Verify-N when promoted to a real task.

## [X] T-212 · D1 — Trim harness weight (lazy-load rules)  ⭐⭐⭐ highest ROI (prefix 38430->28096 chars, -26.89pct, >=25pct target met, safety regression clean, scrutinize-reviewed, attempts:1, tool_calls:~30)
> Detail co-planned with user via Q&A (2026-06-17). Decisions locked: goal = balance speed+safety · risk appetite = moderate · success metric = prefix tokens/turn · agent proposes hot/cold split (below).
- **Goal:** shrink the always-loaded prompt prefix (CLAUDE.md + AGENTS.md) so every turn is cheaper — WITHOUT weakening any safety gate. Today every turn pays for the full ruleset even when most of it is irrelevant to the task. Target a balanced cut, not the maximum cut.
- **Why:** the prefix is the single biggest fixed cost — re-sent (and re-cached) every turn. Cutting it discounts the WHOLE session, not one action. The harness ALREADY does partial lazy-load (see existing `→ Full detail: Implement/03_config.md` pointers); T-212 just pushes more body text out, keeping triggers in.
- **Hot rules — stay in prefix, NEVER move (always needed):**
  - Boot B1–B3 · Per-Turn C0–C3 · R1 token / R2 budget / R3 pause · R5 index-first · Never-Full-Load · R6/R7 output+density · R11 English
  - **R14 + R15 safety gates (destructive / domain hard-stop) — hot even under moderate risk appetite; safety is never lazy-loaded.**
  - The Phase 1→2→3 **summary table + triggers + PreToolUse-hook rule** (the WHAT/WHEN of phases).
- **Cold rules — move body to `Implement/*.md`, leave 1-line trigger in core (needed only when a situation fires):**
  - R9 error protocol body (load on real error/debug) · R13 escalation (load on 2nd failure) · R8 index-sync regen-command table (load on file create/delete/move) · R12 post-edit verify detail (load after Edit/Write)
  - **Phase 1/2/3 verbose sub-steps only** (G0–G3, M1–M6, Loop L1–L5 bodies) · Sub-agent routing table (load when spawning)
- **Why moving Phase sub-steps is safe (user's question — 3-layer guard):** "which phase am I in" is NOT answered by prefix text — it is answered by (1) hot trigger in core, (2) state files `gather_complete.md` + `mece_plan.md` (dated / `[X]` ticks), (3) the PreToolUse hook (external code) that BLOCKS any `src/` edit until both state files are valid. The hook cannot "forget", so the verbose how-to can live on-demand and be loaded once on phase entry.
- **Approach (steps):**
  1. Baseline: record current prefix size = `python3 -c "print((len(open('CLAUDE.md').read())+len(open('AGENTS.md').read()))*0.3)"` (the sys_fixed token estimate). Write the number into the verify line.
  2. Tag each rule block hot/cold per the lists above; confirm no safety gate (R14/R15) or trigger is in the cold set.
  3. For each cold rule: cut the verbose BODY into the matching `Implement/*.md`; leave a 1-line `→ trigger + pointer` in core (e.g. "R9 on error → Implement/error_protocol.md").
  4. Move Phase verbose sub-steps (G0–G3 / M1–M6 / L1–L5) out; keep the summary table + triggers + hook rule in AGENTS.md.
  5. Re-measure prefix size; compute % drop.
- **Risk:** moving a *trigger* by accident = a gate silently stops firing (the agent no longer knows WHEN to fetch the cold rule). **Mitigation:** move BODIES only, never triggers; after edit run a full boot + deliberately fire one R14 gate + one R9 error path + one Phase-1 entry — all must still trigger correctly.
- **Effort:** medium · **Files:** CLAUDE.md, AGENTS.md, Implement/*.md (+ any new split files) · **Verify:** prefix token estimate drops **≥25–30%** AND (boot trace fires · one R14/R15 gate still HALTs + asks confirm · one cold rule still loads on its trigger · PreToolUse hook still blocks a src/ edit with no mece_plan).
- **Follow-ups (logged during execution · 2026-06-17):**
  - **NEW INVARIANT — boot_init.sh ↔ compact_reset.py sync:** the B1 inline bash was extracted to `scripts/boot_init.sh` (S5). There are now **three** callers of the same CHAT formula (`compact_size + sys_fixed`) + the consume-once `session_reset=armed→consumed` flip: `scripts/boot_init.sh`, `scripts/compact_reset.py`, and the `SessionStart:compact` hook. **If you change the formula or the reset flip in one, change all three** — else post-compact token recompute drifts. Logic single-sourced in `Implement/07_platform.md §Boot Init`. Do NOT remove the LOOP_WEIGHT python normalization (BUG-3).
  - Registered `boot_init.sh` in `.agents/tools/tool-manifest.json` (`boot_init_sh`) + `knowledge/index_files.json` (R8 index sync done).
  - **S6 — `Implement/03_config.md` not indexed (rule_indexer gap):** S6 moved the full 8-row Index-Sync table body from AGENTS.md into `Implement/03_config.md §R8` (now the canonical source). But `rule_indexer.py` reports `03_config.md` is NOT a node in `index_files.json` (skipped, alongside CODING_FAILURE_PATTERNS.md, INVARIANTS.md, other Implement/*.md) → its `rules_defined[]` (incl. the relocated §R8 table) are not in the rule map. Pre-existing gap, but now higher-stakes because rule BODIES are being relocated INTO these unindexed files by T-212. **Follow-up:** add the Implement/*.md + INVARIANTS.md + CODING_FAILURE_PATTERNS.md rule-bearing files as nodes in index_files.json so rule_indexer can map them (own task — candidate T-217 or fold into T-212 D-series close).
  - **S7 — Option B (probe-line dedup, scrutinize-flagged):** the `Probe first: find ... | wc -l` line in `AGENTS.md §Sub-agent Rules` duplicates `CLAUDE.md` R4 (line ~44) verbatim — both are always-loaded prefix. Kept for now (conservative — it is a safety forcing-function), but it could be dropped from AGENTS.md to save ~1 line since CLAUDE.md R4 stays canonical. Low priority — revisit at T-212 D-series close.
  - **S7 — pre-existing dangling pointer:** `.agents/skills/harness/mece/SKILL.md:186` points to `agent/SKILL.md §OmO`, but no `§OmO` heading exists there (OmO content actually lives at `Implement/04_skills.md §Orchestration Protocol`, the `[OmO Reviewer]` block). AGENTS.md S7 was fixed to point correctly; mece/SKILL.md still has the stale anchor — fix when next touching that file.

## [X] T-213 · D2 — Cheap-model delegation tier (qwen-agent pattern)  ⭐⭐⭐
> **DONE 2026-06-17** · attempts:1 · tool_calls:~24 · 6 sections all Verify-N PASS · skill_auditor 9arm pass on delegate/SKILL.md. Delivered: model_cheap in detected.md · MODEL_CHEAP R4 row (03_config) + pointers (CLAUDE.md/AGENTS.md) · NEW .agents/skills/coding/delegate/SKILL.md (ported qwen-agent → Agent+Haiku · eligibility gate + mandatory self-verify + retry-once-then-escalate) · manifest entry · index_files.json sync. End-to-end verify: (a) mechanical→Haiku→self-verify PASS · (b) broken→retry→[delegate-escalated] · (c) gated/judgment→[delegate-refused].
> Detail co-planned with user via Q&A (2026-06-17). Decisions locked: cheap model = **Haiku** (we are on claude-code/Anthropic — no external model needed) · delegate scope = **only MECE-planned Phase-3 sections** (small, self-contained, explicit Verify-N) · failure handling = **auto-retry once, then escalate** · self-verify always mandatory.
- **Goal:** route already-planned, well-scoped sub-work to **Haiku** (cheapest capable Claude) instead of Sonnet/Opus, the way 9arm's `qwen-agent` offloads menial work to a cheap backing model — keeping the expensive reasoning models for planning + judgment.
- **Why:** R4 today only routes haiku ↔ sonnet by task *type*. The real saving is delegating *execution of MECE sections*: once a section is planned it is small, unambiguous, and carries its own acceptance test (Verify-N) — exactly the conditions where Haiku is reliable and cheap. High volume, low judgment → big cost cut, no quality loss.
- **Key insight (user's, 2026-06-17):** a passed MECE plan IS the standalone delegate prompt. Each `[ ] S<N>` section already has tight scope + absolute paths + a Verify-N acceptance criterion + minimal context. So delegation does not need a new "is this menial?" classifier — the trigger is simply "this section came out of MECE and is mechanical." Un-planned / exploratory / judgment work is never delegated because it never reaches this stage as a clean section.
- **Approach:**
  1. Add `model_cheap: claude-haiku-4-5` to the `detected.md` provider profile (anthropic row). (Note: external Qwen-style model = explicitly OUT of scope for now — revisit only if a non-Anthropic provider is added.)
  2. Extend R4 routing: add a `mechanical MECE section` row → `model_cheap @ low effort`. Keep planning/debug/security on Sonnet/Opus.
  3. Write a `delegate` skill by **porting 9arm's qwen-agent SKILL.md** (user's request, 2026-06-17): fetch its skill file from `thananon/9arm-skills` as the reference, copy its proven structure (standalone self-contained prompt · absolute paths · explicit acceptance criteria · context-window budget check · explicit "do NOT delegate" list), then swap the backing model Qwen→Haiku and wire the input to be a MECE section fed verbatim. Keep its **mandatory self-verify of the cheap model's output** (run the section's Verify-N) before reporting success. = adapt, not invent from scratch.
  4. Eligibility gate per section: delegate ONLY if (a) it came from a confirmed MECE plan, (b) it is mechanical (edit-as-instructed / format / bulk / report), (c) it touches no R14/R15-gated path. Otherwise run it in main context.
  5. Failure handling (user's choice): Haiku output fails Verify-N → **auto-retry once** with the same prompt → still fails → **escalate up to Sonnet/main context** (R13 ladder) + emit `[delegate-escalated]`. Never silently accept a failed delegate result.
- **Risk:** cheap model produces a plausible-but-wrong edit that passes a weak Verify-N. Mitigation: only delegate sections whose Verify-N is a real check (grep/test/build, not "looks ok"); mandatory self-verify; auto-retry-once-then-escalate; never delegate gated paths.
- **Effort:** medium · **Files:** detected.md (model_cheap), CLAUDE.md R4 + AGENTS.md sub-agent table, new/edited delegate skill, skill-manifest.json · **Verify:** one mechanical MECE section delegated to Haiku + self-verified end-to-end (Verify-N passes); one deliberately-broken delegate auto-retries then escalates to Sonnet; one judgment/gated section correctly *refused* delegation.

## [X] T-214 · D3 — Skills-as-discipline upgrade (debug-mantra / scrutinize / post-mortem patterns)  ⭐⭐ · attempts:1 · tool_calls:~30 · NEW debug skill (P3 full) + P3 short-form→R9 + P2 ptr→9 skills + P1 gate→4 skills + P4 recite→harness_editor (repo_researcher P1 already existed → P2 only) · polish: items 1+2 done (presenter halt signals unified→[presenter-refused] · debug P2 marked intentional) · item 3 P2-consolidation = leave-as-is (user chose B · 1-line pointer is correct at point-of-use · output/edit variance intended)
- **Co-planned with user (2026-06-17):** port ALL 4 behavioral patterns (no trimming) · **MUST audit ALL 21 skills first** — survey every skill, decide which pattern(s) fit + the exact insertion point, produce a full coverage matrix, THEN edit; do NOT hand-pick a few skills (user correction) · debug patterns land in BOTH a new `debug` skill AND folded into R9 · the "skip ceremony on trivial work" gate reuses the mece_plan per-section model-tier classification (NO new classifier) — same signal as T-213.
- **Goal:** raise skill *content* quality by porting 9arm's 4 strongest behavioral patterns: refuse-without-inputs gates, disproof-first debugging, mandatory simpler-alternative pass, breadcrumb ledger — plus recite-verbatim for high-stakes openers — applied across the WHOLE skill set, not a sample.
- **Why:** our skills enforce *process* (do step 1-2-3) well but lack 9arm's sharp *behavioral* gates that prevent wasted work before it starts. These are cheap to add. Partial coverage = uneven discipline, so the audit must be exhaustive.
- **Approach:**
  - **Step 0 — MANDATORY full audit (do this FIRST, gates everything else):** walk all 21 skills (`agent · ascii_flow · coder · doc_builder · editor · file_manager · harness_doc_auditor · harness_doctor · harness_editor · identity · mece · project_presenter · repo_researcher · self_improve · session_manager · skeptical_reviewer · skill_auditor · token_auditor · token_tracker · user-coach · variable_manager`). For EACH skill produce a row in a coverage matrix: `skill | has prerequisites? → refuse-gate Y/N + where | review/audit nature? → simpler-way pass Y/N + where | debug/error nature? → disproof+ledger Y/N + where | high-stakes? → recite Y/N + where | already has it? | exact insertion anchor (heading/line) | note`. A pattern marked N must say *why not* (so "no" is a decision, not an oversight). Save the matrix as the planning artifact before any edit. Likely owner: extend `skill_auditor` to emit this matrix.
  - **Step 1 — port refuse-without-required-inputs** (post-mortem) into every skill the matrix flagged with prerequisites: list them as a checklist, *halt + name what's missing* instead of a weak artifact.
  - **Step 2 — port "is there a simpler way?" pass** into every skill the matrix flagged as review/audit/build: one-breath scope-questioning before line-by-line. **Canonical owner = the `scrutinize` skill (T-217, built 2026-06-17)** — skills get only the short always-on one-line prompt that REFERENCES scrutinize; they never re-copy the full pass (single source of truth).
  - **Step 3 — port disproof-first + breadcrumb ledger** (debug-mantra) → BOTH places (user decision): (a) a NEW dedicated `debug` skill = full discipline (3–5 ranked hypotheses → run the *disproof* of the likeliest first → session ledger cross-checked vs every prior attempt); (b) fold the short form into **R9** so the habit fires even without the skill loaded. R9 = always-on gate, skill = deep version.
  - **Step 4 — port recite-discipline-verbatim** into every skill the matrix flagged high-stakes: open by reciting its own core gate word-for-word (pilot-checklist style).
  - **Step 5 — per-skill, apply the matrix row in detail:** each edit cites the technique + the exact anchor from Step 0, not a guess. Coverage is complete only when every one of the 21 rows is resolved (ported OR justified-skip).
- **Trivial-skip gate (user decision — reuse, don't invent):** whether a skill applies full ceremony or skips it is read off the **mece_plan per-section model-tier label**: section tagged *clear + certainly-doable → small model → SKIP ceremony*; section tagged *needs-judgment → medium model → APPLY ceremony*. SAME classification T-213 uses for delegate-eligibility — one signal drives both, no second "is this trivial?" judgment.
- **Risk:** over-ceremony on trivial tasks. Mitigation: the mece-tier gate above + copy 9arm's "When NOT to use / trivial → skip" escape-hatch text verbatim into each upgraded skill.
- **Effort:** medium-high (full 21-skill audit + per-skill edits + 1 new skill) · **Files:** ALL 21 skills (audited; edited where matrix flags), NEW `debug` skill, error protocol (R9), skill_auditor (emits the matrix) · **Verify:** (a) coverage matrix exists with all 21 rows resolved (ported or justified-skip), (b) each upgraded skill refuses correctly on a missing-input case, (c) skips ceremony on a small-tier mece section, (d) the new `debug` skill runs disproof-first + writes a ledger, (e) R9 short-form fires without the skill loaded.

## [X] T-215 · D4 — Bucket the 21 skills (DONE 2026-06-18 · 24 skills→5 buckets+2 lifecycle dirs · S0 glob-fix + S1-S5 moves + S6 sweep · 0 stale refs · attempts:1) (folder grouping + lifecycle dirs)  ⭐⭐
- **Co-planned with user (2026-06-17):** 5 buckets confirmed (`harness/ knowledge/ content/ coding/ user/`) · BOTH lifecycle dirs (`in-progress/` + `deprecated/`) · rollout = recommended phased move **but with a MANDATORY Step 0 path-reference audit first** — user emphasis: "do NOT just move; first analyze EVERY file/line that references a skill path, produce the full reference map, then fix all of them" (same audit-before-act spine as T-214). A move is complete only when every reference to its old path is found + updated.
- **Goal:** group the 21 flat skills into category buckets and add lifecycle dirs (`in-progress/`, `deprecated/`) like 9arm, so skills are findable and unfinished/retired ones are separated.
- **Why:** 21 flat skills is past the threshold where flat is fine; grouping aids discovery and keeps drafts/retired skills out of the active set.
- **Approach:**
  - **Step 0 — MANDATORY path-reference audit (do this FIRST, gates every move):** for EACH of the 21 skills, grep the WHOLE repo for its path/name and build a reference map: `skill | current path | every file+line that references it (skill-manifest.json · AGENTS.md · CLAUDE.md · REPO_MAP.md · index_files.json · index_sessions.json · any SKILL.md cross-link · any hardcoded path in scripts/) | new path | refs-to-rewrite count`. Save the map as the planning artifact before touching anything. A skill with refs not yet mapped = NOT ready to move. (Likely owner: extend `backlink_analyzer.py` / a one-off grep sweep to emit this map.)
  1. Buckets (confirmed): `harness/` (harness_doc_auditor, harness_doctor, harness_editor, self_improve, skill_auditor, token_auditor, token_tracker, mece, skeptical_reviewer) · `knowledge/` (file_manager, variable_manager, session_manager, repo_researcher) · `content/` (doc_builder, project_presenter, ascii_flow) · `coding/` (coder, editor, agent) · `user/` (identity, user-coach). Add empty `in-progress/` + `deprecated/` (both — user confirmed).
  2. **Critical (unlike 9arm, our moves are NOT free — skills are wired into the system):** after any move, rewrite EVERY reference from the Step 0 map — `skill-manifest.json` paths, run `backlink_analyzer.py` (index_files.json), fix any full-path references in AGENTS.md / CLAUDE.md / REPO_MAP.md / SKILL.md cross-links / scripts, run `repo_map_check.py --sync`. The Step 0 map is the checklist; a move is done only when every row's refs are rewritten.
  3. Rollout order (recommended + confirmed): lowest-risk first — carve `deprecated/` + `in-progress/` (empty dirs, zero refs) → then move ONE bucket at a time, re-run Boot + skill-match + index sync after each, verify before the next bucket.
- **Risk:** broken path = Boot can't find a skill / manifest-routing-miss. Mitigation: the Step 0 reference map (nothing moves until its refs are mapped) + move one bucket at a time, re-run boot + skill-match after each; do the index sync in the same step (R8).
- **Effort:** high (touches wiring) · **Files:** .agents/skills/* (moves), skill-manifest.json, index_files.json, AGENTS.md, CLAUDE.md, REPO_MAP.md, SKILL.md cross-links · **Verify:** (a) Step 0 reference map exists covering all 21 skills, (b) boot skill-match resolves every skill post-move, (c) index_files.json has no stale paths, (d) repo_map_check clean, (e) grep for any old path returns zero hits after each bucket.

## [ ] T-226 · Harness-improvement PROGRAM (scrutinized from 9arm + mattpocock study · 2026-06-19). All concepts passed through the scrutinize skill — essence kept, cargo-cult rejected.
   RECOMMENDED SEQUENCE: (1) ⭐⭐ T-221 FIRST (count-signals over token-estimate) — retires the CFP-028/031/037/041 false-ceiling class we hit ~6× in the study session itself; highest pain-relief. (2) ⭐ T-223 (lean-pass, heaviest files first — 2-signal: both upstreams ship leaner). (3) T-225 (adaptive user-coach). (4) T-219/T-220/T-224 by appetite.
   MERGES/FOLDS: T-220 absorbs mattpocock "red-capable command before any hypothesis" as rung 1 of the fail-path ladder · T-223 folds the invocation-axis manifest tag (user-invoked vs model-invoked, 1 field, enforcement deferred) · T-224 simplified to ONE file `knowledge/out_of_scope.md` (not a dir+skill).
   REJECTED (scrutinize · recorded so they are not reopened — these ARE the first entries for T-224's out_of_scope log): (a) heavy 9-block post-mortem artifact — our CFP + error_index already cover bug records at our scale; (b) management-talk skill — single-user, no eng-org audience, project_presenter suffices; (c) design-it-twice as a new build — already have parallel-spawn (proven in T-222), nothing to build; (d) triage "ban file paths in briefs" — essence too thin + contradicts our working file:line style (real only for cross-day session_handoff, a 1-line refinement not a task); (e) CONTEXT.md always-loaded glossary — adds per-turn token weight, CONTRADICTS the leanness goal; AGENTS.md/REPO_MAP + leading-words (T-223) already cover shared vocabulary; (f) docs/adr decision records — no felt pain yet (YAGNI); the pain we actually hit is reopening rejected ideas (T-224 out_of_scope) + bug recurrence (CFP) — both covered.
   RE-CHECK 2026-06-20 (user asked "anything else from mattpocock?"): scrutinized the 5 remaining noted-but-untasked ideas → candidate "merge/consolidate skills" CONFIRMED already folded in T-223 · git-guardrails KEPT → new T-227 (gap verified: no git hook exists) · the other 3 rejected above (d/e/f).
## [X] T-223 · Lean-pass: audit all 24 skills against mattpocock writing-great-skills principles (kill no-ops · dedupe · leading words · progressive-disclosure as variance control). TWO-SIGNAL: both 9arm + mattpocock ship leaner skills than ours → high-value leanness pass. Also flag merge-candidate skills (deprecated-bucket lesson: standalone skills collapse into composable primitives). Ref: knowledge/mattpocock-skills-comparison-2026-06-19.md §2+§4.
   ✅ DONE 2026-06-22 · attempts:1 · tool_calls:~22 · ran under harness_editor. FINDING (see harness_flow Y-T223): 3 read-only survey agents OVER-FLAGGED duplication; reading actual content showed it is intentional design (9arm stance/rules 2-layer split · always-on Simpler-Way reflex pointers · bilingual Thai triggers + proactive conditions in body When-to-Invoke). CROSS-CUTTING MASS-DEDUP REJECTED as a class (would lose Thai routing + enforcement rungs; contradicts harness_editor minimal-diff stance). Only genuinely-safe cut in 24 skills = 1 micro-edit (coding/editor Quality-gate rung-3 dup → pointer). Real lean lever = the risky skill MERGES, spun out below. Lesson: read-only surveys over-flag dup — always verify against the real file before deleting.
## [X] T-236 · MERGE M1: token_tracker + token_auditor — WONT-MERGE 2026-06-23 (scrutinize + user sign-off): decline. tracker=always-on/haiku/mechanical vs auditor=on-demand(>60k)/sonnet/analytical — merging force-loads rarely-used audit content EVERY turn + raises the hot-path floor to sonnet, for a dedup win ALREADY captured by T-244 (token model single-sourced in Implement/03_config.md §R1). Boundaries already clean (tracker=track, auditor=diagnose). attempts:1 tool_calls:~3
## [ ] T-237 · MERGE M2: skill_auditor + harness_doc_auditor → one skill w/ mode: skill|directive (shared audit_engine_rubric · ~50L cross-dup removed). From T-223 audit.
## [X] T-238 · MERGE M3: variable_manager + file_manager → index_manager w/ mode: symbol|file (adjacent indices · ~60L dup). From T-223 audit. — DONE 2026-06-23: built index_manager/SKILL.md (shared core + keyword Mode Router + mode:file floor=haiku + mode:symbol floor=sonnet · per-mode floor_by_mode in manifest); migrated all live routing + manifest (S2) + Implement/04_skills.md; haiku robustness probe 4/4 mode-pick (small-model mandate met · S3); R8 index sync (index_files.json swap · skill-index · bc_coverage · backlink_analyzer related[]); FULL doc-sweep of 8 live docs (Implement/00,01,02,03,06,08 · domain/coding.md · handoff_block_schema · REPO_MAP via repo_map_check --sync) — caught by repo-wide grep AFTER backlink/Fire-Index failed to fire → logged CFP-043; [gate] R14 user-confirmed → rm 2 old dirs · DELETED verified · live-surface grep=0. attempts:1 · tool_calls:~90 (multi-session)
## [ ] T-239 · MERGE M4: doc_builder + project_presenter → one workflow (shared scope rule + grounding gate + declared handoff). From T-223 audit.
## [ ] T-240 · MERGE M5 (weak): coding/agent + coding/coder shared routing stub instead of duplicated heuristics. From T-223 audit · lowest priority.
## [X] T-241 · BUG: token_auditor contradiction — Operating Stance "finds drift not cause" vs §Actions item 2 self-healing hard-edits other SKILL.md, bypassing harness_editor gate. From T-223 audit. — done 2026-06-22: auditor now flag-only, SKILL.md edits deferred to harness_editor (6 edits · scrutinize chose simpler delete-not-rewrite) · attempts:1 · tool_calls:~16
## [X] T-242 · NIT (from T-241 scrutinize outsider pass): token_auditor `[audit-finding]` signal written two ways — L83 `· Rule:R<N> · Skill:<name>` vs Output Contract L109 `Check: <N> · Rule: R<N> · Skill: <name>`. — DONE 2026-06-22: aligned L83 to canonical Output Contract format. Confirmed `[token-drift]` vs `[audit-finding]` are DISTINCT signals (count-gap vs rule-violation) — not duplicates, left as-is. attempts:1 tool_calls:~4
## [X] T-243 · Token footer/header consistency (from user scrutinize): footer drifted twice — hand-estimated LOW (turn-1) then over-corrected to live-grep (≠ header, turn 2-4). ROOT CAUSE: token_tracker/SKILL.md still described the OLD agent-estimates-in-memory model (L3 desc · L18 sections · L26 trigger · L38-40 prereq · L52 workflow · L71 core-model header) contradicting L146 + CLAUDE.md R1 (PostToolUse hook auto-accumulates · agent reads [token-state]). — DONE 2026-06-22: (1) logged recurrence on CFP-041 (count 0→1) + corrected fix-note (footer ECHOES [token-state] verbatim = start-of-turn snapshot · live grep reserved for mid-turn decision points only · header=footer by construction); (2) reworded 6 stale spots in token_tracker SKILL.md to the hook-accumulates model — kept formulas as hook-computes reference, deleted nothing useful. [schema-gate] user-confirmed. attempts:1 tool_calls:~13
## [X] T-244 · Token model single-source consolidation (from T-243 scrutinize flag): the token model lived in 3 places (token_tracker/SKILL.md + CLAUDE.md R1 + Implement/03_config.md §R1) and had DRIFTED — SKILL.md CHAT formula missing the ×1.5 calibration + R3 table stale (old 60-80/80-90/>90 vs current signal-box + ceiling SESSION>90k OR CHAT>120k). — DONE 2026-06-22: made `Implement/03_config.md §R1` the ONE source (CLAUDE.md R1 already a pointer · untouched); in token_tracker/SKILL.md replaced the `## Core Model (R1)` formula/constants/multiplier block + stale `## Threshold Triggers (R3)` table with pointers, reworded 3 `## Hard Rules` formula-fragments + Operating-Stance stale threshold to point not restate. Verify: grep `× 1.7`/`× 1.5`/`60-80k`/`80-90k` in SKILL.md all = 0; 4 pointers to 03_config §R1 present; Output Contract + Refusal + Tone intact; file 107L. [schema-gate] user-confirmed. attempts:1 tool_calls:~13
## [X] T-245 · Threshold-band consistency (surfaced by T-244 full-sweep verify): the "80-90k" band was described inconsistently — token_auditor/SKILL.md L85 said "write compact_state.md → run /compact immediately" (FORCED) contradicting the canonical model (only hard stop = SESSION>90k OR CHAT>120k; everything below ceiling = recommendation, signal-box PRIMARY). 03_config table L176 + CLAUDE.md R3 already correct (not-forced). — DONE 2026-06-22: reworded token_auditor L85 to "if 80-90k OR signal-box ≥2/4: emit [compact-rec] strong (NOT forced); only hard stop is >90k/>120k per R3" — now matches 03_config L176/L178 + CLAUDE.md. Verify: grep "compact immediately" across CLAUDE.md/AGENTS.md/Implement/.agents/skills/harness = 0; hard-stop-only principle present in all 3 core sources. NOTE (deliberate non-fix): CLAUDE.md R3 labels SESSION 60-90k "light note" while 03_config L176 labels 80-90k "compact-rec strong" — intensity label on a SECONDARY estimate, both non-forced → not a contradiction; left as-is (would need a CLAUDE.md hard-constraint edit, separate decision). attempts:1 tool_calls:~4
## [X] T-224 · Add .out-of-scope/ rejection memory — a design-DECISION rejection log (problem/rationale/refs per rejected feature), complementing CFP which only logs bugs. Prevents reopening settled design debates. Ref: mattpocock comparison §2.
## [X] T-225 · user-coach: stateless quiz → adaptive teacher (scrutinized essence of mattpocock teach). BETTER HOW: today the post-task quiz is stateless (forgets every session, asks blind). DO (3 essence items only — full teach workspace/lessons/HTML REJECTED as too heavy): (1) `knowledge/learning_record.md` — ONE file, bullet per topic tracking understood/missed across sessions; (2) adaptive difficulty (zone-of-proximal-dev lite) — missed topic → re-ask easier; strong → harder; (3) tie quiz topic to the existing user-profile goal. Verify: after a task, coach reads learning_record, picks difficulty from it, appends the result. Ref: mattpocock comparison §3. — DONE 2026-06-22: SCRUTINIZE found roadmap premise outdated — user-coach ALREADY persists per-topic mastery cross-session (learning_profile.py + user_learning_profile.json) + adapts glossing. REJECTED item 1 (learning_record.md = duplicate store; user chose leanest, no 2nd file). Implemented items 2+3 as SKILL.md-only edit: QUIZ step now calibrates question difficulty from existing `analyze --topic` mastery (weak/new→easier · strong→harder) + ladders topic toward user's profile goal. ZERO new files, ZERO engine change. attempts:1 tool_calls:~10
## [X] T-227 · git-guardrails hook (scrutinized essence of mattpocock git-guardrails · 2026-06-20). GAP VERIFIED: PreToolUse hook guards file reads + phase-gate + close-gate, but NO hook blocks dangerous git commands; R14/R15 are soft agent-side behavior contracts, not a hard stop. DO: add a PreToolUse(Bash) check that exits code 2 (hard fail, not advisory) on destructive git — `push --force`/`-f`, `reset --hard`, `clean -fd`, `branch -D` on main — requiring explicit confirm. ONE small script `scripts/git_guard.py` wired into .claude/settings.json. Essence only: block the 4 known-dangerous patterns, not a full git policy engine. Verify: a `git push --force` attempt is blocked + emits a gate signal; a normal `git push` passes. Ref: mattpocock comparison §2 (git-guardrails) + §3 table.
## [X] T-228 · scope-grill mode — extend G0 clarity gate (scrutinized fold of mattpocock grill-with-docs + triage · 2026-06-21). VERDICT: do NOT add new skills — both fold into existing machinery. Essence: when a task is vague AND user invokes it (user-confirmed use-case: "เวลาสั่งงานแล้วต้องการ scope ก็ใช้เจาะได้ทันที"), Claude actively drills the user for scope, then PERSISTS the clarified scope as a structured brief in `gather_complete.md` (the "agent-ready brief" = triage's essence, same artifact). Today G0 is passive (max-5-round clarification gate, no user trigger, no structured brief). DO: (1) add a user-invokable trigger phrase that forces an active scope-grill BEFORE Phase 1 G1; (2) define a small brief template (goal / in-scope / out-of-scope / acceptance) written into gather_complete.md; (3) triage's categorize-step already = C0–C3, reuse it, do not duplicate. Essence only: strengthen G0 + add a brief template — NOT a new skill, NOT a separate triage skill. Verify: user invokes scope-grill on a vague task → Claude asks targeted scope Qs → gather_complete.md contains the filled brief → Phase 1 proceeds from it. Ref: mattpocock comparison §2 (grill-with-docs, triage) + active_thread 2026-06-21.
## [X] T-230 · surgical-change discipline for src/ edits (scrutinized essence of karpathy-skills "Surgical Changes" · 2026-06-21). SCRUTINIZE OF multica-ai/andrej-karpathy-skills: repo = 4 mindset rules in ONE CLAUDE.md (no scripts/hooks/runtime). 3 of 4 ALREADY in our harness — Think-Before-Coding=G0+T-228 · Simplicity-First=scrutinize+skeptical_reviewer · Goal-Driven=Verify-N+REACT-L4+R12. The repo VALIDATES our architecture more than it adds. GAP VERIFIED (grep): editor SKILL.md says "surgically editing" in its description line only — NO enforced rule against drive-by refactoring / out-of-scope edits anywhere. DO (essence only): (1) add an explicit scope-discipline rule to editor + coder SKILL.md — touch ONLY lines directly traceable to the request, no opportunistic refactoring of adjacent code; (2) at Phase 3 Close, a cheap diff check — `git diff --stat` vs the MECE section's declared scope → flag files/hunks not traceable to a planned section as `[scope-creep]` before marking [X]. NOT a new skill, NOT a git policy engine. Rationale (Karpathy): every unrequested change is an untested change that inflates review cost + regression risk. Verify: an edit that modifies an unrelated function is flagged [scope-creep] at close; an in-scope edit passes clean. Ref: karpathy-skills research 2026-06-21. · DONE 2026-06-22 (user-driven · scope=ALL 3 edit skills, not just src/): canonical rule + [scope-creep] gate written ONCE in mece_plan_schema.md §Surgical Scope + §Close Checklist · 1-line Hard Rule pointer in harness_editor+editor+coder SKILL.md · AGENTS §Completion Gate pointer · REUSED existing per-section `File:` field instead of adding a `files:` field (more surgical) · scrutinize pass collapsed prose-triplication→single-source+pointers · attempts:1 · tool_calls:~24 · DOGFOOD: raw `git diff vs HEAD` polluted by dirty tree (80+ unrelated files) → fixed to `.scope_baseline` snapshot diff.
## [X] T-230b · wire `.scope_baseline` capture into Phase 1 (gather) so the [scope-creep] gate runs AUTOMATICALLY at Close — write `git status --porcelain | sort > .sessions/.scope_baseline` at G-start; Close does `comm -13`. Spun off from T-230 (not done inline: touches Phase 1 flow = undeclared scope, would self-trigger [scope-creep] · surgical discipline applied to itself). Small · ~1 hook/flow line.
## [X] T-231 · trim R1 agent-side footer ceremony (scrutinize harness-efficiency · 2026-06-21 · HOT PATH every turn). GAP: persistence is already hook-side (PostToolUse), but R1's AGENT instructions still spell out 7 sub-steps (read total → estimate input → estimate output → add → write JSONL → check R3 → footer) that the agent re-parses every turn though the hook now owns accumulation. DO: shrink the agent-side R1 procedure to its real residual job — "read [token-state] from hook (absent → grep session_tokens.md) → write footer line; hook handles accumulation/JSONL/spike/cache-warn — agent only prints what the hook emits." Keep all safety (thresholds, [compact-reset] surfacing) but as hook-stdout the agent echoes, not agent arithmetic. Essence: kill agent re-parse cost, not the discipline. Verify: footer still correct; no R1 arithmetic in agent output; JSONL row written by hook. Complementary to T-221 (signal-counting) — coordinate, not duplicate. Type: TOOL.
## [X] T-232 · merge C0+C0.5 per-turn routing into a 3-question gate (scrutinize harness-efficiency · 2026-06-21 · HIGHEST-VALUE HOT PATH — read EVERY turn, ~95% no branch fires). GAP: C0 + C0.5 are two dense blocks parsed before any work every turn (compact-confirm, complaint-check, Thai-phrase list, "ลืม" narrowing, c0_resolved flag, provider branching, token thresholds). DO: collapse to ONE lean 3-question pre-work checklist — (1) compact-confirm? → reset+continue (2) complaint about a missed step? → R16 (3) token thresholds exceeded? → R3 action. Move the rare-branch detail (Thai phrase list, c0_resolved flag, provider-awareness, "ลื ม vs feature-request" carve-out) to a referenced table loaded only when a branch fires — NOT inline. SAME outcomes, ~60% fewer words on the every-turn path. Verify: boot + 2 turns — every C0 branch still fires correctly; block ≤40% current word count. Type: PRINCIPLE.
## [X] T-233 · verify-then-trim `Tier` field from R5 [pre-read] (scrutinize harness-efficiency · 2026-06-21). GAP CLAIM (must verify FIRST, do not blind-cut): nothing downstream parses `Tier:` from `[pre-read] Target · Tier · Line`, so the Tier lookup is pure agent ceremony per file touch. DO: (1) grep all scripts/ + .claude/hooks for any consumer of `Tier:` / `pre-read` parsing → expect zero; (2) if zero → simplify the mandatory signal to `[r] <file> → <verdict>` (one line, no Tier mini-lookup), keeping index-first discipline; (3) if a consumer exists → REJECT this task and record why. Essence: cut ceremony only after proving it's unused. Verify: grep shows no Tier consumer; discipline (drop irrelevant reads) still holds post-change. Type: PRINCIPLE. — DONE 2026-06-22: verified ZERO code consumers of Tier; dropped emit label system-wide (12 spots/8 files), kept editor 3-Tier LADDER logic + index-first (Target+Line+Verdict). attempts:1 tool_calls:~22
## [X] T-234 · deterministic skill tie-break at Boot B2 (scrutinize harness-efficiency · 2026-06-21 · minor/robustness). GAP: B2 keyword-match has no tie-break — >1 skill matching makes the agent either over-match or stall reasoning through 24 manifest entries. DO: add ONE sentence to B2 — if >1 skill matches, prefer the one whose `activates_at` best fits the trigger phrase; still tied → pick last in manifest order + emit `[skill-match-tie] skills: A,B → chose A`. Essence: remove the ambiguous stall, no new judgment. Verify: construct a 2-skill-match prompt → agent picks deterministically + emits the tie signal. Complementary to T-223 (skill-body leanness ≠ manifest resolution). Type: PRINCIPLE.
## [X] T-235 · fix CFP-041 at ROOT — stop subagent tool I/O polluting main session_tokens.md (T-221 scrutinize follow-up · 2026-06-22). ✅ attempts:1 · tool_calls:~32 · 4-line `agent_id` guard in posttool_track.py · DETECTION proven empirically (env IDENTICAL between main+subagent → handoff's env approach rejected; agent_id in hook stdin is the only signal) · PROVEN by integer check (subagent 3 Reads → main FILES_READ 9→9, LOOP_WEIGHT +4 main-only) · Step-5 docs sweep done (CLAUDE×2 · AGENTS×3 · 03_config×3 · 06_orchestrator×1 · harness_flow Y-T235 · CFP-041 marker root-fixed) · ran under harness_editor. ROOT (empirically confirmed this session via instrumented hook): scripts/posttool_track.py (PostToolUse) ALSO fires for a subagent's internal tool calls and accumulates their LOOP_WEIGHT/SESSION/CHAT/FILES_READ/LONG_OUTPUTS into the MAIN .sessions/session_tokens.md → false ceilings (the CFP-041 symptom T-221 only masked). DETECTION (proven): env does NOT distinguish a subagent — it shares CLAUDE_CODE_SESSION_ID + identical env. The PostToolUse stdin JSON carries `agent_id` + `agent_type` ONLY on subagent tool calls; main-context calls — including the Agent wrapper call, which SHOULD count — omit them. FIX: in posttool_track.py, right after parsing stdin, `if data.get('agent_id'): raise SystemExit(0)` (no write to session_tokens.md). ~4 lines, fail-safe. Verify: spawn a subagent doing a Read → main LOOP_WEIGHT must NOT bump for that internal call (integer proof); the Agent wrapper (main) still counts. Re-evaluate the 4-box simplification later (its own pass, not this task). Closes CFP-041 root. Type: TOOL.
## REJECTED 2026-06-21 (scrutinize harness-efficiency · recorded to prevent reopening) — candidate "inline R3/R4/R8 threshold tables into CLAUDE.md to kill the stub→Implement/ double-read": REJECTED as net-negative / cargo-cult. CLAUDE.md is ALWAYS-LOADED per session (system prompt); Implement/03_config.md is on-demand. Inlining trades a rare double-read for a CONSTANT per-session token tax on every session whether or not the rule fires — it fights the deliberate small-front-door design (T-206 single front-door). The split is intentional, not accidental. Re-open ONLY with evidence that R3/R4/R8 thresholds are needed on >80% of turns AND the always-loaded cost is measured lower than the saved double-reads.
## [X] T-229 · on-demand domain glossary — extend user-coach (scrutinized essence of mattpocock domain-modeling/ubiquitous-language · 2026-06-21). VERDICT: not a new skill — extends T-225 user-coach. Essence: a persisted term→plain-Thai glossary so glossed terms accumulate across sessions instead of re-explaining blind. CONSTRAINT (hard): on-demand only — ONE file `knowledge/glossary.md`, grepped when a term recurs, NEVER always-loaded (always-loaded CONTEXT.md was REJECTED T-226e for per-turn token weight). DO: (1) `knowledge/glossary.md` — one line per term: `term | plain-Thai gloss | everyday analogy`; (2) user-coach appends a term when it is glossed during a task; (3) on later mention, grep glossary first → reuse the stored gloss (consistency + saves re-derivation). Tie to learning_record (T-225) — a glossed term the user later quizzes weak on = candidate for re-teach. Verify: gloss a term once → it lands in glossary.md → next session a grep finds it → same gloss reused, not re-invented. Ref: mattpocock comparison §2 (domain-modeling) + ties T-225.
## [X] T-222 · Install harness into DriverWedgeCal (Track B · Google Apps Script payroll) ✅ attempts:1 · tool_calls:~22 · 9 sections/5 cycles · spawned S3 scan + S4/S5/S6(opus)/S7 parallel config-gen · git init + secrets/ gitignored + ALL 24 skills + NEW apps_script domain pack with [sheet-gate] (gates writes to live Sheet 15Eld0 + any secrets/ access) · symbol_indexer can't parse .gs → manual index fallback (9 funcs) · boot verified in target (CHAT=11692). Note: a subagent created an unplanned PROJECT_CONTEXT.md (flagged to user).
## [X] T-219 · scrutinize — add Trace + Verify steps (done 2026-06-24 · §Trace+§Verify=Section 2-3 · Simpler-Way→Section 4 still mandatory · boundary line vs debug [R1.5] · attempts:1) (port from upstream 9arm scrutinize). Ours = Outsider + Simpler-Way (clarity/minimalism); GAP = no code-path trace nor claim-verification. Add: §Trace (walk real call graph end-to-end, not just diff) + §Verify (does the traced path actually produce each claimed behavior · edge cases / silent changes / test coverage). Ref: knowledge/9arm-skills-upstream-comparison-2026-06-18.md §2.
## [X] T-220 · debug — add "know the fail path" ladder (done 2026-06-24 · 3-rung ladder enriches [R1.5] as its mechanism, not a parallel step · debugger→knob-enum→[DBG-xxxx] · attempts:1) (port from 9arm debug-mantra step 2). Ours jumps hypotheses→disprove; GAP = no fail-site localization. Add escalation: attach debugger first → source trace + knob enumeration (flags/env/branches/timing) → tagged in-code instrumentation (`[DBG-xxxx]` prefix for single-grep cleanup). Ref: 9arm comparison §2.
## [X] T-261 · Fix Session Token Error — reconcile doc↔code drift (token-tracking single source · 2026-06-24 · skill harness_editor). 4 drifts: (S1) hook counted Edit/Write ECHO (scales w/ file size → +77k spikes) not input → count input-only + 12.8k backstop · (S2) settings.json fired hard [compact-STOP] on raw estimate, ignoring T-247 'trust client meter' → window-anchored(WIN=128k) + signal-box≥2 gate · (S3) 03_config §R1 doc has unused tiered table + ×1.5 + self-contradiction (L61 vs 66/71) → DOC-FOLLOWS-CODE (user-confirmed) · (S4) compact_state writes `session_reset: armed` (colon) but readers grep `=` → SESSION reset silently fails → false ceiling persists → readers accept `[:=]`. Plan reviewed by skeptical_reviewer (M4.5)=GO. · DONE 2026-06-24 · S1-S4 all verified (ast.parse/JSON/bash -n ok · regex+bash accept both `:`/`=` · 03_config drift grep=0) · attempts:1 · live-evidence caught+fixed an estimate-only STOP bug in S2 mid-exec. Residual flagged (out-of-scope): `compact_size=` in compact_reset.py:65 uses `=` only (unproven mismatch); 03_config:1188 token_auditor 90k gate left as-is (different per-task mechanism).

## [X] T-262 · Finish compact_state.md format drift (`:` vs `=`) — sustainable/single-source · 2026-06-24 · harness_editor. Found in T-261 audit: S4 fixed only compact_reset.py's session_reset reader; other readers stayed `=`-only while the writer uses colon (PROVEN live — boot_init.sh `^dt=` failed to match `dt:` → no [compact-restore]). (S1) boot_init.sh dt/compact_size/session_reset readers → tolerant `[:=]` + sed-consume writes colon · (S2) compact_reset.py:65 compact_size → `[:=]` · (S3) Implement/07_platform.md §Boot Init canonical-format rule (colon · readers tolerate `=` back-compat) + mece_plan_schema.md PATH B write-template → colon. Reviewed by skeptical_reviewer (M4.5)=revise→write-side gap added→user-confirmed FULL scope→GO. Verified: bash -n + parse both formats + colon write-back · ast.parse + regex both formats · schema drift grep=0 · LIVE round-trip on real file: `dt:` (colon) now restore=TRUE (was the boot-1 failure). attempts:1 · note: roadmap entry logged at close (missed at start — minor R-Roadmap slip). Out-of-scope flagged: AGENTS.md B2 'parse sk=' doc wording (agent tolerant — doc hygiene, not a script bug).
## [X] T-221 · token harness — evaluate "count signals, not estimate tokens" (port qwenchance model). token_tracker is estimation-primary (CHAT_TOTAL char-formula) → root of CFP-028/031/037/041. Proposal: elevate signal-counting (turns / files-read / long-outputs / steps-left, like qwenchance's 4-box) to PRIMARY compact trigger; demote estimation to rough secondary display. May retire the whole token-estimation CFP class. Ref: 9arm comparison §3.
## [X] T-217 · scrutinize follow-up on T-216 hand-off contracts (attempts:1 · tool_calls:~14) — (1) schema: add supplementary on-missing variant (2) "auto-flow"→"offer to flow" wording fix (3) index_reconcile.py handoff_consistency_lines(): SKILL.md = single source, flags [handoff-drift] when manifest hand_off[] disagrees · flag-only (manifest judgment-type) · +/- tested
## [X] T-216 · D5 — Skill chaining (hand-off contracts)  ⭐ (attempts:1 · tool_calls:~38 · 4 hand-off blocks + 5 index lines + manifest hand_off=4 + schema spec)
- **Co-planned with user (2026-06-17):** do NOT pre-pick the chains — **Step 0: derive candidate chains from EXISTING backlink data** (`index_files.json` backlinks[]/related[] · SKILL.md cross-links), look at which skills are already linked, THEN decide which pairs should get an explicit hand-off pointer (user: "don't jump to conclusions — read the links that already exist first"). · Hand-off is **gated by a prerequisites-present check** (reuse T-214's refuse-without-required-inputs pattern): the downstream skill auto-flows ONLY if its required inputs (the 1-2-3 it needs) are all present; if any is missing → BLOCK + ask the user, do not flow (user decision).
- **Goal:** let skills explicitly hand their output to a downstream skill, like 9arm's post-mortem → management-talk ("post-mortem owns engineering truth; management-talk reframes for leadership").
- **Why:** turns single-purpose skills into composable pipelines; reduces duplication (one skill owns the source-of-truth artifact, another reframes/repackages it).
- **Approach:**
  - **Step 0 — derive chains from existing links (do this FIRST, don't guess):** read `index_files.json` backlinks[]/related[] + SKILL.md cross-links across all 21 skills → list every pair that already has a real relationship → from that evidence propose the hand-off chains (with rationale per pair). Candidates to confirm against the data, NOT assume: doc_builder → project_presenter, repo_researcher → doc_builder, debug/error → post-mortem-style record skill. Save the derived chain list as the planning artifact before wiring.
  1. Add a `## hand-off` block convention to SKILL.md: names the downstream skill + the exact artifact/format passed (single-source — the upstream owns the data, downstream only transforms).
  2. **Hand-off gate (prerequisites-present check — reuse T-214 refuse-without-required-inputs):** before flowing to the downstream skill, the contract lists the required inputs (1-2-3); a small pre-check verifies all are present → present → flow automatically; any missing → BLOCK + ask the user (no silent partial hand-off).
  3. Wire as cross-links in skill-manifest + the SKILL.md files (deep link with owner-by-most-used, reuse the doc_builder cross-role single-source pattern from T-202).
- **Risk:** circular/duplicated ownership of an artifact. Mitigation: enforce single-source rule — exactly one skill owns each artifact; others read-only transform.
- **Effort:** low–medium · **Files:** index_files.json (read for Step 0), the chained skills (per derived list — likely doc_builder, project_presenter, repo_researcher, debug/post-mortem skill), skill-manifest.json · **Verify:** (a) Step 0 chain list is derived from real backlink data (not guessed), (b) one chain runs end-to-end (upstream artifact → downstream transform) with no duplicated ownership, (c) hand-off blocks + asks when a required input is missing, (d) hand-off auto-flows when all inputs present.

> **Recommended order:** T-212 (D1) first — it discounts every subsequent turn. Then T-213 (D2) for real cost savings on volume work. T-214/T-215/T-216 are quality/organization, pick by appetite. None block the others.

## [X] T-217 · New skill: scrutinize (outsider review + simpler-way pass)  ⭐⭐ · attempts:1 · tool_calls:~16 · Verify-N: 4/4 PASS
- **Built with user (2026-06-17):** standalone skill in our own house style — NOT a port of 9arm's file. Role = outsider review ("read it as if seeing it for the first time") + a mandatory "is there a simpler way to get the same result?" pass. Distinct from `skeptical_reviewer` (contrarian/necessity gate).
- **Single-source-of-truth (user decision):** scrutinize is the SOLE owner of the "simpler way?" discipline. `skeptical_reviewer/SKILL.md:87` redirects to it (no duplicate); T-214 Step 2 names scrutinize as canonical owner (skills get the short always-on form that references it, never a re-copy).

## [ ] T-218 · Local LLM deployment — Implement Plan (separate file)
Standalone phased plan to run the Harness against self-hosted Qwen3 on owned hardware (Mac Studio M1 Max 32GB), wired into Claude Code via Bash wrapper → MCP server.
→ Full 8-phase plan + locked decisions + risks: `knowledge/implement-plan-local-llm-deployment-2026-06-17.md`
Note: PLANNING only — each phase is a future task needing its own Phase 1→2→3 + MECE + confirm.
- **Sections:** S1 create `.agents/skills/harness/scrutinize/SKILL.md` · S2 redirect skeptical_reviewer · S3 redirect T-214 Step 2 wording · S4 register manifest + R8 index sync.
- **Verify:** (a) scrutinize/SKILL.md exists + passes skill_auditor 9arm bar, (b) grep skeptical_reviewer → points to scrutinize, (c) T-214 names scrutinize as owner, (d) manifest valid JSON with scrutinize entry.

## [X] T-219 · Simplify — fold MODEL_CHEAP into MODEL_LOW (scrutinize follow-up) · attempts:1 · tool_calls:~14
- **Trigger:** scrutinize pass on T-213 (user-requested). `[simpler-way] YES` — MODEL_CHEAP and MODEL_LOW both resolve to Haiku (same model id); the genuinely new thing in T-213 was the *delegation behavior* (sub-agent + self-verify + retry-once + escalate), owned by the `delegate` skill — not a 4th model tier. The extra tier name was redundant + left CHEAP undefined for non-Anthropic providers.
- **Change:** removed the MODEL_CHEAP name everywhere; delegated mechanical sections now route to `MODEL_LOW @ low (delegated)` via the `delegate` skill (resolves `model_low` from detected.md). Tier ladder stays 3 (HIGH/MEDIUM/LOW).
- **Files:** Implement/03_config.md (R4 row) · .agents/skills/coding/delegate/SKILL.md (model_cheap→model_low) · .agents/platform/detected.md (removed model_cheap field) · CLAUDE.md R4 + AGENTS.md §Sub-agent Rules (pointers) · skill-manifest.json (notes) · knowledge/index_files.json (delegate refs). T-213 history left intact (records what was built then).
- **Verify:** grep MODEL_CHEAP\|model_cheap across active .md/.json = 0 (only historical roadmap+harness_flow journals retain the name) · skill-manifest.json + index_files.json valid JSON.
- [X] T-246: skill_auditor tier-verification request — investigated · NO CHANGE (Step 4.5 Cross-Model Comprehension Probe + engine §5 already cover "test mid/low per effort" · scrutinize rejected redundant section → avoids bloat)

## [X] T-247 · token-visibility: per-file tok.py helper + honest footer caveat (from scrutinize session 2026-06-22). PROBLEM: footer showed Chat ~46k while real window was ~104k (~2.2x under). VERDICT (2 disproofs): exact grand-total is NOT script-computable (footer x2 fails on small base; transcript wc over-counts ~128x as an append log) -> defer total to client meter. DO (scrutinized-simplest, pull>push): (S1) promote scratchpad tok_probe.py -> scripts/tok.py (ASCII 0.25 / Thai 0.67 tok/char, accurate ~+/-20%) for on-demand load-vs-grep decisions; (S2) add ONE lower-bound caveat line to Implement/03_config.md token-tracking footer spec pointing to the app meter -- NOT CLAUDE.md/AGENTS.md (avoid hot-path bloat). OUT OF SCOPE: hook per-call push emit (uncertain channel + per-call token noise); widening sys_fixed to full system prompt; re-keying hard-stop off real number (both follow-ups). Verify: tok.py on roadmap.md ~29k matches demo; grep "lower bound" in 03_config; CLAUDE/AGENTS footer lines unchanged. Type: TOOL.
   CLOSED 2026-06-22: S1 reshaped by pre-checks — index-enrichment NO-GO (a: roadmap+03_config absent from index; b: symbol_indexer reads src/*.ts only, never harness markdown). Shipped scripts/tok.py instead (universal, covers the missing big files). Ratio single-sourced from token_estimator EN=0.3/THAI=1.7 (NOT demo 0.25/0.67 — c); roadmap now ~37k (conservative). S2 caveat live in 03_config L80. R8: tok.py added to index_files.json. attempts:1 · tool_calls:~9.

## [X] T-248 · consolidate token-tracking doc to ONE canonical source + thin pointers (kill 3-way drift flagged by T-247 scrutinize). HOMES: CLAUDE.md §R1 (hot-path) · Implement/03_config.md §Token Tracking (CANONICAL) · token_tracker/SKILL.md. SCRUTINIZED plan added S0 classify-rule-vs-detail (de-risk) + S1/S4 verify-first. DONE: S0 classified each §R1 clause RULE-vs-mechanics; S1 verified 03_config already complete (reset L75/hook L61,71/footer L79/lag L82) -> NO EDIT; S2 trimmed CLAUDE.md §R1 — kept ALL rules verbatim (reset CFP-031, compact-reset MUST-surface, cache-warn, footer-format, never-fabricate) + pointer, removed only duplicated mechanics (§R1 3500->2291 chars); S3 resynced CLAUDE.th.md §R1 (was a STALE old-model stub "agent computes tokens" -> now hook-owned mirror + pointer); S4 token_tracker/SKILL.md already pointer-only (T-243) -> NO EDIT. Edited 2 files. Verify: reset-rule grep=1, compact-reset/cache-warn kept, pointer resolves, scope-creep clean. attempts:1 · tool_calls:~10.
## [X] T-249 · recalibrate sys_fixed flat constant 3500->11000 (follow-up to T-247/T-248). WHY: the constant approximates the unmeasurable part of the system prompt (base Claude Code prompt + tool schemas, sent by client at runtime, NOT file-readable). KEY FINDING: globbing more files recovers only +2-8k and misses the big piece -> recalibrate the flat constant, do NOT widen the glob (scrutinize Simpler-Way). SCRUTINIZE blocker (overcount breaks 'footer=lower bound') resolved: real static prompt (base+all tool schemas) >> 19.5k so 11000 still UNDER-counts -> lower-bound invariant holds, no reword; no double-count vs HOOKS=700 (700=tool-name list/turn, 11000=full schemas once). DONE: S1 token_estimator.py _compute_sys_fixed +11000/fallback 19500; S2 boot_init.sh L12 +11000/fallback 19500; S3 compact_reset.py L57/59/61 +11000/19500; S4 docs synced (03_config L12/19/52/675, 07_platform L9, 08_checklist L102/103, 09_migration L96/202). Verify: grep CLEAN no stale 3500/11070/11-13k repo-wide; 3 compute sites identical (+11000/19500); boot formula=19534; estimator self-test pass, overhead=20234. scope-creep: +08_checklist +09_migration (same-constant, intent-aligned, flagged); -AGENTS.md (no stale num). attempts:1 · tool_calls:~9.
## [X] T-250 · single-source the sys_fixed BASE constant (follow-up T-249). Path B (chosen after scrutinize): the magic number 11000 now lives in ONE file scripts/sys_fixed_base.txt; token_estimator.py + boot_init.sh + compact_reset.py READ it (formula shape stays inline — it never changes). Lighter at boot than Path A module-import. Fallback 19500 stays literal in the degraded except/|| branches (accepted). Verify: 3 read-paths all=19534; 11000 literal only in sys_fixed_base.txt; dry-run ok; syntax ok. attempts:1 · tool_calls:~6.
## [X] T-251 · finish the T-232 C0+C0.5 merge (marked [X] but never applied to AGENTS/CLAUDE/03_config). Make C0 a true 3-question pre-work gate (Q3 = token check, formerly separate C0.5); trim hot path; verbose detail -> 03_config §Per-Turn reference. Scope 1 (minimal-ripple): 3 core files + keep 'C0.5' as documented alias (9 incidental refs resolve). Type: PRINCIPLE.
## [X] T-252 · index-sync COMPLETION BLOCK (DONE 2026-06-23 · attempts:1 · tool_calls:~18 · S1 `--check` HARD-drift mode + S2 close-gate wired · e2e proven: clean→exit0, new un-indexed file→exit2 BLOCK, cleanup→exit0): a HARD gate that prevents a file-touching skill / a section / the session from being marked done UNTIL index_manager (index_files.json/index_variables.json) + backlinks are updated for every created/moved/deleted/renamed file. Today only soft R8 rule + close-time reconciler exist (no per-completion block) + the reconciler misses doc-prose refs (CFP-043). Candidate enforcement points (decide in Phase 2): (a) Stop-hook BLOCK — index_reconcile.py exits non-zero on drift instead of just emitting [index-drift], forcing fix before session can end; (b) PostToolUse live-nag when a structural file op happens with no same-turn index touch; (c) Completion-Gate hard check in mece L4 ([X] forbidden until [r8-sync-check] emitted + index file mtime newer than the edit). Relates CFP-043. Type: PRINCIPLE+TOOL. DECIDED (Phase 2 · scrutinize): rejected (a) Stop-hook (infinite-loop risk + reverses T-183 fail-safe) and (c) mece-L4 (soft/self-enforced). CHOSE: extend the EXISTING PreToolUse close-gate (already blocks the `phase: done` write) to run a new `index_reconcile.py --check` (HARD-drift detect, no regen, +stale skill-name grep for CFP-043) → block phase:done on drift · escape HARNESS_SKIP_INDEX_BLOCK=1. 2 sections: S1 --check mode · S2 wire into close-gate.

## [X] T-253 · user-modeling system: observe→distill→apply, "grow with the user"  **[DONE 2026-06-23 · S1-S8: Cycle 1 build + Cycle 2 fix (de-inert goal-tag · verbosity quizzed-only · back-compat selftest · single-source json-canonical · F1 truncation fixed) · independent model_low review all-pass · scope clean]** (co-designed with user 2026-06-23 · full design in memory/user-modeling-system-design.md). GOAL: Claude learns the user's communication style + skill level across sessions and adapts answer depth/format/altitude so the user understands faster — model and user grow together. Builds on T-225 (user-coach ALREADY persists per-topic mastery via learning_profile.py / user_learning_profile.json + adaptive glossing) → EXTEND, do NOT duplicate that store. PIPELINE (user's framing): (1) CAPTURE — while working, observe how the user asks/answers (work + casual); at session close extract "what did I learn about this person today"; (2) DISTILL + PRIORITIZE — rank what matters most, order it, resolve contradictions, optionally ask one end-of-work question; (3) APPLY — a compact "top-sheet / personality summary" decides answer format, level of detail, depth, and how to make the user learn faster. KEY DESIGN DECISIONS (agreed): • TWO FILES (solves "can't read it all every turn"): a big append-only LOG (full record, never fully read) + a ONE-PAGE TOP-SHEET (prioritized, conflict-cleared) that IS read each turn / at boot — working-memory vs knowledge-base, two-tier. • BEHAVIORS-NOT-LABELS: store observable behavior traits ("prefers step-by-step", "lost by EN jargon", "likes everyday analogies") NOT personality-type labels; a leadership/character lens is a question-asking aid, never a tag stuck on the user (wrong guess would lock in). • DEDUP = REINFORCEMENT: each trait keyed by a stable canonical short label; a matching observation bumps a strength TALLY (count + date + example) instead of adding a duplicate line; match by MEANING not wording; contradiction → conflict rule (newer + repeated wins, else ask 1 question). • UPDATE CADENCE (NOT every change): cheap raw jot to the log during work → distill into the top-sheet ONCE at session close → deep reorganize every N sessions. • ONBOARDING INTERVIEW (when the book is empty): short, friendly bootstrap (not a long form) — free-chat background (education / work field / likes-dislikes) + a few ~5-option multiple-choice level checks (vocab/skills per category) + English proficiency + preferred answer style; seeds the top-sheet on day one, tagged "self-reported = low confidence" so real behavior over time confirms or corrects it. CANDIDATE SECTIONS (finalize in Phase 2): S1 top-sheet file schema + canonical-key/tally model; S2 onboarding-interview flow; S3 session-close extractor (capture→distill); S4 boot reads top-sheet before first reply; S5 conflict-resolution + deep-tidy cadence. DECIDED (2026-06-23): PUSH-PACE-FAST, but GATED by an accurate readiness check — develop at the edge of ability (ZPD-style: challenge just above current level), never force-feed. Implication: a topic only levels up when the readiness signal is STRONG (mastery confirmed by real performance, not self-report alone); the system should actively hunt the next reachable growth point rather than wait. Ties readiness measurement to user-coach mastery tracking + the onboarding level checks. RELATES: T-225, user-coach skill, [learning-state] hook, user-profile. Type: PRINCIPLE+TOOL. REFRAME (user 2026-06-23 · changes the core stance): this is NOT a tutor that teaches everything — it is a LEADER/COACH that develops POTENTIAL. Observe the person, map STRENGTHS and WEAKNESSES, draw out performance/efficiency, and teach ONLY what they NEED to know (targeted to need, not understand-everything). So the top-sheet must track strengths + weaknesses + a development path per person, not just "what they understand." ADD S0 — RESEARCH/GROUNDING (do FIRST when building): find established principles + reference repos/writing to cite — people-development & leadership (observing people, strengths-based development e.g. Gallup/CliftonStrengths, situational leadership, coaching models e.g. GROW), and learning science (ZPD already chosen for the readiness gate). Pull a Repo/source as Ref where one exists. **S0 DONE (2026-06-23):** research complete → see knowledge/user_modeling_grounding.md (frameworks: Strengths/Gallup · Situational Leadership · GROW · SBI feedback · ZPD+scaffolding · Desirable Difficulties · Mastery Learning · spaced retrieval · Flow + 6 readiness signals; reference impls to COPY: Generative Agents reflection-loop = engine · Letta/LangMem core-memory = top-sheet · BKT/overlay = per-skill mastery math · OLM = visible/editable profile · Zep fact-invalidation = drift; repos: NirDiamant/Agent_Memory_Techniques, mem0, letta, langmem, graphiti). Phase 2 build can start at S1.

## [X] T-254 · fix-validation gate in harness_editor  **[DONE 2026-06-23 · SKILL.md Stage 3.6 FIX VALIDATION + Stage 4 [C] close-guard already built; this close added the paired Implement/04_skills.md doc + [fix-validated] (logical walkthrough: a "edit-written-but-bug-still-there" fix now hits [fix-unvalidated]→blocks [X]). DEFERRED follow-up: empirical Stage 3.5 3-agent ladder test (skipped for tokens — logged). attempts:1]** — a bug/CFP-fix cannot reach roadmap [X] until the ORIGINAL failure is re-run against the edited harness + confirmed gone. Adds Stage 3.6 FIX VALIDATION ([fix-validated]/[fix-unvalidated]/[fix-skip]) + a Stage 4 [C] close-guard. Closes recurring "Doctor diagnoses → harness_editor edits → bug still there" (verify proved edit-correct, not failure-gone). SCOPE: covers the harness_editor fix path ONLY — R9/debug fast-paths bypass it (deferred item A). Skill-verified GO by skill_auditor (distinct-from-3.5:yes · enforcement-correct:yes · breakage:none). attempts:1

## [X] T-255 · harness_doctor repro-pin **[DONE 2026-06-24 · 3 edits: doctor §3 repro-pin step + SINGLE-SOURCE format block · doctor Fix Record BC +repro field (persists to index_cfp_fix.json fixes[].repro) · harness_editor Stage 3.6 reads that field (pointer, not restated — single-source). SOFT gate: reproducible:no → [repro-missing] → count-proxy → PROCEED (never blocks doctor). Completes T-254 (consumer now has a pinned repro to re-run). attempts:1 · tool_calls:~9]** (adapt 9arm post-mortem principle 1 "reliable repro" into the harness fix-flow) — BLOCKED-BY: T-254 (must finish first · T-254 is the consumer that re-runs the pinned trigger). Skeptical-reviewer REVISED design (do NOT do the original "new §1 gate"): (a) SOFT gate, NON-blocking — many harness/CFP bugs are behavioral drift that cannot be triggered on demand; pin a concrete trigger if one exists, else record [repro-missing] → count-proxy + flag validation-will-be-weak → PROCEED (never block doctor); (b) fold into EXISTING §3 Proposal (proposal must state how the fix will be validated = the trigger to re-run) — do NOT add new machinery; (c) define a SHARED "repro-pin format" as a contract both doctor (producer) + T-254 harness_editor (consumer) use — freeze format only after T-254 is stable. WHY: completes T-254 — validation needs a captured "original failure" to re-run against. Type: harness-fix. RELATES: T-254, harness_doctor, self_improve, 9arm-skills/post-mortem.

## [X] T-256 · scrutinize boundary line (adapt 9arm scrutinize strength: distinguish clarity-review from correctness-review) — add 1 bullet to scrutinize/SKILL.md "When NOT to Use": "need to verify code actually works correctly → use code-review/debug, NOT scrutinize". Minor edit (<3L · [audit-skip] reason:minor). WHY: our scrutinize owns clarity+simpler-way only; correctness is split to debug/code-review (single-source) — the boundary is implicit, make it explicit so orchestrator/outsider picks the right skill. Type: harness-fix. RELATES: scrutinize, code-review, debug, 9arm-skills/scrutinize.

## [X] T-257 · repro single-owner wiring (9arm outsider GAP-4 · DO FIRST — bug + simpler-way) — repro captured by debug [R1] only persists to index_cfp_fix.json on the doctor path; a direct debug→editor fix (non-CFP) leaves harness_editor Stage 3.6 with no repro to re-run → falls to count-proxy / [fix-unvalidated]. FIX: make repro a single-owner artifact — whoever captures it FIRST (debug [R1] OR doctor §3) persists to index_cfp_fix.json fixes[].repro; Stage 3.6 reads the same place on every path. Reduces 2 hand-off paths → 1 (simpler + correct). Type: harness-fix. RELATES: debug, harness_doctor, harness_editor, 9arm-skills/post-mortem, T-254, T-255.

## [X] T-258 · debug "trace fail path" step (9arm outsider GAP-1) — debug/SKILL.md jumps reproduce→rank-hypotheses with no explicit "walk the actual exec path from symptom back to origin" step (9arm debug-mantra step 2). Distinct from disproof: tracing tells you WHERE to suspect; disproof tests the suspects. ADD: 1 step in Section 1 (Reproduce & Rank) between [R1] and [R2] — trace symptom→origin, emit [trace] before [hypotheses]. Type: harness-fix. RELATES: debug, 9arm-skills/debug-mantra.

## [X] T-259 · wire cross-ref breadcrumbs into debug (9arm outsider GAP-2) — debug ledger is within-session only; cross-session "have we seen this before?" lives in R9 Step-0 + doctor §1 prior-fix-check, NOT in debug/SKILL.md. Reader of debug alone misses the grep-error_index/CFP-history step. ADD: 1 step/pointer in Section 1 — grep error_index + index_cfp_fix.json for prior similar failure before ranking (point to R9, don't duplicate). Type: harness-fix. RELATES: debug, error_index, index_cfp_fix.json, 9arm-skills/debug-mantra, R9.

## [X] T-260 · blameless tone note (9arm outsider GAP-3 · minor) — system is structurally blameless (CFP logs the pattern, not the agent) but no tone guide states it; nothing stops a future "agent was dumb" CFP entry. ADD: 1 line to self_improve (or CFP template) tone guide — "blameless: name the pattern/gap, never the agent/person". Minor (<3L). Type: harness-fix. RELATES: self_improve, CODING_FAILURE_PATTERNS, 9arm-skills/post-mortem.
- [X] T-263: skill-invocation forcing function — .active_skill marker (posttool_track.py) + manifest owns_paths + skill_gate.py (PreToolUse hard block) + review_intent.py (UserPromptSubmit arm) · kills CFP-020 + CFP-044 (043 was misattributed = doc-ref drift, already fixed by T-252) · attempts:1 · tool_calls:~28 · skeptical_reviewer GO (2 passes) + scrutinize dogfood GO
- [X] T-264: knowledge/self_improvement_loop.md — persisted the 8-stage self-improvement loop diagram (ASCII + embeddable SVG title=harness_self_improvement_full_loop · enforced 1-4,6 / amber gaps 5,7,8) + principle "every loop-closing step must be enforced, not remembered" + 3 amber-gap closure tasks + wiki backlinks to 9 real harness files · R8 index sync (topic=cfp_immunity · related[] auto-computed 6) + backlink_analyzer clean · attempts:1 · tool_calls:~12
- [X] T-265: close the 3 amber self-improvement-loop gaps structurally (revised post-skeptical-review → 5 sections) · DONE 2026-06-24 · attempts:1 · S2a artifacts-field backfilled CFP-044 · S2 cfp_fix_probe.py (boot+Stop wired) · S3 cfp_recurrence.py (agent-invoked, doc in harness_doctor §1.4) · S1 close-gate teeth in settings.json (.cfp_touched + fail-open, BLOCK-case proven live exit1) · S4 all gates tested · gate-wiring done LAST (no self-brick) · S1 close-gate teeth (trigger ONLY on CFP status-field change · clear .cfp_touched on boot) · S2a add `artifacts:[paths]` field to resolved ledger entries (dependency) · S2 cfp_fix_probe.py verifies resolved-CFP artifacts exist+wired → [cfp-fix-drift] · S3 cfp_recurrence.py = agent-invoked reliable status-flip (NOT auto-detect) · S4 test all gates fail-open + prove BLOCK-case AND allow-case · Verify-N per section · gate-wiring LAST (anti-self-brick)

- [X] T-266: Loop-doc + Backlink rollout — 1 template + 8 loop docs (boot/per-turn/info-gather/mece/react/token/session-close/error-debug) + catalog hub + backlink wiring · modeled on self_improvement_loop.md · attempts:1 · tool_calls:~18 (S1 main + S2-S9 8 subagents + S10 subagent) · all Verify-N pass · kcc false-positive (key_claims backfill flagged separate)
  (Note: an earlier per-technique-family scope — 1 schema + 5 sibling docs — was SUPERSEDED by the user-confirmed ONE-combined-doc scope below; no artifacts were built under the old shape.)
- [X] T-267: Harness authoring-techniques knowledge doc — ONE educational catalog (13 categories / ~25 techniques) · plain-language + analogies · per-technique strength/weakness + 💰cost/benefit · external contrast (9arm/karpathy/mattpocock) · index/catalog/backlink wired · DOC-ONLY · skill:harness_editor · attempts:1 · tool_calls:~14 (S1+S2 main context, S3 serial) · Verify-1/2/3 all pass · merged scope (this chat absorbed a divergent second chat's per-technique depth)

- [ ] T-268: Harden backlink_analyzer.py against silent data loss — (1) WARN (do not silently overwrite) when replacing a NON-EMPTY related[] that differs from computed; (2) emit a loud [islanded-doc] signal for any entry that computes related:[] while it HAS topics; (3) optional --dry-run diff. Code task (scripts/) — needs MECE + phase-gate. Surfaced by CFP-046 during T-267 scrutinize. attempts:0

- [X] T-269: Wiki index integrity — index_reconcile.py now AUTHORITATIVE over disk reality: enroll_missing() enrolls every on-disk indexable file (tracked ∪ untracked) missing from index_files.json + auto-prunes any entry whose file is gone. Single disk-truth rule (os.path.exists) → enroll/prune disjoint → idempotent. Closes the ADD/RENAME leak AND the stale-delete ghost. Scope expanded mid-task (user-approved) from tracked-only-enroll to full disk-truth sync. attempts:1 · tool_calls:~16 · enroll 71 · prune 2 · idempotent x3 · --check exit=0 · MISSING/GHOST 0. (audit: knowledge/wiki-index-integrity-audit-2026-06-24.md)
- [ ] T-270: Re-extract topics/description on EDIT before backlink_analyzer — kill stale-topic drift in related[]
- [ ] T-271: Two-phase enroll — stub(0-tok) then flag description=="" + wire backfill_knowledge_index into Stop hook + surface [backfill-pending] N
- [ ] T-272: Guard reconciler silent-crash — emit [index-reconcile-CRASHED] instead of fail-safe exit-0 no-op
- [X] T-273: Offline backlink graph HTML (force-graph, single-file, color-by-topic, Obsidian-style) · scripts/build_backlink_graph.py generates knowledge/diagrams/backlink-graph.html (212 nodes/1257 edges · hand-written canvas force sim · NO CDN · idempotent · Core+Plus UI) · attempts:1 · tool_calls:~16

- [X] T-274: backlink-graph click-to-read panel — preview desc + neighbour-nav + open-file (offline preserved) · attempts:1 · Verify-3a-f pass (3f=real browser click-test via Claude Preview) · scope clean
  └─ scrutinize follow-up (user-requested): +ellipsis on 18 truncated descs · +</script> injection hardening (data_json.replace) · re-verified offline/idempotent/JS/212-nodes
- [ ] T-275: backlink-graph neighbour-list vs edge-filter (scrutinize finding #2, deferred by user) — decide A(show-all·current) / B(visible-only) / C(show-all+dim-hidden+reveal-on-click). Recommended A. File: scripts/build_backlink_graph.py
