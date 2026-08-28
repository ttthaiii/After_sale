import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, ShieldAlert, ClipboardList, CheckCircle2,
    AlertTriangle, Timer, LifeBuoy, Bell, ChevronRight, X, Target, Users
} from 'lucide-react';
import { computeJobSLA, getCountedSubtasks, confirmedProgress } from '../utils/jobSla';
import { getSatisfactionAverage } from '../utils/satisfaction';
import TaskHistoryModal from '../components/TaskHistoryModal';
import type { WorkOrderType } from '../types';

// Unified status/severity palette — the SINGLE source for every chart color on this
// page. Calm 4-5 level scale; neutral slate scaffold + brand indigo headers stay
// OUTSIDE this scale (they are chrome, not data). Change a level here -> whole page.
const LV = {
    good:   '#16a34a', // ดี — เสร็จตรงเวลา / ในกำหนด
    watch:  '#f59e0b', // เฝ้าดู — เสร็จช้า / ใกล้ครบ / เลย 1-3 วัน
    warn:   '#ea580c', // เตือน — เลย 4-7 วัน (ขั้นกลางของ aging)
    normal: '#2563eb', // ปกติ — กำลังทำ ยังไม่ถึงกำหนด (น้ำเงินสุภาพ)
    bad:    '#dc2626', // แย่ — เลยกำหนด / เลย >7 วัน
};

// Shared SLA status -> Thai label + colors (single visual convention across blocks).
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    'on-time':      { label: 'ตรงเวลา',   color: LV.good,   bg: '#d1fae5' },
    'late':         { label: 'เสร็จช้า',   color: LV.watch,  bg: '#fef3c7' },
    'overdue':      { label: 'เลยกำหนด',  color: LV.bad,    bg: '#fee2e2' },
    'critical':     { label: 'ใกล้ครบ',   color: LV.watch,  bg: '#fef3c7' },
    'normal':       { label: 'ปกติ',      color: LV.normal, bg: '#dbeafe' },
    'not-eligible': { label: 'ยังไม่คิด',  color: '#64748b', bg: '#f1f5f9' },
};

// One KPI card — big number + label + a one-line "how to read it" helper (R-B),
// clickable to drill into the relevant SLAMonitor view (R-C).
const KpiCard = ({ icon, value, unit, label, help, accent, onClick, sub }: {
    icon: any; value: any; unit?: string; label: string; help: string; accent: string; onClick?: () => void; sub?: string;
}) => (
    <div
        onClick={onClick}
        style={{
            flex: '1 1 180px', minWidth: '180px', background: '#ffffff', borderRadius: '18px',
            border: '1px solid #e2e8f0', padding: '1.2rem 1.35rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', cursor: onClick ? 'pointer' : 'default',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseOver={(e) => {
            if (!onClick) return;
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 20px -6px rgba(0,0,0,0.12)';
        }}
        onMouseOut={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.04)';
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: accent }}>
            {icon}
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b' }}>{label}</span>
        </div>
        <div style={{ marginTop: '0.55rem', fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
            {value}{unit && <span style={{ fontSize: '1rem', fontWeight: 800, color: '#94a3b8', marginLeft: 4 }}>{unit}</span>}
        </div>
        {sub && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.86rem', fontWeight: 800, color: accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sub}
            </div>
        )}
        <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, lineHeight: 1.4 }}>
            {help}
        </div>
    </div>
);

