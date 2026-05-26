import { useState, useEffect } from 'react';
import { WorkOrder, MasterTask } from '../types';
import { 
    Camera, CheckCircle2, XCircle, QrCode, 
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
            evaluationChecklist?: Record<string, number | boolean>;
            overallSatisfaction?: number;
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
    const [afterPhotoIndex, setAfterPhotoIndex] = useState(0);
 
    // Evaluation States (Approve Rating System - 5 Diagnostic Parameters)
    const [workQualityRating, setWorkQualityRating] = useState(5);
    const [cleanlinessRating, setCleanlinessRating] = useState(5);
    const [professionalismRating, setProfessionalismRating] = useState(5);
    const [specAccuracyRating, setSpecAccuracyRating] = useState(5);
    const [handoverRating, setHandoverRating] = useState(5);
 
    // Defect Checklist States (Reject Defect Diagnostics)
    const [cosmeticDefect, setCosmeticDefect] = useState(false);
    const [functionalDefect, setFunctionalDefect] = useState(false);
    const [cleanlinessDefect, setCleanlinessDefect] = useState(false);
    const [specDefect, setSpecDefect] = useState(false);
 
    // Reset forms on reopen or task change
    useEffect(() => {
        setActionType(null);
        setOwnerName('');
        setRejectReason('');
        setNotes('');
        setCopied(false);
        setIsSubmitting(false);
        setAfterPhotoIndex(0);
        
        // Reset ratings
        setWorkQualityRating(5);
        setCleanlinessRating(5);
        setProfessionalismRating(5);
        setSpecAccuracyRating(5);
        setHandoverRating(5);
 
        // Reset defects
        setCosmeticDefect(false);
        setFunctionalDefect(false);
        setCleanlinessDefect(false);
        setSpecDefect(false);
    }, [task.id, isOpen]);

    if (!isOpen) return null;
 
    // Helper to render segmented rating controls
    const renderSegmentedRating = (
        label: string,
        subLabel: string,
        value: number,
        onChange: (val: number) => void
    ) => {
        const getLabelText = (val: number) => {
            switch (val) {
                case 1: return 'ต้องปรับปรุงด่วน (Critical)';
                case 2: return 'ไม่ผ่านมาตรฐาน (Substandard)';
                case 3: return 'ผ่านตามมาตรฐาน (Meets Specs)';
                case 4: return 'ดีมาก (High Quality)';
                case 5: return 'ดีเยี่ยมเกินคาด (Outstanding)';
                default: return '';
            }
        };
 
        const getColors = (val: number) => {
            switch (val) {
                case 1:
                    return { activeText: '#ffffff', activeBg: '#ef4444', text: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' };
                case 2:
                    return { activeText: '#ffffff', activeBg: '#f97316', text: '#c2410c', bg: '#fff7ed', border: '#fdbb2d' };
                case 3:
                    return { activeText: '#ffffff', activeBg: '#d97706', text: '#b45309', bg: '#fffbeb', border: '#fde68a' };
                case 4:
                    return { activeText: '#ffffff', activeBg: '#10b981', text: '#047857', bg: '#ecfdf5', border: '#a7f3d0' };
                case 5:
                    return { activeText: '#ffffff', activeBg: '#059669', text: '#065f46', bg: '#f0fdf4', border: '#86efac' };
                default:
                    return { activeText: '#ffffff', activeBg: '#10b981', text: '#047857', bg: '#ecfdf5', border: '#a7f3d0' };
            }
        };
 
        const colors = getColors(value);
 
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#ffffff', padding: '14px 18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#1e293b', display: 'block' }}>{label}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block' }}>{subLabel}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '5px', borderRadius: '12px' }}>
                        {[1, 2, 3, 4, 5].map((score) => {
                            const isSelected = value === score;
                            return (
                                <button
                                    key={score}
                                    type="button"
                                    onClick={() => onChange(score)}
                                    style={{
                                        border: 'none',
                                        borderRadius: '8px',
                                        width: '40px',
                                        height: '40px',
                                        fontWeight: 900,
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        background: isSelected ? colors.activeBg : 'transparent',
                                        color: isSelected ? '#ffffff' : '#475569',
                                        boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                    }}
                                    onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = '#e2e8f0'; }}
                                    onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    {score}
                                </button>
                            );
                        })}
                    </div>
                    <div style={{
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        color: colors.text,
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        padding: '3px 10px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '22px'
                    }}>
                        {getLabelText(value)}
                    </div>
                </div>
            </div>
        );
    };
 
    // Find task category
    const category = workOrder.categories.find(c => c.tasks.some(t => t.id === task.id));
    const categoryName = category?.name || 'หมวดงานทั่วไป';
    const categoryId = category?.id || 'unknown';

    // Get current revision details
    const currentRev = task.currentRevision || 'rev00';
    const revDisplay = currentRev === 'rev00' ? 'REV. 0 (ครั้งแรก)' : `REV. ${parseInt(currentRev.replace('rev', ''))}`;

    // Get assignee details with robust foreman fallbacks
    const responsibleName = task.assignee || 
        (task.assignees && task.assignees.length > 0 ? task.assignees[0].name : '') || 
        workOrder.reporterName || 
        'ไม่ระบุ';

    // Extract site images from the task history item reported at 100% progress
    const afterPhotos: string[] = [];
    if (task.history && task.history.length > 0) {
        // First find history item reported at 100% progress
        const history100 = task.history.find(h => h.progress === 100);
        if (history100 && history100.photos) {
            if (Array.isArray(history100.photos)) {
                afterPhotos.push(...history100.photos);
            } else if (history100.photos.site && Array.isArray(history100.photos.site)) {
                afterPhotos.push(...history100.photos.site);
            }
        }
        
        // Fallback: If no 100% progress update with photos exists, check any update with photos
        if (afterPhotos.length === 0) {
            const anyHistoryWithPhotos = task.history.find(h => {
                if (!h.photos) return false;
                if (Array.isArray(h.photos)) return h.photos.length > 0;
                return (h.photos.site && h.photos.site.length > 0);
            });
            if (anyHistoryWithPhotos && anyHistoryWithPhotos.photos) {
                if (Array.isArray(anyHistoryWithPhotos.photos)) {
                    afterPhotos.push(...anyHistoryWithPhotos.photos);
                } else if (anyHistoryWithPhotos.photos.site) {
                    afterPhotos.push(...anyHistoryWithPhotos.photos.site);
                }
            }
        }
    }

    // Fallback: If still empty, check task latestPhotoUrl or afterPhotoUrl
    if (afterPhotos.length === 0) {
        if (task.latestPhotoUrl) afterPhotos.push(task.latestPhotoUrl);
        if (task.afterPhotoUrl && !afterPhotos.includes(task.afterPhotoUrl)) {
            afterPhotos.push(task.afterPhotoUrl);
        }
    }

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
            const evaluationChecklist: Record<string, number | boolean> = {
                workQuality: workQualityRating,
                siteCleanliness: cleanlinessRating,
                foremanProfessionalism: professionalismRating,
                specAccuracy: specAccuracyRating,
                handoverCare: handoverRating
            };
            const overallSatisfaction = parseFloat(((workQualityRating + cleanlinessRating + professionalismRating + specAccuracyRating + handoverRating) / 5).toFixed(2));

            await onConfirm(workOrder.id, categoryId, task.id, 'Verified', {
                ownerName: ownerName.trim(),
                notes: notes.trim(),
                evaluationChecklist,
                overallSatisfaction
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

            const evaluationChecklist: Record<string, number | boolean> = {
                cosmeticDefect,
                functionalDefect,
                cleanlinessDefect,
                specDefect
            };

            await onConfirm(workOrder.id, categoryId, task.id, 'Rejected', {
                rejectReason: rejectReason.trim(),
                currentRevision: nextRev,
                evaluationChecklist
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
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

                        {/* After Photo Card with Slider */}
                        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', position: 'relative' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Camera size={13} />
                                <span>ภาพผลงานล่าสุด (AFTER / LATEST)</span>
                            </div>
                            <div style={{ width: '100%', height: '200px', borderRadius: '12px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                {afterPhotos.length > 0 ? (
                                    <>
                                        <img src={afterPhotos[afterPhotoIndex]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`After ${afterPhotoIndex + 1}`} />
                                        {afterPhotos.length > 1 && (
                                            <>
                                                {/* Left Navigation */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAfterPhotoIndex(prev => (prev === 0 ? afterPhotos.length - 1 : prev - 1));
                                                    }}
                                                    style={{
                                                        position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                                                        background: 'rgba(255, 255, 255, 0.85)', border: 'none', borderRadius: '50%',
                                                        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.15)', color: '#0f172a',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={e => e.currentTarget.style.background = '#ffffff'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)'}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="15 18 9 12 15 6"></polyline>
                                                    </svg>
                                                </button>
                                                {/* Right Navigation */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAfterPhotoIndex(prev => (prev === afterPhotos.length - 1 ? 0 : prev + 1));
                                                    }}
                                                    style={{
                                                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                                        background: 'rgba(255, 255, 255, 0.85)', border: 'none', borderRadius: '50%',
                                                        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.15)', color: '#0f172a',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={e => e.currentTarget.style.background = '#ffffff'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)'}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="9 18 15 12 9 6"></polyline>
                                                    </svg>
                                                </button>
                                                {/* Counter Indicator Overlay */}
                                                <div style={{
                                                    position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                                                    background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', padding: '3px 10px', borderRadius: '20px',
                                                    color: '#ffffff', fontSize: '0.68rem', fontWeight: 900, zIndex: 10, letterSpacing: '0.05em'
                                                }}>
                                                    {afterPhotoIndex + 1} / {afterPhotos.length}
                                                </div>
                                            </>
                                        )}
                                    </>
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
                            โฟร์แมนบันทึกผล (Self-Submit)
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
                            Owner สแกน QR (Quick-Pass)
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
                                            ผลงานสมบูรณ์และผ่านการตรวจรับโดยลูกค้า เพื่อปิดงานถาวร
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
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 900, color: '#7f1d1d' }}>ตีกลับแก้ไข (Reject)</h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 600, lineHeight: 1.4 }}>
                                            พบจุดชำรุดหรืองานไม่เรียบร้อย เพื่อส่งกลับให้ช่างแก้ไขใหม่ (0%)
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
                                            <span>อนุมัติผ่านงาน (Approve)</span>
                                        </h4>
                                        <button 
                                            onClick={() => setActionType(null)}
                                            style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            ← ย้อนกลับ
                                        </button>
                                    </div>
 
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        
                                        {/* Evaluation Rating Checklist Section */}
                                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '4px' }}>
                                                📊 ประเมินคุณภาพการส่งมอบงาน (5 Diagnostic Parameters)
                                            </div>
                                            
                                            {renderSegmentedRating('1. คุณภาพฝีมือและการตกแต่งผิว (Workmanship & Finishing)', 'ความเรียบร้อย สวยงาม และความเนียนละเอียดของผิวงาน', workQualityRating, setWorkQualityRating)}
                                            {renderSegmentedRating('2. ความถูกต้องตรงตามแบบและสเปก (Specification Accuracy)', 'ความถูกต้องของรุ่นวัสดุ สี แบบแปลน และข้อตกลง', specAccuracyRating, setSpecAccuracyRating)}
                                            {renderSegmentedRating('3. ความสะอาดและการจัดการพื้นที่หน้างาน (Site Cleanliness)', 'การทำความสะอาดเศษฝุ่น เศษปูน และความเรียบร้อยของหน้างานหลังทำเสร็จ', cleanlinessRating, setCleanlinessRating)}
                                            {renderSegmentedRating('4. การส่งมอบและการแนะนำการใช้งาน (Client Handover)', 'การให้คำสาธิตวิธีดูแลรักษา อธิบายฟังก์ชัน และทดสอบร่วมกับลูกค้า', handoverRating, setHandoverRating)}
                                            {renderSegmentedRating('5. ความสุภาพและการประสานงานทีมงาน (Professionalism & Conduct)', 'มารยาท การแต่งกาย อัธยาศัยดี และการประสานงานของทีมงานหน้างาน', professionalismRating, setProfessionalismRating)}

                                            {/* Dynamic Overall Score */}
                                            <div style={{ 
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                                marginTop: '8px', padding: '12px 16px', borderRadius: '16px', 
                                                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
                                                border: '1.5px solid #a7f3d0' 
                                            }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#064e3b' }}>🎯 คะแนนเฉลี่ยความพึงพอใจโดยรวม:</span>
                                                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#047857' }}>
                                                    {((workQualityRating + cleanlinessRating + professionalismRating + specAccuracyRating + handoverRating) / 5).toFixed(2)} / 5.00
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#334155', marginBottom: '6px' }}>
                                                ชื่อลูกค้าผู้ตรวจงาน <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                placeholder="ระบุชื่อลูกค้า หรือผู้แทนที่ร่วมเดินตรวจงาน..."
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
                                                ความคิดเห็นเพิ่มเติม / อื่น ๆ (ถ้ามี)
                                            </label>
                                            <textarea 
                                                rows={3} 
                                                placeholder="ระบุข้อเสนอแนะ ข้อคิดเห็นเพิ่มเติม หรือคำชื่นชมสำหรับช่าง..."
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
                                            <span>{isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันอนุมัติและปิดงาน'}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Form: Reject */
                                <div style={{ background: '#ffffff', borderRadius: '24px', padding: '1.5rem', border: '1.5px solid #ef4444', boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.08)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <XCircle size={20} style={{ color: '#ef4444' }} />
                                            <span>ส่งกลับแก้ไข (Reject)</span>
                                        </h4>
                                        <button 
                                            onClick={() => setActionType(null)}
                                            style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            ← ย้อนกลับ
                                        </button>
                                    </div>
 
                                    <div style={{ background: '#fef2f2', padding: '10px 14px', borderRadius: '12px', border: '1px solid #fee2e2', color: '#991b1b', fontSize: '0.8rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                        <div>
                                            ⚠️ การปฏิเสธจะรีเซ็ตความคืบหน้าเป็น 0% และเพิ่มรอบแก้ (REV) ใหม่
                                        </div>
                                    </div>
 
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        
                                        {/* Defect Diagnostics Section */}
                                        <div style={{ background: '#faf5f5', padding: '1.25rem', borderRadius: '20px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#7f1d1d', borderBottom: '1px solid #fee2e2', paddingBottom: '8px' }}>
                                                🔍 ระบุจุดบกพร่องที่ตรวจพบ (Defect Diagnostics)
                                            </div>
                                            
                                            {/* Defect 1 */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #fee2e2' }}>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569' }}>1. จุดบกพร่องความสวยงาม / งานสีผิว (Cosmetic Defect)</span>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCosmeticDefect(true)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                            background: cosmeticDefect ? '#fee2e2' : 'transparent', color: cosmeticDefect ? '#ef4444' : '#64748b',
                                                            border: cosmeticDefect ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        พบ
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCosmeticDefect(false)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                            background: !cosmeticDefect ? '#ecfdf5' : 'transparent', color: !cosmeticDefect ? '#10b981' : '#64748b',
                                                            border: !cosmeticDefect ? '1.5px solid #a7f3d0' : '1.5px solid #e2e8f0', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        ไม่พบ
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Defect 2 */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #fee2e2' }}>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569' }}>2. จุดบกพร่องฟังก์ชันใช้งาน / โครงสร้าง (Functional Defect)</span>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFunctionalDefect(true)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                            background: functionalDefect ? '#fee2e2' : 'transparent', color: functionalDefect ? '#ef4444' : '#64748b',
                                                            border: functionalDefect ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        พบ
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFunctionalDefect(false)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                            background: !functionalDefect ? '#ecfdf5' : 'transparent', color: !functionalDefect ? '#10b981' : '#64748b',
                                                            border: !functionalDefect ? '1.5px solid #a7f3d0' : '1.5px solid #e2e8f0', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        ไม่พบ
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Defect 3 */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #fee2e2' }}>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569' }}>3. ปัญหาเศษวัสดุ / ความสกปรกหน้างาน (Site Debris)</span>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCleanlinessDefect(true)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                            background: cleanlinessDefect ? '#fee2e2' : 'transparent', color: cleanlinessDefect ? '#ef4444' : '#64748b',
                                                            border: cleanlinessDefect ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        พบ
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCleanlinessDefect(false)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                            background: !cleanlinessDefect ? '#ecfdf5' : 'transparent', color: !cleanlinessDefect ? '#10b981' : '#64748b',
                                                            border: !cleanlinessDefect ? '1.5px solid #a7f3d0' : '1.5px solid #e2e8f0', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        ไม่พบ
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Defect 4 */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #fee2e2' }}>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569' }}>4. ชนิดวัสดุ / สีไม่ตรงสเปกสัญญา (Spec Mismatch)</span>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSpecDefect(true)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                            background: specDefect ? '#fee2e2' : 'transparent', color: specDefect ? '#ef4444' : '#64748b',
                                                            border: specDefect ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        พบ
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSpecDefect(false)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                                            background: !specDefect ? '#ecfdf5' : 'transparent', color: !specDefect ? '#10b981' : '#64748b',
                                                            border: !specDefect ? '1.5px solid #a7f3d0' : '1.5px solid #e2e8f0', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        ไม่พบ
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#334155', marginBottom: '6px' }}>
                                                รายละเอียดชำรุดเพิ่มเติม / อื่น ๆ <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <textarea 
                                                rows={3} 
                                                placeholder="อธิบายจุดชำรุดหรืองานที่ไม่เรียบร้อยอื่น ๆ เพิ่มเติม เพื่อให้ช่างแก้ไขได้ตรงจุด..."
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
                                            <span>{isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันปฏิเสธงาน'}</span>
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
                    padding: '1rem 2rem',
                    background: '#ffffff',
                    display: 'flex',
                    borderTop: '1px solid #f1f5f9',
                    alignItems: 'center',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 24px', borderRadius: '12px',
                            border: '1.5px solid #cbd5e1', background: '#f8fafc',
                            color: '#475569', fontWeight: 900, cursor: 'pointer',
                            fontSize: '0.88rem', transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; }}
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
}
