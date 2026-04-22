import { useState, useEffect } from 'react';
import { Save, Clock, User, DollarSign, FileText } from 'lucide-react';
import { MasterTask, Staff } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import ImageOverlay from './ImageOverlay';

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

    // ✅ Real-time Sync Staff from Firestore
    useEffect(() => {
        if (!isOpen) return;
        const unsub = onSnapshot(collection(db, 'staff'), (snap) => {
            setStaffList(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Staff));
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

    const handleSave = async () => {
        if (!formData.assigneeId) {
            alert('กรุณาระบุผู้รับผิดชอบ (Assignee)');
            return;
        }

        // Calculate SLA start time
        const selectedDate = new Date(formData.startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const compareDate = new Date(selectedDate);
        compareDate.setHours(0, 0, 0, 0);

        // ✅ SLA always starts from 08:00 AM of the "Scheduled Start Date" selected by Admin
        const slaStart = new Date(`${formData.startDate}T08:00:00`).toISOString();

        const updates: Partial<MasterTask> = {
            slaCategory: formData.sla as any,
            costType: formData.costType as any,
            rootCause: formData.rootCause,
            responsibleStaffIds: [formData.assigneeId],
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

        onClose();
    };

    const handleReject = async () => {
        if (!formData.rootCause || formData.rootCause.trim() === '') {
            alert('กรุณาระบุสาเหตุที่ปฏิเสธในช่อง "สาเหตุ / หมายเหตุ" ก่อนทำการปฏิเสธครับ');
            return;
        }

        const updates: Partial<MasterTask> = {
            rootCause: formData.rootCause,
            status: 'Rejected'
        };
        onConfirm(updates);

        // ✅ Send Notification to the original reporter
        try {
            // Check if we have a reporterId in the task or source work order
            // Since task might not have it directly, we might need to find the work order this task belongs to
            // For now, let's try to notify the responsible staff if they were already there
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

        onClose();
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
                        {/* SLA Priority */}
                        <div>
                            <label style={labelStyle}>
                                <Clock size={16} color="#6b7280" /> SLA / ความเร่งด่วน
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
                                <option value="7-14d">มากกว่า 7 วัน</option>
                            </select>
                        </div>

                        {/* Start Date */}
                        <div>
                            <label style={labelStyle}>
                                <Clock size={16} color="#6b7280" /> วันเริ่มดำเนินการ
                            </label>
                            <input
                                type="date"
                                style={inputStyle}
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            />
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
                                    .filter(s => s.role === 'Foreman') // ✅ Only show Foremen for assignment
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
                        onClick={onClose}
                        style={{ padding: '10px 20px', borderRadius: '10px', background: '#ffffff', border: '1px solid #e5e7eb', color: '#374151', fontWeight: 600, cursor: 'pointer' }}
                    >
                        ยกเลิก
                    </button>
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

            <ImageOverlay
                src={overlayImage || ''}
                isOpen={!!overlayImage}
                onClose={() => setOverlayImage(null)}
            />
        </div>
    );
};

export default TaskEvaluationModal;
