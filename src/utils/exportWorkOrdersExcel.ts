// ============================================================================
// exportWorkOrdersExcel.ts — build + download an Excel (.xlsx) report of work
// orders for Admin/Manager. Two sheets:
//   1. "สรุปรายใบงาน"   — one row per WorkOrder (the status report the admin asked for)
//   2. "ระดับงานย่อย"   — one row per subtask, with cost type / amount / IDs for ERP
//
// SLA at the JOB (WorkOrder) level routes through computeJobSLA() — the single
// source of truth — so the numbers agree with the dashboard/SLA monitor.
// Per-subtask SLA (sheet 2) is computed locally here, mirroring jobSla's
// appointment(@08:00)+SLA-hours vs completion rule, since the app's per-subtask
// calc lives inside Dashboard and is not exported. This stays isolated to the
// export and never feeds live SLA numbers.
// ============================================================================
import * as XLSX from 'xlsx';
import { computeJobSLA, SLA_LABELS, SLA_HOURS_MAP } from './jobSla';

const HOUR_MS = 3600_000;
const DAY_MS = 86_400_000;

// WorkOrder/Task status → Thai (mirrors WorkOrderCard.tsx getStatusLabel).
const STATUS_TH: Record<string, string> = {
    Draft: 'ร่าง',
    Evaluating: 'รอประเมิน',
    Assigned: 'มอบหมายแล้ว',
    'Partially Approved': 'อนุมัติบางส่วน',
    Rejected: 'ไม่อนุมัติ',
    'In Progress': 'กำลังดำเนินการ',
    'For Checking': 'งานเสร็จ · รอออก QR',
    pending_delivery: 'รอลูกค้าประเมิน',
    customer_reject: 'ลูกค้าตีกลับ',
    Complete: 'เสร็จสมบูรณ์',
    Cancelled: 'ยกเลิก',
};
const statusTH = (s?: string) => (s && STATUS_TH[s]) || s || '-';

// JobSLA.status → Thai result label.
const SLA_RESULT_TH: Record<string, string> = {
    'on-time': 'ทันกำหนด',
    late: 'เกินกำหนด',
    normal: 'อยู่ในกำหนด',
    critical: 'ใกล้ครบกำหนด',
    overdue: 'เกินกำหนด (ยังไม่เสร็จ)',
    'not-eligible': '—',
};

const COST_TYPE_TH: Record<string, string> = {
    Warranty: 'ประกัน (Warranty)',
    Billable: 'เรียกเก็บ (Billable)',
    Project: 'โครงการ (Project)',
    None: '—',
};

const WO_TYPE_CODE: Record<string, string> = { AfterSale: 'WOA', PreHandover: 'WOP' };

// ISO/date → YYYY-MM-DD (empty string when missing/invalid).
const ymd = (v?: string | number | null): string => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
};

const projectName = (projects: any[], id: string): string =>
    projects.find((p) => p.id === id)?.name || id || '';

// Resolve a readable name for the WO owner (foreman).
const woOwnerName = (wo: any, staff: any[]): string => {
    const id = wo.woOwnerId || wo.reporterId;
    const s = id ? staff.find((x) => x.id === id || x.employeeId === id) : null;
    return s?.name || wo.reporterName || '';
};

// Resolve a readable name for whoever is responsible for a subtask.
const taskResponsibleName = (t: any, wo: any, staff: any[]): string => {
    const id = (t.responsibleStaffIds && t.responsibleStaffIds[0]) || t.subtaskOperatorId || t.assignedForeman;
    const s = id ? staff.find((x) => x.id === id || x.employeeId === id) : null;
    return s?.name || woOwnerName(wo, staff) || '';
};

// A readable name/problem for the WO (used as "ชื่อ/ปัญหา").
const woTitle = (wo: any): string => {
    if (wo.initialProblem) return wo.initialProblem;
    const firstTask = wo.categories?.[0]?.tasks?.[0];
    return firstTask?.taskName || firstTask?.name || wo.locationName || '';
};

// Average confirmed progress across non-rejected/cancelled subtasks (matches the
// spirit of Dashboard.isWorkOrderCompleted).
const woProgress = (wo: any): number => {
    let sum = 0, n = 0;
    (wo.categories || []).forEach((c: any) =>
        (c.tasks || []).forEach((t: any) => {
            if (t.status !== 'Rejected' && t.status !== 'Cancelled') {
                sum += t.dailyProgress || 0;
                n++;
            }
        })
    );
    return n ? Math.round(sum / n) : 0;
};

interface SubSla { category: string; result: string; days: number | '' }

// Per-subtask SLA — mirrors jobSla's appointment(@08:00)+SLA-hours vs completion.
const computeSubtaskSLA = (t: any, wo: any): SubSla => {
    const isWop = wo?.type === 'PreHandover';
    const cat = (isWop ? (wo?.phActualSla || t?.slaCategory) : t?.slaCategory) || t?.baselineSla;
    const label = (cat && SLA_LABELS[cat]) || '—';
    const hours = cat ? SLA_HOURS_MAP[cat] : undefined;
    const apptRaw = isWop ? (wo?.scheduledDate || t?.startDate) : t?.startDate;
    if (!cat || !hours || !apptRaw) return { category: label, result: '—', days: '' };

    const startMs = new Date(`${String(apptRaw).split('T')[0]}T08:00:00+07:00`).getTime();
    if (isNaN(startMs)) return { category: label, result: '—', days: '' };
    const deadline = startMs + hours * HOUR_MS;

    const done =
        !!t.completedAt ||
        t.status === 'Complete' ||
        ((t.dailyProgress || 0) >= 100 && t.progressStatus !== 'draft');
    const endMs = t.completedAt ? new Date(t.completedAt).getTime() : null;

    if (done && endMs && !isNaN(endMs)) {
        return {
            category: label,
            result: endMs <= deadline ? 'ทันกำหนด' : 'เกินกำหนด',
            days: Math.round((endMs - deadline) / DAY_MS),
        };
    }
    const now = Date.now();
    return {
        category: label,
        result: now <= deadline ? 'อยู่ในกำหนด' : 'เกินกำหนด (ยังไม่เสร็จ)',
        days: Math.round((now - deadline) / DAY_MS),
    };
};

