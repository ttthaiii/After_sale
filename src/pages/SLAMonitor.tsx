import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutDashboard, RotateCw, Building2, AlertCircle, ArrowDown, ArrowUp } from 'lucide-react';
import { WorkOrder, MasterTask } from '../types';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import { logService } from '../services/logService';
import CloseJobModal from '../components/CloseJobModal';
import AdminAssignModal from '../components/AdminAssignModal';
import DateRangePicker from '../components/DateRangePicker';
import WorkOrderDetailModal from '../components/WorkOrderDetailModal';
import TaskEvaluationModal from '../components/TaskEvaluationModal';

const SLAMonitor = () => {
    const { user } = useAuth();
    const { workOrders, updateWorkOrderStatus, updateTask, projects, staff, contractors, saveEvaluation } = useWorkOrders();
    const [searchParams] = useSearchParams();

    // ✅ Track Page View
    useEffect(() => {
        if (user) {
            logService.trackPageView(user, 'SLA_MONITOR', 'SLA Monitor');
        }
    }, [user]);

    const currentRole = user?.role || 'Approver';
    const currentUserId = user?.id || '';

    // UI States
    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [closingWorkOrder, setClosingWorkOrder] = useState<WorkOrder | null>(null);
    const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
    const [assigningTask, setAssigningTask] = useState<{ task: MasterTask, woId: string } | null>(null);

    // ✅ Evaluation States
    const [selectedEvalWO, setSelectedEvalWO] = useState<WorkOrder | null>(null);
    const [currentEvalTask, setCurrentEvalTask] = useState<MasterTask | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
    const [taskDecisions, setTaskDecisions] = useState<Record<string, 'Approved' | 'Assigned' | 'Rejected'>>({});

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState(currentRole === 'Foreman' ? currentUserId : '');
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [activeSlaFilter, setActiveSlaFilter] = useState<'overdue' | 'warning' | 'normal' | 'completed' | null>(
        (searchParams.get('slaFilter') as any) || null
    );
    const [sortBy, setSortBy] = useState<'urgency' | 'createdAt'>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Auto-expand and search from URL
    useEffect(() => {
        const taskIdFromUrl = searchParams.get('taskId');
        const woIdFromUrl = searchParams.get('woId');
        
        if (taskIdFromUrl) {
            setExpandedTaskIds(new Set([taskIdFromUrl]));
        }

        if (woIdFromUrl) {
            setSearchTerm(woIdFromUrl);
            // Optionally clear the URL to prevent re-filtering on back navigation
            // navigate({ search: '' }, { replace: true });
        }
    }, [searchParams]);

    // Helper Functions
    const toggleTaskExpansion = (taskId: string) => {
        const newSet = new Set(expandedTaskIds);
        if (newSet.has(taskId)) newSet.delete(taskId);
        else newSet.add(taskId);
        setExpandedTaskIds(newSet);
    };

    // ✅ Evaluation Handlers
    const handleTaskReviewClick = (task: MasterTask) => {
        setCurrentEvalTask(task);
        setIsEvalModalOpen(true);
    };

    const handleModalConfirm = (updates: Partial<MasterTask>) => {
        if (!currentEvalTask || !selectedEvalWO) return;

        const status = updates.status as 'Approved' | 'Assigned' | 'Rejected';
        setTaskDecisions(prev => ({ ...prev, [currentEvalTask.id]: status }));

        setSelectedEvalWO(prevWo => {
            if (!prevWo) return null;
            return {
                ...prevWo,
                categories: prevWo.categories.map(cat => ({
                    ...cat,
                    tasks: cat.tasks.map(t => t.id === currentEvalTask.id ? { ...t, ...updates } : t)
                }))
            };
        });

        setIsEvalModalOpen(false);
    };

    const handleCompleteEvaluation = async (wo: WorkOrder) => {
        const allTasks = wo.categories.flatMap(c => c.tasks);
        const approvedCount = allTasks.filter(t => t.status === 'Approved' || t.status === 'Assigned').length;
        const total = allTasks.length;
        let finalWoStatus: 'Approved' | 'Partially Approved' | 'Rejected' = 'Approved';

        if (approvedCount === 0) finalWoStatus = 'Rejected';
        else if (approvedCount < total) finalWoStatus = 'Partially Approved';
        else finalWoStatus = 'Approved';

        allTasks.forEach(t => {
            if (t.status === 'Pending') {
                t.status = 'Rejected';
            }
        });

        await saveEvaluation(wo.id, finalWoStatus, wo.categories);
        setIsDetailModalOpen(false);
        setSelectedEvalWO(null);
        setTaskDecisions({});
    };

    const getSLARemaining = (task: any, woCreatedAt: string) => {
        // ✅ 1. If task is completed (dailyProgress 100%), stop SLA
        if (task.dailyProgress === 100) {
            return { text: 'เสร็จสิ้นแล้ว', isCritical: false, isWarning: false, isDone: true, diffMs: 0 };
        }

        // ✅ 2. If task is rejected, show specific status
        if (task.status === 'Rejected') {
            return { text: 'ถูกปฏิเสธ', isCritical: false, isWarning: false, isRejected: true, diffMs: 0 };
        }

        const slaHoursMap = { 'Immediately': 4, '24h': 24, '1-3d': 72, '3-7d': 168, '7-14d': 336, '14-30d': 720 };
        const limit = slaHoursMap[task.slaCategory as keyof typeof slaHoursMap || '24h'] || 24;
        const parsedStart = task.slaStartTime ? new Date(task.slaStartTime).getTime() : (woCreatedAt ? new Date(woCreatedAt).getTime() : Date.now());
        const start = isNaN(parsedStart) ? Date.now() : parsedStart;
        const diffMs = (start + (limit * 60 * 60 * 1000)) - Date.now();

        if (diffMs < 0) {
            const hoursOverdue = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
            const daysOverdue = Math.floor(hoursOverdue / 24);
            const remHoursOverdue = hoursOverdue % 24;
            let text = `เกินกำหนด ${remHoursOverdue}ชม.`;
            if (daysOverdue > 0) text = `เกินกำหนด ${daysOverdue}วัน ${remHoursOverdue}ชม.`;
            return { text, isCritical: true, isWarning: false, diffMs };
        }

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        let text = `เหลือ ${hours}ชม.`;
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const remHours = hours % 24;
            text = `เหลือ ${days}วัน ${remHours}ชม.`;
        }
        return { text, isCritical: false, isWarning: hours < 24, diffMs };
    };


    const handleInitiateClose = (taskId: string, woId: string) => {
        const wo = workOrders.find(w => w.id === woId);
        if (wo) {
            setClosingWorkOrder(wo);
            setVerifyingTaskId(taskId);
        }
    };

    const handleInitiateAssign = (taskId: string, woId: string) => {
        const wo = workOrders.find(w => w.id === woId);
        if (wo) {
            const task = wo.categories.flatMap(c => c.tasks).find(t => t.id === taskId);
            if (task) setAssigningTask({ task, woId });
        }
    };

    const handleAssignTask = async (woId: string, taskId: string, updates: Partial<MasterTask>) => {
        const wo = workOrders.find(w => w.id === woId);
        const category = wo?.categories?.find(c => c.tasks.some(t => t.id === taskId));
        if (category) {
            await updateTask(woId, category.id, taskId, updates);
        }
    };

    const handleConfirmClose = (id: string) => {
        updateWorkOrderStatus(id, 'Completed');
        setClosingWorkOrder(null);
        setVerifyingTaskId(null);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedProjectId('');
        setSelectedStaffId(currentRole === 'Foreman' ? currentUserId : '');
        setStartDate(null);
        setEndDate(null);
        setActiveSlaFilter(null);
        setSortBy('createdAt');
        setSortOrder('desc');
    };

    // Flattening & Filtering Logic
    const flattenedTasks = useMemo(() => {
        // 1. Filter out Drafts, Completed, and Archived jobs
        let filteredWOs = workOrders.filter(wo => wo.status !== 'Draft' && wo.status !== 'Completed' && !wo.isArchived);

        // 2. Role Logic for Foreman
        if (currentRole === 'Foreman') {
            filteredWOs = filteredWOs.filter(wo => {
                const matchesUser = (id: string) => id === currentUserId || (user?.employeeId && id === user.employeeId);
                const isReporter = matchesUser(wo.reporterId || '');
                const isResponsible = wo.categories.some(c => c.tasks.some(t => t.responsibleStaffIds?.some(id => matchesUser(id))));
                return isReporter || isResponsible;
            });
        }

        // 3. Map to tasks with priority scores
        const allTasks = filteredWOs.flatMap(wo => {
            return (wo.categories || []).flatMap(cat =>
                (cat.tasks || []).map(t => {
                    const sla = getSLARemaining(t, wo.createdAt);
                    let score = 2; // Normal (Blue)
                    let slaType: 'overdue' | 'warning' | 'normal' | 'completed' = 'normal';

                    if (t.dailyProgress === 100) { score = 1; slaType = 'completed'; } // Green
                    else if (sla.isCritical) { score = 4; slaType = 'overdue'; } // Red
                    else if (sla.isWarning) { score = 3; slaType = 'warning'; } // Yellow

                    return {
                        ...t,
                        woId: wo.id,
                        woProjectId: wo.projectId,
                        woLocation: wo.locationName,
                        woCreatedAt: wo.createdAt,
                        woAppointmentDate: wo.appointmentDate,
                        taskStartDate: t.startDate,
                        categoryName: cat.name,
                        slaScore: score,
                        slaType,
                        diffMs: sla.diffMs
                    };
                })
            );
        });

        // 4. Filtering
        const filtered = allTasks.filter(task => {
            const matchesSearch = (task.woId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (task.woLocation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (task.name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesProject = !selectedProjectId || task.woProjectId === selectedProjectId;
            const matchesStaff = !selectedStaffId || (
                task.responsibleStaffIds?.includes(selectedStaffId) ||
                (selectedStaffId === currentUserId && user?.employeeId && task.responsibleStaffIds?.includes(user.employeeId))
            );
            const matchesSla = !activeSlaFilter || task.slaType === activeSlaFilter;

            const taskDate = task.woCreatedAt && !isNaN(new Date(task.woCreatedAt).getTime())
                ? new Date(task.woCreatedAt).toISOString().split('T')[0]
                : '';
            const matchesStart = !startDate || taskDate >= startDate;
            const matchesEnd = !endDate || taskDate <= endDate;

            return matchesSearch && matchesProject && matchesStaff && matchesSla && matchesStart && matchesEnd;
        });

        // 5. Sorting
        return filtered.sort((a, b) => {
            if (sortBy === 'urgency') {
                if (a.slaScore !== b.slaScore) {
                    return sortOrder === 'asc' ? a.slaScore - b.slaScore : b.slaScore - a.slaScore;
                }
                // Secondary sort: most urgent (lowest diffMs) first regardless of order if sorting urgency
                return a.diffMs - b.diffMs;
            } else {
                const valA = new Date(a.woCreatedAt).getTime();
                const valB = new Date(b.woCreatedAt).getTime();
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
        });
    }, [workOrders, searchTerm, selectedProjectId, selectedStaffId, activeSlaFilter, startDate, endDate, currentRole, currentUserId, sortBy, sortOrder]);

    // Derived active staff list
    const activeStaffIds = useMemo(() => {
        const ids = new Set<string>();
        flattenedTasks.forEach(task => {
            if (task.responsibleStaffIds) {
                task.responsibleStaffIds.forEach((id: string) => ids.add(id));
            }
        });
        return ids;
    }, [flattenedTasks]);

    // 6. Projects with real work orders (No Drafts)
    const activeProjects = useMemo(() => {
        const projectIdsWithWOs = new Set(workOrders.filter(wo => wo.status !== 'Draft').map(wo => wo.projectId));
        return projects.filter(p => projectIdsWithWOs.has(p.id));
    }, [projects, workOrders]);

    // Styles
    const commonInputStyle = {
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '10px 16px',
        fontSize: '0.9rem',
        outline: 'none',
        fontWeight: 600 as const,
        color: '#1e293b'
    };

    return (
        <div style={{ padding: '0 1rem' }}>
            {/* Image Zoom Overlay */}
            {zoomImage && (
                <div
                    onClick={() => setZoomImage(null)}
                    style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'zoom-out' }}
                >
                    <img loading="lazy" src={zoomImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ background: '#0f172a', padding: '14px', borderRadius: '18px', color: 'white', boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.2)' }}>
                        <LayoutDashboard size={28} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em' }}>ติดตามสถานะงาน (Real-time Tracking)</h1>
                        <span style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '4px', display: 'block', fontWeight: 500 }}>มอนิเตอร์ความคืบหน้าและประเมินผลงานตาม SLA</span>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '1.25rem', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.2fr) 0.8fr 1fr 1fr 1fr 1fr auto', gap: '0.8rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                        <input type="text" placeholder="ค้นหาเลขที่งาน หรือ บ้านเลขที่..." style={{ ...commonInputStyle, paddingLeft: '44px', width: '100%', boxSizing: 'border-box' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <select style={commonInputStyle} value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                        <option value="">ทุกโครงการ</option>
                        {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    <DateRangePicker startDate={startDate || ''} endDate={endDate || ''} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />

                    <select style={commonInputStyle} value={activeSlaFilter || ''} onChange={e => setActiveSlaFilter(e.target.value as any || null)}>
                        <option value="">สถานะ SLA ทั้งหมด</option>
                        <option value="overdue">🔴 เกินกำหนด</option>
                        <option value="warning">🟡 วิกฤต (&lt;24ชม.)</option>
                        <option value="normal">🔵 ปกติ (&gt;24ชม.)</option>
                        <option value="completed">🟢 เสร็จสิ้น</option>
                    </select>

                    {currentRole !== 'Foreman' ? (
                        <select style={commonInputStyle} value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}>
                            <option value="">เจ้าหน้าที่ทั้งหมด</option>
                            {staff.filter(s => activeStaffIds.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    ) : <div />}

                    <div style={{ display: 'flex', background: '#f8fafc', padding: '4px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => {
                                if (sortBy === 'urgency') {
                                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                                } else {
                                    setSortBy('urgency');
                                    setSortOrder('desc');
                                }
                            }}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '10px',
                                border: 'none',
                                background: sortBy === 'urgency' ? '#fff' : 'transparent',
                                color: sortBy === 'urgency' ? '#4f46e5' : '#64748b',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: sortBy === 'urgency' ? '0 2px 8px -2px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            ความวิกฤต
                            {sortBy === 'urgency' && (sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}
                        </button>
                        <button
                            onClick={() => {
                                if (sortBy === 'createdAt') {
                                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                                } else {
                                    setSortBy('createdAt');
                                    setSortOrder('desc');
                                }
                            }}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '10px',
                                border: 'none',
                                background: sortBy === 'createdAt' ? '#fff' : 'transparent',
                                color: sortBy === 'createdAt' ? '#4f46e5' : '#64748b',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: sortBy === 'createdAt' ? '0 2px 8px -2px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            เวลาเปิดใบงาน
                            {sortBy === 'createdAt' && (sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}
                        </button>
                    </div>

                    <button onClick={clearFilters} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontWeight: 600 }}>
                        <RotateCw size={16} /> ล้าง
                    </button>
                </div>
            </div>

            {/* Kanban Board Area */}
            <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '16px' }}>
                {[
                    { id: 'upcoming', label: 'Upcoming Tasks', color: '#ff5c5c' },
                    { id: 'in-progress', label: 'In Progress', color: '#5b5ce6' },
                    { id: 'for-checking', label: 'For Checking', color: '#f59e0b' },
                    { id: 'completed', label: 'Completed', color: '#00b87c' },
                ].map(column => {
                    const columnTasks = flattenedTasks.filter(t => {
                        let effectiveStatus: string = t.status;
                        const progress = t.dailyProgress || 0;
                        
                        // Force Column Sync Logic
                        if (progress >= 100 && effectiveStatus !== 'Completed') {
                            effectiveStatus = 'for-checking';
                        } else if (progress > 0 && progress < 100 && (effectiveStatus === 'Pending' || effectiveStatus === 'Assigned' || effectiveStatus === 'upcoming')) {
                            effectiveStatus = 'in-progress';
                        }

                        if (column.id === 'upcoming') return effectiveStatus === 'Pending' || effectiveStatus === 'Assigned' || effectiveStatus === 'upcoming';
                        if (column.id === 'in-progress') return effectiveStatus === 'In Progress' || effectiveStatus === 'in-progress';
                        if (column.id === 'for-checking') return effectiveStatus === 'for-checking' || effectiveStatus === 'Verified';
                        if (column.id === 'completed') return effectiveStatus === 'Completed' || effectiveStatus === 'Approved';
                        
                        return false;
                    });

                    return (
                        <div key={column.id} style={{ minWidth: 340, width: 340, background: '#f4f6f8', borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ width: 6, height: 20, background: column.color, borderRadius: 4 }} />
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1c1e2b' }}>{column.label}</div>
                                <div style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.8rem', fontWeight: 900, padding: '2px 10px', borderRadius: '12px', marginLeft: 'auto' }}>{columnTasks.length}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 200 }}>
                                {columnTasks.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 700, padding: '32px 0', border: '2px dashed #e2e8f0', borderRadius: '16px' }}>No Tasks</div>
                                ) : (
                                    columnTasks.map(task => {
                                        const project = projects.find(p => p.id === task.woProjectId);
                                        const sla = getSLARemaining(task, task.woCreatedAt);
                                        const isExpanded = expandedTaskIds.has(task.id);
                                        
                                        const assignedStaff = staff.find(s => task.responsibleStaffIds?.includes(s.id));
                                        const assignedContractor = contractors.find(c => task.responsibleStaffIds?.includes(c.id));
                                        const assignedName = assignedStaff?.name || assignedContractor?.name || 'ยังไม่มอบหมาย';
                                        const assignedPhone = assignedStaff?.phone || assignedContractor?.phone || '-';
                                        const assignedRole = assignedStaff ? 'Staff' : (assignedContractor ? 'Contractor' : '-');

                                        return (
                                            <div 
                                                key={task.id} 
                                                style={{ 
                                                    background: '#fff', 
                                                    borderRadius: '16px', 
                                                    padding: '16px', 
                                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', 
                                                    cursor: 'pointer', 
                                                    border: isExpanded ? '2px solid #4f46e5' : '1px solid #f1f5f9', 
                                                    transition: 'all 0.2s',
                                                    textAlign: 'left'
                                                }} 
                                                onClick={() => toggleTaskExpansion(task.id)}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '8px' }}>{task.woId}</div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: column.color, background: `${column.color}15`, padding: '2px 8px', borderRadius: '8px' }}>{task.dailyProgress}%</div>
                                                </div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#1e293b', marginBottom: '6px', lineHeight: 1.3 }}>{task.name}</div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Building2 size={12} /> {project?.name} - {task.woLocation}
                                                </div>
                                                
                                                {task.beforePhotoUrl && (
                                                    <div style={{ width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px', border: '1px solid #f1f5f9' }}>
                                                        <img src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                )}

                                                {/* Expanded Details */}
                                                {isExpanded && (
                                                    <div 
                                                        onClick={(e) => e.stopPropagation()} 
                                                        style={{ 
                                                            marginTop: '12px', 
                                                            paddingTop: '12px', 
                                                            borderTop: '1px dashed #e2e8f0',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '10px',
                                                            fontSize: '0.8rem',
                                                            color: '#475569'
                                                        }}
                                                    >
                                                        <div>
                                                            <span style={{ fontWeight: 800, color: '#94a3b8' }}>ผู้รับผิดชอบ:</span> <span style={{ fontWeight: 900, color: '#1e293b' }}>{assignedName} ({assignedRole})</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ fontWeight: 800, color: '#94a3b8' }}>เบอร์ติดต่อ:</span> <span style={{ fontWeight: 900, color: '#1e293b' }}>{assignedPhone}</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ fontWeight: 800, color: '#94a3b8' }}>วันเริ่มงาน:</span> <span style={{ fontWeight: 900, color: '#1e293b' }}>{task.startDate ? new Date(task.startDate).toLocaleDateString('th-TH') : '-'}</span>
                                                        </div>
                                                        {task.history && task.history.length > 0 && (
                                                            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                                                                <div style={{ fontWeight: 900, color: '#475569', marginBottom: '4px', fontSize: '0.75rem' }}>หมายเหตุล่าสุด:</div>
                                                                <div style={{ fontStyle: 'italic', color: '#64748b' }}>"{task.history[0].note || 'ไม่มีข้อความหมายเหตุ'}"</div>
                                                            </div>
                                                        )}

                                                        {/* Actions Area inside Card */}
                                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                            {/* Assign Button */}
                                                            {(currentRole === 'Admin' || currentRole === 'Manager' || currentRole === 'Approver') && (
                                                                <button 
                                                                    onClick={() => handleInitiateAssign(task.id, task.woId)} 
                                                                    style={{ 
                                                                        flex: 1,
                                                                        background: '#fff', 
                                                                        color: '#4f46e5', 
                                                                        border: '1.5px solid #4f46e5', 
                                                                        padding: '6px 12px', 
                                                                        borderRadius: '8px', 
                                                                        fontWeight: 800, 
                                                                        cursor: 'pointer', 
                                                                        fontSize: '0.75rem', 
                                                                        display: 'flex', 
                                                                        alignItems: 'center', 
                                                                        justifyContent: 'center',
                                                                        gap: '4px' 
                                                                    }}
                                                                >
                                                                    <RotateCw size={12} />
                                                                    {task.responsibleStaffIds && task.responsibleStaffIds.length > 0 ? 'เปลี่ยนผู้รับผิดชอบ' : 'มอบหมาย'}
                                                                </button>
                                                            )}
                                                            
                                                            {/* Review/Evaluate Button */}
                                                            {column.id === 'for-checking' && (
                                                                <button 
                                                                    onClick={() => handleInitiateClose(task.id, task.woId)} 
                                                                    style={{ 
                                                                        flex: 1,
                                                                        background: '#10b981', 
                                                                        color: '#fff', 
                                                                        border: 'none', 
                                                                        padding: '6px 12px', 
                                                                        borderRadius: '8px', 
                                                                        fontWeight: 800, 
                                                                        cursor: 'pointer', 
                                                                        fontSize: '0.75rem',
                                                                        display: 'flex', 
                                                                        alignItems: 'center', 
                                                                        justifyContent: 'center'
                                                                    }}
                                                                >
                                                                    ตรวจรับงาน
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: sla.isCritical ? '#ef4444' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <AlertCircle size={12} /> {sla.text}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>
                                                        {isExpanded ? 'คลิกเพื่อยุบ' : 'คลิกเพื่อขยาย'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modals */}
            {closingWorkOrder && <CloseJobModal isOpen={!!closingWorkOrder} workOrder={closingWorkOrder} targetTaskId={verifyingTaskId || undefined} onClose={() => { setClosingWorkOrder(null); setVerifyingTaskId(null); }} onConfirm={handleConfirmClose} />}
            {assigningTask && <AdminAssignModal isOpen={!!assigningTask} onClose={() => setAssigningTask(null)} task={assigningTask.task} workOrderId={assigningTask.woId} staffList={staff} contractors={contractors} onAssign={handleAssignTask} />}

            {/* Evaluation Modals */}
            {selectedEvalWO && (
                <WorkOrderDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    wo={selectedEvalWO}
                    onTaskClick={handleTaskReviewClick}
                    onComplete={handleCompleteEvaluation}
                    taskDecisions={taskDecisions}
                />
            )}

            {currentEvalTask && (
                <TaskEvaluationModal
                    isOpen={isEvalModalOpen}
                    onClose={() => setIsEvalModalOpen(false)}
                    task={currentEvalTask}
                    workOrderId={selectedEvalWO?.id || ''}
                    onConfirm={handleModalConfirm}
                />
            )}

            {/* Zoom Image Overlay */}
            {zoomImage && (
                <div 
                    onClick={() => setZoomImage(null)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                >
                    <img src={zoomImage} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px' }} />
                </div>
            )}
        </div>
    );
};

export default SLAMonitor;
