import { FileText, Download, Camera, User, UserCheck, CheckCircle, Clock, Activity, ChevronDown } from 'lucide-react';
import { WorkOrder, MasterTask, Project, Staff, Contractor } from '../types';

interface HistoryDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    workOrder: WorkOrder;
    projects: Project[];
    staff: Staff[];
    contractors: Contractor[]; // Leaving for future use in team list if needed, but for now we'll mark as ignored if unused
    currentUserId?: string;
}

const HistoryDetailModal = ({ isOpen, onClose, workOrder, projects, staff, currentUserId }: HistoryDetailModalProps) => {
    if (!isOpen) return null;

    const project = projects.find(p => p.id === workOrder.projectId);

    // Calculate Actual End Date dynamically based on history and submission timestamps
    let endDateStr = '-';
    const allTasks = (workOrder.categories || []).flatMap(cat => cat.tasks || []);
    const validTasks = allTasks.filter(t => t && t.status !== 'Rejected');
    const totalCount = validTasks.length > 0 ? validTasks.length : allTasks.length;
    const completedCount = validTasks.filter(t => t && t.status === 'Completed').length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    if (workOrder.status === 'Completed' || percentage === 100) {
        let latestDate = new Date(workOrder.createdAt).getTime();
        if (workOrder.submittedAt) {
            latestDate = new Date(workOrder.submittedAt).getTime();
        }
        // Scan task histories for the last reported progress
        allTasks.forEach(t => {
            if (t && t.history) {
                t.history.forEach(h => {
                    const d = new Date(h.date).getTime();
                    if (d > latestDate) latestDate = d;
                });
            }
        });
        endDateStr = new Date(latestDate).toLocaleDateString('th-TH');
    } else if (workOrder.status === 'Rejected' || workOrder.status === 'Cancelled') {
        endDateStr = 'ถูกยกเลิก';
    } else {
        endDateStr = 'ยังไม่จบโครงการ';
    }


    // Helper: Calculate Time vs SLA
    const getSLAPerformance = (task: MasterTask) => {
        // ✅ นำวันนัดดำเนินการ (slaStartTime) มาเป็นจุดเริ่มต้นนับเวลา ถ้าไม่มีให้ใช้จุดที่สร้างใบงาน
        const reportDate = task.slaStartTime ? new Date(task.slaStartTime) : new Date(workOrder.createdAt);

        const completionDate = task.status === 'Completed' && task.history && task.history.length > 0
            ? new Date(task.history[task.history.length - 1].date)
            : new Date();

        // ✅ ตาราง SLA ที่ถูกต้องสอดคล้องกับ Dashboard
        const slaMap: Record<string, number> = {
            'Immediately': 4,
            '24h': 24,
            '1-3d': 72,
            '3-7d': 168,
            '7-14d': 336,
            '14-30d': 720
        };
        const baselineHours = slaMap[task.slaCategory || ''] || 24;

        const actualHoursUsed = task.actualCompletionTime !== undefined
            ? task.actualCompletionTime
            : Math.max(1, Math.floor((completionDate.getTime() - reportDate.getTime()) / (1000 * 60 * 60)));

        // Calculate On-Site Time (derived from history labor logs)
        let totalOnSiteHours = 0;
        if (task.history) {
            task.history.forEach(update => {
                (update.labor || []).forEach((l: any) => {
                    if (l.shifts) {
                        if (l.shifts.normal) totalOnSiteHours += (l.amount * 8); // Normal shift ~ 8h
                        if (l.shifts.otMorning) totalOnSiteHours += (l.amount * 2); // OT Morning ~ 2h
                        if (l.shifts.otNoon) totalOnSiteHours += (l.amount * 1); // OT Noon ~ 1h
                        if (l.shifts.otEvening) totalOnSiteHours += (l.amount * 3); // OT Evening ~ 3h
                    }
                });
            });
        }

        const isOnTime = actualHoursUsed <= baselineHours;

        return {
            target: baselineHours,
            actual: actualHoursUsed,
            onSite: totalOnSiteHours,
            isOnTime,
            color: isOnTime ? '#10b981' : '#f59e0b'
        };
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem'
        }}>
            <div style={{
                background: '#ffffff', width: '100%', maxWidth: '1000px', maxHeight: '90vh',
                borderRadius: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: workOrder.status === 'Rejected' ? '#fffafb' : '#f8fafc' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                                {workOrder.status === 'Rejected' ? 'รายละเอียดการปฏิเสธงาน (Rejected Details)' : 'สรุปผลการดำเนินงาน (Work Summary)'}
                            </span>
                            <span style={{
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                background: workOrder.status === 'Rejected' ? '#fef2f2' : '#ecfdf5',
                                color: workOrder.status === 'Rejected' ? '#ef4444' : '#10b981',
                                padding: '4px 12px',
                                borderRadius: '99px',
                                border: `1px solid ${workOrder.status === 'Rejected' ? '#fee2e2' : '#d1fae5'}`
                            }}>
                                {workOrder.status === 'Rejected' ? 'รายการถูกปฏิเสธ' : 'ปิดงานสำเร็จสมบูรณ์'}
                            </span>
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
                                {new Date(workOrder.createdAt).toLocaleDateString('th-TH')} - {endDateStr}
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
                            {workOrder.status === 'Rejected' ? (
                                <>
                                    <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <FileText size={14} /> เหตุผลในการปฏิเสธงาน (Reason for Rejection)
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(() => {
                                            const allTasks = (workOrder.categories || []).flatMap(cat => cat.tasks || []);
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
                                            const allTasks = (workOrder.categories || []).flatMap(cat => cat.tasks || []);
                                            
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

                    {/* Task List Section */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText size={20} style={{ color: '#6366f1' }} />
                            รายละเอียดงานและภาพเปรียบเทียบ (Task Comparison)
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {(workOrder.categories || []).flatMap(cat => (cat.tasks || []).map(t => ({ ...t, categoryName: cat.name }))).filter(task => task && task.status !== 'Rejected').map((task, idx) => {
                                const performance = getSLAPerformance(task as any);
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                                        ) : (
                                                            <Clock size={18} style={{ color: '#6366f1' }} />
                                                        )}
                                                        {idx + 1}. {task.name}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 800,
                                                        padding: '4px 10px',
                                                        borderRadius: '8px',
                                                        background: isCompleted ? '#ecfdf5' : '#eff6ff',
                                                        color: isCompleted ? '#10b981' : '#6366f1',
                                                        border: `1px solid ${isCompleted ? '#d1fae5' : '#dbeafe'}`
                                                    }}>
                                                        {isCompleted ? 'สำเร็จ' : 'กำลังดำเนินการ'}
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
                                            </div>
                                            {workOrder.status !== 'Rejected' && (
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>SLA Performance</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>เป้าหมาย</div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{performance.target} ชม.</div>
                                                        </div>
                                                        <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }}></div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>เวลาทั้งหมด</div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: performance.color }}>{performance.actual} ชม.</div>
                                                        </div>
                                                        <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }}></div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                            <div style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 800 }}>ลงปฏิบัติงานจริง</div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#4f46e5' }}>{performance.onSite} ชม.</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>


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
                                                <div style={{ position: 'absolute', top: '12px', left: '12px', background: workOrder.status === 'Rejected' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)', color: 'white', padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, zIndex: 1, backdropFilter: 'blur(4px)' }}>
                                                    {workOrder.status === 'Rejected' ? 'REJECTED' : 'AFTER'}
                                                </div>
                                                <div style={{ width: '100%', aspectRatio: '16/10', borderRadius: '16px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {(() => {
                                                        // 1. Find the report where progress reached 100%
                                                        const completionReport = (task.history || []).find(h => h.progress === 100);
                                                        const completionPhoto = completionReport && (completionReport as any).photos && (completionReport as any).photos.length > 0
                                                            ? (completionReport as any).photos[0]
                                                            : null;
                                                        
                                                        // 2. Final URL to display (Priority: 100% Photo > official afterPhotoUrl)
                                                        const displayPhoto = completionPhoto || task.afterPhotoUrl;

                                                        if (displayPhoto) {
                                                            return <img loading="lazy" src={displayPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="After" />;
                                                        }

                                                        return (
                                                            <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '20px' }}>
                                                                <Camera size={32} style={{ marginBottom: '8px' }} />
                                                                <div style={{ fontSize: '0.8rem' }}>{workOrder.status === 'Rejected' ? 'ระงับการดำเนินการ' : 'ไม่มีรูปภาพเมื่อครบ 100%'}</div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Work History Timeline (Moved below photos and wrapped) */}
                                        {task.history && task.history.length > 0 && (
                                            <details style={{ marginTop: '1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                                                <summary style={{ padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', listStyle: 'none', background: '#fff' }}>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#475569', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <Activity size={18} color="#6366f1" /> บันทึกการปฏิบัติงาน ({task.history.length} ครั้ง)
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1', fontSize: '0.85rem', fontWeight: 800 }}>
                                                        ดูประวัติการเข้างาน <ChevronDown size={14} />
                                                    </div>
                                                </summary>
                                                
                                                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    {task.history.map((h) => {
                                                        const totalManpower = (h.labor || []).reduce((acc: number, l: any) => acc + (l.amount || 0), 0);
                                                        return (
                                                            <details key={h.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
                                                                <summary style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', listStyle: 'none' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap' }}>
                                                                            {new Date(h.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} {new Date(h.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                                        </div>
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
                                                                    {(h as any).photos && (h as any).photos.length > 0 && (
                                                                        <div style={{ marginTop: '16px' }}>
                                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>รูปภาพอัปเดตหน้างาน: {h.type === 'Problem' ? '(รูปประกอบปัญหา)' : ''}</div>
                                                                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                                                                                {(h as any).photos.map((photo: string, pIdx: number) => (
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
                                                                    )}

                                                                    {/* Labor Proof Photos (NEW) */}
                                                                    {(h as any).laborPhotos && (h as any).laborPhotos.length > 0 && (
                                                                        <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                <Camera size={14} /> รูปภาพหลักฐานแรงงาน / ทีมช่าง (Labor Proof):
                                                                            </div>
                                                                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                                                                                {(h as any).laborPhotos.map((photo: string, pIdx: number) => (
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
                                                                    )}
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
