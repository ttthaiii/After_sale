import { useState, useEffect } from 'react';
import { FileText, Download, Camera, User, UserCheck, CheckCircle, Clock, Activity, ChevronDown, Printer, Star, RotateCcw } from 'lucide-react';
import { WorkOrder, MasterTask, Project, Staff, Contractor } from '../types';
import { formatDate, formatDateTime } from '../utils/date';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface HistoryDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    workOrder: WorkOrder;
    projects: Project[];
    staff: Staff[];
    contractors: Contractor[]; // Leaving for future use in team list if needed, but for now we'll mark as ignored if unused
    currentUserId?: string;
    selectedTaskId?: string | null; // Track specific task clicked in history
}

const HistoryDetailModal = ({ isOpen, onClose, workOrder, projects, staff, currentUserId, selectedTaskId }: HistoryDetailModalProps) => {
    const [taskRevisions, setTaskRevisions] = useState<Record<string, any[]>>({});
    const [selectedRevisions, setSelectedRevisions] = useState<Record<string, string>>({});

    const getSubtaskId = (tId: string): string => {
        if (tId && tId.startsWith('LR-')) {
            return tId.substring(3);
        }
        return tId;
    };

    const getProgressPhotos = (h: any): string[] => {
        if (!h || !h.photos) return [];
        if (Array.isArray(h.photos)) {
            return h.photos.filter(Boolean);
        }
        if (typeof h.photos === 'object') {
            if (h.photos.site && Array.isArray(h.photos.site)) {
                return h.photos.site.filter(Boolean);
            }
        }
        return [];
    };

    const getPhotoFromReport = (report: any) => {
        if (!report || !report.photos) return null;
        const p = report.photos;
        if (Array.isArray(p)) {
            return p.find(Boolean) || null;
        }
        if (typeof p === 'object') {
            // Priority 1: regular shift photos (last regular shift photo represents sign-out/after state)
            if (p.laborByShift?.regular && Array.isArray(p.laborByShift.regular)) {
                const regPhotos = p.laborByShift.regular.filter(Boolean);
                if (regPhotos.length > 0) return regPhotos[regPhotos.length - 1];
            }
            // Priority 2: site photos
            if (p.site && Array.isArray(p.site)) {
                const siteP = p.site.filter(Boolean);
                if (siteP.length > 0) return siteP[0];
            }
            // Priority 3: ot shift photos
            for (const shift of ['otEvening', 'otNoon', 'otMorning']) {
                const ot = p.laborByShift?.[shift];
                if (ot) {
                    if (ot.out) return ot.out;
                    if (ot.in) return ot.in;
                }
            }
        }
        return null;
    };


    useEffect(() => {
        if (!isOpen || !workOrder) return;

        const loadAllRevisions = async () => {
            const revisionsMap: Record<string, any[]> = {};
            const selectedMap: Record<string, string> = {};

            try {
                for (const cat of (workOrder.categories || [])) {
                    for (const task of (cat.tasks || [])) {
                        if (!task) continue;
                        const subtaskId = getSubtaskId(task.id);
                        
                        const revisionsSnap = await getDocs(
                            collection(db, 'workOrders', workOrder.id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions')
                        );
                        
                        const revs: any[] = [];
                        for (const revDoc of revisionsSnap.docs) {
                            const revData = revDoc.data();
                            
                            const reportsSnap = await getDocs(
                                collection(db, 'workOrders', workOrder.id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions', revDoc.id, 'dailyReports')
                            );
                            const dailyReports = reportsSnap.docs.map(rd => ({
                                ...rd.data(),
                                id: rd.id
                            })).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                            
                            revs.push({
                                id: revDoc.id,
                                ...revData,
                                dailyReports
                            });
                        }

                        revs.sort((a, b) => b.id.localeCompare(a.id));
                        
                        if (revs.length === 0) {
                            revs.push({
                                id: task.currentRevision || 'rev00',
                                status: 'active',
                                dailyReports: task.history || []
                            });
                        }
                        
                        revisionsMap[task.id] = revs;
                        selectedMap[task.id] = revs[0].id;
                    }
                }
                setTaskRevisions(revisionsMap);
                setSelectedRevisions(selectedMap);
            } catch (err) {
                console.error("Failed to load task revisions:", err);
            }
        };

        loadAllRevisions();
    }, [isOpen, workOrder]);

    if (!isOpen) return null;

    const project = projects.find(p => p.id === workOrder.projectId);

    const allTasks = (workOrder.categories || []).flatMap(cat => cat.tasks || []);
    const clickedTask = selectedTaskId ? allTasks.find(t => t && t.id === selectedTaskId) : null;

    // Calculate Actual End Date dynamically based on history and submission timestamps
    let endDateStr = '-';
    const validTasks = (clickedTask ? [clickedTask] : allTasks).filter(t => {
        if (!t) return false;
        if (clickedTask) return true; // Always show if explicitly clicked
        const isAdminOrFakeReject = t.status === 'Rejected' && 
            (!t.responsibleStaffIds || t.responsibleStaffIds.length === 0);
        return !isAdminOrFakeReject;
    });
    const totalCount = validTasks.length > 0 ? validTasks.length : allTasks.length;
    const completedCount = validTasks.filter(t => t && t.status === 'Completed').length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    if (clickedTask?.status === 'Rejected' || workOrder.status === 'Rejected') {
        endDateStr = 'ปฏิเสธงาน';
    } else if ((clickedTask?.status as string) === 'Cancelled' || workOrder.status === 'Cancelled') {
        endDateStr = 'ยกเลิก';
    } else if (workOrder.status === 'Completed' || percentage === 100) {
        let latestDate = new Date(workOrder.createdAt).getTime();
        if (workOrder.submittedAt) {
            latestDate = new Date(workOrder.submittedAt).getTime();
        }
        // Scan task histories for the last reported progress
        (clickedTask ? [clickedTask] : allTasks).forEach(t => {
            if (t && t.history) {
                t.history.forEach(h => {
                    const d = new Date(h.date).getTime();
                    if (d > latestDate) latestDate = d;
                });
            }
        });
        endDateStr = formatDate(latestDate);
    } else {
        endDateStr = 'ยังไม่จบโครงการ';
    }
    // Helper to get labor photos from structured photos payload
    const getLaborPhotos = (h: any): string[] => {
        if (!h.photos) return [];
        if (Array.isArray(h.photos)) return [];
        const list: string[] = [];
        const lbs = h.photos.laborByShift;
        if (lbs) {
            if (lbs.regular && Array.isArray(lbs.regular)) {
                list.push(...lbs.regular.filter(Boolean));
            }
            ['otMorning', 'otNoon', 'otEvening'].forEach(otKey => {
                if (lbs[otKey]) {
                    if (lbs[otKey].in) list.push(lbs[otKey].in);
                    if (lbs[otKey].out) list.push(lbs[otKey].out);
                }
            });
        }
        return list;
    };

    // Helper: Calculate Time vs SLA
    const getSLAPerformance = (task: MasterTask, revReports: any[] = [], allRevisions?: any[]) => {
        const reportDate = task.slaStartTime ? new Date(task.slaStartTime) : new Date(workOrder.createdAt);

        const sortedRevDates = revReports.map((r: any) => r.date).filter(Boolean).sort();

        const completionDate = task.status === 'Completed' && sortedRevDates.length > 0
            ? new Date(sortedRevDates[sortedRevDates.length - 1])
            : task.status === 'Completed' && task.history && task.history.length > 0
                ? new Date(task.history[task.history.length - 1].date)
                : new Date();

        const slaMap: Record<string, number> = {
            'Immediately': 4,
            '24h': 24,
            '1-3d': 72,
            '3-7d': 168,
            '7-14d': 336,
            '14-30d': 720
        };
        const baselineHours = slaMap[task.slaCategory || ''] || 24;

        let actualHoursUsed: number;
        if (sortedRevDates.length >= 2) {
            const first = new Date(sortedRevDates[0]);
            const last = new Date(sortedRevDates[sortedRevDates.length - 1]);
            actualHoursUsed = Math.max(8, Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60)));
        } else {
            actualHoursUsed = task.actualCompletionTime !== undefined
                ? task.actualCompletionTime
                : Math.max(1, Math.floor((completionDate.getTime() - reportDate.getTime()) / (1000 * 60 * 60)));
        }

        // Helper to get leave hours from time range string
        const getLeaveHours = (timeRange: string): number => {
            if (!timeRange) return 8;
            if (timeRange === '08:00 - 17:00') return 8;
            if (timeRange === '08:00 - 12:00' || timeRange === '13:00 - 17:00') return 4;
            
            try {
                const parts = timeRange.split(' - ');
                if (parts.length !== 2) return 8;
                const [startStr, endStr] = parts;
                const [sh, smStr] = startStr.split(':');
                const [eh, emStr] = endStr.split(':');
                const startMin = parseInt(sh, 10) * 60 + parseInt(smStr || '0', 10);
                const endMin = parseInt(eh, 10) * 60 + parseInt(emStr || '0', 10);
                let diffMin = endMin - startMin;
                
                if (startMin <= 720 && endMin >= 780) {
                    diffMin -= 60;
                }
                const hrs = diffMin / 60;
                return Math.max(0, hrs);
            } catch (e) {
                return 8;
            }
        };

        // Helper to get shift hours from custom time range string
        const getShiftHours = (timeRange: string, defaultHours: number): number => {
            if (!timeRange) return defaultHours;
            try {
                const parts = timeRange.split(' - ');
                if (parts.length !== 2) return defaultHours;
                const [startStr, endStr] = parts;
                const [sh, smStr] = startStr.split(':');
                const [eh, emStr] = endStr.split(':');
                const startMin = parseInt(sh, 10) * 60 + parseInt(smStr || '0', 10);
                const endMin = parseInt(eh, 10) * 60 + parseInt(emStr || '0', 10);
                let diffMin = endMin - startMin;
                
                if (startMin <= 720 && endMin >= 780) {
                    diffMin -= 60;
                }
                const hrs = diffMin / 60;
                return Math.max(0, hrs);
            } catch (e) {
                return defaultHours;
            }
        };

        // Extract labor calculation into reusable helper
        const calcOnSiteFromReports = (reps: any[]): number => {
            let hrs = 0;
            reps.forEach(update => {
                const leaveList = update.leave || [];
                const leaveMap = new Map<string, any>();
                leaveList.forEach((lv: any) => {
                    const wId = lv.workerId || lv.id || lv.staffId || '';
                    if (wId) leaveMap.set(wId, lv);
                });
                (update.labor || []).forEach((l: any) => {
                    const wId = l.workerId || l.staffId || l.contractorId || l.id;
                    const leaveRecord = leaveMap.get(wId);
                    let leaveHours = 0;
                    if (leaveRecord) {
                        const leaveTimeRange = leaveRecord.leaveTimes?.custom || '08:00 - 17:00';
                        leaveHours = getLeaveHours(leaveTimeRange);
                    }
                    if (l.shifts) {
                        let normalHr = 0;
                        if (l.shifts.normal) {
                            const regTime = l.shiftTimes?.day || '08:00 - 17:00';
                            const duration = getShiftHours(regTime, 8);
                            normalHr = Math.max(0, duration - (regTime === '08:00 - 17:00' ? leaveHours : 0));
                        }
                        hrs += (l.amount * normalHr);
                        if (l.shifts.otMorning) hrs += (l.amount * getShiftHours(l.shiftTimes?.otMorning, 2));
                        if (l.shifts.otNoon) hrs += (l.amount * getShiftHours(l.shiftTimes?.otNoon || '12:00 - 13:00', 1));
                        if (l.shifts.otEvening) hrs += (l.amount * getShiftHours(l.shiftTimes?.otEvening, 3));
                    }
                });
            });
            return hrs;
        };

        // On-site hours for this revision (fall back to task.history if no revReports)
        const reportsForCalc = revReports.length > 0 ? revReports : (task.history || []);
        const totalOnSiteHours = calcOnSiteFromReports(reportsForCalc);

        // Cumulative on-site hours across all revisions
        let cumulativeOnSiteHours = totalOnSiteHours;
        if (allRevisions && allRevisions.length > 0) {
            cumulativeOnSiteHours = allRevisions.reduce((sum: number, rev: any) => {
                return sum + calcOnSiteFromReports(rev.dailyReports || []);
            }, 0);
        }

        const isOnTime = actualHoursUsed <= baselineHours;

        return {
            target: baselineHours,
            actual: actualHoursUsed,
            onSite: totalOnSiteHours,
            cumulative: cumulativeOnSiteHours,
            isOnTime,
            color: isOnTime ? '#10b981' : '#f59e0b'
        };
    };

    const renderStatusBadge = () => {
        const targetStatus = clickedTask ? clickedTask.status : workOrder.status;

        if (clickedTask) {
            if (targetStatus === 'Rejected') {
                const foremanId = clickedTask.responsibleStaffIds?.[0];
                return !foremanId ? (
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: '#fef2f2',
                        color: '#ef4444',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        border: '1px solid #fee2e2'
                    }}>
                        ปฏิเสธโดยแอดมิน
                    </span>
                ) : (
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: '#fff1f2',
                        color: '#be123c',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        border: '1px solid #ffe4e6'
                    }}>
                        ส่งคืนแก้ไข (ลูกค้า)
                    </span>
                );
            }
            if (targetStatus === 'Completed' || targetStatus === 'Verified') {
                if (targetStatus === 'Verified') {
                    return (
                        <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            background: '#ecfdf5',
                            color: '#10b981',
                            padding: '4px 12px',
                            borderRadius: '99px',
                            border: '1px solid #d1fae5'
                        }}>
                            สำเร็จสมบูรณ์
                        </span>
                    );
                }
                return (
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: '#fffbeb',
                        color: '#d97706',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        border: '1px solid #fef3c7'
                    }}>
                        รอ Owner ตรวจรับ
                    </span>
                );
            }
            if (targetStatus === 'Evaluating') {
                return (
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: '#f5f3ff',
                        color: '#7c3aed',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        border: '1px solid #ddd6fe'
                    }}>
                        รอมอบหมาย
                    </span>
                );
            }
            if (targetStatus === 'Cancelled') {
                return (
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: '#f1f5f9',
                        color: '#64748b',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        border: '1px solid #e2e8f0'
                    }}>
                        ยกเลิกใบงาน
                    </span>
                );
            }
            if (targetStatus === 'Assigned') {
                return (
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: '#fff7ed',
                        color: '#f97316',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        border: '1px solid #ffedd5'
                    }}>
                        มอบหมายแล้ว
                    </span>
                );
            }
            return (
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    padding: '4px 12px',
                    borderRadius: '99px',
                    border: '1px solid #bfdbfe'
                }}>
                    กำลังดำเนินการ
                </span>
            );
        }

        if (targetStatus === 'Rejected' || workOrder.status === 'Rejected') {
            const overallForemanId = allTasks.find(t => t && t.responsibleStaffIds && t.responsibleStaffIds.length > 0)?.responsibleStaffIds?.[0];
            const foremanId = overallForemanId;

            return !foremanId ? (
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    background: '#fef2f2',
                    color: '#ef4444',
                    padding: '4px 12px',
                    borderRadius: '99px',
                    border: '1px solid #fee2e2'
                }}>
                    ปฏิเสธโดยแอดมิน
                </span>
            ) : (
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    background: '#fff1f2',
                    color: '#be123c',
                    padding: '4px 12px',
                    borderRadius: '99px',
                    border: '1px solid #ffe4e6'
                }}>
                    ส่งคืนแก้ไข (ลูกค้า)
                </span>
            );
        }
        if (targetStatus === 'Completed' || targetStatus === 'Verified' || percentage === 100) {
            if (targetStatus === 'Verified') {
                return (
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: '#ecfdf5',
                        color: '#10b981',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        border: '1px solid #d1fae5'
                    }}>
                        สำเร็จสมบูรณ์
                    </span>
                );
            }
            return (
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    background: '#fffbeb',
                    color: '#d97706',
                    padding: '4px 12px',
                    borderRadius: '99px',
                    border: '1px solid #fef3c7'
                }}>
                    รอ Owner ตรวจรับ
                </span>
            );
        }
        if (targetStatus === 'Evaluating' || workOrder.status === 'Evaluating') {
            return (
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    background: '#f5f3ff',
                    color: '#7c3aed',
                    padding: '4px 12px',
                    borderRadius: '99px',
                    border: '1px solid #ddd6fe'
                }}>
                    รอมอบหมาย
                </span>
            );
        }
        if (targetStatus === 'Cancelled' || workOrder.status === 'Cancelled') {
            return (
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    background: '#f1f5f9',
                    color: '#64748b',
                    padding: '4px 12px',
                    borderRadius: '99px',
                    border: '1px solid #e2e8f0'
                }}>
                    ยกเลิกใบงาน
                </span>
            );
        }
        if (completedCount > 0 && !clickedTask) {
            return (
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    background: '#eff6ff',
                    color: '#6366f1',
                    padding: '4px 12px',
                    borderRadius: '99px',
                    border: '1px solid #dbeafe'
                }}>
                    เสร็จบางส่วน
                </span>
            );
        }
        return (
            <span style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                background: '#eff6ff',
                color: '#1d4ed8',
                padding: '4px 12px',
                borderRadius: '99px',
                border: '1px solid #bfdbfe'
            }}>
                กำลังดำเนินการ
            </span>
        );
    };

    return (
        <div 
            id="print-area-modal-overlay"
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem'
            }}
        >
            <style>{`
                @media print {
                    /* Hide scrollbars, modal backdrops, side elements */
                    html, body {
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 210mm !important;
                        height: auto !important;
                    }
                    /* Ensure parent divs do not render, only show the print-area-modal-overlay */
                    body > div:not(#root) {
                        display: none !important;
                    }
                    #root > div > div:not(#print-area-modal-overlay) {
                        display: none !important;
                    }
                    #print-area-modal-overlay {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        background: #ffffff !important;
                        backdrop-filter: none !important;
                        padding: 0 !important;
                        display: block !important;
                        z-index: 99999 !important;
                        overflow: visible !important;
                    }
                    #print-area-modal-content {
                        width: 100% !important;
                        max-width: 100% !important;
                        max-height: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-section {
                        page-break-inside: avoid !important;
                        margin-bottom: 20px !important;
                    }
                    .print-signatures {
                        display: flex !important;
                        justify-content: space-between !important;
                        margin-top: 50px !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>
            <div 
                id="print-area-modal-content"
                style={{
                    background: '#ffffff', width: '100%', maxWidth: '1000px', maxHeight: '90vh',
                    borderRadius: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: workOrder.status === 'Rejected' ? '#fffafb' : '#f8fafc' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                                {workOrder.status === 'Rejected' ? 'รายละเอียดการปฏิเสธงาน (Rejected Details)' : 'สรุปผลการดำเนินงาน (Work Summary)'}
                            </span>
                            {renderStatusBadge()}
                            {workOrder.status === 'Rejected' && (
                                <span style={{
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    background: '#f8fafc',
                                    color: '#475569',
                                    padding: '4px 12px',
                                    borderRadius: '99px',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    {(() => {
                                        const reporter = staff.find(s => s.id === workOrder.reporterId);
                                        const name = reporter ? reporter.name : workOrder.reporterName;
                                        return `ผู้แจ้งงาน: ${name.startsWith('คุณ') ? name : `คุณ${name}`}`;
                                    })()}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>เลขที่ใบงาน: {workOrder.id} | โครงการ: {project?.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="no-print">
                        <button
                            onClick={() => window.print()}
                            style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '12px',
                                padding: '10px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                color: '#1d4ed8',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.08)'
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = '#1d4ed8';
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.borderColor = '#1d4ed8';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = '#eff6ff';
                                e.currentTarget.style.color = '#1d4ed8';
                                e.currentTarget.style.borderColor = '#bfdbfe';
                            }}
                        >
                            <Printer size={16} /> พิมพ์เอกสารใบส่งมอบงาน
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#000000',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                padding: 0
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = '#000000';
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.borderColor = '#000000';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.color = '#000000';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                    {/* Summary Info Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>ยูนิตและสถานที่</div>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>{workOrder.locationName}</div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>วันที่เริ่ม - วันที่ปิดงาน</div>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>
                                {formatDate(workOrder.createdAt)} - {endDateStr}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={14} /> ผู้แจ้งซ่อม / นิติ
                            </div>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>
                                {workOrder.reporterName.startsWith('คุณ') ? workOrder.reporterName : `คุณ${workOrder.reporterName}`}
                            </div>
                        </div>
                        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            {(clickedTask?.status === 'Rejected' || workOrder.status === 'Rejected') ? (
                                <>
                                    <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <FileText size={14} /> เหตุผลในการปฏิเสธงาน (Reason for Rejection)
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(() => {
                                            const allTasks = (workOrder.categories || []).flatMap(cat => cat.tasks || []).filter(t => !selectedTaskId || t.id === selectedTaskId);
                                            const reasons = Array.from(new Set(allTasks.filter(t => t).map(t => t.rootCause).filter(Boolean)));
                                            
                                            if (reasons.length === 0) {
                                                return <div style={{ fontWeight: 800, color: '#94a3b8', fontSize: '0.9rem' }}>ไม่ได้ระบุเหตุผลในการปฏิเสธ</div>;
                                            }

                                            return reasons.map((reason, idx) => (
                                                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', marginTop: '6px', flexShrink: 0 }}></div>
                                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem', lineHeight: 1.4 }}>{reason}</div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <UserCheck size={14} /> โฟร์แมนผู้รับผิดชอบ
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {(() => {
                                            const allTasks = (workOrder.categories || []).flatMap(cat => cat.tasks || []).filter(t => !selectedTaskId || t.id === selectedTaskId);
                                            
                                            // Count tasks per foreman
                                            const foremanTaskCounts: Record<string, number> = {};
                                            allTasks.forEach(task => {
                                                if (task && task.responsibleStaffIds) {
                                                    task.responsibleStaffIds.forEach(id => {
                                                        foremanTaskCounts[id] = (foremanTaskCounts[id] || 0) + 1;
                                                    });
                                                }
                                            });

                                            const uniqueForemanIds = Object.keys(foremanTaskCounts);

                                            if (uniqueForemanIds.length === 0) {
                                                return <div style={{ fontWeight: 800, color: '#94a3b8', fontSize: '0.9rem' }}>ยังไม่มีผู้รับผิดชอบ</div>;
                                            }

                                            return uniqueForemanIds.map(fid => {
                                                const foreman = staff.find(s => s.id === fid);
                                                const count = foremanTaskCounts[fid];
                                                return (
                                                    <div key={fid} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            {foreman?.profileImage ? (
                                                                <img loading="lazy" src={foreman.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <User size={18} style={{ color: '#6366f1' }} />
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>
                                                                {foreman ? (foreman.name.startsWith('คุณ') ? foreman.name : `คุณ${foreman.name}`) : 'ไม่ได้รับระบุชื่อ'}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>รับผิดชอบ {count} รายการ</div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Context Strip: other contributors */}
                    {currentUserId && (() => {
                        const allTasksWO = (workOrder.categories || []).flatMap(cat => cat.tasks || []);
                        const otherIds = new Set<string>();
                        allTasksWO.forEach(t => {
                            (t.responsibleStaffIds || []).forEach(id => {
                                if (id !== currentUserId) otherIds.add(id);
                            });
                        });
                        if (otherIds.size === 0) return null;
                        const others = Array.from(otherIds)
                            .map(id => staff.find(s => s.id === id || s.employeeId === id))
                            .filter(Boolean) as typeof staff;
                        return (
                            <div className="no-print" style={{ marginBottom: '1.5rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '16px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0369a1' }}>ผู้ร่วมงานใน WO นี้:</span>
                                {others.map(s => (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 900, overflow: 'hidden', flexShrink: 0 }}>
                                            {s.profileImage
                                                ? <img loading="lazy" src={s.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : (s.name || '?').replace('คุณ', '').charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0c4a6e' }}>
                                            {s.name.startsWith('คุณ') ? s.name : `คุณ${s.name}`}
                                        </span>
                                    </div>
                                ))}
                                {others.length === 0 && otherIds.size > 0 && (
                                    <span style={{ fontSize: '0.75rem', color: '#7dd3fc' }}>{otherIds.size} คน</span>
                                )}
                            </div>
                        );
                    })()}

                    {/* Task List Section */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText size={20} style={{ color: '#6366f1' }} />
                            รายละเอียดงานและภาพเปรียบเทียบ (Task Comparison)
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {(workOrder.categories || []).flatMap(cat => (cat.tasks || []).map(t => ({ ...t, categoryName: cat.name }))).filter(task => {
                                if (!task) return false;
                                if (selectedTaskId && task.id !== selectedTaskId) return false;
                                const isAdminOrFakeReject = task.status === 'Rejected' && 
                                    (!task.responsibleStaffIds || task.responsibleStaffIds.length === 0);
                                return !isAdminOrFakeReject;
                            }).map((task, idx) => {
                                const selectedRevId = selectedRevisions[task.id] || task.currentRevision || 'rev00';
                                const selectedRevNum = parseInt(selectedRevId.replace('rev', ''));
                                const currentRevObj = taskRevisions[task.id]?.find(r => r.id === selectedRevId) || { dailyReports: task.history || [] };
                                const reports = currentRevObj?.dailyReports || [];
                                const performance = getSLAPerformance(task as any, reports, taskRevisions[task.id]);

                                const latestRevId = taskRevisions[task.id]?.[0]?.id || task.currentRevision || 'rev00';
                                const isSelectedRevRejected = selectedRevId !== latestRevId && (taskRevisions[task.id]?.length ?? 0) > 1;
                                const revRejectReason = (currentRevObj as any).rejectReason || task.rejectReason;
                                const isCompleted = task.status === 'Completed' || task.dailyProgress === 100;
                                const isUserContributor = currentUserId && (
                                    (task.responsibleStaffIds && task.responsibleStaffIds.includes(currentUserId)) ||
                                    (task.history && task.history.some(h =>
                                        h.labor && h.labor.some(l => l.staffId === currentUserId)
                                    ))
                                );

                                return (
                                    <div key={task.id} style={{ 
                                        border: '1px solid #e2e8f0', 
                                        borderRadius: '24px', 
                                        padding: '24px', 
                                        background: '#fff',
                                        opacity: isCompleted ? 1 : 0.85,
                                        boxShadow: isCompleted ? '0 4px 12px rgba(16, 185, 129, 0.05)' : 'none',
                                        borderColor: isCompleted ? '#d1fae5' : '#e2e8f0'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <div style={{ 
                                                        fontSize: '1rem', 
                                                        fontWeight: 800, 
                                                        color: isCompleted ? '#065f46' : '#1e293b',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                                                        {isCompleted ? (
                                                            <CheckCircle size={18} style={{ color: '#10b981' }} />
                                                        ) : isSelectedRevRejected ? (
                                                            <RotateCcw size={18} style={{ color: '#be123c' }} />
                                                        ) : task.status === 'Rejected' ? (
                                                            <RotateCcw size={18} style={{ color: '#be123c' }} />
                                                        ) : task.status === 'In Progress' ? (
                                                            <Clock size={18} style={{ color: '#3b82f6' }} />
                                                        ) : task.status === 'Assigned' ? (
                                                            <Clock size={18} style={{ color: '#f97316' }} />
                                                        ) : (
                                                            <Clock size={18} style={{ color: '#94a3b8' }} />
                                                        )}
                                                        {idx + 1}. {task.name}
                                                    </div>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 900,
                                                        background: '#f1f5f9',
                                                        color: '#475569',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #e2e8f0',
                                                        display: 'inline-flex',
                                                        alignItems: 'center'
                                                    }}>
                                                        REV. {selectedRevNum}
                                                    </span>
                                                    <div style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 800,
                                                        padding: '4px 10px',
                                                        borderRadius: '8px',
                                                        background: isCompleted
                                                            ? '#ecfdf5'
                                                            : isSelectedRevRejected
                                                                ? '#fff1f2'
                                                                : task.status === 'Rejected'
                                                                ? '#fff1f2'
                                                                : task.status === 'In Progress'
                                                                    ? '#eff6ff'
                                                                    : task.status === 'Assigned'
                                                                        ? '#fff7ed'
                                                                        : '#f8fafc',
                                                        color: isCompleted
                                                            ? '#10b981'
                                                            : isSelectedRevRejected
                                                                ? '#be123c'
                                                                : task.status === 'Rejected'
                                                                ? '#be123c'
                                                                : task.status === 'In Progress'
                                                                    ? '#3b82f6'
                                                                    : task.status === 'Assigned'
                                                                        ? '#f97316'
                                                                        : '#64748b',
                                                        border: `1px solid ${
                                                            isCompleted
                                                                ? '#d1fae5'
                                                                : isSelectedRevRejected
                                                                    ? '#ffe4e6'
                                                                    : task.status === 'Rejected'
                                                                    ? '#ffe4e6'
                                                                    : task.status === 'In Progress'
                                                                        ? '#dbeafe'
                                                                        : task.status === 'Assigned'
                                                                            ? '#ffedd5'
                                                                            : '#e2e8f0'
                                                        }`
                                                    }}>
                                                        {isCompleted
                                                            ? 'สำเร็จ'
                                                            : isSelectedRevRejected
                                                                ? 'ไม่ผ่าน'
                                                                : task.status === 'Rejected'
                                                                ? 'ส่งคืนแก้ไข (ลูกค้า)'
                                                                : task.status === 'In Progress'
                                                                    ? 'กำลังดำเนินการ'
                                                                    : task.status === 'Assigned'
                                                                        ? 'มอบหมายแล้ว'
                                                                        : 'รอมอบหมาย'}
                                                    </div>
                                                    {task.responsibleStaffIds && task.responsibleStaffIds.length > 0 && (
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 900,
                                                            background: isUserContributor ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : '#f8fafc',
                                                            color: isUserContributor ? '#2563eb' : '#64748b',
                                                            padding: '4px 10px',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${isUserContributor ? '#bfdbfe' : '#e2e8f0'}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <UserCheck size={12} /> ผู้ดำเนินการ: {
                                                                task.responsibleStaffIds.map(fid => {
                                                                    const f = staff.find(s => s.id === fid);
                                                                    const name = f ? f.name : 'ไม่ระบุ';
                                                                    return name.startsWith('คุณ') ? name : `คุณ${name}`;
                                                                }).join(', ')
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'flex', gap: '12px' }}>
                                                    <span><strong>หมวดงาน:</strong> {(task as any).categoryName}</span>
                                                    <span>ประเภท SLA: {task.slaCategory || 'ทั่วไป'}</span>
                                                </div>
                                                {isSelectedRevRejected && revRejectReason && (
                                                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#fff1f2', border: '1px solid #ffe4e6', borderRadius: '10px', padding: '8px 12px' }}>
                                                        <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>⛔</span>
                                                        <div style={{ fontSize: '0.8rem', color: '#9f1239', fontWeight: 700, lineHeight: 1.5 }}>
                                                            <span style={{ color: '#be123c', fontWeight: 900 }}>เหตุผลที่ไม่ผ่าน: </span>
                                                            {revRejectReason}
                                                            {task.contactName && (
                                                                <span style={{ color: '#64748b', fontWeight: 600, marginLeft: '8px' }}>
                                                                    — ลูกค้า: {task.contactName}{task.contactPhone ? ` (${task.contactPhone})` : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {workOrder.status !== 'Rejected' && (
                                                <div style={{ textAlign: 'right', minWidth: '180px' }}>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>SLA Performance</div>
                                                    {/* Verdict badge */}
                                                    <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                        padding: '5px 12px', borderRadius: '10px', marginBottom: '8px',
                                                        background: !isCompleted ? '#eff6ff' : performance.isOnTime ? '#ecfdf5' : '#fff7ed',
                                                        border: `1px solid ${!isCompleted ? '#bfdbfe' : performance.isOnTime ? '#6ee7b7' : '#fed7aa'}`,
                                                    }}>
                                                        <span style={{ fontSize: '0.85rem' }}>{!isCompleted ? '🔄' : performance.isOnTime ? '✅' : '⚠️'}</span>
                                                        <span style={{ fontSize: '0.78rem', fontWeight: 900, color: !isCompleted ? '#1d4ed8' : performance.isOnTime ? '#065f46' : '#9a3412' }}>
                                                            {!isCompleted
                                                                ? 'อยู่ระหว่างดำเนินการ'
                                                                : performance.isOnTime
                                                                    ? 'เสร็จทันเวลา'
                                                                    : `เกินกำหนด ${performance.actual - performance.target} ชม.`}
                                                        </span>
                                                    </div>
                                                    {/* 2 supporting numbers */}
                                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>เป้าหมาย SLA</div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{performance.target} ชม.</div>
                                                        </div>
                                                        <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                            <div style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: 800 }}>แรงงานรวมทุก rev.</div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#4f46e5' }}>{performance.cumulative} ชม.</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Rejection Timeline — show when there are rejected revisions */}
                                        {taskRevisions[task.id] && taskRevisions[task.id].length > 1 && (() => {
                                            const slaMapRT: Record<string, number> = { 'Immediately': 4, '24h': 24, '1-3d': 72, '3-7d': 168, '7-14d': 336, '14-30d': 720 };
                                            const baseHrs = slaMapRT[task.slaCategory || ''] || 24;
                                            const origStart = task.slaStartTime ? new Date(task.slaStartTime) : new Date(workOrder.createdAt);
                                            const origDeadline = new Date(origStart.getTime() + baseHrs * 60 * 60 * 1000);
                                            const revsSorted = [...taskRevisions[task.id]].sort((a, b) => a.id.localeCompare(b.id));
                                            const rejectedRevs = revsSorted.filter(r => r.status === 'rejected' || r.status === 'Rejected');
                                            if (rejectedRevs.length === 0) return null;
                                            return (
                                                <div className="no-print" style={{ marginBottom: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '14px 18px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                        <RotateCcw size={15} color="#d97706" />
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#92400e' }}>ประวัติการส่งคืน ({rejectedRevs.length} ครั้ง)</span>
                                                        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, color: '#b45309' }}>เดดไลน์เดิม: {formatDate(origDeadline.toISOString())}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {rejectedRevs.map((rev) => {
                                                            const revNum = parseInt(rev.id.replace('rev', ''));
                                                            const revDates = (rev.dailyReports || []).map((r: any) => r.date).filter(Boolean).sort();
                                                            const rawStart = rev.createdAt;
                                                            const rawEnd = rev.rejectedAt;
                                                            const toIso = (v: any) => typeof v === 'string' ? v : v?.toDate?.()?.toISOString?.() || '';
                                                            const startStr = rawStart ? formatDate(toIso(rawStart)) : (revDates[0] ? formatDate(revDates[0]) : '-');
                                                            const endStr = rawEnd ? formatDate(toIso(rawEnd)) : (revDates[revDates.length - 1] ? formatDate(revDates[revDates.length - 1]) : '-');
                                                            const endDate = rawEnd ? new Date(toIso(rawEnd)) : null;
                                                            const isOver = endDate ? endDate > origDeadline : false;
                                                            const overDays = isOver && endDate ? Math.ceil((endDate.getTime() - origDeadline.getTime()) / 86400000) : 0;
                                                            const reason = rev.rejectReason || null;
                                                            const contact = rev.contactName || null;
                                                            const phone = rev.contactPhone || null;
                                                            return (
                                                                <div key={rev.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #fde68a' }}>
                                                                    <div style={{ minWidth: '48px', textAlign: 'center', background: '#fff7ed', borderRadius: '8px', padding: '4px 6px', border: '1px solid #fed7aa' }}>
                                                                        <div style={{ fontSize: '0.6rem', color: '#9a3412', fontWeight: 800 }}>REV.</div>
                                                                        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#c2410c' }}>{revNum}</div>
                                                                    </div>
                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                        <div style={{ fontSize: '0.78rem', color: '#78350f', fontWeight: 700, marginBottom: '3px' }}>
                                                                            {startStr} → ส่งคืน {endStr}
                                                                            {isOver ? (
                                                                                <span style={{ marginLeft: '8px', color: '#ef4444', fontWeight: 900 }}>เกินเดดไลน์ {overDays} วัน</span>
                                                                            ) : endDate ? (
                                                                                <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 800 }}>ยังไม่เกินเดดไลน์</span>
                                                                            ) : null}
                                                                        </div>
                                                                        {reason && <div style={{ fontSize: '0.75rem', color: '#92400e' }}>เหตุผล: <span style={{ fontWeight: 800 }}>{reason}</span></div>}
                                                                        {contact && <div style={{ fontSize: '0.72rem', color: '#b45309' }}>ผู้แจ้ง: {contact}{phone ? ` · ${phone}` : ''}</div>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Revision Selector Row */}
                                        {taskRevisions[task.id] && taskRevisions[task.id].length > 1 && (
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b' }}>รอบการแก้ไข:</span>
                                                {taskRevisions[task.id].map((rev, rIdx) => {
                                                    const isSelected = selectedRevId === rev.id;
                                                    const revNum = parseInt(rev.id.replace('rev', ''));
                                                    const isRejected = rev.status === 'rejected' || rev.status === 'Rejected';
                                                    const label = isRejected ? ' (ไม่ผ่าน)' : rIdx === 0 ? ' (ล่าสุด)' : '';
                                                    return (
                                                        <button
                                                            key={rev.id}
                                                            onClick={() => setSelectedRevisions(prev => ({ ...prev, [task.id]: rev.id }))}
                                                            style={{
                                                                padding: '6px 14px',
                                                                borderRadius: '10px',
                                                                border: isSelected ? '1.5px solid #6366f1' : '1px solid #cbd5e1',
                                                                background: isSelected ? '#eff6ff' : '#fff',
                                                                color: isSelected ? '#2563eb' : isRejected ? '#be123c' : '#64748b',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                boxShadow: isSelected ? '0 2px 4px rgba(99, 102, 241, 0.1)' : 'none'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isSelected) {
                                                                    e.currentTarget.style.borderColor = '#94a3b8';
                                                                    e.currentTarget.style.background = '#f8fafc';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isSelected) {
                                                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                                                    e.currentTarget.style.background = '#fff';
                                                                }
                                                            }}
                                                        >
                                                            REV. {revNum}{label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Photos Side-by-Side */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(15, 23, 42, 0.8)', color: 'white', padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, zIndex: 1, backdropFilter: 'blur(4px)' }}>BEFORE</div>
                                                <div style={{ width: '100%', aspectRatio: '16/10', borderRadius: '16px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {task.beforePhotoUrl ? (
                                                        <img loading="lazy" src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Before" />
                                                    ) : (
                                                        <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                                                            <Camera size={32} style={{ marginBottom: '8px' }} />
                                                            <div style={{ fontSize: '0.8rem' }}>ไม่มีรูปภาพแจ้งซ่อม</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ position: 'absolute', top: '12px', left: '12px', background: (workOrder.status === 'Rejected' || currentRevObj.status === 'rejected') ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)', color: 'white', padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, zIndex: 1, backdropFilter: 'blur(4px)' }}>
                                                    {(workOrder.status === 'Rejected' || currentRevObj.status === 'rejected') ? 'REJECTED' : 'AFTER'}
                                                </div>
                                                <div style={{ width: '100%', aspectRatio: '16/10', borderRadius: '16px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {(() => {
                                                        const completionReport = reports.find((h: any) => h.progress === 100);
                                                        let completionPhoto = completionReport ? getPhotoFromReport(completionReport) : null;
                                                        
                                                        if (!completionPhoto && reports.length > 0) {
                                                            completionPhoto = getPhotoFromReport(reports[0]);
                                                        }
                                                        
                                                        const displayPhoto = completionPhoto || (selectedRevId === (task.currentRevision || 'rev00') ? task.afterPhotoUrl : null);

                                                        if (displayPhoto) {
                                                            return <img loading="lazy" src={displayPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="After" />;
                                                        }

                                                        return (
                                                            <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '20px' }}>
                                                                <Camera size={32} style={{ marginBottom: '8px' }} />
                                                                <div style={{ fontSize: '0.8rem' }}>{(workOrder.status === 'Rejected' || currentRevObj.status === 'rejected') ? 'ระงับการดำเนินการ' : 'ไม่มีรูปภาพเมื่อครบ 100%'}</div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Work History Timeline (Moved below photos and wrapped) */}
                                        {reports && reports.length > 0 && (
                                            <details style={{ marginTop: '1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                                                <summary style={{ padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', listStyle: 'none', background: '#fff' }}>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#475569', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <Activity size={18} color="#6366f1" /> บันทึกการปฏิบัติงาน ({reports.length} ครั้ง)
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1', fontSize: '0.85rem', fontWeight: 800 }}>
                                                        ดูประวัติการเข้างาน <ChevronDown size={14} />
                                                    </div>
                                                </summary>
                                                
                                                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    {reports.map((h: any) => {
                                                        const totalManpower = (h.labor || []).reduce((acc: number, l: any) => acc + (l.amount || 0), 0);
                                                        return (
                                                            <details key={h.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
                                                                <summary style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', listStyle: 'none' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap' }}>
                                                                                {formatDate(h.date)}
                                                                        </div>
                                                                        {(() => {
                                                                            const firstLabor = h.labor?.[0];
                                                                            const shiftStr = firstLabor?.shiftTimes?.day as string | undefined;
                                                                            if (!shiftStr) return null;
                                                                            const parts = shiftStr.split(' - ');
                                                                            if (parts.length !== 2) return null;
                                                                            const [startStr, endStr] = parts;
                                                                            const startMin = parseInt(startStr.split(':')[0], 10) * 60 + parseInt(startStr.split(':')[1] || '0', 10);
                                                                            const endMin = parseInt(endStr.split(':')[0], 10) * 60 + parseInt(endStr.split(':')[1] || '0', 10);
                                                                            let diffMin = endMin - startMin;
                                                                            const otNoon = firstLabor?.shifts?.otNoon;
                                                                            if (!otNoon && startMin <= 720 && endMin >= 780) diffMin -= 60;
                                                                            const hrs = Math.round(diffMin / 60 * 10) / 10;
                                                                            return (
                                                                                <div style={{ fontSize: '0.75rem', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                                                    ⏱ {shiftStr}{hrs > 0 ? ` (${hrs} ชม.)` : ''}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                        <div style={{ fontSize: '0.75rem', color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                                            Progress: {h.progress}%
                                                                        </div>
                                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                                            คนงาน: {totalManpower} คน
                                                                        </div>
                                                                        {h.note && (
                                                                            <div style={{ fontSize: '0.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginLeft: '4px' }}>
                                                                                - {h.note}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <ChevronDown size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                                                                </summary>
                                                                <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
                                                                    {h.note && (
                                                                        <div style={{ marginBottom: '12px' }}>
                                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: h.type === 'Problem' ? '#ef4444' : '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>หมายเหตุ{h.type === 'Problem' ? ' (รายงานปัญหา)' : ''}:</div>
                                                                            <div style={{ 
                                                                                fontSize: '0.85rem', 
                                                                                color: h.type === 'Problem' ? '#ef4444' : '#334155', 
                                                                                fontWeight: h.type === 'Problem' ? 800 : 500, 
                                                                                background: h.type === 'Problem' ? '#fef2f2' : '#fff', 
                                                                                padding: '10px', 
                                                                                borderRadius: '8px', 
                                                                                border: `1px solid ${h.type === 'Problem' ? '#fecaca' : '#e2e8f0'}` 
                                                                            }}>{h.note}</div>
                                                                        </div>
                                                                    )}
                                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>รายละเอียดคนงาน:</div>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                                        {(h.labor || []).map((l: any, lIdx: number) => (
                                                                            <div key={lIdx} style={{ fontSize: '0.8rem', color: '#475569', background: '#fff', border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                                                                {l.staffName || l.affiliation} ({l.amount} คน)
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {/* Daily Progress Photos */}
                                                                    {(() => {
                                                                        const progPhotos = getProgressPhotos(h);
                                                                        if (progPhotos.length === 0) return null;
                                                                        return (
                                                                            <div style={{ marginTop: '16px' }}>
                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>รูปภาพอัปเดตหน้างาน: {h.type === 'Problem' ? '(รูปประกอบปัญหา)' : ''}</div>
                                                                                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                                                                                    {progPhotos.map((photo: string, pIdx: number) => (
                                                                                        <div key={pIdx} style={{ width: '120px', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0, background: '#f8fafc' }}>
                                                                                            <img 
                                                                                                src={photo} 
                                                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                                                                                                alt={`Progress ${pIdx + 1}`}
                                                                                                onClick={() => window.open(photo, '_blank')}
                                                                                            />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    {/* Labor Proof Photos (NEW) */}
                                                                    {(() => {
                                                                        const lPhotos = ((h as any).laborPhotos && (h as any).laborPhotos.length > 0)
                                                                            ? (h as any).laborPhotos
                                                                            : getLaborPhotos(h);
                                                                        if (!lPhotos || lPhotos.length === 0) return null;
                                                                        return (
                                                                            <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <Camera size={14} /> รูปภาพหลักฐานแรงงาน / ทีมช่าง (Labor Proof):
                                                                                </div>
                                                                                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                                                                                    {lPhotos.map((photo: string, pIdx: number) => (
                                                                                        <div key={pIdx} style={{ width: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                                                                                            <img 
                                                                                                src={photo} 
                                                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                                                                                                alt={`Labor Proof ${pIdx + 1}`}
                                                                                                onClick={() => window.open(photo, '_blank')}
                                                                                            />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </details>
                                                        );
                                                    })}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* Handover & Quality Certificate Section (Print and View) */}
                <div style={{ 
                    marginTop: '3rem', 
                    padding: '24px', 
                    background: '#fafbfc', 
                    borderRadius: '20px', 
                    border: '1px solid #e2e8f0',
                    pageBreakInside: 'avoid',
                    margin: '0 0 1.5rem 0'
                }} className="print-section">
                    <h4 style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle size={18} style={{ color: '#10b981' }} /> 
                        การตรวจรับและส่งมอบงานคุณภาพ (Official Handover & Inspection)
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                        {/* Left Side: Rating & Evaluation Checklist */}
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>คะแนนประเมินโดยลูกค้า</div>
                            {workOrder.status === 'Verified' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
                                            {((workOrder as any).overallSatisfaction || '5.0')}
                                        </span>
                                        <div style={{ display: 'flex', color: '#f59e0b' }}>
                                            <Star size={20} fill="#f59e0b" style={{ stroke: 'none' }} />
                                        </div>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>(ผ่านการตรวจรับงานสำเร็จสมบูรณ์)</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>ยังไม่ได้รับคะแนนประเมิน</div>
                            )}
                        </div>
                        
                        {/* Right Side: Notes */}
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>ความคิดเห็นเพิ่มเติมจากลูกค้า</div>
                            <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 600, background: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '60px' }}>
                                {(workOrder as any).notes || 'ไม่มีข้อคิดเห็นเพิ่มเติม'}
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginTop: '2.5rem', 
                        paddingTop: '2rem', 
                        borderTop: '1px dashed #cbd5e1' 
                    }} className="print-signatures">
                        <div style={{ textAlign: 'center', width: '200px' }}>
                            <div style={{ height: '40px', borderBottom: '1px solid #475569', marginBottom: '8px' }}></div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>ลงชื่อ: {workOrder.reporterName ? (workOrder.reporterName.startsWith('คุณ') ? workOrder.reporterName : `คุณ${workOrder.reporterName}`) : 'ผู้แจ้งซ่อม'}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>นิติบุคคล / ผู้แจ้งซ่อม</div>
                        </div>
                        <div style={{ textAlign: 'center', width: '200px' }}>
                            <div style={{ height: '40px', borderBottom: '1px solid #475569', marginBottom: '8px' }}></div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>
                                {(() => {
                                    const foremanTask = (clickedTask && clickedTask.responsibleStaffIds && clickedTask.responsibleStaffIds.length > 0) ? clickedTask : allTasks.find(t => t && t.responsibleStaffIds && t.responsibleStaffIds.length > 0);
                                    const fId = foremanTask?.responsibleStaffIds?.[0];
                                    const foreman = staff.find(s => s.id === fId);
                                    return `ลงชื่อ: ${foreman ? (foreman.name.startsWith('คุณ') ? foreman.name : `คุณ${foreman.name}`) : 'โฟร์แมนผู้ส่งมอบ'}`;
                                })()}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>โฟร์แมนผู้ควบคุมงาน</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer / Actions */}
                <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', background: '#fcfcfd', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button style={{
                            padding: '12px 24px', background: '#ffffff', border: '1px solid #e2e8f0',
                            borderRadius: '14px', fontSize: '0.9rem', fontWeight: 800, color: '#475569',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                        }}>
                            <Download size={18} /> Export PDF
                        </button>
                        <button style={{
                            padding: '12px 24px', background: '#ffffff', border: '1px solid #e2e8f0',
                            borderRadius: '14px', fontSize: '0.9rem', fontWeight: 800, color: '#475569',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                        }}>
                            <Download size={18} /> Export Excel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HistoryDetailModal;
