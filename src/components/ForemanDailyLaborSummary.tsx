import { useMemo, useState } from 'react';
import { Users, CalendarDays } from 'lucide-react';
import type { WorkOrder, LaborRecord } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

// Foreman-only card: "สรุปการใช้คนงานประจำวัน".
// Reads labor straight from the foreman's own task history (workOrders[].categories[].tasks[].history[])
// — no new query, no schema change. Default day = today; ← → navigates, or tap the date for a calendar.
// Grouped BY work order (WO): each WO is its own block/header (not a repeated column). Inside a WO,
// each worker shows their own rows — one row per work item (never merged).
// Mobile-first (foremen mostly on phones): grouped table on desktop, per-worker cards on small screens.

interface Props {
    workOrders: WorkOrder[];
    currentUserId: string;
    currentEmployeeId?: string;
}

type DayStatus = 'green' | 'amber' | 'red';
// Calendar dot colours (solid) echo the 8h legend: green = full · amber = short · red = over.
const DOT_COLORS: Record<DayStatus, string> = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' };

// Local Y-M-D (NOT toISOString — that is UTC and would roll the day at 07:00 Thailand time).
const toDayStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

interface ShiftHours { normal: number; otMorning: number; otNoon: number; otEvening: number; }

// Duration (hours) of a "HH:MM - HH:MM" time range — the SAME calc the WOP daily-report detail
// pane trusts (mirrors DailyReportContext.tsx:272-281). applyLunch subtracts 1h when the range spans
// the 12:00–13:00 lunch break (normal day shift only — NOT OT noon "12:00 - 13:00").
const rangeHours = (range: string | undefined, applyLunch: boolean): number => {
    if (!range) return 0;
    const parts = range.split(' - ');
    if (parts.length < 2) return 0;
    const [sh, sm] = parts[0].split(':').map(Number);
    const [eh, em] = parts[1].split(':').map(Number);
    if (isNaN(sh) || isNaN(eh)) return 0;
    const start = sh + (isNaN(sm) ? 0 : sm) / 60;
    const end = eh + (isNaN(em) ? 0 : em) / 60;
    let diff = end - start;
    if (applyLunch && start <= 12 && end >= 13) diff -= 1;
    return Math.max(0, Math.round(diff * 100) / 100);
};

// ACTUAL hours per shift. Read the real time RANGES (shiftTimes) the way the detail pane does,
// NOT "Day ticked = 8h". Priority per shift: real time range → expectedHours → fixed constant
// (normal 8 / OT morning 2 / noon 1 / evening 3). A shift counts only when its boolean is on.
const hoursOf = (l: LaborRecord): ShiftHours => {
    const st = (l as any).shiftTimes as { day?: string; otMorning?: string; otNoon?: string; otEvening?: string } | undefined;
    const eh = (l as any).expectedHours as ShiftHours | undefined;
    const sh = l.shifts;
    const pick = (active: boolean | undefined, range: string | undefined, applyLunch: boolean, ehVal: number | undefined, fixed: number): number => {
        if (!active) return 0;
        const r = rangeHours(range, applyLunch);
        if (r > 0) return r;
        if (ehVal && ehVal > 0) return ehVal;
        return fixed;
    };
    if (sh) {
        return {
            normal: pick(sh.normal, st?.day, true, eh?.normal, 8),
            otMorning: pick(sh.otMorning, st?.otMorning, false, eh?.otMorning, 2),
            otNoon: pick(sh.otNoon, st?.otNoon, false, eh?.otNoon, 1),
            otEvening: pick(sh.otEvening, st?.otEvening, false, eh?.otEvening, 3),
        };
    }
    if (eh && (eh.normal || eh.otMorning || eh.otNoon || eh.otEvening)) {
        return { normal: eh.normal || 0, otMorning: eh.otMorning || 0, otNoon: eh.otNoon || 0, otEvening: eh.otEvening || 0 };
    }
    return { normal: l.timeType === 'Normal' ? 8 : 0, otMorning: 0, otNoon: 0, otEvening: 0 };
};

