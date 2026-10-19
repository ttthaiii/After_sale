import { WorkOrder } from '../types';

// Single source of truth for "is a work order complete enough to SUBMIT?".
//
// The same rule is needed in two places:
//   1. ForemanReportModal.handleSave  — blocks a real submit and lists what is missing.
//   2. The foreman draft card (Entry.tsx) — shows the "ส่งงาน" button ONLY when complete.
//
// Keeping the rule here (once) means changing it never drifts between the two callers.
// Each caller adapts its own data shape to CompletenessInput; the RULE lives only in
// getSubmitBlockers().

// A task is "decided" (locked from foreman edits) once it has moved past evaluation.
// Shared with ForemanReportModal (imported there) so the locked-set is defined once.
export const DECIDED_STATUSES = ['Assigned', 'In Progress', 'For Checking', 'pending_delivery', 'Complete'];

export interface CompletenessItem {
    position?: string;
    detail?: string;      // stored WorkOrder: task.name; modal form: item.detail
    amount?: number;
    hasImage: boolean;    // caller resolves its own photo chain into a boolean
    decided: boolean;     // already-evaluated item -> not re-validated
}

export interface CompletenessCategory {
    name?: string;
    items: CompletenessItem[];
}

export interface CompletenessInput {
    type: WorkOrder['type'];   // 'AfterSale' | 'PreHandover'
    building?: string;
    floor?: string;
    room?: string;
    reporterName?: string;
    reporterPhone?: string;
    description?: string;      // stored WorkOrder: initialProblem
    documentsCount: number;    // attached WO documents (PreHandover)
    categories: CompletenessCategory[];
}

// THE rule. Returns a list of human-readable blockers; empty list = complete.
// Mirrors ForemanReportModal.handleSave's former inline validation exactly.
export function getSubmitBlockers(input: CompletenessInput): string[] {
    const blockers: string[] = [];

    // General information — required for BOTH AfterSale and PreHandover.
    if (!input.building?.trim()) blockers.push('อาคาร (Bldg)');
    if (!input.floor?.trim()) blockers.push('ชั้น (Floor)');
    if (!input.room?.trim()) blockers.push('ห้อง (Room)');
    if (!input.reporterName?.trim()) blockers.push('ชื่อผู้แจ้ง (Reporter)');
    if (!input.reporterPhone?.trim()) blockers.push('เบอร์โทร (Phone)');
    if (!input.description?.trim()) blockers.push('รายละเอียดเพิ่มเติม');

    if (input.type === 'PreHandover') {
        // PreHandover: at least one attached document + every category must have a name.
        if (input.documentsCount === 0) {
            blockers.push('กรุณาแนบไฟล์เอกสารอย่างน้อย 1 ไฟล์');
        }
        if (input.categories.some(c => !c.name?.trim())) {
            blockers.push('กรุณาพิมพ์ชื่อหมวดงานให้ครบ (มีหมวดที่ยังไม่ได้พิมพ์ชื่อ)');
        }
    } else {
        // AfterSale: each non-decided item needs position + detail + amount>0 + >=1 photo.
        input.categories.forEach(group => {
            group.items.forEach(item => {
                if (item.decided) return; // already-decided items are read-only, not re-validated
                const label = `${group.name} - ${item.position || item.detail || 'รายการที่ไม่มีชื่อ'}`;
                if (!item.position?.trim() || !item.detail?.trim()) {
                    blockers.push(`${label}: กรุณากรอกจุดที่พบและรายละเอียด`);
                }
                if (!item.amount || item.amount <= 0) {
                    blockers.push(`${label}: จำนวนต้องมากกว่า 0`);
                }
                if (!item.hasImage) {
                    blockers.push(`${label}: กรุณาแนบรูปอย่างน้อย 1 รูป`);
                }
            });
        });
    }

    return blockers;
}

// Adapter: a stored WorkOrder -> CompletenessInput (used by the draft card).
export function workOrderToCompletenessInput(wo: WorkOrder): CompletenessInput {
    return {
        type: wo.type,
        building: wo.building,
        floor: wo.floor,
        room: wo.room,
        reporterName: wo.reporterName,
        reporterPhone: wo.reporterPhone,
        description: wo.initialProblem, // formState.description maps to WO.initialProblem
        documentsCount: wo.documents?.length ?? 0,
        categories: (wo.categories || []).map(cat => ({
            name: cat.name,
            items: (cat.tasks || [])
                .filter(task => !(task as any).taskArchived)
                .map(task => {
                    const t = task as any;
                    // Mirror the modal's photo fallback chain (ForemanReportModal load).
                    const hasImage =
                        (t.images && t.images.length > 0) ||
                        !!t.beforePhotoUrl ||
                        !!t.latestPhotoUrl ||
                        !!t.afterPhotoUrl ||
                        (Array.isArray(t.attachments) && t.attachments.length > 0);
                    return {
                        position: t.position,
                        detail: t.name, // stored task.name is the foreman "detail"
                        amount: t.amount,
                        hasImage,
                        decided: DECIDED_STATUSES.includes(t.status),
                    };
                }),
        })),
    };
}

// Convenience boolean for the draft card's button-visibility gate.
export function isWorkOrderComplete(wo: WorkOrder): boolean {
    return getSubmitBlockers(workOrderToCompletenessInput(wo)).length === 0;
}
