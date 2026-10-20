import { useMemo, useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { forecastHorizon, FORECAST_META, type ForecastHorizon } from '../utils/draftSchedule';
import { formatDate } from '../utils/date';

// Director forecast card — "which project / foreman has the most UPCOMING planned work?"
// Driven purely by the foreman-planned appointmentDate on saved drafts, classified by
// the single-source forecastHorizon() (overdue / this week / next week / later).
// Mirrors the look of the two existing dashboard sections (ranked horizontal bars,
// counts inside the segments, click a row to drill into the detail).

// Decoupled shape — we only read the few fields the forecast needs, so the card is not
// bound to the full WorkOrder type (same pattern as DraftFilterBar).
interface PlanDraftLike {
    id: string;
    locationName?: string;
    appointmentDate?: string;
    projectId?: string;
    type?: string;
    woOwnerId?: string;
    categories?: { name?: string; assignedForemanId?: string }[];
}

interface ForecastWorkloadCardProps {
    drafts: PlanDraftLike[];
    getProjectName: (id: string) => string;
    getForemanName: (id: string) => string;
    isMobile?: boolean;
}

type Mode = 'project' | 'foreman';

// Forecast's foreman-owner rule — same shape the dashboard uses elsewhere
// (PreHandover → primary category's foreman, else the WO owner).
const foremanIdOf = (d: PlanDraftLike): string | null =>
    d.type === 'PreHandover'
        ? (d.categories?.[0]?.assignedForemanId || d.woOwnerId || null)
        : (d.woOwnerId || null);

// Concise "what" for a draft — the category names (falls back to a generic label).
const whatOf = (d: PlanDraftLike): string => {
    const names = (d.categories || []).map((c) => c?.name).filter(Boolean) as string[];
    return names.length ? names.join(' · ') : 'ไม่ระบุงาน';
};

const HORIZONS: ForecastHorizon[] = ['overdue', 'thisWeek', 'nextWeek', 'later', 'unplanned'];
const ACCENT = '#7c3aed';

interface GroupRow {
    key: string;
    name: string;
    total: number;
    counts: Record<ForecastHorizon, number>;
    drafts: PlanDraftLike[];
}

export default function ForecastWorkloadCard({ drafts, getProjectName, getForemanName, isMobile = false }: ForecastWorkloadCardProps) {
    const [mode, setMode] = useState<Mode>('project');
    const [openGroup, setOpenGroup] = useState<GroupRow | null>(null);

    // Build ranked groups for the active axis. Recomputes when the data or axis changes.
    const rows = useMemo<GroupRow[]>(() => {
        const map = new Map<string, GroupRow>();
        for (const d of drafts) {
            let key: string;
            let name: string;
            if (mode === 'project') {
                key = d.projectId || 'unknown';
                name = getProjectName(d.projectId || '') || 'ไม่ระบุโครงการ';
            } else {
                const fid = foremanIdOf(d);
                key = fid || 'unassigned';
                name = fid ? (getForemanName(fid) || fid) : 'ยังไม่ระบุช่าง';
            }
            let g = map.get(key);
            if (!g) {
                g = { key, name, total: 0, counts: { overdue: 0, thisWeek: 0, nextWeek: 0, later: 0, unplanned: 0 }, drafts: [] };
                map.set(key, g);
            }
            g.counts[forecastHorizon(d.appointmentDate)]++;
            g.total++;
            g.drafts.push(d);
        }
        return [...map.values()].sort((a, b) => b.total - a.total);
    }, [drafts, mode, getProjectName, getForemanName]);

    const maxTotal = Math.max(1, ...rows.map((r) => r.total));
    const otherAxisLabel = mode === 'project' ? 'ช่าง' : 'โครงการ';

    return (
        <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', padding: '1.25rem 1.4rem', marginBottom: '1.75rem' }}>
            {/* Header + axis toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: `${ACCENT}14`, color: ACCENT }}>
                        <CalendarClock size={18} />
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>คาดการณ์ภาระงานล่วงหน้า</h3>
                </div>
                <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
                    {([
                        { v: 'project', t: 'ตามโครงการ' },
                        { v: 'foreman', t: 'ตามช่าง' },
                    ] as const).map((b) => (
                        <button
                            key={b.v}
                            onClick={() => setMode(b.v)}
                            style={{
                                border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px 14px',
                                fontSize: '0.78rem', fontWeight: 800, fontFamily: 'inherit',
                                background: mode === b.v ? ACCENT : 'transparent',
                                color: mode === b.v ? '#fff' : '#64748b',
                                boxShadow: mode === b.v ? `0 2px 6px ${ACCENT}40` : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            {b.t}
                        </button>
                    ))}
                </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, margin: '6px 0 0.6rem 0', lineHeight: 1.5 }}>
                แต่ละแท่ง = งานที่ช่างร่างไว้ของ{mode === 'project' ? 'โครงการ' : 'ช่าง'}นั้น · แยกตามช่วงเวลา (เกินกำหนด → สัปดาห์นี้ ภายใน 7 วัน → สัปดาห์หน้า วันที่ 8–14 → หลังจากนั้น → ยังไม่ระบุวันนัด) · เรียงงานเยอะสุดขึ้นก่อน · คลิกเพื่อดูรายการ
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '0 0 0.9rem 0', fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>
                {HORIZONS.map((h) => (
                    <span key={h} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 11, height: 11, borderRadius: 3, background: FORECAST_META[h].color }} />{FORECAST_META[h].label}
                    </span>
                ))}
            </div>

            {rows.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>ยังไม่มีงานที่วางแผนล่วงหน้า</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '340px', paddingRight: '4px' }}>
                    {rows.map((r) => {
                        const barPct = (r.total / maxTotal) * 100;
                        const segs = HORIZONS.map((h) => ({ h, v: r.counts[h] })).filter((s) => s.v > 0);
                        const tip = `${r.name}\n` + HORIZONS.map((h) => `${FORECAST_META[h].label} ${r.counts[h]}`).join(' · ') + `\nรวม ${r.total} งาน`;
                        return (
                            <div
                                key={r.key}
                                onClick={() => setOpenGroup(r)}
                                title={tip}
                                style={{ display: 'grid', gridTemplateColumns: isMobile ? '110px 1fr 70px' : '150px 1fr 90px', alignItems: 'center', gap: '10px', cursor: 'pointer', minHeight: '44px', padding: '0 4px', borderRadius: '8px' }}
                                onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {r.counts.overdue > 0 ? '🔴 ' : ''}{r.name}
                                </div>
                                {/* Bar track */}
                                <div style={{ width: '100%', height: '22px', background: '#f1f5f9', borderRadius: '7px', overflow: 'hidden', display: 'flex' }}>
                                    <div style={{ display: 'flex', width: `${barPct}%`, minWidth: '8px', height: '100%' }}>
                                        {segs.map((s) => (
                                            <div
                                                key={s.h}
                                                title={`${FORECAST_META[s.h].label} ${s.v}`}
                                                style={{ width: `${(s.v / r.total) * 100}%`, background: FORECAST_META[s.h].color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.66rem', fontWeight: 800, overflow: 'hidden' }}
                                            >
                                                {s.v}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* End label */}
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>{r.total} งาน</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Drill modal — concise tracking summary of the group's drafts */}
            {openGroup && (
                <div
                    onClick={() => setOpenGroup(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>{mode === 'project' ? 'โครงการ' : 'ช่าง'}</div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{openGroup.name} · {openGroup.total} งาน</div>
                            </div>
                            <button onClick={() => setOpenGroup(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                <X size={18} style={{ flexShrink: 0 }} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
                            {[...openGroup.drafts]
                                .sort((a, b) => (a.appointmentDate || '').localeCompare(b.appointmentDate || ''))
                                .map((d) => {
                                    const h = forecastHorizon(d.appointmentDate);
                                    const meta = FORECAST_META[h];
                                    const otherName = mode === 'project'
                                        ? (() => { const fid = foremanIdOf(d); return fid ? getForemanName(fid) : 'ยังไม่ระบุช่าง'; })()
                                        : getProjectName(d.projectId || '') || 'ไม่ระบุโครงการ';
                                    return (
                                        <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '0.7rem 0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {d.locationName || 'ไม่ระบุสถานที่'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{whatOf(d)}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{otherAxisLabel}: {otherName}</div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>{d.appointmentDate ? formatDate(d.appointmentDate) : '—'}</div>
                                                <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '0.66rem', fontWeight: 800, color: meta.color, background: meta.bg, borderRadius: '6px', padding: '1px 8px' }}>{meta.label}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
