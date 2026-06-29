# Harness Complete Flow — Post-Fix Reference

> **Date:** 2026-05-26
> **Version:** v2.1 (CFP fix index + harness_doctor + checkpoint gates)
> **Session:** session_086+
> **Replaces:** harness_flow_20260525.md (v2.0)
>
> Definitive reference after v2.0 patches and 2026-05-26 improvements.
> Read alongside CLAUDE.md and AGENTS.md.
> ★ = 2026-05-25 patch · ● = 2026-05-26 CFP tracking + harness_doctor + checkpoints

---

## Layer Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 0 · CONSTRAINTS (immutable — read first, every agent)         │
│                                                                      │
│  CLAUDE.md (project)        ← R1–R16, R-Roadmap (hard rules)        │
│  AGENTS.md                  ← Boot + Loop Architecture (procedure)  │
│  INVARIANTS.md              ← I1–I8 (I8: CFP index race condition)   │
│  REPO_MAP.md                ← directory rules + dependency direction │
│  CODING_FAILURE_PATTERNS.md ← CFP-001–CFP-009+ (post-mortem log)    │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 1 · SKILL ROUTING                                             │
│                                                                      │
│  .agents/skills/skill-manifest.json   ← keyword → skill mapping     │
│  .agents/skills/registry.md           ← fast-match table            │
│  .agents/skills/harness/mece/SKILL.md         ← Phase 2 planning            │
│  .agents/skills/coding/editor/SKILL.md       ← code edit + [post-read] ★  │
│  .agents/skills/coding/coder/SKILL.md        ← new file + [post-read] ★   │
│  .agents/skills/coding/agent/SKILL.md        ← orchestration + merge ★    │
│  .agents/skills/knowledge/session_manager/SKILL.md ← pause/resume/close ★    │
│  .agents/skills/harness/self_improve/SKILL.md    ← CFP review + harness ✦  │
│  .agents/skills/harness/harness_doctor/SKILL.md  ← structural CFP fix ●      │
│  .agents/skills/harness/harness_editor/SKILL.md  ← harness file edits △      │
│  .agents/skills/harness/token_tracker/SKILL.md   ← estimation formulas      │
│  .agents/skills/knowledge/file_manager/SKILL.md    ← index_files sync         │
│  .agents/skills/knowledge/variable_manager/SKILL.md← index_variables sync     │
│  .agents/platform/detected.md         ← spawn_tool per platform     │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 2 · KNOWLEDGE BASE                                            │
│                                                                      │
│  knowledge/index_files.json      ← backlinks (imported_by, imports) │
│  knowledge/index_variables.json  ← symbols + line numbers (used_in) │
│  knowledge/index_sessions.json   ← session history index ★★         │
│  knowledge/index_cfp_fix.json    ← CFP occurrence + fix tracking ●   │
│  knowledge/error_index.md        ← ERR-XXX codes (search first)     │
│  docs/master_roadmap.md          ← task checklist [ ]→[/]→[X]       │
│                                                                      │
│  INDEX MAINTENANCE SCRIPTS (rebuild knowledge layer):               │
│  scripts/symbol_indexer.py  ← scans src/ → updates index_variables  │
│  scripts/lookup.py          ← T0 oracle: file+line+hint in one call ★★│
│  scripts/session_indexer.py ← scans .sessions/ → index_sessions ★★  │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 3 · SESSION STATE                                             │
│                                                                      │
│  .sessions/active_thread.md     ← phase: done|in_progress|blocked   │
│  .sessions/session_tokens.md    ← SESSION_TOTAL (gate writes only)  │
│  .sessions/mece_plan.md         ← section checklist + pending       │
│  .sessions/session_handoff.md   ← resume point                      │
│                                    + attempt_count ★                │
│                                    + mece_plan_hash ★               │
│  .sessions/session_NNN.json     ← archive (session_001–073)         │
│  .sessions/compact_state.md    ← B1 restore: dt/sk/sk_h/mece_h/p3 ◆│
│                                   written at session close (Step 5.3)│
│                                   same-day → skip B2/B3 (~2.9k tok) │
└──────────────────────────────────────────────────────────────────────┘
                   ★ = added in 2026-05-25 vulnerability fixes
                   ● = added in 2026-05-26 CFP tracking + harness_doctor + checkpoint gates
                   ◆ = added in 2026-05-27 compact_state.md + mece_plan_controler fixes
                   △ = added in 2026-05-29 harness_editor skill (T-021)
```

---

## Boot Sequence

```
USER MESSAGE
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  BOOT  [AGENTS.md §Boot · CLAUDE.md §Boot · max 3 tool calls]  │
│                                                                 │
│  [B1] Bash: check .sessions/compact_state.md dt= field ◆       │
│       dt=today → emit [compact-restore] · cat compact_state.md │
│       Then: read .sessions/active_thread.md                    │
│       ├─ phase = in_progress  → load SESSION_TOTAL             │
│       └─ phase ≠ in_progress  → SESSION_TOTAL = 0 (reset)      │
│       + grep roadmap [/] · echo CFP_COUNT: N → cfp_boot_count  │
│                                                                 │
│  [B2] IF [compact-restore]: parse sk= → use as skill_name ◆   │
│            SKIP manifest read (~1,300 tokens saved)            │
│       ELSE IF prompt `skill: <name>` → skip manifest           │
│       ELSE: grep skill-manifest.json keywords → skill_name     │
│                                                                 │
│  [B3] IF [compact-restore]: sha1 check sk_h + mece_h ◆        │
│            match → SKIP SKILL.md reads (~2.9k tokens saved)   │
│            mismatch → re-read (file changed)                   │
│       ELSE: Read SKILL.md offset=1 limit=80 → sections[] ONLY  │
│             + Read mece/SKILL.md offset=31 limit=110           │
│             → §Plan Format + §Execution Protocol in memory     │
│                                                                 │
│  [B4] *** only if detected.md has platform: unknown ***        │
│       → probe available tools → update detected.md             │
│       → no match → [platform-unknown] → ask 4 questions        │
└─────────────────────────────────────────────────────────────────┘
     │
     ├─── phase = in_progress? ────────────────────────────────┐
     │                                                         │
     │  RESUME STALENESS GATE ★ [AGENTS.md §Boot]             │
     │  ┌─────────────────────────────────────────────────┐   │
     │  │ sha1sum .sessions/mece_plan.md                  │   │
     │  │   vs mece_plan_hash in session_handoff.md       │   │
     │  │ git status --short src/ → any changes?          │   │
     │  │                                                 │   │
     │  │ hash mismatch OR src/ changed:                  │   │
     │  │   → emit [plan-stale]                          │   │
     │  │   → ask user: reconfirm plan or rebuild?       │   │
     │  │                                                 │   │
     │  │ hash matches AND src/ clean:                    │   │
     │  │   → Phase 3 directly (skip Phase 1–2)          │   │
     │  └─────────────────────────────────────────────────┘   │
     └─────────────────────────────────────────────────────────┘
     │
     ▼
  Reply line 1 (mandatory — CFP: field enforces cfp_boot_count extraction ◆):
  [Boot] Thread: <done|in_progress> · Tasks: N · Skill: <name> · Tokens: ~Nk · CFP: N
```


╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK1: Post-Boot — Ready to Route?             ║
╠══════════════════════════════════════════════════════════╣
║ □ [Boot] trace emitted in reply line 1                  ║
║ □ compact_state.md checked · [compact-restore] if today ◆║
║ □ cfp_boot_count stored in working memory (B1)          ║
║ □ skill_name cached from B2/B3 · or from sk= field ◆   ║
║ □ SESSION_TOTAL = 0 (fresh) or loaded (resume)          ║
║ → any □ missing: re-run missing Boot step before C0     ║
╚══════════════════════════════════════════════════════════╝
> ⚠️ **Boot ending ≠ ready to work.** After Reply line 1 → run C0–C3 → then Phase 1.
> Reading SKILL.md at B3 is NOT Phase 1. Do NOT touch `src/` until `[✓ gather]` AND `[✓ MECE]` emitted.
> See: `CLAUDE.md §MANDATORY BOOT GATE`

---

## Per-Turn Routing

```
Every user message — run C0 → C1 → C2 → C3 before any work ✦
[CLAUDE.md §Per-Turn · AGENTS.md §Per-Turn]
     │
     ▼
┌────────────────────────────────────────────────────────────────────┐
│  [C0] if c0_resolved flag set → clear → skip to C1 ◆              │
│       COMPLAINT CHECK ✦ (R16 CLAUDE.md)                           │
│       signals: "ทำไมไม่ทำตาม" · "you skipped" · "didn't log"      │
│                "harness says" · "ไม่ได้บันทึก"                     │
│       "ลืม" qualifier: object must be a harness step name          │
│         (roadmap/error_index/CFP/index/boot/skill/gate/MECE)       │
│         "ลืมบอกให้เพิ่ม X" = feature → NOT C0                     │
│       YES → emit [self-improve] → backfill (ask if context gone)   │
│           → log CFP → set c0_resolved=true → re-run C0-C1-C2-C3 ◆ │
│       NO  → continue to C1                                         │
│                                                                    │
│  [C1] Read .sessions/active_thread.md → extract task: field        │
│                                                                    │
│  [C2] TOPIC SWITCH CHECK ✦                                         │
│   IS new topic (close session first):                              │
│     · Different app section (site-plan↔center↔admin↔report)       │
│     · Different primary entity (job↔user↔plan↔request)            │
│     · Different intent type (debug→feature, or feature→debug)      │
│     · Message names different src/app/ route than current task     │
│   NOT a switch:                                                    │
│     · "also fix/update" · revision of approach · added constraint  │
│     · bug inside current work · "ต่อ/continue/keep going"          │
│   UNCERTAIN → emit [topic-unclear] → ASK before routing            │
│                                                                    │
│  [C3] ROUTE                                                        │
│   TOPIC SWITCH →                                                   │
│       emit [topic-switch] Current: X · New: Y · Closing first      │
│       → session_manager §3 (close + reset) → new Phase 1          │
│   SAME TOPIC →                                                     │
│       match keywords[] → re-read SKILL.md if skill changes         │
└────────────────────────────────────────────────────────────────────┘

Routing examples (after C2 confirms same topic):
  "แก้ bug / fix / error"       → editor/SKILL.md
  "สร้าง / เพิ่ม / implement"   → coder/SKILL.md
  "ปิด / close / done"           → session_manager/SKILL.md
  "plan / วางแผน"                → mece/SKILL.md
  "review CFP / improve harness" → self_improve/SKILL.md ✦
  "harness doctor / structural"  → harness_doctor/SKILL.md ●
  "แก้ harness / update harness / edit SKILL.md / improve skill" → harness_editor/SKILL.md △
  no match                      → agent/SKILL.md (fallback)
```


╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK2: Post-C3 — Ready for Phase 1?            ║
╠══════════════════════════════════════════════════════════╣
║ □ C0 complaint resolved (or c0_resolved cleared)        ║
║ □ C1 active_thread.md read → task: field extracted      ║
║ □ C2 topic switch resolved (stay / close+reopen)        ║
║ □ C3 skill_name matched and routed                      ║
║ → any □ missing: complete C0-C3 first                   ║
╚══════════════════════════════════════════════════════════╝
> ⚠️ **After C3 (any branch) → MANDATORY: Phase 1 G1-G2-G3 next. No exceptions.**
> Knowing the skill from B3 does NOT satisfy Phase 1. Must grep indexes + read files + emit `[✓ gather]`.
> Then Phase 2: MECE plan → user confirm → write `mece_plan.md` → emit `[✓ MECE]`.
> **Infrastructure gate:** PreToolUse hook blocks `src/` Edit if `mece_plan.md` absent.
> See: `CLAUDE.md §PHASE TRANSITION GATE`, `AGENTS.md §Per-Turn line 122`

---

## Phase 1 · Info Gather

```
[AGENTS.md §Phase 1 · CLAUDE.md §R5 · editor/SKILL.md · coder/SKILL.md]

┌─────────────────────────────────────────────────────────────────────┐
│  GATHER LOOP — Hybrid front-loaded model (max 3 loops total) ◈      │
│                                                                     │
│  [G1] SCAN ALL sections at once — one pass, not per-section ◈      │
│       For EACH section in Skill sections[]:                         │
│         □ What file/symbol does this section need?                  │
│         □ Available via index grep, or needs user input?            │
│       Output: missing_files[] + missing_user_input[]               │
│       → missing_user_input not empty?                               │
│           Compile COMPLETE list → ask user ONCE (all items)         │
│           NEVER ask per-item mid-loop                               │
│           Wait for reply → restart G1 with new info                │
│       → missing_files only? → proceed to G2                        │
│                                                                     │
│  [G2] BATCH RETRIEVE — all greps in ONE Bash call ◈                │
│       Run ALL needed greps together → get line numbers              │
│       Then: targeted Read per item (offset+limit, never full file)  │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ PRE-READ GATE ★ [CLAUDE.md §R5]                             │  │
│   │ emit before EVERY Read (no exceptions):                      │  │
│   │   [pre-read] Target: X · Tier: T1|2|3 · Line: N             │  │
│   │ no line number → grep not done → grep first                  │  │
│   │ Read without gate = [violation R5] → discard → redo          │  │
│   └──────────────────────────────────────────────────────────────┘  │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ POST-READ VERDICT ★ [CLAUDE.md §R5]                         │  │
│   │   [post-read] File: <path> · Verdict: relevant|partial|irrelevant│
│   │ irrelevant → DROP from context NOW · not in Phase 2          │  │
│   │ partial    → keep excerpt only (note L<N>–L<N>)              │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [G3] ASSESS — all must pass:                                       │
│       □ every Skill section has ≥1 resolved file/symbol            │
│       □ every Skill section has a Verify-N criterion               │
│       □ no "?" placeholders remain                                 │
│       ✅ all clear → emit [✓ gather] → Phase 2                    │
│       ❌ new dependency found → loop once more (max 2 extra loops) │
│       count = 3 → [gather-stalled] → ask user (single message)     │
│                                                                     │
│  Hard limits ◈: G1 = 1 pass all sections · G2 = 1 Bash batch       │
│  User asks = max 1 per Phase 1 run · TOKEN check: >60k → PAUSE     │
└─────────────────────────────────────────────────────────────────────┘
```

---
╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK3: Pre-Phase 2 — Gather Complete?          ║
╠══════════════════════════════════════════════════════════╣
║ □ [✓ gather] emitted this phase                         ║
║ □ gather_complete.md exists (date = today)              ║
║ □ Every Skill section: ≥1 resolved file/symbol          ║
║ □ Every Skill section: draft Verify-N criterion         ║
║ □ No "?" placeholders in working notes                  ║
║ → any □ missing: back to G1 (Phase 1)                   ║
╚══════════════════════════════════════════════════════════╝


## Phase 2 · MECE Plan

```
[AGENTS.md §Phase 2 · .agents/skills/harness/mece/SKILL.md · INVARIANTS.md §I6]

Runs ONCE per task. Resume → skip if plan is still valid.

┌─────────────────────────────────────────────────────────────────────┐
│  [M1] Load .agents/skills/harness/mece/SKILL.md                             │
│                                                                     │
│  [M1.5] REASON — extended reasoning pass across ALL sections:       │
│   □ Dependencies: A→B output chain? → Sequential                   │
│   □ Parallelizable: no shared state → Parallel (feeds Cycle groups) │
│   □ Irreversible: [gate]/delete/DB? → flag for M3 user attention    │
│   □ Risk surface + Outcome sketch → feeds M2.5 Verify-N            │
│   Budget: ≤600 tokens · working memory only · not written to file   │
│                                                                     │
│  [M2] Build plan 1:1 with Skill sections — REQUIRED per section:    │
│   Section N — <name from Skill sections[]>:                         │
│     Skill:    <editor|coder|file_manager|variable_manager|agent>    │
│     Steps:   [A] → [B] → [C]                                       │
│     Verify:  <checkable command — see Verify Pattern Lookup>        │
│     Rollback: <what to undo>                                        │
│   ★ Skill: field mandatory per section [mece/SKILL.md §Plan Format] │
│                                                                     │
│  [M2.5] Define Verify-N per section (DoD):                          │
│   Verify-1: `grep -c "symbolName" src/path.ts` → 1                 │
│   Verify-2: `npm run build 2>&1 | grep -c "error"` → 0             │
│   ★ Verify Pattern Lookup [mece/SKILL.md §Verify Patterns]:         │
│     symbol create/delete/rename · import add/remove · file ops      │
│     build · tsc · DB table/row · index sync · roadmap [X] · ERR    │
│                                                                     │
│  [M3] Send plan + Verify-N to user → wait for confirm               │
│       user must confirm BOTH plan steps AND verify criteria         │
│                                                                     │
│  [M4] Write roadmap entries ★ [INVARIANTS.md §I6]                  │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ If spawning parallel sub-agents:                            │  │
│   │ 1. grep roadmap → find last T-N                             │  │
│   │ 2. pre-assign T-N+1, T-N+2 ... for every section           │  │
│   │ 3. write ALL [ ] T-N entries BEFORE any spawn call          │  │
│   │ 4. pass assigned T-ID to each sub-agent                     │  │
│   │ ★ sub-agents must NOT self-assign IDs (race condition risk)  │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [M5] emit [✓ MECE] → proceed to Phase 3                           │
└─────────────────────────────────────────────────────────────────────┘
```

---
╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK4: Pre-Phase 3 — MECE Complete?            ║
╠══════════════════════════════════════════════════════════╣
║ □ [✓ MECE] emitted                                      ║
║ □ .sessions/mece_plan.md written today                  ║
║ □ mece_plan.md has ≥2 Verify-N criteria                 ║
║ □ User explicitly confirmed plan + Verify-N             ║
║ □ Roadmap [ ] T-N entries written                       ║
║ → any □ missing: back to Phase 2 (M1-M5)               ║
╚══════════════════════════════════════════════════════════╝


## Phase 3 · REACT Loop (Execution)

```
[AGENTS.md §Phase 3 · CLAUDE.md §R2/R5/R6 · editor/SKILL.md]

SECTION LOOP (S = 1 → N per MECE plan)
     │
     ├─ TOKEN check: >60k → finish step → TOKEN PAUSE ──────────────┐
     │                                                               │
     ▼                                                               │
┌──────────────────────────────────────────────────────────────────┐ │
│  REACT LOOP (repeat per step until section complete)             │ │
│                                                                  │ │
│  [L1] SELECT → next tool                                         │ │
│       R2: max 5 tool calls/turn [CLAUDE.md §R2]                  │ │
│       R5: index-first before every Read [CLAUDE.md §R5]          │ │
│                                                                  │ │
│  [L2] EXECUTE → run tool                                         │ │
│       R6: pipe output | grep -iE "error|warn|fail" | tail -20    │ │
│       [CLAUDE.md §R6]                                            │ │
│                                                                  │ │
│  [L3] OBSERVE → result correct?                                  │ │
│       unexpected → retry 1×                                      │ │
│       retry fails → BLOCKED ───────────────────────────────────┐ │ │
│                                                                  │ │ │
│  [L4] VERIFY — both must pass:                                   │ │ │
│  (a)  grep confirm → emit [✓ written]                            │ │ │
│       not found → retry 1× → fail → BLOCKED ───────────────────┤ │ │
│  (b)  run Verify-N defined in Phase 2                            │ │ │
│       PASS → section_done eligible                               │ │ │
│       FAIL → do NOT mark done → BLOCKED ────────────────────────┤ │ │
│                                                                  │ │ │
│  [L4.5] PURGE ◈ drop step's tool results from working context    │ │ │
│         keep only: [✓ written] verdict + artifact path + Verify  │ │ │
│         NEVER carry raw tool output to next step                 │ │ │
│                                                                  │ │ │
│  [L5] DECIDE                                                     │ │ │
│       steps remain → [loop] Section S · step <name> → continue  │ │ │
│       (a)+(b) pass → emit [loop] done · section complete         │ │ │
└──────────────────────────────────────────────────────────────────┘ │ │
     │                                                               │ │
     ▼                                                               │ │
╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK5: Pre-Next-Section — Section Done?        ║
╠══════════════════════════════════════════════════════════╣
║ □ [✓ written] grep verify passed for this section       ║
║ □ Verify-N from mece_plan.md for this section: PASS     ║
║ □ mece_plan.md: current section marked [X]              ║
║ □ Roadmap T-N for this section marked [X]               ║
║ → any □ missing: stay in REACT LOOP (do NOT advance)    ║
╚══════════════════════════════════════════════════════════╝
Write .sessions/session_handoff.md ★ [session_manager/SKILL.md §2]  │ │
  sections_done: [list]                                              │ │
  sections_pending: [list]                                           │ │
  last_step: <name>                                                  │ │
  attempt_count: N    ← retries used on current step (0 or 1) ★    │ │
  mece_plan_hash: X   ← sha1 of mece_plan.md at this moment ★      │ │
  cfp_boot_count: N   ← persisted for /compact resume recovery ◆   │ │
  cfp_deferred: {}    ← merged (not overwritten) at session close ◆ │ │
  cfp_dismissed: []   ← permanent — survives across sessions ◆     │ │
  last_self_improve_session: <id> ← cooldown gate reference ◆      │ │
     │                                                               │ │
     └─ next section ────────────────────────────────────────────────┘ │
                                                                        │
TOKEN PAUSE [session_manager/SKILL.md §2] ◄─────────────────────────── │
┌──────────────────────────────────────────────────────────────────────┐
│ 1. finish current step (never stop mid-step)                         │
│ 2. write session_handoff.md (with attempt_count + mece_plan_hash ★) │
│ 3. ask user: "ดำเนินการต่อไหมครับ?"                                   │
│ 4. on confirm:                                                       │
│                                                                      │
│    MECE Staleness Gate ★ [session_manager/SKILL.md §2 step 2b]      │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │ sha1sum mece_plan.md vs mece_plan_hash in handoff           │  │
│    │ git status --short src/ → any changes?                      │  │
│    │ mismatch → [plan-stale] → ask: reconfirm or rebuild?        │  │
│    │ match + clean → proceed silently                            │  │
│    └─────────────────────────────────────────────────────────────┘  │
│    restore attempt_count → budget = 1 if count=0, 0 if count=1 ★   │
│    reset to pending section → reopen REACT LOOP                     │
└──────────────────────────────────────────────────────────────────────┘

BLOCKED [session_manager/SKILL.md §2 · AGENTS.md §Phase 3]
┌──────────────────────────────────────────────────────────────────────┐
│ 1. HALT all remaining sections                                       │
│ 2. write session_handoff.md (status: blocked)                        │
│ 3. show: error detail + sections_done + sections_pending             │
│ 4. ask user: "แก้ก่อนดำเนินการต่อ หรือ skip section นี้?"            │
│    Fix  → user resolves → reload → resume blocked section           │
│    Skip → mark [/] + note → continue next section                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Sub-agent Orchestration (Parallel Fan-out)

```
[agent/SKILL.md · AGENTS.md §Sub-agent Rules · INVARIANTS.md §I6/I7]

Trigger: ≥5 files / ≥300 lines / ≥2 MECE sections in same Cycle

┌──────────────────────────────────────────────────────────────────────┐
│  Pre-spawn checklist:                                                │
│  1. Read .agents/platform/detected.md → get spawn_tool              │
│     platform: unknown → run B4 probe first                          │
│  2. Pre-assign roadmap IDs ★ [INVARIANTS.md §I6]                   │
│     grep roadmap → last T-N                                          │
│     write [ ] T-N+1, T-N+2 for all sections BEFORE spawn            │
│     pass assigned T-ID to each sub-agent in Delegation Contract      │
│  3. Delegation Contract ◈ [agent/SKILL.md]: prompt ≤800 tokens      │
│     goal: 1-3 sentences · constraints: rule numbers only            │
│     context_files: paths only ≤5 · cycle_context: ≤5 bullets ≤150c  │
│     NEVER inject: session History / knowledge JSON / CLAUDE.md text │
└──────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Skill Delegation ★ [agent/SKILL.md §Skill Delegation Rules]         │
│                                                                      │
│  P1 — explicit `Skill:` in MECE plan section (overrides all)         │
│       `Skill: coder` → spawn coder regardless of action type         │
│                                                                      │
│  P2 — heuristics (when Skill: not declared):                         │
│       new files / features    → coder                                │
│       modify / fix existing   → editor                               │
│       file create/move/delete → also file_manager                   │
│       symbol create/rename    → also variable_manager               │
│                                                                      │
│  Multi-skill  `Skill: X + Y`:                                        │
│       run X first → verify → then Y                                  │
│       both write to cycle_N_<section_id>.json                        │
│       X fails → do NOT run Y → section blocked                      │
└──────────────────────────────────────────────────────────────────────┘
     │
     ▼
emit [cycle N] <spawn_tool> [A, B, ...] → .sessions/cycle_N_*.json
     │
     ├─── Sub-agent A ──────────────────────────────────────────────┐
     │    writes .sessions/cycle_N_A.json:                          │
     │    { "cycle": N, "section": "S1-name",                       │
     │      "status": "done|blocked",                               │
     │      "verify_result": "<output>",                            │
     │      "artifacts": ["path/to/file"],                          │
     │      "tokens_estimated": N,   ← REQUIRED ★ (I7)             │
     │      "notes": "" }                                           │
     └──────────────────────────────────────────────────────────────┘
     ├─── Sub-agent B ─── (same format) ───────────────────────────┘
     │
     ▼
After ALL Cycle N agents complete — orchestrator reads results:
┌──────────────────────────────────────────────────────────────────────┐
│  a. validate each cycle_N_*.json [agent/SKILL.md §5a]               │
│     required keys: cycle, section, status, verify_result,           │
│                    artifacts, tokens_estimated ★                     │
│     status must be "done" or "blocked"                               │
│     missing file / invalid JSON → treat as blocked                  │
│                                                                      │
│  b. any blocked → HALT all remaining Cycles → BLOCKED flow          │
│                                                                      │
│  c. aggregate results — Context Trim (apply [post-read] verdicts ★) │
│     irrelevant verdict → exclude from context_files:                 │
│     partial verdict → pass path+line range only                     │
│                                                                      │
│  d. TOKEN MERGE ★ [agent/SKILL.md §5d · INVARIANTS.md §I7]         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ sum tokens_estimated from all cycle_N_*.json                  │ │
│  │ missing tokens_estimated → add 2,000 flat (buffer)            │ │
│  │ add sum to SESSION_TOTAL (working memory)                     │ │
│  │ write updated total → .sessions/session_tokens.md             │ │
│  │ check R3 threshold immediately                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
     │
     ├─── >50k AND compact not run → compact first → emit [compact]
     ├─── >60k → TOKEN PAUSE (do not spawn Cycle N+1 until confirmed)
     └─── ≤50k → spawn Cycle N+1 with cycle_context: from results
```

