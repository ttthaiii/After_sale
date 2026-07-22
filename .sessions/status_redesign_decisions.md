# Status Redesign — Step-by-Step Decisions (locked with user)

date started: 2026-07-06
approach: walk the real lifecycle step by step; user confirms desired behavior per step; NO code edits until whole design locked + MECE plan approved.
principle: task.status = single source of truth · WO.status = computed from tasks (deriveWoStatus) · drop LB translation layer · laborSync does NOT read status field (verified).

---

## Task vocabulary (evolving — locked so far)
Current locked words: `Draft · Evaluating · Assigned · In Progress · For Checking · pending_delivery · Complete · Rejected · Cancelled` (9)
(history: was Pending·Assigned·In Progress·Completed·Verified·Rejected → 'Pending' DROPPED, +'Draft'+'Evaluating' (Step1), +'Cancelled' (Step1-cancel), Step3: 'Completed'→'For Checking' + 'Verified'→'Complete', Step4: +'pending_delivery' (QR generated).)
MIGRATION MAP (old→new, task level): 'Completed'→'For Checking' (work done 100%, awaiting QR) · 'Verified'→'Complete' (customer approved, process done). LB lowercase 'completed'/'for-checking' fold in via shim. NOTE: customer_reject is WO-ONLY (a customer-rejected TASK → 'Evaluating', re-enters /evaluation; NOT a task word).

## WO vocabulary (target — re-confirmed through Step 4)
`Draft · Evaluating · Assigned · Partially Approved · Rejected · In Progress · For Checking · pending_delivery · customer_reject · Complete · Cancelled`
(customer_reject = distinct from admin-eval 'Rejected' — who ended it matters for audit. Complete = capital, replaces old 'Completed'/'Verified'.)

---

## STEP 1 — FM creates Work Order  ✅ LOCKED
Real code: ForemanReportModal.tsx handleSave(isDraft) — WO status line 491, task status line 528.
UI: /work-orders (Entry.tsx) drafts=Draft (136) · tracking=Evaluating+Rejected (145) · /evaluation shows Evaluating+Rejected (Evaluation.tsx:71).

DECISION (user):
- At creation, task.status uses the SAME word as WO.status (no translation layer).
  - Save draft  → WO='Draft'     · every task='Draft'
  - Submit      → WO='Evaluating' · every task='Evaluating'
- Drop 'Pending' from task vocab; add 'Draft' + 'Evaluating'.
- Consequence (good): WO Draft/Evaluating become DERIVABLE from tasks → deriveWoStatus no longer needs Draft as a manual sticky exception; only 'Cancelled' stays manual.
- Note to verify later: a Rejected WO also appears in /evaluation + /work-orders tracking (re-edit/re-eval loop) — must survive redesign.
- Note to verify later: once WO passes evaluation it leaves /work-orders Entry page (only Draft/Evaluating/Rejected shown there); active work tracked on Dashboard.

## STEP 1b — Cancellation + Edit-lock (FM cancels)  ✅ LOCKED (user confirmed 2026-07-06)
Real code:
- "ลบแบบร่าง" (draft only) → deleteWorkOrder (WorkOrderContext:2204) → WO status:'Cancelled'+isArchived. Task NOT touched.
- "ยกเลิก" (shown when status Evaluating|Rejected, Entry.tsx:481) → archiveWorkOrder (2208) → ONLY isArchived; status UNCHANGED (does NOT become Cancelled). Task NOT touched.
- Tracker: "แอดมินเปิดดู" = adminReviewedAt set on first open (markWorkOrderAsOpenedByAdmin:2230, only if not already set) — NOT an evaluation. "กำลังประเมิน" = wo.status==='Evaluating' (not a separate event).
DISCREPANCIES vs user model: (1) submitted-cancel doesn't set Cancelled, only hides; (2) neither path sets task=Cancelled; (3) fn names misleading.

