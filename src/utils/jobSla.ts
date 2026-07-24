// ============================================================================
// jobSla.ts — SINGLE source of truth for JOB-LEVEL SLA (per ใบงาน / WorkOrder)
// ----------------------------------------------------------------------------
// Every SLA display/count site (Dashboard cards+gauge+table, SLAMonitor, detail
// panes, tracking cards, history) MUST route through computeJobSLA(wo) so the
// numbers agree everywhere. Replaces ~12 divergent per-file SLA calcs.
//
// KEY: a "job" = one WorkOrder. Its SLA is aggregated from its subtasks
// (wo.categories[].tasks[]), NOT graded per-subtask. Per-subtask SLA still
// exists elsewhere (computeTaskSLA in Dashboard) purely to track EMPLOYEE
// performance — that is a different concern and is intentionally left alone.
//
// Field-name map (the names are historically confusing — this is the truth):
//                          | WOA (AfterSale)      | WOP (PreHandover)
//   appointment (วันนัด)   | task.startDate       | wo.scheduledDate      ← anchor @ 08:00
//   assign-click moment    | task.slaStartTime    | wo.startDate          ← NOT used for SLA
//   admin-confirmed SLA    | task.slaCategory     | wo.phActualSla
//
// Locked spec (user-confirmed 2026-07-14):
//   1. Counted subtasks = approved & in the work cycle (see COUNTED_STATUSES).
//      Excludes Draft/Evaluating (not approved), Rejected (admin), Cancelled.
//      customer_reject is auto-handled: the system resets the task in place with
//      a fresh SLA, so we just read current state.
//   2. Job deadline = MAX over counted subtasks of (that subtask's OWN appointment@08:00
//      + that subtask's OWN SLA-hours) — i.e. whichever subtask's own promise lands
//      latest governs the job (pure CALENDAR time — no working-hour math). Job start/
//      limit/slaCategory are read from that SAME governing subtask, not independently
//      maxed (an earlier version took MAX(start) and MAX(limit) separately, which could
//      invent a deadline later than any subtask actually promised — corrected 2026-07-22,
//      user-confirmed with a start-date-mismatch example).
//   3. Job completion = LATEST completion among counted subtasks, and only once
//      ALL counted subtasks are done. Otherwise the job is still in-progress.
//   4. Status:
//        done       → binary  'on-time' | 'late'
//        in-progress→ 3-tier  'normal' (>7 days left) | 'critical' (≤7 days left, not yet overdue) | 'overdue'
//        (7-day window is a FIXED threshold, user-locked 2026-07-15 — replaces the old 24h/30%/70% mix.)
//   5. NO fabricated default: an approved job always has SLA. A counted subtask
//      with no SLA/appointment is a DATA ERROR → skipped + console.warn (never
//      silently defaulted to 24h/720h).
// ============================================================================

export const SLA_HOURS_MAP: Record<string, number> = {
    Immediately: 4,
    '24h': 24,
    '1-3d': 72,
    '3-7d': 168,
    '7-14d': 336,
    '14-30d': 720,
    // WOP-only extended categories (from PreHandoverAssignModal SLA_OPTIONS). Values match
    // the pre-existing PreHandoverDetailPane map so WOP deadlines stay unchanged.
    '30-60d': 1440,
    '60d+': 2880,
};

// Thai display labels for each SLA category key.
export const SLA_LABELS: Record<string, string> = {
    Immediately: 'ทันที',
    '24h': '1 วัน',
    '1-3d': '3 วัน',
    '3-7d': '7 วัน',
    '7-14d': '14 วัน',
    '14-30d': '30 วัน',
    '30-60d': '30-60 วัน',
    '60d+': '60+ วัน',
};

// Subtask statuses that count toward a job's SLA = approved and in the work cycle.
export const COUNTED_STATUSES: ReadonlySet<string> = new Set([
    'Assigned',
    'In Progress',
    'For Checking',
    'pending_delivery',
    'Complete',
]);

const HOUR_MS = 3600_000;
const DAY_MS = 86_400_000;
const CRITICAL_WINDOW_MS = 7 * DAY_MS; // fixed 7-day "ใกล้ถึง SLA" window (user-locked 2026-07-15)

export type JobSLAStatus =
    | 'on-time'   // done, within deadline
    | 'late'      // done, past deadline
    | 'normal'    // in-progress, >7 days left
    | 'critical'  // in-progress, <=7 days left (CRITICAL_WINDOW_MS, user-locked 2026-07-15)
    | 'overdue'   // in-progress, past deadline
    | 'not-eligible'; // no counted subtask / no valid SLA (not gradeable)

export type JobSLAPhase = 'done' | 'in-progress' | 'none';

export interface JobSLA {
    isEligible: boolean;      // false = not gradeable (no counted subtask or no valid SLA)
    phase: JobSLAPhase;
    status: JobSLAStatus;
    slaCategory: string | null; // the governing (max) SLA category key
    slaLabel: string;           // Thai label for the governing SLA
    limitHours: number;         // job SLA limit in hours (max among subtasks)
    startMs: number | null;     // job anchor = latest appointment @ 08:00
    deadlineMs: number | null;  // startMs + limit
    completedMs: number | null; // latest subtask completion; null while in-progress
    deviationPct: number;       // 100 - used/limit*100  (>=0 = on/ahead, <0 = over)
    daysDiff: number;           // calendar days completion(or now) vs deadline: + late / - early
    countedSubtasks: number;    // # of valid counted subtasks used
}

const notEligible: JobSLA = {
    isEligible: false,
    phase: 'none',
    status: 'not-eligible',
    slaCategory: null,
    slaLabel: '—',
    limitHours: 0,
    startMs: null,
    deadlineMs: null,
    completedMs: null,
    deviationPct: 0,
    daysDiff: 0,
    countedSubtasks: 0,
};