---

## MECE Plan Templates

```
[mece/SKILL.md §Templates — select by task type]

┌────────────────────────────────────────────────────────────────────────────┐
│  Bug Fix  (target: editor)                                                 │
│  S1 Diagnose:      Skill: editor · R9 3-checks · blast radius             │
│  S2 Edit & Verify: Skill: editor · targeted fix · grep confirm            │
│  S3 Sync & Close:  Skill: editor · indexer · ERR-XXX · roadmap [X]        │
│  Cycles: 1:[S1] → 2:[S2] → 3:[S3]   (serial — each depends on previous)  │
├────────────────────────────────────────────────────────────────────────────┤
│  New Feature  (target: coder)                                              │
│  S1 Scope & Index: Skill: agent         · scope probe · conflict check    │
│  S2 Build:         Skill: coder         · create files · verify each      │
│  S3 Sync & Close:  Skill: file_manager+variable_manager · index · roadmap │
│  Cycles: 1:[S1] → 2:[S2] → 3:[S3]                                        │
├────────────────────────────────────────────────────────────────────────────┤
│  Refactor / Rename  (target: editor)                                       │
│  S1 Diagnose:      Skill: editor           · grep index · used_in list    │
│  S2 Edit & Verify: Skill: editor           · rename all · verify 0 old    │
│  S3 Sync & Close:  Skill: variable_manager · indexer · roadmap [X]        │
│  Cycles: 1:[S1] → 2:[S2] → 3:[S3]                                        │
├────────────────────────────────────────────────────────────────────────────┤
│  Multi-skill / Complex Feature  (target: agent)                            │
│  S1 Scope & Design: Skill: agent                                           │
│       scope probe · assign skill per section · pre-assign ALL T-IDs ★    │
│  S2 Build New:      Skill: coder         · create files                   │
│  S3 Modify Existing:Skill: editor        · targeted edits                 │
│  S4 Sync & Close:   Skill: file_manager+variable_manager                  │
│  Cycles: 1:[S1] → 2:[S2,S3] parallel → 3:[S4]                            │
│  S4 context-input: cycle_2_S2.json, cycle_2_S3.json ★                    │
└────────────────────────────────────────────────────────────────────────────┘

★ Pre-assign ALL T-IDs at S1 before any spawn (INVARIANTS.md §I6)
★ S4 context-input injected by orchestrator (agent/SKILL.md §Delegation Contract)
```

---

## Completion Gate

```
[AGENTS.md §Completion Gate]

CHECKPOINT CK6 — Agent may NOT report done until ALL pass:
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  □ All mece_plan.md sections = [X]                                  │
│    grep -cE "^\- \[ \]" .sessions/mece_plan.md → 0                  │
│                                                                      │
│  □ All N sections executed via tool calls (not just described)       │
│                                                                      │
│  □ Every write/edit has [✓ written] — grep verify passed             │
│    [AGENTS.md §L4 · CLAUDE.md §R12]                                 │
│                                                                      │
│  □ R8 Index Sync done (if any file/symbol changed)                   │
│    python scripts/symbol_indexer.py                                  │
│    [CLAUDE.md §R8 · INVARIANTS.md §I3]                              │
│                                                                      │
│  □ All roadmap entries marked [X] with annotation                   │
│    [X] T-N: desc (→ ERR-XXX) · attempts: 1 · tool_calls: 6          │
│    [INVARIANTS.md §I5 · CLAUDE.md §R-Roadmap]                       │
│                                                                      │
│  □ .sessions/active_thread.md → phase: done                         │
│                                                                      │
│  □ SESSION_TOTAL written → .sessions/session_tokens.md              │
│                                                                      │
│  □ Feedback & Error Summary delivered to user                        │
│    (errors/retries listed + new CFP if pattern found)               │
│                                                                      │
│  Any unchecked → continue Phase 3 (never report done prematurely)   │
│                                                                      │
│  OmO Reviewer (apply when sections > 2 OR any [gate]/DB action):    │
│  Spawn haiku sub-agent (read-only) BEFORE reporting done:            │
│    Prompt: Verify-N list from mece_plan.md + grep commands           │
│    Output: PASS or FAIL: [section, criterion, actual_output]         │
│    On FAIL → retry section (1× max) → R13 escalate if still fails   │
│    Reviewer has no Edit/Write tools — read-only only                 │
│  → [agent/SKILL.md §Orchestration step 7]                           │
│                                                                      │
│  All checked   → Task Complete ✅                                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Guard Rail Quick Reference

```
Gate                    Trigger                               Source file
─────────────────────── ───────────────────────────────────── ──────────────────────────────
[recurring]             R9 Step 0 detects prior failed attempt  CLAUDE.md §R9 Step 0
                        → read Failed Approaches → choose different approach
[failed-approach]       R12 verify fails → write Failed Approaches before R13 escalate  CLAUDE.md §R9
[index T0] ★★           T0 lookup.py oracle call              CLAUDE.md §R5, editor/SKILL.md §T0
                        → runs before any grep/Read · returns file+line+read_hint
[session-lookup] ★★     lookup.py --session result used       session_manager §2 Step 1a, coder §1
                        → found prior session → inject as bullet context
[pre-read]              before EVERY Read call                CLAUDE.md §R5
[post-read] ★           after EVERY Read result              CLAUDE.md §R5, editor/coder SKILL.md
[pre-edit]              before EVERY Edit/Write on symbol     CLAUDE.md §R5
[violation R5] ★        Read/Edit without gate trace          CLAUDE.md §R5
                        → discard result → redo with gate
[never-full-load VIOLATION] ★★  PostToolUse Read hook fires   ~/.claude/settings.json §PostToolUse
                        → protected file read in full → discard → re-run as grep+offset
[WARN wrong-plan-file] ★★  PostToolUse Write hook fires        ~/.claude/settings.json §PostToolUse
                        → plan .md written outside .sessions/mece_plan.md → move content
[MECE CONTENT GATE] ★★  PreToolUse deny (src/ edit)           ~/.claude/settings.json §PreToolUse
                        → mece_plan.md has <2 Verify-N criteria → rewrite before proceeding
[skill-gate] ★★ (T-263) PreToolUse deny (harness/skill edit)  scripts/skill_gate.py, manifest owns_paths
                        → edit to an owned path while its owning skill is NOT in .active_skill (today) → block (CFP-020/043)
                        → phase:done close while .review_intent armed + no scrutinize/skeptical_reviewer loaded → block (CFP-044)
[review-intent] (T-263) UserPromptSubmit nudge (review ask)    scripts/review_intent.py
                        → user says review/audit/verify → inject "load owning skill" reminder + arm .review_intent (never blocks)
[skill-active]          skill activation = .active_skill marker  scripts/posttool_track.py (on SKILL.md Read)
[plan-stale] ★          resume + hash mismatch / src changed  AGENTS.md §Boot, session_manager §2b
[gate]                  destructive action (delete/overwrite) INVARIANTS.md §I1
[db-gate]               edit src/db/ or DrizzleSchema symbol  INVARIANTS.md §I2
[gather-stalled]        Phase 1 loop count ≥ 3               AGENTS.md §Phase 1
[✓ gather]              context_sufficient all boxes checked  AGENTS.md §Phase 1
                        → MUST write .sessions/gather_complete.md (date: YYYY-MM-DD)
[✓ MECE]                plan confirmed by user               AGENTS.md §Phase 2
[✓ written]             grep verify after every write/edit    AGENTS.md §Phase 3 L4
[blocked]               retry ≥ 2× failed                    AGENTS.md §Phase 3 L3/L4
[loop]                  step/section progress trace           AGENTS.md §Phase 3 L5
[compact]               SESSION_TOTAL > 50k                  session_manager/SKILL.md §1
[plan-stale] ★          MECE staleness on resume             session_manager/SKILL.md §2b
[resume-attempt] ★      restore attempt_count on resume      session_manager/SKILL.md §2
[cycle N]               spawn parallel sub-agents            agent/SKILL.md §Orchestration
[platform-unknown]      detected.md platform: unknown        AGENTS.md §Boot B4
[topic-switch] ✦        new message = different topic         AGENTS.md §Per-Turn C2
                        → close session first → new Phase 1
[topic-unclear] ✦       topic ambiguous — ask before routing  AGENTS.md §Per-Turn C2
[self-improve] ✦        R16 complaint detected → backfill     CLAUDE.md §R16
[cfp-tally] ✦           new CFPs found at session close       self_improve/SKILL.md §1
[cfp-skip] ✦            no new CFPs → skip CFP review         self_improve/SKILL.md §1
[cfp-analysis] ✦        pattern rank + root cause emitted     self_improve/SKILL.md §2
[cfp-deferred] ✦        user skipped proposal → save count    self_improve/SKILL.md §3
[blocked-self-edit] ✦   §4 tried to edit self_improve itself  self_improve/SKILL.md §4 Invariants
[blocked-invariant] ◆   §4 proposal conflicts with INVARIANTS  self_improve/SKILL.md §4 Step 0.5
[cfp-cooldown] ◆        §4 skipped — ran too recently          self_improve/SKILL.md §4 Step 0
[cfp-pending] ◆         proposal not answered — re-present     self_improve/SKILL.md §3
[proposal-mismatch] ◆   proposed fix doesn't catch original    self_improve/SKILL.md §3 Step 2.5
[✓ harness-updated] ✦   harness file edited + verified        self_improve/SKILL.md §4
[purge] ◈               after L4.5 — tool results dropped      AGENTS.md §Phase 3 L4.5
[cfp-archive] ◈         CFP >20 → archive oldest to cfp_archive.md  self_improve/SKILL.md §1
[resume-config] ◈       skill unchanged on resume → skipped SKILL.md re-read  session_manager §2
[mece-audit]       ●  Verify-N PASS at session close              session_manager §3 Step 0.5
[mece-audit-skip]  ●  No mece_plan sections → audit skipped       session_manager §3 Step 0.5
[mece-audit-fail]  ●  Verify-N failed at close → CFP candidate    session_manager §3 Step 0.5
[cfp-recurred]     ●  Occurrence after fix applied_date detected   session_manager §3 Step 0.6
[diagnosis]        ●  CFP: target + prior fixes + diagnosing model harness_doctor §1
[audit-finding]    ●  Gap type a/b/c/d located in harness files    harness_doctor §2
[harness-proposal] ●  Structural fix proposed — HALT for confirm   harness_doctor §3
[harness-proposal-deferred] ● User skipped — count persisted       harness_doctor §4
[harness-doctor-skip] ● No recurred entries in index_cfp_fix.json  harness_doctor §1
[harness-fix]      ●  Structural fix applied + detection verified  harness_doctor §5

★ = added in 2026-05-25 vulnerability fixes
✦ = added in 2026-05-25 self-improvement + topic-switch patches
◆ = added in 2026-05-25 vulnerability audit fixes (V-Audit + Round 2)
◈ = added in 2026-05-25 token efficiency improvements (T-078–T-082)
★★ = added in 2026-05-26 index enrichment + session lookup (session_086)
● = added in 2026-05-26 CFP fix index + harness_doctor + checkpoint gates (session_086+)
```

---

## Token Tracking Formula

```
[CLAUDE.md §R1]

SESSION_TOTAL = sum of (Input_n + Output_n) across all turns

Input_n = user_msg_chars × 0.3
        + context_overhead
        + tool_result_tokens ★

  tool_result_tokens (per result) ★:     ← tiered formula (V2 fix)
    ≤ 150 lines  → result_chars × 0.3
    151–300 lines → result_chars × 0.5   (code/JSON higher density)
    > 300 lines  → result_chars × 0.5 + 1,000 flat buffer
    floor: 200 tokens per result minimum

  context_overhead:
    Turn 1   = ~4,000
    Turn N   = 200 + (SESSION_TOTAL × 0.08)

Output_n = thai_chars × 1.7 + en_chars × 0.3

Thresholds [CLAUDE.md §R3]:
  > 60k → TOKEN PAUSE (finish step → save state → ask user)
  > 90k → HALT immediately → save → report to user

Write to file ONLY at: token pause · blocked halt · completion gate · TOKEN CHECK point (write working memory SESSION_TOTAL before reading)
★ Cycle token merge also writes after each parallel Cycle N (INVARIANTS.md §I7)
```

---

## Vulnerability Fixes Summary (2026-05-25)

| V# | Issue | Fix | Files Changed |
|---|---|---|---|
| V1 | Pre-Read/Edit gate ceremonial only | Invalid result rule: discard + redo | `CLAUDE.md §R5`, `AGENTS.md` QR |
| V2 | Token estimation drift | Tiered formula by line count + flat buffer | `CLAUDE.md §R1` |
| V3 | MECE plan stale on resume | `mece_plan_hash` + git status check | `AGENTS.md §Boot`, `session_manager §2b` |
| V4 | Cycle result no schema validation | Already in `agent/SKILL.md`; added `tokens_estimated` requirement | `agent/SKILL.md §5a` |
| V5 | Retry budget not persisted | `attempt_count` field in handoff, restored on resume | `session_manager/SKILL.md §2` |
| V6 | Parallel token accounting gap | `tokens_estimated` in result schema + step d merge | `agent/SKILL.md §5d`, `INVARIANTS.md §I7` |
| V7 | CFP-004 post-read not in SKILL.md | `[post-read]` verdict mandatory in editor + coder | `editor/SKILL.md`, `coder/SKILL.md`, `CLAUDE.md §R5` |
| V8 | Roadmap ID collision in parallel | Pre-assign IDs before spawn | `INVARIANTS.md §I6`, `AGENTS.md` Sub-agent Rules |

**MECE & Delegation Improvements (2026-05-25):**

| M# | Gap | Fix | Files Changed |
|---|---|---|---|
| M1 | Plan had no `Skill:` field per section | Added mandatory `Skill:` to plan format + all templates | `mece/SKILL.md §Plan Format` |
| M2 | No DoD verify pattern reference | Added 14-row Verify Pattern Lookup table | `mece/SKILL.md §Verify Patterns` |
| M3 | No multi-skill task template | Added Multi-skill/Complex Feature 4-section template + Cycle grouping | `mece/SKILL.md §Templates` |
| M4 | No delegation priority in agent skill | Added P1 (explicit Skill:) / P2 (heuristic) + multi-skill X+Y handling | `agent/SKILL.md §Skill Delegation` |

New failure patterns documented: `CFP-008` (MECE staleness), `CFP-009` (parallel token gap) — `CODING_FAILURE_PATTERNS.md`

---

**Self-Improvement + Topic-Switch Patches (2026-05-25):**

| P# | Gap | Fix | Files Changed |
|---|---|---|---|
| P1 | Agent skipped topic-switch detection — carried stale context into new tasks | C0-C3 Per-Turn routing: topic-switch check + session close before new task | `AGENTS.md §Per-Turn`, `CLAUDE.md §Per-Turn` |
| P2 | Topic switch criteria vague — agent misjudged follow-ups as new topics | Explicit IS/NOT/UNCERTAIN tables with app section + entity + intent type signals | `AGENTS.md §Per-Turn C2` |
| P3 | No harness-violation complaint detection | C0 COMPLAINT CHECK + R16 Self-Improvement Protocol: detect → backfill → log CFP | `CLAUDE.md §R16`, `AGENTS.md §Per-Turn C0` |
| P4 | CFP logged but never acted on — no review cycle | `self_improve` skill: auto-called at session close, ranks patterns, proposes + executes harness changes | `self_improve/SKILL.md`, `skill-manifest.json` |
| P5 | No CFP baseline at boot — self_improve couldn't calculate new entries | B1 command outputs `CFP_COUNT: N` → stored as `cfp_boot_count` in working memory | `CLAUDE.md §Boot B1`, `AGENTS.md §Boot B1` |
| P6 | Session close skipped CFP review entirely | session_manager §3 Step 0: run self_improve before 5-file close sequence | `session_manager/SKILL.md §3` |

---

**Vulnerability Audit Fixes (V-Audit 2026-05-25) ◆**

| Q# | Vulnerability | Fix | Files Changed |
|---|---|---|---|
| Q1 | V6: CFP ID race condition — parallel agents write duplicate CFP numbers | I8 CFP ID pre-assignment (same pattern as T-IDs in I6) | `INVARIANTS.md §I8` |
| Q2 | V10: cfp_boot_count lost after /compact → false "all CFPs new" | Persist `cfp_boot_count` in session_handoff.md at TOKEN PAUSE; self_improve §1 reads fallback from handoff | `session_manager/SKILL.md §2`, `self_improve/SKILL.md §1` |
| Q3 | V20: self_improve §4 could edit itself → stale loaded version | §4 Invariants: MUST NOT edit self_improve/SKILL.md → emit [blocked-self-edit] → present to user | `self_improve/SKILL.md §4 Invariants` |
| Q4 | V2: "ลืม" false-positive on feature requests | C0 qualifier: "ลืม" only triggers if object is a harness step name, not a feature/component | `CLAUDE.md §R16`, `AGENTS.md §C0` |
| Q5 | V3: C0 resolved but C2 topic-switch not re-evaluated | R16 step 6: after backfill → re-run C1-C2-C3 with original message explicitly | `CLAUDE.md §R16` |
| Q6 | V4: backfill impossible if context no longer available | R16 step 3: context insufficient → ask user for missing info before proceeding | `CLAUDE.md §R16` |
| Q7 | V11: regex `CFP-[0-9]` misses CFP-10+ in recurrence grep | Changed to `CFP-[0-9]+` in self_improve §2 Step 2 | `self_improve/SKILL.md §2` |
| Q8 | V16: repeated deferrals — pattern never fixed | Escalation after 3 deferrals + "dismiss" option; deferred_count persisted in session_handoff.md | `self_improve/SKILL.md §3` |
| Q9 | V18: §4 did not update harness_flow after fix | §4 Step 5: append Q# row to harness_flow Patch table | `self_improve/SKILL.md §4` |
| Q10 | CFP-011: skipped mece_plan.md and created implementation_plan.md directly | Extended MECE Plan Constraint description in CLAUDE.md to halt and create mece_plan.md first | `CLAUDE.md §Loop Architecture` |
| Q11 | Agent full-reads index JSONs + CLAUDE.md in Phase 1 G2 (~14k wasted tokens) | Never-Full-Load list + Full-Read whitelist added; gather_complete.md + mece_plan.md session-date hook | `CLAUDE.md §R5`, `AGENTS.md §Never-Full-Load`, `~/.claude/settings.json` |
| Q12 | No precomputed read_hint in indexes — agents grep-hunt before every Read | Enrich indexes with `line_end`, `read_hint`, `keywords` via `symbol_indexer.py`; add T0 `lookup.py` oracle before T1–T3 grep tiers | `scripts/symbol_indexer.py`, `scripts/lookup.py`, `editor/SKILL.md §T0`, `CLAUDE.md §R5` |
| Q13 | No session history searchable — agents can't find prior fix attempts for same feature/bug | `session_indexer.py` builds `index_sessions.json`; `lookup.py --session` searches it; wired into editor R9 Step 2.5, coder §1, session_manager §2 Step 1a, self_improve §2 Step 4.5 | `scripts/session_indexer.py`, `scripts/lookup.py`, `knowledge/index_sessions.json`, `editor/SKILL.md §R9`, `coder/SKILL.md §1`, `session_manager/SKILL.md §2`, `self_improve/SKILL.md §2` |
| Q14 | Three hook gaps: (a) Read tool no hook → Never-Full-Load bypassed silently; (b) mece_plan.md gate checked existence only, not content → empty/minimal plan passed; (c) no wrong-filename detection for plan files | PostToolUse Read hook (warns + injects [never-full-load VIOLATION] when protected file read); PreToolUse updated with Verify-N count gate (≥2 required); PostToolUse Write hook (warns on *plan*.md outside .sessions/mece_plan.md); CFP-001–004 archived to cfp_archive.md (active=15) | `~/.claude/settings.json §PostToolUse (Read+Write)`, `knowledge/cfp_archive.md` |


---

**Round 2 Vulnerability Fixes (2026-05-25) ◆**

| R# | Vulnerability | Fix | Files Changed |
|---|---|---|---|
| R1 | NC1: Infinite C0 loop — Q5 caused original message re-triggering C0 | `c0_resolved` flag in working memory: set after backfill, C0 checks and clears flag before re-entry | `CLAUDE.md §R16`, `AGENTS.md §C0` |
| R2 | NC2: session_handoff.md overwrite clears cfp_deferred / cfp_dismissed | session_manager §3 Step 3.5: read-merge CFP fields before Write; Step 4 schema includes all CFP fields | `session_manager/SKILL.md §3` |
| R3 | NH1: B1 CFP_COUNT storage unenforceable — no visible gate | Boot reply line 1 mandatory field `· CFP: N` — visible output enforces extraction | `CLAUDE.md §Boot`, `AGENTS.md §Boot` |
| R4 | NH2 + V13: §2 "top pattern" biased to old recurrence count, ignores session CFPs | Priority queue: P1 = current session CFPs first; P2 = historical by recurrence | `self_improve/SKILL.md §2` |
| R5 | NH3: CFP "Detection signal:" not validated — future C0 misses recurrences | R16 Step 2.5: validate keyword against C0 signal list; rewrite if absent | `CLAUDE.md §R16` |
| R6 | V15: "silence > 1 turn" incorrectly deferred pending proposals | Silence → `pending_proposal` in handoff → re-present next session; only explicit "skip" defers | `self_improve/SKILL.md §3` |
| R7 | V21: No test that proposed fix catches original violation | §3 Step 2.5 dry-run: validate proposal against original complaint; max 2 revisions; `[proposal-mismatch]` if fails | `self_improve/SKILL.md §3` |
| R8 | V23: §4 edits without checking INVARIANTS.md conflicts | §4 Step 0.5: grep INVARIANTS.md for conflict → `[blocked-invariant]` + user confirm | `self_improve/SKILL.md §4` |
| R9 | V24: §4 runs every session — harness bloat | §4 Step 0 cooldown gate: skip if ran ≤ 2 sessions ago; exception for recurrence ≥ 5 or explicit request | `self_improve/SKILL.md §4` |
| R10 | NS1: No rollback if §4 edit breaks harness | §4 Step 0.6: backup file before edit; restore on verify failure | `self_improve/SKILL.md §4` |
| R11 | NS2: No audit trail of §4 executions | §4 Step 6: append `SI-N` entry to `.sessions/self_improve_log.md` | `self_improve/SKILL.md §4` |

---

**Phase 1 Enforcement Patches (2026-05-25) ●**

| E# | Gap | Fix | Files Changed |
|---|---|---|---|
| E1 | Agent read SKILL.md at B3, treated it as Phase 1, skipped G1-G2-G3 entirely | Added ⚠️ warning after Boot Reply line 1: "Boot ending ≠ ready to work" | `AGENTS.md §Boot`, `harness_flow §Boot` |
| E2 | No mandatory "Phase 1 next" gate after C3 routing | Added ⚠️ warning after C3: "After C3 → MANDATORY Phase 1 next. No exceptions." | `AGENTS.md §Per-Turn`, `harness_flow §Per-Turn` |
| E3 | No text gate in CLAUDE.md between Boot and Phase 3 | Added `§MANDATORY BOOT GATE` + `§PHASE TRANSITION GATE` sections | `CLAUDE.md` |
| E4 | No infrastructure enforcement — agent could skip mece_plan.md | PreToolUse hook: denies `src/` Edit if `.sessions/mece_plan.md` absent | `~/.claude/settings.json` |
| E5 | No session-start reminder of critical flow | SessionStart hook: injects 5-step flow (Boot→C0-C3→Phase1→Phase2→Phase3) at start | `~/.claude/settings.json` |
| E6 | No per-turn reminder of boot requirement | UserPromptSubmit hook: injects boot reminder every turn via `additionalContext` | `~/.claude/settings.json` |
| E7 | No record of failed fix approaches — agent retried same approach on recurring errors | R9 Step 0: Recurring Fix Detection (signals + prior roadmap check) + `### Failed Approaches:` field in ERR entries + mandatory write before R13 escalate | `CLAUDE.md §R9`, `knowledge/error_index.md` |
| E8 | mece_plan.md from prior session passed PreToolUse hook — agent skipped Phase 1+2 entirely | Session-scoped hook: checks `date -r mece_plan.md` = today, not just file existence | `~/.claude/settings.json §PreToolUse` |
| E9 | Phase 1 had zero infrastructure enforcement — advisory text only | Phase 1 completion marker: `[✓ gather]` must write `.sessions/gather_complete.md`; hook checks both files for today's date | `AGENTS.md §G3`, `CLAUDE.md §PHASE TRANSITION GATE`, `~/.claude/settings.json` |
| E10 | Sub-agents spawned without harness context — no constraints on src/ edits | Harness Context in Sub-agent Prompts: execution agents MUST include `constraints:` block (roadmap check, gather/mece files, index sync, db-gate) | `AGENTS.md §Sub-agent Rules R4` |
| E11 | Agent full-read protected files during Phase 1 G2 (CLAUDE.md 438L, index_files.json 764L, CODING_FAILURE_PATTERNS.md 308L, roadmap 191L) — wasted ~14k tokens | Explicit Never-Full-Load list with Violation signal + Full-Read whitelist (only SKILL.md/small src/sessions OK) | `CLAUDE.md §R5`, `AGENTS.md §Never-Full-Load` |

