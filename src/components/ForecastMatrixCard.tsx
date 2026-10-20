import { useMemo, useState } from 'react';
import { Table2, X } from 'lucide-react';
import { forecastHorizon, FORECAST_META } from '../utils/draftSchedule';
import { formatDate } from '../utils/date';

// Director cross-table — "which foreman has planned work in which project?"
// Rows = projects, columns = foremen, each cell = how many drafts that foreman has in
// that project (darker = more). Answers the pairing question the ranked bar card can't:
// not "who is busiest" but "who is working where". Driven by the SAME saved drafts and
// the SAME single-source forecastHorizon (for the per-draft tag in the drill), so the
// two cards never disagree about a date.

// Decoupled shape — only the fields the matrix needs (same pattern as ForecastWorkloadCard).
interface PlanDraftLike {
    id: string;
    locationName?: string;
    appointmentDate?: string;
    projectId?: string;
    type?: string;
    woOwnerId?: string;
    categories?: { name?: string; assignedForemanId?: string }[];
}

interface ForecastMatrixCardProps {
    drafts: PlanDraftLike[];
    getProjectName: (id: string) => string;
    getForemanName: (id: string) => string;
    isMobile?: boolean;
}

const ACCENT = '#7c3aed';

// Same foreman-owner rule the dashboard uses elsewhere (PreHandover → primary
// category's foreman, else the WO owner).
const foremanIdOf = (d: PlanDraftLike): string | null =>
    d.type === 'PreHandover'
        ? (d.categories?.[0]?.assignedForemanId || d.woOwnerId || null)
        : (d.woOwnerId || null);

const whatOf = (d: PlanDraftLike): string => {
    const names = (d.categories || []).map((c) => c?.name).filter(Boolean) as string[];
    return names.length ? names.join(' · ') : 'ไม่ระบุงาน';
};

interface Axis { key: string; name: string; }
interface Cell { count: number; drafts: PlanDraftLike[]; }

// Shade a cell by how its count compares to the busiest cell (light → strong purple).
const shadeOf = (count: number, max: number): { bg: string; fg: string } => {
    if (!count) return { bg: 'transparent', fg: '#cbd5e1' };
    const t = count / max;
    if (t > 0.66) return { bg: ACCENT, fg: '#fff' };
    if (t > 0.33) return { bg: '#c4b5fd', fg: '#4c1d95' };
    return { bg: '#ede9fe', fg: '#5b21b6' };
};

