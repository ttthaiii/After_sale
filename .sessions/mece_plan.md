# MECE Plan — T-347 job-level SLA warning unification + timezone lock
date: 2026-07-15
skill: coding
task: Unify the SLA "near/overdue" warning to job-level (max-SLA-among-subtasks) with a FIXED 7-day-remaining threshold across all 3 live-tracking spots (SLA Pressure, เร่งด่วน SLA card, SLAMonitor dropdown incl. WOA); remove Health Pulse "เกือบช้า"; lock all SLA-anchor timestamps to explicit +07:00.

## Phase 0 — Boot (once per session)
- [X] B1-B3: skill=coding, continuation
- [X] C0-C3: same broad topic (SLA/dashboard); NEW task T-347 (builds on T-346's computeJobSLA)

---

## Phase 1 — Info Gather
- [X] G1-G3: gather_complete.md written 2026-07-15 — spots located, current-state verified, spec locked

---

## Phase 2 — Plan
- [X] M1.5 dependency_map: [S1 jobSla.ts change MUST land first — S2-S4 all read CRITICAL_WINDOW_MS/subtaskAppointmentMs from it]. risk_flags: [changes visible SLA colors/labels on Dashboard + SLAMonitor — in-app verify required; timezone lock touches 7 files' anchor calc — must not change any OTHER logic in those files; do NOT touch WorkOrderContext.tsx (DB write, deferred)]
- [X] M2: 5 sections (S0 baseline + S1 jobSla.ts + S2 Dashboard + S3 SLAMonitor + S4 timezone-lock remaining files) + S5 verify
- [X] M3: user confirmed ("โอเค ดำเนินการต่อได้เลย")
- [X] M4: roadmap T-347 added
- [X] M5: this file

---

## Phase 3 — Execute

### Per-Section Invariants
- gather_complete.md + mece_plan.md dated today REQUIRED before any src/ edit (satisfied)
- tsc must stay = 0 baseline (no NEW error) — [[tsc-errors-fix-incrementally]]
- Do NOT touch: WorkOrderContext writes, DB, migration. Read + compute only. Only WOA/WOP.
- Preserve all existing return-shape contracts consumed by other components (getSLATimeStatus, getSLARemaining) unless a field is verified unused downstream

- [X] S0: Baseline
  - tsc --noEmit error count recorded = 0 (matches baseline, no new)

- [X] S1: src/utils/jobSla.ts
  - CRITICAL_WINDOW_MS: 24h → 7 days (168h); doc comment (rule 4) updated
  - subtaskAppointmentMs: `T08:00:00` → `T08:00:00+07:00` (explicit Bangkok offset)
  - Verify-N: (1) grep constant value ✓ (2) tsc clean ✓ (3) doc comment updated ✓

- [X] S2: src/pages/Dashboard.tsx
  - getSLATimeStatus (975-1143): rewrite to delegate to computeJobSLA(wo) — job-level, drop old per-subtask min-hours-left + 30%-relative + local slaHoursMap. Preserve return shape {text,color,bg,level,hoursLeft} consumed by urgentTasks/projectsMap.highRisk/render sites (taskName/categoryName confirmed unused, dropped)
  - sCurveData day-loop (2127-2208): per-task elapsed>limit*0.7 bucket → job-level via computeJobSLA(wo).deadlineMs (static, asOf-independent) — breach if endOfDayTime>deadline, risk if within 7 days of deadline, else ok. All subtasks of the same WO share the bucket for that day.
  - healthCardProjects Pulse render (3270-3318): remove atRisk bucket — 2-way onTime(deviation>=0)/late(deviation<0) split, update bar + legend
  - Timezone lock (KEPT per-subtask employee-tracking code, unaffected logic otherwise): lines 933, 1560, 2177, 2194, 3541, 3545, 3567 → `+07:00`
  - Verify-N: (1) grep computeJobSLA used in getSLATimeStatus + sCurveData ✓ (2) tsc clean ✓ (3) in-app: Pulse shows 2 buckets, Pressure/เร่งด่วน card show one status per WO, 7-day threshold visible → PENDING user check

- [X] S3: src/pages/SLAMonitor.tsx
  - getSLARemaining (166-208): rewrite to job-level via computeJobSLA(wo) — keep task.dailyProgress===100/Rejected per-subtask terminal cases as-is; active case delegates to job-level deadline + 7-day threshold. Signature (task, wo) — update call site (~340)
  - Dropdown labels (482-483): "วิกฤต (<24ชม.)"→"ใกล้ถึง SLA (≤7วัน)", "ปกติ (>24ชม.)"→"ปกติ (>7วัน)"
  - WOP kanban (938-944, 1058): add near-due (amber) tier alongside existing overdue(red)/normal(gray) — status==='critical'
  - Timezone lock: line 180 resolved by the getSLARemaining rewrite (delegates to computeJobSLA, no more local anchor calc)
  - Verify-N: (1) grep computeJobSLA used in getSLARemaining ✓ (2) tsc clean ✓ (3) in-app: all subtasks of same WOA WO show identical dropdown status; WOP kanban shows 3-tier color → PENDING user check

- [X] S4: Timezone lock — remaining KEPT per-subtask files (no logic change, anchor lock only)
  - File: src/components/TrackingCard.tsx (48, 78)
  - File: src/components/daily-report/WorkOrderGroupList.tsx (174, 193, 1472, 1494, 1521, 1546)
  - File: src/components/TaskEvaluationModal.tsx (106)
  - File: src/components/daily-report/DailyReportDetailPane.tsx (811, 867)
  - Verify-N: (1) grep no more bare `T08:00:00` (without +07:00) remains outside WorkOrderContext.tsx ✓ (2) tsc clean ✓ (3) no behavior change besides the anchor's explicit offset ✓

- [ ] S5: Verify + close
  - tsc clean (0, no new); scope-creep check (only declared files); user in-app confirm
  - Verify-N: (1) tsc (2) scope-creep clean (3) user confirms all 3 spots + Pulse in-app

## Phase 3 Close Checklist
- [ ] all S0-S5 [X] · [ ] tsc baseline (0, no NEW) · [ ] scope-creep clean
- [ ] user verifies in-app
- [ ] roadmap [X] T-347 · active_thread done · R8 sync (no new/deleted files this task)
