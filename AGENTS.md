<!-- BEGIN:agent-orientation -->
# Agent Orientation — Read Before Acting

You are operating inside the **After Sale Task Management** project. Rules apply to ALL agents regardless of vendor.

> **Full hard constraints → `CLAUDE.md`** · **Destructive gates → `INVARIANTS.md`** · **Repo structure → `REPO_MAP.md`**

---

## Boot Sequence (3 tool calls max)

```
[B1] Bash: (phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); printf "SESSION_TOTAL: 0\n" > .sessions/session_tokens.md; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3)
[B2] Read: .agents/skills/skill-manifest.json → match user intent to keywords[] → identify skill_name
[B3] Read: .agents/skills/<skill_name>/SKILL.md → load sections[] and context_files
```

- B1 always resets SESSION_TOTAL to 0 on every Boot — every new conversation starts fresh
- If SESSION_TOTAL > 60k → warn user before proceeding

Reply line 1: `**[Boot]** Thread: <done|in_progress> · Tasks: <N open> · Skill: <name> · Sections: <N> · Tokens: ~<N>k`

---

## Per-Turn Routing (every user message)

| Situation | Action |
|---|---|
| User asks to fix a bug | Re-route → `editor` |
| User says "close/done/end session" | Re-route → `session_manager` |
| User asks to create a new file | Re-route → `coder` |
| User asks to orchestrate multi-step task | Re-route → `agent` |
| User asks about session/identity state | Re-route → `identity` |
| token threshold exceeded | Re-route → `token_auditor` |
| Same task type | Stay on current skill |

**Same session ≠ same skill. Always check intent → re-read SKILL.md if skill changes.**

---

## Loop Architecture

| Phase | What happens |
|---|---|
| 1 Info Gather | Repeat: identify missing context → index-first → assess → emit [✓ gather] |
| 2 MECE Plan | Build plan (1:1 Skill sections) → Verify-N per section → user confirms → roadmap |
| 3 | Execution | Cycle Gate → group sections into Cycles → CYCLE LOOP: spawn Cycle N parallel → await → read cycle_N_*.json → spawn Cycle N+1 → Completion Gate |

**Phases 1–2 run ONCE per task. On resume: skip to Phase 3 at pending section.**

Completion Gate:
```
□ All sections executed  □ Writes [✓ written]  □ Index Sync
□ Roadmap [X]           □ phase: done          □ SESSION_TOTAL written → .sessions/session_tokens.md
```

---

## Sub-agent Rules

When executing complex parallel tasks, the orchestrator delegates to sub-agents via the specified `spawn_tool`. During a `Cycle transition`, the context of finished tasks is aggregated and passed forward.

---

## Backlink Rule

Before editing any file:
```bash
grep -A 6 '"src/path/to/file"' knowledge/index_files.json
```
Check `backlinks[]` — every file listed imports the file you are about to edit. Update all of them.

---

## Quick Reference

| Rule | Requirement |
|---|---|
| Token footer | Every response: `*(Session total: ~NNN tokens)*` |
| File reads | grep index first → Read offset+limit only (never full file >60 lines) |
| Symbol edits | grep index_variables → check used_in → emit [pre-edit] |
| Destructive actions | INVARIANTS.md §I1 — emit [gate] and wait confirm |
| Error protocol | error_index → symbol_index → file_index (all 3 in order) |
| Roadmap | Every task logged before execution. `[ ]` → `[/]` → `[X]` |
| Session close | route `session_manager` — writes: `active_thread.md` · `session_tokens.md` · `session_handoff.md` · session JSON · `master_roadmap.md` → SESSION_TOTAL: 0 |
| Topic switch | New task = new session JSON — never carry raw History across tasks |

---

## Reference Files

| File | Purpose |
|---|---|
| `INVARIANTS.md` | Destructive gates (I1) + hard stops (I2) |
| `REPO_MAP.md` | Directory layers, protected zones, quick lookup commands |
| `CODING_FAILURE_PATTERNS.md` | Known agent failure modes (fill as bugs occur) |
| `knowledge/error_index.md` | ERR-XXX error log (search first before any debug) |
| `docs/master_roadmap.md` | Task checklist |

---

## Critical Project-Specific Rules

- **Frontend Environment**: This is a React + Vite application written in TypeScript (`src/`). Never use Node-specific API globals (such as `process.env`, `fs`, `path`) in the frontend. Use `import.meta.env` for environment variables.
- **Firebase Initialization**: Firebase services must import the initialized app/db/auth references from `src/lib/firebase.ts`. Do not re-initialize Firebase using `initializeApp` or recreate database references in individual components or pages.
- **Firebase Firestore Queries**: Ensure that all Firestore queries use standard Firebase Web SDK v9+ modular syntax. Check that collection/doc references are handled correctly.
- **Cloud Functions**: Firebase Cloud Functions are stored in `cloud-functions/` and are built using TypeScript. If you modify any file in `cloud-functions/`, you must build the functions (`npm run build` in `cloud-functions/`) and verify compilation before completion.
- **React Router Dom v7**: Pages are navigated using `react-router-dom` v7 (`src/pages/*`). Do not use window.location directly for internal SPA routing.
- **Encoding Rule**: All written or processed files containing Thai/Thai characters MUST be saved and read using `UTF-8` encoding to prevent character encoding issues.
- **Parsing & Edge Rules**: (Examples: do not perform manual CSV parsing with split, use PapaParse or structured parses. Do not use Node-specific API globals in Edge Runtime environments. Do not execute direct SQL commands on D1 database).
<!-- END:agent-orientation -->
