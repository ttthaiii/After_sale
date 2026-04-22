import { useState, useEffect } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import WorkOrderCard from '../components/WorkOrderCard';
import TaskEvaluationModal from '../components/TaskEvaluationModal';
import { CheckSquare, Search, Calendar, Building2, ChevronDown } from 'lucide-react';
import { WorkOrder, MasterTask } from '../types';
import WorkOrderDetailModal from '../components/WorkOrderDetailModal';
import { logService } from '../services/logService';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

const Evaluation = () => {
    const { user } = useAuth();
    const { workOrders, saveEvaluation, projects, markWorkOrderAsReviewed } = useWorkOrders();
    const { sendNotification } = useNotifications();
    const location = useLocation();
    const navigate = useNavigate();
    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    // ✅ Deep Link: Open Work Order if ID is in URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const workOrderId = params.get('id');
        
        if (workOrderId && workOrders.length > 0) {
            const wo = workOrders.find(w => w.id === workOrderId);
            if (wo) {
                setHighlightedId(workOrderId);
                setSelectedWorkOrder(wo);
                setIsDetailModalOpen(true);
                markWorkOrderAsReviewed(wo.id); // Mark as reviewed by admin
                
                // Clear the ID from URL once handled to prevent re-opening if data updates
                const newParams = new URLSearchParams(location.search);
                newParams.delete('id');
                const newSearch = newParams.toString();
                navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
            }
        }
    }, [location.search, workOrders]);

    const handleCardClick = (wo: WorkOrder) => {
        setSelectedWorkOrder(wo);
        setIsDetailModalOpen(true);
        markWorkOrderAsReviewed(wo.id); // Mark as reviewed by admin
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState<MasterTask | null>(null);
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [taskDecisions, setTaskDecisions] = useState<Record<string, 'Approved' | 'Assigned' | 'Rejected'>>({});

    const pendingWorkOrders = workOrders
        .filter(wo => {
            const isPending = wo.status === 'Evaluating';
            const matchesSearch = wo.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                wo.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesProject = selectedProjectId ? wo.projectId === selectedProjectId : true;
            const woDate = new Date(wo.submittedAt || wo.createdAt).toISOString().split('T')[0];
            const matchesStartDate = startDate ? woDate >= startDate : true;
            const matchesEndDate = endDate ? woDate <= endDate : true;
            return isPending && matchesSearch && matchesProject && matchesStartDate && matchesEndDate;
        })
        .sort((a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime()); // Sort Newest Submitted First

    // ✅ Track Page View
    useEffect(() => {
        if (user) {
            logService.trackPageView(user, 'EVALUATION', 'ระบบประเมินและอนุมัติ');
        }
    }, [user]);

    const handleTaskReviewClick = (task: MasterTask) => {
        setCurrentTask(task);
        setIsEvalModalOpen(true);
    };

    const handleModalConfirm = (updates: Partial<MasterTask>) => {
        if (!currentTask || !selectedWorkOrder) return;

        const status = updates.status as 'Approved' | 'Assigned' | 'Rejected';
        setTaskDecisions(prev => ({ ...prev, [currentTask.id]: status }));

        // ✅ Immutable Update to WorkOrder state
        setSelectedWorkOrder(prevWo => {
            if (!prevWo) return null;
            return {
                ...prevWo,
                categories: prevWo.categories.map(cat => ({
                    ...cat,
                    tasks: cat.tasks.map(t => t.id === currentTask.id ? { ...t, ...updates } : t)
                }))
            };
        });

        setIsEvalModalOpen(false);
    };

    const handleCompleteEvaluation = async (wo: WorkOrder) => {
        const allTasks = wo.categories.flatMap(c => c.tasks);
        const undecided = allTasks.filter(t => !taskDecisions[t.id]);
        if (undecided.length > 0) {
            if (!confirm(`มีรายการที่ยังไม่ได้ระบุผลตรวจสอบ ${undecided.length} รายการ\nหากดำเนินการต่อ รายการเหล่านี้จะถูก "ไมอนุมัติ" (Reject)\nต้องการยืนยันหรือไม่?`)) {
                return;
            }
        }

        const approvedCount = allTasks.filter(t => t.status === 'Approved' || t.status === 'Assigned').length;
        const total = allTasks.length;
        let finalWoStatus: 'Approved' | 'Partially Approved' | 'Rejected' = 'Approved';

        if (approvedCount === 0) finalWoStatus = 'Rejected';
        else if (approvedCount < total) finalWoStatus = 'Partially Approved';
        else finalWoStatus = 'Approved';

        // ✅ Important: Mark leftover Pending as Rejected
        allTasks.forEach(t => {
            if (t.status === 'Pending') {
                t.status = 'Rejected';
            }
        });

        await saveEvaluation(wo.id, finalWoStatus, wo.categories);

        setIsDetailModalOpen(false);
        setSelectedWorkOrder(null);
        setTaskDecisions({});
    };

    const commonInputStyle = {
        width: '100%',
        padding: '12px 12px 12px 42px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        color: '#0f172a',
        fontSize: '0.95rem',
        outline: 'none',
        transition: 'all 0.2s'
    };

    return (
        <div>
            {currentTask && (
                <TaskEvaluationModal
                    isOpen={isEvalModalOpen}
                    onClose={() => setIsEvalModalOpen(false)}
                    task={currentTask}
                    workOrderId={selectedWorkOrder?.id || ''}
                    onConfirm={handleModalConfirm}
                />
            )}

            {selectedWorkOrder && (
                <WorkOrderDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    wo={selectedWorkOrder}
                    onTaskClick={handleTaskReviewClick}
                    onComplete={handleCompleteEvaluation}
                    taskDecisions={taskDecisions}
                />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '20px', color: '#7c3aed', border: '1px solid #ede9fe', boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.1)' }}>
                    <CheckSquare size={36} />
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>ระบบประเมินและอนุมัติ</h1>
                    <span style={{ color: '#64748b', fontSize: '1.1rem', marginTop: '6px', display: 'block', fontWeight: 500 }}>ตรวจสอบและรับรองรายการแจ้งซ่อม</span>
                </div>
            </div>

            {/* Filters */}
            <div style={{ background: '#ffffff', padding: '24px 32px', borderRadius: '24px', marginBottom: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginLeft: '4px', marginRight: '4px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>

                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', color: '#94a3b8' }}>
                            <Search size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="ค้นหาตาม Unit / ID..."
                            style={{ ...commonInputStyle, paddingLeft: '48px' }}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', color: '#94a3b8', pointerEvents: 'none' }}>
                            <Building2 size={20} />
                        </div>
                        <select
                            style={{ ...commonInputStyle, paddingLeft: '48px', appearance: 'none' }}
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                        >
                            <option value="">-- ทุกโครงการ --</option>
                            {projects
                                .filter(p => workOrders.some(wo => wo.projectId === p.id && wo.status === 'Evaluating'))
                                .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                            <ChevronDown size={18} />
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', color: '#94a3b8' }}>
                            <Calendar size={20} />
                        </div>
                        <input
                            type="date"
                            style={{ ...commonInputStyle, paddingLeft: '48px' }}
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', color: '#94a3b8' }}>
                            <Calendar size={20} />
                        </div>
                        <input
                            type="date"
                            style={{ ...commonInputStyle, paddingLeft: '48px' }}
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Grid List */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1.5rem',
                padding: '4px'
            }}>
                {pendingWorkOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#64748b', background: '#ffffff', borderRadius: '32px', border: '2px dashed #e2e8f0', gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#475569' }}>ไม่พบงานที่รอตรวจสอบ</div>
                        <div style={{ fontSize: '1rem', color: '#94a3b8', marginTop: '8px' }}>รายการที่รอประเมินจะปรากฏขึ้นที่นี่</div>
                    </div>
                ) : (
                    pendingWorkOrders.map(wo => (
                        <WorkOrderCard
                            key={wo.id}
                            wo={wo}
                            variant="compact"
                            showStatusBadge={true}
                            onClick={() => handleCardClick(wo)}
                            style={highlightedId === wo.id ? { 
                                border: '2px solid #3b82f6', 
                                boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)',
                                background: '#eff6ff',
                                transform: 'scale(1.02)'
                            } : {}}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default Evaluation;
