# REPO_MAP.md — Repository Structure & Protected Zones

---

## Directory Layout

```
src/                   # React + Vite frontend source code
├── components/        # Reusable visual UI components
├── context/           # React context state providers (e.g. Authentication, App State)
├── data/              # Static frontend configurations and dictionaries
├── layouts/           # Page wrapper templates (Sidebar, Header, Main Layout)
├── lib/               # Third-party integrations (firebase.ts initialized here)
├── pages/             # Route-level React views (Dashboard, DailyReport, SLAMonitor)
├── services/          # Firebase database CRUD actions and migrations
├── types/             # Shared TypeScript type definitions
└── utils/             # Helper utilities and validators

cloud-functions/       # Backend Firebase Cloud Functions
├── lib/               # Compiled JavaScript files for deployment
└── tsconfig.json      # Cloud functions TypeScript configs

public/                # Static public assets (logos, icons, config)
scripts/               # Platform scripts and indexing tools
knowledge/             # Agent indexing directory (files, symbols, errors)
.agents/               # Agent harness skill manifest and specifications
.sessions/             # Continuous session state and memory variables
docs/                  # Project roadmap and domain business rules
```

---

## Protected Zones

| Path | Rule |
|---|---|
| `knowledge/` | Never delete manually — managed by agent and auto-scanners |
| `.sessions/` | Never delete manually — session state & memory |
| `docs/master_roadmap.md` | Edit only via agent workflow (`[ ]` → `[/]` → `[X]`) |
| `db_backup_2026-04-20T05-38-30-906Z.json` | Protected backup database snapshot |

---

## Quick Lookup Commands

```bash
# Find React Pages
find src/pages/ -name "*.tsx"

# Find Firebase Services
find src/services/ -name "*.ts"

# Search for a symbol definition
grep -rn "export.*SymbolName" src/

# Run symbol indexer
python scripts/symbol_indexer.py
```