---

**Token Efficiency Improvements (2026-05-25) ◈**

| T# | Issue | Fix | Files Changed |
|---|---|---|---|
| T-078 | Sub-agent prompt bloat — full context injected per agent | Delegation Contract: constraints=rule numbers, context_files=paths only ≤5, cycle_context ≤5 bullets ≤150c, prompt ≤800 tok | `agent/SKILL.md` |
| T-078 | cycle_context grew unboundedly across cycles | Spawn Context Gate: >2k chars → summarize further | `agent/SKILL.md`, `session_manager/SKILL.md` |
| T-078 | History entries stored full tool output | Hard limits: action ≤20w, result ≤30w, summary_context cap 2k | `session_manager/SKILL.md` |
| T-079 | B3 loaded all context_files at boot (~21k tokens) | B3 loads sections[] ONLY · context_files = on-demand lookup | `AGENTS.md §Boot B3` |
| T-079 | Skill re-read on every TOKEN PAUSE resume | Conditional reload: skip if skill unchanged (compare cached skill_name) | `AGENTS.md §Phase 3`, `session_manager/SKILL.md §2` |
| T-079 | mece_plan.md no size cap | Plan size caps: ≤5 steps, ≤2 verify commands, ≤120 lines total | `mece/SKILL.md` |
| T-080 | B2 always read skill-manifest.json in full (~1,300 tok) | B2 skip if `skill:` in prompt · else grep keywords only | `AGENTS.md §Boot B2`, `skill-manifest.json` |
| T-080 | index_variables.json / index_files.json read in full | Never-Full-Load rule: grep only · NEVER Read these files in full | `AGENTS.md §Index Files` |
| T-080 | skill-manifest used context_files as auto-load list | skill-manifest v2.1: renamed to on_demand_files with `when` + `how` policy per file | `skill-manifest.json` |
| T-081 | G1 identified missing context per-section incrementally | Hybrid front-loaded: G1 scans ALL sections in 1 pass · G2 batch greps · user ask = 1 message max | `AGENTS.md §Phase 1` |
| T-082 | Phase 3 tool results accumulated in context | [L4.5] PURGE step: drop raw tool results after each verify, keep verdict + artifact only | `AGENTS.md §Phase 3` |
| T-082 | Sub-agent R4 section verbose, duplicated CLAUDE.md | R4 section slimmed from 14 → 7 lines | `AGENTS.md §R4` |
| T-082 | CODING_FAILURE_PATTERNS.md grows without bound | CFP Archive Gate: CFP >20 → archive oldest to `knowledge/cfp_archive.md`, keep 15 active | `self_improve/SKILL.md §1` |

---

**CFP Tracking + Harness Doctor Patches (2026-05-26) ●**

| H# | Change | Files Changed |
|---|---|---|
| H1 | CFP fix tracking index: occurrence log, fix history, group classification | `knowledge/index_cfp_fix.json` (new) |
| H2 | R16 logging enhanced: write occurrence + model + date to index_cfp_fix.json | `CLAUDE.md §R16` |
| H3 | Session close Step 0.5 (mece_plan Verify-N audit, fast-only) + Step 0.6 (fix date-compare) | `session_manager/SKILL.md §3` |
| H4 | self_improve §2 Step 2.5: group analysis from index · Step 5: group_summary + recurred flag in emit | `self_improve/SKILL.md §2` |
| H5 | harness_doctor skill — 5 sections: Diagnosis → Audit → Proposal → Gate → Execute | `.agents/skills/harness/harness_doctor/SKILL.md` (new) |
| H6 | skill-manifest: harness_doctor entry + keywords + auto_trigger from self_improve §2.5 | `.agents/skills/skill-manifest.json` |
| H7 | Never-Full-Load: index_cfp_fix.json (full_ok ≤30 entries · grep-only beyond 30) | `AGENTS.md §Never-Full-Load` |
| H8 | INVARIANTS.md I8: index_cfp_fix.json race condition — orchestrator-only write rule | `INVARIANTS.md §I8` |
| H9 | Checkpoint boxes CK1-CK6 at all phase transition points (mece_plan state validation) | `harness_flow_20260526.md` (this file) |

**Phase-Checklist + Token Checkpoint Patches (2026-05-26) ◆**

| W# | Change | Files Changed |
|---|---|---|
| W1 | mece_plan.md Phase-Checklist Template: Phase 0-3 blocks with Files Read tables + TOKEN CHECK commands at every phase boundary | `mece/SKILL.md §Phase-Checklist Template` · `AGENTS.md §Phase 2 M5-M6` · `CLAUDE.md §PHASE TRANSITION GATE` |
| W2 | Plan Format fields: explicit `Tool:` + `Data_Sent: Thai ___ch \| ENG: ___ch` + `Token: ___k` per section — explicit tool name increases agent compliance | `mece/SKILL.md §Plan Format` |
| W3 | Phase 0 persistence rules: [X] items stay on same-session resume · reset only when session_manager creates new mece_plan.md | `mece/SKILL.md §Phase-Checklist Template §Phase 0 persistence rules` |
| W4 | /compact mandatory at task complete: Phase 0 carry-forward (skill_name + CFP_COUNT + task) written to session_handoff.md BEFORE compact · G0 restore step reads it back after compact | `CLAUDE.md §PHASE TRANSITION GATE` |
| W5 | PostToolUse Edit hook: TOKEN CHECK after mece_plan.md Edit — warns agent if ___k fields remain unfilled before sections are marked [X] | `~/.claude/settings.json §PostToolUse` |

**MECE Constraints Block + Size Index + Structure Gate Patches (2026-05-26) ◆**

| X# | Change | Files Changed |
|---|---|---|
| X1 | MECE Constraints Block added to 9 skills: editor/coder/file_manager/variable_manager/session_manager/agent/ascii_flow/harness_doctor/self_improve | `.agents/skills/*/SKILL.md §MECE Constraints Block` |
| X2 | mece/SKILL.md Execution Protocol [S1-D]: copy MECE Constraints Block from SKILL.md into plan section Constraints: field at M5 write | `.agents/skills/harness/mece/SKILL.md §Execution Protocol` |
| X3 | mece/SKILL.md Plan Format + 4 Templates: Constraints: field added per section — required at plan creation | `.agents/skills/harness/mece/SKILL.md §Plan Format §Templates` |
| X4 | AGENTS.md §Phase 2 M5: Constraints: field required — missing Constraints: = incomplete plan | `AGENTS.md §Loop Architecture §Phase 2` |
| X5 | knowledge/index_files.json: size field (lines/th_chars/en_chars/~tokens) auto-populated via symbol_indexer.py update_file_sizes() | `scripts/symbol_indexer.py` · `knowledge/index_files.json` |
| X6 | file_manager/SKILL.md: Entry Format with size object + size field rules + read strategy from ~tokens + MECE Constraints Block | `.agents/skills/knowledge/file_manager/SKILL.md` |
| X7 | mece/SKILL.md Execution Protocol [S1-E]: post-write structure validation — Constraints: count = section count, Phase 0 block present, Tool: count matches | `.agents/skills/harness/mece/SKILL.md §Execution Protocol` |
| X8 | session_manager/SKILL.md Step 0.5d: structure check at session resume — validate Constraints:/Phase 0/Tool: counts | `.agents/skills/knowledge/session_manager/SKILL.md §Step 0.5` |
| X9 | settings.json PostToolUse Write hook: structural validation of mece_plan.md on Write — warns for missing Constraints:/Tool:/Phase 0 | `~/.claude/settings.json §PostToolUse` |
| X10 | mece/SKILL.md Plan Format: Token: ___k fill timing note — fill AFTER section completes, not at plan creation | `.agents/skills/harness/mece/SKILL.md §Plan Format` |

15 CFPs backfilled into index_cfp_fix.json with group classification.
harness_doctor auto-triggered by self_improve §2.5 when recurred_after_fix[] not empty.

---

**TOKEN CHECK Fix Patch (2026-05-27) ◆**
| Patch | Change | Files Changed |
|---|---|---|
| X11 | TOKEN CHECK format: write SESSION_TOTAL from working memory to file BEFORE reading (was: cat only → always read 0). Format: `printf "SESSION_TOTAL: ___k\n" > .sessions/session_tokens.md` (fill ___k from memory) · then `cat`. Label: "(runtime · NOT at plan creation)" | `.agents/skills/harness/mece/SKILL.md §Phase-Checklist Template §Token Check` |
| X12 | CLAUDE.md R1 write events: added "TOKEN CHECK point (write working memory SESSION_TOTAL before reading)" to the write-to-file events list | `CLAUDE.md §R1` |
| X13 | token_tracker/SKILL.md write events: added TOKEN CHECK point as 4th write event with note "do NOT rely on stale file value" | `.agents/skills/harness/token_tracker/SKILL.md §Write Events` |
| X14 | AGENTS.md §M5: TOKEN CHECK runtime note — leave `→ ___k` as placeholder · do NOT evaluate at plan creation · fill at runtime only | `AGENTS.md §Phase 2 M5` |

Root cause: `session_tokens.md` was only written at token pause (>60k) / blocked / completion gate. Most tasks never hit 60k → file always 0 → TOKEN CHECK reads 0 → plan shows 0k throughout. Fix: write working memory value to file at each TOKEN CHECK point before reading.

**Pre-fill + ~Tok Formula Fix Patch (2026-05-27) ◆**
| Patch | Change | Files Changed |
|---|---|---|
| X15 | mece/SKILL.md Phase-Checklist Template header: added ~Tok formula note (`EN_ch × 0.3 / 1000` · `TH_ch × 1.7 / 1000` · NOT `chars ÷ 1000`) + Pre-fill rule (leave ALL `___` as-is at plan creation, fill at runtime only) | `.agents/skills/harness/mece/SKILL.md §Phase-Checklist Template` |
| X16 | mece/SKILL.md completion gate SESSION_TOTAL line: added note "fill ___k from working memory · do NOT hardcode 0k at plan creation" | `.agents/skills/harness/mece/SKILL.md §Phase 3 close block` |

Root cause X15-X16: Agent was computing ~Tok as `chars ÷ 1000` (overcounting 3×) and pre-filling numeric values (0k, 0ch) at plan creation time. Both issues traced to missing explicit formula + missing "leave as placeholder" rule in the template header.

**Boot mece/SKILL.md + Resume Read + Compact Notification Patches (2026-05-27) ◆**
| Patch | Change | Files Changed |
|---|---|---|
| X17 | AGENTS.md Boot B3: Also read `.agents/skills/harness/mece/SKILL.md` offset=31 limit=110 → §Plan Format + §Execution Protocol (S1-A→S1-E) loaded at boot — agent knows required plan fields BEFORE Phase 1; NEVER re-read mid-session | `AGENTS.md §Boot B3` |
| X18 | AGENTS.md Boot resume read: when pending > 0, `grep -n "^\- \[ \]\|^\- \[/\]" .sessions/mece_plan.md` → find first pending item → determine resume phase (Phase 2 vs Phase 3) → Read mece_plan.md at that block (offset=N limit=40) for context | `AGENTS.md §Boot` |
| X19 | mece/SKILL.md Phase 3 close block: /compact line → after compact, agent notifies user: "compact เรียบร้อยครับ session ใหม่เริ่มได้เลย ไม่ต้องรัน /compact เอง" | `.agents/skills/harness/mece/SKILL.md §Phase 3 close block` |
| X20 | Implement docs sync (2026-05-27): harness_flow B3 diagram + Token Tracking formula · 03_config.md B3 (2 locations) · 04_skills.md TOKEN CHECK format · 06_orchestrator.md mece_plan.md schema (full rewrite to Phase-Checklist Template format) | `Implement/03_config.md` · `Implement/04_skills.md` · `Implement/06_orchestrator.md` · `knowledge/harness_flow_20260526.md` |

**compact_state.md — Read-once-per-chat System (2026-05-27) ◆**
| Patch | Change | Files Changed |
|---|---|---|
| X21 | compact_state.md format: 3-line machine-readable file (dt/s/task/cfp · sk/sk_h/mece_h · p1/p2/p3). Written at session close BEFORE /compact (while session memory intact). B1 reads it next task — same-day dt= → [compact-restore] → B2/B3 skip framework file reads → saves ~2.9k tokens | New file: `.sessions/compact_state.md` |
| X22 | AGENTS.md B1/B2/B3 updated: B1 adds compact_state.md check; B2 adds [compact-restore] branch (parse sk=, skip manifest); B3 adds [compact-restore] branch (sha1 check sk_h/mece_h, skip SKILL.md reads if match). Full-Read whitelist: added compact_state.md. Bullet note: saves ~2.9k tokens per session restart | `AGENTS.md §Boot B1-B3 + §Never-Full-Load` |
| X23 | session_manager/SKILL.md Step 5.3: write compact_state.md before /compact (Step 5.5). mece/SKILL.md Phase 3 close + mece_plan.md template: added compact_state.md write checkbox. CLAUDE.md: Boot note + R5 Full-Read + Phase 3 close step 2 added. Implement/03_config.md: B1/B2/B3 updated (both occurrences). harness_flow: Layer 3 + Boot diagram + patch table updated | `session_manager/SKILL.md` · `mece/SKILL.md` · `.sessions/mece_plan.md` · `CLAUDE.md` · `Implement/03_config.md` · `knowledge/harness_flow_20260526.md` |
| X24 | .gitignore: added session runtime files (compact_state.md · gather_complete.md · cycle_*.json · context_compact_*.md) — prevent accidental commits. session_manager MECE Constraints Block: added Step 5.3 entry. harness_flow CK1: added compact_state.md checkbox. Implement/06 Phase 0 table + Implement/08 B1/B2/B3 checklist items updated | `.gitignore` · `session_manager/SKILL.md §MECE Constraints Block` · `harness_flow §CK1` · `Implement/06_orchestrator.md` · `Implement/08_checklist.md` |

---

**Harness Upgrade — claw-code Patterns (2026-05-27) ◇**

| Y# | Change | Files Changed |
|---|---|---|
| Y1 | `[M1.5]` extended reasoning pass added to Phase 2 between M1→M2: dependency_map[] + risk_flags[] + outcome_sketch[] in working memory (≤600 tokens · feeds Cycle grouping + Verify-N) | `AGENTS.md §Phase 2` · `harness_flow §Phase 2` |
| Y2 | OmO Role Assignment table added to Sub-agent R4: Architect(sonnet)/Executor(sonnet)/Reviewer(haiku) · Reviewer spawns at Completion Gate (read-only, PASS/FAIL output) | `AGENTS.md §Sub-agent R4` · `agent/SKILL.md §step 7` · `harness_flow §Completion Gate` |
| Y3 | `[S1-A.5]` added to mece Execution Protocol between S1-A→S1-B: mirrors M1.5 at skill level | `mece/SKILL.md §Execution Protocol` |
| Y4 | M1.5 checkbox added to Phase-Checklist Phase 2 block; Sections[] steps list updated; Cycle grouping annotated with M1.5 source; Multi-skill S1[B] references M1.5 dependency_map[] | `mece/SKILL.md §Phase-Checklist` · `§Sections[]` · `§Plan Format` · `§Multi-skill template` |
| Y5 | `lookup.py` upgraded: `source` field (index_variables/index_files/index_sessions/rag) in all 3 search functions · `RAG_BASE_URL` env var + `_rag_query()` stub · `.claw-rag/` added to .gitignore · CLAUDE.md R5 T0 updated with source + --session + RAG_BASE_URL note | `scripts/lookup.py` · `.gitignore` · `CLAUDE.md §R5` |

---

**Behavioral Contract + File Size Constraints (2026-05-28) ◈**

> Principle: Skills are behavioral contracts, not prose rules. Every skill must answer 5 questions explicitly.

| Z# | Change | Files Changed |
|---|---|---|
| Z1 | **Behavioral Contract** principle adopted from 9arm-skills: every SKILL.md must have 5 elements — Trigger (when to activate) · Refusal (when to HALT) · Workflow (ordered steps) · Output Contract (required output shape) · Routing (next-phase handoff). Prose rules without these = incomplete. | All skill SKILL.md files |
| Z2 | **Multi-surface Verifier**: Reviewer prompt in `mece/SKILL.md` expanded with `task_type` classification → selects surface (CLI / browser / data read-back / adversarial) based on task type before running Verify-N | `.agents/skills/harness/mece/SKILL.md` |
| Z3 | **Formal Closeout Schema**: session_handoff.md Step 4 template now requires: `objective` · `outcome` · `changes[]` · `validation` · `root_cause` · `follow_ups` — explicit output contract for session close | `.agents/skills/knowledge/session_manager/SKILL.md §3 Step 4` |
| Z4 | **Requirements Interviewer upgrade**: G0 gains refusal contract (`[gather-refused]` after ≥2 ignored rounds) + output contract (gather_complete.md must have 5 fields before leaving G0) | `AGENTS.md §G0`, `Implement/03_config.md §G0` |
| Z5 | **Skeptical Reviewer Phase (M4.5)**: optional pre-execution critic gate after MECE plan confirmed · spawns haiku sub-agent · verdict go/revise/reject · revise→M2 · reject→Phase 1 · skip for low-risk/single-file tasks | `AGENTS.md §Phase 2 M4.5`, new `.agents/skills/harness/skeptical_reviewer/SKILL.md` |
| Z6 | **Skill Governance Labels**: `bucket` field added to every skill in `skill-manifest.json` (stable/draft/deprecated) · skeptical_reviewer added to manifest | `.agents/skills/skill-manifest.json` |
| Z7 | **File Role Architecture Doc**: 6-layer model (Persona/Identity/Bootstrap/Routing/Continuity/Operations) mapped to existing harness files · conflict resolution rule: higher layer wins | `knowledge/harness-file-role-map.md` (new) |
| Z8 | **Contract Gap Fixes** (6 skills): file_manager + variable_manager gained Refusal+Workflow+Routing · self_improve gained Routing · token_tracker+token_auditor+ascii_flow gained Refusal+Routing · identity declared persona-only scope | `.agents/skills/knowledge/file_manager|variable_manager|self_improve|token_tracker|token_auditor|ascii_flow|identity SKILL.md` |
| Z9 | **File Size Contract**: editor + coder SKILL.md now enforce ≤200L target for any .md file created/edited · if >200L → split into SKILL.md (contract, ≤200L) + SKILL_detail.md (details) · behavioral contract never split across files | `.agents/skills/coding/editor/SKILL.md`, `.agents/skills/coding/coder/SKILL.md` |
| Z10 | **Checklist updated**: `Implement/08_checklist.md` gains Behavioral Contract completeness check + File Size Contract check | `Implement/08_checklist.md` |

◈ = added 2026-05-28 (9arm behavioral contract audit)

**Skills status post-Z patch:**

| Skill | All 5 contract elements | bucket |
|---|---|---|
| mece · editor · coder · session_manager · agent · harness_doctor · skeptical_reviewer | ✅ complete | stable (skeptical_reviewer: draft) |
| file_manager · variable_manager · self_improve · token_tracker · token_auditor · ascii_flow | ✅ complete (fixed Z8) | stable |
| identity | ✅ scope-declared (persona-only — no executable contract) | stable |

| Z11 | editor (281L) + self_improve (274L) exceeded 200L limit | Split each into SKILL.md (contract ≤200L) + SKILL_detail.md (procedures) | editor/SKILL.md · editor/SKILL_detail.md · self_improve/SKILL.md · self_improve/SKILL_detail.md |

**Status:** All 14 skills within File Size Contract. No pending splits.

---

**Token Formula + MECE Contract + harness_editor Patches (2026-05-29) △**

| ID | Issue / Gap Fixed | Resolution | Affected Files |
|---|---|---|---|
| Y1 | **Token formula wrong**: CHAT_TOTAL re-added system_fixed (7,300) every turn — caused 3× overcount (estimated 37k vs 137.3k actual) | Fixed: `CHAT_TOTAL_n = CHAT_TOTAL_{n-1} + hooks_per_turn + turn_tokens` · system_fixed added once at session start · hooks_per_turn = 1,300/turn · simulation accuracy: 84.5% | `CLAUDE.md §R1` · `token_tracker/SKILL.md §Core Model` |
| Y2 | **token_estimator.py**: no script existed for in-session estimation | Created `scripts/token_estimator.py` — `--test` validation · `--simulate --turns=N` · JSON output · registered in `knowledge/index_files.json` | `scripts/token_estimator.py` |
| Y3 | **MECE plan format missing behavioral contract fields**: plan format had no way to reference skill Output Contract (expected signals) or Refusal Contract (what to do on refusal) | Added `Expected_Traces:` + `Refusal_Path:` to `mece/SKILL.md` plan format block + S1-D fallback rule | `mece/SKILL.md` |
| Y4 | **MECE plan templates missing behavioral contract fields**: existing 4 templates (Bug Fix, New Feature, Refactor, Multi-skill) had no Expected_Traces/Refusal_Path fields | Added both fields to all 4 templates + added new "Harness Skill Editing" template | `mece/SKILL_detail.md` |
| Y5 | **MECE Constraints Block missing** from 5 eligible skills (editor, coder, file_manager, variable_manager, ascii_flow) | Added `## MECE Constraints Block` to all 5 skills — planners can now copy ≤5 lines into plan Constraints: field | `editor/coder/file_manager/variable_manager/ascii_flow SKILL.md` |
| Y6 | **No dedicated skill for harness file editing**: harness edits used generic editor with no mandatory MECE plan gate or doc close requirements | Created `harness_editor` skill: 103L · 5 behavioral contract elements · mandatory MECE plan gate · Step 5 mandatory close (flow + Implement docs) | `.agents/skills/harness/harness_editor/SKILL.md` · `skill-manifest.json` · `registry.md` |

| Y7 | **Bidirectional cross-links**: harness_doctor ↔ harness_editor were isolated — neither knew the other existed | Added cross-link in each Routing section: harness_doctor §5 delegates file edits to harness_editor · harness_editor escalates structural CFP to harness_doctor via `[escalate-to-harness_doctor]` | `.agents/skills/harness/harness_doctor/SKILL.md §Routing` · `.agents/skills/harness/harness_editor/SKILL.md §Routing` |
| Y8 | **index_files.json severely underpopulated** — only 2 entries; 10 core harness files (CLAUDE.md, AGENTS.md, skill-manifest, registry, harness_flow, 4 knowledge indexes, harness_doctor) had no backlink tracking | Added 10 entries with type + description + top-6 backlinks[] each · removed stale `"files": {}` placeholder | `knowledge/index_files.json` |

| Y9 | **Compact handling gaps** (3 fixes): (1) B1 only reset SESSION_TOTAL — CHAT_TOTAL never reset after /compact causing threshold drift · (2) TOKEN PAUSE had no pre-compact state emit — compact summary Section 7 may miss pending tasks · (3) compact_state.md had no section+step fields — resume only knew "in_progress" not which step | (1) B1 now resets both counters on compact-restore OR fresh start · (2) session_manager TOKEN PAUSE emits `[pre-compact-state]` block before asking user · (3) compact_state.md schema extended: section=S<N> + step=<desc> · B2 parses + Boot reply shows Resume: S<N>-step | `AGENTS.md §B1/B2` · `.agents/skills/knowledge/session_manager/SKILL.md §Section 2` · `CLAUDE.md §Phase 3 close` |

| Y10 | **Harness immune system gaps** (3 fixes): (1) harness_doctor/SKILL.md had no `## Workflow` heading + was 242L 🟡 — split to SKILL_detail.md · (2) self_improve/SKILL.md missing MECE Constraints Block + Routing had no harness_doctor escalation path · (3) CFP-005/006/007 had no Detection Signal (first 3 entries pre-dated the pattern) | (1) harness_doctor split 242L→64L 🟢 + SKILL_detail.md 190L + `## Workflow` added · (2) self_improve MECE Constraints Block + escalation route added · (3) Detection Signal added to all 15 CFPs (now 15/15) | `.agents/skills/harness/harness_doctor/SKILL.md` · `.agents/skills/harness/harness_doctor/SKILL_detail.md` · `.agents/skills/harness/self_improve/SKILL.md` · `CODING_FAILURE_PATTERNS.md` |

| Y11 | **1D backlinks → 3-tier topic-graph** — index_files.json only had `backlinks[]` (manual, no semantic discovery, no outgoing links). No controlled vocabulary existed. Agents couldn't determine semantic impact of edits beyond direct importers. | Created `knowledge/topic_registry.json` (20 closed topics + descriptions). Extended all 13 index_files.json entries with `topics[]` + `references[]` + `related[]`. Created `scripts/backlink_analyzer.py` (pairwise topic overlap, --dry-run, --min-overlap flag) → computes 32 related links across 12/13 files. Updated harness_editor Step 4 + CLAUDE.md R8 + AGENTS.md Backlink Rule to enforce 3-tier check before any edit. | `knowledge/topic_registry.json` · `knowledge/index_files.json` · `scripts/backlink_analyzer.py` · `.agents/skills/harness/harness_editor/SKILL.md` · `CLAUDE.md §R8` · `AGENTS.md §Backlink Rule` |

