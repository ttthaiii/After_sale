import React from 'react';
import { CheckCircle2, Check, FileText, X, Clock, AlertCircle } from 'lucide-react';
import { ModalCloseButton } from './ui/ModalCloseButton';

// Rich "ประวัติการปฏิบัติงาน" modal — single source (extracted from Dashboard.tsx
// where it was a local const; the director dashboard now reuses this same one).
// Pure move, no logic change. Props: isOpen, onClose, task (needs task.history[]).
const TaskHistoryModal = ({ isOpen, onClose, task }: any) => {
    if (!isOpen || !task) return null;

    // Sort ascending for timeline view
    const history = [...(task.history || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group by revisionId
    const revGroups: Record<string, any[]> = {};
    history.forEach((log: any) => {
        const revId = log.revisionId || 'rev00';
        if (!revGroups[revId]) revGroups[revId] = [];
        revGroups[revId].push(log);
    });
    const sortedRevKeys = Object.keys(revGroups).sort((a, b) => a.localeCompare(b));

    const calcHrs = (logs: any[]) => logs.reduce((sum: number, log: any) =>
        sum + (log.labor || []).reduce((s: number, l: any) => {
            const eh = l.expectedHours || {};
            return s + (eh.normal||0) + (eh.otNoon||0) + (eh.otEvening||0) + (eh.otMorning||0);
        }, 0), 0);

    const totalHrsAll = calcHrs(history);
    const totalDaysAll = new Set(history.map((l: any) => l.date?.split('T')[0]).filter(Boolean)).size;

    const revNum = (revId: string) => parseInt(String(revId).replace(/[^0-9]/g, '')) || 0;

    const fmtDate = (d: Date) =>
        `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()+543}`;

    const revColors = [
        { bg: '#eff6ff', border: '#bfdbfe', headerBg: '#dbeafe', text: '#1d4ed8', badge: '#2563eb' },
        { bg: '#fff7ed', border: '#fed7aa', headerBg: '#ffedd5', text: '#c2410c', badge: '#ea580c' },
        { bg: '#f0fdf4', border: '#bbf7d0', headerBg: '#dcfce7', text: '#15803d', badge: '#16a34a' },
        { bg: '#fdf4ff', border: '#e9d5ff', headerBg: '#f3e8ff', text: '#7e22ce', badge: '#9333ea' },
    ];

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', width: '740px', maxWidth: '100%', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', animation: 'modalSlideUp 0.3s ease-out' }}>

                {/* Modal Header */}
                <div style={{ padding: '24px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>ประวัติการปฏิบัติงาน</h3>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 12px 0', fontWeight: 600 }}>{task.taskName} · {task.locationName || task.projectName}</p>
                        {/* Cumulative summary chips */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '4px 12px', background: '#f1f5f9', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#334155' }}>
                                📋 {sortedRevKeys.length} ครั้ง{sortedRevKeys.length > 1 ? ' (มีการแก้ไข)' : ''}
                            </span>
                            <span style={{ padding: '4px 12px', background: '#ede9fe', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#6d28d9' }}>
                                ⏱ รวม {totalHrsAll} ชม. (ทุก REV.)
                            </span>
                            <span style={{ padding: '4px 12px', background: '#ecfeff', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#0891b2' }}>
                                📅 {totalDaysAll} วันทำงาน
                            </span>
                        </div>
                    </div>
                    <ModalCloseButton onClick={onClose} buttonSize={40} style={{ borderRadius: '12px' }} />
                </div>

                {/* Body */}
                <div style={{ padding: '24px 32px', maxHeight: '65vh', overflowY: 'auto', background: '#fff' }}>
                    {history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>ยังไม่มีบันทึกการปฏิบัติงาน</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {sortedRevKeys.map((revId, revIdx) => {
                                const logs = revGroups[revId];
                                const col = revColors[revIdx % revColors.length];
                                const revHrs = calcHrs(logs);
                                const revDays = new Set(logs.map((l: any) => l.date?.split('T')[0]).filter(Boolean)).size;
                                // CONFIRMED progress only (draft ignored — user rule 2026-08-19): a draft
                                // daily report (log.status==='draft') must NOT light the "งานเสร็จ" step,
                                // advance resultStatus, or move the rev range. Derive rev completion from
                                // SUBMITTED logs only. (log.status = the report doc's submit status,
                                // spread in via assembleWorkOrders; distinct from log.revisionStatus.)
                                const submittedLogs = logs.filter((l: any) => (l as any).status !== 'draft');
                                const lastProg = submittedLogs.length ? (submittedLogs[submittedLogs.length - 1]?.progress ?? 0) : 0;
                                // Start progress of this revision = max CONFIRMED progress before this rev.
                                const allBeforeThisRev = history.filter((l: any) => (l.revisionId || 'rev00') !== revId && (l as any).status !== 'draft');
                                const progBefore = allBeforeThisRev.length > 0
                                    ? Math.max(...allBeforeThisRev.map((l: any) => l.progress || 0))
                                    : 0;
                                const rNum = revNum(revId);

                                return (
                                    <div key={revId} style={{ border: `1.5px solid ${col.border}`, borderRadius: '20px', overflow: 'hidden', background: col.bg }}>
                                        {/* Revision Header */}
                                        <div style={{ padding: '14px 20px', background: col.headerBg, borderBottom: `1px solid ${col.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ padding: '3px 10px', background: col.badge, color: '#fff', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 900 }}>
                                                    REV.{rNum}
                                                </span>
                                                {rNum > 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: col.text, fontWeight: 700 }}>การแก้ไขครั้งที่ {rNum}</span>
                                                )}
                                                {rNum === 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: col.text, fontWeight: 700 }}>งานเริ่มต้น</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.7)', color: col.text, borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                    {progBefore}% → {lastProg}%
                                                </span>
                                                <span style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.7)', color: col.text, borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                    {revDays} วัน · {revHrs} ชม.
                                                </span>
                                            </div>
                                        </div>

                                        {/* Mini timeline for this revision */}
                                        {(() => {
                                            const revMs = logs.map((l: any) => new Date(l.date).getTime()).filter(Number.isFinite);
                                            if (!revMs.length) return null;
                                            // Use task.startDate if set and earlier than first log (handles retroactive start date changes)
                                            const startDateMs = task.startDate ? new Date(task.startDate.split('T')[0] + 'T00:00:00').getTime() : null;
                                            const firstLogMs = Math.min(...revMs);
                                            const revFirstDate = new Date(startDateMs && startDateMs < firstLogMs ? startDateMs : firstLogMs);
                                            const revMaxDate = new Date(Math.max(...revMs));
                                            const isLastRev = revIdx === sortedRevKeys.length - 1;
                                            const isRejected = logs[0]?.revisionStatus === 'closed_rejected';
                                            const _qrRaw = (isLastRev && task.wo?.inspectionTimeline?.qrGeneratedAt)
                                                ? new Date(task.wo.inspectionTimeline.qrGeneratedAt) : null;
                                            // Only valid if QR was generated AFTER work completion (else it's a previous rev's QR)
                                            const qrDate = (_qrRaw && _qrRaw.getTime() > revMaxDate.getTime()) ? _qrRaw : null;
                                            const approvalDate = (!isRejected && task.wo?.completedAt)
                                                ? new Date(task.wo.completedAt) : null;
                                            const daysBetween = (a: Date | null, b: Date | null) =>
                                                (a && b) ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000)) : null;
                                            const daysWork = daysBetween(revFirstDate, revMaxDate);
                                            const daysToQr = daysBetween(revMaxDate, qrDate);
                                            const daysResult = daysBetween(qrDate || revMaxDate, approvalDate);
                                            const resultStatus = isRejected ? 'reject' : (isLastRev && lastProg >= 100) ? (approvalDate ? 'done' : 'pending') : 'wait';

                                            const nodeBase: React.CSSProperties = { width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 };
                                            const nodeStyles: Record<string, React.CSSProperties> = {
                                                done:    { ...nodeBase, background: '#1D9E75', color: '#fff' },
                                                reject:  { ...nodeBase, background: '#E24B4A', color: '#fff' },
                                                pending: { ...nodeBase, background: '#EF9F27', color: '#fff' },
                                                wait:    { ...nodeBase, background: '#f1f5f9', border: '1.5px solid #cbd5e1', color: '#94a3b8' },
                                            };
                                            const connLine = (done: boolean, danger = false, dashed = false): React.CSSProperties => ({
                                                height: '3px', width: '100%',
                                                background: dashed ? 'repeating-linear-gradient(90deg,#EF9F27 0,#EF9F27 6px,transparent 6px,transparent 11px)'
                                                    : danger ? '#E24B4A' : done ? '#1D9E75' : '#e2e8f0',
                                            });
                                            const stageWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '88px' };
                                            const lbl: React.CSSProperties = { fontSize: '12px', color: '#64748b', marginTop: '6px', textAlign: 'center', lineHeight: '1.5' };
                                            const lbl2: React.CSSProperties = { fontSize: '11px', color: '#94a3b8' };
                                            // paddingTop = (nodeSize - lineHeight) / 2 = (46 - 3) / 2 ≈ 21px — aligns line center to circle center
                                            const conn: React.CSSProperties = { flex: 1, minWidth: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '21px' };

                                            return (
                                                <div style={{ padding: '14px 20px 12px', background: 'rgba(0,0,0,0.03)', borderBottom: `1px solid ${col.border}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto' }}>
                                                        {/* Stage 1: เริ่มงาน */}
                                                        <div style={stageWrap}>
                                                            <div style={nodeStyles.done}><CheckCircle2 size={20} /></div>
                                                            <div style={lbl}><strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>โฟรแมน</strong>เริ่มงาน<br/><span style={lbl2}>{fmtDate(revFirstDate)}</span></div>
                                                        </div>
                                                        {/* Conn 1→2 */}
                                                        <div style={conn}>
                                                            <div style={connLine(true)}></div>
                                                            {daysWork !== null && daysWork > 0 && <span style={{ ...lbl2, marginTop: '3px', whiteSpace: 'nowrap' }}>{daysWork} วัน</span>}
                                                        </div>
                                                        {/* Stage 2: งานเสร็จ */}
                                                        <div style={stageWrap}>
                                                            <div style={nodeStyles[lastProg >= 100 ? 'done' : 'wait']}><Check size={20} /></div>
                                                            <div style={lbl}><strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>งานเสร็จ</strong>{lastProg >= 100 ? '100%' : `${lastProg}%`}<br/><span style={lbl2}>{lastProg >= 100 ? fmtDate(revMaxDate) : '—'}</span></div>
                                                        </div>
                                                        {/* Conn 2→3 */}
                                                        <div style={conn}>
                                                            <div style={connLine(!!qrDate)}></div>
                                                            {daysToQr !== null && <span style={{ ...lbl2, marginTop: '3px', whiteSpace: 'nowrap' }}>{daysToQr} วัน</span>}
                                                        </div>
                                                        {/* Stage 3: ส่ง QR */}
                                                        <div style={stageWrap}>
                                                            <div style={nodeStyles[qrDate ? 'done' : 'wait']}><FileText size={20} /></div>
                                                            <div style={lbl}><strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>ส่ง QR</strong><span style={lbl2}>{qrDate ? fmtDate(qrDate) : '—'}</span></div>
                                                        </div>
                                                        {/* Conn 3→4 */}
                                                        <div style={conn}>
                                                            <div style={connLine(resultStatus === 'done', isRejected, resultStatus === 'pending')}></div>
                                                            {daysResult !== null && <span style={{ ...lbl2, color: isRejected ? '#dc2626' : '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap' }}>{daysResult} วัน</span>}
                                                        </div>
                                                        {/* Stage 4: ผลตรวจ */}
                                                        <div style={stageWrap}>
                                                            <div style={nodeStyles[resultStatus]}>
                                                                {resultStatus === 'reject' ? <X size={20} /> : resultStatus === 'done' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                                                            </div>
                                                            <div style={{ ...lbl, color: isRejected ? '#dc2626' : '#64748b' }}>
                                                                <strong style={{ fontSize: '13px', color: isRejected ? '#dc2626' : '#1e293b', display: 'block' }}>ลูกค้า</strong>
                                                                {isRejected ? 'ไม่ผ่าน' : resultStatus === 'done' ? 'ตรวจผ่าน' : 'รอตรวจ'}
                                                                <br/><span style={lbl2}>{approvalDate ? fmtDate(approvalDate) : '—'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Daily entries within this revision */}
                                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {logs.map((log: any, logIdx: number) => {
                                                const logDate = new Date(log.date);
                                                // baseline = last CONFIRMED progress before this row (skip drafts)
                                                const _prevSubmitted = logs.slice(0, logIdx).filter((l: any) => (l as any).status !== 'draft');
                                                const prevProg = _prevSubmitted.length ? (_prevSubmitted[_prevSubmitted.length - 1].progress || 0) : progBefore;
                                                const isDraftLog = (log as any).status === 'draft';
                                                const totalWorkers = (log.labor || []).reduce((acc: number, l: any) => acc + (l.amount || 1), 0);
                                                const isProblem = log.type === 'Problem';
                                                const logHrs = calcHrs([log]);
                                                // photos: { laborByShift: { regular, otMorning, otNoon, otEvening }, site }
                                                const _shiftLabel: Record<string, string> = { regular: 'กะปกติ', otMorning: 'OT เช้า', otNoon: 'OT เที่ยง', otEvening: 'OT เย็น' };
                                                // isLabor=true → slot0=เข้า slot1=ออก (เฉพาะเมื่อมีพอดี 2 รูป)
                                                const photosByShift: { label: string; urls: string[]; isLabor: boolean }[] = [];
                                                if (Array.isArray(log.photos)) {
                                                    const urls = log.photos.map((p: any) => typeof p === 'string' ? p : (p.url || p.downloadUrl || p.uri || null)).filter(Boolean);
                                                    if (urls.length) photosByShift.push({ label: 'รูปภาพ', urls, isLabor: false });
                                                } else if (log.photos) {
                                                    if (Array.isArray(log.photos.site) && log.photos.site.filter(Boolean).length > 0)
                                                        photosByShift.push({ label: 'รูปหน้างาน', urls: log.photos.site.filter(Boolean), isLabor: false });
                                                    if (log.photos.laborByShift) {
                                                        for (const [shift, urls] of Object.entries(log.photos.laborByShift)) {
                                                            if (Array.isArray(urls) && (urls as string[]).filter(Boolean).length > 0)
                                                                photosByShift.push({ label: _shiftLabel[shift] || shift, urls: (urls as string[]).filter(Boolean), isLabor: true });
                                                        }
                                                    }
                                                }
                                                const totalPhotos = photosByShift.reduce((a, s) => a + s.urls.length, 0);

                                                return (
                                                    <div key={logIdx} style={{ background: isProblem ? '#fff1f2' : '#fff', borderRadius: '14px', border: `1px solid ${isProblem ? '#fca5a5' : '#e2e8f0'}`, overflow: 'hidden' }}>
                                                        {/* Log row header */}
                                                        <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {isProblem && <AlertCircle size={14} color="#ef4444" />}
                                                                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: isProblem ? '#dc2626' : '#0f172a' }}>
                                                                    {fmtDate(logDate)}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                {isProblem && <span style={{ padding: '2px 8px', background: '#fef2f2', color: '#ef4444', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>🚨 พบปัญหา</span>}
                                                                {isDraftLog ? (
                                                                    <span style={{ padding: '2px 10px', background: '#fef3c7', color: '#b45309', borderRadius: '6px', fontSize: '0.73rem', fontWeight: 900 }}>
                                                                        ⏳ รอยืนยันข้อมูล
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ padding: '2px 10px', background: '#e0e7ff', color: '#4338ca', borderRadius: '6px', fontSize: '0.73rem', fontWeight: 900 }}>
                                                                        {prevProg}% → {log.progress}%
                                                                    </span>
                                                                )}
                                                                {totalWorkers > 0 && (
                                                                    <span style={{ padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                                                        👷 {totalWorkers} คน
                                                                    </span>
                                                                )}
                                                                {logHrs > 0 && (
                                                                    <span style={{ padding: '2px 8px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>
                                                                        รวม {logHrs} ชม.
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Workers */}
                                                        {(log.labor || []).length > 0 && (
                                                            <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                {(log.labor || []).map((l: any, lIdx: number) => {
                                                                    const name = l.workerName || l.staffName || l.workerId || '—';
                                                                    const timeRange = l.shiftTimes?.day?.trim() || null;
                                                                    const eh = l.expectedHours || {};
                                                                    const normalHrs = eh.normal || 0;
                                                                    const otHrs = (eh.otNoon||0) + (eh.otEvening||0) + (eh.otMorning||0);
                                                                    const otBreakdown = [
                                                                        eh.otMorning  ? `OT เช้า ${eh.otMorning}ชม.`  : null,
                                                                        eh.otNoon     ? `OT เที่ยง ${eh.otNoon}ชม.`   : null,
                                                                        eh.otEvening  ? `OT เย็น ${eh.otEvening}ชม.`  : null,
                                                                    ].filter(Boolean);
                                                                    const wHrs = normalHrs + otHrs;
                                                                    const isMember = l.membership === 'Internal';
                                                                    return (
                                                                        <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px' }}>
                                                                            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: isMember ? '#ede9fe' : '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                                                                                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: isMember ? '#6d28d9' : '#a16207' }}>{isMember ? 'DC' : 'OT'}</span>
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>{name}</div>
                                                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                    {timeRange && (
                                                                                        <span style={{ fontSize: '0.72rem', color: '#0891b2', fontWeight: 700, background: '#ecfeff', padding: '2px 7px', borderRadius: '5px' }}>🕐 {timeRange}</span>
                                                                                    )}
                                                                                    {normalHrs > 0 && (
                                                                                        <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700, background: '#f1f5f9', padding: '2px 7px', borderRadius: '5px' }}>ปกติ {normalHrs} ชม.</span>
                                                                                    )}
                                                                                    {otBreakdown.map((ot, i) => (
                                                                                        <span key={i} style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 700, background: '#fefce8', padding: '2px 7px', borderRadius: '5px', border: '1px solid #fde68a' }}>{ot}</span>
                                                                                    ))}
                                                                                    {wHrs > 0 && (
                                                                                        <span style={{ fontSize: '0.73rem', color: '#7c3aed', fontWeight: 900, background: '#f5f3ff', padding: '2px 7px', borderRadius: '5px' }}>= {wHrs} ชม.</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Foreman note — Site Notes จากช่างตอนลงรายงาน */}
                                                        {log.note && (
                                                            <div style={{ margin: '0 16px 10px', padding: '10px 14px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>📝</span>
                                                                <div>
                                                                    <div style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>
                                                                        หมายเหตุช่าง <span style={{ fontWeight: 600, opacity: 0.7 }}>(Site Notes)</span>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.82rem', color: '#78350f', fontWeight: 600, lineHeight: 1.5 }}>{log.note}</div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Photos — toggle */}
                                                        {totalPhotos > 0 && (
                                                            <details style={{ margin: '0 16px 10px' }}>
                                                                <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569', border: '1px solid #e2e8f0', userSelect: 'none' }}>
                                                                    <span>📷</span> ดูรูป ({totalPhotos} รูป)
                                                                </summary>
                                                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    {photosByShift.map((group, gi) => (
                                                                        <div key={gi}>
                                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{group.label}</div>
                                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                                {group.urls.map((url, pi) => {
                                                                                    const slotLabel = group.isLabor && group.urls.length === 2
                                                                                        ? (pi === 0 ? 'เข้า' : 'ออก') : null;
                                                                                    return (
                                                                                        <div key={pi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                                                                <img src={url} alt={`${group.label}-${pi}`} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'block' }} />
                                                                                            </a>
                                                                                            {slotLabel && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b' }}>{slotLabel}</span>}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </details>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Rejection banner — shown at bottom of REV if it was rejected */}
                                            {(() => {
                                                const anyLog = logs[0];
                                                const revStatus = anyLog?.revisionStatus;
                                                const rejectReason = anyLog?.revisionRejectReason;
                                                const defectCats = anyLog?.revisionDefectCategories;
                                                if (revStatus !== 'closed_rejected') return null;
                                                const defectList = defectCats ? Object.entries(defectCats).filter(([,v]) => v).map(([k]) => k.split('(')[0].trim()) : [];
                                                return (
                                                    <div style={{ margin: '4px 0 4px', padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fca5a5', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>❌</span>
                                                        <div>
                                                            <div style={{ fontSize: '0.68rem', color: '#991b1b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>ลูกค้า Reject — ต้องแก้ไข</div>
                                                            {rejectReason && <div style={{ fontSize: '0.82rem', color: '#7f1d1d', fontWeight: 700, marginBottom: '4px' }}>"{rejectReason}"</div>}
                                                            {defectList.length > 0 && (
                                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                                    {defectList.map((d, i) => (
                                                                        <span key={i} style={{ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 700, background: '#fee2e2', padding: '2px 7px', borderRadius: '5px' }}>{d}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '12px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' }}>ปิดหน้าต่าง</button>
                </div>
            </div>
        </div>
    );
};

export default TaskHistoryModal;
