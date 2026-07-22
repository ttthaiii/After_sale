import { useState, useEffect } from 'react';
import { Save, Clock, User, DollarSign, FileText } from 'lucide-react';
import { MasterTask, Staff } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import ImageOverlay from './ImageOverlay';
import CustomDateInput from './CustomDateInput';

interface TaskEvaluationModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: MasterTask;
    workOrderId: string;
    onConfirm: (updatedTask: Partial<MasterTask>) => void;
}

const TaskEvaluationModal = ({ isOpen, onClose, task, workOrderId, onConfirm }: TaskEvaluationModalProps) => {
    const [overlayImage, setOverlayImage] = useState<string | null>(null);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const { sendNotification } = useNotifications();
    const { user } = useAuth();

    // ✅ Real-time Sync Staff from Firestore (Unified users collection)
    useEffect(() => {
        if (!isOpen) return;
        const unsub = onSnapshot(collection(db, 'users'), (snap) => {
            const mappedStaff = snap.docs.map(docSnapshot => {
                const userData = docSnapshot.data();
                const empId = docSnapshot.id;
                
                const rawRole = userData.role;
                const role: 'Foreman' | 'Admin' | 'Manager' | 'Approver' =
                    (rawRole === 'Admin' || rawRole === 'Manager' || rawRole === 'Approver' || rawRole === 'Foreman')
                        ? rawRole
                        : (userData.roleId === 'AM' || userData.roleId === 'PE' ? 'Admin' : 'Foreman');
                
                return {
                    id: empId,
                    name: userData.name || '',
                    role: role,
                    systemCode: userData.systemCode || ''
                } as Staff;
            }).filter(st => st.systemCode === 'AS'); // Only show After Sale users
            setStaffList(mappedStaff);
        });
        return () => unsub();
    }, [isOpen]);

    const [formData, setFormData] = useState<{
        sla: string;
        assigneeId: string;
        costType: string;
        rootCause: string;
        startDate: string;
    }>({
        sla: '24h',
        assigneeId: '',
        costType: 'Warranty',
        rootCause: '',
        startDate: new Date().toISOString().split('T')[0]
    });

    const [showSummary, setShowSummary] = useState(false);
    const [summaryType, setSummaryType] = useState<'Approve' | 'Reject' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && task) {
            setFormData({
                sla: task.slaCategory || '24h',
                assigneeId: task.contractorId || task.responsibleStaffIds?.[0] || '',
                costType: task.costType || 'Warranty',
                rootCause: task.rootCause || '',
                startDate: task.startDate || new Date().toISOString().split('T')[0]
            });
        }
    }, [isOpen, task]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!formData.assigneeId) {
            alert('กรุณาระบุผู้รับผิดชอบ (Assignee)');
            return;
        }
        setSummaryType('Approve');
        setShowSummary(true);
    };

    const handleReject = () => {
        if (!formData.rootCause || formData.rootCause.trim() === '') {
            alert('กรุณาระบุสาเหตุที่ปฏิเสธในช่อง "สาเหตุ / หมายเหตุ" ก่อนทำการปฏิเสธครับ');
            return;
        }
        setSummaryType('Reject');
        setShowSummary(true);
    };

    const confirmSave = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            // SLA always starts from 08:00 AM of the "Scheduled Start Date" selected by Admin
            const slaStart = new Date(`${formData.startDate}T08:00:00+07:00`).toISOString();

            const updates: Partial<MasterTask> = {
                slaCategory: formData.sla as any,
                costType: formData.costType as any,
                rootCause: formData.rootCause,
                responsibleStaffIds: [formData.assigneeId],
                subtaskOperatorId: formData.assigneeId,
                status: 'Assigned',
                startDate: formData.startDate,
                slaStartTime: slaStart
            };

            onConfirm(updates);
            
            // ✅ Send Notification to Assigned Staff
            try {
                await sendNotification({
                    recipientId: formData.assigneeId,
                    senderId: user?.id || 'admin',
                    senderName: user?.name || 'Admin',
                    title: 'งานใหม่ได้รับมอบหมาย',
                    message: `คุณได้รับมอบหมายงาน: ${task.name} (ใบงาน ${workOrderId}) โปรดดำเนินการภายในเวลากำหนด (SLA: ${formData.sla})`,
                    type: 'info',
                    targetPath: `/daily-report?id=${workOrderId}`
                });
            } catch (err) {
                console.error("Failed to send notification:", err);
            }

            setShowSummary(false);
            onClose();
        } catch (err) {
            console.error("Failed to save evaluation:", err);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmReject = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const updates: Partial<MasterTask> = {
                rootCause: formData.rootCause,
                status: 'Rejected'
            };
            onConfirm(updates);

            // ✅ Send Notification to the original reporter
            try {
                const recipientId = task.responsibleStaffIds?.[0];
                if (recipientId) {
                    await sendNotification({
                        recipientId: recipientId,
                        senderId: user?.id || 'admin',
                        senderName: user?.name || 'Admin',
                        title: 'งานถูกปฏิเสธการอนุมัติ',
                        message: `งาน "${task.name}" (ใบงาน ${workOrderId}) ไม่ผ่านการอนุมัติ: ${formData.rootCause}`,
                        type: 'error',
                        targetPath: `/work-orders?id=${workOrderId}`
                    });
                }
            } catch (err) {
                console.error("Failed to send notification:", err);
            }

            setShowSummary(false);
            onClose();
        } catch (err) {
            console.error("Failed to reject evaluation:", err);
            alert('เกิดข้อผิดพลาดในการปฏิเสธการอนุมัติ');
        } finally {
            setIsSubmitting(false);
        }
    };


    const inputStyle = {
        width: '100%',
        padding: '12px',
        background: '#ffffff',
        border: '1px solid #d1d5db',
        borderRadius: '10px',
        color: '#111827',
        fontSize: '0.95rem',
        outline: 'none',
        transition: 'all 0.2s'
    };

    const labelStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#374151',
        fontSize: '0.9rem',
        fontWeight: 600,
        marginBottom: '8px'
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: 0, // Moved to Right
            bottom: 0,
            width: '450px', // Fixed width for panel
            background: '#ffffff',
            boxShadow: '-10px 0 25px rgba(0,0,0,0.1)', // Shadow on left
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: 'translateX(0)',
        }}>
            <style>
                {`
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                `}
            </style>
            <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    background: '#ffffff',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            padding: '10px',
                            borderRadius: '12px',
                            color: '#ffffff',
                            display: 'flex',
                            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)'
                        }}>
                            <FileText size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>ประเมินและมอบหมายงาน</h3>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#000000',
                            cursor: 'pointer',
                            display: 'flex',
                            width: '44px',
                            height: '44px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
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

                {/* Body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>

                    {/* Task Info Summary */}
                    <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '12px', border: '1px solid #dbeafe' }}>
                        <div style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>รายการที่ตรวจสอบ</div>
                        <div style={{ color: '#1e40af', fontWeight: 700, fontSize: '1.05rem' }}>{task.name}</div>

                        {/* Task Images Gallery */}
                        {(() => {
                            const imageUrls = Array.from(new Set([
                                ...(task.attachments?.map((a: any) => a.url) || []),
                                ...(task.images || []),
                                ...(task.beforePhotoUrl ? [task.beforePhotoUrl] : [])
                            ])).filter(Boolean);

                            if (imageUrls.length > 0) {
                                return (
                                    <div style={{
                                        marginTop: '16px',
                                        display: 'grid',
                                        gridTemplateColumns: imageUrls.length > 1 ? 'repeat(auto-fill, minmax(130px, 1fr))' : '1fr',
                                        gap: '12px'
                                    }}>
                                        {imageUrls.map((url, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    border: '1px solid #dbeafe',
                                                    background: '#ffffff',
                                                    height: imageUrls.length > 1 ? '100px' : '220px',
                                                    cursor: 'zoom-in',
                                                    position: 'relative'
                                                }}
                                                onClick={() => setOverlayImage(url as string)}
                                            >
                                                <img
                                                    loading="lazy"
                                                    src={url as string}
                                                    alt={`Defect ${index + 1}`}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                );
                            } else {
                                return (
                                    <div style={{
                                        marginTop: '16px',
                                        height: '100px',
                                        borderRadius: '12px',
                                        background: '#f8fafc',
                                        border: '1px dashed #cbd5e1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#94a3b8',
                                        fontSize: '0.85rem',
                                        gap: '8px'
                                    }}>
                                        <span>ไม่มีรูปภาพประกอบ</span>
                                    </div>
                                );
                            }
                        })()}
                    </div>

                    {/* Form Fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Start Date */}
                        <div>
                            <label style={labelStyle}>
                                <Clock size={16} color="#6b7280" /> วันเริ่มดำเนินการ
                            </label>
                            <CustomDateInput
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                style={inputStyle}
                            />
                        </div>

                        {/* SLA Priority */}
                        <div>
                            <label style={labelStyle}>
                                <Clock size={16} color="#6366f1" /> ระดับความสำคัญ (SLA Category)
                            </label>
                            <select
                                style={inputStyle}
                                value={formData.sla}
                                onChange={e => setFormData({ ...formData, sla: e.target.value })}
                            >
                                <option value="Immediately">ด่วนที่สุด (ทันที)</option>
                                <option value="24h">ภายใน 24 ชม. (ด่วน)</option>
                                <option value="1-3d">1 - 3 วัน (ปกติ)</option>
                                <option value="3-7d">3 - 7 วัน</option>
                                <option value="7-14d">7 - 14 วัน</option>
                                <option value="14-30d">14 - 30 วัน</option>
                            </select>

                            {task?.estimatedSla && (
                                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', padding: '6px 12px', borderRadius: '8px' }}>
                                    <span style={{ fontWeight: 600 }}>SLA คาดการณ์ (โฟร์แมน):</span>
                                    <span style={{ fontWeight: 800, color: '#4f46e5' }}>
                                        {task.estimatedSla === 'Immediately' ? 'ด่วนที่สุด (ทันที)' :
                                         task.estimatedSla === '24h' ? 'ภายใน 24 ชม. (ด่วน)' :
                                         task.estimatedSla === '1-3d' ? '1 - 3 วัน (ปกติ)' :
                                         task.estimatedSla === '3-7d' ? '3 - 7 วัน' :
                                         task.estimatedSla === '7-14d' ? '7 - 14 วัน' : '14 - 30 วัน'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Assignee Selection */}
                        <div>
                            <label style={labelStyle}>
                                <User size={16} color="#6b7280" /> ผู้รับผิดชอบ
                            </label>
                            <select
                                style={inputStyle}
                                value={formData.assigneeId}
                                onChange={e => setFormData({ ...formData, assigneeId: e.target.value })}
                            >
                                <option value="">-- เลือกผู้รับผิดชอบ --</option>
                                {staffList
                                    .filter(s => s.role === 'Foreman' && s.isActive !== false) // ✅ Only show active Foremen for assignment
                                    .map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)
                                }
                            </select>
                        </div>

                        {/* Cost Responsibility */}
                        <div>
                            <label style={labelStyle}>
                                <DollarSign size={16} color="#6b7280" /> ความรับผิดชอบค่าใช้จ่าย
                            </label>
                            <select
                                style={inputStyle}
                                value={formData.costType}
                                onChange={e => setFormData({ ...formData, costType: e.target.value })}
                            >
                                <option value="Warranty">อยู่ในประกัน</option>
                                <option value="Billable">เรียกเก็บลูกค้า</option>
                                <option value="Project">งบโครงการ/บริษัท</option>
                                <option value="None">ไม่มีค่าใช้จ่าย</option>
                            </select>
                        </div>

                        {/* Root Cause / Note */}
                        <div>
                            <label style={labelStyle}>
                                <FileText size={16} color="#6b7280" /> สาเหตุ / หมายเหตุ
                            </label>
                            <textarea
                                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }}
                                placeholder="ระบุสาเหตุเบื้องต้น หรือหมายเหตุประกอบการพิจารณา..."
                                value={formData.rootCause}
                                onChange={e => setFormData({ ...formData, rootCause: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>

                    <button
                        onClick={handleReject}
                        style={{ padding: '10px 20px', borderRadius: '10px', background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg> ปฏิเสธการอนุมัติ
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            background: '#4f46e5',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
                        }}
                    >
                        <Save size={18} /> ยืนยันอนุมัติ
                    </button>
                </div>

            </div>

            {/* Summary Confirmation Modal */}
            {showSummary && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 20000,
                    animation: 'fadeIn 0.2s ease-out',
                }} onClick={() => setShowSummary(false)}>
                    <style>
                        {`
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes scaleUp {
                            from { transform: scale(0.95); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                        `}
                    </style>
                    <div 
                        style={{
                            background: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '24px',
                            width: '90%',
                            maxWidth: '460px',
                            padding: '2rem',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.5rem',
                            animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
                            {summaryType === 'Approve' ? (
                                <div style={{
                                    background: '#e6f4ea',
                                    color: '#137333',
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                            ) : (
                                <div style={{
                                    background: '#fce8e6',
                                    color: '#c5221f',
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </div>
                            )}
                            <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                                {summaryType === 'Approve' ? 'ยืนยันผลการประเมินและอนุมัติ' : 'ยืนยันการปฏิเสธการอนุมัติ'}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                                โปรดตรวจสอบข้อมูลความถูกต้องอีกครั้งก่อนทำการยืนยันบันทึกผล
                            </p>
                        </div>

                        {/* Info list */}
                        <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.85rem',
                            fontSize: '0.9rem',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '8px' }}>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>งานที่ประเมิน:</span>
                                <span style={{ color: '#0f172a', fontWeight: 800, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '8px' }}>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>ใบงานเลขที่:</span>
                                <span style={{ color: '#0f172a', fontWeight: 800 }}>{workOrderId}</span>
                            </div>
                            {summaryType === 'Approve' ? (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '8px' }}>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>SLA / ความเร่งด่วน:</span>
                                        <span style={{ color: '#0f172a', fontWeight: 800 }}>
                                            {formData.sla === 'Immediately' ? 'ด่วนที่สุด (ทันที)' : 
                                             formData.sla === '24h' ? 'ภายใน 24 ชม. (ด่วน)' : 
                                             formData.sla === '1-3d' ? '1 - 3 วัน (ปกติ)' : 
                                             formData.sla === '3-7d' ? '3 - 7 วัน' : 
                                             formData.sla === '7-14d' ? '7 - 14 วัน' : '14 - 30 วัน'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '8px' }}>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>วันเริ่มงาน:</span>
                                        <span style={{ color: '#0f172a', fontWeight: 800 }}>{formData.startDate}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '8px' }}>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>ผู้รับผิดชอบ:</span>
                                        <span style={{ color: '#0f172a', fontWeight: 800 }}>
                                            {staffList.find(s => s.id === formData.assigneeId)?.name || formData.assigneeId}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>ค่าใช้จ่าย:</span>
                                        <span style={{ color: '#0f172a', fontWeight: 800 }}>
                                            {formData.costType === 'Warranty' ? 'อยู่ในประกัน' :
                                             formData.costType === 'Billable' ? 'เรียกเก็บลูกค้า' :
                                             formData.costType === 'Project' ? 'งบโครงการ/บริษัท' : 'ไม่มีค่าใช้จ่าย'}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>สาเหตุที่ปฏิเสธการอนุมัติ:</span>
                                    <span style={{ color: '#dc2626', fontWeight: 700, background: '#fef2f2', padding: '10px', borderRadius: '8px', border: '1px solid #fee2e2', marginTop: '4px', lineHeight: 1.4 }}>
                                        {formData.rootCause}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Notice */}
                        <div style={{
                            fontSize: '0.8rem',
                            color: summaryType === 'Approve' ? '#15803d' : '#b91c1c',
                            background: summaryType === 'Approve' ? '#f0fdf4' : '#fef2f2',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            textAlign: 'center',
                            fontWeight: 600,
                            lineHeight: 1.4
                        }}>
                            {summaryType === 'Approve' 
                                ? '⚠️ ระบบจะเริ่มนับเวลา SLA และส่งการแจ้งเตือนไปยังผู้รับผิดชอบทันทีหลังยืนยัน' 
                                : '⚠️ ระบบจะปฏิเสธการดำเนินงานและส่งแจ้งเตือนสาเหตุไปยังผู้แจ้งงาน'}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <button
                                onClick={() => setShowSummary(false)}
                                disabled={isSubmitting}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    transition: 'background 0.2s'
                                }}
                            >
                                กลับไปแก้ไข
                            </button>
                            <button
                                onClick={summaryType === 'Approve' ? confirmSave : confirmReject}
                                disabled={isSubmitting}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: summaryType === 'Approve' ? '#10b981' : '#dc2626',
                                    border: 'none',
                                    color: '#ffffff',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    boxShadow: summaryType === 'Approve' 
                                        ? '0 4px 10px rgba(16, 185, 129, 0.2)' 
                                        : '0 4px 10px rgba(220, 38, 38, 0.2)',
                                    transition: 'background 0.2s'
                                }}
                            >
                                {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันบันทึกผล'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ImageOverlay
                src={overlayImage || ''}
                isOpen={!!overlayImage}
                onClose={() => setOverlayImage(null)}
            />
        </div>
    );
};

export default TaskEvaluationModal;

