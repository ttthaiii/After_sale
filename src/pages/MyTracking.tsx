import { useState } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import { Clock, CheckCircle2, XCircle, UserCheck, Package, Search, Edit, Trash2, User, FileText, X } from 'lucide-react';
import { WorkOrder } from '../types';
import ForemanReportModal from '../components/ForemanReportModal';
import HistoryDetailModal from '../components/HistoryDetailModal';

const MyTracking = () => {
    const { user } = useAuth();
    const { workOrders, projects, staff, contractors, deleteWorkOrder, archiveWorkOrder } = useWorkOrders();
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'Active' | 'History'>('Active');
    const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<WorkOrder | null>(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    const handleEdit = (wo: WorkOrder) => {
        setSelectedOrder(wo);
        setIsEditModalOpen(true);
    };

    const handleArchive = async (id: string) => {
        if (window.confirm('คุณต้องการลบรายการนี้ออกจากหน้าติดตามสถานะและย้ายไปที่ประวัติงานใช่หรือไม่?')) {
            try {
                await archiveWorkOrder(id);
            } catch (error) {
                console.error('Error archiving work order:', error);
            }
        }
    };

    const handleCancel = async (id: string) => {
        if (window.confirm('คุณต้องการยกเลิกคำขอนี้ใช่หรือไม่? (Are you sure you want to cancel this request?)')) {
            try {
                await deleteWorkOrder(id);
            } catch (error) {
                console.error('Error cancelling work order:', error);
                alert('เกิดข้อผิดพลาดในการยกเลิก (Error cancelling request)');
            }
        }
    };

    // New Filter Logic
    const filteredOrders = workOrders
        .filter(wo => {
            const allTasks = wo.categories.flatMap(c => c.tasks);
            const matchesUser = (id: string) => id === user?.id || (user?.employeeId && id === user.employeeId);

            const isReporter = matchesUser(wo.reporterId || '');
            const isContributor = allTasks.some(t => t.responsibleStaffIds?.some(id => matchesUser(id)));
            const matchesProject = selectedProjectId ? wo.projectId === selectedProjectId : true;

            if (!matchesProject) return false;

            const isCompleted = wo.status === 'Completed' || (allTasks.length > 0 && allTasks.every(t => t.status === 'Rejected' || (t.dailyProgress || 0) === 100));
            const isArchived = wo.isArchived === true;
            const isInHistory = isCompleted || isArchived;

            if (activeTab === 'History') {
                // History: Show if I reported it OR if I contributed to it, AND it's finished or archived
                return isInHistory && (isReporter || isContributor);
            } else {
                // Active Tab: Only Evaluating and Rejected reported by me, OR my active assigned tasks
                // Note: Rejected jobs stay here until archived by the foreman.
                const isMyActiveRequest = isReporter && !isInHistory && (wo.status === 'Evaluating' || wo.status === 'Rejected');
                return isMyActiveRequest;
            }
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'Evaluating': return { label: 'รอประเมิน', color: '#6366f1', icon: <Package size={16} /> };
            case 'Approved': return { label: 'อนุมัติแล้ว', color: '#10b981', icon: <CheckCircle2 size={16} /> };
            case 'Partially Approved': return { label: 'อนุมัติบางส่วน', color: '#f59e0b', icon: <CheckCircle2 size={16} /> };
            case 'Rejected': return { label: 'ถูกปฏิเสธ', color: '#ef4444', icon: <XCircle size={16} /> };
            case 'Pending':
            case 'In Progress': return { label: 'มอบหมายแล้ว/กำลังดำเนินการ', color: '#3b82f6', icon: <UserCheck size={16} /> };
            default: return { label: status, color: '#94a3b8', icon: <Clock size={16} /> };
        }
    };

    const getCoverImage = (wo: WorkOrder) => {
        const allTasks = wo.categories.flatMap(c => c.tasks);
        for (const task of allTasks) {
            // Check all possible image fields
            const img =
                task.beforePhotoUrl ||
                task.latestPhotoUrl ||
                task.afterPhotoUrl ||
                ((task as any).images && (task as any).images.length > 0 ? (task as any).images[0] : null) ||
                (task.attachments && task.attachments.length > 0 ? task.attachments[0].url : null);

            if (img && typeof img === 'string' && (img.startsWith('http') || img.startsWith('https') || img.startsWith('blob:'))) {
                return img;
            }
        }
        return null;
    };

    const StatusTimeline = ({ wo }: { wo: WorkOrder }) => {
        const status = wo.status;
        const allTasks = wo.categories.flatMap(c => c.tasks);
        const hasStarted = allTasks.some(t => (t.dailyProgress || 0) > 0 || ['In Progress', 'Completed', 'Verified'].includes(t.status));

        const stages = [
            { id: 'Evaluating', label: 'ส่งเรื่อง', active: true },
            { id: 'Decision', label: 'ประเมิน/มอบหมาย', active: status !== 'Evaluating' },
            { id: 'Incomplete', label: 'ดำเนินการ', active: hasStarted }
        ];

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                {stages.map((stage, idx) => (
                    <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: stage.active ? '#4f46e5' : '#f1f5f9',
                            color: stage.active ? '#fff' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            border: `2px solid ${stage.active ? '#4f46e5' : '#e2e8f0'}`
                        }}>
                            {stage.active ? <CheckCircle2 size={14} /> : idx + 1}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: stage.active ? '#1e293b' : '#94a3b8' }}>{stage.label}</div>
                        {idx < stages.length - 1 && (
                            <div style={{ width: '20px', height: '2px', background: stages[idx + 1].active ? '#4f46e5' : '#e2e8f0' }} />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div style={{ padding: '0 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ background: '#eef2ff', padding: '14px', borderRadius: '18px', color: '#4f46e5', border: '1px solid #e0e7ff', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.1)' }}>
                        <Clock size={28} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em' }}>ติดตามสถานะคำขอ (My Tracking)</h1>
                        <span style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '4px', display: 'block', fontWeight: 500 }}>ตรวจสอบสถานะการประเมินและการมอบหมายงานของคุณ</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {/* Tab Selection */}
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '14px' }}>
                        <button
                            onClick={() => setActiveTab('Active')}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '12px',
                                border: 'none',
                                background: activeTab === 'Active' ? '#fff' : 'transparent',
                                color: activeTab === 'Active' ? '#4f46e5' : '#64748b',
                                fontWeight: 800,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: activeTab === 'Active' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            ติดตามสถานะ
                        </button>
                        <button
                            onClick={() => setActiveTab('History')}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '12px',
                                border: 'none',
                                background: activeTab === 'History' ? '#fff' : 'transparent',
                                color: activeTab === 'History' ? '#4f46e5' : '#64748b',
                                fontWeight: 800,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: activeTab === 'History' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            ประวัติงาน
                        </button>
                    </div>

                    {/* Project Filter */}
                    <div style={{ position: 'relative', minWidth: '240px' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                            <Search size={18} />
                        </div>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 40px',
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '16px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                color: '#1e293b',
                                appearance: 'none',
                                outline: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                            }}
                        >
                            <option value="">ทั้งหมดทุกโครงการ</option>
                            {projects
                                .filter(p => workOrders.some(wo => wo.projectId === p.id && (wo.reporterId === user?.id || (user?.employeeId && wo.reporterId === user.employeeId))) || user?.assignedProjects?.includes(p.id))
                                .map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {filteredOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem', background: '#fff', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                        <div style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 600 }}>ไม่พบรายการใน{activeTab === 'Active' ? 'การติดตาม' : 'ประวัติงาน'}</div>
                        <p style={{ color: '#cbd5e1', marginTop: '8px' }}>รายการที่คุณส่งข้อมูลจะปรากฏที่นี่</p>
                    </div>
                ) : (
                    filteredOrders.map(wo => {
                        const statusInfo = getStatusInfo(wo.status);
                        const project = projects.find(p => p.id === wo.projectId);
                        const coverImg = getCoverImage(wo);
                        const rejectionReason = wo.categories
                            ?.flatMap(c => c.tasks)
                            .find(t => t.status === 'Rejected' && t.rootCause)?.rootCause;

                        return (
                            <div key={wo.id} style={{
                                background: '#fff',
                                borderRadius: '28px',
                                border: '1px solid #f1f5f9',
                                overflow: 'hidden',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.04)',
                                display: 'flex',
                                height: '280px',
                                marginBottom: '16px',
                                position: 'relative'
                            }}
                            >
                                {/* Cover Image Section */}
                                <div style={{ width: '320px', minWidth: '320px', height: '100%', background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
                                    {coverImg ? (
                                        <img src={coverImg} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#cbd5e1' }}>
                                            <Package size={40} strokeWidth={1.5} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>ไม่มีรูปภาพประกอบ</span>
                                        </div>
                                    )}
                                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, color: '#1e293b', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                            {project?.name || 'Unknown'}
                                        </div>
                                    </div>
                                </div>

                                {/* Content Section */}
                                <div style={{ flex: 1, padding: '24px 48px 24px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                        <div style={{ background: `${statusInfo.color}15`, color: statusInfo.color, padding: '5px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusInfo.color }}></div>
                                            {statusInfo.label}
                                        </div>
                                        {wo.categories.some(c => c.tasks.some(t => t.history?.some(h => h.type === 'Problem'))) && (
                                            <div style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 900,
                                                background: '#fef2f2',
                                                color: '#ef4444',
                                                padding: '4px 10px',
                                                borderRadius: '10px',
                                                border: '1px solid #fee2e2',
                                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <style>{`
                                                    @keyframes pulse {
                                                        0%, 100% { opacity: 1; transform: scale(1); }
                                                        50% { opacity: 0.8; transform: scale(1.05); }
                                                    }
                                                `}</style>
                                                🚨 พบปัญหา
                                            </div>
                                        )}
                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>ID: {wo.id}</div>

                                        {/* Role Indicator */}
                                        {activeTab === 'History' && (
                                            <div style={{
                                                marginLeft: 'auto',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                background: wo.reporterId === user?.id ? '#f0fdf4' : '#eff6ff',
                                                color: wo.reporterId === user?.id ? '#15803d' : '#2563eb',
                                                border: `1px solid ${wo.reporterId === user?.id ? '#dcfce7' : '#dbeafe'}`
                                            }}>
                                                {wo.reporterId === user?.id ? 'คุณเป็นผู้รายงาน' : 'คุณเป็นผู้ร่วมปฏิบัติงาน'}
                                            </div>
                                        )}
                                    </div>

                                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>{wo.locationName}</h3>

                                    {/* Team Members Attribution */}
                                    {activeTab === 'History' && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>ทีมงานที่ร่วมดำเนินการ:</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {/* Unique list of staff/contractors who worked on this WO */}
                                                {(() => {
                                                    const team = new Set<string>();
                                                    wo.categories.forEach(c => c.tasks.forEach(t => {
                                                        // Just list the unique staff/contractors mentioned in tasks
                                                        t.history?.forEach(h => h.labor?.forEach(l => {
                                                            if (l.staffName) team.add(l.staffName);
                                                            else if (l.affiliation) team.add(l.affiliation);
                                                        }));
                                                    }));
                                                    const teamList = Array.from(team);
                                                    return teamList.length > 0 ? (
                                                        teamList.map((name, i) => (
                                                            <div key={i} style={{
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                color: '#475569',
                                                                background: '#f8fafc',
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                border: '1px solid #e2e8f0',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}>
                                                                <User size={10} /> {name}
                                                            </div>
                                                        ))
                                                    ) : <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>ไม่พบข้อมูลทีมงานที่บันทึก</span>;
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    {/* Rejection Reason Display */}
                                    {wo.status === 'Rejected' && rejectionReason && (
                                        <div style={{
                                            background: 'linear-gradient(to right, #fff1f2, #fff)',
                                            padding: '12px 16px',
                                            borderRadius: '14px',
                                            border: '1px solid #fecaca',
                                            margin: '12px 0',
                                            fontSize: '0.85rem',
                                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.05)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#ef4444' }}></div>
                                            <div style={{ fontWeight: 800, color: '#ef4444', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <XCircle size={16} strokeWidth={2.5} style={{ display: 'block' }} /> เหตุผลการปฏิเสธ:
                                            </div>
                                            <div style={{
                                                color: '#991b1b',
                                                lineHeight: 1.5,
                                                fontWeight: 500,
                                                maxHeight: '40px',
                                                overflowY: 'auto',
                                                paddingRight: '4px'
                                            }}>
                                                {rejectionReason}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: 'auto', marginBottom: '4px' }}>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            วันที่แจ้ง: <span style={{ color: '#1e293b', fontWeight: 700 }}>{new Date(wo.createdAt).toLocaleDateString('th-TH')}</span>
                                        </div>
                                    </div>

                                    <StatusTimeline wo={wo} />
                                </div>

                                {/* Action Section */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 24px', background: '#f8fafc', borderLeft: '1px solid #f1f5f9' }}>
                                    {activeTab === 'Active' && (wo.status === 'Evaluating' || wo.status === 'Rejected') && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {wo.status === 'Evaluating' ? (
                                                <button
                                                    onClick={() => handleCancel(wo.id)}
                                                    style={{
                                                        background: '#fff',
                                                        border: '1px solid #fee2e2',
                                                        padding: '10px 16px',
                                                        borderRadius: '12px',
                                                        color: '#ef4444',
                                                        fontWeight: 800,
                                                        fontSize: '0.8rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        width: '100%'
                                                    }}
                                                    onMouseOver={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                                    onMouseOut={e => { e.currentTarget.style.background = '#fff'; }}
                                                >
                                                    <Trash2 size={14} /> ยกเลิกคำขอ
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleArchive(wo.id)}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                                                        border: 'none',
                                                        padding: '10px 16px',
                                                        borderRadius: '12px',
                                                        color: '#fff',
                                                        fontWeight: 800,
                                                        fontSize: '0.85rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        width: '100%',
                                                        boxShadow: '0 4px 6px -1px rgba(71, 85, 105, 0.2)'
                                                    }}
                                                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                                >
                                                    <X size={16} /> ปิดรายการ
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleEdit(wo)}
                                                style={{
                                                    background: wo.status === 'Rejected'
                                                        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                                        : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                                    border: 'none',
                                                    padding: '12px 20px',
                                                    borderRadius: '12px',
                                                    color: '#fff',
                                                    fontWeight: 800,
                                                    fontSize: '0.85rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: wo.status === 'Rejected' ? '0 4px 6px -1px rgba(245, 158, 11, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                            >
                                                <Edit size={16} /> {wo.status === 'Rejected' ? 'แก้ไขใหม่' : 'ดูรายละเอียด'}
                                            </button>

                                            {wo.status === 'Rejected' && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedHistoryOrder(wo);
                                                        setIsHistoryModalOpen(true);
                                                    }}
                                                    style={{
                                                        background: '#fff',
                                                        border: '1px solid #fee2e2',
                                                        padding: '12px 20px',
                                                        borderRadius: '12px',
                                                        color: '#b91c1c',
                                                        fontWeight: 800,
                                                        fontSize: '0.85rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.05)',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    onMouseOver={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                                    onMouseOut={e => { e.currentTarget.style.background = '#fff'; }}
                                                >
                                                    <FileText size={16} /> ดูรายละเอียดสรุปงาน
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'History' && (
                                        <button
                                            onClick={() => {
                                                setSelectedHistoryOrder(wo);
                                                setIsHistoryModalOpen(true);
                                            }}
                                            style={{
                                                background: '#fff',
                                                border: '1px solid #e2e8f0',
                                                padding: '12px 20px',
                                                borderRadius: '12px',
                                                color: '#0f172a',
                                                fontWeight: 800,
                                                fontSize: '0.85rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                                whiteSpace: 'nowrap'
                                            }}
                                            onMouseOver={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                            onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                        >
                                            <FileText size={16} /> ดูรายละเอียดสรุปงาน
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {selectedOrder && (
                <ForemanReportModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    editWorkOrder={selectedOrder}
                />
            )}

            {selectedHistoryOrder && (
                <HistoryDetailModal
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    workOrder={selectedHistoryOrder}
                    projects={projects}
                    staff={staff}
                    contractors={contractors}
                    currentUserId={user?.id}
                />
            )}
        </div>
    );
};

export default MyTracking;
