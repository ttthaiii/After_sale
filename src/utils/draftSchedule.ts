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
    ok: { label: 'ตามกำหนด', color: '#16a34a', bg: '#f0fdf4' },
};

// ── Forecast lens ────────────────────────────────────────────────────────────
// A coarser, horizon-based view of the SAME planned dates, for the director
// forecast card ("which project/foreman has the most upcoming work?"). This is a
// different question than the foreman filter bar (overdue/soon/ok), so it gets its
// own 4-bucket scale — but it stays in THIS file and reuses daysUntil/todayLocalStr,
// so every date rule still lives in one place. "overdue" is identical to
// draftTimeBucket's (appt < today): the single source never forks.
// 'unplanned' = a saved draft the foreman has NOT given a planned date yet. It is
// its own horizon (not folded into any week) so the forecast card shows real work
// day-one, before foremen have adopted the planned-date field — the grey "ยังไม่ระบุ
// วันนัด" segment. A dated draft never lands here; an undated one always does.
export type ForecastHorizon = 'overdue' | 'thisWeek' | 'nextWeek' | 'later' | 'unplanned';

// Rolling windows anchored on today: thisWeek = within 7 days, nextWeek = day 8–14.
// No appointmentDate → 'unplanned' (the single source decides this too, so the card
// never re-implements the "has a date?" test).
export function forecastHorizon(appointmentDate?: string, todayStr: string = todayLocalStr()): ForecastHorizon {
    if (!appointmentDate) return 'unplanned';
    if (appointmentDate < todayStr) return 'overdue';
    const d = daysUntil(appointmentDate, todayStr);
    if (d <= 6) return 'thisWeek';
    if (d <= 13) return 'nextWeek';
    return 'later';
}

// Labels + colors for the forecast segments (overdue reuses the shared red;
// unplanned is a neutral grey so it reads as "no date yet", not a severity).
export const FORECAST_META: Record<ForecastHorizon, { label: string; color: string; bg: string }> = {
    overdue: { label: 'เกินกำหนด', color: BUCKET_META.overdue.color, bg: BUCKET_META.overdue.bg },
    thisWeek: { label: 'สัปดาห์นี้', color: '#d97706', bg: '#fffbeb' },
    nextWeek: { label: 'สัปดาห์หน้า', color: '#2563eb', bg: '#eff6ff' },
    later: { label: 'หลังจากนั้น', color: '#64748b', bg: '#f8fafc' },
    unplanned: { label: 'ยังไม่ระบุวันนัด', color: '#94a3b8', bg: '#f1f5f9' },
};
