import { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Download, CheckCircle2, Layers, FolderKanban, Calendar, Tag, Hash, Loader2 } from 'lucide-react';
import { ModalCloseButton } from './ui/ModalCloseButton';
import { exportWorkOrdersExcel, countSubtasks, buildWoRows, buildSubtaskRows, type ExportLevel } from '../utils/exportWorkOrdersExcel';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    workOrders: any[];
    projects: any[];
    staff: any[];
}

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

const INDIGO = '#4f46e5';

const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const ExportExcelModal = ({ isOpen, onClose, workOrders, projects, staff }: Props) => {
    const [level, setLevel] = useState<ExportLevel>('both');
    const [scopeMode, setScopeMode] = useState<'all' | 'select'>('all');
    const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
    const [timeMode, setTimeMode] = useState<'all' | 'year' | 'month'>('all');
    const [timeYear, setTimeYear] = useState<string>('');
    const [timeMonth, setTimeMonth] = useState<string>('');
    const [previewSheet, setPreviewSheet] = useState<'wo' | 'subtask'>('wo');
    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
    const [woType, setWoType] = useState<'all' | 'AfterSale' | 'PreHandover'>('all');
    const [includeIds, setIncludeIds] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [result, setResult] = useState<{ woCount: number; taskCount: number } | null>(null);

    // Projects present among the (non-archived) work orders.
    const availableProjects = useMemo(() => {
        const ids = new Set<string>();
        workOrders.forEach((wo) => { if (!wo.isArchived) ids.add(wo.projectId); });
        return [...ids]
            .map((id) => ({ id, name: projects.find((p) => p.id === id)?.name || id }))
            .sort((a, b) => a.name.localeCompare(b.name, 'th'));
    }, [workOrders, projects]);

    // Years present (from startDate/createdAt).
    const availableYears = useMemo(() => {
        const ys = new Set<number>();
        workOrders.forEach((wo) => {
            const d = new Date(wo.createdAt || wo.startDate);
            if (!isNaN(d.getTime())) ys.add(d.getFullYear());
        });
        return [...ys].sort((a, b) => b - a);
    }, [workOrders]);

    // Statuses present.
    const availableStatuses = useMemo(() => {
        const s = new Set<string>();
        workOrders.forEach((wo) => { if (!wo.isArchived) s.add(wo.status); });
        return [...s];
    }, [workOrders]);

    // Reset to defaults each time the modal opens.
    useEffect(() => {
        if (isOpen) {
            setLevel('both');
            setScopeMode('all');
            setSelectedProjects(new Set());
            setTimeMode('all');
            setTimeYear(availableYears[0] ? String(availableYears[0]) : '');
            setTimeMonth(String(new Date().getMonth() + 1));
            setPreviewSheet('wo');
            setSelectedStatuses(new Set(availableStatuses));
            setWoType('all');
            setIncludeIds(true);
            setResult(null);
            setExporting(false);
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = useMemo(() => {
        return workOrders.filter((wo) => {
            if (wo.isArchived) return false;
            if (woType !== 'all' && wo.type !== woType) return false;
            if (scopeMode === 'select' && !selectedProjects.has(wo.projectId)) return false;
            if (timeMode !== 'all') {
                const d = new Date(wo.createdAt || wo.startDate);
                if (isNaN(d.getTime())) return false;
                if (timeYear && String(d.getFullYear()) !== timeYear) return false;
                if (timeMode === 'month' && timeMonth && String(d.getMonth() + 1) !== timeMonth) return false;
            }
            if (selectedStatuses.size > 0 && !selectedStatuses.has(wo.status)) return false;
            return true;
        });
    }, [workOrders, woType, scopeMode, selectedProjects, timeMode, timeYear, timeMonth, selectedStatuses]);

    const woCount = filtered.length;
    const taskCount = useMemo(() => countSubtasks(filtered), [filtered]);

    // Live preview of the first rows of the sheet that will be exported.
    const effPreview: 'wo' | 'subtask' = level === 'wo' ? 'wo' : level === 'subtask' ? 'subtask' : previewSheet;
    const previewRows = useMemo(() => {
        const slice = filtered.slice(0, 12);
        const rows = effPreview === 'wo'
            ? buildWoRows(slice, projects, staff, includeIds)
            : buildSubtaskRows(slice, projects, staff, includeIds);
        return rows.slice(0, 8);
    }, [filtered, effPreview, projects, staff, includeIds]);

    // Human-readable summary of the active selections (shown above the preview so
    // the admin can see the preview reflects exactly what they picked).
    const timeSummary = timeMode === 'all' ? 'ทุกช่วงเวลา'
        : timeMode === 'year' ? `ปี ${timeYear}`
        : `${MONTHS_TH[Number(timeMonth) - 1] || ''} ${timeYear}`;
    const typeSummary = woType === 'all' ? 'ทุกประเภท' : woType === 'AfterSale' ? 'WOA' : 'WOP';
    const scopeSummary = scopeMode === 'all' ? 'ทุกโครงการ' : `${selectedProjects.size} โครงการ`;
    const previewSummary = `${timeSummary} · ${scopeSummary} · ${typeSummary} · ${selectedStatuses.size} สถานะ · ${includeIds ? 'มีคอลัมน์ ID' : 'ไม่มี ID'}`;

    if (!isOpen) return null;

    const canExport = woCount > 0 && !exporting;

    const toggle = (set: Set<string>, key: string): Set<string> => {
        const next = new Set(set);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    };

    const handleExport = () => {
        if (!canExport) return;
        setExporting(true);
        try {
            const res = exportWorkOrdersExcel({ level, workOrders: filtered, projects, staff, includeIds });
            setResult(res);
        } catch (err) {
            console.error('Export failed:', err);
            setResult({ woCount: -1, taskCount: -1 });
        } finally {
            setExporting(false);
        }
    };

    const close = () => { onClose(); };

    // ---- shared styles ----
    const box: React.CSSProperties = {
        background: '#fff', borderRadius: '24px', width: '620px', maxWidth: '94%',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.15)', overflow: 'hidden',
    };
    const section: React.CSSProperties = { marginBottom: '20px' };
    const label: React.CSSProperties = {
        fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', marginBottom: '10px',
        display: 'flex', alignItems: 'center', gap: '7px',
    };
    const radioCard = (active: boolean): React.CSSProperties => ({
        border: `1.5px solid ${active ? INDIGO : '#e2e8f0'}`,
        background: active ? '#eef2ff' : '#fff',
        borderRadius: '12px', padding: '10px 13px', cursor: 'pointer', flex: 1,
    });
    const chip = (active: boolean): React.CSSProperties => ({
        fontSize: '0.8rem', fontWeight: 700, padding: '6px 13px', borderRadius: '999px',
        border: `1px solid ${active ? INDIGO : '#e2e8f0'}`,
        background: active ? '#eef2ff' : '#fff',
        color: active ? INDIGO : '#64748b', cursor: 'pointer',
    });
    const dot = (active: boolean): React.CSSProperties => ({
        width: '15px', height: '15px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
        border: active ? `4px solid ${INDIGO}` : '1.5px solid #cbd5e1',
    });
    const selectStyle: React.CSSProperties = { flex: 1, width: '100%', padding: '9px 11px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', background: '#fff' };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
        }}>
            <div style={box}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#ecfdf5', color: '#059669', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>ส่งออกข้อมูลเป็น Excel</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>เลือกขอบเขตและคอลัมน์ที่ต้องการ</p>
                        </div>
                    </div>
                    <ModalCloseButton onClick={close} size={24} />
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {result ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '24px 0' }}>
                            {result.woCount >= 0 ? (
                                <>
                                    <CheckCircle2 size={48} color="#10b981" />
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>ส่งออกสำเร็จ</div>
                                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                        {result.woCount} ใบงาน{level !== 'wo' ? ` · ${result.taskCount} งานย่อย` : ''} — ไฟล์ถูกดาวน์โหลดแล้ว
                                    </div>
                                </>
                            ) : (
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#b91c1c' }}>ส่งออกไม่สำเร็จ — ลองใหม่อีกครั้ง</div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Level */}
                            <div style={section}>
                                <div style={label}><Layers size={16} /> ระดับข้อมูล</div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={radioCard(level === 'both')} onClick={() => setLevel('both')}>
                                        <div style={{ display: 'flex', gap: '9px' }}>
                                            <span style={dot(level === 'both')} />
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: level === 'both' ? INDIGO : '#1e293b' }}>ทั้ง 2 ชีต</div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>ใบงาน + งานย่อย (ERP)</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={radioCard(level === 'wo')} onClick={() => setLevel('wo')}>
                                        <div style={{ display: 'flex', gap: '9px' }}>
                                            <span style={dot(level === 'wo')} />
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: level === 'wo' ? INDIGO : '#1e293b' }}>ระดับใบงาน</div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>1 แถว = 1 ใบงาน</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={radioCard(level === 'subtask')} onClick={() => setLevel('subtask')}>
                                        <div style={{ display: 'flex', gap: '9px' }}>
                                            <span style={dot(level === 'subtask')} />
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: level === 'subtask' ? INDIGO : '#1e293b' }}>ระดับงานย่อย</div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>ละเอียด · ERP</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Scope */}
                            <div style={section}>
                                <div style={label}><FolderKanban size={16} /> ขอบเขตโครงการ</div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: scopeMode === 'select' ? '10px' : 0 }}>
                                    <span style={chip(scopeMode === 'all')} onClick={() => setScopeMode('all')}>ทุกโครงการ ({availableProjects.length})</span>
                                    <span style={chip(scopeMode === 'select')} onClick={() => setScopeMode('select')}>เลือกโครงการ</span>
                                </div>
                                {scopeMode === 'select' && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px', maxHeight: '120px', overflowY: 'auto' }}>
                                        {availableProjects.map((p) => (
                                            <span key={p.id} style={chip(selectedProjects.has(p.id))} onClick={() => setSelectedProjects(toggle(selectedProjects, p.id))}>
                                                {p.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Time (by work-order open date) */}
                            <div style={section}>
                                <div style={label}><Calendar size={16} /> ช่วงเวลา (ตามวันที่เปิดใบงาน)</div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: timeMode !== 'all' ? '10px' : 0 }}>
                                    <span style={chip(timeMode === 'all')} onClick={() => setTimeMode('all')}>ทั้งหมด</span>
                                    <span style={chip(timeMode === 'year')} onClick={() => setTimeMode('year')}>รายปี</span>
                                    <span style={chip(timeMode === 'month')} onClick={() => setTimeMode('month')}>รายเดือน</span>
                                </div>
                                {timeMode !== 'all' && (
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <select value={timeYear} onChange={(e) => setTimeYear(e.target.value)} style={selectStyle}>
                                            {availableYears.map((y) => <option key={y} value={String(y)}>ปี {y}</option>)}
                                        </select>
                                        {timeMode === 'month' && (
                                            <select value={timeMonth} onChange={(e) => setTimeMonth(e.target.value)} style={selectStyle}>
                                                {MONTHS_TH.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                                            </select>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Type */}
                            <div style={section}>
                                <div style={label}><Tag size={16} /> ประเภทงาน</div>
                                <select value={woType} onChange={(e) => setWoType(e.target.value as any)} style={selectStyle}>
                                    <option value="all">ทั้งหมด</option>
                                    <option value="AfterSale">WOA (After Sale)</option>
                                    <option value="PreHandover">WOP (Pre Handover)</option>
                                </select>
                            </div>

                            {/* Status */}
                            <div style={section}>
                                <div style={label}>
                                    <CheckCircle2 size={16} /> สถานะ
                                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                        <span style={{ ...chip(false), padding: '3px 10px', fontSize: '0.72rem' }} onClick={() => setSelectedStatuses(new Set(availableStatuses))}>ทั้งหมด</span>
                                        <span style={{ ...chip(false), padding: '3px 10px', fontSize: '0.72rem' }} onClick={() => setSelectedStatuses(new Set())}>ล้าง</span>
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {availableStatuses.map((s) => (
                                        <span key={s} style={chip(selectedStatuses.has(s))} onClick={() => setSelectedStatuses(toggle(selectedStatuses, s))}>
                                            {STATUS_TH[s] || s}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* ID columns */}
                            <div style={section}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={includeIds} onChange={(e) => setIncludeIds(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: INDIGO }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Hash size={15} /> ใส่คอลัมน์รหัส/ID (projectId, workOrderId, taskId) สำหรับต่อยอด ERP
                                    </span>
                                </label>
                            </div>

                            {/* Live preview */}
                            <div>
                                <div style={label}>
                                    <FileSpreadsheet size={16} /> ตัวอย่างข้อมูล
                                    {level === 'both' && (
                                        <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                            <span style={{ ...chip(effPreview === 'wo'), padding: '3px 10px', fontSize: '0.72rem' }} onClick={() => setPreviewSheet('wo')}>ใบงาน</span>
                                            <span style={{ ...chip(effPreview === 'subtask'), padding: '3px 10px', fontSize: '0.72rem' }} onClick={() => setPreviewSheet('subtask')}>งานย่อย</span>
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: INDIGO, background: '#eef2ff', borderRadius: '8px', padding: '6px 10px', marginBottom: '8px' }}>
                                    อัปเดตตามที่เลือก: {previewSummary}
                                </div>
                                {previewRows.length === 0 ? (
                                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', padding: '16px', textAlign: 'center', border: '1px dashed #e2e8f0', borderRadius: '12px' }}>ไม่มีข้อมูลตามเงื่อนไขที่เลือก</div>
                                ) : (
                                    <>
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                            <div style={{ overflowX: 'auto', maxHeight: '220px', overflowY: 'auto' }}>
                                                <table style={{ borderCollapse: 'collapse', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                                    <thead>
                                                        <tr>
                                                            {Object.keys(previewRows[0]).map((h) => (
                                                                <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: '#64748b', fontWeight: 800, borderBottom: '1px solid #e2e8f0', background: '#f8fafc', position: 'sticky', top: 0 }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {previewRows.map((r, i) => (
                                                            <tr key={i}>
                                                                {Object.keys(previewRows[0]).map((h) => (
                                                                    <td key={h} style={{ padding: '6px 10px', color: '#334155', borderBottom: '1px solid #f1f5f9' }}>{String(r[h] ?? '')}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px' }}>
                                            แสดง {previewRows.length} แถวแรก · ทั้งหมด {effPreview === 'wo' ? `${woCount} ใบงาน` : `${taskCount} งานย่อย`}
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '18px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        {result ? '' : <>จะส่งออก <b style={{ color: '#0f172a' }}>{woCount}</b> ใบงาน{level !== 'wo' ? <> · <b style={{ color: '#0f172a' }}>{taskCount}</b> งานย่อย</> : ''}</>}
                    </span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={close} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>
                            {result ? 'ปิด' : 'ยกเลิก'}
                        </button>
                        {!result && (
                            <button
                                onClick={handleExport}
                                disabled={!canExport}
                                style={{
                                    padding: '10px 24px', borderRadius: '12px', border: 'none',
                                    background: canExport ? INDIGO : '#cbd5e1', color: '#fff', fontWeight: 700,
                                    cursor: canExport ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                }}
                            >
                                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                {exporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportExcelModal;
