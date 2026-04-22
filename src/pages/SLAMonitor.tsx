import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutDashboard, User2, RotateCw, Building2, AlertCircle, ChevronDown, ChevronUp, ArrowDown, ArrowUp } from 'lucide-react';
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
    const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
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

    const handleGoToEvaluation = (task: MasterTask) => {
        const wo = workOrders.find(w => w.categories.some(c => c.tasks.some(t => t.id === task.id)));
        if (wo) {
            setSelectedEvalWO(wo);
            setIsDetailModalOpen(true);
        }
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
        const start = task.slaStartTime ? new Date(task.slaStartTime).getTime() : new Date(woCreatedAt).getTime();
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

    const getStatusThai = (status: string) => {
        const map: Record<string, string> = {
            'Pending': 'รอประเมิน',
            'Assigned': 'มอบหมายแล้ว',
            'In Progress': 'กำลังดำเนินการ',
            'Completed': 'รอตรวจสอบ',
            'Verified': 'เสร็จสมบูรณ์',
            'Cancelled': 'ยกเลิก',
            'Approved': 'อนุมัติแล้ว',
            'Evaluating': 'รอประเมิน',
            'Rejected': 'ถูกปฏิเสธ'
        };
        return map[status] || status;
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
            const matchesSearch = task.woId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.woLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesProject = !selectedProjectId || task.woProjectId === selectedProjectId;
            const matchesStaff = !selectedStaffId || (
                task.responsibleStaffIds?.includes(selectedStaffId) ||
                (selectedStaffId === currentUserId && user?.employeeId && task.responsibleStaffIds?.includes(user.employeeId))
            );
            const matchesSla = !activeSlaFilter || task.slaType === activeSlaFilter;

            const taskDate = new Date(task.woCreatedAt).toISOString().split('T')[0];
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

            {/* WO Card Area */}
            <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 4px 15px -5px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fcfdfe' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>รายการใบงานที่กำลังดำเนินการ ({(() => { const ids = new Set(flattenedTasks.map(t => t.woId)); return ids.size; })()})</div>
                </div>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(() => {
                        // Group flattenedTasks by WO
                        const woMap = new Map<string, typeof flattenedTasks>();
                        flattenedTasks.forEach(task => {
                            if (!woMap.has(task.woId)) woMap.set(task.woId, []);
                            woMap.get(task.woId)!.push(task);
                        });
                        const woGroups = Array.from(woMap.entries());

                        if (woGroups.length === 0) return (
                            <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>ไม่พบรายการที่กำลังดำเนินการ</div>
                        );

                        return woGroups.map(([woId, tasks]) => {
                            const firstTask = tasks[0];
                            const project = projects.find(p => p.id === firstTask.woProjectId);
                            const isWoExpanded = expandedTaskIds.has(woId);

                            const validTasks = tasks.filter(t => t.status !== 'Rejected');
                            const completedCount = validTasks.filter(t => t.dailyProgress === 100).length;
                            const totalCount = validTasks.length > 0 ? validTasks.length : tasks.length;
                            const isAllDone = validTasks.length > 0 ? completedCount === validTasks.length : false;

                            // Worst SLA among active tasks (Ignore completed and rejected tasks for summary color)
                            const activeTasks = tasks.filter(t => t.dailyProgress < 100 && t.status !== 'Rejected');
                            const sumTask = activeTasks.length > 0
                                ? activeTasks.reduce((worst, t) => t.slaScore > worst.slaScore ? t : worst, activeTasks[0])
                                : tasks[0]; // Fallback if all are done/rejected

                            const sumSla = getSLARemaining(sumTask, sumTask.woCreatedAt);
                            const summaryColor = sumTask.status === 'Rejected'
                                ? '#94a3b8'
                                : (sumTask.dailyProgress === 100 ? '#10b981' : (sumSla.isCritical ? '#ef4444' : (sumSla.isWarning ? '#f59e0b' : '#3b82f6')));

                            const hasActiveProblem = tasks.some(t => t.history?.some((h: any) => h.type === 'Problem'));

                            return (
                                <div key={woId} style={{ border: `1px solid #e2e8f0`, borderRadius: '18px', overflow: 'hidden', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)', borderLeft: `4px solid ${summaryColor}` }}>
                                    {/* WO Card Header */}
                                    <div
                                        onClick={() => {
                                            const newSet = new Set(expandedTaskIds);
                                            if (newSet.has(woId)) newSet.delete(woId);
                                            else newSet.add(woId);
                                            setExpandedTaskIds(newSet);
                                        }}
                                        style={{ padding: '1rem 1.5rem', background: isWoExpanded ? '#f8faff' : '#fff', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'background 0.2s' }}
                                        onMouseEnter={e => { if (!isWoExpanded) e.currentTarget.style.background = '#f8fafc'; }}
                                        onMouseLeave={e => { if (!isWoExpanded) e.currentTarget.style.background = '#fff'; }}
                                    >
                                        {/* Project Image */}
                                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', overflow: 'hidden', background: '#f1f5f9', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                                            {project?.imageUrl
                                                ? <img loading="lazy" src={project.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 900, color: '#334155' }}>{(project?.name || 'P')[0]}</div>
                                            }
                                        </div>

                                        {/* WO Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 950, color: '#4f46e5' }}>{woId}</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{project?.name || 'N/A'}</span>
                                                <span style={{ color: '#cbd5e1' }}>•</span>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{firstTask.woLocation}</span>
                                            </div>
                                            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                {/* Task count badge */}
                                                <span style={{ fontSize: '0.78rem', fontWeight: 800, background: isAllDone ? '#f0fdf4' : '#f8fafc', color: isAllDone ? '#16a34a' : '#475569', padding: '2px 10px', borderRadius: '20px', border: `1px solid ${isAllDone ? '#bbf7d0' : '#e2e8f0'}` }}>
                                                    ✅ {completedCount}/{totalCount} งาน
                                                </span>

                                                {/* Problem Badge */}
                                                {hasActiveProblem && (
                                                    <span style={{
                                                        fontSize: '0.78rem',
                                                        fontWeight: 900,
                                                        background: '#fef2f2',
                                                        color: '#ef4444',
                                                        padding: '2px 10px',
                                                        borderRadius: '20px',
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
                                                    </span>
                                                )}

                                                {/* Worst SLA badge */}
                                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: summaryColor }}>
                                                    <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: summaryColor, marginRight: '5px', verticalAlign: 'middle' }} />
                                                    {sumSla.text}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Toggle icon */}
                                        <div style={{ color: '#94a3b8', flexShrink: 0, transition: 'transform 0.2s', transform: isWoExpanded ? 'rotate(180deg)' : 'none' }}>
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>

                                    {/* Expandable Task Table */}
                                    {isWoExpanded && (
                                        <div style={{ borderTop: '1px solid #f1f5f9' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                        <th style={{ padding: '10px 20px', fontSize: '0.72rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>รายละเอียดงาน</th>
                                                        <th style={{ padding: '10px 20px', fontSize: '0.72rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>ผู้รับผิดชอบ</th>
                                                        <th style={{ padding: '10px 20px', fontSize: '0.72rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>สถานะ SLA</th>
                                                        <th style={{ padding: '10px 20px', fontSize: '0.72rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>ความคืบหน้า</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tasks.map(task => {
                                                        const isTaskExpanded = expandedTaskIds.has(task.id);
                                                        const sla = getSLARemaining(task, task.woCreatedAt);
                                                        const isHovered = hoveredTaskId === task.id;
                                                        const progressColor = task.dailyProgress === 100 ? '#10b981' : (sla.isCritical ? '#ef4444' : (sla.isWarning ? '#f59e0b' : '#3b82f6'));
                                                        const staffMember = staff.find(s => task.responsibleStaffIds?.includes(s.id));
                                                        const contractor = contractors.find(c => c.id === task.contractorId);
                                                        let rowBg = isTaskExpanded ? '#eff6ff' : (isHovered ? '#f1f5f9' : '#ffffff');

                                                        return (
                                                            <React.Fragment key={task.id}>
                                                                <tr
                                                                    onClick={() => toggleTaskExpansion(task.id)}
                                                                    onMouseEnter={() => setHoveredTaskId(task.id)}
                                                                    onMouseLeave={() => setHoveredTaskId(null)}
                                                                    style={{ background: rowBg, cursor: 'pointer', borderTop: '1px solid #f1f5f9', transition: 'background 0.15s', boxShadow: isTaskExpanded ? 'inset 4px 0 0 0 #4f46e5' : 'none' }}
                                                                >
                                                                    <td style={{ padding: '14px 20px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                                                                {task.beforePhotoUrl ? <img loading="lazy" src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <AlertCircle size={12} color="#cbd5e1" style={{ margin: '10px' }} />}
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{task.name}</div>
                                                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{task.categoryName}</div>
                                                                            </div>
                                                                            {isTaskExpanded ? <ChevronUp size={16} color="#4f46e5" style={{ marginLeft: 'auto' }} /> : <ChevronDown size={16} color="#cbd5e1" style={{ marginLeft: 'auto' }} />}
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '14px 20px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                                                                            {staffMember ? (<>
                                                                                {staffMember.profileImage ? <img loading="lazy" src={staffMember.profileImage} style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User2 size={12} /></div>}
                                                                                <div>
                                                                                    <div style={{ fontWeight: 800 }}>{staffMember.name}</div>
                                                                                    {staffMember.phone && <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>📞 {staffMember.phone}</div>}
                                                                                </div>
                                                                            </>) : contractor ? (<>
                                                                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={12} /></div>
                                                                                <div style={{ fontWeight: 800 }}>{contractor.name}</div>
                                                                            </>) : task.status === 'Rejected' ? (
                                                                                <span style={{ color: '#ef4444', fontWeight: 800 }}>ถูกปฏิเสธ</span>
                                                                            ) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>รอประเมิน</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '14px 20px' }}>
                                                                        <div style={{ fontSize: '0.8rem', fontWeight: 900, color: (sla as any).isDone ? '#10b981' : ((sla as any).isRejected ? '#94a3b8' : progressColor), display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            {!(sla as any).isRejected && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: (sla as any).isDone ? '#10b981' : progressColor }} />}
                                                                            {sla.text}
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '14px 20px', textAlign: 'center', width: '130px' }}>
                                                                        <div style={{ width: '100%', height: '16px', background: '#f1f5f9', borderRadius: '20px', position: 'relative', overflow: 'hidden' }}>
                                                                            <div style={{ width: `${task.dailyProgress}%`, height: '100%', background: progressColor, borderRadius: '20px', transition: 'width 0.4s' }} />
                                                                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                                                                <span style={{ fontSize: '0.62rem', fontWeight: 950, color: task.dailyProgress >= 50 ? '#fff' : progressColor }}>{task.dailyProgress}%</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                {isTaskExpanded && (
                                                                    <tr style={{ background: '#eff6ff' }}>
                                                                        <td colSpan={4} style={{ padding: '0 24px 24px 24px' }}>
                                                                            <div style={{ padding: '24px', background: '#fff', borderRadius: '20px', border: '1px solid #dbeafe', display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '28px', boxShadow: '0 8px 15px -3px rgba(0,0,0,0.04)' }}>
                                                                                <div style={{ display: 'flex', gap: '16px' }}>
                                                                                    <div style={{ flex: 1 }}>
                                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', marginBottom: '8px' }}>BEFORE</div>
                                                                                        <div style={{ aspectRatio: '4/3', borderRadius: '12px', background: '#f8fafc', overflow: 'hidden' }}>
                                                                                            {task.beforePhotoUrl && <img loading="lazy" src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div style={{ flex: 1 }}>
                                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#10b981', marginBottom: '8px' }}>LATEST UPDATE</div>
                                                                                        <div style={{ aspectRatio: '4/3', borderRadius: '12px', background: '#f8fafc', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                                                            {(() => {
                                                                                                const photoUrl = [...(task.history || [])].reverse().find(h => h.photos?.length > 0)?.photos[0];
                                                                                                return photoUrl
                                                                                                    ? <img loading="lazy" src={photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => setZoomImage(photoUrl)} />
                                                                                                    : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '0.8rem' }}>ยังไม่มีรูปอัปเดต</div>;
                                                                                            })()}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                                        <div>
                                                                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b' }}>{task.woLocation}</div>
                                                                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{getStatusThai(task.status)}</div>
                                                                                        </div>
                                                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                                                            {task.status === 'Pending' && currentRole !== 'Foreman' && (
                                                                                                <button
                                                                                                    onClick={() => handleGoToEvaluation(task)}
                                                                                                    style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
                                                                                                >
                                                                                                    ไปที่ประเมิน
                                                                                                </button>
                                                                                            )}
                                                                                            {(task.status === 'Approved' || ((task.status === 'In Progress' || task.status === 'Assigned') && Number(task.dailyProgress || 0) === 0)) && currentRole !== 'Foreman' && (
                                                                                                <button onClick={() => handleInitiateAssign(task.id, task.woId)} style={{ background: task.status !== 'Approved' ? '#fff' : '#4f46e5', color: task.status !== 'Approved' ? '#4f46e5' : '#fff', border: task.status !== 'Approved' ? '1.5px solid #4f46e5' : 'none', padding: '7px 14px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                                    {task.status !== 'Approved' ? <RotateCw size={13} /> : null}
                                                                                                    {task.status !== 'Approved' ? 'เปลี่ยนผู้รับผิดชอบ' : 'มอบหมาย'}
                                                                                                </button>
                                                                                            )}
                                                                                            {task.status === 'Completed' && currentRole !== 'Foreman' && <button onClick={() => handleInitiateClose(task.id, task.woId)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>ตรวจรับงาน</button>}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '14px', fontSize: '0.9rem', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                                                                                            <div>
                                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>เบอร์ติดต่อ</div>
                                                                                                <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#1e293b' }}>{staffMember?.phone || contractor?.phone || '-'}</div>
                                                                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginTop: '8px' }}>📅 วันเริ่ม: <span style={{ color: '#0f172a', fontWeight: 900 }}>{new Date(task.slaStartTime || task.woCreatedAt).toLocaleDateString('th-TH')}</span></div>
                                                                                            </div>
                                                                                            <div style={{ background: sla.isCritical ? '#fef2f2' : '#f0f9ff', padding: '12px', borderRadius: '10px', border: `1px solid ${sla.isCritical ? '#fee2e2' : '#e0f2fe'}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: sla.isCritical ? '#ef4444' : '#0369a1', marginBottom: '6px', textTransform: 'uppercase' }}>เวลาคงเหลือ</div>
                                                                                                <div style={{ fontSize: '1.2rem', fontWeight: 1000, color: progressColor, textAlign: 'center' }}>{sla.text}</div>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div>
                                                                                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.8rem', marginBottom: '6px' }}>หมายเหตุ:</div>
                                                                                            {(() => {
                                                                const latestHistory = task.history?.[0];
                                                                const isProblem = latestHistory?.type === 'Problem';
                                                                return (
                                                                    <div style={{
                                                                        color: isProblem ? '#ef4444' : '#64748b',
                                                                        fontStyle: isProblem ? 'normal' : 'italic',
                                                                        borderLeft: `2px solid ${isProblem ? '#ef4444' : '#cbd5e1'}`,
                                                                        padding: isProblem ? '8px 12px' : '0 0 0 10px',
                                                                        background: isProblem ? '#fef2f2' : 'transparent',
                                                                        borderRadius: isProblem ? '8px' : '0',
                                                                        fontSize: isProblem ? '0.9rem' : '0.85rem',
                                                                        lineHeight: 1.4,
                                                                        fontWeight: isProblem ? 700 : 400
                                                                    }}>
                                                                        {isProblem && <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={14} /> รายงานปัญหาจากหน้างาน:</div>}
                                                                        {latestHistory?.note || 'ไม่มีหมายเหตุล่าสุด'}
                                                                    </div>
                                                                );
                                                            })()}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            {/* Modals */}
            {closingWorkOrder && <CloseJobModal isOpen={!!closingWorkOrder} workOrder={closingWorkOrder} targetTaskId={verifyingTaskId || undefined} onClose={() => { setClosingWorkOrder(null); setVerifyingTaskId(null); }} onConfirm={handleConfirmClose} />}
            {assigningTask && <AdminAssignModal isOpen={!!assigningTask} onClose={() => setAssigningTask(null)} task={assigningTask.task} workOrderId={assigningTask.woId} staffList={staff} contractors={contractors} onAssign={updateTask} />}

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
