import { useState } from 'react';
import { X, User, HardHat, Clock, Save, CheckCircle2 } from 'lucide-react';
import { MasterTask, Staff, Contractor } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

interface AdminAssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: MasterTask | null;
    workOrderId: string;
    staffList: Staff[];
    contractors: Contractor[];
    onAssign: (woId: string, taskId: string, updates: Partial<MasterTask>) => Promise<void>;
}

const AdminAssignModal = ({ isOpen, onClose, task, workOrderId, staffList, contractors, onAssign }: AdminAssignModalProps) => {
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(task?.responsibleStaffIds || []);
    const [selectedContractorId, setSelectedContractorId] = useState<string>(task?.contractorId || '');
    const [slaCategory, setSlaCategory] = useState(task?.slaCategory || '24h');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { sendNotification } = useNotifications();
    const { user } = useAuth();

    if (!isOpen || !task) return null;

    const handleSubmit = async () => {
        if (selectedStaffIds.length === 0 && !selectedContractorId) {
            alert('กรุณาเลือกเจ้าหน้าที่หรือผู้รับเหมาอย่างน้อย 1 ราย');
            return;
        }

        setIsSubmitting(true);
        try {
            const updates: Partial<MasterTask> = {
                responsibleStaffIds: selectedStaffIds,
                contractorId: selectedContractorId || null,
                slaCategory: slaCategory as any,
                status: 'Assigned',
            };

            // Only reset SLA timer if it's a new assignment OR the user changed the category
            if (!task.slaStartTime || slaCategory !== task.slaCategory) {
                updates.slaStartTime = new Date().toISOString();
            }

            await onAssign(workOrderId, task.id, updates);

            // ✅ Send notifications to each assigned staff
            if (selectedStaffIds.length > 0) {
                try {
                    const notificationPromises = selectedStaffIds.map(staffId => 
                        sendNotification({
                            recipientId: staffId,
                            senderId: user?.id || 'admin',
                            senderName: user?.name || 'Admin',
                            title: 'มอบหมายงานใหม่',
                            message: `คุณได้รับมอบหมายงาน: ${task.name} (ใบงาน ${workOrderId})`,
                            type: 'info',
                            targetPath: `/daily-report?id=${workOrderId}`
                        })
                    );
                    await Promise.all(notificationPromises);
                } catch (err) {
                    console.error("Failed to send assignment notifications:", err);
                }
            }

            onClose();
        } catch (error) {
            console.error('Assignment failed:', error);
            alert('เกิดข้อผิดพลาดในการมอบหมายงาน');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleStaff = (id: string) => {
        setSelectedStaffIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#ffffff', width: '90%', maxWidth: '500px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

                {/* Header */}
                <div style={{ padding: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>มอบหมายงาน (Assign Task)</h2>
                        <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '0.85rem' }}>{task.name}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px', borderRadius: '12px', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    {/* SLA Priority */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px' }}>
                            <Clock size={18} color="#6366f1" /> ระดับความสำคัญ (SLA Category)
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            {['Immediately', '24h', '1-3d', '3-7d', '7-14d', '14-30d'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSlaCategory(cat as any)}
                                    style={{
                                        padding: '10px 4px',
                                        borderRadius: '10px',
                                        border: '1px solid',
                                        borderColor: slaCategory === cat ? '#6366f1' : '#e2e8f0',
                                        background: slaCategory === cat ? '#eef2ff' : '#ffffff',
                                        color: slaCategory === cat ? '#6366f1' : '#64748b',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {cat === 'Immediately' ? 'ด่วนที่สุด' :
                                        cat === '24h' ? '24 ชม.' :
                                            cat === '1-3d' ? '1-3 วัน' :
                                                cat === '3-7d' ? '3-7 วัน' :
                                                    cat === '7-14d' ? '7-14 วัน' :
                                                        cat === '14-30d' ? '14-30 วัน' : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Staff Selection */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px' }}>
                            <User size={18} color="#10b981" /> เลือกเจ้าหน้าที่ (Internal Staff)
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                            {staffList.filter(s => s.role === 'Foreman').map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => toggleStaff(s.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px',
                                        border: '1px solid',
                                        borderColor: selectedStaffIds.includes(s.id) ? '#10b981' : '#f1f5f9',
                                        background: selectedStaffIds.includes(s.id) ? '#f0fdf4' : '#f8fafc',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#cbd5e1', overflow: 'hidden' }}>
                                        {s.profileImage ? <img src={s.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={16} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{s.affiliation || 'ส่วนกลาง'}</div>
                                    </div>
                                    {selectedStaffIds.includes(s.id) && <CheckCircle2 size={18} color="#10b981" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contractor Selection */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px' }}>
                            <HardHat size={18} color="#f59e0b" /> ผู้รับเหมา (Contractor)
                        </label>
                        <select
                            value={selectedContractorId}
                            onChange={(e) => setSelectedContractorId(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem', color: '#1e293b' }}
                        >
                            <option value="">-- ไม่ระบุ --</option>
                            {contractors.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({Array.isArray(c.specialty) ? c.specialty[0] : c.specialty})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        style={{
                            flex: 2, padding: '14px', borderRadius: '14px', border: 'none',
                            background: isSubmitting ? '#94a3b8' : '#4f46e5',
                            color: 'white', fontWeight: 800, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
                        }}
                    >
                        <Save size={20} /> {isSubmitting ? 'กำลังบันทึก...' : 'มอบหมายงาน'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminAssignModal;
