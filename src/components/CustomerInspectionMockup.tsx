import { useState, useEffect } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { WorkOrder } from '../types';
import { Star, Sparkles, Building2, ChevronDown, ChevronUp } from 'lucide-react';

interface CustomerInspectionMockupProps {
    isOpen: boolean;
    onClose: () => void;
    workOrder: WorkOrder;
    onSubmitInspection: (
        approvals: Record<string, { status: 'approved' | 'rejected'; reason?: string; defectCategories?: Record<string, boolean> }>,
        survey?: {
            workQuality: number;
            siteCleanliness: number;
            foremanProfessionalism: number;
            specAccuracy: number;
            handoverCare: number;
        }
    ) => Promise<void>;
}

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
        defectCategories?: Record<string, boolean> 
    }>>({});
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const { logCustomerQrView } = useWorkOrders();

    useEffect(() => {
        if (isOpen && workOrder.id) {
            logCustomerQrView(workOrder.id);
        }
    }, [isOpen, workOrder.id]);

    // Form inputs for Rejected items
    const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
    const [defectCategories, setDefectCategories] = useState<Record<string, Record<string, boolean>>>({});

    // 5-Star Ratings
    const [workQuality, setWorkQuality] = useState(5);
    const [siteCleanliness, setSiteCleanliness] = useState(5);
    const [foremanProfessionalism, setForemanProfessionalism] = useState(5);
    const [specAccuracy, setSpecAccuracy] = useState(5);
    const [handoverCare, setHandoverCare] = useState(5);

    if (!isOpen) return null;

    // Filter tasks that are completed and exclude those already verified or pending admin re-evaluation
    // 🛡️ CRITICAL RULE: Never include tasks rejected by admin / pending re-assignment
    const eligibleTasks = workOrder.categories.flatMap(cat => 
        cat.tasks.filter(task => {
            const hasCompletedProgress = task.dailyProgress === 100;
            const notYetVerified = task.status !== 'Verified' && task.status !== 'completed';
            const notRejectedByAdmin = task.status !== 'Rejected' && (task.evaluationStatus as any) !== 'Rejected'; // Exclude admin-rejected tasks!
            return hasCompletedProgress && notYetVerified && notRejectedByAdmin;
        })
    );

    const handleSelectAction = (taskId: string, status: 'approved' | 'rejected') => {
        setApprovals(prev => ({
            ...prev,
            [taskId]: {
                status,
                reason: status === 'rejected' ? rejectReasons[taskId] || '' : undefined,
                defectCategories: status === 'rejected' ? defectCategories[taskId] || {} : undefined
            }
        }));
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

        // Validate that rejected items have a reason
        const invalidRejects = eligibleTasks.filter(t => approvals[t.id]?.status === 'rejected' && !rejectReasons[t.id]?.trim());
        if (invalidRejects.length > 0) {
            alert('กรุณาระบุสาเหตุหรือคำอธิบายสำหรับรายการที่สั่งแก้ไข (Reject)');
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
            alert('บันทึกการส่งมอบและประเมินงานลูกค้าเรียบร้อยแล้ว!');
            onClose();
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการบันทึกการตรวจรับงาน');
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasRejections = Object.values(approvals).some(a => a.status === 'rejected');

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
                            const isExpanded = expandedTaskId === task.id;
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
                                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#6366f1', background: '#eef2ff', padding: '2px 6px', borderRadius: '4px' }}>{task.id}</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</span>
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
                                            <div onClick={() => setExpandedTaskId(isExpanded ? null : task.id)} style={{ padding: '4px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
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
                                                    <div style={{ height: 120, background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                                        {task.beforePhotoUrl ? <img src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Before" /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>ไม่มีรูปภาพ</div>}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    <span style={{ fontWeight: 800, display: 'block', marginBottom: '4px' }}>ภาพหลังซ่อมเสร็จ (AFTER):</span>
                                                    <div style={{ height: 120, background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                                        {task.latestPhotoUrl || task.afterPhotoUrl ? <img src={task.latestPhotoUrl || task.afterPhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="After" /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>ไม่มีรูปภาพ</div>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Site Notes */}
                                            {task.history && task.history.length > 0 && (
                                                <div style={{ fontSize: '0.78rem', background: '#fff', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '10px', fontStyle: 'italic', color: '#475569' }}>
                                                    "หมายเหตุช่าง: {task.history[0].note || 'ไม่มีหมายเหตุ'}"
                                                </div>
                                            )}

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
                    {!hasRejections && eligibleTasks.length > 0 && Object.keys(approvals).length === eligibleTasks.length && (
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
                            background: isSubmitting ? '#94a3b8' : hasRejections ? '#ef4444' : '#22c55e',
                            color: '#fff', fontSize: '0.85rem', fontWeight: 900, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            boxShadow: isSubmitting ? 'none' : `0 4px 10px ${hasRejections ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`
                        }}
                    >
                        {isSubmitting ? 'กำลังส่งข้อมูล...' : hasRejections ? 'ส่งบันทึกการสั่งแก้ไขงาน (Reject)' : 'ยืนยันปิดใบงาน (Verify & Close)'}
                    </button>
                </div>
            </div>
        </div>
    );
}
