# CLAUDE.md — Agent Gateway Rules

> Read first. Hard constraints.

## Boot
1. [B1] Check .sessions/active_thread.md → if phase: in_progress → resume; if done/missing → fresh start
2. [B2] Check .sessions/session_handoff.md for pending task
3. [B3] Read .sessions/session_tokens.md → load SESSION_TOTAL
4. [B4] Load .agents/skills/skill-manifest.json → route to correct skill
5. If SESSION_TOTAL >60k → warn user before starting
6. Reply line 1: **[Boot]** Thread · Tasks · Skill · Loaded

## Loop Architecture
All tasks follow the structured Loop Architecture:
- **Phase 1: Info Gather** → Repeat: identify missing context → index-first → assess → emit [✓ gather]
- **Phase 2: MECE Plan** → Build plan (1:1 Skill sections) → Verify-N per section → user confirms → roadmap
- **Phase 3: Execution** → Cycle Gate (group sections into Cycles → CYCLE LOOP: spawn Cycle N parallel → await → read cycle_N_*.json → spawn Cycle N+1) → Completion Gate

---

## R1 · Token Tracking
Read SESSION_TOTAL once at Boot (B1). Track in working memory each turn.
- Formula: Output = (thai_chars × 1.7) + (en_chars × 0.3)
- Input = (user_msg_chars × 0.3) + context_overhead + (tool_result_chars × 0.3)
- Tool results: classify by file type first — `.md`/`.txt` → split formula; `.ts`/`.js`/`.json` → `× 0.3`; Bash → check for Thai
- Write to file: **end of every response** · token pause · blocked halt · completion gate
- Emit [tokens] trace · append footer every response: `*(Session total: ~NNN tokens)*`
- ⚠️ Do not define token formulas in other skill files — use R1 values exclusively

### Tool Result Measurement

After every tool call with significant output, measure before adding to SESSION_TOTAL:

**Step 1 — Classify by source:**
| Source | Apply |
|---|---|
| `.md`, `.txt`, `.sessions/*` | Split formula — Thai likely |
| `.ts`, `.js`, `.json`, `.sql` | `total × 0.3` — code is English |
| Bash/grep output | Check for Thai presence → use split if found |

**Step 2 — Calculate:**
- `tokens = (thai_chars × 1.7) + ((total_chars − thai_chars) × 0.3)`
- No Thai detected → `tokens = total_chars × 0.3`
- Never use UTF-8 bytes ÷ 3 — undercounts Thai by up to 1.7×

**Step 3 — Bash char-count pattern** (append to commands with significant output):
```bash
result=$(your_command_here); echo "$result"; \
printf "[chars: total=%s thai=%s]\n" \
  "$(echo "$result" | wc -m)" \
  "$(echo "$result" | grep -oP '[\x{0e00}-\x{0e7f}]' | wc -l 2>/dev/null || echo 0)"
```
Read the `[chars: total=N thai=N]` line → apply Step 2 → add to SESSION_TOTAL → write file.

---

## R2 · Tool Budget
Max 5 tool calls/turn. Retry max 2×; diagnose on 2nd fail.

---

## R3 · Session Pause
| SESSION_TOTAL | Action |
|---|---|
| >60k | finish current loop step → TOKEN PAUSE |
| >90k | HALT immediately → save state → report to user |

---

## R4 · Sub-agent Decision
Run 1 Bash scope probe before any task.

**Spawn patterns (3 types):**

| Pattern | When | How |
|---|---|---|
| **Explore** | scope ≥ 5 files / ≥ 300 lines | `invoke_subagent` (TypeName: `"research"`) → summary ≤500 tokens → act on summary only |
| **Execution** | single section > 8 steps + isolated output | `invoke_subagent` (TypeName: `"self"`) → pass goal + constraints + output format → receive structured result |
| **Parallel fan-out** | ≥ 2 sections in same Cycle (no dependency) | `invoke_subagent` Subagents[...] (one per section) → each writes `.sessions/cycle_N_<section_id>.json` → read all results → pass as context to next Cycle → single Completion Gate after all Cycles |

