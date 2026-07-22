import type { MasterTask, WorkOrder } from '../types';

/**
 * deriveWoStatus — THE single source of truth for a Work Order's status.
 *
 * task.status is the only hand-set truth; WO.status is ALWAYS computed from its
 * tasks via this function (never stamped by hand). Call it on every task mutation
 * (evaluation, daily-report progress, QR generation, customer inspection, cancel).
 *
 * Design + rationale locked in .sessions/status_redesign_decisions.md
 * (§deriveWoStatus FINAL ordered ruleset).
 */

type WoStatus = WorkOrder['status'];

const REV0 = 'rev00';

/** A task with no further action pending — excluded from the rollup ("live") set. */
function isClosed(t: MasterTask): boolean {
    if (t.status === 'Complete' || t.status === 'Cancelled') return true;
    if (t.status === 'Rejected' && t.taskArchived === true) return true;
    return false;
}

/** True once the WO has been sent to the customer (post-QR), even partially. */
function reachedCustomer(tasks: MasterTask[]): boolean {
    return tasks.some(t =>
        t.status === 'pending_delivery' ||
        t.status === 'Complete' ||
        (t.status === 'Evaluating' && (t.currentRevision ?? REV0) !== REV0),
    );
}

export function deriveWoStatus(tasks: MasterTask[]): WoStatus {
    if (!tasks || tasks.length === 0) return 'Draft'; // rule 0 — safety

    const allAre = (s: MasterTask['status']) => tasks.every(t => t.status === s);

    // Rules 1-4 — terminal all-same states (evaluated over ALL tasks)
    if (allAre('Cancelled')) return 'Cancelled';
    if (allAre('Draft')) return 'Draft';
    if (allAre('Complete')) return 'Complete';
    if (allAre('Rejected')) return tasks.every(t => t.taskArchived === true) ? 'Cancelled' : 'Rejected';

    // Split off terminally-closed tasks; the "live" set drives the status.
    const live = tasks.filter(t => !isClosed(t));

    // Rule 5 — only closed tasks remain. If nothing was ever actually Complete
    // (every task got Cancelled or Rejected-then-archived away), the WO ended
    // with no work done at all — that's 'Cancelled', not 'Complete'.
    if (live.length === 0) return tasks.some(t => t.status === 'Complete') ? 'Complete' : 'Cancelled';

    const liveHas = (s: MasterTask['status']) => live.some(t => t.status === s);
    const liveAllAre = (s: MasterTask['status']) => live.every(t => t.status === s);

    // Rules 6-7 — customer era (WO already went to customer)
    if (reachedCustomer(tasks)) {
        if (liveHas('Evaluating')) return 'customer_reject'; // ≥1 sent back to admin
        if (liveAllAre('pending_delivery')) return 'pending_delivery'; // out for inspection
        // otherwise a rework task is re-assigned / in progress → fall through to work rules
    }

    // Rules 8-9 — work era (junction A: any work underway dominates a pending eval)
    if (liveAllAre('For Checking')) return 'For Checking';
    if (live.some(t => t.status === 'In Progress' || t.status === 'For Checking')) return 'In Progress';

    // Rules 10-12 — admin-eval era (round 1, rev00; rework caught at rule 6)
    if (liveHas('Evaluating')) return 'Evaluating';
    if (liveHas('Rejected') && liveHas('Assigned')) return 'Partially Approved';
    if (liveAllAre('Assigned')) return 'Assigned';

    return 'Evaluating'; // rule 13 — fallback safety
}
