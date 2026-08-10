import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutDashboard, RotateCw, Building2, AlertCircle, ArrowDown, ArrowUp, Calendar, Users, Clock, Camera, ChevronLeft, ChevronRight, ChevronDown, Image as ImageIcon, Info, FileText } from 'lucide-react';
import { ModalCloseButton } from '../components/ui/ModalCloseButton';
import { useWorkOrders } from '../context/WorkOrderContext';
import { deriveWoStatus } from '../utils/deriveWoStatus';
import { formatDate } from '../utils/date';
import { computeJobSLA } from '../utils/jobSla';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { logService } from '../services/logService';
import CloseJobModal from '../components/CloseJobModal';
import AdminAssignModal from '../components/AdminAssignModal';
import TaskReviewModal from '../components/TaskReviewModal';
import DateRangePicker from '../components/DateRangePicker';
import WorkOrderDetailModal from '../components/WorkOrderDetailModal';
import TaskEvaluationModal from '../components/TaskEvaluationModal';
import { useIsMobile } from '../hooks/useIsMobile';
import { gridCols } from '../components/ui/responsiveGrid';
import { scaleFont } from '../components/ui/responsiveText';

const SLAMonitor = () => {
    const { user } = useAuth();
    const { workOrders, updateWorkOrderStatus, updateTask, projects, staff, contractors, saveEvaluation, taskDrafts } = useWorkOrders();
    const [searchParams] = useSearchParams();
    const isMobile = useIsMobile();
    const showAlert = useAlert();

    useEffect(() => {
        if (user) {
            logService.trackPageView(user, 'SLA_MONITOR', 'SLA Monitor');
        }
    }, [user]);

    const currentRole = user?.role || 'Approver';
    const currentUserId = user?.id || '';

    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    // Mobile: kanban columns collapse to headers by default; tap header to expand (mockup S7 "แถวพับได้")
    const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());
    const toggleCol = (key: string) => setExpandedCols((prev) => {
        const n = new Set(prev);
        if (n.has(key)) { n.delete(key); } else { n.add(key); }
        return n;
    });
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [closingWorkOrder, setClosingWorkOrder] = useState<any | null>(null);
    const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
    const [assigningTask, setAssigningTask] = useState<{ task: any; woId: string } | null>(null);
    const [historyTask, setHistoryTask] = useState<any | null>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewTaskInfo, setReviewTaskInfo] = useState<{ task: any; wo: any } | null>(null);
    const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('');
    const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

    useEffect(() => {
        if (historyTask) {
            const reports = historyTask.dailyreports || historyTask.history || [];
            if (reports.length > 0) {
                const sorted = [...reports].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setSelectedHistoryDate(sorted[0].date);
                setCalendarMonth(new Date(sorted[0].date));
            } else {
                const todayStr = new Date().toISOString().split('T')[0];
                setSelectedHistoryDate(todayStr);
                setCalendarMonth(new Date());
            }
        }
    }, [historyTask]);

    const getThaiStatusBadge = (t: any) => {
        // task.status is now the single source of truth — badge maps it directly (no progress/QR inference)
        const badge = (color: string, bg: string, label: string) =>
            <span style={{ color, background: bg, padding: '2px 8px', borderRadius: '6px', fontWeight: 900, fontSize: '0.7rem' }}>{label}</span>;
        switch (t.status) {
            case 'Draft':            return badge('#64748b', '#f1f5f9', 'ร่าง');
            case 'Evaluating':       return badge('#ef4444', '#fee2e2', 'รอประเมิน');
            case 'Assigned':         return badge('#3b82f6', '#dbeafe', 'มอบหมายแล้ว');
            case 'In Progress':      return badge('#7c3aed', '#f5f3ff', 'กำลังทำ');
            case 'For Checking':     return badge('#0891b2', '#cffafe', 'งานเสร็จ · รอออก QR');
            case 'pending_delivery': return badge('#d97706', '#fef3c7', 'รอลูกค้าประเมิน');
            case 'Complete':         return badge('#059669', '#d1fae5', 'สำเร็จ');
            case 'Rejected':         return badge('#b91c1c', '#fee2e2', 'รอมอบหมายใหม่');
            case 'Cancelled':        return badge('#64748b', '#f1f5f9', 'ยกเลิก');
        }
        return badge('#64748b', '#f1f5f9', t.status || '-');
    };

    const [selectedEvalWO, setSelectedEvalWO] = useState<any | null>(null);
    const [currentEvalTask, setCurrentEvalTask] = useState<any | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
    const [taskDecisions, setTaskDecisions] = useState<Record<string, 'Assigned' | 'Rejected'>>({});

    useEffect(() => {
        if (selectedEvalWO) {
            const updatedWo = workOrders.find((w) => w.id === selectedEvalWO.id);
            if (updatedWo) {
                setSelectedEvalWO(updatedWo);
                const decisions: Record<string, 'Assigned' | 'Rejected'> = {};
                updatedWo.categories.flatMap((c: any) => c.tasks).forEach((t: any) => {
                    if (t.status === 'Assigned' || t.status === 'Rejected') {
                        decisions[t.id] = t.status;
                    }
                });
                setTaskDecisions(decisions);
            }
        }
    }, [workOrders, selectedEvalWO?.id]);

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
    const [viewMode, setViewMode] = useState<'afterSale' | 'preHandover'>('afterSale');

    useEffect(() => {
        const taskIdFromUrl = searchParams.get('taskId');
        const woIdFromUrl = searchParams.get('woId');

        if (taskIdFromUrl) {
            setExpandedTaskIds(new Set([taskIdFromUrl]));
        }

        if (woIdFromUrl) {
            setSearchTerm(woIdFromUrl);
        }
    }, [searchParams]);

    const toggleTaskExpansion = (taskId: string) => {
        const newSet = new Set(expandedTaskIds);
        if (newSet.has(taskId)) newSet.delete(taskId);
        else newSet.add(taskId);
        setExpandedTaskIds(newSet);
    };

    const handleTaskReviewClick = (task: any) => {
        setCurrentEvalTask(task);
        setIsEvalModalOpen(true);
    };

    const handleModalConfirm = async (updates: Partial<any>) => {
        if (!currentEvalTask || !selectedEvalWO) return;

        const status = updates.status as 'Assigned' | 'Rejected';
        setTaskDecisions((prev) => ({ ...prev, [currentEvalTask.id]: status }));

        const updatedCategories = selectedEvalWO.categories.map((cat: any) => ({
            ...cat,
            tasks: cat.tasks.map((t: any) => t.id === currentEvalTask.id ? { ...t, ...updates } : t)
        }));

        const allTasks = updatedCategories.flatMap((c: any) => c.tasks);
        // WO status is computed from tasks — single source of truth
        const finalWoStatus = deriveWoStatus(allTasks);
        const pendingCount = allTasks.filter((t: any) => t.status === 'Evaluating').length;

        try {
            await saveEvaluation(selectedEvalWO.id, finalWoStatus, updatedCategories);

            if (pendingCount === 0) {
                setIsDetailModalOpen(false);
                setSelectedEvalWO(null);
                setTaskDecisions({});
            }
        } catch (err) {
            console.error('Failed to save task evaluation:', err);
            await showAlert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
        }

        setIsEvalModalOpen(false);
    };

    // T-347: job-level (per ใบงาน) — every subtask in the same WO shares the WO's SLA status
    // via the central computeJobSLA helper (max-SLA-among-subtasks, 7-day fixed warning window).
    // Per-task terminal states (done/rejected) stay per-subtask — those describe the subtask itself.
    const getSLARemaining = (task: any, wo: any) => {
        // A draft-only 100% (progressStatus: 'draft') is not really done — don't
        // label it finished until the foreman submits for real (user-confirmed
        // 2026-07-24).
        if (task.dailyProgress === 100 && task.progressStatus !== 'draft') {
            return { text: 'เสร็จสิ้นแล้ว', isCritical: false, isWarning: false, isDone: true, diffMs: 0 };
        }

        if (task.status === 'Rejected') {
            return { text: 'ถูกปฏิเสธ', isCritical: false, isWarning: false, isRejected: true, diffMs: 0 };
        }

        const sla = computeJobSLA(wo);
        if (!sla.isEligible || sla.deadlineMs === null) {
            return { text: '—', isCritical: false, isWarning: false, diffMs: 0 };
        }
        const diffMs = sla.deadlineMs - Date.now();

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
        return { text, isCritical: false, isWarning: sla.status === 'critical', diffMs };
    };

    const handleInitiateClose = (taskId: string, woId: string) => {
        const wo = workOrders.find((w) => w.id === woId);
        if (wo) {
            const task = wo.categories.flatMap((c: any) => c.tasks).find((t: any) => t.id === taskId);
            if (task) {
                setReviewTaskInfo({ task, wo });
                setIsReviewModalOpen(true);
            }
        }
    };

    const handleInitiateAssign = (taskId: string, woId: string) => {
        const wo = workOrders.find((w) => w.id === woId);
        if (wo) {
            const task = wo.categories.flatMap((c: any) => c.tasks).find((t: any) => t.id === taskId);
            if (task) setAssigningTask({ task, woId });
        }
    };

    const handleAssignTask = async (woId: string, taskId: string, updates: Partial<any>) => {
        const wo = workOrders.find((w) => w.id === woId);
        const category = wo?.categories?.find((c: any) => c.tasks.some((t: any) => t.id === taskId));
        if (category) {
            await updateTask(woId, category.id, taskId, updates);
        }
    };

    const handleConfirmClose = async (id: string) => {
        if (verifyingTaskId) {
            const wo = workOrders.find((w) => w.id === id);
            const category = wo?.categories?.find((c: any) => c.tasks.some((t: any) => t.id === verifyingTaskId));
            if (category) {
                await updateTask(id, category.id, verifyingTaskId, { status: 'Complete' });
            }
        } else {
            await updateWorkOrderStatus(id, 'Complete');
        }
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

    const flattenedTasks = useMemo(() => {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let filteredWOs = workOrders.filter((wo) => {
            if ((wo as any).type === 'PreHandover') return false;
            if (wo.status === 'Draft' || wo.isArchived) return false;
            if (wo.status === 'Complete') {
                const completedDate = (wo as any).updatedAt || wo.createdAt || '';
                if (!completedDate) return false;
                const d = new Date(completedDate);
                const woYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return woYM === currentYM;
            }
            return true;
        });

        if (currentRole === 'Admin') {
            filteredWOs = filteredWOs.filter((wo) => (wo.id || '').toUpperCase().includes('WOA'));
        }

        if (currentRole === 'Foreman') {
            filteredWOs = filteredWOs.filter((wo) => {
                const matchesUser = (id: string) => id === currentUserId || (user?.employeeId && id === user.employeeId);
                const isReporter = matchesUser(wo.reporterId || '');
                const isResponsible = wo.categories.some((c: any) => c.tasks.some((t: any) => t.responsibleStaffIds?.some((id: string) => matchesUser(id))));
                return isReporter || isResponsible;
            });
        }

        const allTasks = filteredWOs.flatMap((wo) => {
            return (wo.categories || []).flatMap((cat: any) =>
                (cat.tasks || []).map((t: any) => {
                    const sla = getSLARemaining(t, wo);
                    let score = 2;
                    let slaType: 'overdue' | 'warning' | 'normal' | 'completed' = 'normal';

                    if (t.dailyProgress === 100 && t.progressStatus !== 'draft') { score = 1; slaType = 'completed'; }
                    else if (sla.isCritical) { score = 4; slaType = 'overdue'; }
                    else if (sla.isWarning) { score = 3; slaType = 'warning'; }

                    const taskCode = t.taskCode || t.id;

                    return {
                        ...t,
                        taskCode,
                        woId: wo.id,
                        woProjectId: wo.projectId,
                        woLocation: wo.locationName,
                        woCreatedAt: wo.createdAt,
                         woAppointmentDate: wo.appointmentDate,
                        woDeliveryQrToken: wo.deliveryQrToken,
                        taskStartDate: t.startDate,
                        categoryName: cat.name,
                        slaScore: score,
                        slaType,
                        diffMs: sla.diffMs
                    };
                })
            );
        });

        const filtered = allTasks.filter((task) => {
            // Rejected tasks (awaiting admin reassignment) must stay visible in งานรอประเมิน
            const matchesSearch = (task.taskCode || task.woId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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

        return filtered.sort((a, b) => {
            if (sortBy === 'urgency') {
                if (a.slaScore !== b.slaScore) {
                    return sortOrder === 'asc' ? a.slaScore - b.slaScore : b.slaScore - a.slaScore;
                }
                return a.diffMs - b.diffMs;
            } else {
                const valA = new Date(a.woCreatedAt).getTime();
                const valB = new Date(b.woCreatedAt).getTime();
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
        });
    }, [workOrders, searchTerm, selectedProjectId, selectedStaffId, activeSlaFilter, startDate, endDate, currentRole, currentUserId, sortBy, sortOrder]);

    const phWorkOrders = useMemo(() => {
        return workOrders
            .filter(wo => (wo as any).type === 'PreHandover' && !wo.isArchived)
            .filter(wo => {
                if (!searchTerm) return true;
                const s = searchTerm.toLowerCase();
                return (wo.id || '').toLowerCase().includes(s) ||
                       (wo.location || '').toLowerCase().includes(s) ||
                       ((wo as any).address || '').toLowerCase().includes(s);
            })
            .filter(wo => !selectedProjectId || wo.projectId === selectedProjectId);
    }, [workOrders, searchTerm, selectedProjectId]);

    // Base WOA membership: the work orders that feed the WOA board, BEFORE any
    // staff/project/search/date/sla filter. Single source reused by activeStaffIds
    // + activeProjects so the predicate can't drift between them.
    const visibleWoaWos = useMemo(() => {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let base = workOrders.filter((wo) => {
            if ((wo as any).type === 'PreHandover') return false;
            if (wo.status === 'Draft' || wo.isArchived) return false;
            if (wo.status === 'Complete') {
                const completedDate = (wo as any).updatedAt || wo.createdAt || '';
                if (!completedDate) return false;
                const d = new Date(completedDate);
                const woYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return woYM === currentYM;
            }
            return true;
        });
        if (currentRole === 'Admin') base = base.filter((wo) => (wo.id || '').toUpperCase().includes('WOA'));
        if (currentRole === 'Foreman') {
            base = base.filter((wo) => {
                const matchesUser = (id: string) => id === currentUserId || (!!user?.employeeId && id === user.employeeId);
                const isReporter = matchesUser(wo.reporterId || '');
                const isResponsible = wo.categories.some((c: any) => c.tasks.some((t: any) => t.responsibleStaffIds?.some((id: string) => matchesUser(id))));
                return isReporter || isResponsible;
            });
        }
        return base;
    }, [workOrders, currentRole, currentUserId, user]);

    const activeStaffIds = useMemo(() => {
        const ids = new Set<string>();
        if (viewMode === 'preHandover') {
            // WOP: foreman is category.assignedForemanId — resolve to staff.id (line 915 rule).
            phWorkOrders.forEach((wo: any) => {
                (wo.categories || []).forEach((cat: any) => {
                    const fid = cat.assignedForemanId;
                    if (!fid) return;
                    const s = staff.find((st) => st.id === fid || st.employeeId === fid);
                    if (s) ids.add(s.id);
                });
            });
        } else {
            // WOA: from the shared base (NOT the staff-filtered list — that made this
            // circular). Narrow by the selected project so the staff list tracks it.
            let base = visibleWoaWos;
            if (selectedProjectId) base = base.filter((wo) => wo.projectId === selectedProjectId);
            base.forEach((wo) => {
                (wo.categories || []).forEach((cat: any) => {
                    (cat.tasks || []).forEach((t: any) => {
                        (t.responsibleStaffIds || []).forEach((id: string) => ids.add(id));
                    });
                });
            });
        }
        return ids;
    }, [viewMode, visibleWoaWos, phWorkOrders, staff, selectedProjectId]);

    const activeProjects = useMemo(() => {
        // View-aware + non-circular: derive from the tab's source WOs, NOT from a
        // project-filtered list (phWorkOrders already applies the project filter).
        const ids = viewMode === 'preHandover'
            ? new Set(workOrders.filter((wo) => (wo as any).type === 'PreHandover' && !wo.isArchived).map((wo) => wo.projectId))
            : new Set(visibleWoaWos.map((wo) => wo.projectId));
        return projects.filter((p) => ids.has(p.id));
    }, [projects, viewMode, visibleWoaWos, workOrders]);

    // Map a WOP work order's job-level SLA to the 4 filter buckets used by the
    // "สถานะ SLA" dropdown (same buckets as WOA). null = not gradeable → hidden when a filter is on.
    const wopSlaBucket = (wo: any): 'overdue' | 'warning' | 'normal' | 'completed' | null => {
        const j = computeJobSLA(wo);
        if (!j.isEligible) return null;
        if (j.phase === 'done') return 'completed';
        if (j.status === 'overdue') return 'overdue';
        if (j.status === 'critical') return 'warning';
        if (j.status === 'normal') return 'normal';
        return null;
    };

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
            {zoomImage && (
                <div
                    onClick={() => setZoomImage(null)}
                    style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'zoom-out' }}
                >
                    <img loading="lazy" src={zoomImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isMobile ? '1.5rem' : '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.75rem' : '1.25rem' }}>
                    <div style={{ background: '#0f172a', padding: isMobile ? '10px' : '14px', borderRadius: isMobile ? '14px' : '18px', color: 'white', boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.2)' }}>
                        <LayoutDashboard size={isMobile ? 22 : 28} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: scaleFont(isMobile, '1.8rem'), fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em' }}>ติดตามสถานะงาน (Real-time Tracking)</h1>
                        <span style={{ color: '#64748b', fontSize: scaleFont(isMobile, '0.95rem'), marginTop: '4px', display: 'block', fontWeight: 500 }}>มอนิเตอร์ความคืบหน้าและประเมินผลงานตาม SLA</span>
                    </div>
                </div>
            </div>

            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '1.25rem', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, 'minmax(200px, 1.2fr) 0.8fr 1fr 1fr 1fr 1fr auto', 'minmax(0, 1fr) minmax(0, 1fr)'), gap: '0.8rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', gridColumn: isMobile ? '1 / -1' : undefined }}>
                        <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                        <input type="text" placeholder="ค้นหาเลขที่งาน หรือ บ้านเลขที่..." style={{ ...commonInputStyle, paddingLeft: '44px', width: '100%', boxSizing: 'border-box' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <select style={commonInputStyle} value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                        <option value="">ทุกโครงการ</option>
                        {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    <DateRangePicker startDate={startDate || ''} endDate={endDate || ''} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />

                    <select style={commonInputStyle} value={activeSlaFilter || ''} onChange={(e) => setActiveSlaFilter(e.target.value as any || null)}>
                        <option value="">สถานะ SLA ทั้งหมด</option>
                        <option value="overdue">🔴 เกินกำหนด</option>
                        <option value="warning">🟡 ใกล้ถึง SLA (≤7วัน)</option>
                        <option value="normal">🔵 ปกติ (&gt;7วัน)</option>
                        <option value="completed">🟢 เสร็จสิ้น</option>
                    </select>

                    {currentRole !== 'Foreman' ? (
                        <select style={commonInputStyle} value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
                            <option value="">เจ้าหน้าที่ทั้งหมด</option>
                            {staff.filter((s) => activeStaffIds.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    ) : <div />}

                    <div style={{ display: isMobile ? 'flex' : 'contents', gap: '8px', alignItems: 'center', gridColumn: isMobile ? '1 / -1' : undefined }}>
                    <div style={{ display: 'flex', background: '#f8fafc', padding: '4px', borderRadius: '14px', border: '1px solid #e2e8f0', flex: isMobile ? 1 : undefined, minWidth: isMobile ? 0 : undefined }}>
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

                    <button onClick={clearFilters} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#64748b', fontWeight: 600, flexShrink: isMobile ? 0 : undefined, whiteSpace: isMobile ? 'nowrap' : undefined }}>
                        <RotateCw size={16} /> ล้าง
                    </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', background: '#fff', padding: '10px 16px', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', marginRight: '4px' }}>แสดง:</span>
                <button
                    onClick={() => { setViewMode('afterSale'); setSelectedStaffId(currentRole === 'Foreman' ? currentUserId : ''); }}
                    style={{ padding: '8px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: viewMode === 'afterSale' ? '#0f172a' : '#f1f5f9', color: viewMode === 'afterSale' ? '#fff' : '#64748b', fontWeight: 800, fontSize: '0.85rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: isMobile ? 1 : undefined }}
                >
                    🔧 งานหลังขาย
                    <span style={{ background: viewMode === 'afterSale' ? 'rgba(255,255,255,0.2)' : '#e2e8f0', color: viewMode === 'afterSale' ? '#fff' : '#64748b', fontSize: '0.7rem', fontWeight: 900, padding: '1px 7px', borderRadius: '100px' }}>{flattenedTasks.length}</span>
                </button>
                <button
                    onClick={() => { setViewMode('preHandover'); setSelectedStaffId(currentRole === 'Foreman' ? currentUserId : ''); }}
                    style={{ padding: '8px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: viewMode === 'preHandover' ? '#0d9488' : '#f1f5f9', color: viewMode === 'preHandover' ? '#fff' : '#64748b', fontWeight: 800, fontSize: '0.85rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: isMobile ? 1 : undefined }}
                >
                    🏗️ ตรวจรับก่อนโอน
                    <span style={{ background: viewMode === 'preHandover' ? 'rgba(255,255,255,0.2)' : '#e2e8f0', color: viewMode === 'preHandover' ? '#fff' : '#64748b', fontSize: '0.7rem', fontWeight: 900, padding: '1px 7px', borderRadius: '100px' }}>{phWorkOrders.reduce((acc: number, wo: any) => acc + (wo.categories?.length || 0), 0)}</span>
                </button>
            </div>

            <div style={{ display: viewMode === 'afterSale' ? 'flex' : 'none', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '24px', overflowX: isMobile ? 'visible' : 'auto', paddingBottom: '16px' }}>
                {[
                    { id: 'pending-eval', label: 'งานรอประเมิน', color: '#ef4444' },
                    { id: 'assigned-unstarted', label: 'มอบหมายแล้วยังไม่ทำ', color: '#3b82f6' },
                    { id: 'in-progress', label: 'กำลังทำ', color: '#7c3aed' },
                    { id: 'for-checking', label: 'งานเสร็จ · รอออก QR', color: '#0891b2' },
                    { id: 'pending-delivery', label: 'รอลูกค้าประเมิน', color: '#d97706' },
                    { id: 'completed', label: 'สำเร็จ', color: '#059669' },
                ].map((column) => {
                    const columnTasks = flattenedTasks.filter((t) => {
                        // columns key directly off task.status — the single source of truth
                        if (column.id === 'pending-eval') return t.status === 'Evaluating' || (t.status === 'Rejected' && t.taskArchived !== true);
                        if (column.id === 'assigned-unstarted') return t.status === 'Assigned';
                        if (column.id === 'in-progress') return t.status === 'In Progress';
                        if (column.id === 'for-checking') return t.status === 'For Checking';
                        if (column.id === 'pending-delivery') return t.status === 'pending_delivery';
                        if (column.id === 'completed') return t.status === 'Complete';
                        return false;
                    });

                    const displayTasks = column.id === 'completed'
                        ? [...columnTasks].sort((a, b) => {
                            const dateA = new Date((a as any).updatedAt || a.woCreatedAt || 0).getTime();
                            const dateB = new Date((b as any).updatedAt || b.woCreatedAt || 0).getTime();
                            return dateB - dateA;
                        })
                        : columnTasks;

                    const colKey = `as:${column.id}`;
                    const colCollapsed = isMobile && !expandedCols.has(colKey);
                    return (
                        <div key={column.id} style={{ minWidth: isMobile ? 0 : 340, width: isMobile ? '100%' : 340, background: '#f4f6f8', borderRadius: isMobile ? '18px' : '24px', padding: isMobile ? '14px' : '20px', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}>
                            <div onClick={isMobile ? () => toggleCol(colKey) : undefined} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: colCollapsed ? 0 : '20px', cursor: isMobile ? 'pointer' : 'default' }}>
                                <div style={{ width: 6, height: 20, background: column.color, borderRadius: 4 }} />
                                <div style={{ fontSize: scaleFont(isMobile, '1.1rem'), fontWeight: 900, color: '#1c1e2b' }}>{column.label}</div>
                                <div style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.8rem', fontWeight: 900, padding: '2px 10px', borderRadius: '12px', marginLeft: 'auto' }}>{columnTasks.length}</div>
                                {isMobile && <ChevronDown size={18} style={{ color: '#94a3b8', transition: 'transform 0.2s', transform: colCollapsed ? 'none' : 'rotate(180deg)' }} />}
                            </div>
                            <div style={{ display: colCollapsed ? 'none' : 'flex', flexDirection: 'column', gap: '16px', minHeight: isMobile ? 'auto' : 200 }}>
                                {displayTasks.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 700, padding: '32px 0', border: '2px dashed #e2e8f0', borderRadius: '16px' }}>No Tasks</div>
                                ) : (
                                    displayTasks.map((task) => {
                                        const project = projects.find((p) => p.id === task.woProjectId);
                                        const sla = getSLARemaining(task, task.woCreatedAt);
                                        const isExpanded = expandedTaskIds.has(task.id);

                                        const assignedStaff = staff.find((s) => task.responsibleStaffIds?.includes(s.id));
                                        const assignedContractor = contractors.find((c) => task.responsibleStaffIds?.includes(c.id));
                                        const assignedName = assignedStaff?.name || assignedContractor?.name || 'ยังไม่มอบหมาย';
                                        const assignedPhone = assignedStaff?.phone || assignedContractor?.phone || '-';
                                        const assignedRole = assignedStaff ? 'Staff' : (assignedContractor ? 'Contractor' : '-');

                                        const parentWO = workOrders.find((w) => w.id === task.woId);
                                        const allTasksInWO = parentWO ? parentWO.categories.flatMap((c: any) => c.tasks) : [];
                                        const totalSisterTasksCount = allTasksInWO.length;
                                        const pendingSisterCount = allTasksInWO.filter((t: any) => t.status === 'Evaluating').length;
                                        const evaluatedSisterCount = allTasksInWO.filter((t: any) => t.status !== 'Evaluating' && t.status !== 'Rejected').length;
                                        const rejectedSisterCount = allTasksInWO.filter((t: any) => t.status === 'Rejected').length;

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
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '8px' }}>{task.taskCode || task.woId}</div>
                                                    {task.currentRevision && task.currentRevision !== 'rev00' && (
                                                        <div
                                                            style={{
                                                                fontSize: '0.7rem',
                                                                fontWeight: 900,
                                                                color: '#e11d48',
                                                                background: '#fff1f2',
                                                                padding: '2px 8px',
                                                                borderRadius: '8px',
                                                                border: '1px solid #fecdd3',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                cursor: 'help'
                                                            }}
                                                            title={`เหตุผลที่ตีกลับ: ${task.revisionName || 'ไม่ระบุสาเหตุ'}`}
                                                        >
                                                            <span style={{ display: 'inline-block', width: 6, height: 6, background: '#e11d48', borderRadius: '50%' }} />
                                                            {task.currentRevision.toUpperCase().replace('REV', 'REV. ')}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: column.color, background: `${column.color}15`, padding: '2px 8px', borderRadius: '8px' }}>{task.dailyProgress}%</div>
                                                </div>
                                                {(() => {
                                                    const draft = taskDrafts?.get(task.id);
                                                    if (!draft) return null;
                                                    return (
                                                        <div
                                                            title={draft.note || undefined}
                                                            style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '3px 8px', marginBottom: '6px', display: 'inline-block' }}
                                                        >
                                                            📝 แบบร่าง {draft.progress}% (ยังไม่ส่ง)
                                                        </div>
                                                    );
                                                })()}
                                                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#1e293b', marginBottom: '6px', lineHeight: 1.3 }}>{task.name}</div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Building2 size={12} /> {project?.name} - {task.woLocation}
                                                </div>
                                                {task.currentRevision && task.currentRevision !== 'rev00' && task.status === 'Rejected' && (
                                                    <div style={{
                                                        background: '#fff1f2',
                                                        border: '1px solid #ffe4e6',
                                                        borderRadius: '12px',
                                                        padding: '10px 12px',
                                                        marginBottom: '12px',
                                                        fontSize: '0.78rem',
                                                        color: '#be123c',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '4px'
                                                    }}>
                                                        <div style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ display: 'inline-block', width: 6, height: 6, background: '#e11d48', borderRadius: '50%' }} />
                                                            ประวัติตีกลับ ({task.currentRevision.toUpperCase().replace('REV', 'REV. ')}):
                                                        </div>
                                                        <div style={{ fontWeight: 700, color: '#4c0519', paddingLeft: '10px' }}>
                                                            {task.revisionName || 'ไม่ระบุเหตุผลการตีกลับ'}
                                                        </div>
                                                    </div>
                                                )}

                                                {totalSisterTasksCount > 1 && (
                                                    <div style={{
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 800,
                                                        color: '#4f46e5',
                                                        background: '#4f46e50c',
                                                        padding: '4px 10px',
                                                        borderRadius: '8px',
                                                        marginBottom: '12px',
                                                        border: '1px solid #4f46e51c',
                                                        width: 'fit-content'
                                                    }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#312e81' }}><FileText size={11} /> ใบงานเดียวกัน ({totalSisterTasksCount}):</span>
                                                        {pendingSisterCount > 0 && <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>🔴 รอประเมิน {pendingSisterCount}</span>}
                                                        {pendingSisterCount > 0 && (evaluatedSisterCount > 0 || rejectedSisterCount > 0) && <span style={{ color: '#c7d2fe' }}>·</span>}
                                                        {evaluatedSisterCount > 0 && <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '2px' }}>🔵 ประเมินแล้ว {evaluatedSisterCount}</span>}
                                                        {evaluatedSisterCount > 0 && rejectedSisterCount > 0 && <span style={{ color: '#c7d2fe' }}>·</span>}
                                                        {rejectedSisterCount > 0 && <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>⚫ ปฏิเสธ {rejectedSisterCount}</span>}
                                                    </div>
                                                )}

                                                {task.beforePhotoUrl && (
                                                    <div style={{ width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px', border: '1px solid #f1f5f9' }}>
                                                        <img src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                )}

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
                                                            <span style={{ fontWeight: 800, color: '#94a3b8' }}>วันเริ่มงาน:</span> <span style={{ fontWeight: 900, color: '#1e293b' }}>{task.startDate ? formatDate(task.startDate) : '-'}</span>
                                                        </div>

                                                        {totalSisterTasksCount > 0 && (
                                                            <div style={{ marginTop: '4px', background: 'rgba(248, 250, 252, 0.8)', backdropFilter: 'blur(8px)', borderRadius: '14px', border: '1px solid rgba(226, 232, 240, 0.8)', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)' }}>
                                                                <div style={{ padding: '8px 12px', background: 'linear-gradient(90deg, rgba(241, 245, 249, 0.8) 0%, rgba(226, 232, 240, 0.5) 100%)', borderBottom: '1px solid #e2e8f0', fontWeight: 900, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                                                                    <FileText size={13} style={{ color: '#4f46e5' }} />
                                                                    <span>รายการงานในใบงานเดียวกัน ({totalSisterTasksCount})</span>
                                                                </div>
                                                                <div style={{ overflowX: 'auto' }}>
                                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
                                                                        <thead>
                                                                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', background: 'rgba(248, 250, 252, 0.5)' }}>
                                                                                <th style={{ padding: '6px 10px', fontWeight: 800 }}>รหัสงาน</th>
                                                                                <th style={{ padding: '6px 10px', fontWeight: 800 }}>รายการ</th>
                                                                                <th style={{ padding: '6px 10px', fontWeight: 800, textAlign: 'center' }}>คืบหน้า</th>
                                                                                <th style={{ padding: '6px 10px', fontWeight: 800, textAlign: 'center' }}>สถานะ</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {allTasksInWO.map((t: any) => {
                                                                                const isCurrent = t.id === task.id;
                                                                                return (
                                                                                    <tr
                                                                                        key={t.id}
                                                                                        style={{
                                                                                            borderBottom: '1px solid #f1f5f9',
                                                                                            background: isCurrent ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                                                                                            fontWeight: isCurrent ? 900 : 500
                                                                                        }}
                                                                                    >
                                                                                        <td style={{ padding: '8px 10px', color: isCurrent ? '#4f46e5' : '#475569', whiteSpace: 'nowrap' }}>
                                                                                            {t.taskCode || t.id}
                                                                                            {isCurrent && <span style={{ color: '#4f46e5', marginLeft: '4px', fontSize: '0.62rem', fontWeight: 900 }}>(รายการนี้)</span>}
                                                                                        </td>
                                                                                        <td style={{ padding: '8px 10px', color: isCurrent ? '#1e293b' : '#64748b' }}>{t.name}</td>
                                                                                        <td style={{ padding: '8px 10px', color: '#1e293b', textAlign: 'center', fontWeight: 900 }}>{t.dailyProgress || 0}%</td>
                                                                                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{getThaiStatusBadge(t)}</td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {task.history && task.history.length > 0 && (
                                                            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                                                                <div style={{ fontWeight: 900, color: '#475569', marginBottom: '4px', fontSize: '0.75rem' }}>หมายเหตุล่าสุด:</div>
                                                                <div style={{ fontStyle: 'italic', color: '#64748b' }}>"{task.history[0].note || 'ไม่มีข้อความหมายเหตุ'}"</div>
                                                            </div>
                                                        )}

                                                        <button
                                                            onClick={() => setHistoryTask(task)}
                                                            style={{
                                                                width: '100%',
                                                                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                                                color: '#fff',
                                                                border: 'none',
                                                                padding: '10px 14px',
                                                                borderRadius: '12px',
                                                                fontWeight: 900,
                                                                cursor: 'pointer',
                                                                fontSize: '0.8rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '8px',
                                                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                                                transition: 'all 0.15s ease',
                                                                marginTop: '4px'
                                                            }}
                                                        >
                                                            <Calendar size={14} />
                                                            ดูประวัติและรายงานประจำวัน (LB Style)
                                                        </button>

                                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
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

                                                            {column.id === 'pending-delivery' && (
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
                                                                    ดู/ส่ง QR Code
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

            {viewMode === 'preHandover' && (
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '24px', overflowX: isMobile ? 'visible' : 'auto', paddingBottom: '16px' }}>
                    {[
                        { id: 'unassigned',       label: 'งานรอประเมิน',           color: '#ef4444', test: (cat: any, wo: any) => ((wo.status === 'customer_reject' && wo.pendingAdminReassign === true) || !cat.assignedForemanId) && !wo.isArchived && !((cat.tasks?.length ?? 0) > 0 && cat.tasks.every((t: any) => t.status === 'Cancelled' || (t.status === 'Rejected' && t.taskArchived === true))) },
                        { id: 'assigned-idle',    label: 'มอบหมายแล้วยังไม่ทำ',   color: '#3b82f6', test: (cat: any, wo: any) => !!cat.assignedForemanId && (cat.dailyProgress || 0) === 0 && !wo.isArchived && !(wo.status === 'customer_reject' && wo.pendingAdminReassign === true) },
                        // A draft-only 100% (progressStatus: 'draft') still counts as "in
                        // progress" here, not "waiting for customer" — matches the same
                        // rule as the WOA board's done-pending-qr test below
                        // (user-confirmed 2026-07-24).
                        { id: 'in-progress',      label: 'กำลังทำ',                color: '#7c3aed', test: (cat: any, wo: any) => (cat.dailyProgress || 0) > 0 && ((cat.dailyProgress || 0) < 100 || cat.progressStatus === 'draft') && !wo.isArchived && !(wo.status === 'customer_reject' && wo.pendingAdminReassign === true) },
                        { id: 'done-pending-qr',  label: 'รอลูกค้าประเมิน',        color: '#d97706', test: (cat: any, wo: any) => (cat.dailyProgress || 0) >= 100 && cat.progressStatus !== 'draft' && !wo.isArchived && !(wo.status === 'customer_reject' && wo.pendingAdminReassign === true) },
                        { id: 'completed',        label: 'สำเร็จ',                 color: '#059669', test: (_cat: any, wo: any) => !!wo.isArchived },
                    ].map((col) => {
                        const items = phWorkOrders
                            .filter((wo: any) => !activeSlaFilter || wopSlaBucket(wo) === activeSlaFilter)
                            .flatMap((wo: any) =>
                            (wo.categories || [])
                                .filter((cat: any) => col.test(cat, wo))
                                .filter((cat: any) => {
                                    if (!selectedStaffId) return true;
                                    const s = staff.find((st: any) => st.id === selectedStaffId);
                                    if (!s) return false;
                                    return cat.assignedForemanId === s.id || cat.assignedForemanId === s.employeeId;
                                })
                                .map((cat: any) => ({ ...cat, _wo: wo }))
                        );
                        const colKey = `ph:${col.id}`;
                        const colCollapsed = isMobile && !expandedCols.has(colKey);
                        return (
                            <div key={col.id} style={{ minWidth: isMobile ? 0 : 340, width: isMobile ? '100%' : 340, background: '#f4f6f8', borderRadius: isMobile ? '18px' : '24px', padding: isMobile ? '14px' : '20px', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}>
                                <div onClick={isMobile ? () => toggleCol(colKey) : undefined} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: colCollapsed ? 0 : '20px', cursor: isMobile ? 'pointer' : 'default' }}>
                                    <div style={{ width: 6, height: 20, background: col.color, borderRadius: 4 }} />
                                    <div style={{ fontSize: scaleFont(isMobile, '1.1rem'), fontWeight: 900, color: '#1c1e2b' }}>{col.label}</div>
                                    <div style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.8rem', fontWeight: 900, padding: '2px 10px', borderRadius: '12px', marginLeft: 'auto' }}>{items.length}</div>
                                    {isMobile && <ChevronDown size={18} style={{ color: '#94a3b8', transition: 'transform 0.2s', transform: colCollapsed ? 'none' : 'rotate(180deg)' }} />}
                                </div>
                                <div style={{ display: colCollapsed ? 'none' : 'flex', flexDirection: 'column', gap: '16px', minHeight: isMobile ? 'auto' : 200 }}>
                                    {items.length === 0 ? (
                                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 700, padding: '32px 0', border: '2px dashed #e2e8f0', borderRadius: '16px' }}>No Tasks</div>
                                    ) : items.map((item: any) => {
                                        const phKey = `ph-${item._wo.id}-${item.id}`;
                                        const isExpanded = expandedTaskIds.has(phKey);
                                        const foremanEntry = staff.find((s: any) => s.id === item.assignedForemanId || s.employeeId === item.assignedForemanId);
                                        const foremanName = foremanEntry?.name || 'ยังไม่มอบหมาย';
                                        const foremanPhone = foremanEntry?.phone || '-';
                                        const foremanRole = foremanEntry ? 'Foreman' : '-';
                                        const progress = item.dailyProgress || 0;
                                        const project = projects.find((p: any) => p.id === item._wo.projectId);
                                        const defectCount = item.defectCount || 0;
                                        const allCatsInWO: any[] = item._wo.categories || [];
                                        const totalDefectsInWO = allCatsInWO.reduce((sum: number, c: any) => sum + (c.defectCount || 0), 0);
                                        // T-346: job-level SLA via the central helper — anchors on
                                        // wo.scheduledDate@08:00 (วันนัด) + wo.phActualSla, no Date.now / 720 fallback.
                                        const _jobSla = computeJobSLA(item._wo);
                                        const daysLeft = _jobSla.deadlineMs !== null ? Math.ceil((_jobSla.deadlineMs - Date.now()) / 86400000) : 0;
                                        const slaText = _jobSla.phase === 'done'
                                            ? 'เสร็จสิ้น'
                                            : !_jobSla.isEligible ? '—'
                                            : daysLeft < 0 ? `เกินกำหนด ${Math.abs(daysLeft)} วัน` : daysLeft === 0 ? 'ครบกำหนดวันนี้' : `เหลือ ${daysLeft} วัน`;
                                        const slaIsCritical = _jobSla.status === 'overdue';
                                        const slaIsNearDue = _jobSla.status === 'critical';
                                        return (
                                            <div
                                                key={phKey}
                                                style={{
                                                    background: '#fff', borderRadius: '16px', padding: '16px',
                                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                                    cursor: 'pointer',
                                                    border: isExpanded ? '2px solid #0d9488' : '1px solid #f1f5f9',
                                                    transition: 'all 0.2s', textAlign: 'left',
                                                }}
                                                onClick={() => toggleTaskExpansion(phKey)}
                                            >
                                                {/* row 1: WO ID + defect badge + progress% — same layout as WOA */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '8px' }}>{item._wo.id}</div>
                                                    {defectCount > 0 && (
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '8px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            ⚠️ {defectCount} จุด
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: col.color, background: `${col.color}15`, padding: '2px 8px', borderRadius: '8px' }}>{progress}%</div>
                                                </div>

                                                {(() => {
                                                    // PreHandover's "task" doc id is always == its category id (see
                                                    // WorkOrderContext.tsx: `const taskId = a.catId`), so taskDrafts
                                                    // keys the same way here as it does for a WOA task.
                                                    const draft = taskDrafts?.get(item.id);
                                                    if (!draft) return null;
                                                    return (
                                                        <div
                                                            title={draft.note || undefined}
                                                            style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '3px 8px', marginBottom: '6px', display: 'inline-block' }}
                                                        >
                                                            📝 แบบร่าง {draft.progress}% (ยังไม่ส่ง)
                                                        </div>
                                                    );
                                                })()}

                                                {/* Category name */}
                                                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#1e293b', marginBottom: '6px', lineHeight: 1.3 }}>{item.name || item.catName || item.id}</div>

                                                {/* Project + location */}
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Building2 size={12} /> {project?.name || '—'}{item._wo.locationName ? ` - ${item._wo.locationName}` : ''}
                                                </div>

                                                {/* Rejected by customer block */}
                                                {item.customerStatus === 'rejected' && item.customerRejectReason && (
                                                    <div style={{ background: '#fff1f2', border: '1px solid #ffe4e6', borderRadius: '12px', padding: '10px 12px', marginBottom: '12px', fontSize: '0.78rem', color: '#be123c', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <div style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ display: 'inline-block', width: 6, height: 6, background: '#e11d48', borderRadius: '50%' }} />
                                                            ลูกค้าปฏิเสธ:
                                                        </div>
                                                        <div style={{ fontWeight: 700, color: '#4c0519', paddingLeft: '10px' }}>{item.customerRejectReason}</div>
                                                    </div>
                                                )}

                                                {/* Categories in same WO — replaces "sister tasks" */}
                                                {allCatsInWO.length > 1 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: '#0d9488', background: '#f0fdfa0c', padding: '4px 10px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #99f6e41c', width: 'fit-content' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0f766e' }}><FileText size={11} /> หมวดงานในใบงาน ({allCatsInWO.length}):</span>
                                                        {totalDefectsInWO > 0 && <span style={{ color: '#dc2626' }}>⚠️ รวม {totalDefectsInWO} จุด</span>}
                                                    </div>
                                                )}

                                                {/* Expand panel — identical to WOA */}
                                                {isExpanded && (
                                                    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', color: '#475569' }}>
                                                        <div><span style={{ fontWeight: 800, color: '#94a3b8' }}>ผู้รับผิดชอบ:</span> <span style={{ fontWeight: 900, color: '#1e293b' }}>{foremanName} ({foremanRole})</span></div>
                                                        <div><span style={{ fontWeight: 800, color: '#94a3b8' }}>เบอร์ติดต่อ:</span> <span style={{ fontWeight: 900, color: '#1e293b' }}>{foremanPhone}</span></div>
                                                        <div><span style={{ fontWeight: 800, color: '#94a3b8' }}>วันเริ่มงาน:</span> <span style={{ fontWeight: 900, color: '#1e293b' }}>{item._wo.startDate ? formatDate(item._wo.startDate) : '-'}</span></div>

                                                        {/* Categories table — equivalent of sister tasks table */}
                                                        {allCatsInWO.length > 0 && (
                                                            <div style={{ marginTop: '4px', background: 'rgba(248, 250, 252, 0.8)', backdropFilter: 'blur(8px)', borderRadius: '14px', border: '1px solid rgba(226, 232, 240, 0.8)', overflow: 'hidden' }}>
                                                                <div style={{ padding: '8px 12px', background: 'linear-gradient(90deg, rgba(240, 253, 250, 0.8) 0%, rgba(204, 251, 241, 0.5) 100%)', borderBottom: '1px solid #e2e8f0', fontWeight: 900, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                                                                    <FileText size={13} style={{ color: '#0d9488' }} />
                                                                    <span>หมวดงานในใบงานเดียวกัน ({allCatsInWO.length})</span>
                                                                </div>
                                                                <div style={{ overflowX: 'auto' }}>
                                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
                                                                        <thead>
                                                                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', background: 'rgba(248, 250, 252, 0.5)' }}>
                                                                                <th style={{ padding: '6px 10px', fontWeight: 800 }}>หมวดงาน</th>
                                                                                <th style={{ padding: '6px 10px', fontWeight: 800, textAlign: 'center' }}>คืบหน้า</th>
                                                                                <th style={{ padding: '6px 10px', fontWeight: 800, textAlign: 'center' }}>ข้อบกพร่อง</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {allCatsInWO.map((c: any) => {
                                                                                const isCurrent = c.id === item.id;
                                                                                const catProgress = c.dailyProgress || 0;
                                                                                const catDefects = c.defectCount || 0;
                                                                                return (
                                                                                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: isCurrent ? 'rgba(13, 148, 136, 0.08)' : 'transparent', fontWeight: isCurrent ? 900 : 500 }}>
                                                                                        <td style={{ padding: '8px 10px', color: isCurrent ? '#0d9488' : '#475569' }}>
                                                                                            {c.name || c.catName || c.id}
                                                                                            {isCurrent && <span style={{ color: '#0d9488', marginLeft: '4px', fontSize: '0.62rem', fontWeight: 900 }}>(หมวดนี้)</span>}
                                                                                        </td>
                                                                                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, color: '#1e293b' }}>{catProgress}%</td>
                                                                                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, color: catDefects > 0 ? '#dc2626' : '#94a3b8' }}>
                                                                                            {catDefects > 0 ? `⚠️ ${catDefects}` : '—'}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {(currentRole === 'Admin' || currentRole === 'Manager') && (
                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                                <button
                                                                    onClick={() => handleInitiateAssign(item.id, item._wo.id)}
                                                                    style={{ flex: 1, background: '#fff', color: '#0d9488', border: '1.5px solid #0d9488', padding: '6px 12px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                                                >
                                                                    <RotateCw size={12} />
                                                                    {item.assignedForemanId ? 'เปลี่ยนโฟรแมน' : 'มอบหมาย'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Footer SLA — same as WOA */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: slaIsCritical ? '#ef4444' : slaIsNearDue ? '#d97706' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <AlertCircle size={12} /> {slaText}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>{isExpanded ? 'คลิกเพื่อยุบ' : 'คลิกเพื่อขยาย'}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {closingWorkOrder && <CloseJobModal isOpen={!!closingWorkOrder} workOrder={closingWorkOrder} targetTaskId={verifyingTaskId || undefined} onClose={() => { setClosingWorkOrder(null); setVerifyingTaskId(null); }} onConfirm={handleConfirmClose} />}
            {assigningTask && <AdminAssignModal isOpen={!!assigningTask} onClose={() => setAssigningTask(null)} task={assigningTask.task} workOrderId={assigningTask.woId} staffList={staff} contractors={contractors} onAssign={handleAssignTask} />}

            {isReviewModalOpen && reviewTaskInfo && (
                <TaskReviewModal
                    isOpen={isReviewModalOpen}
                    onClose={() => {
                        setIsReviewModalOpen(false);
                        setReviewTaskInfo(null);
                    }}
                    workOrder={reviewTaskInfo.wo}
                    task={reviewTaskInfo.task}
                />
            )}

            {selectedEvalWO && (
                <WorkOrderDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    wo={selectedEvalWO}
                    onTaskClick={handleTaskReviewClick}
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

            {zoomImage && (
                <div
                    onClick={() => setZoomImage(null)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                >
                    <img src={zoomImage} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px' }} />
                </div>
            )}

            {historyTask && (() => {
                const historyTaskAny: any = historyTask;
                const reports = historyTaskAny.dailyreports || historyTaskAny.history || [];

                const year = calendarMonth.getFullYear();
                const month = calendarMonth.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const firstDayIndex = new Date(year, month, 1).getDay();

                const daysArray: (number | null)[] = [];
                for (let i = 0; i < firstDayIndex; i++) {
                    daysArray.push(null);
                }
                for (let i = 1; i <= daysInMonth; i++) {
                    daysArray.push(i);
                }

                const handlePrevMonth = () => {
                    setCalendarMonth(new Date(year, month - 1, 1));
                };
                const handleNextMonth = () => {
                    setCalendarMonth(new Date(year, month + 1, 1));
                };

                const THAI_MONTHS = [
                    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
                ];

                const currentMonthName = THAI_MONTHS[month];

                const selectedReport: any = reports.find((r: any) => r.date === selectedHistoryDate);

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

                let siteWorkers = 0;
                let supportWorkers = 0;
                let siteHours = 0;
                let supportHours = 0;

                const siteShiftHours = { day: 0, otMorning: 0, otNoon: 0, otEvening: 0 };
                const supportShiftHours = { day: 0, otMorning: 0, otNoon: 0, otEvening: 0 };

                if (selectedReport) {
                    const labor = selectedReport.labor || [];
                    const leaveList = selectedReport.leave || [];
                    const leaveMap = new Map<string, any>();
                    leaveList.forEach((lv: any) => {
                        const wId = lv.workerId || lv.id || lv.staffId || '';
                        if (wId) {
                            leaveMap.set(wId, lv);
                        }
                    });

                    labor.forEach((l: any) => {
                        const isSite = l.membership === 'Internal';
                        const amount = l.amount || 0;
                        const wId = l.workerId || l.staffId || l.contractorId || l.id;

                        const hasLeave = leaveMap.has(wId);
                        const leaveRecord = leaveMap.get(wId);

                        let leaveHours = 0;
                        if (hasLeave && leaveRecord) {
                            const leaveTimeRange = leaveRecord.leaveTimes?.custom || '08:00 - 17:00';
                            leaveHours = getLeaveHours(leaveTimeRange);
                        }

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

                        let normalHr = 0;
                        if (l.shifts?.normal) {
                            const regTime = l.shiftTimes?.day || '08:00 - 17:00';
                            const duration = getShiftHours(regTime, 8);
                            normalHr = Math.max(0, duration - (regTime === '08:00 - 17:00' ? leaveHours : 0));
                        }

                        const otMorningHr = l.shifts?.otMorning ? getShiftHours(l.shiftTimes?.otMorning, 2) : 0;
                        const otNoonHr = l.shifts?.otNoon ? getShiftHours(l.shiftTimes?.otNoon || '12:00 - 13:00', 1) : 0;
                        const otEveningHr = l.shifts?.otEvening ? getShiftHours(l.shiftTimes?.otEvening, 3) : 0;

                        const totalHr = amount * (normalHr + otMorningHr + otNoonHr + otEveningHr);

                        let activeWorkerCount = amount;
                        if (hasLeave && leaveHours >= 8 && normalHr === 0 && !l.shifts?.otMorning && !l.shifts?.otNoon && !l.shifts?.otEvening) {
                            activeWorkerCount = 0;
                        } else if (hasLeave && leaveHours > 0) {
                            const workingRatio = normalHr / 8;
                            activeWorkerCount = amount * workingRatio;
                        }

                        if (isSite) {
                            siteWorkers += activeWorkerCount;
                            siteHours += totalHr;
                            siteShiftHours.day += amount * normalHr;
                            siteShiftHours.otMorning += amount * otMorningHr;
                            siteShiftHours.otNoon += amount * otNoonHr;
                            siteShiftHours.otEvening += amount * otEveningHr;
                        } else {
                            supportWorkers += activeWorkerCount;
                            supportHours += totalHr;
                            supportShiftHours.day += amount * normalHr;
                            supportShiftHours.otMorning += amount * otMorningHr;
                            supportShiftHours.otNoon += amount * otNoonHr;
                            supportShiftHours.otEvening += amount * otEveningHr;
                        }
                    });
                }

                const getDayStatus = (dateStr: string) => {
                    const hasReport = reports.some((r: any) => r.date === dateStr);
                    if (hasReport) return 'has-data';

                    const todayStr = new Date().toISOString().split('T')[0];
                    if (dateStr > todayStr) return 'no-data';

                    if (historyTask.startDate && dateStr >= historyTask.startDate) {
                        return 'pending';
                    }
                    return 'no-data';
                };

                const getDotColor = (dateStr: string) => {
                    const status = getDayStatus(dateStr);
                    if (status === 'has-data') return '#10b981';
                    if (status === 'pending') return '#f59e0b';
                    return '#ef4444';
                };

                const getThaiDateFormatted = (dateStr: string) => {
                    if (!dateStr) return '';
                    const parts = dateStr.split('-');
                    if (parts.length !== 3) return dateStr;
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                };

                const getPhotos = () => {
                    if (!selectedReport) return [];
                    let photoArray: string[] = [];

                    if (selectedReport.photos) {
                        if (Array.isArray(selectedReport.photos)) {
                            photoArray = [...selectedReport.photos];
                        } else {
                            if (selectedReport.photos.site && Array.isArray(selectedReport.photos.site)) {
                                photoArray = [...photoArray, ...selectedReport.photos.site];
                            }
                            if (selectedReport.photos.laborByShift) {
                                const lbs = selectedReport.photos.laborByShift;
                                if (lbs.regular && Array.isArray(lbs.regular)) {
                                    photoArray = [...photoArray, ...lbs.regular.filter(Boolean)];
                                }
                                ['otMorning', 'otNoon', 'otEvening'].forEach((otKey) => {
                                    if (lbs[otKey]) {
                                        if (lbs[otKey].in) photoArray.push(lbs[otKey].in);
                                        if (lbs[otKey].out) photoArray.push(lbs[otKey].out);
                                    }
                                });
                            }
                        }
                    }
                    if (selectedReport.laborPhotos && Array.isArray(selectedReport.laborPhotos)) {
                        photoArray = [...photoArray, ...selectedReport.laborPhotos];
                    }
                    if (selectedReport.photoUrl) {
                        photoArray.push(selectedReport.photoUrl);
                    }
                    return Array.from(new Set(photoArray.filter(Boolean)));
                };

                const reportPhotos = getPhotos();

                const proj = projects.find((p) => p.id === historyTask.woProjectId);
                const categoryName = historyTask.categoryName || 'หมวดงาน';

                const getStaffBadge = () => {
                    if (!historyTask.responsibleStaffIds || historyTask.responsibleStaffIds.length === 0) {
                        return { name: 'ยังไม่มอบหมาย', initials: '??' };
                    }
                    const staffId = historyTask.responsibleStaffIds[0];
                    const s = staff.find((st) => st.id === staffId);
                    if (s) {
                        return { name: s.name, initials: s.name ? s.name.substring(0, 2) : 'ST' };
                    }
                    const c = contractors.find((co) => co.id === staffId);
                    if (c) {
                        return { name: c.name, initials: c.name ? c.name.substring(0, 2) : 'SU' };
                    }
                    return { name: 'ผู้ควบคุมงาน', initials: 'DC' };
                };

                const staffBadge = getStaffBadge();

                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                        <div style={{ background: '#fff', border: '1px solid rgba(255, 255, 255, 0.8)', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', padding: '24px 32px', width: '92%', maxWidth: '1150px', maxHeight: '92vh', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Building2 size={13} />
                                        <span>{proj?.name || 'Live Ramintra'} - {categoryName}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#1e293b' }}>
                                            {historyTask.taskCode || historyTask.id} : {historyTask.name}
                                        </h2>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#3b82f6', color: '#fff', fontSize: '0.68rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {staffBadge.initials}
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>{staffBadge.name}</span>
                                        </div>
                                    </div>
                                </div>
                                <ModalCloseButton onClick={() => setHistoryTask(null)} style={{ borderRadius: '50%' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, '1fr 1.6fr'), gap: '28px', alignItems: 'start' }}>

                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b' }}>Daily Report Log</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>{currentMonthName} {year}</span>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button onClick={handlePrevMonth} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <button onClick={handleNextMonth} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '8px' }}>
                                        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, index) => (
                                            <span key={index} style={{ fontSize: '0.75rem', fontWeight: 800, color: index === 0 || index === 6 ? '#ef4444' : '#64748b' }}>{d}</span>
                                        ))}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px 6px', textAlign: 'center' }}>
                                        {daysArray.map((dayNum, index) => {
                                            if (dayNum === null) return <div key={`empty-${index}`} />;

                                            const paddedDay = String(dayNum).padStart(2, '0');
                                            const paddedMonth = String(month + 1).padStart(2, '0');
                                            const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
                                            const isSelected = dateStr === selectedHistoryDate;
                                            const dotColor = getDotColor(dateStr);
                                            const hasDot = getDayStatus(dateStr) !== 'no-data' || (historyTask.startDate && dateStr >= historyTask.startDate && dateStr <= new Date().toISOString().split('T')[0]);

                                            return (
                                                <div
                                                    key={dayNum}
                                                    onClick={() => setSelectedHistoryDate(dateStr)}
                                                    style={{
                                                        padding: '6px 0',
                                                        borderRadius: '50%',
                                                        background: isSelected ? '#1e293b' : 'transparent',
                                                        color: isSelected ? '#fff' : '#334155',
                                                        fontWeight: isSelected ? 900 : 700,
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        position: 'relative',
                                                        height: '38px',
                                                        width: '38px',
                                                        margin: '0 auto',
                                                        transition: 'all 0.1s'
                                                    }}
                                                >
                                                    <span>{dayNum}</span>
                                                    {hasDot && (
                                                        <div style={{
                                                            width: '5px',
                                                            height: '5px',
                                                            borderRadius: '50%',
                                                            background: dotColor,
                                                            position: 'absolute',
                                                            bottom: '4px'
                                                        }} />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                            มีข้อมูล
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                                            ยังไม่ได้ลง
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                                            ไม่มีข้อมูล
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#1e293b' }}>
                                        สรุปข้อมูลวันที่ {getThaiDateFormatted(selectedHistoryDate)}
                                    </h3>

                                    {!selectedReport ? (
                                        <div style={{ background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: '24px', padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                                            <Calendar size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                            <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>ไม่มีรายงานข้อมูลในวันที่เลือก</div>
                                            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>กรุณาเลือกวันที่มีจุดสีเขียว 🟢 ในปฏิทินเพื่อดูรายงานย้อนหลัง</div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                            <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, '1fr 1fr'), gap: '16px' }}>

                                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
                                                        <Users size={16} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#475569' }}>แรงงาน (DC)</span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, '1fr 1fr'), gap: '8px', textAlign: 'center', marginTop: '4px' }}>
                                                        <div style={{ borderRight: '1px solid #e2e8f0' }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>SITE</div>
                                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', marginTop: '2px' }}>{siteWorkers} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>คน</span></div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>Support</div>
                                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', marginTop: '2px' }}>{supportWorkers} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>คน</span></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
                                                        <Clock size={16} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#475569' }}>ชั่วโมงการทำงานทั้งหมด</span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, '1fr 1fr'), gap: '8px', textAlign: 'center', marginTop: '4px' }}>
                                                        <div style={{ borderRight: '1px solid #e2e8f0' }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>SITE</div>
                                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', marginTop: '2px' }}>{siteHours} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>ชม.</span></div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>Support</div>
                                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', marginTop: '2px' }}>{supportHours} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>ชม.</span></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 1' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', marginBottom: '4px' }}>
                                                        <Clock size={16} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#475569' }}>รายละเอียดชั่วโมงการทำงาน</span>
                                                    </div>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                                        <thead>
                                                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#94a3b8', textAlign: 'center' }}>
                                                                <th style={{ padding: '4px 0', textAlign: 'left' }}></th>
                                                                <th style={{ padding: '4px 0', fontWeight: 800, width: '35%' }}>SITE</th>
                                                                <th style={{ padding: '4px 0', fontWeight: 800, width: '35%' }}>Support</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody style={{ textAlign: 'center', fontWeight: 800, color: '#334155' }}>
                                                            <tr style={{ borderBottom: '1px dashed #e2e8f0' }}>
                                                                <td style={{ padding: '6px 0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>Day</td>
                                                                <td style={{ padding: '6px 0' }}>{siteShiftHours.day ? `${siteShiftHours.day} ชม.` : '-'}</td>
                                                                <td style={{ padding: '6px 0' }}>{supportShiftHours.day ? `${supportShiftHours.day} ชม.` : '-'}</td>
                                                            </tr>
                                                            <tr style={{ borderBottom: '1px dashed #e2e8f0' }}>
                                                                <td style={{ padding: '6px 0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>OT เช้า</td>
                                                                <td style={{ padding: '6px 0' }}>{siteShiftHours.otMorning ? `${siteShiftHours.otMorning} ชม.` : '-'}</td>
                                                                <td style={{ padding: '6px 0' }}>{supportShiftHours.otMorning ? `${supportShiftHours.otMorning} ชม.` : '-'}</td>
                                                            </tr>
                                                            <tr style={{ borderBottom: '1px dashed #e2e8f0' }}>
                                                                <td style={{ padding: '6px 0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>OT เที่ยง</td>
                                                                <td style={{ padding: '6px 0' }}>{siteShiftHours.otNoon ? `${siteShiftHours.otNoon} ชม.` : '-'}</td>
                                                                <td style={{ padding: '6px 0' }}>{supportShiftHours.otNoon ? `${supportShiftHours.otNoon} ชม.` : '-'}</td>
                                                            </tr>
                                                            <tr>
                                                                <td style={{ padding: '6px 0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>OT เย็น</td>
                                                                <td style={{ padding: '6px 0' }}>{siteShiftHours.otEvening ? `${siteShiftHours.otEvening} ชม.` : '-'}</td>
                                                                <td style={{ padding: '6px 0' }}>{supportShiftHours.otEvening ? `${supportShiftHours.otEvening} ชม.` : '-'}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 1' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', marginBottom: '4px' }}>
                                                        <Camera size={16} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#475569' }}>รูปภาพทั้งหมด {reportPhotos.length > 0 ? `(รูปที่ 1/${reportPhotos.length})` : ''}</span>
                                                    </div>

                                                    {reportPhotos.length === 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', border: '2px dashed #e2e8f0', borderRadius: '12px', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800 }}>
                                                            <ImageIcon size={20} style={{ opacity: 0.5, marginBottom: '4px' }} />
                                                            ไม่มีการอัปโหลดรูปภาพ
                                                        </div>
                                                    ) : (
                                                        <div style={{ position: 'relative', width: '100%', height: '100px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'zoom-in' }} onClick={() => setZoomImage(reportPhotos[0])}>
                                                            <img src={reportPhotos[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Daily Progress" />
                                                            {reportPhotos.length > 1 && (
                                                                <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(15, 23, 42, 0.75)', color: '#fff', fontSize: '0.62rem', fontWeight: 900, padding: '2px 6px', borderRadius: '6px' }}>
                                                                    +{reportPhotos.length - 1} รูป
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                            </div>

                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#475569' }}>ความคืบหน้าของวัน</span>
                                                    <span style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981' }}>{selectedReport.progress || historyTask.dailyProgress || 0}%</span>
                                                </div>
                                                <div style={{ width: '100%', height: '24px', background: '#e2e8f0', borderRadius: '12px', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <div style={{ width: `${selectedReport.progress || historyTask.dailyProgress || 0}%`, height: '100%', background: '#10b981', transition: 'width 0.3s ease' }} />
                                                    <div style={{ position: 'absolute', left: '12px', background: 'rgba(255,255,255,0.9)', color: '#10b981', fontSize: '0.68rem', fontWeight: 900, padding: '1px 6px', borderRadius: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                        +{selectedReport.progress || historyTask.dailyProgress || 0}%
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(241, 245, 249, 0.4)', border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: '20px', padding: '16px' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Info size={12} />
                                                        หมายเหตุล่าสุด (Site Notes):
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 700, fontStyle: 'italic', marginTop: '4px', background: '#fff', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                                        "{selectedReport.notes || selectedReport.note || 'ไม่มีข้อความหมายเหตุ'}"
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>
                                                    <div>ผู้บันทึก: {selectedReport.createdBy || 'Foreman'}</div>
                                                    <div>เวลาบันทึก: {selectedReport.createdAt ? (() => {
                                                        const d = new Date(selectedReport.createdAt);
                                                        const hours = String(d.getHours()).padStart(2, '0');
                                                        const minutes = String(d.getMinutes()).padStart(2, '0');
                                                        return `${hours}:${minutes}`;
                                                    })() : '-'}</div>
                                                </div>
                                            </div>

                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default SLAMonitor;