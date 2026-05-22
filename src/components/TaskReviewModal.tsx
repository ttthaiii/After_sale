import { useState, useEffect } from 'react';
import { WorkOrder, MasterTask } from '../types';
import { 
    X, Camera, CheckCircle2, XCircle, QrCode, 
    Copy, Check, UserCheck, AlertTriangle, FileText, 
    ArrowRight, Share2, HelpCircle 
} from 'lucide-react';

interface TaskReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    workOrder: WorkOrder;
    task: MasterTask;
    onConfirm: (
        woId: string, 
        categoryId: string, 
        taskId: string, 
        status: 'Verified' | 'Rejected', 
        updates: {
            ownerName?: string;
            rejectReason?: string;
            notes?: string;
            currentRevision?: string;
        }
    ) => Promise<void>;
}

export default function TaskReviewModal({ 
    isOpen, 
    onClose, 
    workOrder, 
    task, 
    onConfirm 
}: TaskReviewModalProps) {
    const [activeTab, setActiveTab] = useState<'foreman-fill' | 'qr-code'>('foreman-fill');
    const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
    
    // Form States
    const [ownerName, setOwnerName] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [notes, setNotes] = useState('');
    const [copied, setCopied] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset forms on reopen or task change
    useEffect(() => {
        setActionType(null);
        setOwnerName('');
        setRejectReason('');
        setNotes('');
        setCopied(false);
        setIsSubmitting(false);
    }, [task.id, isOpen]);

    if (!isOpen) return null;

    // Find task category
    const category = workOrder.categories.find(c => c.tasks.some(t => t.id === task.id));
    const categoryName = category?.name || 'หมวดงานทั่วไป';
    const categoryId = category?.id || 'unknown';

    // Get current revision details
    const currentRev = task.currentRevision || 'rev00';
    const revDisplay = currentRev === 'rev00' ? 'REV. 0 (ครั้งแรก)' : `REV. ${parseInt(currentRev.replace('rev', ''))}`;

    // Get assignee details
    const responsibleName = task.assignee || 'ยังไม่มอบหมาย';

    // Owner Review Public Link Mockup
    const protocol = window.location.protocol;
    const host = window.location.host;
    const reviewLink = `${protocol}//${host}/owner-review?woId=${workOrder.id}&catId=${categoryId}&taskId=${task.id}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(reviewLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmitApproval = async () => {
        if (!ownerName.trim()) {
            alert('กรุณากรอกชื่อตัวแทน Owner หรือผู้ร่วมตรวจงาน');
            return;
        }
        setIsSubmitting(true);
        try {
            await onConfirm(workOrder.id, categoryId, task.id, 'Verified', {
                ownerName: ownerName.trim(),
                notes: notes.trim(),
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitRejection = async () => {
        if (!rejectReason.trim()) {
            alert('กรุณากรอกระบุสาเหตุ / รายละเอียดงานที่ไม่ผ่าน');
            return;
        }
        setIsSubmitting(true);
        try {
            // Calculate next revision
            const revNum = parseInt(currentRev.replace('rev', '')) || 0;
            const nextRev = `rev${String(revNum + 1).padStart(2, '0')}`;

            await onConfirm(workOrder.id, categoryId, task.id, 'Rejected', {
                rejectReason: rejectReason.trim(),
                currentRevision: nextRev
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Styling constants
    const overlayStyle: React.CSSProperties = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px'
    };

    const modalStyle: React.CSSProperties = {
        background: '#ffffff',
        width: '100%', maxWidth: '850px',
        borderRadius: '32px',
        boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(255, 255, 255, 0.8)',
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem 2rem',
                    background: '#ffffff',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#4f46e5', background: '#e0e7ff', padding: '3px 8px', borderRadius: '6px' }}>
                                {task.taskCode || task.id}
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: '6px' }}>
                                {revDisplay}
                            </span>
                        </div>
                        <h2 style={{ margin: '6px 0 0 0', fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
                            ตรวจรับและสรุปผลงานราย Task
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#f8fafc',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            color: '#64748b',
                            width: '38px',
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={e => {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.color = '#0f172a';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.color = '#64748b';
                        }}
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '1.5rem 2rem', background: '#f8fafc' }}>
                    
                    {/* Before & After Photo Comparison */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                        
                        {/* Before Photo Card */}
                        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Camera size={13} />
                                <span>ภาพก่อนดำเนินงาน (BEFORE)</span>
                            </div>
                            <div style={{ width: '100%', height: '200px', borderRadius: '12px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {task.beforePhotoUrl ? (
                                    <img src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Before" />
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                                        <Camera size={32} />
                                        <div style={{ fontSize: '0.75rem', marginTop: '6px', fontWeight: 600 }}>ไม่มีภาพแจ้งซ่อม</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* After Photo Card */}
                        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Camera size={13} />
                                <span>ภาพผลงานล่าสุด (AFTER / LATEST)</span>
                            </div>
                            <div style={{ width: '100%', height: '200px', borderRadius: '12px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {task.latestPhotoUrl || task.afterPhotoUrl ? (
                                    <img src={task.latestPhotoUrl || task.afterPhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="After" />
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                                        <Camera size={32} />
                                        <div style={{ fontSize: '0.75rem', marginTop: '6px', fontWeight: 600 }}>ไม่มีภาพหลังงานเสร็จ</div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Task details & Info Grid */}
                    <div style={{ background: '#ffffff', borderRadius: '24px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                            <div>
                                <span style={{ fontWeight: 800, color: '#94a3b8' }}>ชื่อรายการงาน:</span>{' '}
                                <span style={{ fontWeight: 900, color: '#1e293b' }}>{task.name}</span>
                            </div>
                            <div>
                                <span style={{ fontWeight: 800, color: '#94a3b8' }}>โครงการ / พื้นที่:</span>{' '}
                                <span style={{ fontWeight: 900, color: '#1e293b' }}>{workOrder.locationName} ({categoryName})</span>
                            </div>
                            <div>
                                <span style={{ fontWeight: 800, color: '#94a3b8' }}>ช่างผู้รับผิดชอบ:</span>{' '}
                                <span style={{ fontWeight: 900, color: '#1e293b' }}>{responsibleName}</span>
                            </div>
                            <div>
                                <span style={{ fontWeight: 800, color: '#94a3b8' }}>ความคืบหน้าปัจจุบัน:</span>{' '}
                                <span style={{ fontWeight: 900, color: '#10b981', background: '#e6fbf4', padding: '2px 8px', borderRadius: '6px' }}>{task.dailyProgress}% (รอตรวจสอบ)</span>
                            </div>
                        </div>

                        {task.history && task.history.length > 0 && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <FileText size={12} />
                                    <span>โน้ตการทำงานล่าสุดจากช่างประจำวัน ({task.history[0].date}):</span>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '10px', fontSize: '0.8rem', fontStyle: 'italic', color: '#475569', border: '1px solid #e2e8f0' }}>
                                    "{task.history[0].note || 'ไม่มีระบุข้อความหมายเหตุ'}"
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navigation Tabs */}
                    <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '14px', marginBottom: '1.25rem', gap: '4px' }}>
                        <button
                            onClick={() => setActiveTab('foreman-fill')}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                borderRadius: '10px',
                                border: 'none',
                                background: activeTab === 'foreman-fill' ? '#ffffff' : 'transparent',
                                color: activeTab === 'foreman-fill' ? '#4f46e5' : '#64748b',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: activeTab === 'foreman-fill' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <UserCheck size={16} />
                            โฟร์แมนระบุผลจากการคุยหน้างานจริง (Self-Submit)
                        </button>
                        <button
                            onClick={() => setActiveTab('qr-code')}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                borderRadius: '10px',
                                border: 'none',
                                background: activeTab === 'qr-code' ? '#ffffff' : 'transparent',
                                color: activeTab === 'qr-code' ? '#4f46e5' : '#64748b',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: activeTab === 'qr-code' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <QrCode size={16} />
                            ส่ง QR Code ให้ OWNER สแกนตรวจรับ (Owner Quick-Pass)
                        </button>
                    </div>

                    {/* Tab contents */}
                    {activeTab === 'foreman-fill' ? (
                        <div>
                            {actionType === null ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '0.5rem' }}>
                                    
                                    {/* Action Box: Approve */}
                                    <div 
                                        onClick={() => setActionType('approve')}
                                        style={{
                                            background: '#ffffff',
                                            borderRadius: '24px',
                                            padding: '2rem 1.5rem',
                                            border: '2px solid #e2e8f0',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            transition: 'all 0.2s',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                                        }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.borderColor = '#10b981';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 12px 20px -8px rgba(16, 185, 129, 0.15)';
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)';
                                        }}
                                    >
                                        <div style={{ width: '64px', height: '64px', background: '#10b981', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.3)' }}>
                                            <CheckCircle2 size={32} />
                                        </div>
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 900, color: '#064e3b' }}>อนุมัติผ่านงาน (Approve)</h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 600, lineHeight: 1.4 }}>
                                            ผลงานเรียบร้อยสมบูรณ์ และ Owner ยืนยันให้ผ่านการตรวจรับ ต้องการปิดรายการงานนี้อย่างเป็นถาวร
                                        </p>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 800, fontSize: '0.85rem', marginTop: '1.25rem' }}>
                                            <span>กรอกข้อมูลตรวจรับ</span>
                                            <ArrowRight size={14} />
                                        </div>
                                    </div>

                                    {/* Action Box: Reject */}
                                    <div 
                                        onClick={() => setActionType('reject')}
                                        style={{
                                            background: '#ffffff',
                                            borderRadius: '24px',
                                            padding: '2rem 1.5rem',
                                            border: '2px solid #e2e8f0',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            transition: 'all 0.2s',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                                        }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.borderColor = '#ef4444';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 12px 20px -8px rgba(239, 68, 68, 0.15)';
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)';
                                        }}
                                    >
                                        <div style={{ width: '64px', height: '64px', background: '#ef4444', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 8px 16px -4px rgba(239, 68, 68, 0.3)' }}>
                                            <XCircle size={32} />
                                        </div>
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 900, color: '#7f1d1d' }}>ตีกลับแก้ไข / ไม่ผ่าน (Reject)</h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 600, lineHeight: 1.4 }}>
                                            พบจุดชำรุด งานไม่เรียบร้อย หรือ Owner ไม่ผ่านการตรวจ ต้องการส่งคืนช่างเพื่อเริ่มทำความคืบหน้า (0%) ใหม่
                                        </p>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 800, fontSize: '0.85rem', marginTop: '1.25rem' }}>
                                            <span>ระบุสาเหตุตีกลับงาน</span>
                                            <ArrowRight size={14} />
                                        </div>
                                    </div>

                                </div>
                            ) : actionType === 'approve' ? (
                                /* Form: Approve */
                                <div style={{ background: '#ffffff', borderRadius: '24px', padding: '1.5rem', border: '1.5px solid #10b981', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.08)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#064e3b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                                            <span>ยืนยันการอนุมัติผ่านงานตรวจรับ (Approve Form)</span>
                                        </h4>
                                        <button 
                                            onClick={() => setActionType(null)}
                                            style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                                        >
                                            ย้อนกลับเพื่อเลือกใหม่
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#334155', marginBottom: '6px' }}>
                                                ชื่อผู้แทน Owner หรือ ลูกค้าที่เป็นผู้ตรวจหน้างานจริง <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                placeholder="ตัวอย่าง: คุณสมชาย (เจ้าของบ้าน), นิติบุคคลโครงการ..."
                                                value={ownerName}
                                                onChange={e => setOwnerName(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                                                    border: '1.5px solid #cbd5e1', fontSize: '0.9rem', outline: 'none',
                                                    fontWeight: 600, boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#334155', marginBottom: '6px' }}>
                                                หมายเหตุ / รายละเอียดการตรวจรับเพิ่มเติม (ถ้ามี)
                                            </label>
                                            <textarea 
                                                rows={3} 
                                                placeholder="ป้อนรายละเอียดข้อมูลการปิดงาน หรือ คำชมเชย/เพิ่มเติมจากลูกค้า..."
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                                                    border: '1.5px solid #cbd5e1', fontSize: '0.9rem', outline: 'none',
                                                    fontWeight: 600, boxSizing: 'border-box', resize: 'none'
                                                }}
                                            />
                                        </div>

                                        <button
                                            onClick={handleSubmitApproval}
                                            disabled={isSubmitting || !ownerName.trim()}
                                            style={{
                                                background: ownerName.trim() ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '14px 20px',
                                                borderRadius: '14px',
                                                fontWeight: 900,
                                                fontSize: '0.95rem',
                                                cursor: ownerName.trim() ? 'pointer' : 'not-allowed',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                boxShadow: ownerName.trim() ? '0 10px 20px -8px rgba(16, 185, 129, 0.3)' : 'none',
                                                transition: 'all 0.2s',
                                                marginTop: '0.5rem'
                                            }}
                                        >
                                            <CheckCircle2 size={18} />
                                            <span>{isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันและปิดจบงานโดยสมบูรณ์'}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Form: Reject */
                                <div style={{ background: '#ffffff', borderRadius: '24px', padding: '1.5rem', border: '1.5px solid #ef4444', boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.08)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <XCircle size={20} style={{ color: '#ef4444' }} />
                                            <span>ยืนยันการปฏิเสธงาน / ส่งกลับแก้ไข (Reject & Create Revision)</span>
                                        </h4>
                                        <button 
                                            onClick={() => setActionType(null)}
                                            style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                                        >
                                            ย้อนกลับเพื่อเลือกใหม่
                                        </button>
                                    </div>

                                    <div style={{ background: '#fef2f2', padding: '12px 16px', borderRadius: '12px', border: '1px solid #fee2e2', color: '#991b1b', fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <div>
                                            การส่งตีกลับแก้ไขงาน จะส่งผลให้โปรเกรสความคืบหน้าของงานถูกรีเซ็ตกลับเป็น **0%** และเพิ่มประวัติรุ่นการทำงานเป็นรอบแก้ถัดไป (**REV. 1**, **REV. 2**...) เพื่อสะสมข้อมูลแรงงานต่อเนื่อง และคงค่า SLA ดั้งเดิมเอาไว้คอยกำกับงานแก้ชิ้นนี้
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#334155', marginBottom: '6px' }}>
                                                ระบุสาเหตุที่ไม่ผ่าน และจุดงานที่ช่างต้องนำไปปรับปรุงแก้ไข <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <textarea 
                                                rows={4} 
                                                placeholder="ตัวอย่าง: กระเบื้องขอบไม่เสมอกัน มีความต่างระดับ ร่องยาแนวไม่เต็ม, สีผนังห้องรับแขกทาไม่สม่ำเสมอเป็นรอยหยดน้ำ..."
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                                                    border: '1.5px solid #cbd5e1', fontSize: '0.9rem', outline: 'none',
                                                    fontWeight: 600, boxSizing: 'border-box', resize: 'none'
                                                }}
                                            />
                                        </div>

                                        <button
                                            onClick={handleSubmitRejection}
                                            disabled={isSubmitting || !rejectReason.trim()}
                                            style={{
                                                background: rejectReason.trim() ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : '#cbd5e1',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '14px 20px',
                                                borderRadius: '14px',
                                                fontWeight: 900,
                                                fontSize: '0.95rem',
                                                cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                boxShadow: rejectReason.trim() ? '0 10px 20px -8px rgba(239, 68, 68, 0.3)' : 'none',
                                                transition: 'all 0.2s',
                                                marginTop: '0.5rem'
                                            }}
                                        >
                                            <XCircle size={18} />
                                            <span>{isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันปฏิเสธงานและสร้าง Revision ใหม่'}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Tab: QR Code */
                        <div style={{ background: '#ffffff', borderRadius: '24px', padding: '1.5rem', border: '1px solid #cbd5e1', display: 'flex', gap: '1.5rem', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                            
                            {/* Stylized QR Code Mockup */}
                            <div style={{ 
                                background: '#f8fafc', 
                                border: '2px solid #e2e8f0', 
                                borderRadius: '20px', 
                                padding: '16px', 
                                width: '170px', 
                                height: '170px', 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ zIndex: 1 }}>
                                    {/* Mock QR Code Pattern */}
                                    <path d="M3 3h4v4H3zM17 3h4v4h-4zM3 17h4v4H3zM9 3h2v2H9zM13 3h2v2h-2zM9 7h2v2H9zM13 7h2v2h-2zM3 9h2v2H3zM7 9h2v2H7zM11 9h2v2h-2zM15 9h2v2h-2zM19 9h2v2h-2zM9 13h2v2H9zM13 13h2v2h-2zM17 13h2v2h-2zM9 17h2v2H9zM13 17h2v2h-2zM17 17h2v2h-2zM9 21h2v2H9zM13 21h2v2h-2zM17 21h2v2h-2z" />
                                    <path d="M12 12h.01M16 12h.01M20 12h.01M12 16h.01M16 16h.01M20 16h.01M12 20h.01M16 20h.01M20 20h.01" strokeWidth="2.5" />
                                </svg>
                                <div style={{ 
                                    position: 'absolute', 
                                    top: 0, left: 0, right: 0, height: '4px', 
                                    background: 'rgba(79, 70, 229, 0.7)',
                                    boxShadow: '0 0 8px #4f46e5',
                                    animation: 'qr-scan 2.5s infinite linear'
                                }} />
                                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#64748b', marginTop: '10px', zIndex: 1 }}>OWNER QR PASS</span>
                                
                                <style>{`
                                    @keyframes qr-scan {
                                        0% { top: 10px; }
                                        50% { top: 130px; }
                                        100% { top: 10px; }
                                    }
                                `}</style>
                            </div>

                            {/* Link detail & Actions */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Share2 size={18} style={{ color: '#4f46e5' }} />
                                    <span>ลิงก์ประเมินงานสำหรับ Owner (ลูกค้า)</span>
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontWeight: 600, lineHeight: 1.4 }}>
                                    แอดมินหรือโฟร์แมน สามารถเปิด QR Code นี้เพื่อให้ลูกค้าสแกนตรวจสอบความถูกต้อง และกด อนุมัติ/ส่งกลับแก้ไข ได้เองโดยตรงหน้างาน หรือคัดลอกลิงก์เพื่อส่งต่อทาง Line
                                </p>

                                <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, color: '#475569', border: '1px solid #cbd5e1', wordBreak: 'break-all', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontFamily: 'monospace' }}>{reviewLink.substring(0, 50)}...</span>
                                    <button
                                        onClick={handleCopyLink}
                                        style={{
                                            background: copied ? '#10b981' : '#4f46e5',
                                            color: '#ffffff',
                                            border: 'none',
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            fontWeight: 800,
                                            fontSize: '0.7rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            transition: 'all 0.2s',
                                            flexShrink: 0
                                        }}
                                    >
                                        {copied ? <Check size={12} /> : <Copy size={12} />}
                                        <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}</span>
                                    </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800, color: '#4f46e5', background: '#e0e7ff', padding: '6px 12px', borderRadius: '8px', marginTop: '6px', width: 'fit-content' }}>
                                    <HelpCircle size={14} />
                                    <span>ปลายทางรองรับมือถือ ตรวจความสมบูรณ์ สะดวก 100%</span>
                                </div>
                            </div>

                        </div>
                    )}

                </div>

                {/* Footer */}
                <div style={{
                    padding: '1.25rem 2rem',
                    background: '#ffffff',
                    display: 'flex', gap: '1rem',
                    borderTop: '1px solid #f1f5f9',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '12px',
                            border: '1.5px solid #e2e8f0', background: '#f8fafc',
                            color: '#64748b', fontWeight: 800, cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        ย้อนกลับ / ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
}
