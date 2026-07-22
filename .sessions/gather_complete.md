date: 2026-07-15
task: T-347 — job-level SLA warning unification (7-day fixed window) + Health Pulse "เกือบช้า" removal + SLA Pressure job-level + SLAMonitor WOA dropdown job-level + SLA-anchor timezone lock (+07:00)

## G1 — spots located
1. Health Pulse "เกือบช้า" — Dashboard.tsx healthCardProjects (1922) + render (3270-3318)
2. SLA Pressure "ใกล้หมด SLA" — Dashboard.tsx sCurveData day-loop (2127-2208)
3. SLAMonitor dropdown — SLAMonitor.tsx getSLARemaining (166-208, WOA per-task) + WOP kanban (935-944, already job-level)
4. การ์ดเร่งด่วน SLA — Dashboard.tsx getSLATimeStatus (1075-1143), still per-subtask 30%-relative (NOT yet on computeJobSLA)
5. Timezone anchor lock — 19 raw `T08:00:00` (no offset) sites across jobSla.ts, Dashboard.tsx, SLAMonitor.tsx, TrackingCard.tsx, WorkOrderGroupList.tsx, TaskEvaluationModal.tsx, DailyReportDetailPane.tsx (WorkOrderContext.tsx:1276/1300 `.000Z` DB-write EXCLUDED — deferred per [[workordercontext-utc-timestamp-bug]])

## G2 — verified
- computeJobSLA(wo) (src/utils/jobSla.ts) already job-level (max-SLA-among-subtasks, max-start anchor). CRITICAL_WINDOW_MS currently 24h fixed — needs 7-day (168h).
- healthCardProjects / projectTrend / Executive Summary slaScore already route through computeJobSLA (done-phase only).
- getSLATimeStatus is a SEPARATE, still-legacy per-subtask "most urgent" (min-hours-left) + 30%-relative function feeding urgentTasks + projectsMap.highRisk — needs full rewrite to delegate to computeJobSLA, same return shape {text,color,bg,level,hoursLeft} preserved (taskName/categoryName fields confirmed unused downstream — safe to drop).
- SLA Pressure day-loop uses its own local per-task elapsed>limit*0.7 calc — deadlineMs from computeJobSLA(wo) is asOf-independent (start+limit are static wo fields), so no need to add an asOfMs param to computeJobSLA — just reuse computeJobSLA(wo).deadlineMs as the per-WO governing deadline for every day's bucketing.
- SLAMonitor getSLARemaining currently per-task (own local map + own 24h-fixed). WOP kanban already uses computeJobSLA (S3 prior work) — just needs the 7-day threshold from jobSla.ts change (automatic) + an amber "near-due" tier added (currently only red/gray).

## G3 — user-confirmed spec (this session)
- Job SLA = MAX SLA among counted subtasks (unchanged from T-346).
- Warning threshold: FIXED "≤7 days left" (replaces old 24h fixed AND old 30%-relative AND old 70%-elapsed). Overdue = past deadline, unchanged.
- All 4 display spots (Pressure, เร่งด่วน card, SLAMonitor dropdown incl. WOA) must show ONE status per WO — every subtask in the same WO shares the WO's status.
- Health Pulse "เกือบช้า" REMOVED entirely (it only shows completed jobs — "near-late" cannot apply to a finished job). Reduced to 2-way: ทันกำหนด (deviation>=0) / ล่าช้า (deviation<0).
- Per-subtask SLA data is NOT touched/removed — still used by daily-report views (kept as employee-tracking, out of scope).
- Timezone: lock all SLA-anchor `T08:00:00` constructions to explicit `+07:00` (deterministic regardless of runtime locale). WorkOrderContext.tsx DB-write timestamps (1276/1300, `.000Z`=UTC) are OUT OF SCOPE this task (standing no-DB-write constraint) — logged as a separate deferred issue.

[✓ gather]