export default function ForecastMatrixCard({ drafts, getProjectName, getForemanName, isMobile = false }: ForecastMatrixCardProps) {
    const [openCell, setOpenCell] = useState<{ proj: Axis; fore: Axis; drafts: PlanDraftLike[] } | null>(null);

    // Build project rows, foreman columns, and the cell counts in one pass.
    const { projects, foremen, cells, rowTotals, colTotals, maxCell, grandTotal } = useMemo(() => {
        const projMap = new Map<string, string>();
        const foreMap = new Map<string, string>();
        const cellMap = new Map<string, Cell>(); // key = `${projKey}|${foreKey}`
        for (const d of drafts) {
            const projKey = d.projectId || 'unknown';
            if (!projMap.has(projKey)) projMap.set(projKey, getProjectName(d.projectId || '') || 'ไม่ระบุโครงการ');
            const fid = foremanIdOf(d);
            const foreKey = fid || 'unassigned';
            if (!foreMap.has(foreKey)) foreMap.set(foreKey, fid ? (getForemanName(fid) || fid) : 'ยังไม่ระบุช่าง');
            const ck = `${projKey}|${foreKey}`;
            let c = cellMap.get(ck);
            if (!c) { c = { count: 0, drafts: [] }; cellMap.set(ck, c); }
            c.count++;
            c.drafts.push(d);
        }
        const rowTot = new Map<string, number>();
        const colTot = new Map<string, number>();
        let max = 1;
        for (const [ck, c] of cellMap) {
            const [pk, fk] = ck.split('|');
            rowTot.set(pk, (rowTot.get(pk) || 0) + c.count);
            colTot.set(fk, (colTot.get(fk) || 0) + c.count);
            if (c.count > max) max = c.count;
        }
        // Rank rows + columns by their totals (busiest first) so the heaviest work reads top-left.
        const projects: Axis[] = [...projMap.entries()]
            .map(([key, name]) => ({ key, name }))
            .sort((a, b) => (rowTot.get(b.key) || 0) - (rowTot.get(a.key) || 0));
        const foremen: Axis[] = [...foreMap.entries()]
            .map(([key, name]) => ({ key, name }))
            .sort((a, b) => (colTot.get(b.key) || 0) - (colTot.get(a.key) || 0));
        return { projects, foremen, cells: cellMap, rowTotals: rowTot, colTotals: colTot, maxCell: max, grandTotal: drafts.length };
    }, [drafts, getProjectName, getForemanName]);

    const firstCol = isMobile ? 84 : 120;
    const foreCol = isMobile ? 48 : 60;
    const gridCols = `${firstCol}px repeat(${foremen.length}, minmax(${foreCol}px, 1fr)) ${foreCol}px`;

    return (
        <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', padding: '1.25rem 1.4rem', marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: `${ACCENT}14`, color: ACCENT }}>
                    <Table2 size={18} />
                </span>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>สรุปโครงการ × ช่าง</h3>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, margin: '6px 0 0.9rem 0', lineHeight: 1.5 }}>
                งานที่ช่างร่างไว้ — ช่างคนไหนมีงานอยู่ที่โครงการไหน (ยิ่งเข้ม = งานยิ่งเยอะ) · เรียงงานเยอะสุดไว้มุมซ้ายบน · คลิกช่องเพื่อดูรายการ
            </div>

            {grandTotal === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>ยังไม่มีงานที่ร่างไว้</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '4px', alignItems: 'center', minWidth: 'fit-content' }}>
                        {/* Header row: blank corner + foreman names + total */}
                        <div />
                        {foremen.map((f) => (
                            <div key={f.key} title={f.name} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }}>
                                {f.name}
                            </div>
                        ))}
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#94a3b8', textAlign: 'center' }}>รวม</div>

                        {/* Body rows */}
                        {projects.map((p) => (
                            <FragmentRow
                                key={p.key}
                                proj={p}
                                foremen={foremen}
                                cells={cells}
                                maxCell={maxCell}
                                rowTotal={rowTotals.get(p.key) || 0}
                                onOpen={(fore, dr) => setOpenCell({ proj: p, fore, drafts: dr })}
                            />
                        ))}

                        {/* Footer: column totals */}
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#94a3b8', textAlign: 'right', paddingRight: '4px' }}>รวม</div>
                        {foremen.map((f) => (
                            <div key={f.key} style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.76rem', fontWeight: 800, color: '#334155', background: '#f8fafc', borderRadius: 6 }}>
                                {colTotals.get(f.key) || 0}
                            </div>
                        ))}
                        <div style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.76rem', fontWeight: 800, color: '#5b21b6', background: '#ede9fe', borderRadius: 6 }}>
                            {grandTotal}
                        </div>
                    </div>
                </div>
            )}

            {/* Drill modal — the drafts behind one cell (one foreman in one project) */}
            {openCell && (
                <div
                    onClick={() => setOpenCell(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>{openCell.fore.name} · {openCell.proj.name}</div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{openCell.drafts.length} งาน</div>
                            </div>
                            <button onClick={() => setOpenCell(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                <X size={18} style={{ flexShrink: 0 }} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
                            {[...openCell.drafts]
                                .sort((a, b) => (a.appointmentDate || '').localeCompare(b.appointmentDate || ''))
                                .map((d) => {
                                    const meta = FORECAST_META[forecastHorizon(d.appointmentDate)];
                                    return (
                                        <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '0.7rem 0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {d.locationName || 'ไม่ระบุสถานที่'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{whatOf(d)}</div>
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

// One project row: the project name cell + a cell per foreman + the row total.
function FragmentRow({ proj, foremen, cells, maxCell, rowTotal, onOpen }: {
    proj: Axis;
    foremen: Axis[];
    cells: Map<string, Cell>;
    maxCell: number;
    rowTotal: number;
    onOpen: (fore: Axis, drafts: PlanDraftLike[]) => void;
}) {
    return (
        <>
            <div title={proj.name} style={{ fontSize: '0.74rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {proj.name}
            </div>
            {foremen.map((f) => {
                const c = cells.get(`${proj.key}|${f.key}`);
                const count = c?.count || 0;
                const s = shadeOf(count, maxCell);
                return (
                    <div
                        key={f.key}
                        onClick={count ? () => onOpen(f, c!.drafts) : undefined}
                        title={count ? `${f.name} · ${proj.name}: ${count} งาน` : ''}
                        style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.bg, color: s.fg, border: '1px solid #f1f5f9', borderRadius: 6, fontSize: '0.8rem', fontWeight: count ? 800 : 400, cursor: count ? 'pointer' : 'default' }}
                    >
                        {count || '·'}
                    </div>
                );
            })}
            <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, color: '#334155', background: '#f8fafc', borderRadius: 6 }}>
                {rowTotal}
            </div>
        </>
    );
}
