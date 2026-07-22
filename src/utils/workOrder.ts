// Single source of truth for WOA/WOP classification.
// WorkOrderType is 'AfterSale' | 'PreHandover' — the semantic field that the
// legacy `id.includes('WOA')` string checks were only approximating.
// Mapping: AfterSale -> WOA, PreHandover -> WOP (see ForemanReportModal jobCode).

// Structural — accepts any WorkOrder-shaped object regardless of which WorkOrder
// interface it came from (the codebase has more than one; some omit `type` from
// their declared shape even though it exists at runtime). `id` is included so the
// param shares a property with every WorkOrder variant (avoids the weak-type error).
type WoLike = { type?: string; id?: string } | null | undefined;

/** True when the work order is a managed After-Sale (WOA) or Pre-Handover (WOP) order. */
export const isWoaWop = (wo: WoLike): boolean =>
    wo?.type === 'AfterSale' || wo?.type === 'PreHandover';

/** The LB job code for a work order, derived from its type. Defaults to 'WOA'. */
export const getJobCode = (wo: WoLike): 'WOA' | 'WOP' =>
    wo?.type === 'PreHandover' ? 'WOP' : 'WOA';

// --- Parent / subtask resolution ---------------------------------------------
// Historically the code inferred a parent task id by counting dash segments and
// slicing (`taskId.split('-').slice(0,3)`), which breaks whenever the id shape
// differs from the assumed 3-segment parent / 4-segment subtask (e.g. a parent
// doc id `WH-WOA-0013-0004-0001` vs subtask id `WOA-0013-0004-0001`). The labor
// system never does this — it resolves the parent structurally. We do the same:
// the assembled virtual-subtask entry already carries `parentTaskId` (the real
// parent doc id from assembleWorkOrders), so we read that instead of guessing.

type TaskLike = {
    id?: string;
    parentTaskId?: string;
    currentRevision?: string;
};
type CategoryLike = { id?: string; tasks?: TaskLike[] };
type WorkOrderLike = { id?: string; categories?: CategoryLike[] };

export interface ResolvedTaskRefs {
    /** Real parent task doc id (Firestore path segment). */
    parentTaskId: string;
    /** Subtask doc id (Firestore path segment). */
    subtaskId: string;
    /** True when the acted-on entry is a subtask (has a parentTaskId). */
    isSubtask: boolean;
    /** The in-memory task object the id resolved to (undefined if no match). */
    taskDoc: TaskLike | undefined;
}

/** Strip a project prefix from a task id (e.g. "WH-WOA-0003-0001" -> "WOA-0003-0001"). */
export const getSubtaskId = (taskId: string): string =>
    taskId ? taskId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '') : taskId;

/**
 * Resolve a taskId to its parent/subtask Firestore doc ids using the STRUCTURAL
 * `parentTaskId` field (labor principle) — never id-string slicing.
 *
 * - Match found + it has `parentTaskId` -> it is a virtual subtask; use its
 *   stored `parentTaskId` as the real parent, its own id as the subtask.
 * - Match found without `parentTaskId` -> it is a real parent task.
 * - No match -> best-effort passthrough (the passed id as parent), taskDoc
 *   undefined. Deliberately does NOT slice the id.
 */
export function resolveTaskRefs(
    allWorkOrders: WorkOrderLike[] | null | undefined,
    workOrderId: string,
    categoryId: string,
    taskId: string,
): ResolvedTaskRefs {
    const found = allWorkOrders
        ?.find(w => w?.id === workOrderId)
        ?.categories?.find(c => c?.id === categoryId)
        ?.tasks?.find(t => t?.id === taskId);

    if (found?.parentTaskId) {
        return {
            parentTaskId: found.parentTaskId,
            subtaskId: found.id ?? taskId,
            isSubtask: true,
            taskDoc: found,
        };
    }

    if (found) {
        const pid = found.id ?? taskId;
        return {
            parentTaskId: pid,
            subtaskId: getSubtaskId(pid),
            isSubtask: false,
            taskDoc: found,
        };
    }

    return {
        parentTaskId: taskId,
        subtaskId: getSubtaskId(taskId),
        isSubtask: false,
        taskDoc: undefined,
    };
}