interface TaskLine { id: string; woId: string; woLocation: string; taskName: string; normal: number; otMorning: number; otNoon: number; otEvening: number; }
interface WorkerGroup { key: string; name: string; membership: 'Internal' | 'Outsource'; headcount: number; lines: TaskLine[]; }
// WO-first view: each WO is a group/header; inside it, its workers, each with their task rows.
// dailyNormal = the worker's WHOLE-DAY normal total (across all WOs) — keeps the 8h colour check
// correct even for a worker split across 2 WOs. Labelled "ปกติทั้งวัน" so it never reads as double.
interface WoWorker { key: string; name: string; membership: 'Internal' | 'Outsource'; headcount: number; dailyNormal: number; lines: TaskLine[]; }
interface WoGroup { woId: string; woLocation: string; workers: WoWorker[]; }

const lineTotal = (l: TaskLine) => l.normal + l.otMorning + l.otNoon + l.otEvening;
const groupNormal = (g: WorkerGroup) => g.lines.reduce((s, l) => s + l.normal, 0);
const groupTotal = (g: WorkerGroup) => g.lines.reduce((s, l) => s + lineTotal(l), 0);

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const CAL_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// Daily-normal colour: exactly 8h = full day (green) · under 8 = short (amber) · over 8 = over-logged (red).
const normalTone = (n: number): { fg: string; bg: string } => {
    if (Math.abs(n - 8) < 0.01) return { fg: '#15803d', bg: '#dcfce7' };
    if (n < 8) return { fg: '#b45309', bg: '#fef3c7' };
    return { fg: '#b91c1c', bg: '#fee2e2' };
};
const fmtHrs = (h: number): string => (h ? (Number.isInteger(h) ? String(h) : h.toFixed(1)) : '-');