| Y12 | **Post-T-027 index gaps + behavioral contract invocation gap** — 3 new files not indexed (backlink_analyzer.py, harness_doctor/SKILL_detail.md, tool-manifest.json); harness_editor on_demand_files missing topic_registry.json; Implement/04 Step 4 lacked 3-tier sync instructions; CFP-020 gap: agents could edit harness files without invoking harness_editor skill first (no Invocation Gate existed in docs) | Added 3 entries to index_files.json (16 total) · Added topic_registry.json to skill-manifest.json on_demand_files · Added ⚡ Invocation Gate to Implement/04 harness_editor section · Updated Step 4 with topics[]+backlink_analyzer.py · Updated Implement/08 SKILL_detail note (harness_doctor) · Logged CFP-020 (behavioral contract invocation bypass) · Re-ran backlink_analyzer (32→47 related[] links) | `knowledge/index_files.json` · `.agents/skills/skill-manifest.json` · `Implement/04_skills.md` · `Implement/08_checklist.md` · `CODING_FAILURE_PATTERNS.md` |

| Y13 | **Session bootstrap + template gap** — .sessions/ fully gitignored · no template files · self_improve_log.md missing · session_compactor.py missing · identity/SKILL.md used stale .sessions/session_xxx.json schema | Removed harness ignores from .gitignore (dev repo tracks all) · Created docs/session_templates/ (8 files) · scripts/bootstrap_sessions.py · scripts/session_compactor.py · Updated identity/SKILL.md Fatal Constraint · Impl/02_setup.md Step 5 + §11 scope note | `.gitignore` · `docs/session_templates/` · `scripts/bootstrap_sessions.py` · `scripts/session_compactor.py` · `.agents/skills/user/identity/SKILL.md` · `Implement/02_setup.md` |

| Y14 | **Behavioral contract incomplete + REACT loop L5 silent gap** (3 fixes): (1) 7 SKILL.md files missing `## Workflow` (agent/coder/ascii_flow/self_improve/skeptical_reviewer/token_auditor/token_tracker) · ascii_flow 228L 🟡 not split · (2) harness_doctor first invocation: identified CFP-021 (mece_plan sections never marked [X] during execution) · AGENTS.md L5 DECIDE + CLAUDE.md Phase 3 close missing the update step | (1) Added `## Workflow` to 7 skills · ascii_flow split 228L→58L + SKILL_detail.md 187L · 14/15 skills 5/5 behavioral contract · (2) AGENTS.md L5: added `mark mece_plan.md [ ] → [X]` · CLAUDE.md Phase 3 step 0 added · CFP-021 logged · SI-1 written · index_cfp_fix.json first fix recorded | `.agents/skills/*/SKILL.md` · `AGENTS.md §L5` · `CLAUDE.md §Phase 3 close` · `CODING_FAILURE_PATTERNS.md` · `knowledge/index_cfp_fix.json` · `.sessions/self_improve_log.md` |

| Y15 | **REPO_MAP.md severely outdated** — 24+ entries missing across .agents/, .sessions/, knowledge/, docs/, scripts/ · no trigger existed to update REPO_MAP.md when harness files changed | Added 24 entries (114L→158L) · Added REPO_MAP.md as MANDATORY entry in harness_editor Step 5B with explicit trigger condition: "new file / dir / skill created or removed" | `REPO_MAP.md` · `.agents/skills/harness/harness_editor/SKILL.md §Step 5B` |

| Y16 | **Session Health Check missing from Completion Gate** — "Feedback delivered" undefined · no trigger to recommend /compact after task complete | Added Session Health Check block to AGENTS.md §Completion Gate: SESSION_TOTAL thresholds <20k=✅ 20-40k=💡 40-60k=⚠️ >60k=🛑 · Added "Task complete" trigger + [session-health] Output Contract row to session_manager/SKILL.md | `AGENTS.md §Completion Gate` · `.agents/skills/knowledge/session_manager/SKILL.md §Trigger + §Output Contract` |

| Y17 | **CHAT_TOTAL Boot Init Gap (CFP-022)** — B1 wrote `CHAT_TOTAL: 0` at reset; no enforcement re-initialized to system_fixed=7,300 · boot reply showed `Chat: ~0k` instead of `~7k` | B1 printf changed `CHAT_TOTAL: 0` → `CHAT_TOTAL: 7300` · AGENTS.md B1 note + CLAUDE.md B1 note updated to say "sets CHAT_TOTAL=7300 (system_fixed)" | `AGENTS.md §B1` · `CLAUDE.md §Boot` |

| Y18 | **harness_editor Step 5 Docs Close not enforced (CFP-023)** — Output Contract had flow_updated field as descriptive only · no gate blocked [harness-edit-done] when flow_updated=no · T-034/T-035/T-036 all skipped Step 5 | Added Refusal Contract gate: "Step 5 incomplete at task end → [harness-refused] before [harness-edit-done]" · Backfilled harness_flow + Implement/ for T-034/T-035/T-036 | `.agents/skills/harness/harness_editor/SKILL.md §Refusal Contract` · `knowledge/harness_flow_20260526.md` · `Implement/03_config.md` · `Implement/04_skills.md` · `Implement/08_checklist.md` |

| Y19 | **mece_plan.md Phase 0-3 Template never enforced (T-038)** — mece_plan.md used simplified format without Phase 0-3 checklist blocks · no behavioral contract enforcement in M5 step · AGENTS.md M5 had no template reference · mece/SKILL.md S1-E only validated Phase 0 block · 3 conditional close paths (PATH A/B/C) not documented in schema | Rewrote `docs/session_templates/mece_plan_schema.md` with full Phase 0-3 blocks + Phase 3 Close Checklist + PATH A/B/C · AGENTS.md M5 now references template + "no simplified format (CFP-019)" · mece/SKILL.md S1-E validates all 4 Phase blocks (grep -c "## Phase 0-3") · Output Contract updated with template mandatory note | `docs/session_templates/mece_plan_schema.md` · `AGENTS.md §Phase 2 M5` · `.agents/skills/harness/mece/SKILL.md §S1-E + §Output Contract` · `Implement/04_skills.md` · `Implement/08_checklist.md` |

| Y20 | **Thai user-facing close missing from harness_editor Output Contract (T-039)** — harness_editor added Thai close rule to SKILL.md + AGENTS.md but harness_editor Step 5 (Docs Close) was NOT run — harness_flow + Implement/ not updated — CFP-023 recurrence immediately after fix | Added Thai user-facing close rule to `harness_editor/SKILL.md §Output Contract`: after `[harness-edit-done]` → Thai summary mandatory ("งานเสร็จแล้วครับ ✅") · added same rule to `AGENTS.md §Completion Gate` · backfilled harness_flow Y20 + Implement/04 (this entry = Step 5 completion) | `.agents/skills/harness/harness_editor/SKILL.md §Output Contract` · `AGENTS.md §Completion Gate` · `Implement/04_skills.md §harness_editor Output Contract` |

| Y21 | **No migration guide for users on old harness version (T-040)** — users who downloaded older harness version have mismatched tree structure, old index schemas (missing `topics[]`/`backlinks[]`), `chat_tokens.md` instead of `session_tokens.md`, and missing new skills (harness_editor · harness_doctor · session_manager) — no upgrade path documented in Implement/ | Created `Implement/09_migration.md` (298L) with 4-track upgrade procedure: M1 re-format indexes (session_tokens migration · index schema · backlink_analyzer) · M2 re-structure tree (required dirs + session files + mece_plan_schema + detected.md) · M3 update/overwrite skills+config (overwrite list · preserve list · per-skill procedure · new skills to add) · M4 verify (08_checklist) + rollback plan · Added Track C to `Implement/00_index.md` + `02_setup.md §9` · Updated `01_overview.md` intro with Track A/B/C description | `Implement/09_migration.md` · `Implement/00_index.md §Track C` · `Implement/01_overview.md` · `Implement/02_setup.md §9` |

| Y22 | **mece_plan_schema missing section-level metadata + audit signal (T-041)** — Asset Plan project's MECE plans had `Tool:` `Rollback:` `Data_Sent:` `Token:` per section + `### Files Read` tables per phase + TOKEN CHECK as runnable command + `[mece-audit]` signal + user feedback step — our harness mece_plan_schema.md had none of these, making plans harder to audit and rollback; `AGENTS.md M1.5` had no named outputs so reasoning pass produced no structured artifacts | Added `Tool:` `Rollback:` `Data_Sent:` `Token:` fields to section template · Added `### Files Read` table (3-col) to Phase 1+2 blocks · Changed TOKEN CHECK from comment to runtime `cat .sessions/session_tokens.md` command · Added `[mece-audit]` emit + "Ask user" + "Feedback delivered" to Phase 3 Close Checklist · Updated `AGENTS.md [M1.5]` with `dependency_map[]` + `risk_flags[]` named outputs · Added 6 new checklist items to `Implement/08_checklist.md` · Added M1.5 Named Outputs block to `Implement/04_skills.md §Plan Format` | `docs/session_templates/mece_plan_schema.md` · `AGENTS.md §Phase 2 M1.5` · `Implement/04_skills.md §Plan Format` · `Implement/08_checklist.md §M1.5+schema checks` |

| Y23 | **Token waste from verbose Bash output + missing optimization rules (T-042)** — git operations generated 100-200 lines of non-monotonic noise per turn (counted as input tokens); reviewer always spawned as sub-agent even for simple 3-verify tasks (~11k per spawn); no rule to compact at 30k for multi-section tasks; prompt cache TTL (5 min) undocumented — harness had no mechanism to filter output before Claude received it | Created `scripts/safe_run.py` (priority-first chunked filter: THRESHOLD=40 · CHUNK=25 · signal lines never truncated · NOISE_RE removes known-noisy patterns) · Added Reviewer inline threshold to `AGENTS.md §Completion Gate` (≤3 Verify-N + no src/ → inline) · Added compact-at-30k rule to `CLAUDE.md R3` + `AGENTS.md §Completion Gate` · Added cache TTL note (5 min) to `AGENTS.md TOKEN PAUSE` · Created `docs/token_benchmark.md` (3-scenario benchmark: 97.5% reduction on git noise · 73% on long output) · Updated `Implement/04_skills.md` Token Optimization section · Added 3 checklist items to `Implement/08_checklist.md` | `scripts/safe_run.py` · `CLAUDE.md §R3` · `AGENTS.md §Completion Gate + TOKEN PAUSE` · `Implement/04_skills.md §Token Optimization` · `Implement/08_checklist.md` · `docs/token_benchmark.md` |

| Y24 | **CHAT_TOTAL formula ignored compact_size — triangular accumulation undocumented (T-043)** — B1 always set CHAT_TOTAL=7300 regardless of compact summary size (T-041 actual: 86.2k vs harness estimate 26k — 3× undercount); formula comment didn't document triangular accumulation (every turn re-sends full history); PATH B compact_state.md had no compact_size field so B1 couldn't reconstruct baseline | B1 bash command updated: compact-restore reads `compact_size` from compact_state.md → CHAT_TOTAL = compact_size + 7300 (not hardcode 7300) · PATH B step added: compute compact_size = CHAT_TOTAL_pre × 0.30 → write to compact_state.md · CLAUDE.md R1 formula note updated: compact-restore formula + triangular undercount warning (actual ≈ CHAT_TOTAL × 1.5–2×) | `AGENTS.md §B1 + prose` · `CLAUDE.md §R1 CHAT_TOTAL formula` · `docs/session_templates/mece_plan_schema.md §PATH B` |

| Y25 | **CHAT_TOTAL formula still inaccurate after T-043 — compact_size ratio 0.30 too low + system_fixed 7300 hardcoded (T-044)** — Validated against actual API: harness said 26,500 but API showed 39,700 after compact (1.49× gap); root cause: (1) compact_size ratio 0.30 vs actual 0.45 → 9.4k undercount (2) system_fixed 7,300 hardcoded vs measured 11,070 (CLAUDE.md 3k + AGENTS.md 4.5k + skills 3.5k) → 3.8k undercount (3) hooks_per_turn 1,300 over-counted vs actual 700; validated fix: compact_size at 0.45 + sys_fixed dynamic → expected error < 0.5% | Changed compact_size ratio 0.30→0.45 in `CLAUDE.md §R1` + `mece_plan_schema §PATH B` python3 command · Changed system_fixed from hardcode 7300 to dynamic `sys_fixed = (CLAUDE.md + AGENTS.md chars × 0.3) + 3500` in `AGENTS.md §B1 bash` · Changed hooks_per_turn 1,300→700 in `CLAUDE.md §R1` formula block + prose · Updated B1 prose note in `AGENTS.md` | `CLAUDE.md §R1 formula` · `AGENTS.md §B1 bash + prose` · `docs/session_templates/mece_plan_schema.md §PATH B` |

| Y26 | **T-044 formula accuracy validated (T-045)** — After T-044 fixes (compact_size 0.45 + sys_fixed dynamic), actual test: harness CHAT_TOTAL=32,265 vs API=40,600 → error 20.5% (ratio 1.26×). Improvement: 1.49×→1.26×. Remaining gap = triangular accumulation (history re-sent each turn). Per-turn ratio also 1.26× — systematic undercount, not noise. | T-045 test data recorded in `docs/token_benchmark.md` · Recommendation: T-046 — add ×1.3 triangular correction factor | `docs/token_benchmark.md §T-045` |

| Y27 | **CHAT_TOTAL formula still 20.5% off after T-044 — systematic 1.26× undercount on per-turn + compact_size too low (T-046)** — T-045 measured: boot 1.26×, per-turn 1.26× (consistent → both from same chars×0.3 undercount); heavy turn (+18.7k API vs +5.1k harness) shows agentic tool-call amplification. Two-fix approach: (1) turn_tokens ×1.3 to close per-turn gap (2) compact_size 0.45→0.52 (calibrated for post-×1.3 corrected CHAT_TOTAL_pre: CHAT_TOTAL_pre × 1.3 × 0.50/1.30 ≈ × 0.52); heavy-turn drift documented but not formulaically fixed | Changed `CHAT_TOTAL += 700 + turn_tokens` → `700 + turn_tokens × 1.3` · Changed compact_size ratio 0.45→0.52 in PATH B python3 command | `CLAUDE.md §R1` · `docs/session_templates/mece_plan_schema.md §PATH B` |

| Y28 | **Token Efficiency Pack v2 — 4 new harness rules (T-059)** — no rules existed for: (1) output verbosity of routine signals ([post-read]/[✓ written] generating prose instead of 1-line verdict) (2) per-type state-retention policy in L4.5 PURGE (only "drop tool results" with no specifics) (3) tool-result compression before history reinject (>50L results re-sent full every turn = triangular bloat) (4) spike detection for abnormal turn_tokens | Added to `CLAUDE.md §R10`: Tool-Result Compression (>50L → compress to verdict+path+5L) + Output Contracts (terse signals: [post-read]/[✓ written]/[✓ gather] = 1-line max) · Added to `CLAUDE.md §R1`: Spike Detection (turn_tokens > 3× avg → [spike] emit) · Added to `AGENTS.md §L4.5`: state-retention policy table (Bash→DROP · Read irrelevant→DROP · Read relevant→KEEP ≤10L · Edit/Write→KEEP verdict only · >50L→COMPRESS) | `CLAUDE.md §R10 + §R1` · `AGENTS.md §Phase 3 L4.5` |

| Y29 | **T-060 Token System Enhancement Pack (8 sections)** — gaps: (1) no per-turn JSONL telemetry log (2) no cache hit% guardrail (3) only 1 spike alert type (4) SYSTEM_FIXED hardcoded 7300 stale (5) no tool schema serialization rule (6) no rolling summary trigger (7) no cache breakpoint hash check (8) Implement/03_config.md out of sync | Added JSONL logging rule (R1 step 4) · cache guardrail [cache-warn] <60% · 6-type spike detection table · dynamic sys_fixed formula in token_estimator.py · serialization note + session_summary JSONL in AGENTS.md · rolling summary trigger R3 · B1 prefix_hash check · Implement/03_config.md full sync | `CLAUDE.md §R1+R3` · `AGENTS.md §Boot+Completion Gate` · `scripts/token_estimator.py` · `Implement/03_config.md` |

| Y30 | **T-061 Execution Log File System** — gap: tool results >50L still injected into history as compressed text (verdict+5L), causing triangular CHAT_TOTAL accumulation across turns | Changed L4.5 PURGE: OFFLOAD >50L → write full result to `.sessions/exec_log/<uuid>.txt` → inject `[result-offloaded] path=<file> lines=<N>` only · Created `scripts/trim_exec_log.py` (prune 24h/50 files) · Added Completion Gate cleanup step · Synced Implement/03_config.md | `CLAUDE.md §R10` · `AGENTS.md §L4.5+Completion Gate` · `scripts/trim_exec_log.py` · `Implement/03_config.md` |

| Y31 | **T-062 harness_doctor CFP-024 — R16 structural fix** — gap: R16 said "log CFP" with pointer to SKILL.md, but no MANDATORY tool call requirement → agent emitted [self-improve] text without writing CFP file, recurring across sessions | R16 rewritten: MANDATORY tool call (same response) + inline CFP format + verify count after Edit · CFP-024 added to CODING_FAILURE_PATTERNS.md + index_cfp_fix.json | `CLAUDE.md §R16` · `Implement/03_config.md §R16` · `CODING_FAILURE_PATTERNS.md CFP-024` |

| Y32 | **T-064 Token Formula Accuracy Fix** — 3 gaps from knowledge/ analysis: (1) 1.3× multiplier too low vs actual 1.5–2× (2) cache invalidation cascade unmodeled (3) bucket_sys doesn't distinguish schema-drift cost | Changed `turn_tokens × 1.3` → `× 1.5` in CLAUDE.md R1 + Implement/03_config.md · Added cache invalidation note (prefix reset → +sys_fixed spike) · Added bucket_sys schema-drift note in AGENTS.md · Updated token_estimator.py: 1.5× multiplier + --schema-drift flag | `CLAUDE.md §R1` · `AGENTS.md §Phase 3` · `scripts/token_estimator.py` · `Implement/03_config.md` |

| Y33 | **T-066 Token Optimization Pack — 5 gap fixes** — gaps: (1) provider routing not enforced as harness R-rule despite knowledge/provider-routing-strategy.md existing (2) estimated_cost_usd always 0.0 — no formula (3) bucket_retrieval commented out, not tracked (4) no [schema-gate] for mid-session SKILL.md edits (5) telemetry retention only in knowledge/ not CLAUDE.md | (1) Phase routing table added to CLAUDE.md R4 + AGENTS.md Sub-agent Rules: G1/G2→MODEL_LOW, MECE/Execute→MODEL_HIGH, Reviewer→MODEL_LOW (~35% cost saving) · (2) estimated_cost_usd formula (Sonnet/Haiku price tiers) in CLAUDE.md R1 JSONL block · (3) bucket_retrieval uncommented + [ret:Nk] footer display · (4) [schema-gate] rule in AGENTS.md Phase 3 after Stable prefix rule · (5) 30-day retention + trim_exec_log --also-jsonl in CLAUDE.md R1 | `CLAUDE.md §R1+R4` · `AGENTS.md §Sub-agent Rules + Phase 3` |

| Y37 | **T-089 BC Enforcement: Logic Connector Skills** — added Behavior Contract blocks with Pre/Contract/Post/Enforce to all 6 logic connector skills that previously had 0 BCs. file_manager: BC-Index-Return (index_files.json write + [file-index] mandatory before return). variable_manager: BC-Symbol-Return (index_variables.json + symbol_indexer.py + [symbol-index] mandatory before return). coder: BC-Index-Sync-Gate (both [file-index]+[symbol-index] required before roadmap [X]). editor: BC-Error-Index-Gate (ERR-N entry before roadmap [X] on bug fix) + BC-Symbol-Change-Gate (variable_manager trigger on symbol edit). ascii_flow: BC-Invoke-Gate (caller must invoke ascii_flow on .md with box chars) + BC-Ascii-Return ([ascii-done] mandatory). skeptical_reviewer: BC-Output-Format ([go]/[revise]/[reject] mandatory verdict). harness_doctor: BC-Fix-Record ([✓ fix-recorded] + fixes[] append mandatory before [✓ harness-fix]). mece_plan_schema close checklist: knowledge_conflict_checker.py step added for harness_editor tasks. CFP-033 count→2 · CFP-034 count→2 (T-088 recurrences logged). Extended pass: session_manager BC-Self-Improve-Gate (self_improve §1-3 must emit [cfp-tally]/[cfp-skip] before Step 1 file writes). harness_doctor BC-Harness-Editor-Delegate ([delegating] emit + harness_editor [harness-edit-done] required before §5 edits — CFP-021 reinforcement). agent BC-Result-Gate (sub-agent must write cycle_N_<section_id>.json before returning to orchestrator). Total: 11 BCs added across 9 skills. | `.agents/skills/knowledge/file_manager/SKILL.md` · `.agents/skills/knowledge/variable_manager/SKILL.md` · `.agents/skills/coding/coder/SKILL.md` · `.agents/skills/coding/editor/SKILL.md` · `.agents/skills/content/ascii_flow/SKILL.md` · `.agents/skills/harness/skeptical_reviewer/SKILL.md` · `.agents/skills/harness/harness_doctor/SKILL.md` · `.agents/skills/knowledge/session_manager/SKILL.md` · `.agents/skills/coding/agent/SKILL.md` · `docs/session_templates/mece_plan_schema.md` · `knowledge/index_cfp_fix.json` · `CODING_FAILURE_PATTERNS.md` |
| Y36 | **T-088 doc_builder Skill** — new generic skill: analyzes any web app codebase → HTML manual at /doc/manual → Playwright screenshot capture script → PDF hook via pdf skill. 6-phase workflow: §1 Analyze (system map) → §2 Storyboard → §3 Screenshot Plan → §4 Playwright Script → §5 MECE Update → §6 Build HTML. CFP-028 structural fix: Footer BC `Write:` gate added (SESSION_TOTAL must be tool-call-written before footer). CFP-038 new: [fix-required] emitted but harness_doctor not triggered. | `.agents/skills/content/doc_builder/SKILL.md` (new) · `.agents/skills/content/doc_builder/SKILL_detail.md` (new) · `.agents/skills/skill-manifest.json` (doc_builder entry) · `knowledge/index_files.json` (2 entries) · `CLAUDE.md §R1 Footer BC` (Write: gate) · `CODING_FAILURE_PATTERNS.md §CFP-038` (new) |

△ = added 2026-05-29 (T-019 token formula fix · T-020 MECE contract closure · T-021 harness_editor · T-022 cross-links · T-024 index backlinks · T-025 compact improvements · T-026 immune system repair · T-027 topic-graph backlink system · T-028 post-T-027 index sync + behavioral contract clarity · T-029 session bootstrap · T-030 session_compactor + identity fix · T-031 behavioral contract Workflow · T-032 harness_doctor CFP-021 · T-033 REPO_MAP update · T-034 harness_editor Step 5B REPO_MAP trigger · T-035 session-health Completion Gate · T-036 CHAT_TOTAL boot init · T-037 CFP-023 Step 5 enforcement · T-038 mece_plan Phase 0-3 template enforcement · T-039 08_checklist BC + Thai close backfill · T-040 migration guide 09_migration.md · T-041 mece_plan_schema Asset Plan Priority 1+2 features · T-042 token optimization safe_run.py + reviewer inline + compact 30k · T-043 CHAT_TOTAL compact_size formula fix · T-044 token formula accuracy: compact_size 0.45 · sys_fixed dynamic · hooks 700 · T-045 formula accuracy test: 1.49×→1.26× · T-046 formula fix v2: turn_tokens ×1.3 + compact_size 0.52 · T-059 token efficiency pack v2: output contracts + state-retention + tool compression + spike detection)
| Y34 | **T-067 Loop Weight Tracking \& Compact Trigger** — gaps: (1) no LOOP_WEIGHT/TURN_COUNT tracking in session_tokens.md · (2) no PostToolUse hook to auto-increment LOOP_WEIGHT · (3) no [compact-warn]/[compact-required] thresholds based on tool call weight · (4) M1.5 had no proactive compact trigger for complex tasks · (5) mece_plan_schema.md had no /compact checkpoint template | (1) TURN_COUNT + LOOP_WEIGHT fields added to session_tokens.md + B1 printf (S=1/M=2/L=3) · (2) PostToolUse hook in .claude/settings.json auto-increments LOOP_WEIGHT · (3) CLAUDE.md R3 + AGENTS.md Phase 3: LOOP_WEIGHT >30→[compact-warn] >50→[compact-required] with mandatory skill/remaining/resume fields · (4) AGENTS.md M1.5 compact_checkpoint rule: sections≥3 OR sections×6>30 → insert /compact step after ceil(N/2) · (5) mece_plan_schema.md /compact checkpoint template with Pre/How/Post/Verify/Resume | `CLAUDE.md §R1+R3` · `AGENTS.md §B1+M1.5+Phase3` · `.claude/settings.json` · `docs/session_templates/mece_plan_schema.md` |
| Y35 | **T-068 CFP-026 — Conditions Written Without Behavior Contract** — gap: (1) LOOP_WEIGHT/TURN_COUNT triggers written as floating prose without Pre/Contract/Post/Enforce structure (CFP-026 pattern) · (2) C0-C3 Per-Turn Routing had no LOOP_WEIGHT gate · (3) mece_plan_schema.md LOOP_WEIGHT CHECK was shorthand only | (1) CFP-026 added to CODING_FAILURE_PATTERNS.md with Detection signal + Prevention rule · (2) [C0.5] LOOP_WEIGHT gate added to AGENTS.md Per-Turn Routing with full Pre/Contract/Post/Enforce BC · (3) mece_plan_schema.md LOOP_WEIGHT CHECK rewritten as full BC block | `AGENTS.md §Per-Turn Routing` · `docs/session_templates/mece_plan_schema.md` · `CODING_FAILURE_PATTERNS.md` |