DECISION (user confirmed):
- "evaluated" trigger DEFINITION = at least ONE task in the WO has been decided (status ∈ {Assigned, Rejected}). NOT adminReviewedAt (that = merely opened/viewed, must NOT block).
- Cancel allowed when WO ∈ {Draft, Evaluating, Rejected} AND no task decided yet.
- Cancel → WO='Cancelled' AND every task='Cancelled' + archived (both delete-draft and cancel-submitted paths).
- Edit + Cancel buttons BLOCKED once ≥1 task decided (read from task.status, not adminReviewedAt).
- Add 'Cancelled' to task vocab.

### Step 1 — FILES TO CHANGE (implementation scope, for Phase 3):
1. src/types/index.ts — TaskStatus (line 12): drop 'Pending'; add 'Draft','Evaluating','Cancelled'.
2. src/components/ForemanReportModal.tsx (~528) — task.status uses SAME word as WO ('Draft'/'Evaluating'), not 'Pending'.
3. src/context/WorkOrderContext.tsx — deleteWorkOrder (2204) + archiveWorkOrder (2208): both set WO='Cancelled' AND every task='Cancelled' + archived.
4. src/pages/Entry.tsx — block edit + cancel buttons when ≥1 task in WO is Assigned/Rejected (signal = task.status, NOT adminReviewedAt).

## SIDE WORKSTREAM — Concurrency / stale-approve protection  ⏳ PROPOSED (separate from status migration)
Problem (user-raised, confirmed real): admin reviews an Evaluating WO, FM edits+resubmits meanwhile, admin approves stale data. Made worse because app uses onSnapshot realtime (WorkOrderContext:577) — admin's screen mutates live under them.
DB readiness (verified): editable fields all present (diff-able); NO version counter; NO pre-edit snapshot; `history`/`editHistory` are daily-report data, NOT report-edit history. Edit path does NOT reset adminReviewedAt/reviewedByAdmin.
PROPOSED design (optimistic concurrency + field-diff highlight):
- Add WO `version` (bump +1 on every FM edit).
- Admin eval modal FREEZES a snapshot at open (guard against realtime mutation).
- On admin confirm: compare frozen version vs live; mismatch → show field-level diff (frozen vs live), highlight changed fields, force re-review before approve.
- Client-side diff is enough (no permanent DB snapshot needed) unless a permanent audit trail is wanted (optional, larger).
- Also keep user's hard rule: block edit/cancel once any task is Assigned/Rejected (evaluation started), detected from task data NOT adminReviewedAt.
SCOPE NOTE: this is a NEW feature separate from the status single-truth migration; recommend deferring to its own workstream so it does not block the core status work. Awaiting user confirm on (a) client-diff vs full audit, (b) defer y/n.

## STEP 2 — Admin evaluates each task  ✅ LOCKED (user confirmed 2026-07-06)
Real code: TaskEvaluationModal (108/152) emits ONLY status:'Assigned' or status:'Rejected' (never 'Approved'). Evaluation.tsx handleModalConfirm (425-457) rolls up; saveEvaluation (WorkOrderContext:944) writes. Entry.tsx /work-orders tracking filter (145) = (Evaluating||Rejected) && !isArchived. Dashboard active filters include 'Partially Approved'. Rejected task in partial currently DIES (no rework loop; pendingAdminReassign is customer-only).

DECISION (user confirmed):
- Task verdict = Assigned (approve) | Rejected (reject) only. Drop 'Approved' at task level.
- WO rollup (computed, deriveWoStatus): undecided(Evaluating) remain → 'Evaluating'; all Assigned → 'Assigned' (RENAME from current 'Approved'); mix Assigned+Rejected → 'Partially Approved'; all Rejected → 'Rejected'.
- Undecided detection MUST use 'Evaluating' not 'Pending' (current rollup Evaluation.tsx:439 checks 'Pending' — bug after Step 1).

- REJECT has 2 real-world cases (system does NOT distinguish — admin+FM coordinate offline):
  (1) data incomplete → FM edits + resubmits → task returns to 'Evaluating' → re-enters /evaluation loop.
  (2) out-of-scope → FM acknowledges by pressing cancel → 'Rejected' + isArchived=true (closed).

