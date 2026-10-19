// Single-source schedule classification for foreman draft plans.
// One rule for "is this planned draft overdue / due soon / still on time?" — reused by
// the draft filter bar (counts + chips) AND WorkOrderCard's overdue badge, so the
// definition never drifts between the summary and the card.

export const SOON_DAYS = 2;

export type DraftBucket = 'overdue' | 'soon' | 'ok' | 'none';

// Local YYYY-MM-DD (Thailand +7), matching the planned-date guard used in the form
// and the existing WorkOrderCard overdue calc.
export function todayLocalStr(): string {
    return new Date().toLocaleDateString('en-CA');
}

// Whole days from today to the planned date. Negative = already past (overdue).
export function daysUntil(appointmentDate: string, todayStr: string = todayLocalStr()): number {
    return Math.floor((Date.parse(appointmentDate) - Date.parse(todayStr)) / 86400000);
}

// THE rule (single source).
export function draftTimeBucket(appointmentDate?: string, todayStr: string = todayLocalStr()): DraftBucket {
    if (!appointmentDate) return 'none';
    if (appointmentDate < todayStr) return 'overdue';
    const d = daysUntil(appointmentDate, todayStr);
    if (d <= SOON_DAYS) return 'soon';
    return 'ok';
}

// Single source for chip + badge labels/colors (Thai labels; hex kept inline-friendly).
export const BUCKET_META: Record<Exclude<DraftBucket, 'none'>, { label: string; color: string; bg: string }> = {
    overdue: { label: 'เกินกำหนด', color: '#dc2626', bg: '#fef2f2' },
    soon: { label: 'ใกล้ถึง', color: '#d97706', bg: '#fffbeb' },
    ok: { label: 'ยังมีเวลา', color: '#16a34a', bg: '#f0fdf4' },
};