**Hard limits:**
- Max depth: 1 level only — worker agents may NOT spawn further agents
- Sub-agent output: structured (JSON or table) — never prose
- Token budget: sub-agent tokens count toward SESSION_TOTAL (no separate budget)
- Parallel spawn: pass all sections as array in single `invoke_subagents` Subagents[] (not sequentially)
- Custom types: use `define_subagent` to register a new TypeName for the session before invoking
- Platform adapter: Consult [.agents/platform/detected.md](file:///.agents/platform/detected.md) before dispatching commands. If the platform is `platform-unknown`, fall back to standard sequential execution.
- Sub-agent spawning: Use `spawn_tool` to delegate to sub-agents inside cycle transitions.

---

## R5 · Index-First Lookup

**Pre-Read Gate — emit BEFORE every Read call:**
```
**[pre-read]** Target: `<symbol>` · Tier: T<1|2|3> · Line: <N> · Will read: offset=<N> limit=60
```
Cannot fill Line? → grep not done yet → run grep first.

**Pre-Edit Gate — emit BEFORE every Edit/Write on a named symbol:**
```
**[pre-edit]** Symbol: `<name>` · index_variables lookup: T1 done · used_in: <N files> · safe to edit: <yes|needs review>
```
→ `grep -A 8 '"SymbolName"' knowledge/index_variables.json` → check `used_in` → review all dependents

**Lookup tiers (stop at first that yields line number):**
- T1: `grep -A 8 '"Symbol"' knowledge/index_variables.json` or `index_files.json`
- T2: `grep -B 2 -A 20 '"Symbol"' knowledge/index_variables.json`
- T3: `grep -n "Symbol" src/path/to/file.ts`

T1 partial match (path found but no line number) → proceed to T2. Still no line? → T3.

**Config files load ONCE at Boot (B1–B3) — never re-read mid-session:**
CLAUDE.md · index_files.json · index_variables.json → in working memory after Boot.
Re-read only after TOKEN PAUSE + resume.

| Prohibited | Required instead |
|---|---|
| Read without offset+limit | grep first → get line N → Read offset=N-5 limit=60 |
| Read >60 lines per call | Split into multiple targeted reads |
| Read knowledge/*.json in full | grep specific key only |
| Re-read CLAUDE.md mid-session | Already in working memory |

---

## R6 · Output Filter
Pipe all Bash: `cmd 2>&1 | grep -iE "error|warn|fail" | tail -20`

---

## R7 · Response Density
Default: table/bullet over prose. Comparison → table. Steps → numbered list.

---

## R8 · Index Sync (MANDATORY after every file change)
| Event | Action |
|---|---|
| Create/delete/move file | Update knowledge/index_files.json + backlinks |
| Edit file (add/remove imports) | Update backlinks in knowledge/index_files.json |
| Create/delete/rename symbol | Update knowledge/index_variables.json + run python scripts/symbol_indexer.py |

---

## R9 · Error Protocol
⚠️ MANDATORY 3-step check before any debug:
1. grep knowledge/error_index.md for symptom keyword
2. grep knowledge/index_variables.json for affected symbol
3. grep knowledge/index_files.json for backlinks

New error → Task ID format: `T-{ParentTask}-{BugID}-{AttemptID}` (e.g. `T-004-001-02`)
1. Add `[ ] T-{N}-{BugID}-01: <description>` to roadmap → set `[/]`
2. Fix code
3. Run python scripts/symbol_indexer.py
4. Assign ERR-XXX code
5. Write entry in knowledge/error_index.md (include Task ID + cross-link)
6. Mark roadmap `[X] T-{N}-{BugID}-{Attempt} (→ ERR-XXX)`

---

## R-Roadmap · All work must be logged
Before starting ANY task:
- New feature: `[ ] T-<N>: description`
- Bug fix: `[ ] T-{Parent}-{BugID}-{AttemptID}: description`
- Sub-task: `- [ ] T-<N>.{sub}: description`

Set `[/]` when starting → `[X]` when done.
---

## R19 · Self-Improvement
_Extension only — runs after Completion Gate. Does NOT modify Boot, Loop, or R1–R18._

**Post-task self-eval** — after all Completion Gate boxes checked, before session_manager close:
| check | pass condition |
|---|---|
| `invariant_ok` | No I1–I5 gate tripped unexpectedly during this task |
| `index_ok` | R8 Index Sync completed without error |
| `new_pattern` | No failure type encountered absent from CODING_FAILURE_PATTERNS.md |
| `routing_ok` | Skill used for each section matched skill-manifest.json at the start of that section. Mid-session re-routes via Per-Turn Routing do NOT count as mismatches. |
| `budget_ok` | Tool calls stayed ≤5 per turn throughout this task |

- All pass → no action, proceed to session close
- `new_pattern = true` → trigger CFP Auto-Draft below
- `routing_ok = false` OR `budget_ok = false` → write friction note to `.agents/skill-patches/pending/<skill>-gap-<YYYY-MM-DD>.md` (use `_template.md`), then lower skill score in registry.md by 0.5
- If `new_pattern = true` AND (`routing_ok = false` OR `budget_ok = false`): write CFP draft only — skip friction note

**CFP Auto-Draft** (only when `new_pattern = true`):
1. Write draft → `knowledge/cfp-proposals/CFP-draft-YYYY-MM-DD.md` (Symptom / Root cause / Prevention — same format as existing CFPs)
2. At session close → present to user: "พบ failure pattern ใหม่ — ต้องการเพิ่ม CFP ไหม? (y/n)"
3. Confirm → append to `CODING_FAILURE_PATTERNS.md` with next CFP number → move draft → `knowledge/cfp-proposals/applied/`
4. Decline → move draft → `knowledge/cfp-proposals/applied/` with `status: declined` in frontmatter

**Recipe Notes** — load-on-demand only:
- `knowledge/recipes/<topic>.md` — step-by-step safe procedures for recurring operations
- Load only when task matches topic — never load all recipes at Boot
- Add recipe when: operation repeats ≥ 2 times AND has a related CFP

**Safety:**
- Never modify `CODING_FAILURE_PATTERNS.md` directly — always wait for user confirm (extends CFP-004)
- Never run R19 self-eval before Completion Gate passes
- Prefer false-negative over false-positive when uncertain about new_pattern