- **ROUTING BY TASK, NOT WO (Option A — user chose)**: this is the core architectural consequence.
  - A Rejected task → shown in /work-orders (FM can fix+resubmit OR acknowledge/cancel) — REGARDLESS of whether WO is fully-Rejected or Partially Approved.
  - An Assigned task → shown in Dashboard/daily-report (execution).
  - => A Partially Approved WO appears in BOTH views simultaneously, filtered by task.status. Rejected work never vanishes silently (user's stated risk).
  - Current code routes by WO.status (one WO = one view) → MUST refactor filters to route by task.status. Big cross-cutting change (Entry.tsx + Dashboard + filters).

- Cancel/close semantics (reconciled with Step 1b):
  - FM withdraws BEFORE any task decided → 'Cancelled' (Step 1b).
  - admin Rejected + FM acknowledges → 'Rejected' + isArchived=true (NOT Cancelled). Keeps audit distinction (who ended it: FM vs admin).

FLAG for deriveWoStatus step (later): after Option A, a WO can hold MIXED task states (e.g. some In Progress + one re-submitted Evaluating + one Rejected). deriveWoStatus needs ordered priority rules (the brief's 6-rule function), NOT the current simple pending/approved count. Handle when we design deriveWoStatus.

## STEP 3 — FM works the task (Assigned → In Progress → For Checking)  ✅ LOCKED (user confirmed 2026-07-06)
Real code:
- Daily-report progress → task status: WorkOrderContext.tsx:1200-1205 sets task status = isCompleted ? 'Completed' : 'In Progress' (progress>0 → In Progress; progress=100 → Completed). Task-level transition WORKS today.
- WO ROLLUP GAP (verified): the daily-report progress fn updates ONLY wo.lastUpdate (line 1209) — NOT wo.status. So WO does NOT auto-advance to In Progress / done when tasks progress. WO.status is stamped at discrete events only (evaluation, customer inspection 2021='Completed', PH flows) — NOT derived from tasks. This is THE core single-truth defect.
- WO→'In Progress' at line 1454 is a DIFFERENT flow (admin re-assign after customer reject; hasOtherRejected guard) — not a daily-report rollup. Lines 1523/1544 = PreHandover approve.

DECISION (user confirmed):
- Task lifecycle: Assigned (assigned, not started) → In Progress (daily report progress>0) → For Checking (progress=100, work done, awaiting customer) → Complete (customer approved, process done).
- RENAME (cross-cutting, one-shot migration): task 100%-done word 'Completed' → 'For Checking'; customer-approved word 'Verified' → 'Complete'. Both old words removed from vocab.
- Casing: 'For Checking' and 'Complete' (CamelCase, match Assigned/In Progress/Rejected). Drop LB lowercase 'for-checking'/'completed'/'verified'.
- WO rollup (MUST BUILD — does not exist): whenever ANY task changes (incl daily report), recompute wo.status via deriveWoStatus.
  - WO ∈ {Assigned, Partially Approved} and ≥1 task → In Progress  ⇒ WO → 'In Progress'.
  - WO = Rejected (all tasks rejected) stays Rejected (no work path).
  - WO 'done' when all WORK-PATH tasks (Assigned/In Progress) reach For Checking AND no task pending action (unresolved Rejected). Exact word for the all-For-Checking WO state = decide in Step 4 (QR/customer stage).

FILES impacted (Step 3, for Phase 3): WorkOrderContext.tsx (task transition line 1202 rename + ADD WO rollup call on progress) · all filter arrays referencing 'Completed'/'Verified' (Dashboard, History.tsx:41, SLAMonitor, WorkOrderCard display maps) · types/index.ts TaskStatus.

FLAG for Step 4: define WO status when all tasks = For Checking (ready for QR / pending_delivery?) and how customer inspection flips For Checking → Complete (per-WO QR, applies to all tasks).

## STEP 4 — QR generation + customer inspection  ✅ LOCKED (user confirmed 2026-07-06)
Real code:
- generateDeliveryQrToken (WorkOrderContext:1807-1823): sets WO='pending_delivery' + deliveryQrToken + qrGeneratedAt. Does NOT touch tasks (GAP).
- submitCustomerInspection (1825+): per-task decision. approved→task status='completed'(LB)+evaluationStatus='Approved'+customerApprovedAt (1867-1874). rejected→task status='in-progress'(LB)+evaluationStatus='Rejected'+dailyProgress=0+currentRevision bump+reassign to woOwner+new revision doc (1906-1965). WO rollup: ANY reject→WO='Rejected'+reviewedByAdmin=false+pendingAdminReassign=true (1999-2002); all approved→WO='Completed'+completedAt+survey (2020-2022).
- Kanban board = SLAMonitor.tsx:961-964. Columns test off dailyProgress/WO-flags NOT task.status: 'งานรอประเมิน' (Rejected+pendingAdminReassign OR no foreman) · 'รอลูกค้าประเมิน' (dailyProgress>=100). NO 'For Checking / รอออก QR' column — 100% jumps straight to pending-customer.
- Re-eval UI = /evaluation (Evaluation.tsx pendingWorkOrders:159-165 includes Rejected+pendingAdminReassign → customer-rejected WO re-appears there for admin). Evaluation.tsx:417 special-cases status==='Rejected'.

DECISION (user confirmed):
- All tasks For Checking → WO='For Checking' (computed). Stays until FM generates QR.
- FM generates QR → WO='pending_delivery' AND every task='pending_delivery' (ADD to task vocab — keeps derivation pure; must set tasks too, code currently sets WO only).
- Customer inspects per task:
  - approved task → 'Complete' (rename from LB 'completed'). All approved → WO='Complete'.
  - rejected task → 'Evaluating' (NOT current 'in-progress' — the misleading status is the bug; task actually waits for admin re-eval). Keep revision bump (rev01→rev02) for audit.
  - WO with ANY rejected task → WO='customer_reject' (distinct word, NOT 'Rejected' — code currently conflates at 2000). Some-pass-some-fail also → WO='customer_reject'; each task keeps its own verdict.
- Rework loop: customer-rejected tasks (now 'Evaluating') re-enter /evaluation → admin re-evaluates (only the rejected ones if partial) → 'Assigned' → normal work loop (In Progress → For Checking → QR → customer). Reuses same loop, no shortcut.

Kanban change (Step 4): add column 'งานเสร็จ · รอออก QR' (For Checking) between In Progress and pending_delivery. Switch all board tests to key off task.status (not dailyProgress/flags). FM's QR action lives in the For Checking bucket.

FILES impacted (Step 4, Phase 3): WorkOrderContext.tsx (generateDeliveryQrToken set tasks too · submitCustomerInspection: approved→'Complete', rejected→'Evaluating' not 'in-progress', WO→'customer_reject'/'Complete') · SLAMonitor.tsx board columns · Evaluation.tsx re-eval (already routes; verify with 'Evaluating' tasks) · types/index.ts (task +pending_delivery; WO +customer_reject, rename).

## D1 RESOLVED — DROP evaluationStatus entirely  ✅ LOCKED (user confirmed 2026-07-06)
User ruling: delete evaluationStatus completely. NO migration shim, NO keep-as-audit — because current DB is TEST DATA only (no real data to preserve). Test data will be wiped/reseeded with new vocab.

Why it can go (verified): evaluationStatus is a workaround for the OLD vocab being ambiguous. Its two jobs are now covered by the richer task.status:
- "work done, awaiting customer" vs "customer approved" — OLD: `status==='Completed' && evaluationStatus==='Assigned'` → รอลูกค้าประเมิน (Dashboard 6x). NEW: 'For Checking' / 'pending_delivery' vs 'Complete' (distinct words carry it).
- "being reworked after customer reject" — OLD: `status==='in-progress' && evaluationStatus==='Rejected'` (WorkOrderCard, WorkOrderDetailModal). NEW: status='Evaluating' + currentRevision > rev00.
Type itself was a lie: types/index.ts:159 declares `'Pending' | 'Evaluated'` but code writes 'Approved'/'Assigned'/'Rejected' — dead evidence of the mess.

Scope to remove (~20 reads across 8 files): Dashboard (6), ForemanReportModal (7: isItemReadOnly + badges), WorkOrderGroupList (3), WorkOrderCard (2), Evaluation, WorkOrderDetailModal, DailyReportContext, AdminAssignModal (writer). Also delete the writer sites (WorkOrderContext:1009,1871,1934; AdminAssignModal:47) + the field on types/index.ts:159.
Rewrite pattern: replace every 2-field check (`status===X && evaluationStatus===Y`) with the single new-status check. ForemanReportModal isItemReadOnly (`evaluationStatus==='Approved'||'Assigned'`) → task.status ∈ {Assigned, In Progress, For Checking, pending_delivery, Complete} (i.e. decided-and-moving-forward).

TEST-DATA IMPLICATION (big — reduces migration work): since DB is test-only, the Phase 3 plan does NOT need a data-migration script mapping old→new words on live docs. Instead: wipe test WOs + reseed via mockData/seed with new vocab. Confirm seeding path in Phase 2.

## deriveWoStatus — Evaluating overload rule  ✅ LOCKED (user confirmed 2026-07-06)
Problem: task word 'Evaluating' means TWO things — (a) admin fresh eval (round 1), (b) customer-rejected task sent back for admin re-eval. deriveWoStatus CANNOT tell WO='Evaluating' vs 'customer_reject' from task.status alone.
Distinguisher = `currentRevision` (verified real: customer reject bumps to nextRev at WorkOrderContext:1936/1953; fresh task = 'rev00' at :1546).
RULE (inside deriveWoStatus, for tasks whose status === 'Evaluating'):
  - a sibling task is 'Complete', OR the Evaluating task has currentRevision !== 'rev00'  → WO = 'customer_reject'  (WO already went to customer)
  - else (all rev00, no Complete siblings)                                                 → WO = 'Evaluating'      (admin round 1)
CONSEQUENCE — routing fix: /evaluation currently filters `WO.status === 'Evaluating'`. After this, a customer-rejected WO = 'customer_reject' would NOT appear. → change /evaluation filter to route by TASK: show any WO that has ≥1 task with status === 'Evaluating' (matches Option A per-task routing, Step 2). Verify Evaluation.tsx pendingWorkOrders:159-165.

## deriveWoStatus — FINAL ordered ruleset  ✅ LOCKED (user confirmed 2026-07-06, all 3 junctions A/B/C)
NEW task-level field (junction C): add `taskArchived?: boolean` to MasterTask (mirrors WO.isArchived). Set true when FM acknowledges an out-of-scope Rejected task (Step 2 case 2). Distinguishes the 2 Rejected kinds at task level:
  - Rejected + taskArchived=false/undefined → data-incomplete, awaiting FM fix → LIVE (shows /work-orders, counts in rollup).
  - Rejected + taskArchived=true → out-of-scope acknowledged → CLOSED (excluded from rollup).

Two task sets:
  - CLOSED (no action left) = status ∈ {Complete, Cancelled} OR (status==='Rejected' && taskArchived===true).
  - live = allTasks minus CLOSED.

reachedCustomer = allTasks.any(t => t.status ∈ {pending_delivery, Complete} OR (t.status==='Evaluating' && t.currentRevision !== 'rev00')).

ORDERED RULES (first match wins; input = all tasks of the WO):
  0. tasks empty                                   → 'Draft'            (safety)
  1. every task === 'Cancelled'                    → 'Cancelled'
  2. every task === 'Draft'                        → 'Draft'
  3. every task === 'Complete'                     → 'Complete'
  4. every task === 'Rejected'                     → 'Rejected'         (admin rejected all; archived or not)
  5. live is empty (≥1 Complete + rest Rejected-archived) → 'Complete'  (all actionable work resolved)
  -- customer era (reachedCustomer) --
  6. reachedCustomer && live.any(status==='Evaluating')   → 'customer_reject'  (≥1 sent back to admin; persists until all rework clears re-eval — intentionally dominant over In Progress in this state)
  7. reachedCustomer && live.every(status==='pending_delivery') → 'pending_delivery'  (out for inspection; customer inspects all-at-once so no mixed leftover)
  -- work era --  (junction A: work dominates eval · junction B: CLOSED excluded so live drives it)
  8. live.every(status==='For Checking')           → 'For Checking'     (all live work done, awaiting QR — incl rework round)
  9. live.any(status ∈ {In Progress, For Checking})→ 'In Progress'      (any work underway dominates)
  -- admin-eval era (rev00) --
  10. live.any(status==='Evaluating')              → 'Evaluating'       (round-1 admin eval; rev00 — rework caught at rule 6)
  11. live.any(Rejected) && live.any(Assigned)     → 'Partially Approved'
  12. live.every(status==='Assigned')              → 'Assigned'
  13. fallback                                     → 'Evaluating'       (safety)

KEY BEHAVIORS (noted, not re-asked):
- Junction A: Assigned-being-worked + sibling still Evaluating(rev00) → In Progress (rule 9 before 10). The Evaluating task still surfaces in /evaluation via per-task routing.
- Junction B: Rejected-acknowledged + Cancelled + Complete all excluded from `live`, so a WO with rejected/cancelled/done tasks reports the state of its LIVE work.
- Rework loop stays consistent: after customer reject, passed tasks=Complete (CLOSED), rejected tasks=Evaluating(rev>00) → rule 6 customer_reject. After admin re-assigns → Assigned(rev>00), Complete excluded → live all Assigned → rule 12 Assigned → normal work loop resumes.

CALL SITES (Phase 3): replace the 2 byte-identical rollups (Evaluation.tsx:437-457, SLAMonitor.tsx:170-187) with one deriveWoStatus(tasks). Invoke on EVERY task mutation incl daily-report progress (WorkOrderContext:~1209 — the missing rollup, the core defect). Only 'Cancelled'/'Draft' need no manual sticky (both derivable).

## CRITICAL ARCHITECTURE FINDING (discovered Phase 3 S3, 2026-07-06) — DB stores LB lowercase, read-layer translates
Verified from WorkOrderContext.tsx: task.status is PERSISTED to Firestore as LB lowercase (`upcoming`/`in-progress`/`for-checking`/`completed`/`approved`/`rejected`), NOT CamelCase. Two translation points:
  - WRITE (CamelCase→lowercase): saveEvaluation 989-994 (lbStatus map) → stored at 1007 · daily-report 1182 (lbStatus) → 1188/1197 · else-branch 1202 stores CamelCase 'Completed' (inconsistent!) · submitCustomerInspection 1870/1876 'completed', 1933/1951 'in-progress'.
  - READ (lowercase→CamelCase): loadWorkOrders 497-515 — translates + uses evaluationStatus to disambiguate (upcoming→Assigned vs Pending; in-progress→Rejected vs In Progress).
IMPLICATION for S3: "drop LB layer" = store the new CamelCase vocab DIRECTLY in Firestore + DELETE both translation blocks. Reseed (test-data-only) means no legacy lowercase docs remain → read-layer 497-515 collapses to `let status = taskData.status;`.
CROSS-SYSTEM RISK (flag for S9 verify): task docs carry LB-shape fields (taskName/workOrderCode/isActive/assignees) → they may be the SHARED Labor-system docs. laborSync.ts verified not to read `status`, but grep OTHER LB consumers before final sign-off. User already accepted this risk when locking "drop LB layer".
REUSABLE HELPER to add: `recomputeWoStatus(woId)` — reads all category tasks from Firestore → deriveWoStatus → returns WO word. Call in daily-report, submitCustomerInspection, cancel, (S4) Evaluation. Import deriveWoStatus from '../utils/deriveWoStatus'.
WO customer-reject check fix: saveEvaluation:958 `parentWO?.status === 'Rejected'` must become `=== 'customer_reject'` (customer-reject WO is no longer 'Rejected').
S3 EDIT SITES (verified line#): read-layer 497-515 · daily-report 1182/1188/1197/1202 + add rollup after 1206 · saveEvaluation 958/989-994/1007/1009 + progressVal 996-1000 · generateDeliveryQrToken 1814-1820 (add task loop→pending_delivery) · submitCustomerInspection 1870/1871/1876/1933/1934/1951/2000/2021 · evalStatus reads 937/1441/1446 · updateWorkOrderStatus 1469 (type param) · approvePreHandoverWO 1501 'Approved' (PH) · cancel deleteWorkOrder 2204 / archiveWorkOrder 2208.