const ID_KEYS = ['projectId', 'workOrderId', 'taskId'];

export const buildWoRows = (wos: any[], projects: any[], staff: any[], includeIds: boolean): any[] =>
    wos.map((wo) => {
        const sla = computeJobSLA(wo);
        const row: Record<string, any> = {
            'รหัสใบงาน': wo.id || '',
            'ชื่อ/ปัญหา': woTitle(wo),
            'โครงการ': projectName(projects, wo.projectId),
            'อาคาร': wo.building || '',
            'ชั้น': wo.floor || '',
            'ห้อง': wo.room || wo.locationName || '',
            'ประเภทงาน': WO_TYPE_CODE[wo.type] || wo.type || '',
            'สถานะ': statusTH(wo.status),
            'SLA ประเภท': sla.slaLabel,
            'SLA ผล': SLA_RESULT_TH[sla.status] || '—',
            'SLA จำนวนวัน (+เกิน/-ก่อน)': sla.isEligible ? sla.daysDiff : '',
            'ความคืบหน้า %': woProgress(wo),
            'โฟร์แมน': woOwnerName(wo, staff),
            'ผู้แจ้ง': wo.reporterName || '',
            'วันเปิดงาน': ymd(wo.startDate || wo.createdAt),
            'วันเสร็จ': ymd(wo.completedAt),
            projectId: wo.projectId || '',
            workOrderId: wo.id || '',
        };
        if (!includeIds) ID_KEYS.forEach((k) => delete row[k]);
        return row;
    });

export const buildSubtaskRows = (wos: any[], projects: any[], staff: any[], includeIds: boolean): any[] => {
    const rows: any[] = [];
    wos.forEach((wo) => {
        const proj = projectName(projects, wo.projectId);
        (wo.categories || []).forEach((c: any) =>
            (c.tasks || []).forEach((t: any) => {
                const sla = computeSubtaskSLA(t, wo);
                const row: Record<string, any> = {
                    'รหัสใบงาน': wo.id || '',
                    'โครงการ': proj,
                    'อาคาร': wo.building || '',
                    'ชั้น': wo.floor || '',
                    'ห้อง': wo.room || wo.locationName || '',
                    'หมวดงาน': c.name || c.catName || '',
                    'ชื่องานย่อย': t.taskName || t.name || t.subtaskName || '',
                    'สถานะงานย่อย': statusTH(t.status),
                    'SLA ประเภท': sla.category,
                    'SLA ผล': sla.result,
                    'SLA จำนวนวัน (+เกิน/-ก่อน)': sla.days,
                    'ความคืบหน้า %': Math.round(t.dailyProgress || 0),
                    'ประเภทค่าใช้จ่าย': COST_TYPE_TH[t.costType || 'None'] || t.costType || '—',
                    'จำนวน': t.amount ?? '',
                    'หน่วย': t.unit || '',
                    'ผู้รับผิดชอบ': taskResponsibleName(t, wo, staff),
                    'วันเปิดงาน': ymd(t.startDate),
                    'วันเสร็จ': ymd(t.completedAt),
                    projectId: wo.projectId || '',
                    workOrderId: wo.id || '',
                    taskId: t.id || '',
                };
                if (!includeIds) ID_KEYS.forEach((k) => delete row[k]);
                rows.push(row);
            })
        );
    });
    return rows;
};

const autoCols = (rows: any[]): { wch: number }[] => {
    if (!rows.length) return [];
    return Object.keys(rows[0]).map((key) => {
        const maxLen = rows.reduce(
            (m, r) => Math.max(m, String(r[key] ?? '').length),
            key.length
        );
        return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
    });
};

export type ExportLevel = 'both' | 'wo' | 'subtask';

export interface ExportOptions {
    level: ExportLevel;
    workOrders: any[]; // already filtered by the caller (scope/time/status/type)
    projects: any[];
    staff: any[];
    includeIds?: boolean;
    fileName?: string;
}

export interface ExportResult {
    woCount: number;
    taskCount: number;
}

// Count subtasks that WOULD be exported (all tasks across categories).
export const countSubtasks = (wos: any[]): number =>
    wos.reduce(
        (sum, wo) => sum + (wo.categories || []).reduce((s: number, c: any) => s + (c.tasks?.length || 0), 0),
        0
    );

export function exportWorkOrdersExcel(opts: ExportOptions): ExportResult {
    const { level, workOrders, projects, staff, includeIds = true } = opts;
    const wb = XLSX.utils.book_new();

    if (level !== 'subtask') {
        const rows = buildWoRows(workOrders, projects, staff, includeIds);
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = autoCols(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'สรุปรายใบงาน');
    }
    if (level !== 'wo') {
        const rows = buildSubtaskRows(workOrders, projects, staff, includeIds);
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = autoCols(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'ระดับงานย่อย');
    }

    const fileName = opts.fileName || `After-Sale_Export_${ymd(Date.now())}.xlsx`;
    XLSX.writeFile(wb, fileName);

    return { woCount: workOrders.length, taskCount: countSubtasks(workOrders) };
}