| Y37 | **T-092 Hybrid BC Migration** — gap: 23 BCs self-enforced, frequently missed under context pressure → BC density problem. Solution: 3-tier framework (HOOK/BC/Signal Contract/Convention). (1) harness_editor/SKILL.md §BC Selection Guide added — decision tree for tier selection · hard limit ≤6 BCs per file. (2) AGENTS.md 8→4 BCs (C3-topic-switch/M5-write-before-present/Bash-filter/Schema-gate → 1-line Signal Contracts). (3) CLAUDE.md 15→6 BCs (Footer/Cache-guardrail/Index-First/Never-Full-Load/Index-Sync/Topic-Lookup/Active-Fix/Post-Edit-Verify/Escalation → Signal Contracts). Doctor Flow BC kept (critical improvement system). Total: 23→10 BCs (↓57
| Y37 | **T-092 Hybrid BC Migration** — gap: 23 BCs self-enforced, frequently missed under context pressure → BC density problem. Solution: 3-tier framework. (1) harness_editor/SKILL.md §BC Selection Guide added — decision tree (HOOK/BC/Signal Contract/Convention) + hard limit ≤6 BCs per file. (2) AGENTS.md 8→4 BCs — C3/M5-present/Bash-filter/Schema-gate → 1-line Signal Contracts. (3) CLAUDE.md 15→6 BCs — Footer/Cache/Index-First/Never-Full-Load/Index-Sync/Topic-Lookup/Active-Fix/Post-Edit/Escalation → Signal Contracts. Doctor Flow BC kept as full BC. Total: 23→10 (↓57%). | `.agents/skills/harness/harness_editor/SKILL.md` · `AGENTS.md` · `CLAUDE.md` |
| Y38 | **T-093 Enforcement Gap Fix** — 3 gaps identified post-T-092: (A) Read tool had zero machine enforcement — PreToolUse hook only checked Edit/Write/NotebookEdit. (B) mece_plan_schema.md tick line had no gate requiring [✓ written]+Verify-N before marking [X]. (C) C0.5 oversized BC (10L Pre/Contract/Post/Enforce) when a 1-line Signal Contract sufficed. Fixes: (1) settings.json PreToolUse hook: added 'Read' to tool check + PROHIBITED list (6 files: index_variables.json, index_files.json, CODING_FAILURE_PATTERNS.md, master_roadmap.md, INVARIANTS.md, error_index.md) → sys.exit(1) with [gate] never-full-load message. (2) AGENTS.md C0.5 BC (10L) → 1-line Signal Contract → BC count 4→3. (3) mece_plan_schema.md: tick gate note added before both S1 and S<N> tick lines. | `.claude/settings.json` · `AGENTS.md` · `docs/session_templates/mece_plan_schema.md` |
| Y39 | **T-094 BC Selection Guide Expand + Manifest Trigger Fix** — (1) harness_editor/SKILL.md §BC Selection Guide condensed to decision-tree table (180L 🟢) + pointer to SKILL_detail.md. (2) SKILL_detail.md created (114L): decision tree Q1-Q4 · per-tier use/not-use · 14 real-system examples · anti-patterns table · trigger keywords. (3) skill-manifest.json harness_editor keywords 8→22 · trigger updated to include enforcement-rule selection tasks. | `.agents/skills/harness/harness_editor/SKILL.md` · `.agents/skills/harness/harness_editor/SKILL_detail.md` (new) · `.agents/skills/skill-manifest.json` · `knowledge/index_files.json` |
| Y40 | **T-095 Manifest Tool Routing** — 3 gaps: (1) skill-manifest.json had no tool guidance per skill — agent couldn't auto-select tools at M2. (2) mece_plan_schema.md had no Avoid: field or M2 manifest lookup instruction. (3) AGENTS.md M2 had no Signal Contract for manifest grep. Fixes: (1) skill-manifest.json: added `activates_at[]` + `tools{primary,avoid}` to all 17 skills via python3 json.load/dump. (2) mece_plan_schema.md: M2 step expanded with grep command for manifest lookup · `Avoid:` field added to both S1 and S<N> section templates. (3) AGENTS.md: 1-line Signal Contract at M2 — `grep activates_at + tools from manifest (grep only — never Read full manifest) → fill Tool:/Avoid: per section · skip = manifest-routing-miss`. Key constraint: manifest always grep-only at B2/M2 — never Read full 557L file. | `.agents/skills/skill-manifest.json` · `docs/session_templates/mece_plan_schema.md` · `AGENTS.md` |
| Y41 | **T-096 harness_doctor BC Upgrade + BLOCK Gate** — gap: harness_doctor trigger was 1-line bullet ("any recurred_after_fix[] not empty → trigger") — ignored 4× in CFP-037 history. CFP-038 also lacked BLOCK enforcement. Fixes: (1) mece_plan_schema.md §Close Checklist: harness_doctor item → full BC (Pre/Contract/Post/Enforce) — Pre checks [fix-required]/[fix-escalated] OR recurred_after_fix[] → Contract: emit [doctor-invoked] + HALT all close steps until [doctor-verdict] received. (2) CFP-038 Prevention: "MUST emit [doctor-invoked] + BLOCK — no exceptions · 'ไม่ต้องหมอ' = violation". | `docs/session_templates/mece_plan_schema.md` · `CODING_FAILURE_PATTERNS.md §CFP-038` |
| Y42 | **T-097+T-098 Close Gate Hook + Phase 3 Pause BC** — gap: AI could write `phase: done` in active_thread.md without reading §Close Checklist from schema (CFP-037 root cause: no seam forces schema read). Also: Phase 3 execution completing immediately jumped to Close Checklist without pause for user confirmation. Fixes: (1) `.claude/settings.json` PreToolUse hook: close-gate block — Edit active_thread.md with "phase: done" in new_string blocked until `.sessions/.close_checklist_ack` exists. (2) `docs/session_templates/mece_plan_schema.md`: BC-exec-pause block inserted before §Close Checklist — Pre: all S[N] [X] · Contract: STOP → emit [exec-complete] → WAIT user close command → Read schema §Close Checklist → touch .close_checklist_ack → then run checklist items. Both gates enforce the same invariant: schema MUST be read before close, and user MUST confirm. | `.claude/settings.json` · `docs/session_templates/mece_plan_schema.md` |
| Y43 | **T-099+T-100 CFP-039 + kcc bug fix** — T-099: added CFP-039 "Close Checklist Run Without Output Display" — symptom: AI runs checklist silently without per-item table; Prevention: MUST emit table after every Close Checklist. Added to index_cfp_fix.json + cfp_topics.md session-close topic (keywords + cfp_ids updated). T-100: fixed scripts/knowledge_conflict_checker.py L183 AttributeError — `entry_b.get()` called on list value in index; fix: added `isinstance(entry_b, dict)` guard before .get() call. | `CODING_FAILURE_PATTERNS.md §CFP-039` · `knowledge/index_cfp_fix.json` · `knowledge/cfp_topics.md` · `scripts/knowledge_conflict_checker.py` |
| Y44 | **T-101 BC-mece-compact — Force /compact Before Phase 3** — gap: after [✓ MECE] + user confirm, Phase 3 started immediately in same context → LOOP_WEIGHT accumulated from Phase 1+2 carried into Phase 3. Fix: (1) AGENTS.md: BC-mece-compact added after BC-M5-verify — Pre: [✓ MECE] just emitted · Contract: emit [mece-complete] + prompt "/compact แล้ว reply ลุย" + HALT Phase 3 until compact-restore confirmed · Enforce: Phase 3 Edit/Write without [mece-complete] = violation. (2) mece_plan_schema.md: compact note added after Phase 2 TOKEN CHECK as reminder. Key design: user can skip /compact by saying "ลุย" directly → [compact-skipped] emitted (not a violation — user choice). | `AGENTS.md` · `docs/session_templates/mece_plan_schema.md` |
| Y46 | **T-105–107 9arm Framework Upgrades + Over-Prescription Fixes** — T-105: harness_editor/SKILL.md upgraded to full 9arm 8-component standard: Operating Stance (infrastructure mindset + minimal diff + discipline over enforcement + audit before adding), When NOT to Use (4 cases), Signal Contracts replacing BCs, Output Contract labels, Tone Guide, Hard Rules, YAML keywords. T-106: mece/SKILL.md upgraded: Operating Stance (planner not executor + irreversibility first + atomic steps + breadth over cleverness), Prerequisites (4 checklist items), Hard Rules (7 items + quality heuristic), Tone Guide, YAML trigger keywords. Over-prescription audit applied: BC-Validation Gate 6 greps → principle-based assessment (S1-E), S2-A word list → judgment-based approval, skill_auditor Scan C added (prescription detection). T-107: 3 over-prescription fixes in core harness files: (1) AGENTS.md BC-M5-verify 4 grep commands → principle-based structural assessment. (2) AGENTS.md C2 freshness specific grep → intent-based "check for pending sections". (3) CLAUDE.md R16 Doctor Flow "score ≥ 2" / "min 2 terms" → conceptual fit judgment. Plus mece/SKILL.md S2-A Signal Contract: write mece_plan.md before presenting plan to user. | `.agents/skills/harness/harness_editor/SKILL.md` · `.agents/skills/harness/mece/SKILL.md` · `.agents/skills/harness/skill_auditor/SKILL.md` · `AGENTS.md` · `CLAUDE.md` |
| Y53 | **T-115 harness_doctor + self_improve 9arm Upgrade** — gap: both skills missing Operating Stance (no mindset anchor for when to stop diagnosing / what "minimal" means). harness_doctor §1–§2 had no attempt cap (dead loop risk — iterative diagnosis with no exit). harness_doctor had no Hard Rules section and no Tone Guide. self_improve `## Invariants` section covered hard rules functionally but name didn't match 9arm naming → skill_auditor scan miss. Both skills missing YAML front-matter → manifest keyword discovery suboptimal. Design decision: all additions judgment-based (agent decides based on reason, not mandatory gates). Fixes: (1) harness_doctor Operating Stance: 4 bullets — structural surgeon · diagnosis bounded (attempt cap=3) · minimal fix only · recurrence threshold is trigger not fix. (2) harness_doctor Hard Rules: dead loop escape [doctor-loop] attempt:3 HALT · Resume Gate · delegate-all-edits-to-harness_editor · recurred_after_fix thresholds. (3) harness_doctor Tone Guide: Keep/Strip/Format/Prohibited. (4) self_improve Operating Stance: 4 bullets — pattern observer first · one change per session · cooldown rationale · circular dependency hard stop. (5) self_improve `## Invariants` → `## Hard Rules` (rename, §4 Invariants section untouched) + deferred escalation rule: deferred ≥3 on same CFP-N → escalate to harness_doctor. (6) YAML headers prepended to both SKILL.md files. (7) skill-manifest.json keywords[] synced for harness_doctor (+fix-escalated, +recurred_after_fix). Net: both skills now have full 9arm 8-component coverage. Dead loop risk eliminated via bounded attempt cap. | `.agents/skills/harness/harness_doctor/SKILL.md` · `.agents/skills/harness/self_improve/SKILL.md` · `.agents/skills/skill-manifest.json` |
| Y52 | **T-114 Editor Lightweight Fix Path + error_index Schema Extension** — gap: editor mandated full ceremony (roadmap T-ID + symbol_indexer + error_index) for every fix regardless of scope, violating 9arm L108 "Trivial fix → don't manufacture ceremony." error_index had no severity field or decision logic — one-size-fits-all. Design decision: 2-tier workflow (judgment-based, not a gate) — agent assesses 4 criteria at Operating Stance and decides path. Criteria: <3L change · no new symbol · single file · no runtime behavior change. Heavy path remains default; lightweight is the exception. Fixes: (1) editor Operating Stance bullet #5: "Match ceremony to scope" — 4 criteria + lightweight path defined. (2) editor Trigger: lightweight-fix case added. (3) editor Workflow Section 3: "Lightweight Close" sub-section — skip roadmap T-ID · skip symbol_indexer · skip error_index · inline comment `# lightweight fix: <what> · <date>` is the record. (4) error_index.md: severity field (critical/moderate/trivial) · Decision Table (5 rows, judgment-based) · Lightweight Annotation Format · ERR-007 tagged severity:critical. Net: editor now has full 9arm 8-component coverage + ceremony-proportional workflow. error_index now supports graded response matching fix severity. | `.agents/skills/coding/editor/SKILL.md` · `knowledge/error_index.md` |
| Y51 | **T-113 coder + editor + skill_auditor 9arm Upgrade** — gap: all three skills had partial 9arm coverage. editor missing Operating Stance / When NOT to Use / Tone Guide / cross-skill routing / dead loop escape. coder missing "never invent root cause" Hard Rule and judgment-based editor handoff on linter loop. skill_auditor missing Failure Mode Map (understood *presence* of patterns but not *why* each prevents a specific failure class). Design decision: Operating Stance over Hard Rules for failure modes — agent understands reason → judges edge cases vs mechanical checklist. skill_auditor SKILL_detail.md split (258L→186L 🔴→🟢). Cross-skill routing added bidirectionally: coder→editor (linter ≥3 on existing code), editor→coder (new file / architectural scope). | `.agents/skills/coding/editor/SKILL.md` · `.agents/skills/coding/coder/SKILL.md` · `.agents/skills/harness/skill_auditor/SKILL.md` · `.agents/skills/harness/skill_auditor/SKILL_detail.md` |
| Y50 | **T-112 harness_editor ↔ skill_auditor Wiring** — gap: harness_editor had no guidance on when to call skill_auditor before editing a SKILL.md — risk of embedding gaps the edit cannot see (harness_editor reads only the file; skill_auditor reads 9arm framework + manifest + cross-skill links). Design decision: wiring not merge — single-responsibility preserved, judgment-based not a gate. Fixes: (1) Step 1 (Scope Probe): added conditional wiring — if target = SKILL.md, consider loading skill_auditor first; Why/How/Judgment-call all spelled out. (2) Hard Rules: added rule — structural edits (new BC / new section / rewrite ≥10L) → audit first; minor fixes (<3L) → skip is acceptable. Core principle: judgment-based wiring (agent understands the reason, decides when to wire) not mechanical enforcement. | `.agents/skills/harness/harness_editor/SKILL.md` |
| Y49 | **T-110 Skill Manifest Discovery & Match Signal** — audit found 2 gaps: (1) B2 grep used `head -80` covering only skills #1–10/17 — skills #11–17 (agent, harness_doctor, harness_editor, skeptical_reviewer, repo_researcher, doc_builder, project_presenter) were invisible at boot. (2) skill_auditor entry existed at manifest top-level instead of inside `skills{}` block — also invisible to B2 grep. (3) B2 had no match/miss signal — agent could silently proceed with wrong skill or no skill. Fixes: (1) AGENTS.md B2: `head -80` → `head -160` (161 lines covers all 18 skills). (2) B2: added intent assessment contract — [skill-match] on keyword overlap, [skill-miss] forcing function (agent MUST name default + reason, cannot silently proceed). (3) skill-manifest.json: moved skill_auditor from top-level → inside `skills{}` block. Net: 18/18 skills now discoverable via B2 grep + agent must emit decision signal before proceeding. | `AGENTS.md` · `.agents/skills/skill-manifest.json` |
| Y48 | **T-109 mece Close/Handoff Flow Fixes: BC-exec-pause + Close Checklist + Hard Rule 8** — audit identified 3 gaps in mece close flow: (1) BC-exec-pause used keyword matching ("ปิดงาน"/"close"/"จบงาน") — never matched natural user replies in practice. (2) Close Checklist had no pointer to PATH A — agent had to navigate separately to find it. (3) mece/SKILL.md Hard Rules had no post-exec routing guidance. Fixes: (1) mece_plan_schema.md BC-exec-pause Contract: keyword list → intent-assessment with 3 branches (new task/topic → C3 topic-switch · acknowledge/idle → Close Checklist · ambiguous → ask once "มีงานต่อไหมครับ?" · wait 1 turn). (2) Close Checklist: added PATH A pointer item after [session-health] with CFP-025 reminder. (3) mece/SKILL.md: added Hard Rule 8 — post-exec intent check, new task/topic = C3 first, never keyword-match to decide. Core principle: judgment-based over mechanical keyword enforcement. | `docs/session_templates/mece_plan_schema.md` · `.agents/skills/harness/mece/SKILL.md` |
| Y47 | **T-108 Index System Fixes: variable_manager + AGENTS.md** — audit revealed 2 gaps: (1) variable_manager trigger "any symbol" caused agents to skip it for single-file helpers — no real value, just overhead. (2) AGENTS.md Index Sync Invariant row "Symbol created/renamed/deleted" had no judgment criteria — same over-prescription pattern. Fixes: (1) variable_manager/SKILL.md L16 trigger: "any symbol" → "symbol with cross-file dependency"; added schema fields `signature` + `last_modified` to create step; Trigger Conditions clarified with explicit skip conditions for internal-only symbols. (2) AGENTS.md L222 row updated: "Symbol with cross-file dependency: created/renamed/deleted" + skip note. Net: variable_manager is now called only when index has real value (cross-file lookup, rename safety, used_in graph). | `.agents/skills/knowledge/variable_manager/SKILL.md` · `AGENTS.md` |
| Y55 | **T-120 doc_builder/SKILL.md 9arm Behavioral Gap Fix** — skill_auditor audit found 4 behavioral gaps + 3 framework gaps + 3 structure issues. Behavioral gaps (❌ absent): Operating Stance (no mindset anchor — understand-before-building, storyboard-first, role-driven, minimal scope), Prerequisites (Refusal Contract had input gates but wrong format — no checklist, no Why/Missing), Output Tone (no keep/strip/prohibited phrases), Hard Rules (MECE Constraints Block ≠ Hard Rules — planner copy-paste, not runtime imperatives). Framework gaps (⚠️): YAML header entirely missing (B2 manifest routing broken), When NOT to Use had input clarifications not redirects, Workflow had no stop condition. Structure issues: Refusal Contract = input gates (moved to Prerequisites), confirmation gates scattered across §1/§2/MECE Block, §2 Rules over-prescribed. Fixes (121L 🟢): (1) YAML front-matter with name + description + 10 trigger keywords. (2) `## Refusal Contract` replaced with `## Prerequisites` (3-item checklist + Why/Missing) + `## When NOT to Use` (4 cases with redirects to repo_researcher/editor/project_presenter). (3) `## Operating Stance` — 4 mindset bullets. (4) `## Output Tone` — Keep/Strip/Format/Prohibited (3 phrases). (5) `## Hard Rules` — 8 imperative items + quality heuristic (>15 roles = group into families). doc_builder now has full 9arm 8-component coverage. | `.agents/skills/content/doc_builder/SKILL.md` |
| Y54 | **T-119 ascii_flow/SKILL.md 9arm Behavioral Gap Fix** — skill_auditor audit found 4 behavioral gaps + 3 framework gaps in ascii_flow. Behavioral gaps (❌ absent): Operating Stance (no mindset anchor — char-strict discipline, diagram-only scope, minimal-node rule, reference-before-inventing), Prerequisites (no checklist with "refuse without these" — target file path + invoke pattern + diagram intent all required), Output Tone (no keep/strip/prohibited phrases), Hard Rules (no imperative rules + no quality heuristic). Framework gaps (⚠️): YAML description had no trigger keywords, Refusal Contract had no redirects, Workflow had no stop condition. Fixes (114L 🟢): (1) `## Operating Stance` — 4 mindset bullets. (2) `## Prerequisites` — 3-item checklist with Why/Missing per item. (3) Workflow stop condition — palette-missing guard. (4) Refusal Contract — redirects added per skip condition. (5) YAML description — 4 Thai + English trigger keywords. (6) `## Output Tone` — Keep/Strip/Format/Prohibited. (7) `## Hard Rules` — 8 imperative items + quality heuristic (>20 nodes = split). ascii_flow now has full 9arm 8-component coverage. | `.agents/skills/content/ascii_flow/SKILL.md` |
| Y45 | **T-102-A skill_auditor — New Skill Created** — gap: no skill existed to audit SKILL.md files against the 9arm framework. After deep research session on thananon/9arm-skills (2026-06-04), identified 5 missing components across all 18 Harness skills: Operating Stance, Tone Guide, Proactive Offer, Input Sourcing, Quality Heuristic. Created `.agents/skills/harness/skill_auditor/SKILL.md` (197L) implementing full 9arm framework: 8 components, 6 connection types, adversarial Operating Stance, BC over-enforcement detection ([over-enforcement] flag when BC count >2 with no irreversible action), Suggested Additions must be real text not descriptions. Framework reference: `knowledge/9arm-skills-skill-building-framework-2026-06-04.md`. Manifest + index_files.json updated. | `.agents/skills/harness/skill_auditor/SKILL.md` · `.agents/skills/skill-manifest.json` · `knowledge/index_files.json` |
| Y56 | **T-121 session_manager §3 — Close Checklist Pre-Check Gate** — root cause: CFP-037 "Premature Close" recurrence count reached 5. Analysis revealed two structural gaps: (1) session_manager §3 had no pre-check for mece_plan Close Checklist status before Step 0 — §3 Step 0 (CFP review) could run even when Phase 3 Close Checklist items were still [ ]. (2) Bash printf in §3 bypasses PreToolUse hook (hook only fires on Edit/Write tools, not Bash). Fix: added `Close Checklist Pre-Check` Signal Contract to session_manager §3 Workflow before Step 0 — agent must grep mece_plan.md for "status: task-complete" before proceeding; absent = run Close Checklist + PATH A first. File size: 133L → 147L 🟢. | `.agents/skills/knowledge/session_manager/SKILL.md` |
| Y57 | **T-122 harness_doctor Hard Rules — fix_plan Mandate at count≥5** — root cause: harness_doctor Hard Rules permissive on [clean] verdict — no constraint blocked [clean] at count≥5, and "behavioral, not structural" verdict had no count ceiling. Analysis: (1) count≥5 diagnosis should require fix_plan write before any verdict — but Hard Rules only said "priority=HIGH, no deferral" (advisory, not blocking). (2) "behavioral" label valid only at count≤2; count≥3 is systemic by definition — structural seam must be identified even if small. Fix: added 2 Hard Rules after L140: (1) count≥5 → [clean] requires approved_proposal in index_cfp_fix.json first — absent = HALT + write proposal + await confirm. (2) "behavioral, not structural" only valid count≤2 — count≥3 = must run §2 Harness Audit + identify structural seam before verdict. File size: 156L → 158L 🟢. | `.agents/skills/harness/harness_doctor/SKILL.md` |
| Y58 | **T-123 self_improve/SKILL.md 9arm gap fix** — skill_auditor audit found 3 gaps: (1) ❌ Prerequisites absent — no checklist gating before skill starts. (2) ⚠️ §2 Step 2 over-prescription — `grep -cE "recurrence of CFP-[0-9]+"` hardcoded pattern prevented flexible recurrence counting. (3) ⚠️ Operating Stance "Cooldown" principle mentioned in heading but dup analysis found no procedural duplicate — only BC block in §4. Fixes (174L→182L 🟢): (1) Added `## Prerequisites` block with 3-item checklist + Why/Missing (CODING_FAILURE_PATTERNS readable · session_handoff loaded · cfp_boot_count in memory). (2) §2 Step 2 grep-cE replaced with "count recurrences per CFP-N using any method that correctly identifies repeat patterns → frequency table". | `.agents/skills/harness/self_improve/SKILL.md` |
| Y59 | **T-124 harness_doctor/SKILL.md 9arm gap fix** — skill_auditor audit found 3 gaps: (1) ❌ Prerequisites absent — no checklist before diagnosis starts. (2) ⚠️ ## Trigger section (L20-35) duplicates YAML header triggers + embedded Threshold BC belongs in Workflow. (3) ⚠️ Operating Stance "Attempt 3" detail scattered (already in Hard Rules). Additionally: S5 EXPANDED — added Prior-Fix Check BC to §1 Workflow (prior-fix logic: fixes[] not empty → [prior-fix-found] + §3 must emit [approach-diff] before [harness-proposal]). Fixes (166L→162L 🟢 net -4L): (1) Added `## Prerequisites` block (3 items: index_cfp_fix readable · SKILL_detail accessible · CFP target identified with Why/Missing). (2) Removed ## Trigger block entirely — YAML header is canonical source. (3) Trimmed Operating Stance L16 to pointer. (4) Added `Prior-Fix Check BC` after Resume Gate — [prior-fix-found] emit + [approach-diff] required when fixes[]≠[]. | `.agents/skills/harness/harness_doctor/SKILL.md` |
| Y60 | **T-125 harness_editor/SKILL.md 9arm gap fix + T-126 CFP recurrence schema** — T-125: skill_auditor audit found Prerequisites Why already present in all 4 items (no change needed); "File Size Contract dup L142" was a misread — L142 is [scope-probe] signal (different); Hard Rules L226 genuinely duplicated Step 2 MECE gate enforcement → removed. MECE rule scatter: Hard Rules had 1 redundant copy of mece_plan requirement. Fix: removed L226 (1 line). 237L→236L 🟡. T-126: CFP recurrence schema — index_cfp_fix.json CFP-037 updated: status:fixed · approved_proposal set · fixes[{date:2026-06-05, task:T-121+T-122, approach:structural gate + Hard Rule blocking}] written. Additionally harness_doctor §1 expanded with Prior-Fix Check BC (prior-fix-found emit + approach-diff required) — T-124 carried this. | `.agents/skills/harness/harness_editor/SKILL.md` · `knowledge/index_cfp_fix.json` |
| Y61 | **T-127 file_manager/SKILL.md 9arm gap fix** — skill_auditor audit found 2❌ + 6⚠️ + 3 structure issues. Fixes (66L→100L 🟢): (1) ❌ Added `## Operating Stance` (4 bullets: index-only/never business logic · atomic update or skip · caller drives scope · silent drift is the failure mode). (2) ❌ Added `## Prerequisites` (3 items with Why/Missing: index_files.json readable · changed file path provided · caller identity known). (3) YAML header: added `triggers:` (7 keywords) + `activates_at:` fields. (4) Added `## Tone Guide` + `## Hard Rules` (5 rules: no-overwrite-without-read · verify-before-emit · read-backlinks-first · skip-mandatory · no-discovery). (5) Added `## When NOT to Use` (4 redirects: variable_manager · session_manager · agent for bulk · kcc for conflicts). (6) Structure A: removed dup emit line from Output Contract (BC canonical). (7) Structure C: softened hardcoded grep commands → "verify entry exists (any method)". | `.agents/skills/knowledge/file_manager/SKILL.md` |
| Y62 | **T-128 skill redundancy boundary clarification** — redundancy audit found 🔴 file_manager↔variable_manager (near-identical lifecycle — clarified by T-127.4 When NOT to Use redirect) + 🟡 token_tracker/auditor (same file, different purpose) + 🟡 editor/coder keyword overlap (restructure/rename all). Decision: Clarify (not merge) for all 3. Fixes across 4 SKILL.md files: (1) token_tracker Hard Rules — added "Do NOT audit/diagnose" boundary note → token_auditor for anomalies. (2) token_auditor Routing — added "Do NOT track per-turn counts" boundary note → token_tracker for tracking. (3) editor When NOT to Use — added "Bulk restructure ≥3 files → agent/coder; Do NOT use editor for restructuring". (4) coder When NOT to Use — added "Rename all / global symbol rename → editor+variable_manager; Do NOT use coder for renaming". Net: 4 files +1L each. | `.agents/skills/harness/token_tracker/SKILL.md` · `.agents/skills/harness/token_auditor/SKILL.md` · `.agents/skills/coding/editor/SKILL.md` · `.agents/skills/coding/coder/SKILL.md` |
| Y64 | **T-131 variable_manager/SKILL.md 9arm gap fix** — Added: YAML triggers, When NOT to Use, Operating Stance (4 bullets), Prerequisites (Why/Missing), Tone Guide, Hard Rules (6 rules), merged Trigger Conditions duplicate. 75L → 124L · 🟢 zone · 11 sections present | `.agents/skills/knowledge/variable_manager/SKILL.md` |
| Y65 | **T-132 skeptical_reviewer/SKILL.md 9arm gap fix** — Added: YAML triggers, When NOT to Use, Operating Stance (4 bullets), Prerequisites (Why/Missing), Workflow stop conditions, Tone Guide, Hard Rules (6 rules), merged Context Gate. 111L → 160L · 🟢 zone | `.agents/skills/harness/skeptical_reviewer/SKILL.md` |
| Y66 | **T-130 agent/SKILL.md 9arm gap fix** — Added: YAML triggers, When NOT to Use, Operating Stance (4 bullets), Tone Guide, Hard Rules (6). size_guard: passed at 250L exactly · 🟡 zone | `.agents/skills/coding/agent/SKILL.md` |
| Y67 | **T-133 mece/SKILL.md Cycle fan-out syntax support** — Added: Cycle block syntax template (S1-A.5), Hard Rule 7 multi-Cycle exception, On-Demand Cycle trigger row, Refusal Contract Cycle redirects. 176L → 191L · 🟢 zone | `.agents/skills/harness/mece/SKILL.md` |
| Y68 | 2026-06-05 | T-134 | session_manager/SKILL.md | Added triggers/When NOT/Op Stance/Prerequisites/Hard Rules/Tone Guide (6 edits) | 147→185L | 🟢 |
| Y69 | 2026-06-05 | T-135 | token_tracker/SKILL.md | Added triggers/When NOT/Prerequisites/Op Stance/Tone Guide (5 edits, Hard Rules existed) | 124→161L | 🟢 |
| Y70 | 2026-06-05 | T-136 | token_auditor/SKILL.md | Added triggers/When NOT/Op Stance/Prerequisites/Hard Rules/Tone Guide (6 edits) | 90→134L | 🟢 |
| Y71 | 2026-06-05 | T-137 | AGENTS.md + session_manager/SKILL.md | LOOP_WEIGHT gate fix: hook-value-only + preserve-on-close (4 edits) | — | 🟢 |
| Y72 | 2026-06-17 | T-212/D1 | CLAUDE.md + AGENTS.md (prefix) + Implement/03_config.md + Implement/04_skills.md (targets) + scripts/boot_init.sh | Lazy-load harness trim: moved boot-bash (S5), Index-Sync 8-row table (S6 → 03_config §R8), Sub-agent routing table (S7 → 03_config §Sub-agent Rules) out of always-loaded prefix; left 1-line trigger+pointer. Fixed dangling OmO pointer → 04_skills §Orchestration Protocol. scrutinize-reviewed S6+S7. Prefix 38,430→28,096 chars (−26.89%, ≥25% target met) · all safety gates intact | 25,488→15,791 (AGENTS) | 🟢 |
| Y63 | **T-129 CFP-037 structural fix — harness_editor BC-docs-close Close Checklist gate** — root cause: CFP-037 count=6 (premature close). Prior fix (T-121) added gate to session_manager §3 (caller-side) but harness_editor BC-docs-close had no [E] item checking Phase 3 Close Checklist — executor-side gap meant [harness-edit-done] could be emitted with [ ] checklist items remaining. [approach-diff]: prior=caller-side gate in session_manager · new=executor-side [E] item in harness_editor BC-docs-close. Fix: added [E] to Contract "Phase 3 Close Checklist verified — all [X] before [harness-edit-done]" + Enforce line "Close Checklist [ ] remaining = [violation] BC-docs-close-checklist". 236L→239L 🟡. index_cfp_fix.json CFP-037 fixes[1] appended. | `.agents/skills/harness/harness_editor/SKILL.md` · `knowledge/index_cfp_fix.json` |
## Y72 · T-138 · repo_researcher/SKILL.md 9arm fix · 93→131L 🟢
## Y73 · T-139 · project_presenter/SKILL.md 9arm fix · 151→193L 🟢
## Y74 · T-140 · identity/SKILL.md 9arm fix · 74→115L 🟢
## Y75 · T-141 · ascii_flow/SKILL.md 9arm fix · 115→143L 🟢
## Y76 · T-142 · doc_builder/SKILL.md 9arm fix · 122→175L 🟢
## Y77 · T-217 · scrutinize/SKILL.md NEW skill (outsider review + mandatory simpler-way pass · single-source-of-truth) · 0→117L 🟢 · skill_auditor CONDITIONAL→3 gaps fixed · CFP-042 logged
## Y77 · T-143 · self_improve/SKILL.md 9arm fix · 183→194L 🟢
## Y78 · T-144 · identity/SKILL.md 9arm fix · 116→119L 🟢
## Y79 · T-145 · editor/SKILL.md 9arm fix · 226→237L 🟢
## Y80 · T-146 · coder/SKILL.md 9arm fix · 156→164L 🟢
## Y81 · T-147 · mece/SKILL.md 9arm fix · 192→192L 🟢
## Y82 · T-148 · repo_researcher/SKILL.md 9arm fix · 132→137L 🟢

## Y83 · T-149 · CFP decay system · cfp_decay.py + index_cfp_fix.json migration + self_improve/session_manager SKILL.md updated · window_count 90-day threshold 🟢

## Y84 · T-150 · session index schema upgrade · session_indexer.py upgraded (skill/topic/actions/friction/promoted fields) + session_analyzer.py created + promotions.md seeded · knowledge/index_sessions.json rebuilt 🟢

## Y85 · T-151 · Reflection Step + Promotion Loop — added reflection step to mece_plan_schema.md Close Checklist · session_manager SKILL.md Step 0 + reflections.md created · promotions.md filter guide (deterministic→tool / contextual→skill rule) 🟢

## Y86 · T-152 · verify_runner.py created (149L) — parses Verify-N from mece_plan.md · runs bash commands · PASS/FAIL report · AGENTS.md [L4] updated with optional automation call

## Y87
**T-153 · session_close.py — 5-File Close Automation Tool**
- `scripts/session_close.py` created (184L) — argparse · 5-file writer · --dry-run · --task · --next · --chat-total
- `session_manager/SKILL.md` §3 Steps 1-5 → `python3 scripts/session_close.py` (189L 🟢)
- `.agents/tools/tool-manifest.json` — `session_close` entry added
- 9arm audit: PASS (all 8 components)
- Verify: `--help` exit 0 · `--dry-run` lists 5 paths · SKILL.md L114 reference confirmed

## Y88
**T-154 · Code Audit — session_close.py + verify_runner.py (2 CRITICAL fixed)**
- Audit: session_close.py (184L) — 1 CRITICAL (item 12: `--chat-total default=11070` magic number → fixed to `0`) + 1 MINOR functional (item 6: `--session-total` silently ignored → fixed, SESSION_TOTAL now written correctly)
- Audit: verify_runner.py (181L) — 1 CRITICAL (item 13: section-not-found exits 0 → fixed to exit 1 + stderr) + 2 MINOR (items 10, 12: noted only)
- Fixes: 5 line changes in session_close.py · 2 function changes in verify_runner.py (extract_section_lines returns tuple · main() differentiates not-found vs no-Verify-N)
- Verify-3: `session_close.py --dry-run` → exit 0 ✅ · Verify-4: `verify_runner.py --help` → exit 0 ✅ · S99 edge case → exit 1 ✅

## Y89
**T-155 · user-coach Learning System — closed learn-alongside loop**
- `knowledge/user_learning_profile.json` created — JSON proficiency store (global + topics[] + history[])
- `scripts/learning_profile.py` created (~150L) — record + analyze engine (the usage layer)
- `.agents/skills/user/user-coach/SKILL.md` created (78L) — 8-component skill, USE->QUIZ->RECORD->ADAPT
- `.claude/settings.json` — additive UserPromptSubmit hook -> analyze -> [learning-state] each turn
- `.agents/skills/skill-manifest.json` — user-coach entry added (bucket stable, Phase3+manual)
- `.agents/tools/tool-manifest.json` — learning_profile entry added
- Verify: profile JSON valid - analyze clean - SKILL.md 7 sections/78L - settings valid + hook fires - manifest valid

## Y-2026-06-08 · T-156 harness_editor rewrite
- SKILL.md: Workflow -> 5-stage cycle (AUDIT/PLAN/EDIT/CLOSE/CFP) · Implement Map added · Parallel-cycle scan added · L96 grep-bug fixed · dedup close block
- Implement/04_skills.md synced (5-stage + Implement Map · Step5->Stage4)
- audit PASS: 8/8 components · 5 stages · 230L yellow · hygiene clean

## Y90 · T-157 · token-tracking fix — persist-every-turn + consume-once reset marker · SESSION_TOTAL/CHAT_TOTAL written EVERY turn before footer (closes CFP-031 persist gap) · reset now gated by session_reset=armed in compact_state.md (B1 + UserPromptSubmit hook consume ONCE, armed→consumed) replacing buggy date-match that let stale compact_state.md reset mid-task · touched: AGENTS.md B1 · Implement/03_config.md (B1 mirror x2 + R1) · .claude/settings.json hook · CLAUDE.md R1 · mece_plan_schema PATH A/B/C · CFP-031 🟢

## Y-2026-06-08 · T-158 low/medium-model robustness
- routing: AGENTS.md L248 + Implement/03_config -> model x EFFORT (baseline Sonnet low-med; high=planning; mechanical/lookup=low) + MEDIUM tier activated
- mece/SKILL.md: When-NOT 3 refusals inline + Output Spec-Structure consolidated + Tone real guardrails + Routing Type-5 close offer (judgment sweep: 0 found)
- re-audit on Haiku (LOW tier): 6/9 -> 9/9 PASS, followable without inference

## Y-T159 (2026-06-09) · skill_auditor low-tier support
skill_auditor/SKILL.md: added **Tier & effort** block (top of ## Workflow) + 1 Routing line. Default runner = Sonnet @ medium; low-tier (Haiku/parallel spawn) now has bracketed fallbacks for every judgment step — Scan A (literal same-rule overlap only), Scan B (explicit `[tier-low] skipped` — no guess), Scan C (hard-coded string rule), Failure-Mode (Flag:❌-if lines only), Addition Gate (load Q1/Q2/Q3 from SKILL_detail.md → `⚠️ candidate` if unclear). Validated by 2 Haiku dogfood audits: round1 CONDITIONAL (missed Scan A/B + Addition Gate vagueness) → extended fix → round2 PASS, no regression (9+6 tables + Hard Rules intact). 212→218L yellow (SKILL_detail @ref present). 04_skills sync = N/A (no dedicated skill_auditor narrative entry). Stage5 loop-back fired once (round1 incompleteness → re-EDIT).

## Y-T161 (2026-06-09) · harness_editor Stage 3.5 BEHAVIORAL VERIFY
Added an empirical behavioural-verify sub-stage to harness_editor (between Stage 3 EDIT and Stage 4 CLOSE). Rationale: static verify only confirms text landed — it never confirms a fresh model *obeys* the rule. Stage 3.5 = Signal Contract (trigger-gated, not a hard BC): on behavioural edits (BC/gate/signal/sequence) spawn 2 tiers — floor=Haiku (robustness floor per AGENTS.md) + real=Sonnet — each reading ONLY the edited file + a trigger prompt derived from the BC `Pre:` clause (isolation: never the author's intent). A BC is its own test spec: Pre: → trigger, Post:/signal → expected output. Score by signal-grep (deterministic, no LLM judge in v1). Verdict: floor pass → [behave-pass] → Stage 4 · floor fail/real pass → [behave-gap] (rule too subtle) → Stage 5 · both fail → [behave-fail] → Stage 5. k=3 for DB/boot gates. Non-behavioural edit → [behave-skip] (zero overhead). Every run logged to knowledge/behave_test_log.jsonl (feedback capture + replayable regression suite). Files: SKILL.md 230→237L (🟡, stub + Output Contract row + @ref) · SKILL_detail.md 114→133L (full 7-step procedure) · behave_test_log.jsonl NEW (schema header line) · REPO_MAP.md (entry) · Implement/04_skills.md (Stage 3.5 doc line) · index_files.json (+1 entry, 70 keys). 5 signals: [behave-test] [behave-skip] [behave-pass] [behave-gap] [behave-fail].

## Y-T162 (2026-06-09) · harness_editor Stage 3.5 → 3-config effort-aware ladder
Upgraded Stage 3.5 from a flat 2-tier test (Haiku floor + Sonnet real) to a 3-config sequential ladder, cheapest-first with early-exit on first PASS: (1) Haiku (robustness floor) -> (2) Sonnet@medium -> (3) Sonnet@high. Rationale: the effort axis separates "rule unclear" (rewrite) from "rule clear but needs deep reasoning" (acceptable, flag). Sonnet@low was cut (worse than Haiku, per user). Verdict ladder reuses [behave-gap] (NO new signal): Haiku pass -> [behave-pass] -> Stage 4 (early-exit, Sonnet not spawned) · Haiku fail/Sonnet@medium pass -> [behave-gap] -> Stage 5 · only Sonnet@high pass -> [behave-gap] effort:high -> Stage 5 · all 3 fail -> [behave-fail]. KEY CONSTRAINT documented for reproducibility: the Agent tool exposes `model` but has NO effort param -> effort is set via spawn-prompt framing (medium="answer directly", high="reason step-by-step before answering"). Files: SKILL.md (stub L91-96 + Output Contract row, 237L yellow) · SKILL_detail.md (step 3 spawn + step 5 verdict + no-effort-param note, step 6 k=3 per config) · behave_test_log.jsonl (_schema tiers->configs + added effort_of_pass) · Implement/04_skills.md (Stage 3.5 doc line). NOTE: .sessions/mece_plan.md was overwritten TWICE mid-task by a concurrent session (a T-163 KMS plan, then a coder PATH-A clear) — work proceeded from the verified file edits since all deliverables live outside .sessions/.

## Y-T178 (2026-06-12) · posttool_track.py provider-aware token estimate
T-177 fixed the frozen counter but hardcoded session=chars×0.3 / chat=chars×0.3×1.5 — ignoring the per-provider token_formula system (token_estimator.py PROVIDER_MULTS, added T-174). T-178: the hook now imports token_estimator, reads token_formula from detected.md via _load_provider_formula(), and uses PROVIDER_MULTS[provider]['tool'] (anthropic 0.3 / openai 0.27 / google 0.27 / generic 0.35). The ad-hoc CHAT ×1.5 was dropped (chat_delta = session_delta) per user decision — true API context still ≈1.5–2× this lower bound, kept as a doc note. Import wrapped try/except → generic 0.35 fallback, fail-safe preserved (missing/malformed stdin → exit 0, file unchanged). Files: scripts/posttool_track.py (+12L) · CLAUDE.md R1 ×2 · CODING_FAILURE_PATTERNS.md CFP-028 note · knowledge/index_cfp_fix.json (CFP-028 fixes→2) · Implement/03_config.md (hook note) · roadmap T-178-S1..S4. Validation: temp + deployed-file tests — anthropic +138 / openai +124 / file-absent + malformed → no crash. flow_updated=yes.

## Y-T179 (2026-06-12) · audit-engine refactor — shared engine + slim skill_auditor + new harness_doc_auditor
Problem: skill_auditor only audited SKILL.md; no auditor covered the rule/directive .md files (CLAUDE/AGENTS/INVARIANTS/REPO_MAP/Implement) that govern every agent. User chose optimize-first (lean) over bloating skill_auditor. Solution (3 parts): (S1) extracted the file-agnostic audit machinery into knowledge/audit_engine_rubric.md (89L · 8 blocks: Operating Stance, verdict format, Stop Class A/B, Failure-Mode awareness, Tier&effort, Structure Audit, Re-audit, Escalation) — single source of truth both auditors reference. (S2) slimmed skill_auditor/SKILL.md 277→211L by replacing the 8 duplicated engine blocks with @engine pointers, keeping ONLY skill-specific content (9arm 8-component table, 6 connection types, cross-model probe, Addition Gate, handoff); fixed a dangling internal ref. (S3) NEW harness_doc_auditor/SKILL.md (133L) — references the engine + adds an 8-item directive rubric (contradiction, scatter, ambiguous-trigger, dead-ref, token-density, low-tier-followability, gate/BC-correctness two-sided, link-validity); MANDATES grep-walk for Never-Full-Load scope files; declines SKILL.md (→skill_auditor) and src/ (→harness_editor). (S4) registered in skill-manifest.json (21 skills) + index_files.json (engine + new skill) + REPO_MAP.md + registry.md. (S5) verified: MEDIUM-tier comprehension probe = FOLLOWABLE (4/4 from SKILL.md alone); behave dry-run on REPO_MAP.md produced 4 cited findings (2❌ 2⚠️) following the skill exactly; skill_auditor unaffected (211L, 9arm intact, 6 engine refs); both SKILL.md <230L. Note: the behave probe surfaced pre-existing staleness in REPO_MAP.md (incomplete skill list, dead skill-patches/ dir) — NOT fixed here (out of scope · route via harness_editor). flow_updated=yes.

## Y-T180 (2026-06-12) · provider-aware compact-reset + visible [compact-reset] emit
Problem: after /compact CHAT_TOTAL stayed stale (e.g. 178k) so [compact-STOP] fired every turn at a false ceiling. Root: /compact is invisible to the model (CLI intercepts it); only B1 boot recomputed CHAT, and the UserPromptSubmit hook PRESERVED the old CHAT on session_reset=armed — reset logic was split between B1 and the hook and drifted (hook reset SESSION/LOOP but not CHAT). Fix (6 sections): (S1) NEW scripts/compact_reset.py = single source — recomputes session_tokens.md (CHAT=compact_size+sys_fixed, LOOP=0, SESSION=0 if armed-marker|phase:done else preserve), flips session_reset=armed→consumed, prints [compact-reset], always exit 0 (never crashes a hook), pure stdlib, supports --dry-run + --trigger=hook|user-confirm. (S2) wired SessionStart:compact hook in .claude/settings.json → claude-code auto-resets the instant /compact fires (no dependence on re-boot). (S3) AGENTS.md C0 plain-text confirm path ("compact แล้ว"/"compacted"/"เคลียร์แล้ว") for providers with no compact hook + C0.5 stuck-counter guard ([compact-STOP] ~same CHAT ±2k ≥2 turns = didn't-reset bug → recompute, not nag) + B1 single-source note. (S4) CLAUDE.md R1 mandates surfacing the [compact-reset] line + R3 stuck-counter guard note. (S5) CFP-040 (topic:token-tracking). (S6) docs+index: this entry · Implement/03_config.md §Token Tracking · tool-manifest compact_reset_py · REPO_MAP scripts row. LIVE-VALIDATED in production: a real /compact this session fired the SessionStart hook → emitted "[compact-reset] trigger: hook · CHAT_TOTAL→56770 · LOOP_WEIGHT→0 · SESSION_TOTAL→0 · cache: cold" — bug confirmed fixed. flow_updated=yes.

## Y-T181 (2026-06-13) · agent/SKILL.md audit fixes — token-threshold drift removed
Problem: skill_auditor audit of agent/SKILL.md (the orchestrator skill) found token/compact thresholds duplicated 4× (L74 Operating Stance · L116-124 Token Check · L236 Hard Rules · L243 MECE Constraints) AND internally contradictory — old "80-90k → /compact · 60-80k → TOKEN PAUSE" at L118-119 conflicted with the new "CHAT>80k soft [compact-rec] · hard STOP only SESSION>90k OR CHAT>120k" at L123-124. The Step 4.5 cross-model probe confirmed the defect behaviorally: haiku read only the new ceiling · sonnet-med used the old 80-90k rule · sonnet-high saw both + flagged the contradiction → 3 tiers extracted DIFFERENT stop rules = real doc defect, not model error. Fix (3 sections, harness_editor, agent/SKILL.md only · no src/): (S1) collapsed all 4 threshold statements into ONE reference to AGENTS.md §C0.5 (single source of truth); deleted the contradicting old numbers; other spots point to "Token Check block / C0.5" without re-stating numbers (grep 80-90k|60-80k = empty · §C0.5 = exactly 1). (S2) added a close-sequence pointer to Completion Gate: "Reviewer PASS ≠ task closed → run AGENTS.md §Phase 3 Close" (handoff + active_thread + mece PATH A + R8) — previously low/mid tier assumed PASS=done. (S3) disambiguated inline-proceed (probe Q4): added `[agent-inline] reason:fits-main-context` signal, clarified it is a routing choice NOT a refusal (distinct from [agent-refused]). No Implement/ files affected. Validation: all 3 Verify-N passed inline (no src/ → no Reviewer subagent). flow_updated=yes.

## Y-T182 (2026-06-13) · Scan D cross-file dup detection in shared engine + auto-gen rule index
Problem: T-181 exposed that the same thresholds restated across 4 files drifted into contradiction — Scan A/B/C only see WITHIN one file, so cross-file duplication was the blind spot. Fix (4 sections, harness_editor, .md/.json/scripts only · no src/, no DB): (S1) added **Scan D — Cross-File Duplication/Drift** to the SHARED engine knowledge/audit_engine_rubric.md §6 so BOTH auditors inherit one definition; greps a target's named rules/thresholds/literals against the other harness files, flags a value appearing in ≥2 files with NO reference pointer (see/per/§/@/→) as drift; low-tier=exact numeric/§-name match, high-tier=semantic; emit [cross-dup]; close line "A/B/C"→"A/B/C/D". (S2) wired Scan D into skill_auditor/SKILL.md (4 spots incl tier fallback). (S3) wired into harness_doc_auditor/SKILL.md (Structure Audit step + noted Scan D is highest-value for directive files — the classic T-181 drift source). (S4) NEW scripts/rule_indexer.py — scans harness files, extracts R/T/CFP/ERR/BC tokens, classifies defined-vs-referenced, writes rules_defined[]/rules_referenced[] into index_files.json (CACHE only — files stay source of truth, never hand-edit); --dry-run flag; 28 index entries populated (defined=309 ref=493); registered in tool-manifest.json; added own index entry. CODING_FAILURE_PATTERNS.md added to FILE_GLOBS so CFP codes have a 'defined' home (else Scan D false-flags). Design split: Option A (grep-live Scan D = PRIMARY, cannot drift) + Option B (auto-gen index = optional speed cache). Validation: Verify-1..4 PASS · Scan D present in all 3 files (engine=1 canonical, both auditors reference) · knowledge_conflict_checker on audit_engine_rubric.md = candidates expected (engine extracted from skill_auditor) → no_action · index_*.json excluded per AGENTS.md. Known gaps (flagged separate, NOT this task): backlink_analyzer.py pre-existing crash ('list' obj has no .get) leaves related[] empty; 30 rule-bearing files still not index entries (separate hygiene task). flow_updated=yes.

## Y-T183 (2026-06-13) · index-sync reconciler — regen trigger matrix + fail-safe Stop-hook drift net
Problem (user-spotted): T-182 added rule_indexer.py but never defined WHEN it regenerates; more broadly, NO hook enforced index sync at all — every index update relied on the agent remembering R8. Probe confirmed: 7 index/manifest files, 10 generator scripts, 5 wired hooks, but zero index-sync enforcement. Fix (3 sections, harness_editor, .md/.json/.py only · no src/, no DB): (S1) extended AGENTS.md §Index Sync Invariant from a 2-col table to a 4-col matrix — Trigger event (when) · Must update · Regen command (how) · idempotent? — and added the missing rule_indexer row (trigger: any harness rule file edited → python3 scripts/rule_indexer.py) plus a Safety-net note. (S2) NEW scripts/index_reconcile.py — runs at session Stop: git status --porcelain → diff changed/new/deleted paths vs index_files.json keys → emit [index-drift] for missing/stale entries + [index-regen-plan] of relevant idempotent regenerators. FAIL-SAFE contract (mirrors compact_reset.py): always exit 0, swallows all exceptions, never blocks session close. Wired as a 2nd command in the existing Stop hook (.claude/settings.json — appended, write_context_cache kept). Registered in index_files.json (77 entries) + tool-manifest (index_reconcile_py). (S3) added guarded auto-run: in normal mode the reconciler executes the idempotent regenerators (rule_indexer · backlink_analyzer · session_indexer); each wrapped so one failure → "skipped (not fatal)", never aborts the rest or the close; --dry-run + --no-regen suppress execution. LIVE-VALIDATED: reconciler immediately found 10 real drift items (incl the 30-file gap from T-182) + correctly guarded the currently-broken backlink_analyzer (exit 1 → skipped, overall exit 0). Result: rule_indexer now regenerates automatically every session that touches a harness file — the memory dependency is gone. Known deps (separate chips): backlink_analyzer crash fix · 30 files → index entries. flow_updated=yes.

## Y-T190 (2026-06-14) · REPO_MAP full auto-sync — structure mirrors reality, descriptions preserved
Problem: REPO_MAP.md structure (folders/files/counts) was hand-maintained — repo_map_check.py was top-level-only + --append flag-only, and index_reconcile ran it as --dry-run (flag, never applied). So nested-folder changes, per-folder file-count drift, and renames were never auto-tracked; a rename looked like delete+add and lost its curated description. Fix (6 sections, harness_editor, only .py/.md · git-reversible · R14/R15 n/a): (S1) repo_map_check.py recursive scan_repo_recursive() (folders incl nested + per-folder file counts) rendered into a marker-delimited AUTO block <!-- REPO-STRUCTURE:AUTO --> … <!-- /REPO-STRUCTURE:AUTO --> that is fully script-owned + idempotent; IGNORE_DIRS/IGNORE_FILES filter noise. (S2) detect_renames() via `git diff --name-status -M --find-renames=50% HEAD` parses R-lines → (old,new) root pairs; carry_renamed_descriptions() rewrites ONLY the backtick NAME token of the curated Root Files row, never the description prose; git error → [] (degrades to remove+add, the safe direction). (S3) --sync mode = report + carry renames + sync_structure + append_placeholders (TODO rows for genuinely-new items only); carried names dropped from new/stale drift sets to avoid a double-add. (S4) index_reconcile.py repo_map_drift_lines() now runs --sync (auto-apply at Stop hook) instead of --dry-run; fail-safe exit 0. (S5) AGENTS.md §Index Sync Invariant REPO_MAP row → --sync auto-run (structure idempotent · descriptions judgment/never-overwritten) + T-183/T-190 safety-net paragraph amended; R8 rule_indexer.py run. (S6) smoke test PASS: --sync ×2 idempotent (sha equal) · curated descriptions byte-unchanged outside AUTO markers · index_reconcile end-to-end exit 0. 2-layer model: structure=factual=auto-syncable · descriptions=curated=never auto-overwritten. flow_updated=yes.


## Y-T196 (2026-06-15) · Two-layer split — project-agnostic CORE ⟷ swappable domain pack
Problem (user goal): the harness mixed project-agnostic control logic (Boot/routing/loop/token/MECE/CFP/gate-mechanism/index-sync) with coding-specific rules (DB hard-stop, Miniflare D1/Edge/PapaParse, Next.js read-first, coder/editor/variable_manager skills, code_graph/symbol_indexer tools). Future projects (e.g. construction quantity-takeoff) need their own skills/tools without forking the core. Fix (6 sections S0-S5, harness_editor, only .md/.json + idempotent index scripts · no src/, no DB · git-reversible): (S0) NEW domain/_TEMPLATE.md — 6-slot pack schema (paths/domain_gates/critical_rules/framework/skills/tools + co-config Q&A), MEDIUM-tier-fillable with no chat history. (S1) NEW domain/coding.md — coding pack: DB Hard-Stop R15 contract + R14 destructive scope (verbatim from former CLAUDE.md), Miniflare/Edge/PapaParse critical_rules, Next.js + code_graph framework notes, coder/editor/variable_manager skills, code_graph/symbol_indexer tools, co-config Q&A. (S2) CORE cleaned: CLAUDE.md R14 trigger genericized to "active pack ## paths protected:" + R15 renamed DB Hard Stop→Domain Hard-Stop Gate (mechanism kept inline, concrete trigger → pack); AGENTS.md line2 Next.js hint → "see active pack ## framework", Critical Project Rules block → pointer to pack ## critical_rules. MOVE!=DELETE invariant honored (pack written S1 before core stripped S2). (S3) Implement/03·04·08 point to pack; fixed BROKEN 08 checklist row (was grepping AGENTS.md for deleted terms → now greps domain/coding.md headers). Protected model-tier table (03 L188-266) untouched. (S4) Implement/02_setup.md NEW Step 4d — AI co-configures the domain pack WITH the user (5-question Q&A · cp _TEMPLATE.md · auto-detect pre-fills Q4 · all commands inline for LOW/MED followability); Step 2.5b retargeted stack-detection to write pack ## critical_rules/## framework instead of core INVARIANTS §I2. (S5) tagged 3 skills (coder/editor/variable_manager) + 2 tools (symbol_indexer_py/code_graph_py) with "domain":"coding" in skill-manifest.json + tool-manifest.json; ran rule_indexer.py (31 entries) + backlink_analyzer.py (index_files.json) for R8 sync. Validation: all 6 Verify-N PASS · core grep for coding terms = only illustrative "(e.g. coding's…)" signposts remain (kept for LOW/MED followability — label-on-empty-drawer) · JSON valid after tagging · domain/coding.md lists 3 skills+2 tools consistently. 2-layer model: CORE = engine/brakes (never changes) · domain pack = swappable cargo box. flow_updated=yes.

## Y-T202 (2026-06-15) · doc_builder Coverage Gate + cross-role single-source link
Problem (user risk analysis, 7 points): doc_builder could (1.5) ship a manual MISSING real features — the Grounding Gate only blocked INVENTED extras, nothing forced ALL real features to be documented; and (4) the cross-role single-source rule existed but lacked the exact link behavior the user wanted (open new tab + jump straight to the section + pick owner role by most-used). The other 5 risk points were already covered by T-201. Fix (3 sections, harness_editor, only .agents/skills/content/doc_builder/*.md · no src/ · git-reversible): (S1) NEW "## Coverage Gate" in SKILL.md as the inverse twin of the Grounding Gate — §1 builds a full Coverage Inventory (one row per role/route/feature, each with source: + documented_in:), emits [✓ coverage-inventory] items:<N>; a verify-back step before [✓ doc-builder-done] counts documented-vs-inventory and emits [coverage-gap] <item> + halts/asks on any undocumented item; SKILL_detail.md §1-scan got the inventory table template with a documented_in column. (S2) cross-role single-source link spec tightened in SKILL.md (page architecture + §2 rules + Hard Rules) — a feature used by >1 role is written ONCE in its owner role page (owner = most-relevant/most-used, agent decides) with an id="<feature-id>" anchor; other roles get <a href="<owner>.html#<feature-id>" target="_blank"> (new tab + deep anchor jump), link only never a copy; SKILL_detail.md per-role template updated with the id anchor + the target=_blank deep-link snippet. (S3) skill_auditor re-audit (sonnet reviewer) → 0 🔴 on both coverage + single-source dimensions (both 🟢); rule_indexer.py exit 0 (32 entries). Validation: Verify-N all PASS — S1 grep ≥3 (=6) + coverage-gap ≥1 (=1); S2 grep ≥3 (=6). flow_updated=yes.

## Y-T205 (2026-06-16) · harness_editor — auditor-bar + minimal-output design principles made explicit
Problem (user audit request): harness_editor (the project's skill-creator) ran skill_auditor as a process step but never STATED, as governing Operating Stance rules, that (Q-A) every skill it writes must pass the auditor's bar so the agent executes simply+directly, and (Q-B) the produced skill must itself be minimal/non-bloated. Both verified weak (implied/scattered) by a neutral skill_auditor sub-agent + manual grep/sed. Fix (harness-only · .agents/skills/harness/harness_editor/SKILL.md · git-reversible · no src/ · R14/R15 n/a): (1) two new Operating Stance bullets — "Write for the auditor's bar" (9arm framework + knowledge/audit_engine_rubric.md stance = design target, not post-hoc; no inferred/contradicting step) + "Minimal output, not only minimal diff" (smallest scope, reuse Operating Stance/Signal Contract/Hard Rules over parallel sections, complexity = inference burden). (2) Stage 3 targeted-edit rule cross-linked to Hard Rules sec1 (kills in-file restatement drift · Scan A). (3) MECE Constraints Block got a canonical-source pointer (Workflow Stage 1-3 + Hard Rules · mirrored in Implement/04_skills.md) to stop signal/threshold drift (Scan C/D). Deferred by user choice (spawn_task chip): doc_builder 2 remaining + harness_editor Output-Spec-labels + Type-6 input-contract. Verify: grep Q-A=1 · Q-B=1 · drift-pointers=2 · 240L (yellow <250 ok) · rule_indexer exit 0. flow_updated=yes.

## Y-T206 (2026-06-16) · harness_editor — single front-door rule for new project skills
Added one Operating Stance bullet: the bundled `skill-creator` plugin may scaffold a draft ONLY; every project skill must pass through harness_editor (auditor bar + R8 index wiring: backlink · index_files · skill-manifest · REPO_MAP) before it counts. Reuse the plugin's ideas (progressive disclosure · structural validate · description tuning), never its files — it is global, overwritten on update, and not wired to this project's index/gates. Closes the open back-door the bundled creator otherwise left.

## Y-T213 (2026-06-17) · D2 cheap-model delegation tier — qwen-agent ported to Haiku
Goal: route already-planned, mechanical Phase-3 MECE sections to Haiku (model_cheap) instead of Sonnet/Opus, keeping expensive models for planning+judgment — the 9arm qwen-agent offload pattern. Key insight (user): a passed MECE section IS the standalone delegate prompt (tight scope + absolute paths + Verify-N + minimal context) → no new "is this menial?" classifier needed. Fix (6 sections, harness_editor, .md/.json only · no src/ · git-reversible): (S1) detected.md anthropic profile += `model_cheap: claude-haiku-4-5` (resolved by name, never hardcoded by skills). (S2) R4 routing: NEW MODEL_CHEAP row in Implement/03_config.md (mechanical MECE section → model_cheap @ low · self-verify + retry-once + escalate · never planning/debug/security/R14-R15) + 1-line pointers in CLAUDE.md R4 and AGENTS.md §Sub-agent Rules. (S3) NEW .agents/skills/coding/delegate/SKILL.md (79L) — ported qwen-agent structure to house style, swapping CLI claude-9arm → Agent tool with model=model_cheap: frontmatter+triggers · Sections block (Eligibility Gate / Build & Spawn / Self-Verify & Escalate) · When/When-NOT · 3 Prerequisites · 7-step Workflow · Hard Rules · Refusal+Routing contracts. Self-verify always mandatory; one retry then escalate to MODEL_MEDIUM + [delegate-escalated]; resolve model id from detected.md. (S4) skill-manifest.json delegate entry (floor:haiku · bucket:in-progress · keywords [delegate/offload/cheap model/haiku/mechanical section/menial] · activates_at Phase3-L1). (S5) R8 sync — index_files.json entry added + backlink_analyzer regenerated related[] + repo_map --sync. (S6) end-to-end live verify 3 cases: (a) real mechanical task → Haiku spawn → self-verify grep PASS → [delegate-done]; (b) Verify-N intentionally unsatisfiable → fail → auto-retry once → fail → [delegate-escalated]; (c) src/db/ + judgment section → [delegate-refused] reason R15 db-gate (no spawn = correct). Validation: all 6 Verify-N PASS · skill_auditor 9arm components all present · doctor-gate clean. Scope note: this is T-213/D2 ONLY (delegation tier); the 4-behavioral-pattern port + 21-skill audit is the separate T-214/D3. flow_updated=yes.

## Y-2026-06-18 · T-214 (D3) Skills-as-discipline upgrade
- NEW skill: debug (P3 full disproof-first + breadcrumb ledger · load-on-demand) registered in skill-manifest.json
- P3 short-form folded into R9 (CLAUDE.md + Implement/03_config.md) — debug skill = deep, R9 = always-on reflex (two delivery points, not dup)
- P2 simpler-way pointer (refs scrutinize, never re-copies) -> 9 skills via S3/S4/S5 clusters
- P1 refuse-without-required-inputs gate -> harness_doc_auditor, project_presenter, user-coach (repo_researcher already had it)
- P4 recite-verbatim -> harness_editor Stage-2 PLAN gate
- affected Implement/: 03_config.md (R9). flow_updated=yes
- scrutinize-review polish (2026-06-18): item 1 project_presenter halt signals unified -> [presenter-refused]; item 2 debug P2 marked intentional (not copy-drift); item 3 P2-consolidation = leave-as-is (user chose B · 1-line pointer correct at point-of-use)

### Y-entry 2026-06-18 · T-215 bucket the skills
- 24 skills moved from flat `.agents/skills/<name>` into 5 buckets: harness/(11) knowledge/(4) content/(3) coding/(4) user/(2) + empty in-progress/ deprecated/
- S0 fixed the skill-discovery glob in scripts/index_reconcile.py + scripts/rule_indexer.py (added `*/*/SKILL.md` pattern) so nested skills resolve — prevented false-green verification (scrutinize-caught blocker)
- all path refs rewritten: skill-manifest.json, AGENTS.md:22 mece boot line, registry.md, index_cfp_fix.json verified_by strings, REPO_MAP.md, Implement/*.md, knowledge auto-regen
- affected Implement files (path literals updated): 02_setup.md, 03_config.md, 04_skills.md, 06_orchestrator.md, 08_checklist.md
- flow_updated=yes

### Y-entry 2026-06-18 · T-215 post-close scrutinize review
- scrutinize verdict: PASS-WITH-NITS. Caught 3 refs my own grep sweep missed (they used `@.agents/skills/<name>/SKILL_detail.md` notation INSIDE the moved files):
  - FIXED .agents/skills/coding/editor/SKILL.md:134 → @.agents/skills/coding/editor/SKILL_detail.md
  - FIXED .agents/skills/coding/agent/SKILL.md:244 → @.agents/skills/coding/agent/SKILL_detail.md
  - FIXED AGENTS.md B3 boot template (L19+L21): flat `<skill_name>` → `<bucket>/<skill_name>` + mece shorthand → harness/mece
- LESSON: bucket-move verify greps must include the `@.agents/skills/...` cross-link notation, not just bare path strings — a SKILL.md's self-reference to its own SKILL_detail.md is easy to miss.
- left as benign nits: settings.local.json:6 (points at a DIFFERENT project "Asset Plan", not this repo) · REPO_MAP.md:121 (prose template example) · skill-manifest.json registry.md (legitimately at flat skills root — not a skill)

## Y-T221 (2026-06-22) · token harness — signal-box (4-box) PRIMARY, char-estimate demoted to secondary
- WHAT: elevated a 4-boolean signal count (signal-box) to the PRIMARY compact-recommendation trigger; demoted the char-based SESSION/CHAT estimate to secondary display + hard-ceiling backstop only. Ports qwenchance's 4-box model (9arm comparison §3).
- 4 booleans (computed in the UserPromptSubmit hook): turns≥20 · files_read≥5 · long_outputs≥3 · steps_left≥3 · N≥2 → [compact-rec] strong; N<2 → at most a light [compact-note].
- COUNTERS: posttool_track.py increments FILES_READ (per Read tool) + LONG_OUTPUTS (tool output >8000 chars); TURN_COUNT revived — increments ONLY on real user turns (UserPromptSubmit), never subagents → drift-proof vs the pollution that caused CFP-041. All writers of session_tokens.md (incl the inline reset printf in settings.json — the 8th, easy to miss) carry the new fields.
- DOCS flipped to signal-box=PRIMARY: CLAUDE.md R3 · AGENTS.md C0.5 · Implement/03_config.md (C0.5 BC + R3 table + pre-check bullets) · Implement/07_platform.md field list.
- CFP class retired: CFP-028/031/037/041 each marked "superseded/mitigated by T-221" (a boolean can't drift like a running estimate).
- PROCESS LESSON (caught by user mid-close): this task ran under the `agent` skill, NOT `harness_editor` → the Step-5 docs-close (flow Y-entry + affected Implement/ sweep) was initially skipped. = live recurrence of CFP-023 (Step-5 skip) + the B2 skill-routing miss. Backfilled same turn. Rule reinforced: a harness-behavior change MUST route to harness_editor at B2 so the Step-5 gate arms.

## Y-T235 (2026-06-22) · token harness — CFP-041 fixed at ROOT (subagent guard in posttool_track.py)
- WHAT: T-221 only MASKED CFP-041 (added drift-proof signal-box on top of the polluted estimate). T-235 fixes the ROOT: the PostToolUse hook (`scripts/posttool_track.py`) was accumulating a SUBAGENT's internal tool I/O into the MAIN `.sessions/session_tokens.md`, inflating SESSION/CHAT/LOOP_WEIGHT/FILES_READ → false ceilings.
- DETECTION (proven, not assumed): env does NOT distinguish a subagent — it shares `CLAUDE_CODE_SESSION_ID` + byte-identical env (`CLAUDE_CODE_CHILD_SESSION=1` is set in BOTH; it means "Claude Code is a child of the desktop app", NOT "this is a subagent"). The handoff's proposed env/marker approach was INVALID. Instrumented the hook stdin → the PostToolUse payload carries `agent_id` + `agent_type` ONLY on subagent tool calls; main-context calls (incl. the Agent *wrapper*, which SHOULD count) omit them.
- FIX: 4 lines in posttool_track.py, right after stdin parse: `if data.get('agent_id'): raise SystemExit(0)`. Fail-safe (early exit, never raises into the tool call). The Agent wrapper still counts in main — correct, its summarized result enters main context.
- PROOF (integer, not estimate): spawned a subagent doing 3 Reads → main FILES_READ stayed 9→9 (would be 12 before) · LOOP_WEIGHT 33→37 = +4 (main calls only; subagent +0). Decisive because LOOP_WEIGHT/FILES_READ are exact integers, not char estimates.
- DOCS swept (Step 5): the stale caveat "subagents pollute/overwrite session_tokens.md" was now FALSE → updated in CLAUDE.md (R1+R3) · AGENTS.md (C0.5 ×2 + close-gate) · Implement/03_config.md (×3) · Implement/06_orchestrator.md. New truth: the LIVE grep of session_tokens.md is reliable on ANY turn (not just main-context); only the [token-state] snapshot's ≤1-turn lag remains. CFP-041 marker flipped T-221-masked → T-235 root-fixed.
- METHOD WIN: scrutinize (run before this task) rejected the handoff's env approach AND found the simpler root fix. Ran under harness_editor this time (the T-221 miss) — Step-5 gate armed correctly.
- FOLLOW-UP (deferred, own pass): now that the estimate is trustworthy again, re-evaluate whether the 4-box signal-box can be simplified (drop noisy steps_left). NOT done here.

## Y-T223 (2026-06-22) — Lean-pass: harness is LEAN-BY-DESIGN; cross-cutting dedup REJECTED as a class
- TASK: audit all 24 SKILL.md vs mattpocock writing-great-skills (kill no-ops/dedupe/leading-words). Ran under harness_editor.
- METHOD: 3 parallel read-only survey agents flagged big cross-cutting "duplication" (Hard Rules restate stance · When-to-Invoke echoes frontmatter · Simpler-Way block copied 10×). THEN read the actual file contents before deleting.
- FINDING (load-bearing): the survey SYSTEMATICALLY OVER-FLAGGED. Every "duplicate" checked turned out to be intentional design, NOT sediment:
  · Simpler-Way blocks = intentional always-on reflex pointers (each carries an explicit "scrutinize owns the full pass; never re-copy" note; debug's wording is deliberately different). Not copies of content — pointers by design.
  · "Hard Rules" vs "Operating Stance" = the 9arm framework's intended TWO-LAYER split (stance=why/rationale · rules=terse imperative enforcement). self_improve's Hard Rules are distinct constraints (INVARIANTS, one-rule-per-session, escalate-at-3), NOT restatements. Deleting them = real behavior loss.
  · body "When to Invoke" ADDS value over the frontmatter `triggers:` — bilingual Thai phrases + semantic conditions + proactive triggers NOT in frontmatter (identity, repo_researcher proven). Deleting = lose Thai routing.
- RULE ESTABLISHED (so it is not reopened — .out-of-scope style): a CROSS-CUTTING MASS-DEDUP lean-pass on the harness is REJECTED. The apparent duplication is intentional layering / bilingual triggers / reflex pointers / progressive-disclosure ladders. Forcing deletions loses nuance and CONTRADICTS harness_editor's own "don't rewrite working sections — no upside, only risk" stance.
- WHAT WAS ACTUALLY SAFE: ~1 micro-edit total. coding/editor `Quality gate` bullet repeated rung-3 of the `Attempt 3 = shift layer` rule above it (+ a no-op rung-1) → trimmed to its unique rung-2 content + a pointer. That is the ENTIRE clean-dedup yield of 24 skills.
- REAL LEVER (not dedup): the harness IS heavy (two-signal 9arm+mattpocock), but the weight is STRUCTURAL (24 skills, rich contracts), not cheap duplication. The high-value lean move is the SKILL MERGES, which are risky (rewrite manifest+routing) → kept as separate tasks w/ user sign-off: M1 token_tracker+token_auditor · M2 skill_auditor+harness_doc_auditor · M3 variable_manager+file_manager → index_manager · M4 doc_builder+project_presenter · M5(weak) agent+coder.
- ALSO FOUND (own task): token_auditor contradiction bug — Operating Stance says "finds drift not cause" but §Actions item 2 hard-edits other SKILL.md (self-healing) bypassing the harness_editor gate. Flagged, not fixed here (user chose record-only).
- METHOD WIN: reading actual content before deleting (the RULE-SURVIVAL CHECK) caught a survey that would have broken Thai triggers + enforcement rules. Read-only surveys over-flag duplication — always verify against the real file.

## Y-T241 (2026-06-22)
TASK: Fix token_auditor stance/action contradiction (found in T-223 audit).
BUG: Operating Stance L35 + Hard Rule L101 say "audit finds drift NOT cause · read-only", but §Workflow/§Actions#2/§OutputContract/§Sections-steps/§Log-template/§Routing told it to self-heal = hard-edit ANOTHER skill's SKILL.md. Two defects: (a) does the cause-fixing its stance disclaims; (b) bypasses the harness_editor gate (only harness_editor edits harness SKILL.md under phase-gate + minimal-diff).
SCRUTINIZE (user-requested, pre-execution): Outsider Pass flagged the planned "defer to harness_editor" handoff had no named destination. Simpler-Way Pass found the auditor ALREADY emits `[audit-finding] · Rule:R<N> · Skill:<name>` + logs to optimization_logs.md — that IS the handoff. Verdict: DELETE the self-heal machinery, don't rewrite it into a new mechanism. Dependency grep confirmed NO other skill relies on auditor self-healing → safe to delete. Plan revised from rewrite→delete (smaller diff, reuse existing flag).
FIX (6 minimal edits, all making auditor flag-only): L18 Sections-steps · L52 Workflow · L80 log-template ("Rule injected"->"Rule recommended") · L83-84 Actions#2 (Self-Healing -> Flag Only) · L110 Output Contract · L122 Routing. UNTOUCHED: L35 stance + L101 read-only rule (now consistent).
METHOD WIN: Verify-N (grep for leftover "self-heal|inject") caught 3 spots the plan's "3 edits" estimate missed (L80, L122, L18) — the audit-then-verify loop, not the plan, found full coverage. R8 rule_indexer regen ran (35 entries).
RULE REINFORCED: a skill's stated Operating Stance is the contract; any §Action that contradicts it is the bug, not the stance. Fix by removing the rogue action, not by softening the stance.
flow_updated=yes

## Y-T233 (2026-06-22)
TASK: T-233 — verify-then-trim the `Tier` sub-field from the R5 [pre-read] signal (HOT PATH, every Read).
VERIFY-FIRST (the whole point): grep scripts/ + .claude/ + repo confirmed ZERO code consumers of `Tier:` from [pre-read] (the only "Tier" in scripts/ is code_graph's unrelated Tier-A/B import graph). GAP claim proven -> proceed (not rejected).
USER DECISION (AskUserQuestion): chose "uniform drop" over "minimal split" — drop the emitted Tier label EVERYWHERE rather than create two [pre-read] formats (split would add a moving part, violating uniformity).
KEY DISTINCTION: editor's 3-Tier oracle (T0 lookup.py -> T1 index -> T2 grep -> T3 full) is a load-bearing LADDER discipline. But the ladder is enforced by the prose "emit gate -> Read -> STOP, do NOT go to Tier N", NOT by printing `Tier: T<N>` in the signal. So the LABEL is ceremony; the LADDER stays. Dropped label, kept all ladder prose (5 prose hits intact in editor SKILL_detail).
EDITS: 12 spots / 8 files. Core: CLAUDE.md:51, AGENTS.md:126 (Edit). Mirrors+examples via zsh-safe perl (explicit file list — NOTE: zsh does NOT word-split unquoted $VAR, first perl run failed treating $FILES as one filename; no damage, redone with explicit list): Implement/03,04,06, editor/SKILL.md + SKILL_detail.md, CODING_FAILURE_PATTERNS.md (CFP-034 symptom). Odd formats via Edit: Implement/08_checklist (T0-emit check -> lookup-first check), docs/harness_health_checklist:186, + harness_doctor/SKILL_detail:134 straggler caught by repo-wide Verify.
RESULT: [pre-read] is now `Target · Line` (+ [post-read] Verdict) everywhere. Index-first discipline intact (Target+Line+Verdict prove you located precisely + judged relevance).
DELIBERATELY NOT EDITED: dated journal ASCII diagrams (harness_flow_20260525:213, _20260526:250) + the T-233 roadmap task description — these are historical/point-in-time records; rewriting them would distort history. Live spec is authoritative.
METHOD WINS: (1) scrutinize/verify-first prevented a blind cut; (2) repo-wide grep Verify caught 1 spec straggler (doctor) the file-list plan missed — same audit-then-verify lesson as T-241; (3) zsh word-split gotcha surfaced + handled (dry-run count caught the no-op before trusting it).
flow_updated=yes

## Y-T230 (2026-06-22) — surgical-change CORE: §Surgical Scope + [scope-creep] gate in mece_plan_schema.md · 1-line Hard Rule in harness_editor+editor+coder · AGENTS Completion-Gate pointer · reused File: field · baseline fix from dogfood · flow_updated=yes

## Y-T234+T231+T232 (2026-06-22) — Karpathy efficiency hot-path trims (3 tasks, one session)
TASK: close the 3 remaining Karpathy-study spin-offs — all touch the always-loaded hot path.
SCRUTINIZE-FIRST (the win): before editing, the plan was grilled twice. Two simplifications found that the raw roadmap missed → halved blast radius.
T-234 (S1): AGENTS.md Boot B2 — added ONE tie-break sentence to the keyword-match ELSE branch: >1 skill matches → prefer best activates_at fit → still tied → pick last in manifest order + emit [skill-match-tie]. No new judgment, removes the multi-match stall.
T-231 (S2): Implement/03_config.md §R1 — RE-FRAMED (not deleted) the "each turn" steps: accumulation relabelled HOOK-OWNED (posttool_track.py), agent residual = read [token-state] → JSONL → R3 → spike → cache-warn → footer. SCRUTINIZE catch: deleting step 2 wholesale would have lost the reset policy (PATH A/B/C) — verified posttool_track.py writes ONLY session_tokens.md (NOT JSONL/spike/cache-warn), so roadmap's "hook does JSONL/spike" claim was WRONG → reframe, keep reset policy + JSONL + spike + cache-warn as agent residual.
T-232 (S3): AGENTS.md C0+C0.5 — collapsed two dense every-turn blocks into a crisp 3-question gate (Q1 compact-confirm → reset+continue · Q2 complaint → R16 · C0.5 token-threshold gate). KEY: kept the labels C0/C0.5 so CLAUDE.md "C0→C0.5→…" pointer stays valid (zero CLAUDE.md touch). Rare-branch detail (Thai phrase list, c0_resolved, stuck-counter guard, provider-aware reset, CFP-041/T-235) pointed to Implement/03_config.md §Per-Turn — VERIFIED present there (L75-76,136-138,716) before pointing, so nothing lost.
SCRUTINIZE MODEL (user-confirmed): 03_config = on-demand reference (loaded only when a rule's full spec is needed) · AGENTS.md = always-loaded, parsed every turn. So trimming AGENTS saves tokens every turn while detail in 03_config is costless on normal turns → edit AGENTS (1 file), point to 03_config, don't duplicate.
VERIFY: S3 grep — 3 questions covered · every old branch keyword present (compact/ลืม/self-improve/compact-STOP/stuck-counter) · C0/C0.5 block shorter · C1-C3 untouched · CLAUDE.md pointer intact. R8: rule_indexer 35 entries. scope-creep clean (AGENTS.md + 03_config.md only, declared).
DELIBERATELY NOT EDITED: CLAUDE.md (labels kept) · Implement/03_config.md §Per-Turn (already holds the detail · only pointed to).
flow_updated=yes
- 2026-06-22 · T-229 (harness_editor) · on-demand glossary: created knowledge/glossary.md (grep-only · NEVER always-load · term|plain-Thai|optional-analogy) + wired user-coach §1 USE (grep-first reuse-or-append + Hard Rule) + index_files.json entry. No script (grep-first IS dedup). Verify: append→grep→reuse PASS.

## Y-2026-06-22 T-228 scope-grill mode
user-invokable scope drill: C0 Q4 detects trigger (เจาะ scope / scope-grill) → forces ACTIVE G0 (overrides skip-when-clear) + out-of-scope question → persists brief incl. out_of_scope to gather_complete.md before G1. Files: AGENTS.md C0 (trigger home — before G0-skip so it cannot be lost) · 03_config G0 (active mode = reuse existing G0 Qs + 1 out-of-scope Q, NOT a new mechanism) · gather_complete template (+out_of_scope field). NO new skill/script/hook. Ties T-230 scope-creep (boundary explicit up front). Scrutinize caught 1 logic hole: trigger must live at C0 not G0 (G0 may be skipped). attempts:1

## Y-2026-06-22 T-224 out_of_scope rejection memory
Design-DECISION rejection log: knowledge/out_of_scope.md (problem/rationale/refs/keywords per rejected idea · complements CFP which logs bugs). Mirrors T-229 glossary discipline: grep-first read + append-on-reject + NEVER always-loaded. Wired into skeptical_reviewer (the M4.5 pre-execution necessity gate — NOT scrutinize): Step 2 greps out_of_scope before verdict (HIT → [already-rejected] + cite rationale → reject unless user overrides) · Routing reject → append entry. AGENTS.md M4.5 one-line pointer. Seeded with 6 rejected ideas from roadmap 815 (a-f). Files: knowledge/out_of_scope.md (new) · skeptical_reviewer/SKILL.md · AGENTS.md · index_files.json. NO new dir/skill/script/hook. Scrutinize caught 1 hole: original plan wired the read into scrutinize (fires post-build + on-demand = too late / may not fire) → relocated read+write to skeptical_reviewer (pre-execution + necessity-gate = correct timing). attempts:1

## Y-2026-06-23 T-227 git-guardrails hook
Added scripts/git_guard.py — PreToolUse(Bash) hard guard (exit 2) blocking 4 dangerous git
patterns: force-push (--force/-f/--force-with-lease), reset --hard, clean -f, branch -D.
Wired as a 2nd PreToolUse entry in .claude/settings.json with matcher "Bash" (separate from the
phase-gate entry). Implements the hard-stop that R14/R15 only described as soft agent-side contracts.
Design (scrutinized + dogfooded live):
 - shlex tokenize, COMMAND-POSITION match (git at start / after && | ;) — not raw substring, so
   `echo git push --force` and `git commit -m "...push --force..."` do NOT false-block.
 - fail-OPEN on parse error (never lock the agent out of git).
 - override: GIT_GUARD_OK=1 prefix detected as a TOKEN in the command string (the hook reads the
   command string, NOT shell env — an env-prefix never reaches it). Caught live during testing.
 - exit 2 confirmed to block live; the existing phase-gate uses exit 1 — left untouched (out of scope).
Known limits (essence-only): does not catch obfuscated invocations (xargs git, shell aliases).

## Y-2026-06-23b T-227 follow-up — close the `git -C` bypass (scrutinize finding)
Post-build scrutinize of git_guard.py found a real false-negative: `git -C <path> push --force`
(and `git -c k=v ...`) bypassed the guard — the global option's separate value token was
mistaken for the subcommand, so `sub` was the path, not `push`.
Fix: added GIT_VALUE_OPTS + `_after_global_opts()` to skip git's leading global options
(and their value tokens) before reading the subcommand. ~15 lines, no behavior change to
the 4 patterns. Verified: 17/17 standalone (incl. 4 new `-C`/`-c` cases) + LIVE dogfood
(`git -C /tmp branch -D ...` blocked by the hook). Lesson reinforced: scrutinize the
BUILT artifact, not just the plan — the plan-scrutinize missed this; the artifact one caught it.

## Y-2026-06-23c T-236 evaluated → WONT-MERGE (decline with evidence)
Phase 1 + Simpler-Way scrutinize on the token_tracker+token_auditor merge → recommend DECLINE,
user signed off (A). The two share a topic, not a job: always-on/haiku/mechanical tracker vs
on-demand/sonnet/analytical auditor. Merge = net negative (hot-path bloat + floor bump) and the
dedup it would chase was already captured by T-244. Logged to knowledge/out_of_scope.md so the
Skeptical Reviewer's already-rejected guard blocks any re-proposal. T-236 marked [X] WONT-MERGE.

## Y-2026-06-23d T-238 variable_manager + file_manager → index_manager (MERGE · done)
Built one skill with a keyword Mode Router (NO inference): mode:file (floor=haiku · mechanical CRUD on
index_files.json) + mode:symbol (floor=sonnet · cross-file dependency reasoning on index_variables.json).
Per-mode floor (`floor_by_mode` in manifest) — verified safe: no script parses model_routing.floor as a
literal id, it's agent-read doc. Small-model mandate met: haiku skill_auditor picked the correct mode 4/4
with no guessing.
THE LESSON (→ CFP-043): the backlink/Fire-Index principle did NOT auto-fire during the file create/edit/
delete ops. backlink_analyzer computes only topic-based related[]; backfill only fills summary fields;
the Stop-hook reconciler runs at close only — NONE of them see doc-PROSE mentions of a skill name. So ~9
live docs (Implement/00,01,02,03,06,08 · domain/coding.md · handoff_block_schema · REPO_MAP) silently kept
naming the deleted skills; only a repo-wide grep caught them. User caught the gap → called the doctor.
NEW RULE (CFP-043): before any skill merge/delete, grep the skill NAME across the whole repo (minus
history) BEFORE the [gate] delete — never trust the index/backlink system to surface doc-prose refs.
Scope discipline: dated history (completed roadmap [X] entries · *-2026-06-04 snapshots · session logs ·
CFP audit trail) LEFT intact — rewriting dated records = history-rewrite (forbidden). Only the live
operational surface was swept. [gate] R14 user-confirmed "yes" → rm 2 dirs · DELETED · live grep=0.
No regression · REPO_MAP auto-synced (repo_map_check --sync) · doc + manifest edits (no src/).

## Y-entry 2026-06-23 · T-252 · index-sync COMPLETION BLOCK (closes CFP-043)
Problem (user-spotted): a file create/move/delete could reach a "done" session with index/backlink NOT updated. Only a soft R8 rule + a SILENT close-time reconciler (`2>/dev/null || true` — stderr discarded, exit forced to 0) existed; neither could block. Worse, nothing saw doc-PROSE refs to a deleted skill name (CFP-043 · the T-238 file_manager/variable_manager→index_manager merge left ~9 stale prose refs that no JSON-key or topic-backlink check catches).
Scrutinize (3rd-person) rejected: (a) a NEW Stop-hook block (infinite-loop risk + reverses the deliberate T-183 fail-safe "Stop reconciler must NEVER block close"); (c) a soft mece-L4 self-check (not enforced). CHOSE: extend the EXISTING PreToolUse close-gate that already intercepts the `phase: done` write — reuse the seam already sitting where the block is needed.
Fix (2 sections · harness_editor · only scripts/index_reconcile.py + .claude/settings.json · no src/): (S1) NEW read-only `--check` mode in index_reconcile.py — computes HARD drift directly (new file ∉ index_files.json · deleted file ∈ index · NEW `stale_skillname_refs()` grep of live `*.md` prose for any deleted-skill-dir name) and exits 2 on a hit; does NOT call reconcile()/regenerate/write (side-effect-free + fast); any exception → exit 0 (fail-safe). Default (Stop) path UNCHANGED. (S2) the close-gate `if 'phase: done' in new_string:` branch now runs `--check` after the .close_checklist_ack check; exit 2 (and no `HARNESS_SKIP_INDEX_BLOCK`) → print [close-gate] + heal command + sys.exit(1); subprocess error → do NOT block (fail-safe).
Verify caught 2 over-block bugs BEFORE ship (directly serving the user's anti-false-block fear): (1) blocking on every modified-but-unindexed file → narrowed to `st == "new"` only (a modified file absent from the index is a pre-existing gap this task didn't create); (2) stale-name grep flagging JSON/log/dated-history → added `--include=*.md` + excludes for `*-2026-*`/history files. e2e-proven: clean→exit 0, injected un-indexed file→exit 2 BLOCK, cleanup→exit 0. Escape: HARNESS_SKIP_INDEX_BLOCK=1. flow_updated=yes.

---
T-255 (2026-06-24 · harness_doctor repro-pin · skill: harness_editor · 2 SKILL.md + Implement/04 mirror): adapt 9arm post-mortem principle 1 "reliable repro" onto the harness fix-flow. Completes T-254 (the consumer Stage 3.6 had nothing concrete to re-run). 3 edits: (S1) doctor §3 Proposal +repro-pin step + SINGLE-SOURCE format block repro:{trigger,check,reproducible}; (S2) doctor Fix Record BC +repro field → persists to index_cfp_fix.json fixes[].repro; (S3) harness_editor Stage 3.6 reads fixes[].repro as a POINTER (format NOT restated — single-source, per skeptical-review fix). SOFT gate: reproducible:no → [repro-missing] → count-proxy (§1.4) + weak-validation flag → PROCEED (never blocks doctor — behavioral-drift CFPs cannot trigger on demand). flow_updated=yes.

---
T-257..260 (2026-06-24 · combined fix-flow hardening · skill: harness_editor · 4 files, MECE-by-file): closes the 4 gaps the 9arm OUTSIDER review found (fix-flow was ~85% strong). Combined plan, user-confirmed + skeptical-reviewed (out_of_scope guard: nothing rejected — the "heavy-postmortem-artifact" rejection actually SUPPORTS reusing error_index.md instead of a new store). USER DESIGN INSIGHT: non-CFP debug repro reuses the EXISTING error_index.md (already has trigger:) — no new file. 4 edits: (S1) error_index.md schema +check: +reproducible: → repro-pin now complete for the code/non-CFP path · FORMAT still single-source = doctor §3 (referenced, not restated). (S2) debug Section 1 — [R1] persists repro→ERR-N · NEW [R1.5] trace symptom→origin (emit [trace] before hypotheses · T-258) · NEW [R2.5] grep error_index+index_cfp_fix for prior-similar before ranking (POINTER to R9, not restated · T-259) · [trace] added to Output Contract. (S3) harness_editor Stage 3.6 now dispatches BY FIX-TYPE — CFP→index_cfp_fix.json fixes[].repro · code/non-CFP→error_index.md ERR-N — closing the path that previously fell to count-proxy (T-257). (S4) self_improve Operating Stance +1 blameless line: name the pattern/gap, never the agent/person (T-260). DESIGN: dropped the originally-listed harness_doctor edit — doctor §3 already owns the format + CFP persistence; leaner + cleaner single-source. Repro = single-owner-per-artifact (each repro has ONE home keyed to its error record). Verify: S1=2 · S2=7 · S3=both sources present · S4=1. scope-creep clean (baseline diff). flow_updated=yes.
T-257..260 scrutinize follow-up (2026-06-24 · skill: scrutinize → harness_editor · 2 clarity edits): outsider pass on the 4 edits found 0 bugs / 4 low-severity clarity gaps; verdict simpler-way:NO (design already minimal — reuses 2 existing stores). Confirmed harness_doctor §3 IS the real repro-pin source (no dangling ref · dropped-doctor-edit was correct). 2 closed: (a) harness_editor Stage 3.6 — added the dispatch-key clause "a CFP entry exists → CFP path · else → ERR-N path" so the fix-type branch is self-explaining. (b) error_index.md schema comment — reworded the overclaiming "do not restate elsewhere" to "flat-field form of the §3 `repro:{trigger,check,reproducible}` object · same keys, format owned by §3" (closes the single-source wording tension + the nested-vs-flat shape note in one line). NOT changed: debug [R2.5] left as-is — it is a useful single-source POINTER to R9, folding it would weaken tracing (judged not a real gap). No src/ touched · no Implement-doc change (behavior identical, clarity only). flow_updated=yes.

---
T-219 + T-220 (2026-06-24 · combined batch · skill: harness_editor · 2 SKILL.md, MECE-by-file): port the 2 remaining 9arm gaps into our trace/fix skills. Plan written + user-confirmed + skeptical-reviewed (single-source risk: trace-vs-trace overlap — mitigated by explicit boundary line). (S1 · T-219) scrutinize/SKILL.md — added §Trace (Section 2: walk the real end-to-end artifact path, not the diff · emit [trace] path|BROKEN) + §Verify (Section 3: each claim vs the trace · edge/silent-change/untested · emit [verify] holds|GAP); Simpler-Way moved to Section 4, STILL mandatory (not displaced); Sections YAML + verdict line + Output Contract updated; BOUNDARY line "§Trace distinct from debug [R1.5]: debug=LIVE failure symptom→origin (diagnosis) · scrutinize=FINISHED artifact claim-verification". Verify-1 grep trace|verify=16(≥6) · Verify-2 distinct-from-debug=1. (S2 · T-220) debug/SKILL.md — ENRICHED existing [R1.5] with a 3-rung fail-path ladder as its MECHANISM (NOT a parallel step — [R1.5] stays sole owner of fail-localization): rung1 attach debugger/read live state → rung2 source trace + knob enumeration (flags/env/branches/timing) → rung3 tagged [DBG-xxxx] instrumentation (single-grep cleanup); ladder signal added to Output Contract. Verify-1 grep knob|instrument|DBG-|debugger=4(≥3). DESIGN: both ports respect single-owner-per-artifact (scrutinize §Trace ≠ debug [R1.5]; debug ladder = HOW of [R1.5] not a new WHAT). scope-creep clean (baseline diff = only the 2 SKILLs). No src/ · no Implement-doc change (additive skill prose only). flow_updated=yes.

---
T-261 (2026-06-24 · skill: harness_editor · Fix Session Token Error = reconcile doc↔code drift · MECE-by-file 4 sections): killed the false [compact-STOP] root cause(s). Plan re-grounded greenfield→reconcile after 2 user corrections (CFP-045: read owner-spec + query index FIRST, don't ask user) · plan-reviewed by skeptical_reviewer M4.5=GO (CFP-044 count=2: must INVOKE the plan-review skill, not eyeball it). 4 drifts collapsed to ONE truth (DOC-FOLLOWS-CODE + WIN=128k, both user-confirmed): (S1) posttool_track.py — Edit/Write count tool_input only (the echoed response scales with file SIZE = the +77k spike) + 0.1×WIN backstop. (S2) settings.json ceiling — window-anchored eff=CHAT×1.75 vs WIN=128k; STOP needs eff≥90%·WIN AND signal-box≥2; LIVE-EVIDENCE mid-exec caught my OWN estimate-only-STOP bug (the new eff≥WIN clause fired at b=1/4 = the same false ceiling) → removed it, STOP is now ALWAYS signal-box-gated. (S3) Implement/03_config.md §R1 + CLAUDE.md R3 + AGENTS.md C0 Q3 — deleted the unused tiered table + the ×1.5/+700 CHAT formula + fixed the L61-vs-66 self-contradiction; rewrote every ceiling statement to window-anchored+gated. (S4) ROOT CAUSE — compact_state writes `session_reset: armed` (colon) but readers grepped `=` → SESSION reset silently FAILED → false ceiling persisted across compacts; compact_reset.py regex + settings.json reset block now accept `[:=]` both separators (verified both formats extract 'armed'). Verify: S1 ast.parse+grep=4 · S2 JSON+bash -n ok · S3 drift-grep=0 · S4 regex+bash both-format pass. scope ⊆ 6 declared files. Implement-doc updated = 03_config.md (S3). Residual flagged out-of-scope: `compact_size=` colon-mismatch (unproven), 03_config:1188 token_auditor 90k gate (different per-task mechanism). flow_updated=yes.

---
T-265 (2026-06-24 · skill: harness_editor · close the 3 amber self-improvement-loop gaps · 5 conceptual sections, anti-self-brick order): the loop doc (knowledge/self_improvement_loop.md, T-264) marked stages 5/7/8 as 🟡 "remembered, not enforced". This makes them structural. Plan skeptical-reviewed (REVISE→4 findings fixed) before exec. (S2a · dependency-first) added `artifacts:[paths]` to resolved ledger entries — CFP-044 backfilled [skill_gate.py, review_intent.py, posttool_track.py, settings.json]; probe REQUIRES resolved_by so the CFP-027 stub is skipped not false-flagged (Phase-1 live-file finding). (S2 · stage 7 Measure) NEW scripts/cfp_fix_probe.py: scans resolved CFPs, asserts each artifact exists + (hook scripts) still grep-wired in settings.json → [cfp-fix-drift]/[cfp-fix-ok]; fail-open; wired into boot_init.sh + Stop. (S3 · stage 8 Re-open) NEW scripts/cfp_recurrence.py CFP-N: agent-INVOKED reliable status flip resolved→reopened + recurred_after_fix+=today + count++ + escalation signal; detection stays R16/BC-E judgment (script only makes the WRITE total); documented in harness_doctor §1.4. (S1 · stage 5 Record) posttool_track.py writes .sessions/.cfp_touched ONLY when an Edit to CODING_FAILURE_PATTERNS.md / index_cfp_fix.json carries a status token (not any edit); boot_init.sh clears it (rm -f, own lifecycle since .scope_baseline is never boot-cleared); settings.json close-gate phase:done branch BLOCKs when .cfp_touched present AND self_improve_log.md not modified today (fail-open try/except · escape HARNESS_SKIP_CFP_BLOCK=1). (S4) tested live: 4b BLOCK exit1+msg ✓ · 4c allow exit0 ✓ · override exit0 ✓ · 4d wired ✓. ANTI-SELF-BRICK: settings.json (the gate) wired LAST after block-case proven (T-263 lesson: that task only ever proved allow, never block). DOGFOOD: T-265 closed THROUGH its own new gate (.cfp_touched absent since no CFP status changed → no spurious self-block). Residual out-of-scope: gate top-level json.load is fail-CLOSED on malformed stdin (pre-existing latent brick · flagged, not expanded). Implement-doc updated = 05_scripts.md. flow_updated=yes.

---
T-266 (2026-06-24 · skill: harness_editor · Loop-doc + Backlink rollout · 10 sections, cycle-grouped fan-out): used knowledge/self_improvement_loop.md (T-264) as a TEMPLATE to document the harness's 8 other control loops as a sibling family + wire them into the backlink web. (S1 · serial) NEW docs/session_templates/loop_doc_schema.md — the reusable 6-section skeleton (frontmatter · what-it-is · N-stage table with 🟢/🟡 enforced-by · principle · re-render SVG · Related backlinks + index stub) so all docs come out identical; DOC-ONLY contract (describe existing machinery, invent no enforcement). (S2-S9 · Cycle 2 parallel · 8 subagents cap 4 · sonnet) one knowledge/<loop>_loop.md each: boot · per_turn_routing · info_gather · mece_plan · react_execution · token_tracking · session_close · error_debug — every stage row points at a REAL artifact, honest 🟢/🟡 split. (S10 · serial · shared index_files.json) added 9 index entries + NEW knowledge/loops_catalog.md hub + REPO_MAP.md rows + ran backlink_analyzer.py to compute related[]. Verify-N all pass (B1-4=24 · C0-3=30 · G0-3=22 · M=24 · L=18 · token=18 · close-gate=6 · disproof=11 · catalog=9). scope-creep clean (baseline diff = exactly 10 new + index/REPO_MAP/roadmap). kcc verdict review_recommended on all 9 = FALSE positive (WARN no/stale key_claims → degenerate overlap=1.0 vs unrelated comparison docs; sibling docs are intentional, no content conflict). Residual flagged out-of-scope: key_claims backfill for the 9 new docs (clears the kcc WARN). No src/ touched · Implement-doc unchanged (knowledge docs describe existing behavior, no harness-behavior change). flow_updated=yes.

---
T-267 (2026-06-24 · skill: harness_editor · Harness authoring-techniques catalog · 3 sections, main-context serial · MERGED scope): wrote ONE educational knowledge doc cataloging the harness's instruction-WRITING techniques — sibling to T-266's loop family but about how the rules are *authored* rather than how they *run*. Scope reconciliation: a second chat had a divergent per-technique-family plan (1 schema + 5 sibling docs); user chose merge-into-this-chat, this chat absorbed the other's per-technique depth additively → 13 categories / ~25 techniques (the merge ADDED "Planning & Proof — MECE+Verify-N"). Plan skeptical-reviewed (REVISE → 5 findings fixed: stale 12→13 + Cycle "1-6/7-12"→"1-7/8-13" single-source drift, tightened Verify-1/2 to count 💰+⚠️ per category, added TOKEN CHECK invariant) BEFORE exec. (S1 · main) NEW knowledge/harness_authoring_techniques.md — frontmatter + intro (the spine: "enforced not remembered" + fail-open/closed + 🟢/🟡 legend) + single-source boundary (SKILL.md authoring → skill_authoring_principles.md, not duplicated) + categories 1-7: Behavioral Contracts · Forced Audit Signals · Pointer Delegation · Planning&Proof · Deterministic Routing · Graduated Escalation · Self-Repair Loop. Each = family intro + everyday analogy + technique table (how/💪/⚠️) + 💰cost/benefit + marquee deep-dive. (S2 · main append) categories 8-13: Phase-Gating · Context Economy · Session Continuity · Skill-Invocation Enforcement · Model-Cost Tiering · User-Facing Adaptation + "How others do it" contrast table (9arm leanness/signal-counting · karpathy cost-benefit lens/Surgical-Changes · mattpocock progressive-disclosure/kill-no-ops, with honest "they'd call parts of this over-built" read) + "one rule under all the rules" close. (S3 · serial) index_files.json entry + loops_catalog.md "See also" cross-link + REPO_MAP.md row + roadmap dedupe (folded a SUPERSEDED per-technique [ ] entry into the merged [X]) + harness_flow Y-entry + backlink_analyzer.py. Verify-1 headers=8 💰=10 ⚠️=8 · Verify-2 ext=5 headers=14 💰=19 ⚠️=14 · Verify-3 JSON-valid + grep≥1. DOC-ONLY (CFP-019: every technique grounded in a real file, no invented enforcement). Authored in MAIN context not parallel subagents — one educational doc needs one consistent voice. No src/ touched. flow_updated=yes.