const isWopType = (wo: any): boolean => wo?.type === 'PreHandover';

// Collect approved, in-cycle subtasks across all categories of a job.
export const getCountedSubtasks = (wo: any): any[] => {
    const out: any[] = [];
    (wo?.categories || []).forEach((c: any) => {
        (c?.tasks || []).forEach((t: any) => {
            if (COUNTED_STATUSES.has(t?.status)) out.push(t);
        });
    });
    return out;
};

// Admin-confirmed SLA category for a subtask (WOP falls back to WO-level).
const subtaskSlaCategory = (t: any, wo: any, isWop: boolean): string | null => {
    const cat = isWop ? (wo?.phActualSla || t?.slaCategory) : t?.slaCategory;
    return cat && cat in SLA_HOURS_MAP ? cat : null;
};

// Appointment (วันนัด) anchored to 08:00 of that calendar day (WOP uses wo.scheduledDate).
const subtaskAppointmentMs = (t: any, wo: any, isWop: boolean): number | null => {
    const raw = isWop ? (wo?.scheduledDate || t?.startDate) : t?.startDate;
    if (!raw || typeof raw !== 'string') return null;
    const ms = new Date(`${raw.split('T')[0]}T08:00:00+07:00`).getTime();
    return isNaN(ms) ? null : ms;
};

// Resolve a subtask's completion: completedAt → last 100% history → last history.
// done gate = foreman work finished (dailyProgress 100) OR status/WO Complete.
const resolveSubtaskEnd = (t: any, wo: any): { done: boolean; endMs: number | null } => {
    const history = [...(t?.history || [])].sort(
        (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstP100 = history.find((h: any) => Number(h.progress) === 100);
    const lastHist = history[history.length - 1];
    const woDone = wo?.status === 'Complete';
    const endMs =
        t?.completedAt ? new Date(t.completedAt).getTime() :
        firstP100 ? new Date(firstP100.date).getTime() :
        lastHist ? new Date(lastHist.date).getTime() :
        (woDone && wo?.completedAt ? new Date(wo.completedAt).getTime() : null);
    const done =
        (t?.dailyProgress ?? t?.progress ?? 0) >= 100 || t?.status === 'Complete' || woDone;
    return { done: done && endMs !== null, endMs };
};

/**
 * Compute the JOB-LEVEL SLA for one WorkOrder.
 * Pure function — no component state, no side effects (besides a data-error warn).
 */
export const computeJobSLA = (wo: any): JobSLA => {
    if (!wo) return notEligible;
    const isWop = isWopType(wo);
    const counted = getCountedSubtasks(wo);
    if (counted.length === 0) return notEligible;

    // Governing subtask = the one whose OWN (start + its own SLA) lands latest —
    // NOT independently-maxed start and limit from possibly different subtasks
    // (that combination can invent a deadline later than any subtask actually
    // promised; user-confirmed correction 2026-07-22).
    let governingDeadlineMs = -Infinity;
    let startMs: number | null = null;
    let limitHours = 0;
    let governingCat: string | null = null;
    let latestEndMs = -Infinity;
    let allDone = true;
    let validCount = 0;

    for (const t of counted) {
        const cat = subtaskSlaCategory(t, wo, isWop);
        const tStartMs = subtaskAppointmentMs(t, wo, isWop);
        if (!cat || tStartMs === null) {
            // Approved subtask missing SLA/appointment = data error → skip, never default.
            console.warn(
                `[computeJobSLA] approved subtask on WO ${wo?.id} missing SLA/appointment — skipped`,
                { taskId: t?.id, slaCategory: cat, startMs: tStartMs }
            );
            continue;
        }
        validCount++;
        const hrs = SLA_HOURS_MAP[cat];
        const tDeadlineMs = tStartMs + hrs * HOUR_MS;
        if (tDeadlineMs > governingDeadlineMs) {
            governingDeadlineMs = tDeadlineMs;
            startMs = tStartMs;
            limitHours = hrs;
            governingCat = cat;
        }

        const { done, endMs } = resolveSubtaskEnd(t, wo);
        if (!done) allDone = false;
        else if (endMs !== null && endMs > latestEndMs) latestEndMs = endMs;
    }

    if (validCount === 0 || startMs === null) return notEligible;

    const limitMs = limitHours * HOUR_MS;
    const deadlineMs = governingDeadlineMs;
    const completedMs = allDone && latestEndMs !== -Infinity ? latestEndMs : null;

    let phase: JobSLAPhase;
    let status: JobSLAStatus;
    let deviationPct: number;
    let daysDiff: number;

    if (completedMs !== null) {
        phase = 'done';
        status = completedMs <= deadlineMs ? 'on-time' : 'late';
        deviationPct = 100 - ((completedMs - startMs) / limitMs) * 100;
        daysDiff = Math.round((completedMs - deadlineMs) / DAY_MS);
    } else {
        phase = 'in-progress';
        const now = Date.now();
        const remainingMs = deadlineMs - now;
        status = remainingMs < 0 ? 'overdue' : remainingMs < CRITICAL_WINDOW_MS ? 'critical' : 'normal';
        deviationPct = 100 - ((now - startMs) / limitMs) * 100;
        daysDiff = Math.round((now - deadlineMs) / DAY_MS);
    }

    return {
        isEligible: true,
        phase,
        status,
        slaCategory: governingCat,
        slaLabel: (governingCat && SLA_LABELS[governingCat]) || governingCat || '—',
        limitHours,
        startMs,
        deadlineMs,
        completedMs,
        deviationPct,
        daysDiff,
        countedSubtasks: validCount,
    };
};
