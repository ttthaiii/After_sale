import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, ShieldAlert, ArrowLeft, ClipboardList, CheckCircle2,
    AlertTriangle, Timer, LifeBuoy, Bell, ChevronRight, X, Target, ListOrdered,
    TrendingUp, Hourglass, Users
} from 'lucide-react';
import {
    ResponsiveContainer, XAxis, YAxis,
    CartesianGrid, Tooltip, Cell, LineChart, Line, BarChart, Bar,
} from 'recharts';
import { computeJobSLA, getCountedSubtasks, confirmedProgress } from '../utils/jobSla';
import TaskHistoryModal from '../components/TaskHistoryModal';

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
const KpiCard = ({ icon, value, unit, label, help, accent, onClick }: {
    icon: any; value: any; unit?: string; label: string; help: string; accent: string; onClick?: () => void;
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
        <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, lineHeight: 1.4 }}>
            {help}
        </div>
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

const lightOf = (pct: number | null) =>
    pct == null ? '⚪' : pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';

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

    // ── S2 · Aggregation layer (the brain) ────────────────────────────────────
    // ONE memo that turns raw WorkOrders into everything the blocks below read.
    // Every schedule metric comes from computeJobSLA (single source) so numbers
    // match the rest of the app. Recomputes only when data changes.
    const agg = useMemo(() => {
        const DAY = 86400000;
        const now = Date.now();

        const foremanName = (id: string) => staff.find((s: any) => s.id === id)?.name || id;

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

        const alerts: any[] = [];
        let totalJobs = 0, doneJobs = 0, onTimeJobs = 0, lateJobs = 0, overdueJobs = 0;
        const weekOnTime = new Array(8).fill(0);
        const weekTotal = new Array(8).fill(0);
        const aging = { ok: 0, d13: 0, d47: 0, d7: 0 }; // in-time / overdue 1-3 / 4-7 / >7 days

        workOrders.forEach((wo: any) => {
            const sla = computeJobSLA(wo);
            if (!sla.isEligible) return; // not gradeable -> excluded everywhere
            totalJobs++;

            const pid = wo.projectId || 'unknown';
            if (!proj[pid]) proj[pid] = {
                projectId: pid, name: getProjectName(pid),
                jobs: 0, items: 0, active: 0, done: 0, onTime: 0, late: 0, overdue: 0,
            };
            const P = proj[pid];
            P.jobs++;
            P.items += getCountedSubtasks(wo).length; // line-items (รายการ) per project

            if (sla.phase === 'done') {
                doneJobs++; P.done++;
                if (sla.status === 'on-time') { onTimeJobs++; P.onTime++; }
                else if (sla.status === 'late') { lateJobs++; P.late++; }
                // Weekly on-time trend, bucketed by completion week (idx 7 = this week).
                if (sla.completedMs != null) {
                    const wksAgo = Math.floor((now - sla.completedMs) / (7 * DAY));
                    if (wksAgo >= 0 && wksAgo < 8) {
                        const idx = 7 - wksAgo;
                        weekTotal[idx]++;
                        if (sla.status === 'on-time') weekOnTime[idx]++;
                    }
                }
            } else if (sla.phase === 'in-progress') {
                P.active++;
                if (sla.status === 'overdue') { overdueJobs++; P.overdue++; }
                // Aging of open jobs by daysDiff (now vs deadline; + = past due).
                const dd = sla.daysDiff;
                if (dd <= 0) aging.ok++;
                else if (dd <= 3) aging.d13++;
                else if (dd <= 7) aging.d47++;
                else aging.d7++;
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

            // Alert list: open jobs that are overdue OR due within 3 days.
            if (sla.phase === 'in-progress' && (sla.status === 'overdue' || sla.daysDiff >= -3)) {
                alerts.push({
                    woId: wo.id,
                    projectName: getProjectName(wo.projectId),
                    location: wo.locationName,
                    foreman: fid ? foremanName(fid) : '—',
                    daysDiff: sla.daysDiff,
                    status: sla.status,
                    type: wo.type,
                });
            }
        });

        const perProject = Object.values(proj).map((P: any) => {
            const completed = P.onTime + P.late;
            return {
                ...P,
                onTimePct: completed > 0 ? Math.round((P.onTime / completed) * 100) : null,
                trouble: P.late + P.overdue,
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

        const weekly = weekTotal.map((tot: number, i: number) => ({
            week: i, // 0..7 (7 = this week)
            pct: tot > 0 ? Math.round((weekOnTime[i] / tot) * 100) : null,
            total: tot,
        }));

        const onTimePct = (onTimeJobs + lateJobs) > 0
            ? Math.round((onTimeJobs / (onTimeJobs + lateJobs)) * 100) : null;
        const foremenNeedHelp = perForeman.filter((f: any) => f.atRisk).length;

        alerts.sort((a, b) => b.daysDiff - a.daysDiff); // worst (most overdue) first

        return {
            totals: {
                totalJobs, doneJobs, onTimeJobs, lateJobs, overdueJobs,
                onTimePct, foremenNeedHelp, projectCount: perProject.length,
            },
            perProject, perForeman, aging, weekly, alerts,
        };
    }, [workOrders, projects, staff, activeForemen]);

    // ── Drill-down state + derived views (reused by S4/S5/S6) ──────────────────
    const [drill, setDrill] = useState<{ title: string; subs: any[] } | null>(null);
    // The subtask whose rich history popup is open (ทาง ก — reuses the shared
    // TaskHistoryModal in-page; layered on top of the drill list, zIndex 1200 > 1000).
    const [selectedTask, setSelectedTask] = useState<any | null>(null);
    // Which foreman row has its inline job-list accordion open (null = all collapsed).
    const [expandedForeman, setExpandedForeman] = useState<string | null>(null);

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
            workOrders.filter((w: any) => (w.projectId || 'unknown') === pid && computeJobSLA(w).isEligible)
        ),
    });

    // Stacked-bar rows = projects with any current work (done + active > 0).
    // Bar length = total work orders (absolute). Segments: onTime / late / normal / overdue.
    // Sorted by UNFINISHED (active) desc so the project needing attention floats to top.
    const projectBars = agg.perProject
        .map((p: any) => ({
            projectId: p.projectId,
            name: p.name,
            onTime: p.onTime,
            late: p.late,
            normal: Math.max(0, p.active - p.overdue),
            overdue: p.overdue,
            done: p.done,
            total: p.done + p.active,
            unfinished: p.active,
            items: p.items,
            pct: (p.done + p.active) > 0 ? Math.round((p.done / (p.done + p.active)) * 100) : 0,
        }))
        .filter((p: any) => p.total > 0)
        .sort((a: any, b: any) => b.unfinished - a.unfinished || b.total - a.total);

    const maxProjTotal = Math.max(1, ...projectBars.map((p: any) => p.total));

    // Ranking = worst-first by on-time%; ungraded (no completed job) sink to the bottom.
    const ranking = [...agg.perProject].sort((a: any, b: any) => {
        const ga = a.onTimePct == null, gb = b.onTimePct == null;
        if (ga && gb) return b.jobs - a.jobs;
        if (ga) return 1;
        if (gb) return -1;
        if (a.onTimePct !== b.onTimePct) return a.onTimePct - b.onTimePct;
        return b.trouble - a.trouble;
    });

    // ── S5/S6 derived views + drill-downs ──────────────────────────────────────
    const openAging = (title: string, lo: number, hi: number) => setDrill({
        title: `งานค้าง · ${title}`,
        subs: subRows(workOrders.filter((w: any) => {
            const s = computeJobSLA(w);
            return s.isEligible && s.phase === 'in-progress' && s.daysDiff >= lo && s.daysDiff <= hi;
        })),
    });
    // Single source for a foreman's IN-HAND jobs (phase in-progress) — used by BOTH
    // the click-in modal and the inline accordion, so the two lists never diverge and
    // both match the bar count (REQ-1).
    const foremanInHandWOs = (fid: string) => workOrders.filter((w: any) => {
        const sla = computeJobSLA(w);
        if (!sla.isEligible || sla.phase !== 'in-progress') return false;
        const owner = w?.type === 'PreHandover'
            ? (w?.categories?.[0]?.assignedForemanId || w?.woOwnerId)
            : w?.woOwnerId;
        return owner === fid;
    });
    const openForeman = (fid: string, name: string) => setDrill({
        title: `โฟร์แมน · ${name}`,
        subs: subRows(foremanInHandWOs(fid)),
    });
    // Alert row = one specific WO -> drill into that job's subtasks.
    const openWO = (woId: string) => {
        const wo = workOrders.find((w: any) => w.id === woId);
        if (!wo) return;
        setDrill({
            title: `ใบงาน · ${getProjectName(wo.projectId)}${wo.locationName ? ' · ' + wo.locationName : ''}`,
            subs: subRows([wo]),
        });
    };

    const agingData = [
        { name: 'ในกำหนด', value: agg.aging.ok, color: LV.good, lo: -99999, hi: 0 },
        { name: 'เลย 1-3 วัน', value: agg.aging.d13, color: LV.watch, lo: 1, hi: 3 },
        { name: 'เลย 4-7 วัน', value: agg.aging.d47, color: LV.warn, lo: 4, hi: 7 },
        { name: 'เลย >7 วัน', value: agg.aging.d7, color: LV.bad, lo: 8, hi: 99999 },
    ];
    const trendData = agg.weekly.map((w: any) => ({
        name: w.week === 7 ? 'สัปดาห์นี้' : `${7 - w.week} สัปดาห์ก่อน`,
        shortName: w.week === 7 ? 'นี้' : `-${7 - w.week}`,
        pct: w.pct, total: w.total,
    }));
    // Per-foreman in-hand line-items (subtasks) — the bar magnitude tracks this, not job count.
    // Computed once here so the render map + maxItems reuse the same rows (no double subRows).
    const foremanItems: Record<string, any[]> = {};
    agg.perForeman.forEach((f: any) => { foremanItems[f.id] = subRows(foremanInHandWOs(f.id)); });
    const maxItems = Math.max(1, ...agg.perForeman.map((f: any) => foremanItems[f.id].length));
    // Rank the card by line-item count (รายการ) desc — the bar magnitude the user reads.
    const foremenRanked = [...agg.perForeman].sort(
        (a: any, b: any) => (foremanItems[b.id]?.length || 0) - (foremanItems[a.id]?.length || 0)
    );

    const TrendTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        const d = payload[0].payload;
        return (
            <div style={{ background: '#0f172a', color: '#fff', borderRadius: '10px', padding: '0.55rem 0.75rem', fontSize: '0.78rem', fontWeight: 700 }}>
                <div style={{ fontWeight: 900 }}>{label}</div>
                <div>ตรงเวลา {d.pct == null ? '—' : d.pct + '%'} · เสร็จ {d.total} งาน</div>
            </div>
        );
    };

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
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
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
                <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '0.7rem 1.15rem', borderRadius: '14px',
                        border: '1px solid #e2e8f0', background: '#ffffff',
                        color: '#4f46e5', fontWeight: 700, fontSize: '0.9rem',
                        cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                    }}
                >
                    <ArrowLeft size={18} />
                    ภาพรวมระบบ (เดิม)
                </button>
            </div>

            {/* ── S3 · Block 1 — KPI summary cards ──────────────────────────────── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
                <KpiCard
                    icon={<ClipboardList size={18} />} accent="#4f46e5"
                    value={agg.totals.totalJobs} label="งานทั้งหมด (เกรดได้)"
                    help={`ใบงานที่คิด SLA ได้ · เสร็จแล้ว ${agg.totals.doneJobs}`}
                    onClick={() => navigate('/sla-monitor')}
                />
                <KpiCard
                    icon={<CheckCircle2 size={18} />} accent="#059669"
                    value={agg.totals.onTimePct ?? '—'} unit={agg.totals.onTimePct != null ? '%' : undefined}
                    label="% ตรงเวลา" help="ของงานที่เสร็จแล้ว ทำทันกำหนดกี่ %"
                    onClick={() => navigate('/sla-monitor?slaFilter=completed')}
                />
                <KpiCard
                    icon={<AlertTriangle size={18} />} accent="#dc2626"
                    value={agg.totals.overdueJobs} label="เลยกำหนด (ยังไม่เสร็จ)"
                    help="งานที่ทำอยู่แต่พ้นเดดไลน์แล้ว ต้องเร่ง"
                    onClick={() => navigate('/sla-monitor?slaFilter=overdue')}
                />
                <KpiCard
                    icon={<Timer size={18} />} accent="#d97706"
                    value={agg.totals.lateJobs} label="เสร็จช้า (เลย SLA)"
                    help="งานที่ปิดแล้วแต่เกินกำหนด"
                    onClick={() => navigate('/sla-monitor?slaFilter=completed')}
                />
                <KpiCard
                    icon={<LifeBuoy size={18} />} accent="#7c3aed"
                    value={agg.totals.foremenNeedHelp} label="โฟร์แมนต้องช่วย"
                    help="เข้าเกณฑ์เสี่ยง ≥2 สัญญาณ (ดูบล็อกโฟร์แมนด้านล่าง)"
                />
            </div>

            {/* ── S3 · Block 2 — "งานที่ต้องรีบดู" alert bar ────────────────────── */}
            <div style={{
                background: '#ffffff', borderRadius: '18px', border: '1px solid #fecaca',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '1.75rem'
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '1rem 1.4rem', background: 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)',
                    borderBottom: '1px solid #fee2e2'
                }}>
                    <Bell size={20} style={{ color: '#dc2626' }} />
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                            งานที่ต้องรีบดู {agg.alerts.length > 0 && (
                                <span style={{ color: '#dc2626' }}>({agg.alerts.length})</span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                            งานที่เลยกำหนดแล้ว หรือใกล้ครบใน 3 วัน — เรียงด่วนสุดขึ้นก่อน · คลิกเพื่อดูงานย่อยในใบงานนี้
                        </div>
                    </div>
                </div>

                {agg.alerts.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                        ไม่มีงานเร่งด่วนตอนนี้ 🎉
                    </div>
                ) : (
                    <div>
                        {agg.alerts.slice(0, 8).map((a: any, i: number) => {
                            const isOverdue = a.status === 'overdue';
                            const dayText = a.daysDiff > 0
                                ? `เลย ${a.daysDiff} วัน`
                                : a.daysDiff === 0 ? 'ครบกำหนดวันนี้' : `เหลือ ${Math.abs(a.daysDiff)} วัน`;
                            return (
                                <div
                                    key={a.woId + i}
                                    onClick={() => openWO(a.woId)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                                        padding: '0.85rem 1.4rem', borderTop: i === 0 ? 'none' : '1px solid #f1f5f9',
                                        transition: 'background 0.15s ease',
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.background = '#fef2f2')}
                                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <span style={{
                                        flexShrink: 0, minWidth: '92px', textAlign: 'center', padding: '4px 8px',
                                        borderRadius: '9px', fontSize: '0.72rem', fontWeight: 900,
                                        color: isOverdue ? '#dc2626' : '#d97706',
                                        background: isOverdue ? '#fee2e2' : '#fef3c7',
                                    }}>
                                        {dayText}
                                    </span>
                                    <span style={{
                                        flexShrink: 0, fontSize: '0.68rem', fontWeight: 800, color: '#64748b',
                                        background: '#f1f5f9', borderRadius: '6px', padding: '2px 7px',
                                    }}>
                                        {a.type === 'PreHandover' ? 'WOP' : 'WOA'}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {a.projectName} {a.location && <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {a.location}</span>}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                                            {a.woId} · โฟร์แมน: {a.foreman}
                                        </div>
                                    </div>
                                    <ChevronRight size={18} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                </div>
                            );
                        })}
                        {agg.alerts.length > 8 && (
                            <div
                                onClick={() => navigate('/sla-monitor?slaFilter=overdue')}
                                style={{
                                    padding: '0.8rem 1.4rem', borderTop: '1px solid #f1f5f9', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: 800, color: '#4f46e5', textAlign: 'center',
                                }}
                            >
                                ดูทั้งหมด {agg.alerts.length} งาน →
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── S4 · Block 3-4 — project bubble comparison + ranking ──────────── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.75rem' }}>
                {/* Project stacked-bar comparison */}
                <div style={{ flex: '1.4 1 440px', minWidth: 'min(100%, 440px)', background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', padding: '1.25rem 1.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#4f46e5' }}>
                        <Target size={18} />
                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>เปรียบเทียบโครงการ</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, margin: '4px 0 0.6rem 0', lineHeight: 1.5 }}>
                        แต่ละแท่ง = 1 โครงการ · ความยาว = จำนวนใบงานทั้งหมด · เรียงงานที่ยังไม่เสร็จมากสุดขึ้นก่อน · คลิกเพื่อดูงาน
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '0 0 0.9rem 0', fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>
                        {[
                            { c: LV.good, t: 'เสร็จ ตรงเวลา' },
                            { c: LV.watch, t: 'เสร็จ ล่าช้า' },
                            { c: LV.normal, t: 'กำลังทำ' },
                            { c: LV.bad, t: 'เกินกำหนด' },
                        ].map((L) => (
                            <span key={L.t} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: 11, height: 11, borderRadius: 3, background: L.c }} />{L.t}
                            </span>
                        ))}
                    </div>
                    {projectBars.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>ยังไม่มีงานในโครงการ</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '340px', paddingRight: '4px' }}>
                            {projectBars.map((p: any) => {
                                const segs = [
                                    { key: 'onTime', v: p.onTime, c: LV.good },
                                    { key: 'late', v: p.late, c: LV.watch },
                                    { key: 'normal', v: p.normal, c: LV.normal },
                                    { key: 'overdue', v: p.overdue, c: LV.bad },
                                ].filter((s) => s.v > 0);
                                const barPct = (p.total / maxProjTotal) * 100;
                                return (
                                    <div
                                        key={p.projectId}
                                        onClick={() => openProject(p.projectId)}
                                        title={`${p.name}\nเสร็จตรงเวลา ${p.onTime} · เสร็จล่าช้า ${p.late} · กำลังทำ ${p.normal} · เกินกำหนด ${p.overdue}\nรวม ${p.total} ใบ / ${p.items} รายการ · เสร็จ ${p.pct}%`}
                                        style={{ display: 'grid', gridTemplateColumns: '150px 1fr 120px', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '2px 4px', borderRadius: '8px' }}
                                        onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                        onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {/* Project name (🔴 prefix if overdue) */}
                                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {p.overdue > 0 ? '🔴 ' : ''}{p.name}
                                        </div>
                                        {/* Stacked bar track */}
                                        <div style={{ display: 'flex', width: `${barPct}%`, minWidth: '8px', height: '22px', borderRadius: '6px', overflow: 'hidden', background: '#f1f5f9' }}>
                                            {segs.map((s) => (
                                                <div key={s.key} style={{ width: `${(s.v / p.total) * 100}%`, background: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.66rem', fontWeight: 800, overflow: 'hidden' }}>
                                                    {s.v}
                                                </div>
                                            ))}
                                        </div>
                                        {/* End label: N ใบ / M รายการ + เสร็จ X% */}
                                        <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
                                            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>
                                                {p.total} ใบ <span style={{ color: '#cbd5e1' }}>/</span> {p.items} รายการ
                                            </div>
                                            <div style={{ fontSize: '0.66rem', fontWeight: 600, color: '#94a3b8' }}>เสร็จ {p.pct}%</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Ranking traffic-light */}
                <div style={{ flex: '1 1 300px', minWidth: 'min(100%, 300px)', background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#4f46e5' }}>
                        <ListOrdered size={18} />
                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>อันดับโครงการที่ต้องดู</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, margin: '4px 0 0.75rem 0', lineHeight: 1.5 }}>
                        เรียงจากแย่สุด → ดีสุด (ดู % ตรงเวลา) · 🔴 ต่ำกว่า 50% · 🟡 50–79% · 🟢 80%+ · คลิกเพื่อดูงาน
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', maxHeight: '300px' }}>
                        {ranking.map((p: any) => (
                            <div
                                key={p.projectId}
                                onClick={() => openProject(p.projectId)}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.6rem 0.5rem', borderRadius: '10px', cursor: 'pointer' }}
                                onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{lightOf(p.onTimePct)}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                                        ตรงเวลา {p.onTimePct ?? '—'}{p.onTimePct != null ? '%' : ''} · {p.jobs} งาน{p.trouble > 0 ? ` · ปัญหา ${p.trouble}` : ''}
                                    </div>
                                </div>
                                <ChevronRight size={16} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── S5 · Block 5-6 — on-time trend + aging of open jobs ───────────── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.75rem' }}>
                {/* On-time trend */}
                <div style={{ flex: '1.2 1 420px', minWidth: 'min(100%, 420px)', background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', padding: '1.25rem 1.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#4f46e5' }}>
                        <TrendingUp size={18} />
                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>เทรนด์ตรงเวลา (8 สัปดาห์)</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, margin: '4px 0 0.75rem 0', lineHeight: 1.5 }}>
                        % งานที่เสร็จทันกำหนดในแต่ละสัปดาห์ · เส้นขึ้น = ทีมทำงานทันเวลามากขึ้น · จุดขาด = สัปดาห์นั้นไม่มีงานเสร็จ
                    </div>
                    <ResponsiveContainer width="100%" height={270}>
                        <LineChart data={trendData} margin={{ top: 12, right: 20, bottom: 4, left: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                            <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} width={42} />
                            <Tooltip content={<TrendTooltip />} />
                            <Line type="monotone" dataKey="pct" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} activeDot={{ r: 6 }} connectNulls={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Aging of open jobs */}
                <div style={{ flex: '1 1 340px', minWidth: 'min(100%, 340px)', background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', padding: '1.25rem 1.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#4f46e5' }}>
                        <Hourglass size={18} />
                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>งานค้างตามอายุ</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, margin: '4px 0 0.75rem 0', lineHeight: 1.5 }}>
                        งานที่ยังทำอยู่ แยกตามว่าเลยกำหนดมากี่วัน · ยิ่งแดง = ค้างนานยิ่งอันตราย · คลิกแท่งเพื่อดูงาน
                    </div>
                    <ResponsiveContainer width="100%" height={270}>
                        <BarChart layout="vertical" data={agingData} margin={{ top: 8, right: 24, bottom: 4, left: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={82} tick={{ fontSize: 11 }} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} cursor="pointer" onClick={(d: any) => d && openAging(d.name, d.lo, d.hi)}>
                                {agingData.map((a, i) => <Cell key={i} fill={a.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── S6 · Block 7 — foreman workload + who needs help ──────────────── */}
            <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', padding: '1.25rem 1.4rem', marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#4f46e5' }}>
                    <Users size={18} />
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>ภาระงานโฟร์แมน & ใครต้องช่วย</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, margin: '4px 0 1rem 0', lineHeight: 1.5 }}>
                    แท่ง = จำนวนรายการในมือ (🟦 ปกติ / 🟥 ช้าหรือเลยกำหนด) · ป้าย 🆘 ต้องช่วย = เข้าเกณฑ์เสี่ยง ≥2 อย่าง (งานเยอะ · ช้าเยอะ · งานนิ่งไม่ขยับ) · คลิกเพื่อดูงาน
                </div>
                {agg.perForeman.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>ยังไม่มีงานผูกกับโฟร์แมน</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
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
                            return (
                                <div key={f.id}>
                                  <div
                                    onClick={() => openForeman(f.id, f.name)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.5rem', borderRadius: '12px', cursor: 'pointer' }}
                                    onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <div style={{ width: '150px', flexShrink: 0, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                                            {f.atRisk && (
                                                <span style={{ flexShrink: 0, fontSize: '0.66rem', fontWeight: 900, color: '#dc2626', background: '#fee2e2', borderRadius: '6px', padding: '1px 6px' }}>🆘 ต้องช่วย</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                                            {reasons.length > 0 ? reasons.join(' · ') : (f.helping > 0 ? `ช่วยงาน ${f.helping}` : 'ปกติ')}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, height: '24px', background: '#f1f5f9', borderRadius: '7px', overflow: 'hidden', display: 'flex', minWidth: '60px' }}>
                                        <div style={{ width: `${((itemCount - lateItems) / maxItems) * 100}%`, background: LV.normal }} />
                                        <div style={{ width: `${(lateItems / maxItems) * 100}%`, background: LV.bad }} />
                                    </div>
                                    {/* Count is its own click target: toggles the inline job list
                                        (stopPropagation so it doesn't also open the modal). */}
                                    {/* Count = jobs / line-items (the real workload). Click toggles the
                                        inline list; no arrow (redundant with the click-to-expand). */}
                                    {/* Fixed sub-columns so the งาน / รายการ numbers line up across every row
                                        (each number cell is a fixed width, right-aligned). */}
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setExpandedForeman(isExpanded ? null : f.id); }}
                                        style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '3px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        title="กดดูรายการงาน"
                                    >
                                        <span style={{ width: '22px', textAlign: 'right' }}>{f.load}</span>
                                        <span style={{ width: '30px', color: '#94a3b8', fontWeight: 600 }}>งาน</span>
                                        <span style={{ color: '#cbd5e1' }}>/</span>
                                        <span style={{ width: '26px', textAlign: 'right' }}>{itemCount}</span>
                                        <span style={{ width: '42px', color: '#94a3b8', fontWeight: 600 }}>รายการ</span>
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
