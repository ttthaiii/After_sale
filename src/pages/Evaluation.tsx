import { useState, useEffect, useMemo } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import WorkOrderCard from '../components/WorkOrderCard';
import TaskEvaluationModal from '../components/TaskEvaluationModal';
import { CheckSquare, Search, Calendar, Building2, ChevronDown, AlertCircle, XCircle, CheckCircle2, Info, Users, History, Clock, UserCircle } from 'lucide-react';
import { WorkOrder, MasterTask } from '../types';
import { deriveWoStatus } from '../utils/deriveWoStatus';
import WorkOrderDetailModal from '../components/WorkOrderDetailModal';
import { logService } from '../services/logService';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import AdminAssignModal from '../components/AdminAssignModal';
import PreHandoverAssignModal from '../components/PreHandoverAssignModal';
import AdminAssignHelperModal from '../components/AdminAssignHelperModal';
import { formatDate } from '../utils/date';
import CustomDateInput from '../components/CustomDateInput';
import { db } from '../lib/firebase';
import { collection, query as fsQuery, where, onSnapshot as fsOnSnapshot, collectionGroup } from 'firebase/firestore';

const Evaluation = () => {
    const { user } = useAuth();
    const { sendNotification } = useNotifications();
    const { workOrders, saveEvaluation, projects, markWorkOrderAsReviewed, updateTask, staff, contractors, markWorkOrderAsOpenedByAdmin, approveRetroactiveRequest, rejectRetroactiveRequest, approvePreHandoverWO, approvePhRetroactiveRequest, rejectPhRetroactiveRequest, reviewRejectedPhWO } = useWorkOrders();
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
    const [taskDecisions, setTaskDecisions] = useState<Record<string, 'Assigned' | 'Rejected'>>({});
    const [modalAlert, setModalAlert] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'info' | 'warning' | 'error';
    } | null>(null);

    const [activeTab, setActiveTab] = useState<'evaluation' | 'helper' | 'retroactive'>('evaluation');
    const [assigningHelperTask, setAssigningHelperTask] = useState<MasterTask | null>(null);
    const [helperTaskWoId, setHelperTaskWoId] = useState<string>('');
    const [pendingRetroReqs, setPendingRetroReqs] = useState<any[]>([]);
    const [selectedRetroReq, setSelectedRetroReq] = useState<any | null>(null);
    const [retroRejectReason, setRetroRejectReason] = useState('');
    const [retroActionLoading, setRetroActionLoading] = useState(false);
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [pendingPhRetroReqs, setPendingPhRetroReqs] = useState<any[]>([]);
    const [selectedPhRetroReq, setSelectedPhRetroReq] = useState<any | null>(null);
    const [phRetroRejectReason, setPhRetroRejectReason] = useState('');
    const [phRetroActionLoading, setPhRetroActionLoading] = useState(false);
    const [showPhRejectInput, setShowPhRejectInput] = useState(false);
    const [rejectedPhWOs, setRejectedPhWOs] = useState<any[]>([]);
    const [selectedRejectedPhWo, setSelectedRejectedPhWo] = useState<any | null>(null);
    const [phReassignDate, setPhReassignDate] = useState('');
    const [phReassignLoading, setPhReassignLoading] = useState(false);
    const [isPreHandoverAssignOpen, setIsPreHandoverAssignOpen] = useState(false);

    // ✅ Deep Link: Open Work Order if ID is in URL with State Validation (Case A)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const workOrderId = params.get('id');
        
        if (workOrderId && workOrders.length > 0) {
            const wo = workOrders.find(w => w.id === workOrderId);
            if (wo) {
                if (wo.status === 'Evaluating' || wo.status === 'Rejected' || wo.status === 'customer_reject') {
                    setHighlightedId(workOrderId);
                    setSelectedWorkOrder(wo);
                    setIsDetailModalOpen(true);
                    markWorkOrderAsOpenedByAdmin(wo.id);
                    // NOTE: do NOT call markWorkOrderAsReviewed here — opening to view must NOT unlock foremen
                } else {
                    const statusThai: Record<string, string> = {
                        'Assigned': 'มอบหมายงานแล้ว',
                        'Partially Approved': 'อนุมัติบางส่วน',
                        'In Progress': 'กำลังดำเนินการ',
                        'For Checking': 'งานเสร็จ รอออก QR',
                        'pending_delivery': 'รอลูกค้าประเมิน',
                        'Complete': 'เสร็จสิ้น'
                    };

                    if (['Assigned', 'Partially Approved', 'In Progress', 'For Checking', 'pending_delivery', 'Complete'].includes(wo.status)) {
                        setModalAlert({
                            isOpen: true,
                            title: 'ประเมินใบสั่งงานเรียบร้อยแล้ว',
                            message: `ใบสั่งงานนี้ได้รับการประเมินและมอบหมายงานเรียบร้อยแล้ว (สถานะปัจจุบัน: ${statusThai[wo.status] || wo.status}) คุณสามารถทำงานอื่นในหน้านี้ต่อได้ทันที`,
                            type: 'success'
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
                const decisions: Record<string, 'Assigned' | 'Rejected'> = {};
                updatedWo.categories.flatMap(c => c.tasks).forEach(t => {
                    if (t.status === 'Assigned' || t.status === 'Rejected') {
                        decisions[t.id] = t.status;
                    }
                });
                setTaskDecisions(decisions);
            }
        }
    }, [workOrders, selectedWorkOrder?.id]);

    const pendingWorkOrders = workOrders
        .filter(wo => {
            // Route by TASK (Option A): any WO with a task awaiting admin evaluation shows here —
            // covers first-round Evaluating and customer-rejected tasks sent back (also 'Evaluating').
            const hasEvaluatingTask = (wo.categories || []).some(c => (c.tasks || []).some(t => t.status === 'Evaluating'));
            const isPending = (wo.status === 'Evaluating' || hasEvaluatingTask) && !wo.isArchived;
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

    const pendingHelperTasks = useMemo(() => {
        const tasksList: { task: MasterTask; wo: WorkOrder; categoryId: string }[] = [];
        workOrders.forEach(wo => {
            if (['Cancelled', 'Draft', 'Complete'].includes(wo.status)) return;
            
            wo.categories.forEach(cat => {
                cat.tasks.forEach(t => {
                    const isPendingSupport = t.isSupportRequest === true && t.isPickedUpBySupport !== true && t.isHelper === true;
                    if (isPendingSupport) {
                        const matchesSearch = (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (wo.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (wo.locationName || '').toLowerCase().includes(searchTerm.toLowerCase());
                        const matchesProject = selectedProjectId ? wo.projectId === selectedProjectId : true;
                        
                        if (matchesSearch && matchesProject) {
                            tasksList.push({ task: t, wo, categoryId: cat.id });
                        }
                    }
                });
            });
        });
        return tasksList;
    }, [workOrders, searchTerm, selectedProjectId]);

    // ✅ Track Page View
    useEffect(() => {
        if (user) {
            logService.trackPageView(user, 'EVALUATION', 'ระบบประเมินและอนุมัติ');
        }
    }, [user]);

    useEffect(() => {
        if (workOrders.length === 0) return;
        const unsubs: (() => void)[] = [];
        workOrders.forEach(wo => {
            const q = fsQuery(
                collection(db, 'workOrders', wo.id, 'retroactiveRequests'),
                where('status', '==', 'pending')
            );
            const unsub = fsOnSnapshot(q, snap => {
                const reqs = snap.docs.map(d => ({ id: d.id, workOrderId: wo.id, ...d.data() }));
                setPendingRetroReqs(prev => {
                    const others = prev.filter(r => r.workOrderId !== wo.id);
                    return [...others, ...reqs];
                });
            }, err => console.error(`retroactiveRequests listener error [${wo.id}]:`, err));
            unsubs.push(unsub);
        });
        return () => unsubs.forEach(u => u());
    }, [workOrders.length]);

    // PreHandover retroactive requests listener
    useEffect(() => {
        if (workOrders.length === 0) return;
        const phWOs = workOrders.filter(wo => (wo as any).type === 'PreHandover');
        if (phWOs.length === 0) return;
        const unsubs: (() => void)[] = [];
        phWOs.forEach(wo => {
            const cats: any[] = (wo as any).categories || [];
            cats.forEach((cat: any) => {
                const q = fsQuery(
                    collection(db, 'workOrders', wo.id, 'categories', cat.id, 'phRetroactiveRequests'),
                    where('status', '==', 'pending')
                );
                const unsub = fsOnSnapshot(q, snap => {
                    const reqs = snap.docs.map(d => ({
                        id: d.id,
                        woId: wo.id,
                        catId: cat.id,
                        woCode: wo.id,
                        catName: cat.name,
                        projectName: projects.find(p => p.id === wo.projectId)?.name || '',
                        locationName: (wo as any).locationName || (wo as any).address || '',
                        ...d.data(),
                        _type: 'prehandover',
                    }));
                    setPendingPhRetroReqs(prev => {
                        const others = prev.filter(r => !(r.woId === wo.id && r.catId === cat.id));
                        return [...others, ...reqs];
                    });
                }, err => console.error(`phRetroactiveRequests listener error [${wo.id}/${cat.id}]:`, err));
                unsubs.push(unsub);
            });
        });
        return () => unsubs.forEach(u => u());
    }, [workOrders.length, projects.length]);

    // Listener: rejected PreHandover WOs awaiting admin review
    useEffect(() => {
        const phRejected = workOrders.filter((wo: any) =>
            wo.type === 'PreHandover' &&
            wo.status === 'customer_reject' &&
            (wo.pendingAdminReassign === true || wo.reviewedByAdmin === false)
        ).map((wo: any) => ({
            ...wo,
            projectName: projects.find(p => p.id === wo.projectId)?.name || '',
        }));
        setRejectedPhWOs(phRejected);
    }, [workOrders, projects]);

    const handlePhReassignConfirm = async () => {
        if (!selectedRejectedPhWo) return;
        setPhReassignLoading(true);
        try {
            await reviewRejectedPhWO(selectedRejectedPhWo.id, phReassignDate || undefined);
            setSelectedRejectedPhWo(null);
            setPhReassignDate('');
        } catch (err) {
            alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setPhReassignLoading(false);
        }
    };

    const handleRetroApprove = async () => {
        if (!selectedRetroReq) return;
        setRetroActionLoading(true);
        try {
            await approveRetroactiveRequest(selectedRetroReq.id, selectedRetroReq.workOrderId, {
                uid: user?.id || '',
                name: (user as any)?.name || (user as any)?.displayName || 'Admin'
            });
            await sendNotification({
                recipientId: selectedRetroReq.submittedBy?.uid,
                senderId: user?.id || 'admin',
                senderName: (user as any)?.name || 'Admin',
                title: 'คำขอรับรองข้อมูลย้อนหลังได้รับการอนุมัติแล้ว',
                message: `ข้อมูลวันที่ ${selectedRetroReq.requestDate} สำหรับงาน "${selectedRetroReq.context?.taskName}" ถูกบันทึกลงระบบแล้ว`,
                type: 'success',
                targetPath: `/daily-report`
            });
            setSelectedRetroReq(null);
            setModalAlert({ isOpen: true, title: 'อนุมัติสำเร็จ', message: 'ข้อมูลถูกบันทึกลงระบบเรียบร้อยแล้ว และแจ้งเตือนโฟรแมนแล้ว', type: 'success' });
        } catch (err: any) {
            setModalAlert({ isOpen: true, title: 'เกิดข้อผิดพลาด', message: err.message || 'ไม่สามารถอนุมัติได้', type: 'error' });
        } finally {
            setRetroActionLoading(false);
        }
    };

    const handleRetroReject = async () => {
        if (!selectedRetroReq || !retroRejectReason.trim()) return;
        setRetroActionLoading(true);
        try {
            await rejectRetroactiveRequest(selectedRetroReq.id, selectedRetroReq.workOrderId, {
                uid: user?.id || '',
                name: (user as any)?.name || (user as any)?.displayName || 'Admin'
            }, retroRejectReason.trim());
            await sendNotification({
                recipientId: selectedRetroReq.submittedBy?.uid,
                senderId: user?.id || 'admin',
                senderName: (user as any)?.name || 'Admin',
                title: 'คำขอรับรองข้อมูลย้อนหลังถูกปฏิเสธ',
                message: `งาน "${selectedRetroReq.context?.taskName}" วันที่ ${selectedRetroReq.requestDate}: ${retroRejectReason.trim()}`,
                type: 'warning',
                targetPath: `/daily-report`
            });
            setSelectedRetroReq(null);
            setRetroRejectReason('');
            setShowRejectInput(false);
            setModalAlert({ isOpen: true, title: 'ปฏิเสธสำเร็จ', message: 'ส่งการแจ้งเตือนกลับไปยังโฟรแมนแล้ว', type: 'info' });
        } catch (err: any) {
            setModalAlert({ isOpen: true, title: 'เกิดข้อผิดพลาด', message: err.message || 'ไม่สามารถปฏิเสธได้', type: 'error' });
        } finally {
            setRetroActionLoading(false);
        }
    };

    const handlePhRetroApprove = async () => {
        if (!selectedPhRetroReq) return;
        setPhRetroActionLoading(true);
        try {
            await approvePhRetroactiveRequest(
                selectedPhRetroReq.woId,
                selectedPhRetroReq.catId,
                selectedPhRetroReq.id,
                { uid: user?.id || '', name: (user as any)?.name || 'Admin' }
            );
            await sendNotification({
                recipientId: selectedPhRetroReq.requestedById,
                senderId: user?.id || 'admin',
                senderName: (user as any)?.name || 'Admin',
                title: 'คำขอรับรองย้อนหลัง (ก่อนโอน) ได้รับการอนุมัติแล้ว',
                message: `วันที่ ${selectedPhRetroReq.id} หมวด "${selectedPhRetroReq.catName}" ถูกปลดล็อค 48 ชั่วโมง — กรุณากรอกรายงานและส่งได้เลย`,
                type: 'success',
                targetPath: `/daily-report`
            });
            setSelectedPhRetroReq(null);
            setModalAlert({ isOpen: true, title: 'อนุมัติสำเร็จ', message: 'ปลดล็อควันที่แล้ว โฟรแมนสามารถกรอกรายงานย้อนหลังได้ภายใน 48 ชั่วโมง', type: 'success' });
        } catch (err: any) {
            setModalAlert({ isOpen: true, title: 'เกิดข้อผิดพลาด', message: err.message || 'ไม่สามารถอนุมัติได้', type: 'error' });
        } finally {
            setPhRetroActionLoading(false);
        }
    };

    const handlePhRetroReject = async () => {
        if (!selectedPhRetroReq || !phRetroRejectReason.trim()) return;
        setPhRetroActionLoading(true);
        try {
            await rejectPhRetroactiveRequest(
                selectedPhRetroReq.woId,
                selectedPhRetroReq.catId,
                selectedPhRetroReq.id,
                { uid: user?.id || '', name: (user as any)?.name || 'Admin' },
                phRetroRejectReason.trim()
            );
            await sendNotification({
                recipientId: selectedPhRetroReq.requestedById,
                senderId: user?.id || 'admin',
                senderName: (user as any)?.name || 'Admin',
                title: 'คำขอรับรองย้อนหลัง (ก่อนโอน) ถูกปฏิเสธ',
                message: `หมวด "${selectedPhRetroReq.catName}" วันที่ ${selectedPhRetroReq.id}: ${phRetroRejectReason.trim()}`,
                type: 'warning',
                targetPath: `/daily-report`
            });
            setSelectedPhRetroReq(null);
            setPhRetroRejectReason('');
            setShowPhRejectInput(false);
            setModalAlert({ isOpen: true, title: 'ปฏิเสธสำเร็จ', message: 'ส่งการแจ้งเตือนกลับไปยังโฟรแมนแล้ว', type: 'info' });
        } catch (err: any) {
            setModalAlert({ isOpen: true, title: 'เกิดข้อผิดพลาด', message: err.message || 'ไม่สามารถปฏิเสธได้', type: 'error' });
        } finally {
            setPhRetroActionLoading(false);
        }
    };

    const handleTaskReviewClick = (task: MasterTask) => {
        if (selectedWorkOrder?.status === 'customer_reject') {
            setAssigningTask(task);
        } else {
            setCurrentTask(task);
            setIsEvalModalOpen(true);
        }
    };

    const handleModalConfirm = async (updates: Partial<MasterTask>) => {
        if (!currentTask || !selectedWorkOrder) return;

        const status = updates.status as 'Assigned' | 'Rejected';
        setTaskDecisions(prev => ({ ...prev, [currentTask.id]: status }));

        // ✅ 1. Compute the updated categories array for the work order
        const updatedCategories = selectedWorkOrder.categories.map(cat => ({
            ...cat,
            tasks: cat.tasks.map(t => t.id === currentTask.id ? { ...t, ...updates } : t)
        }));

        // ✅ 2. Compute final Work Order status (single source of truth — deriveWoStatus, same rules everywhere)
        const allTasks = updatedCategories.flatMap(c => c.tasks);
        const finalWoStatus = deriveWoStatus(allTasks);
        // Count tasks still awaiting an admin decision (used below to auto-close the modal).
        const pendingCount = allTasks.filter(t => t.status === 'Evaluating').length;

        // ✅ 3. Save directly to Firestore
        try {
            await saveEvaluation(selectedWorkOrder.id, finalWoStatus, updatedCategories);

            // Workstream C: audit the admin decision (approve/reject) for this task
            logService.trackAction({
                userId: user?.id || 'system',
                userName: (user as any)?.name || 'Admin',
                role: (user as any)?.role || 'Admin',
                action: status === 'Rejected' ? 'REJECT' : 'APPROVE',
                module: 'EVALUATION',
                targetId: `${selectedWorkOrder.id}/${currentTask.id}`,
                details: `${status === 'Rejected' ? 'ปฏิเสธ' : 'อนุมัติ'}งาน: ${currentTask.name} (สถานะ WO → ${finalWoStatus})`
            });

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

    const handlePreHandoverConfirm = async (
        confirmedSla: string,
        assignments: { catId: string; foremanId: string; foremanName: string }[],
        scheduledDate: string
    ) => {
        if (!selectedWorkOrder) return;
        const woId = selectedWorkOrder.id;
        const woLocation = selectedWorkOrder.locationName || woId;
        await approvePreHandoverWO(woId, confirmedSla, assignments, scheduledDate);

        // Notify each unique assigned foreman
        const notifiedForemen = new Set<string>();
        for (const a of assignments) {
            if (!a.foremanId || notifiedForemen.has(a.foremanId)) continue;
            notifiedForemen.add(a.foremanId);
            try {
                await sendNotification({
                    recipientId: a.foremanId,
                    senderId: user?.id || 'admin',
                    senderName: user?.name || 'Admin',
                    title: 'ได้รับมอบหมายงานตรวจรับก่อนโอน',
                    message: `คุณได้รับมอบหมายงานตรวจรับ ${woId} (${woLocation}) กำหนดแล้วเสร็จ: ${confirmedSla}`,
                    type: 'info',
                    targetPath: `/daily-report?id=${woId}`,
                });
            } catch (err) {
                console.error('Failed to send PreHandover assignment notification:', err);
            }
        }

        setIsPreHandoverAssignOpen(false);
        setIsDetailModalOpen(false);
        setSelectedWorkOrder(null);
        setModalAlert({
            isOpen: true,
            title: 'อนุมัติสำเร็จ',
            message: `มอบหมายงานตรวจรับ ${woId} เรียบร้อยแล้ว`,
            type: 'success'
        });
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
                    onPreHandoverAssign={selectedWorkOrder.type === 'PreHandover' && selectedWorkOrder.status === 'Evaluating'
                        ? () => setIsPreHandoverAssignOpen(true)
                        : undefined}
                />
            )}

            {selectedWorkOrder?.type === 'PreHandover' && isPreHandoverAssignOpen && (
                <PreHandoverAssignModal
                    isOpen={isPreHandoverAssignOpen}
                    onClose={() => setIsPreHandoverAssignOpen(false)}
                    wo={selectedWorkOrder}
                    staffList={staff}
                    onConfirm={handlePreHandoverConfirm}
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
                                .filter(t => t.id !== taskId && t.status === 'Rejected');
                                
                            if (remainingRejected.length === 0) {
                                setIsDetailModalOpen(false);
                                setSelectedWorkOrder(null);
                            }
                        }
                        setAssigningTask(null);
                    }}
                />
            )}

            {assigningHelperTask && (
                <AdminAssignHelperModal
                    isOpen={!!assigningHelperTask}
                    onClose={() => {
                        setAssigningHelperTask(null);
                        setHelperTaskWoId('');
                    }}
                    task={assigningHelperTask}
                    workOrderId={helperTaskWoId}
                    staffList={staff}
                    onAssign={async (foremanIds) => {
                        const category = workOrders.find(w => w.id === helperTaskWoId)?.categories.find(c => c.tasks.some(t => t.id === assigningHelperTask.id));
                        if (category && foremanIds.length > 0) {
                            const primaryForemanId = foremanIds[0];
                            await updateTask(helperTaskWoId, category.id, assigningHelperTask.id, {
                                isPickedUpBySupport: true,
                                assignedForeman: primaryForemanId,
                                helperForemanIds: foremanIds
                            });

                            // Send notification to each helper foreman
                            for (const foremanId of foremanIds) {
                                try {
                                    await sendNotification({
                                        recipientId: foremanId,
                                        senderId: user?.id || 'admin',
                                        senderName: user?.name || 'Admin',
                                        title: 'ได้รับมอบหมายงานช่วย',
                                        message: `คุณได้รับมอบหมายให้เข้าช่วยงาน: ${assigningHelperTask.name} (ใบงาน ${helperTaskWoId})`,
                                        type: 'info',
                                        targetPath: `/daily-report?id=${helperTaskWoId}`
                                    });
                                } catch (err) {
                                    console.error("Failed to send helper assignment notification:", err);
                                }
                            }

                            setModalAlert({
                                isOpen: true,
                                title: 'มอบหมายงานช่วยสำเร็จ',
                                message: `มอบหมายงานช่วย ${assigningHelperTask.name} เรียบร้อยแล้ว`,
                                type: 'success'
                            });
                        }
                        setAssigningHelperTask(null);
                        setHelperTaskWoId('');
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

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginLeft: '4px', marginRight: '4px' }}>
                <button
                    onClick={() => setActiveTab('evaluation')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: 'none',
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: activeTab === 'evaluation' ? '#4f46e5' : '#64748b',
                        borderBottom: activeTab === 'evaluation' ? '3px solid #4f46e5' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <CheckSquare size={18} />
                    ประเมินใบงาน ({pendingWorkOrders.length + rejectedPhWOs.length})
                </button>
                <button
                    onClick={() => setActiveTab('helper')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: 'none',
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: activeTab === 'helper' ? '#4f46e5' : '#64748b',
                        borderBottom: activeTab === 'helper' ? '3px solid #4f46e5' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Users size={18} />
                    จัดสรรงานช่วย ({pendingHelperTasks.length})
                </button>
                <button
                    onClick={() => setActiveTab('retroactive')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: 'none',
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: activeTab === 'retroactive' ? '#ea580c' : '#64748b',
                        borderBottom: activeTab === 'retroactive' ? '3px solid #ea580c' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <History size={18} />
                    อนุมัติข้อมูลย้อนหลัง
                    {(pendingRetroReqs.length + pendingPhRetroReqs.length) > 0 && (
                        <span style={{ background: '#ea580c', color: '#fff', borderRadius: '999px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 900 }}>
                            {pendingRetroReqs.length + pendingPhRetroReqs.length}
                        </span>
                    )}
                </button>
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
                                .filter(p => {
                                    if (activeTab === 'evaluation') {
                                        return workOrders.some(wo => wo.projectId === p.id && !wo.isArchived && (
                                            wo.status === 'Evaluating' ||
                                            (wo.categories || []).some(c => (c.tasks || []).some(t => t.status === 'Evaluating'))
                                        ));
                                    } else {
                                        return workOrders.some(wo => wo.projectId === p.id && wo.categories.some(c => c.tasks.some(t => t.isSupportRequest === true && t.isPickedUpBySupport !== true)));
                                    }
                                })
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
                {activeTab === 'retroactive' ? (
                    (pendingRetroReqs.length + pendingPhRetroReqs.length) === 0 ? (
                        <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#64748b', background: '#ffffff', borderRadius: '32px', border: '2px dashed #e2e8f0', gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#475569' }}>ไม่มีคำขอรับรองข้อมูลย้อนหลัง</div>
                            <div style={{ fontSize: '1rem', color: '#94a3b8', marginTop: '8px' }}>คำขอจากโฟรแมนจะปรากฏขึ้นที่นี่</div>
                        </div>
                    ) : (
                        <>
                        {pendingRetroReqs.map(req => {
                            const daysAgo = req.requestDate ? Math.floor((Date.now() - new Date(req.requestDate).getTime()) / 86400000) : 0;
                            const laborCount = req.payload?.labor?.length || 0;
                            const submittedAt = req.submittedAt ? new Date(req.submittedAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
                            return (
                                <div
                                    key={req.id}
                                    onClick={() => { setSelectedRetroReq(req); setShowRejectInput(false); setRetroRejectReason(''); }}
                                    style={{
                                        background: '#ffffff', padding: '20px 24px', borderRadius: '20px',
                                        border: '1.5px solid #fed7aa', boxShadow: '0 4px 6px -1px rgba(234,88,12,0.07)',
                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '10px'
                                    }}
                                    onMouseOver={e => (e.currentTarget.style.boxShadow = '0 8px 16px rgba(234,88,12,0.15)')}
                                    onMouseOut={e => (e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(234,88,12,0.07)')}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 900, background: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                                            ย้อนหลัง {daysAgo} วัน
                                        </span>
                                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#64748b', fontWeight: 700 }}>{req.workOrderId}</span>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', marginBottom: '2px' }}>{req.context?.taskName || 'งาน'}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{req.context?.categoryName}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem', color: '#475569' }}>
                                        <div>📅 วันที่ขอแก้: <strong>{req.requestDate}</strong></div>
                                        <div>📍 {req.context?.locationName || '-'} · {req.context?.projectName || '-'}</div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <span>📊 โปรเกรส: <strong>{req.payload?.progress ?? '-'}%</strong></span>
                                            <span>👷 คนงาน: <strong>{laborCount} คน</strong></span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                                        <UserCircle size={14} color="#94a3b8" />
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{req.submittedBy?.name || 'โฟรแมน'}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 'auto' }}>{submittedAt}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {pendingPhRetroReqs.map(req => {
                            const daysAgo = req.id ? Math.floor((Date.now() - new Date(req.id).getTime()) / 86400000) : 0;
                            const requestedAt = req.requestedAt ? new Date(req.requestedAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
                            return (
                                <div
                                    key={`ph-${req.woId}-${req.catId}-${req.id}`}
                                    onClick={() => { setSelectedPhRetroReq(req); setShowPhRejectInput(false); setPhRetroRejectReason(''); }}
                                    style={{
                                        background: '#ffffff', padding: '20px 24px', borderRadius: '20px',
                                        border: '1.5px solid #99f6e4', boxShadow: '0 4px 6px -1px rgba(13,148,136,0.07)',
                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '10px'
                                    }}
                                    onMouseOver={e => (e.currentTarget.style.boxShadow = '0 8px 16px rgba(13,148,136,0.15)')}
                                    onMouseOut={e => (e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(13,148,136,0.07)')}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 900, background: '#f0fdfa', color: '#0d9488', padding: '2px 8px', borderRadius: '6px', border: '1px solid #99f6e4' }}>
                                                🏗️ ก่อนโอน
                                            </span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 900, background: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                                                ย้อนหลัง {daysAgo} วัน
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#64748b', fontWeight: 700 }}>{req.woCode}</span>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', marginBottom: '2px' }}>{req.catName || 'หมวดงาน'}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{req.projectName}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem', color: '#475569' }}>
                                        <div>📅 วันที่ขอแก้: <strong>{req.id}</strong></div>
                                        <div>📍 {req.locationName || '-'}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                                        <UserCircle size={14} color="#0d9488" />
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{req.requestedBy || 'โฟรแมน'}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 'auto' }}>{requestedAt}</span>
                                    </div>
                                </div>
                            );
                        })}
                        </>
                    )
                ) : activeTab === 'evaluation' ? (
                    pendingWorkOrders.length === 0 && rejectedPhWOs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#64748b', background: '#ffffff', borderRadius: '32px', border: '2px dashed #e2e8f0', gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#475569' }}>ไม่พบงานที่รอตรวจสอบ</div>
                            <div style={{ fontSize: '1rem', color: '#94a3b8', marginTop: '8px' }}>รายการที่รอประเมินจะปรากฏขึ้นที่นี่</div>
                        </div>
                    ) : (
                        <>
                            {pendingWorkOrders.map(wo => (
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
                            ))}
                            {rejectedPhWOs.length > 0 && (
                                <>
                                    <div style={{ gridColumn: '1 / -1', marginTop: pendingWorkOrders.length > 0 ? '8px' : 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <div style={{ height: '2px', flex: 1, background: '#fee2e2', borderRadius: '2px' }} />
                                            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                🏗️ ตีกลับ — ก่อนโอน ({rejectedPhWOs.length})
                                            </span>
                                            <div style={{ height: '2px', flex: 1, background: '#fee2e2', borderRadius: '2px' }} />
                                        </div>
                                    </div>
                                    {rejectedPhWOs.map((wo: any) => {
                                        const rejectedCats = (wo.categories || []).filter((c: any) => c.customerStatus === 'rejected');
                                        return (
                                            <div
                                                key={wo.id}
                                                onClick={() => { setSelectedRejectedPhWo(wo); setPhReassignDate(''); }}
                                                style={{ background: '#fff5f5', borderRadius: '20px', border: '2px solid #fca5a5', padding: '20px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(239,68,68,0.08)' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 900, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fca5a5' }}>🏗️ ก่อนโอน</span>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 900, background: '#fff1f2', color: '#e11d48', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fda4af' }}>⚠️ ถูกปฏิเสธ</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b' }}>{wo.id}</div>
                                                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{wo.locationName || wo.projectName || '—'}</div>
                                                    </div>
                                                    <button style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '10px', padding: '6px 14px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer' }}>
                                                        มอบหมายใหม่
                                                    </button>
                                                </div>
                                                {rejectedCats.length > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {rejectedCats.map((cat: any) => (
                                                            <div key={cat.id} style={{ fontSize: '0.78rem', color: '#dc2626', background: '#fee2e2', padding: '5px 10px', borderRadius: '8px', fontWeight: 700 }}>
                                                                ✕ {cat.name} — {cat.customerRejectReason || 'ไม่ระบุเหตุผล'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </>
                    )
                ) : (
                    pendingHelperTasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#64748b', background: '#ffffff', borderRadius: '32px', border: '2px dashed #e2e8f0', gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#475569' }}>ไม่พบรายการคำขอความช่วยเหลือ</div>
                            <div style={{ fontSize: '1rem', color: '#94a3b8', marginTop: '8px' }}>รายการคำขอคนงานซัพพอร์ตที่ยังไม่ได้รับงานจะแสดงขึ้นที่นี่</div>
                        </div>
                    ) : (
                        pendingHelperTasks.map(({ task, wo }) => {
                            const projName = projects.find(p => p.id === wo.projectId)?.name || 'ไม่ระบุโครงการ';
                            return (
                                <div 
                                    key={task.id}
                                    style={{
                                        background: '#ffffff',
                                        padding: '24px',
                                        borderRadius: '24px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '12px'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 900, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                                งานช่วย (Support)
                                            </span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', fontFamily: 'monospace' }}>
                                                {wo.id}
                                            </span>
                                        </div>
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                                            {task.name || (task as any).taskName}
                                            {task.subtaskName && task.subtaskName !== (task.name || (task as any).taskName) && (
                                                <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5', marginTop: '4px' }}>
                                                    ชื่องานย่อย: {task.subtaskName}
                                                </span>
                                            )}
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#475569' }}>
                                            <div><strong>โครงการ:</strong> {projName}</div>
                                            <div><strong>สถานที่:</strong> {wo.locationName || '-'}</div>
                                            <div><strong>ผู้ขอความช่วยเหลือ:</strong> {wo.reporterName || 'โฟร์แมนหลัก'}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setHelperTaskWoId(wo.id);
                                            setAssigningHelperTask(task);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '12px',
                                            border: 'none',
                                            background: '#3b82f6',
                                            color: '#ffffff',
                                            fontWeight: 800,
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                                        onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
                                    >
                                        จัดสรรโฟร์แมนช่วย
                                    </button>
                                </div>
                            );
                        })
                    )
                )}
            </div>

            {selectedRetroReq && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                    <div style={{ background: '#ffffff', borderRadius: '24px', padding: '2rem', width: '540px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#fff7ed', padding: '10px', borderRadius: '12px', color: '#ea580c' }}>
                                <History size={22} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>อนุมัติข้อมูลย้อนหลัง</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{selectedRetroReq.workOrderId}</p>
                            </div>
                            <button onClick={() => { setSelectedRetroReq(null); setShowRejectInput(false); setRetroRejectReason(''); }} style={{ border: 'none', background: '#f1f5f9', borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', color: '#64748b', fontWeight: 800, fontSize: '1rem' }}>✕</button>
                        </div>

                        {/* Context info */}
                        <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.83rem', color: '#475569' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>{selectedRetroReq.context?.taskName}</div>
                            <div><strong>หมวดงาน:</strong> {selectedRetroReq.context?.categoryName || '-'}</div>
                            <div><strong>โครงการ:</strong> {selectedRetroReq.context?.projectName || '-'}</div>
                            <div><strong>สถานที่:</strong> {selectedRetroReq.context?.locationName || '-'}</div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                                <span><strong>วันที่ขอแก้:</strong> {selectedRetroReq.requestDate}</span>
                                <span><strong>ย้อนหลัง:</strong> {Math.floor((Date.now() - new Date(selectedRetroReq.requestDate).getTime()) / 86400000)} วัน</span>
                            </div>
                        </div>

                        {/* Payload */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, background: '#eff6ff', borderRadius: '12px', padding: '10px 14px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8' }}>{selectedRetroReq.payload?.progress ?? '-'}%</div>
                                    <div style={{ fontSize: '0.73rem', color: '#3b82f6', fontWeight: 700 }}>ความคืบหน้า</div>
                                </div>
                                <div style={{ flex: 1, background: '#f0fdf4', borderRadius: '12px', padding: '10px 14px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a' }}>{selectedRetroReq.payload?.labor?.length || 0}</div>
                                    <div style={{ fontSize: '0.73rem', color: '#22c55e', fontWeight: 700 }}>คนงาน (คน)</div>
                                </div>
                                <div style={{ flex: 1, background: '#fdf4ff', borderRadius: '12px', padding: '10px 14px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed', marginTop: '2px' }}>{selectedRetroReq.payload?.type || '-'}</div>
                                    <div style={{ fontSize: '0.73rem', color: '#a855f7', fontWeight: 700 }}>ประเภทงาน</div>
                                </div>
                            </div>

                            {selectedRetroReq.payload?.labor?.length > 0 && (
                                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px 14px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>รายการคนงาน</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        {selectedRetroReq.payload.labor.map((l: any, i: number) => (
                                            <div key={i} style={{ fontSize: '0.78rem', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{l.name || l.id || `คนงาน ${i + 1}`}</span>
                                                <span style={{ color: '#64748b' }}>{l.hours ? `${l.hours} ชม.` : ''} {l.type ? `(${l.type})` : ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedRetroReq.payload?.note && (
                                <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '10px 14px', border: '1px solid #fde68a' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400e', marginBottom: '4px' }}>หมายเหตุ</div>
                                    <div style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.5 }}>{selectedRetroReq.payload.note}</div>
                                </div>
                            )}

                            {selectedRetroReq.payload?.photos && Object.keys(selectedRetroReq.payload.photos).length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>รูปภาพ ({Object.values(selectedRetroReq.payload.photos).flat().length} รูป)</div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {(Object.values(selectedRetroReq.payload.photos).flat() as string[]).slice(0, 6).map((url, i) => (
                                            <img key={i} src={url} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} alt="" />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submitter info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f1f5f9', borderRadius: '12px', fontSize: '0.78rem', color: '#475569' }}>
                            <UserCircle size={16} color="#94a3b8" />
                            <span><strong>ผู้ส่งคำขอ:</strong> {selectedRetroReq.submittedBy?.name || 'โฟรแมน'}</span>
                            <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
                                {selectedRetroReq.submittedAt ? new Date(selectedRetroReq.submittedAt).toLocaleString('th-TH') : ''}
                            </span>
                        </div>

                        {/* Reject reason input */}
                        {showRejectInput && (
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dc2626', marginBottom: '6px' }}>เหตุผลที่ปฏิเสธ (จำเป็น)</div>
                                <textarea
                                    value={retroRejectReason}
                                    onChange={e => setRetroRejectReason(e.target.value)}
                                    placeholder="ระบุเหตุผล..."
                                    rows={3}
                                    style={{ width: '100%', borderRadius: '12px', border: '1.5px solid #fca5a5', padding: '10px 12px', fontSize: '0.85rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                />
                            </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {!showRejectInput ? (
                                <>
                                    <button
                                        onClick={() => setShowRejectInput(true)}
                                        disabled={retroActionLoading}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        ปฏิเสธ
                                    </button>
                                    <button
                                        onClick={handleRetroApprove}
                                        disabled={retroActionLoading}
                                        style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: retroActionLoading ? '#86efac' : '#16a34a', color: '#fff', fontSize: '0.85rem', fontWeight: 900, cursor: retroActionLoading ? 'wait' : 'pointer' }}
                                    >
                                        {retroActionLoading ? 'กำลังบันทึก...' : 'อนุมัติ'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { setShowRejectInput(false); setRetroRejectReason(''); }}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={handleRetroReject}
                                        disabled={retroActionLoading || !retroRejectReason.trim()}
                                        style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: retroActionLoading || !retroRejectReason.trim() ? '#fca5a5' : '#dc2626', color: '#fff', fontSize: '0.85rem', fontWeight: 900, cursor: retroActionLoading || !retroRejectReason.trim() ? 'not-allowed' : 'pointer' }}
                                    >
                                        {retroActionLoading ? 'กำลังส่ง...' : 'ยืนยันปฏิเสธ'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedRejectedPhWo && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                    <div style={{ background: '#ffffff', borderRadius: '24px', padding: '2rem', width: '520px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '12px' }}><AlertCircle size={22} color="#dc2626" /></div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>มอบหมายรอบการแก้ไขใหม่ — ก่อนโอน</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>{selectedRejectedPhWo.id}</p>
                            </div>
                            <button onClick={() => setSelectedRejectedPhWo(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', color: '#64748b', fontWeight: 800 }}>✕</button>
                        </div>

                        {/* Rejected categories */}
                        <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#dc2626', marginBottom: '4px' }}>หมวดงานที่ถูกปฏิเสธ:</div>
                            {(selectedRejectedPhWo.categories || []).filter((c: any) => c.customerStatus === 'rejected').map((cat: any) => (
                                <div key={cat.id} style={{ fontSize: '0.82rem', color: '#7f1d1d', background: '#fee2e2', padding: '6px 10px', borderRadius: '8px', fontWeight: 700 }}>
                                    ✕ {cat.name}
                                    {cat.customerRejectReason && <div style={{ fontSize: '0.75rem', fontWeight: 400, marginTop: '2px', color: '#991b1b' }}>{cat.customerRejectReason}</div>}
                                </div>
                            ))}
                        </div>

                        {/* New scheduled date */}
                        <div>
                            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>วันที่นัดดำเนินการใหม่ (ไม่บังคับ)</label>
                            <input
                                type="date"
                                value={phReassignDate}
                                onChange={e => setPhReassignDate(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                            />
                        </div>

                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '10px 14px', fontSize: '0.8rem', color: '#92400e' }}>
                            การยืนยันจะ: ปลดล็อคใบงาน → โฟรแมนแก้ไขหมวดงานที่ถูกปฏิเสธ → กด progress ครบ 100% → สร้าง QR ส่งมอบใหม่
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setSelectedRejectedPhWo(null)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer' }}>ยกเลิก</button>
                            <button
                                onClick={handlePhReassignConfirm}
                                disabled={phReassignLoading}
                                style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: phReassignLoading ? '#fca5a5' : '#dc2626', color: '#fff', fontSize: '0.85rem', fontWeight: 900, cursor: phReassignLoading ? 'not-allowed' : 'pointer' }}
                            >
                                {phReassignLoading ? 'กำลังมอบหมาย...' : '✓ ยืนยันมอบหมายรอบใหม่'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPhRetroReq && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                    <div style={{ background: '#ffffff', borderRadius: '24px', padding: '2rem', width: '540px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#f0fdfa', padding: '10px', borderRadius: '12px', color: '#0d9488' }}>
                                <History size={22} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>อนุมัติย้อนหลัง — ตรวจรับก่อนโอน</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#0d9488', fontWeight: 600 }}>{selectedPhRetroReq.woCode}</p>
                            </div>
                            <button onClick={() => { setSelectedPhRetroReq(null); setShowPhRejectInput(false); setPhRetroRejectReason(''); }} style={{ border: 'none', background: '#f1f5f9', borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', color: '#64748b', fontWeight: 800, fontSize: '1rem' }}>✕</button>
                        </div>

                        {/* Info */}
                        <div style={{ background: '#f0fdfa', borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.83rem', color: '#475569', border: '1px solid #99f6e4' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>{selectedPhRetroReq.catName}</div>
                            <div><strong>โครงการ:</strong> {selectedPhRetroReq.projectName || '-'}</div>
                            <div><strong>สถานที่:</strong> {selectedPhRetroReq.locationName || '-'}</div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                                <span><strong>วันที่ขอแก้:</strong> {selectedPhRetroReq.id}</span>
                                <span><strong>ย้อนหลัง:</strong> {Math.floor((Date.now() - new Date(selectedPhRetroReq.id).getTime()) / 86400000)} วัน</span>
                            </div>
                        </div>

                        {/* Notice */}
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 14px', fontSize: '0.82rem', color: '#92400e', lineHeight: 1.6 }}>
                            <strong>การอนุมัติจะ:</strong> ปลดล็อควันที่นี้ให้โฟรแมนสามารถกรอกและส่งรายงานได้ภายใน <strong>48 ชั่วโมง</strong> โดยไม่มีการเขียนข้อมูลลงระบบโดยตรง โฟรแมนต้องกรอกและยืนยันรายงานด้วยตนเอง
                        </div>

                        <div><strong style={{ fontSize: '0.82rem', color: '#475569' }}>ผู้ส่งคำขอ:</strong> {selectedPhRetroReq.requestedBy || 'โฟรแมน'} · {selectedPhRetroReq.requestedAt ? new Date(selectedPhRetroReq.requestedAt).toLocaleString('th-TH') : ''}</div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {!showPhRejectInput ? (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => setShowPhRejectInput(true)}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#ef4444', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer' }}
                                    >
                                        ปฏิเสธ
                                    </button>
                                    <button
                                        onClick={handlePhRetroApprove}
                                        disabled={phRetroActionLoading}
                                        style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: phRetroActionLoading ? '#99f6e4' : '#0d9488', color: '#fff', fontSize: '0.85rem', fontWeight: 900, cursor: phRetroActionLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px rgba(13,148,136,0.2)' }}
                                    >
                                        {phRetroActionLoading ? 'กำลังดำเนินการ...' : '✓ อนุมัติ — ปลดล็อควันที่'}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <textarea
                                        value={phRetroRejectReason}
                                        onChange={e => setPhRetroRejectReason(e.target.value)}
                                        placeholder="ระบุเหตุผลที่ปฏิเสธ..."
                                        rows={3}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #fca5a5', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                                    />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => setShowPhRejectInput(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer' }}>ยกเลิก</button>
                                        <button
                                            onClick={handlePhRetroReject}
                                            disabled={phRetroActionLoading || !phRetroRejectReason.trim()}
                                            style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: phRetroActionLoading || !phRetroRejectReason.trim() ? '#fca5a5' : '#dc2626', color: '#fff', fontSize: '0.85rem', fontWeight: 900, cursor: phRetroActionLoading || !phRetroRejectReason.trim() ? 'not-allowed' : 'pointer' }}
                                        >
                                            {phRetroActionLoading ? 'กำลังส่ง...' : 'ยืนยันปฏิเสธ'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
