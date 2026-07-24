import { useState, useEffect } from 'react';
import { WorkOrder, MasterTask } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';
import { ModalCloseButton } from './ui/ModalCloseButton';
import {
    Camera,
    Copy, Check, FileText,
    Share2, HelpCircle
} from 'lucide-react';

interface TaskReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    workOrder: WorkOrder;
    task: MasterTask;
}

export default function TaskReviewModal({
    isOpen,
    onClose,
    workOrder,
    task
}: TaskReviewModalProps) {
    const isMobile = useIsMobile();
    const [copied, setCopied] = useState(false);
    const [afterPhotoIndex, setAfterPhotoIndex] = useState(0);

    // Reset forms on reopen or task change
    useEffect(() => {
        setCopied(false);
        setAfterPhotoIndex(0);
    }, [task.id, isOpen]);

    if (!isOpen) return null;

    // Find task category
    const category = workOrder.categories.find(c => c.tasks.some(t => t.id === task.id));
    const categoryName = category?.name || 'หมวดงานทั่วไป';

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

    // Owner Review Public Link — points to the same customer handover form
    // used by /daily-report's QR, so both entry points show one consistent
    // review experience (user-flagged inconsistency 2026-07-24).
    const protocol = window.location.protocol;
    const host = window.location.host;
    const reviewLink = `${protocol}//${host}/handover?woId=${workOrder.id}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(reviewLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
                            QR Code สำหรับให้ลูกค้าตรวจรับงาน
                        </h2>
                    </div>
                    <ModalCloseButton onClick={onClose} buttonSize={38} style={{ borderRadius: '50%' }} />
                </div>

                {/* Content */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '1.5rem 2rem', background: '#f8fafc' }}>
                    
                    {/* Before & After Photo Comparison */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                        
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
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
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

                    {/* Owner QR review link */}
                        <div style={{ background: '#ffffff', borderRadius: '24px', padding: '1.5rem', border: '1px solid #cbd5e1', display: 'flex', gap: '1.5rem', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                            
                            {/* Real scannable QR Code, encodes reviewLink */}
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
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(reviewLink)}`}
                                    alt="Owner QR Pass"
                                    style={{ width: '130px', height: '130px' }}
                                />
                                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#64748b', marginTop: '10px', zIndex: 1 }}>OWNER QR PASS</span>
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
