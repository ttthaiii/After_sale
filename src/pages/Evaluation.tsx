import { useState, useEffect } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import WorkOrderCard from '../components/WorkOrderCard';
import TaskEvaluationModal from '../components/TaskEvaluationModal';
import { CheckSquare, Search, Calendar, Building2, ChevronDown, AlertCircle, XCircle, CheckCircle2, Info } from 'lucide-react';
import { WorkOrder, MasterTask } from '../types';
import WorkOrderDetailModal from '../components/WorkOrderDetailModal';
import { logService } from '../services/logService';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminAssignModal from '../components/AdminAssignModal';
import { formatDate } from '../utils/date';
import CustomDateInput from '../components/CustomDateInput';

const Evaluation = () => {
    const { user } = useAuth();
    const { workOrders, saveEvaluation, projects, markWorkOrderAsReviewed, updateTask, staff, contractors, markWorkOrderAsOpenedByAdmin } = useWorkOrders();
    const location = useLocation();
    const navigate = useNavigate();
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState<MasterTask | null>(null);
    const [assigningTask, setAssigningTask] = useState<MasterTask | null>(null);
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [taskDecisions, setTaskDecisions] = useState<Record<string, 'Approved' | 'Assigned' | 'Rejected'>>({});
    const [modalAlert, setModalAlert] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'info' | 'warning' | 'error';
    } | null>(null);

    // ✅ Deep Link: Open Work Order if ID is in URL with State Validation (Case A)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const workOrderId = params.get('id');
        
        if (workOrderId && workOrders.length > 0) {
            const wo = workOrders.find(w => w.id === workOrderId);
            if (wo) {
                if (wo.status === 'Evaluating' || wo.status === 'Rejected') {
                    setHighlightedId(workOrderId);
                    setSelectedWorkOrder(wo);
                    setIsDetailModalOpen(true);
                    markWorkOrderAsOpenedByAdmin(wo.id);
                    // NOTE: do NOT call markWorkOrderAsReviewed here — opening to view must NOT unlock foremen
                } else {
                    const statusThai: Record<string, string> = {
                        'Approved': 'อนุมัติแล้ว',
                        'Partially Approved': 'อนุมัติบางส่วน',
                        'In Progress': 'กำลังดำเนินการ',
                        'Completed': 'เสร็จสิ้น',
                        'Verified': 'ตรวจสอบแล้ว'
                    };
                    
                    if (['Approved', 'Partially Approved', 'In Progress', 'Completed', 'Verified'].includes(wo.status)) {
                        setModalAlert({
                            isOpen: true,
                            title: 'ประเมินใบสั่งงานเรียบร้อยแล้ว',
                            message: `ใบสั่งงานนี้ได้รับการประเมินและมอบหมายงานเรียบร้อยแล้ว (สถานะปัจจุบัน: ${statusThai[wo.status] || wo.status}) คุณสามารถทำงานอื่นในหน้านี้ต่อได้ทันที`,
                            type: 'success'
                        });
                    } else if (wo.status === 'Rejected') {
                        setModalAlert({
                            isOpen: true,
                            title: 'ใบสั่งงานถูกส่งกลับแก้ไข',
                            message: 'ใบสั่งงานนี้ถูกปฏิเสธการประเมินและถูกส่งกลับไปให้โฟร์แมนแก้ไขเรียบร้อยแล้ว',
                            type: 'warning'
                        });
                    } else if (wo.status === 'Cancelled') {
                        setModalAlert({
                            isOpen: true,
                            title: 'ใบสั่งงานถูกยกเลิก',
                            message: 'ใบสั่งงานนี้ถูกยกเลิกการดำเนินงานแล้ว',
                            type: 'error'
                        });
                    } else if (wo.status === 'Draft') {
                        setModalAlert({
                            isOpen: true,
                            title: 'ใบสั่งงานแบบร่าง',
                            message: 'ใบสั่งงานนี้ยังคงเป็นแบบร่างของโฟร์แมนและยังไม่ได้ถูกส่งมาเพื่อขอประเมิน',
                            type: 'warning'
                        });
                    } else {
                        setModalAlert({
                            isOpen: true,
                            title: 'ใบสั่งงานไม่พร้อมประเมิน',
                            message: `ใบสั่งงานนี้ไม่พร้อมสำหรับการประเมิน (สถานะปัจจุบัน: ${wo.status})`,
                            type: 'info'
                        });
                    }
                }
                
                // Clear the ID from URL once handled to prevent re-opening if data updates
                const newParams = new URLSearchParams(location.search);
                newParams.delete('id');
                const newSearch = newParams.toString();
                navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
            }
        }
    }, [location.search, workOrders, navigate, markWorkOrderAsReviewed, markWorkOrderAsOpenedByAdmin]);

    const handleCardClick = (wo: WorkOrder) => {
        setSelectedWorkOrder(wo);
        setIsDetailModalOpen(true);
        markWorkOrderAsOpenedByAdmin(wo.id);
        // NOTE: do NOT call markWorkOrderAsReviewed here — opening to view must NOT unlock foremen
    };

    // ✅ Real-time Sync selectedWorkOrder & taskDecisions with Firestore Context
    useEffect(() => {
        if (selectedWorkOrder) {
            const updatedWo = workOrders.find(w => w.id === selectedWorkOrder.id);
            if (updatedWo) {
                setSelectedWorkOrder(updatedWo);
                
                // Sync taskDecisions with current Firestore statuses
                const decisions: Record<string, 'Approved' | 'Assigned' | 'Rejected'> = {};
                updatedWo.categories.flatMap(c => c.tasks).forEach(t => {
                    if (t.status === 'Approved' || t.status === 'Assigned' || t.status === 'Rejected' || t.status === 'Verified') {
                        decisions[t.id] = t.status === 'Verified' ? 'Approved' : t.status as any;
                    }
                });
                setTaskDecisions(decisions);
            }
        }
    }, [workOrders, selectedWorkOrder?.id]);

    const pendingWorkOrders = workOrders
        .filter(wo => {
            const isPending = wo.status === 'Evaluating' ||
                (wo.status === 'Rejected' && (
                    wo.pendingAdminReassign === true ||
                    (wo.pendingAdminReassign === undefined && wo.reviewedByAdmin === false)
                ));
            const matchesSearch = (wo.locationName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (wo.id || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesProject = selectedProjectId ? wo.projectId === selectedProjectId : true;
            let woDate = '';
            const rawDate = wo.submittedAt || wo.createdAt;
            if (rawDate) {
                const parsed = new Date(rawDate);
                if (!isNaN(parsed.getTime())) {
                    woDate = parsed.toISOString().split('T')[0];
                }
            }
            const matchesStartDate = startDate ? (woDate ? woDate >= startDate : false) : true;
            const matchesEndDate = endDate ? (woDate ? woDate <= endDate : false) : true;
            return isPending && matchesSearch && matchesProject && matchesStartDate && matchesEndDate;
        })
        .sort((a, b) => {
            const timeA = new Date(a.submittedAt || a.createdAt).getTime();
            const timeB = new Date(b.submittedAt || b.createdAt).getTime();
            const validA = isNaN(timeA) ? 0 : timeA;
            const validB = isNaN(timeB) ? 0 : timeB;
            return validB - validA;
        }); // Sort Newest Submitted First

    // ✅ Track Page View
    useEffect(() => {
        if (user) {
            logService.trackPageView(user, 'EVALUATION', 'ระบบประเมินและอนุมัติ');
        }
    }, [user]);

    const handleTaskReviewClick = (task: MasterTask) => {
        if (selectedWorkOrder?.status === 'Rejected') {
            setAssigningTask(task);
        } else {
            setCurrentTask(task);
            setIsEvalModalOpen(true);
        }
    };

    const handleModalConfirm = async (updates: Partial<MasterTask>) => {
        if (!currentTask || !selectedWorkOrder) return;

        const status = updates.status as 'Approved' | 'Assigned' | 'Rejected';
        setTaskDecisions(prev => ({ ...prev, [currentTask.id]: status }));

        // ✅ 1. Compute the updated categories array for the work order
        const updatedCategories = selectedWorkOrder.categories.map(cat => ({
            ...cat,
            tasks: cat.tasks.map(t => t.id === currentTask.id ? { ...t, ...updates } : t)
        }));

        // ✅ 2. Compute final Work Order status
        const allTasks = updatedCategories.flatMap(c => c.tasks);
        const pendingCount = allTasks.filter(t => t.status === 'Pending').length;
        const approvedCount = allTasks.filter(t => t.status === 'Approved' || t.status === 'Assigned').length;
        const totalCount = allTasks.length;

        let finalWoStatus: 'Evaluating' | 'Approved' | 'Partially Approved' | 'Rejected' = 'Evaluating';

        if (pendingCount > 0) {
            // There are still undecided tasks! Keep it in 'Evaluating' so it stays in the queue
            finalWoStatus = 'Evaluating';
        } else {
            // All tasks have been evaluated!
            if (approvedCount === 0) {
                finalWoStatus = 'Rejected';
            } else if (approvedCount < totalCount) {
                finalWoStatus = 'Partially Approved';
            } else {
                finalWoStatus = 'Approved';
            }
        }

        // ✅ 3. Save directly to Firestore
        try {
            await saveEvaluation(selectedWorkOrder.id, finalWoStatus, updatedCategories);
            
            // If all tasks are decided, close the detail modal automatically
            if (pendingCount === 0) {
                setIsDetailModalOpen(false);
                setSelectedWorkOrder(null);
                setTaskDecisions({});
            }
        } catch (err) {
            console.error("Failed to save task evaluation:", err);
            setModalAlert({
                isOpen: true,
                title: 'เกิดข้อผิดพลาด',
                message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลการประเมิน กรุณาลองใหม่อีกครั้ง',
                type: 'error'
            });
        }

        setIsEvalModalOpen(false);
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
                    taskDecisions={taskDecisions}
                />
            )}

            {assigningTask && selectedWorkOrder && (
                <AdminAssignModal
                    isOpen={!!assigningTask}
                    onClose={() => setAssigningTask(null)}
                    task={assigningTask}
                    workOrderId={selectedWorkOrder.id}
                    staffList={staff}
                    contractors={contractors}
                    onAssign={async (woId, taskId, updates) => {
                        const category = selectedWorkOrder.categories.find(c => c.tasks.some(t => t.id === taskId));
                        if (category) {
                            await updateTask(woId, category.id, taskId, updates);
                            
                            setModalAlert({
                                isOpen: true,
                                title: 'มอบหมายงานใหม่สำเร็จ',
                                message: `มอบหมายงาน ${assigningTask.name} เรียบร้อยแล้ว (วันเริ่มดำเนินการ: ${formatDate(updates.startDate)})`,
                                type: 'success'
                            });
                            
                            const remainingRejected = selectedWorkOrder.categories
                                .flatMap(c => c.tasks)
                                .filter(t => t.id !== taskId && t.evaluationStatus === 'Rejected');
                                
                            if (remainingRejected.length === 0) {
                                setIsDetailModalOpen(false);
                                setSelectedWorkOrder(null);
                            }
                        }
                        setAssigningTask(null);
                    }}
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
                                .filter(p => workOrders.some(wo => wo.projectId === p.id && (
                                    wo.status === 'Evaluating' ||
                                    (wo.status === 'Rejected' && (
                                        wo.pendingAdminReassign === true ||
                                        (wo.pendingAdminReassign === undefined && wo.reviewedByAdmin === false)
                                    ))
                                )))
                                .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                            <ChevronDown size={18} />
                        </div>
                    </div>

                    <div style={{ position: 'relative', width: '100%' }}>
                        <CustomDateInput
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            style={{ ...commonInputStyle, paddingLeft: '48px' }}
                        />
                    </div>

                    <div style={{ position: 'relative', width: '100%' }}>
                        <CustomDateInput
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            style={{ ...commonInputStyle, paddingLeft: '48px' }}
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

            {modalAlert && modalAlert.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000, padding: '2rem', animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.4)', borderRadius: '24px',
                        padding: '2.5rem', maxWidth: '480px', width: '100%', textAlign: 'center',
                        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.1)',
                        animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '20px',
                            background: modalAlert.type === 'success' 
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                                : modalAlert.type === 'warning'
                                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                    : modalAlert.type === 'error'
                                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                        : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem auto', boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                        }}>
                            {modalAlert.type === 'success' ? <CheckCircle2 size={32} /> :
                             modalAlert.type === 'warning' ? <AlertCircle size={32} /> :
                             modalAlert.type === 'error' ? <XCircle size={32} /> : <Info size={32} />}
                        </div>
                        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{modalAlert.title}</h3>
                        <p style={{ margin: '0 0 2rem 0', fontSize: '0.95rem', color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>{modalAlert.message}</p>
                        <button
                            onClick={() => setModalAlert(null)}
                            style={{
                                width: '100%', padding: '12px 24px', background: '#0f172a', color: '#ffffff',
                                border: 'none', borderRadius: '14px', fontSize: '0.95rem', fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
                            }}
                        >
                            ตกลง
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Evaluation;
