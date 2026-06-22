# INVARIANTS.md — Destructive Action Gates

> Hard stops for this project. Every AI agent must check this file before any irreversible action.

---

## I1 · Destructive Action Gate

Before any of these actions → emit `[gate]` → ask user → wait for explicit "yes":

- Deleting files or directories
- Overwriting existing database documents (e.g. Firebase Firestore mock data or manual recovery scripts)
- Running destructive commands like `rm`, `git reset --hard`, `git push --force`, `git checkout --`
- Deploying Cloud Functions directly to production (`firebase deploy`) without explicit staging confirmation

---

## I2 · Hard Stop Rules

If any of these hard stop rules are violated, the agent must trigger a `HALT` action (db-gate lock).

- **Firebase Single Entrypoint**: DO NOT call `initializeApp()` anywhere in `src/` except in `src/lib/firebase.ts`. All Firebase Auth, Firestore, and Storage instances must be imported from `src/lib/firebase.ts`.
- **Package Isolation**: DO NOT import components, services, or utilities directly across the boundaries of `src/` and `cloud-functions/`. They run in separate environments (browser vs Node.js) and have separate `package.json` configurations.
- **Thai Character UTF-8 Encoding**: Every script, indexer, or code editor operation MUST enforce `UTF-8` encoding (e.g., using `encoding='utf-8'` in python `open()` or `read_text()`). Storing or reading Thai text in non-UTF-8 formats is strictly forbidden.
- **No Direct State Mutations**: In React components, always use setter functions (`useState` / `useContext` dispatches) to modify states. Do not mutate state objects or arrays directly.
- **D1 / Local DB Backups Protection**: DO NOT overwrite or delete `db_backup_*.json` files. These contain valuable recovery snapshots.

---

## I3 · Knowledge Index Sync

After any symbol create/delete/rename → MUST update both indexes before closing task:
- `knowledge/index_variables.json` — symbol entry + line numbers
- `knowledge/index_files.json` — backlinks

Run: `python scripts/symbol_indexer.py` to regenerate.

---

## I4 · Pre-Edit Symbol Check (Required)

Before editing any symbol that appears in `knowledge/index_variables.json`:
```bash
grep -A 8 '"SymbolName"' knowledge/index_variables.json   # check used_in array
```
Emit and log:
```
[pre-edit] Symbol: `<name>` · used_in: <N files> · safe to edit: <yes|needs review>
```

## I5 · Roadmap Entry Required

Every task (bug fix, feature, enhancement) must exist in `docs/master_roadmap.md` before execution. The roadmap gate requires tasks to start in `[ ]` state and complete in `[X]` state.
Never duplicate task IDs. grep roadmap before creating.

---

## Protected Zones

- `CLAUDE.md` · `AGENTS.md` · `INVARIANTS.md` — Agent harness core configuration files
- `docs/master_roadmap.md` — System task ledger
- `knowledge/` — Agent indexing directory
- `.sessions/` — Agent session state directory
- `db_backup_2026-04-20T05-38-30-906Z.json` — Backup database file
- `cloud-functions/package.json` — Cloud functions packaging rules
