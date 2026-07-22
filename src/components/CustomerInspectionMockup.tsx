import { useState, useEffect } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { WorkOrder } from '../types';
import { Star, Sparkles, Building2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';


interface CustomerInspectionMockupProps {
    isOpen: boolean;
    onClose: () => void;
    workOrder: WorkOrder;
    onSubmitInspection: (
        approvals: Record<string, { 
            status: 'approved' | 'rejected'; 
            reason?: string; 
            defectCategories?: Record<string, boolean>;
            contactName?: string;
            contactPhone?: string;
        }>,
        survey?: {
            workQuality: number;
            siteCleanliness: number;
            foremanProfessionalism: number;
            specAccuracy: number;
            handoverCare: number;
        }
    ) => Promise<void>;
}

const getAfterPhotos = (task: any): string[] => {
    const photosList: string[] = [];
    if (task.history && task.history.length > 0) {
        const entry100 = task.history.find((h: any) => Number(h.progress) === 100 || Number(h.dailyProgress) === 100);
        if (entry100) {
            const h = entry100;
            if (h.photos) {
                const photos = h.photos;
                if (Array.isArray(photos)) {
                    photos.forEach((p: any) => { if (p) photosList.push(p); });
                } else if (typeof photos === 'object') {
                    const siteArr = photos.site;
                    if (Array.isArray(siteArr)) {
                        siteArr.forEach((p: any) => { if (p) photosList.push(p); });
                    }
                }
            }
        }
    }
    return Array.from(new Set(photosList.filter(Boolean)));
};

export default function CustomerInspectionMockup({
    isOpen,
    onClose,
    workOrder,
    onSubmitInspection
}: CustomerInspectionMockupProps) {
    // approvals state: key is taskId, value is decision
    const [approvals, setApprovals] = useState<Record<string, { 
        status: 'approved' | 'rejected'; 
        reason?: string; 
        defectCategories?: Record<string, boolean>;
        contactName?: string;
        contactPhone?: string;
    }>>({});
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
    const { logCustomerQrView } = useWorkOrders();
    const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
    const [lightboxActiveIdx, setLightboxActiveIdx] = useState<number>(0);
    const [lightboxTaskId, setLightboxTaskId] = useState<string | null>(null);
    const [activePhotoIndices, setActivePhotoIndices] = useState<Record<string, number>>({});

    // Form inputs for Rejected items
    const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
    const [defectCategories, setDefectCategories] = useState<Record<string, Record<string, boolean>>>({});
    const [contactNames, setContactNames] = useState<Record<string, string>>({});
    const [contactPhones, setContactPhones] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen && workOrder.id) {
            logCustomerQrView(workOrder.id);
            
            // Pre-populate contact name and phone from existing task data if present
            const names: Record<string, string> = {};
            const phones: Record<string, string> = {};
            
            workOrder.categories?.forEach(cat => {
                cat.tasks?.forEach(task => {
                    if (task.contactName) {
                        names[task.id] = task.contactName;
                    }
                    if (task.contactPhone) {
                        phones[task.id] = task.contactPhone;
                    }
                });
            });
            
            setContactNames(names);
            setContactPhones(phones);
        }
    }, [isOpen, workOrder.id, workOrder.categories]);

    // 5-Star Ratings
    const [workQuality, setWorkQuality] = useState(5);
    const [siteCleanliness, setSiteCleanliness] = useState(5);
    const [foremanProfessionalism, setForemanProfessionalism] = useState(5);
    const [specAccuracy, setSpecAccuracy] = useState(5);
    const [handoverCare, setHandoverCare] = useState(5);

    if (!isOpen) return null;

    // Filter tasks that are completed and eligible for customer review
    // 🛡️ CRITICAL RULE: Only exclude tasks when WO is still pending admin re-assignment
    // a customer-rejected task (status='Evaluating', rev>00) is NOT a blocker — it may have been re-worked after admin re-assigned
    const isWoPendingReassign = 
        (workOrder as any).pendingAdminReassign === true ||
        ((workOrder as any).pendingAdminReassign === undefined && (workOrder as any).reviewedByAdmin === false && workOrder.status === 'Rejected');
    const eligibleTasks = workOrder.categories.flatMap(cat => 
        cat.tasks.filter(task => {
            const hasCompletedProgress = task.dailyProgress === 100;
            const notYetVerified = task.status !== 'Complete';
            const notStillRejectedByAdmin = task.status !== 'Rejected' && !isWoPendingReassign;
            return hasCompletedProgress && notYetVerified && notStillRejectedByAdmin;
        })
    );

    const handleSelectAction = (taskId: string, status: 'approved' | 'rejected') => {
        const incompleteRejectTask = eligibleTasks.find(t => 
            approvals[t.id]?.status === 'rejected' && (
                !rejectReasons[t.id]?.trim() || 
                !contactNames[t.id]?.trim() || 
                !contactPhones[t.id]?.trim()
            )
        );
        
        if (incompleteRejectTask && incompleteRejectTask.id !== taskId) {
            alert(`กรุณากรอกข้อมูลสาเหตุ ชื่อติดต่อกลับ และเบอร์โทร สำหรับการสั่งแก้ไข (Reject) รายการ "${incompleteRejectTask.name || incompleteRejectTask.taskName}" ก่อนทำการประเมินรายการอื่น`);
            return;
        }

        setApprovals(prev => {
            const current = prev[taskId];
            if (current && current.status === status) {
                const next = { ...prev };
                delete next[taskId];
                return next;
            }
            return {
                ...prev,
                [taskId]: {
                    status,
                    reason: status === 'rejected' ? rejectReasons[taskId] || '' : undefined,
                    defectCategories: status === 'rejected' ? defectCategories[taskId] || {} : undefined,
                    contactName: status === 'rejected' ? contactNames[taskId] || '' : undefined,
                    contactPhone: status === 'rejected' ? contactPhones[taskId] || '' : undefined,
                }
            };
        });

        if (status === 'rejected') {
            setExpandedTaskIds(prev => ({ ...prev, [taskId]: true }));
        }
    };

    const handleToggleExpand = (taskId: string) => {
        const incompleteRejectTask = eligibleTasks.find(t => 
            approvals[t.id]?.status === 'rejected' && (
                !rejectReasons[t.id]?.trim() || 
                !contactNames[t.id]?.trim() || 
                !contactPhones[t.id]?.trim()
            )
        );
        
        if (incompleteRejectTask) {
            if (incompleteRejectTask.id !== taskId) {
                alert(`กรุณากรอกข้อมูลสาเหตุ ชื่อติดต่อกลับ และเบอร์โทร สำหรับการสั่งแก้ไข (Reject) รายการ ${incompleteRejectTask.id} ก่อนจึงจะสามารถเปิดรายการอื่นได้`);
                return;
            } else {
                alert('กรุณากรอกข้อมูลสาเหตุ ชื่อติดต่อกลับ และเบอร์โทร สำหรับการสั่งแก้ไข (Reject) ให้เรียบร้อยก่อนปิดรายการนี้');
                return;
            }
        }
        
        setExpandedTaskIds(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    };

    const handleRejectReasonChange = (taskId: string, reason: string) => {
        setRejectReasons(prev => ({ ...prev, [taskId]: reason }));
        if (approvals[taskId]?.status === 'rejected') {
            setApprovals(prev => ({
                ...prev,
                [taskId]: {
                    ...prev[taskId],
                    reason: reason
                }
            }));
        }
    };

    const handleContactNameChange = (taskId: string, name: string) => {
        setContactNames(prev => ({ ...prev, [taskId]: name }));
        if (approvals[taskId]?.status === 'rejected') {
            setApprovals(prev => ({
                ...prev,
                [taskId]: {
                    ...prev[taskId],
                    contactName: name
                }
            }));
        }
    };

    const handleContactPhoneChange = (taskId: string, phone: string) => {
        setContactPhones(prev => ({ ...prev, [taskId]: phone }));
        if (approvals[taskId]?.status === 'rejected') {
            setApprovals(prev => ({
                ...prev,
                [taskId]: {
                    ...prev[taskId],
                    contactPhone: phone
                }
            }));
        }
    };

    const handleToggleDefect = (taskId: string, category: string) => {
        const prevCats = defectCategories[taskId] || {};
        const updated = { ...prevCats, [category]: !prevCats[category] };
        setDefectCategories(prev => ({ ...prev, [taskId]: updated }));
        
        if (approvals[taskId]?.status === 'rejected') {
            setApprovals(prev => ({
                ...prev,
                [taskId]: {
                    ...prev[taskId],
                    defectCategories: updated
                }
            }));
        }
    };

    const handleFinalSubmit = async () => {
        // Validation: Verify all eligible tasks have an action selected
        const unactedTasks = eligibleTasks.filter(t => !approvals[t.id]);
        if (unactedTasks.length > 0) {
            alert('กรุณาทำการประเมิน (ผ่าน / แก้ไข) ให้ครบถ้วนทุกรายการก่อนกดส่งมอบงาน');
            return;
        }

        // Validate that rejected items have a reason, name, and phone
        const invalidRejects = eligibleTasks.filter(t => 
            approvals[t.id]?.status === 'rejected' && (
                !rejectReasons[t.id]?.trim() || 
                !contactNames[t.id]?.trim() || 
                !contactPhones[t.id]?.trim()
            )
        );
        if (invalidRejects.length > 0) {
            alert('กรุณาระบุสาเหตุ ชื่อผู้แจ้ง และเบอร์โทรติดต่อกลับ สำหรับรายการที่สั่งแก้ไข (Reject)');
            return;
        }

        setIsSubmitting(true);
        try {
            const hasRejections = Object.values(approvals).some(a => a.status === 'rejected');
            const surveyPayload = hasRejections ? undefined : {
                workQuality,
                siteCleanliness,
                foremanProfessionalism,
                specAccuracy,
                handoverCare
            };

            await onSubmitInspection(approvals, surveyPayload);
            if (hasRejections) {
                alert('เราได้รับข้อมูลจุดที่ต้องแก้ไขเรียบร้อยแล้ว ทางทีมงานจะรีบดำเนินการแก้ไขให้เสร็จสิ้นโดยเร็วที่สุดค่ะ');
            } else {
                alert('บันทึกการประเมินและตรวจรับงานเรียบร้อยแล้ว ขอบคุณที่ไว้วางใจเลือกใช้บริการของเราค่ะ');
            }
            onClose();
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการบันทึกการตรวจรับงาน');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isAllApproved = eligibleTasks.length > 0 && eligibleTasks.every((task: any) => approvals[task.id]?.status === 'approved');

    const renderRatingSelector = (label: string, value: number, onChange: (val: number) => void) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>{label}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3, 4, 5].map(score => (
                    <button
                        key={score}
                        type="button"
                        onClick={() => onChange(score)}
                        style={{
                            border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px',
                            color: score <= value ? '#eab308' : '#cbd5e1', transition: 'transform 0.1s'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.15)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <Star size={18} fill={score <= value ? 'currentColor' : 'none'} strokeWidth={2} />
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div 
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(16px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 3000, padding: '20px'
            }}
        >
            <div 
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#ffffff', width: '100%', maxWidth: '780px',
                    borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
                    maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '3px 10px', borderRadius: '50px', border: '1px solid #dbeafe', marginBottom: '6px' }}>
                            <Building2 size={12} color="#3b82f6" />
                            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#1e40af', letterSpacing: '0.05em' }}>TTS After Sale Portal</span>
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                            หน้าจอจำลองการส่งมอบงานของลูกค้า (Customer Review Simulation)
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{ background: '#f8fafc', border: '1px solid #cbd5e1', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: '#eef2ff', border: '1px solid #e0e7ff', padding: '14px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 700, color: '#4338ca', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <Sparkles size={18} style={{ flexShrink: 0, color: '#6366f1' }} />
                        <div>
                            <strong>สแกนคิวอาร์โค้ดหน้างาน:</strong> หน้านี้คือระบบหน้าตรวจรับของลูกค้า (Secure Customer Link) แบบไร้ล็อกอิน จำลองแสดงเพื่อส่งผลการตรวจรับย้อนกลับสู่ระบบทันที (แยกสิทธิ์การประเมินจากแอดมินโดยตรง)
                        </div>
                    </div>

                    {/* Eligible subtask list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <h3 style={{ margin: '4px 0 8px 8px', fontSize: '0.85rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>รายการส่งมอบ ({eligibleTasks.length} รายการ)</h3>
                        {eligibleTasks.map((task) => {
                            const isExpanded = !!expandedTaskIds[task.id];
                            const decision = approvals[task.id];
                            
                            return (
                                <div 
                                    key={task.id} 
                                    style={{ 
                                        background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', 
                                        overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                                        borderColor: decision?.status === 'approved' ? '#86efac' : decision?.status === 'rejected' ? '#fca5a5' : '#e2e8f0'
                                    }}
                                >
                                    {/* Collapsible Trigger bar */}
                                    <div 
                                        onClick={() => handleToggleExpand(task.id)}
                                        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#6366f1', background: '#eef2ff', padding: '2px 6px', borderRadius: '4px' }}>{task.id}</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(task.name || '').replace(/\s*\(REV\.\s*\d+\)/gi, '').trim()}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={e => e.stopPropagation()}>
                                            <button 
                                                onClick={() => handleSelectAction(task.id, 'approved')}
                                                style={{ 
                                                    border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                    background: decision?.status === 'approved' ? '#22c55e' : '#f1f5f9',
                                                    color: decision?.status === 'approved' ? '#fff' : '#475569'
                                                }}
                                            >
                                                ผ่าน (Approve)
                                            </button>
                                            <button 
                                                onClick={() => handleSelectAction(task.id, 'rejected')}
                                                style={{ 
                                                    border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                    background: decision?.status === 'rejected' ? '#ef4444' : '#f1f5f9',
                                                    color: decision?.status === 'rejected' ? '#fff' : '#475569'
                                                }}
                                            >
                                                แก้ (Reject)
                                            </button>
                                            <div onClick={() => handleToggleExpand(task.id)} style={{ padding: '4px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Detail Panel */}
                                    {isExpanded && (
                                        <div style={{ padding: '16px 18px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {/* Photo comparisons */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    <span style={{ fontWeight: 800, display: 'block', marginBottom: '4px' }}>ภาพก่อนซ่อม (BEFORE):</span>
                                                    <div 
                                                        onClick={() => {
                                                            if (task.beforePhotoUrl) {
                                                                setLightboxPhotos([task.beforePhotoUrl]);
                                                                setLightboxActiveIdx(0);
                                                                setLightboxTaskId(null);
                                                            }
                                                        }}
                                                        style={{ 
                                                            height: 120, 
                                                            background: '#e2e8f0', 
                                                            borderRadius: '10px', 
                                                            overflow: 'hidden',
                                                            cursor: task.beforePhotoUrl ? 'zoom-in' : 'default',
                                                            position: 'relative'
                                                        }}
                                                    >
                                                        {task.beforePhotoUrl ? (
                                                            <img src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Before" />
                                                        ) : (
                                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>ไม่มีรูปภาพ</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    <span style={{ fontWeight: 800, display: 'block', marginBottom: '4px' }}>ภาพหลังซ่อมเสร็จ (AFTER):</span>
                                                    {(() => {
                                                        const afterPhotos = getAfterPhotos(task);
                                                        const currentIndex = activePhotoIndices[task.id] || 0;
                                                        const currentPhoto = afterPhotos[currentIndex];
                                                        
                                                        return (
                                                            <div style={{ height: 120, background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                                                                {currentPhoto ? (
                                                                    <div 
                                                                        style={{ width: '100%', height: '100%', position: 'relative', cursor: 'zoom-in' }} 
                                                                        onClick={() => {
                                                                            setLightboxPhotos(afterPhotos);
                                                                            setLightboxActiveIdx(currentIndex);
                                                                            setLightboxTaskId(task.id);
                                                                        }}
                                                                    >
                                                                        <img
                                                                            src={currentPhoto}
                                                                            style={{
                                                                                width: '100%',
                                                                                height: '100%',
                                                                                objectFit: 'cover',
                                                                            }}
                                                                            alt={`After Photo ${currentIndex + 1}`}
                                                                        />
                                                                        
                                                                        {/* Floating Left Arrow */}
                                                                        {afterPhotos.length > 1 && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const prevIdx = (currentIndex - 1 + afterPhotos.length) % afterPhotos.length;
                                                                                    setActivePhotoIndices(prev => ({ ...prev, [task.id]: prevIdx }));
                                                                                }}
                                                                                style={{
                                                                                    position: 'absolute',
                                                                                    left: '6px',
                                                                                    top: '50%',
                                                                                    transform: 'translateY(-50%)',
                                                                                    background: 'rgba(15, 23, 42, 0.65)',
                                                                                    border: 'none',
                                                                                    width: '26px',
                                                                                    height: '26px',
                                                                                    borderRadius: '50%',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    color: '#fff',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.2s',
                                                                                    padding: 0
                                                                                }}
                                                                                onMouseOver={e => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)'}
                                                                                onMouseOut={e => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)'}
                                                                            >
                                                                                <ChevronLeft size={16} />
                                                                            </button>
                                                                        )}

                                                                        {/* Floating Right Arrow */}
                                                                        {afterPhotos.length > 1 && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const nextIdx = (currentIndex + 1) % afterPhotos.length;
                                                                                    setActivePhotoIndices(prev => ({ ...prev, [task.id]: nextIdx }));
                                                                                }}
                                                                                style={{
                                                                                    position: 'absolute',
                                                                                    right: '6px',
                                                                                    top: '50%',
                                                                                    transform: 'translateY(-50%)',
                                                                                    background: 'rgba(15, 23, 42, 0.65)',
                                                                                    border: 'none',
                                                                                    width: '26px',
                                                                                    height: '26px',
                                                                                    borderRadius: '50%',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    color: '#fff',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.2s',
                                                                                    padding: 0
                                                                                }}
                                                                                onMouseOver={e => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)'}
                                                                                onMouseOut={e => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)'}
                                                                            >
                                                                                <ChevronRight size={16} />
                                                                            </button>
                                                                        )}

                                                                        {/* Page Indicator Badge */}
                                                                        {afterPhotos.length > 1 && (
                                                                            <div
                                                                                style={{
                                                                                    position: 'absolute',
                                                                                    bottom: '6px',
                                                                                    right: '6px',
                                                                                    background: 'rgba(0, 0, 0, 0.65)',
                                                                                    color: '#fff',
                                                                                    fontSize: '0.62rem',
                                                                                    fontWeight: 800,
                                                                                    padding: '2px 6px',
                                                                                    borderRadius: '4px',
                                                                                    pointerEvents: 'none',
                                                                                    letterSpacing: '0.05em',
                                                                                }}
                                                                            >
                                                                                {currentIndex + 1}/{afterPhotos.length} รูป
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>ไม่มีรูปภาพ</div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>



                                            {/* Defect Diagnostics Form (Unlocked on Reject) */}
                                            {decision?.status === 'rejected' && (
                                                <div style={{ background: '#fff', padding: '14px', borderRadius: '12px', border: '1px solid #fee2e2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#991b1b', display: 'block' }}>📝 ระบุรายละเอียดเพื่อส่งช่างแก้ไขใหม่</span>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                                        {['Cosmetic (ผิวสัมผัส/ความงาม)', 'Functional (การใช้งาน)', 'Cleanliness (ความสะอาด)', 'SpecMismatch (ไม่ตรงสเปก)'].map(defectCat => {
                                                            const isChecked = defectCategories[task.id]?.[defectCat];
                                                            return (
                                                                <button
                                                                    key={defectCat}
                                                                    type="button"
                                                                    onClick={() => handleToggleDefect(task.id, defectCat)}
                                                                    style={{
                                                                        border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                                                        background: isChecked ? '#fecaca' : '#f1f5f9',
                                                                        color: isChecked ? '#b91c1c' : '#475569'
                                                                    }}
                                                                >
                                                                    {defectCat}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Contact Name & Phone Row */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '4px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>
                                                                ชื่อผู้แจ้ง / ติดต่อกลับ <span style={{ color: '#ef4444' }}>*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="ระบุชื่อผู้แจ้ง..."
                                                                value={contactNames[task.id] || ''}
                                                                onChange={e => handleContactNameChange(task.id, e.target.value)}
                                                                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '8px', fontSize: '0.8rem', outline: 'none' }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>
                                                                เบอร์โทรติดต่อกลับ <span style={{ color: '#ef4444' }}>*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="ระบุเบอร์โทรศัพท์..."
                                                                value={contactPhones[task.id] || ''}
                                                                onChange={e => handleContactPhoneChange(task.id, e.target.value)}
                                                                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '8px', fontSize: '0.8rem', outline: 'none' }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <textarea
                                                        rows={2}
                                                        placeholder="ระบุจุดบกพร่องที่ต้องแก้ไขให้ช่างรับทราบด่วน... (ห้ามว่าง)"
                                                        value={rejectReasons[task.id] || ''}
                                                        onChange={e => handleRejectReasonChange(task.id, e.target.value)}
                                                        style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '8px', fontSize: '0.8rem', outline: 'none', resize: 'none' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Overall Satisfaction Survey (Appears ONLY if ALL items are approved) */}
                    {isAllApproved && (
                        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '2px solid #86efac', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 6px 12px rgba(34,197,94,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                                <Sparkles size={20} style={{ color: '#22c55e' }} />
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900 }}>แบบประเมินความพึงพอใจ 5 มิติหลัก (Satisfaction Survey)</h4>
                            </div>
                            <div style={{ width: '100%', height: '1px', background: '#dcfce7', margin: '4px 0' }}></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {renderRatingSelector('1. คุณภาพงานซ่อมแซม (Work Quality)', workQuality, setWorkQuality)}
                                {renderRatingSelector('2. ความเรียบร้อยและความสะอาด (Cleanliness)', siteCleanliness, setSiteCleanliness)}
                                {renderRatingSelector('3. ความเป็นมืออาชีพของโฟร์แมน (Professionalism)', foremanProfessionalism, setForemanProfessionalism)}
                                {renderRatingSelector('4. ความถูกต้องตามข้อกำหนดสเปก (Spec Accuracy)', specAccuracy, setSpecAccuracy)}
                                {renderRatingSelector('5. การดูแลระมัดระวังทรัพย์สิน (Handover Care)', handoverCare, setHandoverCare)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Submit Buttons */}
                <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: '#f8fafc' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '10px 24px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', color: '#475569' }}
                    >
                        ย้อนกลับ
                    </button>
                    <button
                        onClick={handleFinalSubmit}
                        disabled={isSubmitting || eligibleTasks.length === 0}
                        style={{
                            padding: '10px 32px', borderRadius: '12px', border: 'none',
                            background: isSubmitting ? '#94a3b8' : '#3b82f6',
                            color: '#fff', fontSize: '0.85rem', fontWeight: 900, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            boxShadow: isSubmitting ? 'none' : '0 4px 10px rgba(59, 130, 246, 0.2)'
                        }}
                    >
                        {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งผลการประเมิน'}
                    </button>
                </div>
            </div>
            
            {/* Image Lightbox Modal */}
            {lightboxPhotos.length > 0 && (
                <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        setLightboxPhotos([]);
                    }}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(20px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 4000, padding: '20px', cursor: 'zoom-out',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <style dangerouslySetInnerHTML={{__html: `
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes scaleUp {
                            from { transform: scale(0.9); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                    `}} />
                    
                    {/* Floating Left Arrow (Lightbox) */}
                    {lightboxPhotos.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                const prevIdx = (lightboxActiveIdx - 1 + lightboxPhotos.length) % lightboxPhotos.length;
                                setLightboxActiveIdx(prevIdx);
                                if (lightboxTaskId) {
                                    setActivePhotoIndices(prev => ({ ...prev, [lightboxTaskId]: prevIdx }));
                                }
                            }}
                            style={{
                                position: 'absolute',
                                left: '24px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(15, 23, 42, 0.75)',
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                zIndex: 4100,
                                padding: 0
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)';
                                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                            }}
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}

                    {/* Floating Right Arrow (Lightbox) */}
                    {lightboxPhotos.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                const nextIdx = (lightboxActiveIdx + 1) % lightboxPhotos.length;
                                setLightboxActiveIdx(nextIdx);
                                if (lightboxTaskId) {
                                    setActivePhotoIndices(prev => ({ ...prev, [lightboxTaskId]: nextIdx }));
                                }
                            }}
                            style={{
                                position: 'absolute',
                                right: '24px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(15, 23, 42, 0.75)',
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                zIndex: 4100,
                                padding: 0
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)';
                                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                            }}
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}

                    {/* Lightbox Image Container */}
                    <div style={{ position: 'relative', maxWidth: '80vw', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                        <img 
                            src={lightboxPhotos[lightboxActiveIdx]} 
                            style={{ 
                                maxWidth: '100%', 
                                maxHeight: '80vh', 
                                borderRadius: '16px', 
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                                objectFit: 'contain',
                                animation: 'scaleUp 0.2s ease-out',
                                border: '3px solid #fff'
                            }} 
                            alt="Enlarged view" 
                        />
                        <button
                            type="button"
                            onClick={() => setLightboxPhotos([])}
                            style={{
                                position: 'absolute', top: '-16px', right: '-16px',
                                background: '#ef4444', color: '#fff', border: '2px solid #fff',
                                width: '32px', height: '32px', borderRadius: '50%',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                padding: 0
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Page Indicator (Lightbox) */}
                    {lightboxPhotos.length > 1 && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '24px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#fff',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                padding: '6px 16px',
                                borderRadius: '30px',
                                pointerEvents: 'none',
                                letterSpacing: '0.05em',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                                zIndex: 4100
                            }}
                        >
                            รูปที่ {lightboxActiveIdx + 1} จาก {lightboxPhotos.length}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