// Section header with a colored left-accent bar (the pro-dashboard signature).
// Single source for every block title so they stay visually identical.
const SectionTitle = ({ icon, title, accent = '#4f46e5' }: { icon: any; title: string; accent?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ width: 4, height: 22, borderRadius: 3, background: accent, flexShrink: 0 }} />
        <span style={{ color: accent, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>{title}</span>
    </div>
);

// Subtask status chip — pure mapping of EXISTING task fields (t.status /
// CONFIRMED progress) to a Thai label + colors. NOT a new SLA rule; just a display
// of the fields the app already tracks per subtask. Progress reads via
// confirmedProgress (submitted daily reports only; draft ignored — user rule
// 2026-08-19) so a draft-only save keeps the subtask in "มอบหมาย", consistent
// with SLAMonitor / Dashboard.
const subChip = (t: any): { label: string; color: string; bg: string } => {
    const prog = confirmedProgress(t);
    const st = t?.status;
    if (st === 'Complete' || prog >= 100) return { label: 'เสร็จ', color: '#059669', bg: '#d1fae5' };
    if (st === 'For Checking')            return { label: 'รอตรวจ', color: '#7c3aed', bg: '#ede9fe' };
    if (st === 'pending_delivery')        return { label: 'รอส่งมอบ', color: '#0891b2', bg: '#cffafe' };
    // Work has actually started (foreman logged progress) -> show %, even if the
    // workflow `status` field is still 'Assigned' (status lags behind daily reports).
    if (prog > 0)                         return { label: `${prog}%`, color: '#d97706', bg: '#fef3c7' };
    // Not-yet-started (0% confirmed) — show "0%" explicitly so the progress column is
    // never blank (user request 2026-08-19). Covers both Assigned and In Progress.
    if (st === 'In Progress' || st === 'Assigned') return { label: '0%', color: '#475569', bg: '#f1f5f9' };
    return { label: st || '—', color: '#64748b', bg: '#f1f5f9' };
};

// Reusable read-only drill-down modal (R-C): lists the SUBTASKS behind a clicked
// project / foreman / aging bucket / alert. Each row opens the shared rich
// TaskHistoryModal (ประวัติการปฏิบัติงาน) IN-PAGE via onPick — no page jump.
const JobListModal = ({ data, onClose, onPick }: any) => {
    if (!data) return null;
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '880px', maxHeight: '82vh', display: 'flex', flexDirection: 'column',
                    background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.1rem 1.4rem', borderBottom: '1px solid #f1f5f9',
                }}>
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>{data.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                            {data.subs.length} รายการงานย่อย · คลิกเพื่อดูประวัติการปฏิบัติงาน
                        </div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: '10px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        <X size={18} />
                    </button>
                </div>
                <div style={{ overflowY: 'auto', padding: '0.5rem 0' }}>
                    {data.subs.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>ไม่มีงานย่อยในกลุ่มนี้</div>
                    ) : data.subs.map((s: any, i: number) => {
                        const chip = subChip(s);
                        // REQ-2/3: per-row SLA badge (ปกติ/ใกล้ครบ/เลยกำหนด/ตรงเวลา/เสร็จช้า)
                        // + days-remaining, sourced from the job-level SLA attached in subRows.
                        const sla = s._sla;
                        const slaMeta = sla ? STATUS_META[sla.status] : null;
                        const daysText = !sla ? null
                            : sla.phase === 'done' ? 'เสร็จแล้ว'
                            : sla.daysDiff < 0 ? `เหลือ ${-sla.daysDiff} วัน`
                            : sla.daysDiff === 0 ? 'ครบกำหนดวันนี้'
                            : `เลย ${sla.daysDiff} วัน`;
                        const daysColor = !sla || sla.phase === 'done' ? '#94a3b8'
                            : sla.daysDiff > 0 ? '#dc2626'
                            : sla.daysDiff === 0 ? '#d97706'
                            : '#0891b2';
                        return (
                            <div
                                key={(s._woId || '') + (s.id || s.taskName || '') + i}
                                onClick={() => onPick(s)}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.7rem 1.4rem', cursor: 'pointer', borderTop: i === 0 ? 'none' : '1px solid #f8fafc' }}
                                onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                {/* Fixed-width columns so every row aligns vertically (user request
                                    2026-08-19): [ % ] [ WOA/WOP ] [ SLA badge + days-remaining ] [ detail ]. */}
                                {/* Col 1 — progress % (incl. 0%) */}
                                <span style={{ flexShrink: 0, width: '54px', textAlign: 'center', padding: '4px 0', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 900, color: chip.color, background: chip.bg }}>
                                    {chip.label}
                                </span>
                                {/* Col 2 — work-order type */}
                                <span style={{ flexShrink: 0, width: '40px', textAlign: 'center', fontSize: '0.66rem', fontWeight: 800, color: '#64748b', background: '#f1f5f9', borderRadius: '6px', padding: '3px 0' }}>
                                    {s._type === 'PreHandover' ? 'WOP' : 'WOA'}
                                </span>
                                {/* Col 3 — SLA status + days-remaining, stacked */}
                                <div style={{ flexShrink: 0, width: '100px', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                    {slaMeta && (
                                        <span style={{ fontSize: '0.66rem', fontWeight: 900, color: slaMeta.color, background: slaMeta.bg, borderRadius: '6px', padding: '2px 6px' }}>
                                            {slaMeta.label}
                                        </span>
                                    )}
                                    {daysText && (
                                        <span style={{ fontSize: '0.64rem', fontWeight: 800, color: daysColor, whiteSpace: 'nowrap', paddingLeft: '2px' }}>
                                            {daysText}
                                        </span>
                                    )}
                                </div>
                                {/* Detail */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {s.taskName}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                                        {s._woId} {s.locationName && <span>· {s.locationName}</span>} · {s.projectName}
                                    </div>
                                </div>
                                <ChevronRight size={16} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// Director / admin overview dashboard — a NEW decision-focused page.
// It does NOT duplicate the existing /dashboard; it owns the net-new views
// (alert bar, project bubble-comparison, on-time trend, aging, foreman at-risk).
// All numbers derive from the same single-source helpers as the rest of the app
// (WorkOrderContext + computeJobSLA), so figures stay consistent app-wide.

// Roles allowed to see the director view. 'Director' = ผอ. (already exists in the
// role model); admins/managers/approvers share the same decision-level view.
const DIRECTOR_ROLES = ['Admin', 'Manager', 'Director', 'Approver'];

const DirectorDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { workOrders, projects, staff, loading } = useWorkOrders();

    // Role gate — a foreman (or unknown) landing here gets a friendly block,
    // not a broken page.
    const allowed = !!user && DIRECTOR_ROLES.includes(user.role);

    // Reused single-source lookups (same shape the existing dashboards use).
    const getProjectName = (id: string) =>
        projects.find((p: any) => p.id === id)?.name || id;
    const activeForemen = useMemo(
        () => staff.filter((s: any) => s.role === 'Foreman'),
        [staff]
    );

    // Work-type filter (ทั้งหมด/หลังขาย/ก่อนโอน). SINGLE-SOURCE: one scoped WO list
    // feeds the agg memo + every drill-down, so switching type re-scopes the WHOLE
    // page (summary cards + project chart + foreman block) from ONE input point.
    const [woTypeFilter, setWoTypeFilter] = useState<'all' | WorkOrderType>('all');
    const scopedWOs = useMemo(
        () => woTypeFilter === 'all'
            ? workOrders
            : workOrders.filter((w: any) => w.type === woTypeFilter),
        [workOrders, woTypeFilter]
    );

    // ── S2 · Aggregation layer (the brain) ────────────────────────────────────
    // ONE memo that turns raw WorkOrders into everything the blocks below read.
    // Every schedule metric comes from computeJobSLA (single source) so numbers
    // match the rest of the app. Recomputes only when data changes.
    const agg = useMemo(() => {
        const DAY = 86400000;
        const now = Date.now();

        // Primary owner of a JOB (avoid double-count): WOA -> wo.woOwnerId;
        // WOP -> its primary category's assignedForemanId (fallback woOwnerId).
        // Helpers are tallied separately, not in the main load.
        const primaryForemanId = (wo: any): string | null =>
            wo?.type === 'PreHandover'
                ? (wo?.categories?.[0]?.assignedForemanId || wo?.woOwnerId || null)
                : (wo?.woOwnerId || null);

        // Latest activity across a job's task history (for "stalled" detection).
        const lastActivityMs = (wo: any): number | null => {
            let m: number | null = null;
            (wo?.categories || []).forEach((c: any) => (c?.tasks || []).forEach((t: any) => {
                (t?.history || []).forEach((h: any) => {
                    const d = new Date(h?.date).getTime();
                    if (!isNaN(d) && (m === null || d > m)) m = d;
                });
            }));
            if (wo?.completedAt) {
                const d = new Date(wo.completedAt).getTime();
                if (!isNaN(d) && (m === null || d > m)) m = d;
            }
            return m;
        };

        const proj: Record<string, any> = {};
        const fore: Record<string, any> = {};
        activeForemen.forEach((f: any) => {
            fore[f.id] = { id: f.id, name: f.name, load: 0, late: 0, stalled: 0, helping: 0 };
        });

        let totalJobs = 0, doneJobs = 0, onTimeJobs = 0, lateJobs = 0, overdueJobs = 0;
        let dueSoonJobs = 0; // Q6 — open jobs overdue OR due within 3 days

        scopedWOs.forEach((wo: any) => {
            const sla = computeJobSLA(wo);
            if (!sla.isEligible) return; // not gradeable -> excluded everywhere
            totalJobs++;

            const pid = wo.projectId || 'unknown';
            if (!proj[pid]) proj[pid] = {
                projectId: pid, name: getProjectName(pid),
                jobs: 0, items: 0, openItems: 0, doneItems: 0, active: 0, done: 0, onTime: 0, late: 0, overdue: 0,
                awaitingQR: 0, pendingCustomer: 0, customerClosed: 0, customerReject: 0, satSum: 0, satCount: 0,
            };
            const P = proj[pid];
            P.jobs++;
            const itemN = getCountedSubtasks(wo).length; // line-items (รายการ) in this WO
            P.items += itemN;
            if (sla.phase === 'done') P.doneItems += itemN;
            else if (sla.phase === 'in-progress') P.openItems += itemN;

            if (sla.phase === 'done') {
                doneJobs++; P.done++;
                // Done-set = every WO at 100% progress (single-source: sla.phase==='done').
                // Classify by its close-pipeline stage; segments always sum to doneAll.
                //   awaitingQR = เสร็จ 100% แต่ยังไม่กดสร้าง QR ส่งมอบ (no QR issued yet)
                //   pendingCustomer = ออก QR/ส่งมอบแล้ว รอลูกค้าประเมิน (pending_delivery)
                //   customerClosed = ลูกค้าปิดงานแล้ว (Complete)
                //   customerReject = ลูกค้าตีกลับ (customer_reject) — bucket shows only if >0
                if (wo.status === 'Complete') P.customerClosed++;
                else if (wo.status === 'pending_delivery') P.pendingCustomer++;
                else if (wo.status === 'customer_reject') P.customerReject++;
                else P.awaitingQR++;
                // CSAT average per done WO that actually has a customer survey.
                const satAvg = getSatisfactionAverage(wo.satisfactionSurvey);
                if (satAvg != null) { P.satSum += parseFloat(satAvg); P.satCount++; }
                // Timing over the done-set.
                if (sla.status === 'on-time') { onTimeJobs++; P.onTime++; }
                else if (sla.status === 'late') { lateJobs++; P.late++; }
            } else if (sla.phase === 'in-progress') {
                P.active++;
                if (sla.status === 'overdue') { overdueJobs++; P.overdue++; }
            }

            // Foreman primary-owner attribution (1 job -> 1 foreman). REQ-1: count
            // IN-HAND jobs only (phase 'in-progress') — completed jobs are excluded
            // from this workload card (they belong on a separate completed graph).
            // "late" here = 'overdue' (an in-hand job past its deadline); a done-late
            // job is finished, so it is no longer in hand.
            const fid = primaryForemanId(wo);
            if (fid && fore[fid] && sla.phase === 'in-progress') {
                fore[fid].load++;
                if (sla.status === 'overdue') fore[fid].late++;
                const la = lastActivityMs(wo);
                if (la === null || (now - la) > 3 * DAY) fore[fid].stalled++;
            }
            // Helper foremen -> separate "ช่วย" tally, never the main load.
            (wo?.categories || []).forEach((c: any) => (c?.tasks || []).forEach((t: any) => {
                (t?.helperForemanIds || []).forEach((hid: string) => { if (fore[hid]) fore[hid].helping++; });
            }));

            // Q6 count — open jobs that are overdue OR due within 3 days.
            if (sla.phase === 'in-progress' && (sla.status === 'overdue' || sla.daysDiff >= -3)) {
                dueSoonJobs++;
            }
        });

        const perProject = Object.values(proj).map((P: any) => {
            const completed = P.onTime + P.late;
            return {
                ...P,
                onTimePct: completed > 0 ? Math.round((P.onTime / completed) * 100) : null,
                trouble: P.late + P.overdue,
                doneAll: P.awaitingQR + P.pendingCustomer + P.customerClosed + P.customerReject, // done-mode bar length (all 100%-progress WOs)
                satAvg: P.satCount > 0 ? P.satSum / P.satCount : null, // ⭐ avg over reviewed WOs
                closePct: P.jobs > 0 ? Math.round((P.customerClosed / P.jobs) * 100) : 0, // Q4 — ลูกค้าปิดจริง / ทั้งหมด
            };
        }).sort((a: any, b: any) => b.jobs - a.jobs);

        const loadVals = Object.values(fore).map((f: any) => f.load);
        const avgLoad = loadVals.length ? loadVals.reduce((s: number, n: number) => s + n, 0) / loadVals.length : 0;
        const perForeman = Object.values(fore).map((f: any) => {
            const highLoad = f.load >= 3 && f.load > avgLoad;
            const manyLate = f.late >= 3 || (f.load > 0 && f.late / f.load >= 0.34);
            const hasStalled = f.stalled >= 2;
            const signals = [highLoad, manyLate, hasStalled].filter(Boolean).length;
            return { ...f, highLoad, manyLate, hasStalled, atRisk: signals >= 2 };
        }).filter((f: any) => f.load > 0 || f.helping > 0)
          .sort((a: any, b: any) => b.load - a.load);

        const onTimePct = (onTimeJobs + lateJobs) > 0
            ? Math.round((onTimeJobs / (onTimeJobs + lateJobs)) * 100) : null;
        const foremenNeedHelp = perForeman.filter((f: any) => f.atRisk).length;

        // ── KPI headline answers (the 6 ผอ. questions) — single source the cards read ──
        const activeJobs = totalJobs - doneJobs;
        const biggest = perProject[0] || null;                                   // Q1 (already jobs-desc)
        const pendingCustomerTotal = perProject.reduce((s: number, p: any) => s + p.pendingCustomer, 0);
        const customerClosedTotal = perProject.reduce((s: number, p: any) => s + p.customerClosed, 0); // Q2
        const withJobs = perProject.filter((p: any) => p.jobs > 0);
        const lowestClose = withJobs.length                                       // Q4 — closes fewest
            ? withJobs.reduce((lo: any, p: any) => (p.closePct < lo.closePct ? p : lo)) : null;
        const mostLate = perProject.reduce(                                       // Q5 — most late/overdue
            (hi: any, p: any) => (!hi || p.trouble > hi.trouble ? p : hi), null as any);

        return {
            totals: {
                totalJobs, doneJobs, onTimeJobs, lateJobs, overdueJobs, activeJobs, dueSoonJobs,
                onTimePct, foremenNeedHelp, projectCount: perProject.length,
            },
            headlines: {
                biggest, pendingCustomerTotal, customerClosedTotal,
                lowestClose, mostLate, dueSoonJobs,
            },
            perProject, perForeman,
        };
    }, [scopedWOs, projects, staff, activeForemen]);

    // ── Drill-down state + derived views (reused by S4/S5/S6) ──────────────────
    const [drill, setDrill] = useState<{ title: string; subs: any[] } | null>(null);
    // The subtask whose rich history popup is open (ทาง ก — reuses the shared
    // TaskHistoryModal in-page; layered on top of the drill list, zIndex 1200 > 1000).
    const [selectedTask, setSelectedTask] = useState<any | null>(null);
    // Which foreman row has its inline job-list accordion open (null = all collapsed).
    const [expandedForeman, setExpandedForeman] = useState<string | null>(null);
    const [foremanMetric, setForemanMetric] = useState<'jobs' | 'items'>('items');
    // Project chart mode — 'done' (เสร็จแล้ว, close-axis) ↔ 'open' (ยังไม่จบ). One chart, two views.
    const [projMode, setProjMode] = useState<'done' | 'open'>('open');

    // Flatten a set of WOs into their counted subtasks (the same single-source set
    // that makes a job eligible), each enriched with what the shared TaskHistoryModal
    // needs: the parent wo (for its timeline) + project/location labels.
    const subRows = (wos: any[]) =>
        wos.flatMap((wo: any) => {
            const _sla = computeJobSLA(wo); // job-level SLA -> per-row badge + days-remaining (REQ-2/3)
            return getCountedSubtasks(wo).map((t: any) => ({
                ...t,
                taskName: t.taskName || t.name || t.subtaskName || '—',
                locationName: wo.locationName,
                projectName: getProjectName(wo.projectId),
                wo,
                _woId: wo.id,
                _type: wo.type,
                _sla,
            }));
        });
    const openProject = (pid: string) => setDrill({
        title: `โครงการ · ${getProjectName(pid)}`,
        subs: subRows(
            scopedWOs.filter((w: any) => (w.projectId || 'unknown') === pid && computeJobSLA(w).isEligible)
        ),
    });

    // One chart, two modes (single source per project — the toggle just re-reads it):
    //   'done' (เสร็จแล้ว) — bar length = ปิดงานแล้ว, split by WHO closed (รอลูกค้า vs ลูกค้าปิด)
    //                         + quality label (⭐ CSAT avg · % ตรงเวลา)
    //   'open' (ยังไม่จบ)  — bar length = งานค้าง, split ปกติ vs ล่าช้า
    const projRows = agg.perProject.map((p: any) => ({
        projectId: p.projectId,
        name: p.name,
        awaitingQR: p.awaitingQR,           // เสร็จ 100% แต่ยังไม่ออก QR
        pendingCustomer: p.pendingCustomer, // รอลูกค้าประเมิน (ออก QR/ส่งมอบแล้ว)
        customerClosed: p.customerClosed,   // ลูกค้าปิดงานแล้ว
        customerReject: p.customerReject,   // ลูกค้าตีกลับ
        doneAll: p.doneAll,
        satAvg: p.satAvg,
        onTimePct: p.onTimePct,
        normal: Math.max(0, p.active - p.overdue),
        overdue: p.overdue,
        active: p.active,
        items: p.items,
        openItems: p.openItems,
        doneItems: p.doneItems,
    }));
    const doneRows = projRows
        .filter((p: any) => p.doneAll > 0)
        .sort((a: any, b: any) => b.doneAll - a.doneAll);
    const openRows = projRows
        .filter((p: any) => p.active > 0)
        .sort((a: any, b: any) => b.overdue - a.overdue || b.active - a.active);
    const projModeRows = projMode === 'done' ? doneRows : openRows;
    const maxProjBar = Math.max(1, ...projModeRows.map((p: any) => (projMode === 'done' ? p.doneAll : p.active)));

    // ── Foreman drill-downs + derived views ─────────────────────────────────────
    // Single source for a foreman's IN-HAND jobs (phase in-progress) — used by BOTH
    // the click-in modal and the inline accordion, so the two lists never diverge and
    // both match the bar count (REQ-1).
    const foremanInHandWOs = (fid: string) => scopedWOs.filter((w: any) => {
        const sla = computeJobSLA(w);
        if (!sla.isEligible || sla.phase !== 'in-progress') return false;
        const owner = w?.type === 'PreHandover'
            ? (w?.categories?.[0]?.assignedForemanId || w?.woOwnerId)
            : w?.woOwnerId;
        return owner === fid;
    });
    // KPI card → jump to the project chart in the right mode (card-led drill-down).
    const goChart = (mode: 'done' | 'open') => {
        setProjMode(mode);
        document.getElementById('project-chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    // Per-foreman in-hand line-items (subtasks) — the bar magnitude tracks this, not job count.
    // Computed once here so the render map + maxItems reuse the same rows (no double subRows).
    const foremanItems: Record<string, any[]> = {};
    agg.perForeman.forEach((f: any) => { foremanItems[f.id] = subRows(foremanInHandWOs(f.id)); });
    const maxItems = Math.max(1, ...agg.perForeman.map((f: any) => foremanItems[f.id].length));
    const maxLoad = Math.max(1, ...agg.perForeman.map((f: any) => f.load));
    // Rank the card by line-item count (รายการ) desc — the bar magnitude the user reads.
    const foremenRanked = [...agg.perForeman].sort(
        (a: any, b: any) => (foremanItems[b.id]?.length || 0) - (foremanItems[a.id]?.length || 0)
    );

    if (!allowed) {
        return (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
                <ShieldAlert size={48} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    หน้านี้สำหรับผู้บริหาร / แอดมินเท่านั้น
                </div>
                <p style={{ marginTop: '0.5rem' }}>
                    บัญชีของคุณ ({user?.role || 'ไม่ทราบสิทธิ์'}) ไม่มีสิทธิ์เข้าถึงแดชบอร์ด ผอ.
                </p>
                <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                        marginTop: '1.5rem', padding: '0.6rem 1.25rem', borderRadius: '12px',
                        border: '1px solid #e2e8f0', background: '#fff', color: '#4f46e5',
                        fontWeight: 700, cursor: 'pointer'
                    }}
                >
                    กลับหน้าภาพรวมระบบ
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>กำลังเตรียมข้อมูลแดชบอร์ด ผอ. ...</div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', margin: 0, paddingBottom: '3rem' }}>
            {/* Header + page-switch back to the classic dashboard */}
            <div style={{
                display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem',
                justifyContent: 'space-between', alignItems: 'flex-start',
                paddingBottom: '1.25rem', marginBottom: '1.5rem',
                borderBottom: '1px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        padding: '12px', borderRadius: '18px', color: '#fff',
                        width: '52px', height: '52px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)'
                    }}>
                        <LayoutDashboard size={28} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
                            แดชบอร์ด ผอ.
                        </h1>
                        <p style={{ margin: '6px 0 0 0', fontSize: '1rem', color: '#64748b', fontWeight: 600 }}>
                            ภาพรวมเพื่อการตัดสินใจ — โครงการไหนต้องดู ใครต้องช่วย งานไหนต้องรีบ
                        </p>
                    </div>
                </div>
            </div>

            {/* ── S3 · Block 1 — KPI cards: one per ผอ. question, click → drill ──── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
                {/* Q1 — โครงการไหนใบงานมากที่สุด */}
                <KpiCard
                    icon={<ClipboardList size={18} />} accent="#4f46e5"
                    value={agg.headlines.biggest?.jobs ?? 0} unit="ใบ"
                    sub={agg.headlines.biggest?.name ?? '—'}
                    label="โครงการใบงานมากสุด" help={`${agg.headlines.biggest?.items ?? 0} รายการ · คลิกดูทุกโครงการ`}
                    onClick={() => goChart('open')}
                />
                {/* Q2 — เสร็จแล้ว: เราปิดเอง vs ลูกค้าปิด */}
                <KpiCard
                    icon={<CheckCircle2 size={18} />} accent="#16a34a"
                    value={agg.headlines.customerClosedTotal} unit="ปิด"
                    sub={`รอลูกค้าประเมิน ${agg.headlines.pendingCustomerTotal}`}
                    label="การปิดงาน" help="ลูกค้าปิดจริง vs รอลูกค้า · คลิกดูรายโครงการ"
                    onClick={() => goChart('done')}
                />
                {/* Q3 — แต่ละใบสถานะไหน */}
                <KpiCard
                    icon={<Bell size={18} />} accent="#2563eb"
                    value={agg.totals.activeJobs} unit="ทำอยู่"
                    sub={`เกินกำหนด ${agg.totals.overdueJobs}`}
                    label="สถานะงานรวม" help="งานกำลังทำทั้งหมด · คลิกดูสถานะรายใบ"
                    onClick={() => navigate('/sla-monitor')}
                />
                {/* Q4 — โครงการไหนปิดงานได้น้อยที่สุด */}
                <KpiCard
                    icon={<Timer size={18} />} accent="#d97706"
                    value={agg.headlines.lowestClose?.closePct ?? 0} unit="%"
                    sub={agg.headlines.lowestClose?.name ?? '—'}
                    label="ปิดงานน้อยสุด" help="ลูกค้าปิดจริง / ทั้งหมด ต่ำสุด · คลิกดูงานเสร็จ"
                    onClick={() => goChart('done')}
                />
                {/* Q5 — โครงการไหนล่าช้า/ช้าที่สุด */}
                <KpiCard
                    icon={<AlertTriangle size={18} />} accent="#dc2626"
                    value={agg.headlines.mostLate?.trouble ?? 0} unit="ใบ"
                    sub={agg.headlines.mostLate?.name ?? '—'}
                    label="ล่าช้ามากสุด" help="ล่าช้า + เกินกำหนดรวม · คลิกดูงานค้าง"
                    onClick={() => goChart('open')}
                />
                {/* Q6 — Due-down แต่ละใบ */}
                <KpiCard
                    icon={<LifeBuoy size={18} />} accent="#ea580c"
                    value={agg.totals.dueSoonJobs} unit="ใบ"
                    sub="ใกล้/เลยกำหนด"
                    label="ต้องเร่งดู" help="เกินกำหนด หรือครบใน 3 วัน · คลิกดูรายการ"
                    onClick={() => navigate('/sla-monitor?slaFilter=overdue')}
                />
            </div>

            {/* ── S2 · Project chart — ONE chart, two modes (done ↔ open) ────────── */}
            <div id="project-chart" style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', padding: '1.25rem 1.4rem', marginBottom: '1.75rem' }}>
                {/* Header + mode toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <SectionTitle icon={<Target size={18} />} title="ภาพรวมงานต่อโครงการ" accent="#4f46e5" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {/* Work-type filter — sits here but controls the WHOLE page (one scopedWOs input) */}
                        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
                            {([
                                { v: 'all', t: 'ทั้งหมด' },
                                { v: 'AfterSale', t: 'หลังขาย' },
                                { v: 'PreHandover', t: 'ก่อนโอน' },
                            ] as const).map((b) => (
                                <button
                                    key={b.v}
                                    onClick={() => setWoTypeFilter(b.v)}
                                    style={{
                                        border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px 14px',
                                        fontSize: '0.78rem', fontWeight: 800, fontFamily: 'inherit',
                                        background: woTypeFilter === b.v ? '#4f46e5' : 'transparent',
                                        color: woTypeFilter === b.v ? '#fff' : '#64748b',
                                        boxShadow: woTypeFilter === b.v ? '0 2px 6px rgba(79,70,229,0.25)' : 'none',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {b.t}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
                        {([
                            { m: 'open', t: '🔧 งานที่ยังไม่จบ' },
                            { m: 'done', t: '✅ งานที่เสร็จแล้ว' },
                        ] as const).map((b) => (
                            <button
                                key={b.m}
                                onClick={() => setProjMode(b.m)}
                                style={{
                                    border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px 14px',
                                    fontSize: '0.78rem', fontWeight: 800, fontFamily: 'inherit',
                                    background: projMode === b.m ? '#4f46e5' : 'transparent',
                                    color: projMode === b.m ? '#fff' : '#64748b',
                                    boxShadow: projMode === b.m ? '0 2px 6px rgba(79,70,229,0.25)' : 'none',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {b.t}
                            </button>
                        ))}
                    </div>
                    </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, margin: '6px 0 0.6rem 0', lineHeight: 1.5 }}>
                    {projMode === 'done'
                        ? 'แต่ละแท่ง = ใบงานที่เสร็จ 100% ทั้งหมด · จำแนกตามขั้นการปิดงาน (รอออก QR → รอลูกค้าประเมิน → ลูกค้าปิด → ตีกลับ) · ป้ายท้าย = ⭐ ความพึงพอใจเฉลี่ย · % ตรงเวลา · คลิกเพื่อดูรายใบ'
                        : 'แต่ละแท่ง = งานที่ยังทำอยู่ของโครงการ · แยกปกติ vs ล่าช้า · เรียงงานล่าช้ามากสุดขึ้นก่อน · คลิกเพื่อดูงาน'}
                </div>
                {/* Legend (per mode) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '0 0 0.9rem 0', fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>
                    {(projMode === 'done'
                        ? [{ c: LV.watch, t: 'รอออก QR' }, { c: '#0891b2', t: 'รอลูกค้าประเมิน' }, { c: LV.good, t: 'ลูกค้าปิดแล้ว' }, { c: LV.bad, t: 'ลูกค้าตีกลับ' }]
                        : [{ c: LV.normal, t: 'ปกติ (ยังไม่ถึงกำหนด)' }, { c: LV.bad, t: 'ล่าช้า / เกินกำหนด' }]
                    ).map((L) => (
                        <span key={L.t} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: 11, height: 11, borderRadius: 3, background: L.c }} />{L.t}
                        </span>
                    ))}
                </div>
                {projModeRows.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                        {projMode === 'done' ? 'ยังไม่มีงานที่ปิดแล้ว' : 'ไม่มีงานค้างในตอนนี้ 🎉'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', height: '308px', paddingRight: '4px' }}>
                        {projModeRows.map((p: any) => {
                            const isDone = projMode === 'done';
                            const mag = isDone ? p.doneAll : p.active;
                            const segs = (isDone
                                ? [{ key: 'awaitingQR', v: p.awaitingQR, c: LV.watch }, { key: 'pending', v: p.pendingCustomer, c: '#0891b2' }, { key: 'closed', v: p.customerClosed, c: LV.good }, { key: 'reject', v: p.customerReject, c: LV.bad }]
                                : [{ key: 'normal', v: p.normal, c: LV.normal }, { key: 'overdue', v: p.overdue, c: LV.bad }]
                            ).filter((s) => s.v > 0);
                            const barPct = (mag / maxProjBar) * 100;
                            const title = isDone
                                ? `${p.name}\nรอออก QR ${p.awaitingQR} · รอลูกค้าประเมิน ${p.pendingCustomer} · ลูกค้าปิดแล้ว ${p.customerClosed} · ตีกลับ ${p.customerReject}\n⭐ เฉลี่ย ${p.satAvg != null ? p.satAvg.toFixed(1) : '—'} · ตรงเวลา ${p.onTimePct ?? '—'}%`
                                : `${p.name}\nปกติ ${p.normal} · ล่าช้า ${p.overdue}\nงานค้างรวม ${p.active} ใบ`;
                            return (
                                <div
                                    key={p.projectId}
                                    onClick={() => openProject(p.projectId)}
                                    title={title}
                                    style={{ display: 'grid', gridTemplateColumns: '150px 1fr 120px', alignItems: 'center', gap: '10px', cursor: 'pointer', minHeight: '44px', padding: '0 4px', borderRadius: '8px' }}
                                    onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    {/* Project name (🔴 prefix if overdue in open mode) */}
                                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {!isDone && p.overdue > 0 ? '🔴 ' : ''}{p.name}
                                    </div>
                                    {/* Bar track — full-width grey rail (right edges align across all rows) */}
                                    <div style={{ width: '100%', height: '22px', background: '#f1f5f9', borderRadius: '7px', overflow: 'hidden', display: 'flex' }}>
                                        <div style={{ display: 'flex', width: `${barPct}%`, minWidth: '8px', height: '100%' }}>
                                            {segs.map((s) => (
                                                <div key={s.key} style={{ width: `${(s.v / mag) * 100}%`, background: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.66rem', fontWeight: 800, overflow: 'hidden' }}>
                                                    {s.v}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* End label (per mode) */}
                                    <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
                                        {isDone ? (
                                            <>
                                                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>
                                                    ⭐ {p.satAvg != null ? p.satAvg.toFixed(1) : '—'}
                                                </div>
                                                <div style={{ fontSize: '0.66rem', fontWeight: 600, color: '#94a3b8' }}>ตรงเวลา {p.onTimePct ?? '—'}%</div>
                                            </>
                                        ) : (
                                            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>{p.openItems} รายการ</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── S6 · Block 7 — foreman workload + who needs help ──────────────── */}
            <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', padding: '1.25rem 1.4rem', marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <SectionTitle icon={<Users size={18} />} title="ภาระงานโฟร์แมน & ใครต้องช่วย" accent="#0891b2" />
                    <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
                        {([
                            { v: 'jobs', t: 'ใบงาน' },
                            { v: 'items', t: 'รายการ' },
                        ] as const).map((b) => (
                            <button
                                key={b.v}
                                onClick={() => setForemanMetric(b.v)}
                                style={{
                                    border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px 14px',
                                    fontSize: '0.78rem', fontWeight: 800, fontFamily: 'inherit',
                                    background: foremanMetric === b.v ? '#4f46e5' : 'transparent',
                                    color: foremanMetric === b.v ? '#fff' : '#64748b',
                                    boxShadow: foremanMetric === b.v ? '0 2px 6px rgba(79,70,229,0.25)' : 'none',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {b.t}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, margin: '4px 0 1rem 0', lineHeight: 1.5 }}>
                    แท่ง = จำนวน{foremanMetric === 'jobs' ? 'ใบงาน' : 'รายการ'}ในมือ (🟦 ปกติ / 🟥 ช้าหรือเลยกำหนด) · ป้าย 🆘 ต้องช่วย = เข้าเกณฑ์เสี่ยง ≥2 อย่าง (งานเยอะ · ช้าเยอะ · งานนิ่งไม่ขยับ) · คลิกเพื่อดูงาน
                </div>
                {agg.perForeman.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>ยังไม่มีงานผูกกับโฟร์แมน</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {foremenRanked.map((f: any) => {
                            const reasons = [
                                f.highLoad && 'งานเยอะ',
                                f.manyLate && 'ช้าเยอะ',
                                f.hasStalled && 'งานนิ่ง',
                            ].filter(Boolean);
                            const isExpanded = expandedForeman === f.id;
                            const jobRows = foremanItems[f.id] || [];
                            const itemCount = jobRows.length; // line-items (subtasks) = true workload
                            const lateItems = jobRows.filter((s: any) => s._sla?.status === 'overdue').length;
                            // Metric-driven bar (header toggle): jobs=ใบงาน (f.load) / items=รายการ (itemCount).
                            // Counts show INSIDE the segments, same visual as the project-overview chart.
                            const total = foremanMetric === 'jobs' ? f.load : itemCount;
                            const lateN = foremanMetric === 'jobs' ? f.late : lateItems;
                            const maxN = foremanMetric === 'jobs' ? maxLoad : maxItems;
                            const barPct = (total / maxN) * 100;
                            const segs = [
                                { key: 'normal', v: Math.max(0, total - lateN), c: LV.normal },
                                { key: 'late', v: lateN, c: LV.bad },
                            ].filter((s) => s.v > 0);
                            return (
                                <div key={f.id}>
                                  <div
                                    onClick={() => setExpandedForeman(isExpanded ? null : f.id)}
                                    title="กดดูรายการงาน"
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px', padding: '0 8px', borderRadius: '12px', cursor: 'pointer' }}
                                    onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <div style={{ width: '150px', flexShrink: 0, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>
                                            {f.atRisk && (
                                                <span style={{ flexShrink: 0, fontSize: '0.6rem', fontWeight: 900, color: '#dc2626', background: '#fee2e2', borderRadius: '5px', padding: '0px 5px' }}>🆘</span>
                                            )}
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {reasons.length > 0 ? reasons.join(' · ') : (f.helping > 0 ? `ช่วยงาน ${f.helping}` : 'ปกติ')}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Bar — project-chart style: grey rail → filled inner (width = total/max)
                                        → segments (ปกติ / ช้า) each showing its count centered white. */}
                                    <div style={{ flex: 1, height: '22px', background: '#f1f5f9', borderRadius: '7px', overflow: 'hidden', display: 'flex', minWidth: '60px' }}>
                                        <div style={{ display: 'flex', width: `${barPct}%`, minWidth: '8px', height: '100%' }}>
                                            {segs.map((s) => (
                                                <div key={s.key} style={{ width: `${(s.v / total) * 100}%`, background: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.66rem', fontWeight: 800, overflow: 'hidden' }}>
                                                    {s.v}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                  </div>
                                  {isExpanded && (
                                    <div style={{ margin: '2px 0 10px 12px', paddingLeft: '12px', borderLeft: '2px solid #eef2ff', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        {jobRows.length === 0 ? (
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, padding: '4px 0' }}>ไม่มีงานในมือ</div>
                                        ) : jobRows.map((s: any, si: number) => {
                                            const sMeta = s._sla ? STATUS_META[s._sla.status] : null;
                                            const dText = !s._sla ? null
                                                : s._sla.phase === 'done' ? 'เสร็จแล้ว'
                                                : s._sla.daysDiff < 0 ? `เหลือ ${-s._sla.daysDiff} วัน`
                                                : s._sla.daysDiff === 0 ? 'ครบกำหนดวันนี้'
                                                : `เลย ${s._sla.daysDiff} วัน`;
                                            const dColor = !s._sla || s._sla.phase === 'done' ? '#94a3b8'
                                                : s._sla.daysDiff > 0 ? '#dc2626'
                                                : s._sla.daysDiff === 0 ? '#d97706'
                                                : '#0891b2';
                                            return (
                                                <div
                                                    key={(s._woId || '') + (s.id || s.taskName || '') + si}
                                                    onClick={() => setSelectedTask(s)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                    onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                    {sMeta && (
                                                        <span style={{ flexShrink: 0, fontSize: '0.64rem', fontWeight: 900, color: sMeta.color, background: sMeta.bg, borderRadius: '5px', padding: '1px 6px' }}>{sMeta.label}</span>
                                                    )}
                                                    <span style={{ flex: 1, minWidth: 0, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.taskName}</span>
                                                    {dText && (
                                                        <span style={{ flexShrink: 0, fontWeight: 800, color: dColor, whiteSpace: 'nowrap' }}>{dText}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                  )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <JobListModal data={drill} onClose={() => setDrill(null)} onPick={(s: any) => setSelectedTask(s)} />
            <TaskHistoryModal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} task={selectedTask} />
        </div>
    );
};

export default DirectorDashboard;