// Self-contained month calendar (no date-picker dependency). Days that have the foreman's labor
// carry a coloured dot (green/amber/red = the 8h status). Tapping a day picks it.
const MiniCalendar = ({ value, statusMap, onPick }: { value: Date; statusMap: Map<string, DayStatus>; onPick: (d: Date) => void }) => {
    const [view, setView] = useState<Date>(() => new Date(value.getFullYear(), value.getMonth(), 1));
    const y = view.getFullYear();
    const m = view.getMonth();
    const startDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayS = toDayStr(new Date());
    const selS = toDayStr(value);
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 12px 32px rgba(15,23,42,0.16)', padding: '14px', width: '294px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <button onClick={() => setView(new Date(y, m - 1, 1))} aria-label="เดือนก่อนหน้า" style={calNavBtnStyle}><span style={navGlyphStyle}>‹</span></button>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{THAI_MONTHS[m]} {y + 543}</div>
                <button onClick={() => setView(new Date(y, m + 1, 1))} aria-label="เดือนถัดไป" style={calNavBtnStyle}><span style={navGlyphStyle}>›</span></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '2px' }}>
                {CAL_DOW.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: '0.64rem', color: '#94a3b8', fontWeight: 700, padding: '3px 0' }}>{w}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
                {cells.map((d, i) => {
                    if (d === null) return <div key={`e${i}`} />;
                    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const st = statusMap.get(ds);
                    const isSel = ds === selS;
                    const isToday = ds === todayS;
                    return (
                        <button key={d} onClick={() => onPick(new Date(y, m, d))} style={{ position: 'relative', height: '36px', borderRadius: '9px', border: isToday && !isSel ? '1px solid #c7d2fe' : '1px solid transparent', background: isSel ? '#4f46e5' : 'transparent', color: isSel ? '#fff' : '#334155', fontWeight: isSel ? 800 : 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {d}
                            {st && <span style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', width: '6px', height: '6px', borderRadius: '50%', background: isSel ? '#fff' : DOT_COLORS[st] }} />}
                        </button>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingTop: '9px', borderTop: '1px solid #f1f5f9', fontSize: '0.62rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                <LegendDot color="#15803d" bg="#dcfce7" label="ครบ 8" />
                <LegendDot color="#b45309" bg="#fef3c7" label="ไม่ถึง 8" />
                <LegendDot color="#b91c1c" bg="#fee2e2" label="เกิน 8" />
            </div>
        </div>
    );
};

const ForemanDailyLaborSummary = ({ workOrders, currentUserId, currentEmployeeId }: Props) => {
    const isMobile = useIsMobile();
    const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
    const [showCal, setShowCal] = useState(false);

    const dayStr = toDayStr(selectedDay);
    const todayStr = toDayStr(new Date());
    const isToday = dayStr === todayStr;

    const ownsTask = (responsibleStaffIds: string[] | undefined, reporterId: string | null | undefined): boolean => {
        const ids = (responsibleStaffIds && responsibleStaffIds.length ? responsibleStaffIds : [reporterId].filter(Boolean)) as string[];
        return ids.some(id => id === currentUserId || (currentEmployeeId ? id === currentEmployeeId : false));
    };

    const { woGroups, totalManHours, internalCount, outsourceCount, woCount } = useMemo(() => {
        const map = new Map<string, WorkerGroup>();
        const woSet = new Set<string>();

        (workOrders || []).forEach(wo => {
            (wo.categories || []).forEach(cat => {
                (cat.tasks || []).forEach(task => {
                    if (!ownsTask(task.responsibleStaffIds, wo.reporterId)) return;
                    (task.history || []).forEach(log => {
                        if (!log.date) return;
                        const d = new Date(log.date);
                        if (isNaN(d.getTime()) || toDayStr(d) !== dayStr) return;
                        (log.labor || []).forEach((lab: LaborRecord) => {
                            const membership = lab.membership === 'Outsource' ? 'Outsource' : 'Internal';
                            const ident = lab.staffId || lab.staffName || lab.affiliation || 'ไม่ระบุ';
                            const wKey = `${membership}::${ident}`;
                            const h = hoursOf(lab);
                            const amount = lab.amount || 1;
                            const taskName = task.name || task.taskCode || 'งานไม่ระบุชื่อ';
                            const taskKey = `${wo.id}::${task.id || taskName}`;
                            woSet.add(wo.id);

                            let g = map.get(wKey);
                            if (!g) {
                                g = { key: wKey, name: lab.staffName || lab.affiliation || 'ไม่ระบุชื่อ', membership, headcount: membership === 'Outsource' ? amount : 1, lines: [] };
                                map.set(wKey, g);
                            } else if (membership === 'Outsource') {
                                g.headcount = Math.max(g.headcount, amount);
                            }
                            let line = g.lines.find(l => l.id === taskKey);
                            if (!line) {
                                g.lines.push({ id: taskKey, woId: wo.id, woLocation: wo.locationName || '', taskName, normal: h.normal, otMorning: h.otMorning, otNoon: h.otNoon, otEvening: h.otEvening });
                            } else {
                                line.normal += h.normal; line.otMorning += h.otMorning; line.otNoon += h.otNoon; line.otEvening += h.otEvening;
                            }
                        });
                    });
                });
            });
        });

        const workers = Array.from(map.values());
        let manHours = 0, internal = 0, outsource = 0;
        workers.forEach(g => {
            manHours += groupTotal(g) * g.headcount;
            if (g.membership === 'Internal') internal += g.headcount; else outsource += g.headcount;
        });

        // Pivot worker-groups → WO-groups: WO is now the section header, not a repeated column.
        const woMap = new Map<string, WoGroup>();
        workers.forEach(g => {
            const dailyNormal = groupNormal(g); // whole-day normal for the 8h colour check
            g.lines.forEach(line => {
                let wg = woMap.get(line.woId);
                if (!wg) { wg = { woId: line.woId, woLocation: line.woLocation, workers: [] }; woMap.set(line.woId, wg); }
                if (!wg.woLocation && line.woLocation) wg.woLocation = line.woLocation;
                let w = wg.workers.find(x => x.key === g.key);
                if (!w) { w = { key: g.key, name: g.name, membership: g.membership, headcount: g.headcount, dailyNormal, lines: [] }; wg.workers.push(w); }
                w.lines.push(line);
            });
        });
        const woArr = Array.from(woMap.values()).sort((a, b) => {
            const sum = (wg: WoGroup) => wg.workers.reduce((s, w) => s + w.lines.reduce((t, l) => t + lineTotal(l), 0), 0);
            return sum(b) - sum(a);
        });

        return { woGroups: woArr, totalManHours: manHours, internalCount: internal, outsourceCount: outsource, woCount: woSet.size };
    }, [workOrders, dayStr, currentUserId, currentEmployeeId]);

    // Per-day status across ALL of the foreman's labor (any date) → drives the calendar dots.
    // Aggregate each worker's normal hours per day; a day is red if anyone is over 8, amber if
    // anyone is short of 8, else green. Priority red > amber > green (spot the problem days).
    const dayStatusMap = useMemo(() => {
        const perDay = new Map<string, Map<string, number>>();
        (workOrders || []).forEach(wo => {
            (wo.categories || []).forEach(cat => {
                (cat.tasks || []).forEach(task => {
                    if (!ownsTask(task.responsibleStaffIds, wo.reporterId)) return;
                    (task.history || []).forEach(log => {
                        if (!log.date) return;
                        const d = new Date(log.date);
                        if (isNaN(d.getTime())) return;
                        const ds = toDayStr(d);
                        (log.labor || []).forEach((lab: LaborRecord) => {
                            const membership = lab.membership === 'Outsource' ? 'Outsource' : 'Internal';
                            const ident = lab.staffId || lab.staffName || lab.affiliation || 'ไม่ระบุ';
                            const wKey = `${membership}::${ident}`;
                            const h = hoursOf(lab);
                            let dm = perDay.get(ds);
                            if (!dm) { dm = new Map(); perDay.set(ds, dm); }
                            dm.set(wKey, (dm.get(wKey) || 0) + h.normal);
                        });
                    });
                });
            });
        });
        const out = new Map<string, DayStatus>();
        perDay.forEach((dm, ds) => {
            let over = false, short = false, any = false;
            dm.forEach(n => { any = true; if (n > 8.01) over = true; else if (n < 7.99) short = true; });
            if (any) out.set(ds, over ? 'red' : short ? 'amber' : 'green');
        });
        return out;
    }, [workOrders, currentUserId, currentEmployeeId]);

    const hasData = woGroups.length > 0;
    const shiftDay = (delta: number) => setSelectedDay(prev => { const n = new Date(prev); n.setDate(n.getDate() + delta); return n; });
    const dateLabel = `${selectedDay.getDate()} ${THAI_MONTHS[selectedDay.getMonth()]} ${selectedDay.getFullYear() + 543}`;

    const membershipBadge = (m: 'Internal' | 'Outsource') => (
        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap', background: m === 'Internal' ? '#eef2ff' : '#fff7ed', color: m === 'Internal' ? '#4f46e5' : '#c2410c' }}>{m === 'Internal' ? 'ภายใน' : 'รับเหมา'}</span>
    );
    const dailyNormalPill = (n: number) => {
        const t = normalTone(n);
        return <span style={{ display: 'inline-block', minWidth: '34px', textAlign: 'center', padding: '3px 9px', borderRadius: '8px', fontWeight: 800, background: t.bg, color: t.fg }}>{fmtHrs(n)}</span>;
    };
    const otCellStyle = (v: number) => ({ ...tdNum, color: v ? '#0369a1' : '#cbd5e1' });

    // WO header chip — shared by desktop + mobile so a WO reads the same everywhere.
    const WoHeader = ({ wg, compact }: { wg: WoGroup; compact?: boolean }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '6px' : '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: compact ? '0.66rem' : '0.7rem', fontWeight: 800, color: '#6366f1', background: '#eef2ff', padding: '3px 8px', borderRadius: '6px' }}>ใบงาน</span>
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: compact ? '0.85rem' : '0.9rem' }}>{wg.woId}</span>
            {wg.woLocation && <span style={{ color: '#94a3b8', fontSize: compact ? '0.74rem' : '0.8rem' }}>· {wg.woLocation}</span>}
        </div>
    );

    return (
        <div style={{ gridColumn: '1/-1', background: '#ffffff', borderRadius: '32px', padding: isMobile ? '1.25rem' : '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '2.5rem' }}>
            {/* Header + date navigator */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)', padding: '12px', borderRadius: '16px', color: '#fff', display: 'flex' }}><Users size={24} /></div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>สรุปการใช้คนงานประจำวัน</h3>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>วันนี้ใช้ใครไปบ้าง ทำงานอะไร กี่ ชม.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                    <button onClick={() => shiftDay(-1)} aria-label="วันก่อนหน้า" style={navBtnStyle}><span style={navGlyphStyle}>‹</span></button>
                    <button onClick={() => setShowCal(v => !v)} aria-label="เลือกวันที่จากปฏิทิน" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: isMobile ? '132px' : '154px', justifyContent: 'center', fontWeight: 800, color: '#334155', fontSize: '0.9rem', padding: '7px 10px', borderRadius: '10px', border: `1px solid ${showCal ? '#c7d2fe' : '#e5e7eb'}`, background: showCal ? '#eef2ff' : '#f9fafb', cursor: 'pointer' }}>
                        <CalendarDays size={16} color="#6366f1" /> {dateLabel}
                    </button>
                    <button onClick={() => shiftDay(1)} disabled={isToday} aria-label="วันถัดไป" style={{ ...navBtnStyle, opacity: isToday ? 0.4 : 1, cursor: isToday ? 'not-allowed' : 'pointer' }}><span style={navGlyphStyle}>›</span></button>
                    {!isToday && <button onClick={() => setSelectedDay(new Date())} style={{ padding: '7px 12px', borderRadius: '10px', border: '1px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>วันนี้</button>}
                    {showCal && (
                        <>
                            <div onClick={() => setShowCal(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                            <MiniCalendar value={selectedDay} statusMap={dayStatusMap} onPick={(d) => { setSelectedDay(d); setShowCal(false); }} />
                        </>
                    )}
                </div>
            </div>

            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px', marginBottom: hasData ? '1.25rem' : 0 }}>
                <SummaryStat label="คนงานที่ใช้" value={`${internalCount + outsourceCount} คน`} accent="#4f46e5" />
                <SummaryStat label="ภายใน / รับเหมา" value={`${internalCount} / ${outsourceCount}`} accent="#0ea5e9" />
                <SummaryStat label="ชม. รวม (man-hours)" value={`${fmtHrs(totalManHours)} ชม.`} accent="#f59e0b" />
                <SummaryStat label="ใบงานที่ทำ" value={`${woCount} ใบ`} accent="#10b981" />
            </div>

            {hasData && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', fontSize: '0.72rem', color: '#64748b' }}>
                    <span style={{ fontWeight: 700 }}>ปกติทั้งวัน:</span>
                    <LegendDot color="#15803d" bg="#dcfce7" label="ครบ 8 ชม." />
                    <LegendDot color="#b45309" bg="#fef3c7" label="ไม่ถึง 8 ชม." />
                    <LegendDot color="#b91c1c" bg="#fee2e2" label="เกิน 8 ชม. (เช็ค)" />
                </div>
            )}

            {!hasData ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                    <Users size={28} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{isToday ? 'ยังไม่มีการบันทึกคนงานวันนี้' : 'ไม่มีการบันทึกคนงานในวันนี้'}</p>
                </div>
            ) : isMobile ? (
                // Mobile: WO section header, then per-worker cards inside (WO not repeated per line)
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {woGroups.map(wg => (
                        <div key={wg.woId}>
                            <div style={{ marginBottom: '8px' }}><WoHeader wg={wg} compact /></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {wg.workers.map(w => (
                                    <div key={w.key} style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #e2e8f0' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{w.name}{w.membership === 'Outsource' && w.headcount > 1 ? ` (${w.headcount} คน)` : ''}</span>
                                                {membershipBadge(w.membership)}
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, marginBottom: '3px' }}>ปกติทั้งวัน</div>
                                                {dailyNormalPill(w.dailyNormal)}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {w.lines.map(line => (
                                                <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{line.taskName}</div>
                                                        {(line.otMorning || line.otNoon || line.otEvening) ? (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
                                                                {line.otMorning ? <OtChip label="OT เช้า" v={line.otMorning} /> : null}
                                                                {line.otNoon ? <OtChip label="OT เที่ยง" v={line.otNoon} /> : null}
                                                                {line.otEvening ? <OtChip label="OT เย็น" v={line.otEvening} /> : null}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{fmtHrs(line.normal)}</div>
                                                        <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>ปกติ (ชม.)</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // Desktop: one block per WO — WO header on top, worker rows inside (no repeated WO column)
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {woGroups.map(wg => (
                        <div key={wg.woId} style={{ border: '1px solid #e5e9f0', borderRadius: '18px', overflow: 'hidden' }}>
                            <div style={{ padding: '11px 16px', background: '#f8fafc', borderBottom: '1px solid #eef2f7' }}><WoHeader wg={wg} /></div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', minWidth: '680px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800 }}>
                                            <th style={thStyle}>คนงาน</th>
                                            <th style={thStyle}>งานที่ทำ</th>
                                            <th style={thNum}>ปกติ</th>
                                            <th style={thNum}>OT เช้า</th>
                                            <th style={thNum}>OT เที่ยง</th>
                                            <th style={thNum}>OT เย็น</th>
                                            <th style={{ ...thNum, textAlign: 'center' }}>ปกติทั้งวัน</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            // Zebra by ROW (running index across the whole WO table), not by worker.
                                            let rowN = -1;
                                            return wg.workers.map(w => w.lines.map((line, idx) => {
                                                rowN += 1;
                                                const stripe = rowN % 2 === 1;
                                                return (
                                                    <tr key={line.id} style={{ background: stripe ? '#f8fafc' : '#ffffff', borderTop: idx === 0 ? '2px solid #eef2f7' : '1px solid #f1f5f9' }}>
                                                        {idx === 0 && (
                                                            <td rowSpan={w.lines.length} style={{ ...tdStyle, borderRight: '1px solid #f1f5f9', minWidth: '160px', verticalAlign: 'middle', background: stripe ? '#f8fafc' : '#ffffff' }}>
                                                                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>{w.name}{w.membership === 'Outsource' && w.headcount > 1 ? ` (${w.headcount} คน)` : ''}</div>
                                                                <div>{membershipBadge(w.membership)}</div>
                                                            </td>
                                                        )}
                                                        <td style={{ ...tdStyle, color: '#334155' }}>{line.taskName}</td>
                                                        <td style={{ ...tdNum, fontWeight: 700, color: '#0f172a' }}>{fmtHrs(line.normal)}</td>
                                                        <td style={otCellStyle(line.otMorning)}>{fmtHrs(line.otMorning)}</td>
                                                        <td style={otCellStyle(line.otNoon)}>{fmtHrs(line.otNoon)}</td>
                                                        <td style={otCellStyle(line.otEvening)}>{fmtHrs(line.otEvening)}</td>
                                                        {idx === 0 && (
                                                            <td rowSpan={w.lines.length} style={{ ...tdNum, textAlign: 'center', verticalAlign: 'middle', borderLeft: '1px solid #eef2f7', background: stripe ? '#f8fafc' : '#ffffff' }}>
                                                                {dailyNormalPill(w.dailyNormal)}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            }));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const navBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' } as const;
const calNavBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' } as const;
const navGlyphStyle = { fontSize: '20px', fontWeight: 900, lineHeight: 1, color: '#475569' } as const;
const thStyle = { padding: '8px 10px' } as const;
const thNum = { padding: '8px 10px', textAlign: 'right' } as const;
const tdStyle = { padding: '11px 10px', verticalAlign: 'top' } as const;
const tdNum = { padding: '11px 10px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' } as const;

const OtChip = ({ label, v }: { label: string; v: number }) => (
    <span style={{ padding: '2px 7px', borderRadius: '6px', background: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.7rem' }}>{label} {fmtHrs(v)} ชม.</span>
);
const LegendDot = ({ color, bg, label }: { color: string; bg: string; label: string }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: bg, border: `1px solid ${color}33` }} /><span style={{ color }}>{label}</span>
    </span>
);
const SummaryStat = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
    <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: '14px', padding: '12px 14px' }}>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: accent }}>{value}</div>
    </div>
);

export default ForemanDailyLaborSummary;
