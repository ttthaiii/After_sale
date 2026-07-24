import { FileText, User, Phone, Clock, Star, Sparkles, Users } from 'lucide-react';
import { WorkOrder, MasterTask } from '../types';
import WorkOrderCard from './WorkOrderCard';
import { useWorkOrders } from '../context/WorkOrderContext';
import { formatDateTime } from '../utils/date';
import { useIsMobile } from '../hooks/useIsMobile';
import { ModalCloseButton } from './ui/ModalCloseButton';


interface WorkOrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    wo: WorkOrder;
    onTaskClick: (task: MasterTask, categoryId: string, workOrderId: string, categoryName?: string) => void;
    taskDecisions?: Record<string, 'Assigned' | 'Rejected'>;
    onPreHandoverAssign?: () => void;
}

const WorkOrderDetailModal = ({
    isOpen,
    onClose,
    wo,
    onTaskClick,
    taskDecisions,
    onPreHandoverAssign
}: WorkOrderDetailModalProps) => {
    const { staff } = useWorkOrders();
    const isMobile = useIsMobile();


    if (!isOpen) return null;

    const reporter = staff.find(s => s.id === wo.reporterId);



    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: isMobile ? '12px' : '2rem'
        }} onClick={onClose}>

            <div
                style={{
                    backgroundColor: '#f8fafc',
                    width: '100%',
                    maxWidth: '1000px',
                    maxHeight: '90vh',
                    borderRadius: '32px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: isMobile ? '1rem' : '1.75rem 2.5rem',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: isMobile ? '12px' : undefined,
                    borderBottom: '1px solid #f1f5f9',
                    position: 'relative'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            padding: '12px',
                            borderRadius: '16px',
                            color: '#ffffff',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                            display: 'flex'
                        }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>รายละเอียดใบงาน</h2>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>ตรวจสอบข้อมูลและสถานะการดำเนินงาน</p>
                        </div>
                    </div>

                    {/* Foreman Info Section */}
                    {reporter && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 16px',
                            background: '#f8fafc',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            marginLeft: isMobile ? 0 : 'auto',
                            marginRight: isMobile ? 0 : '24px'
                        }}>
                            <div style={{ 
                                width: '40px', 
                                height: '40px', 
                                borderRadius: '50%', 
                                overflow: 'hidden', 
                                background: '#e2e8f0',
                                border: '2px solid #fff',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                                {reporter.profileImage ? (
                                    <img src={reporter.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                        <User size={20} />
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
                                    {reporter.name}
                                    <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#6366f1', background: '#e0e7ff', padding: '2px 6px', borderRadius: '6px' }}>ผู้ส่งงาน</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>
                                    <Phone size={12} />
                                    <span>{reporter.phone || '-'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <ModalCloseButton
                        onClick={onClose}
                        size={20}
                        style={{ width: '44px', height: '44px', borderRadius: '50%', alignSelf: isMobile ? 'flex-end' : undefined }}
                    />
                </div>

                {/* Content */}
                <div style={{ padding: isMobile ? '12px' : '2rem', overflowY: 'auto', flex: 1 }}>

                    {/* Customer Inspection Metrics Drawer */}
                    {(() => {
                        const hasTimeline = wo.inspectionTimeline && Object.keys(wo.inspectionTimeline).length > 0;
                        const hasSurvey = wo.satisfactionSurvey && Object.keys(wo.satisfactionSurvey).length > 0;

                        const formatTime = (isoString?: string) => {
                            if (!isoString) return 'ยังไม่เริ่ม';
                            return formatDateTime(isoString);
                        };

                        if (!hasTimeline && !hasSurvey) return null;

                        return (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : (hasTimeline && hasSurvey ? '1fr 1fr' : '1fr'),
                                gap: '1.5rem',
                                marginBottom: '2rem',
                                animation: 'fadeIn 0.3s ease-out'
                            }}>
                                {/* Left Side: Timeline */}
                                {hasTimeline && (
                                    <div style={{
                                        background: '#ffffff',
                                        borderRadius: '24px',
                                        padding: '1.5rem',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#4f46e5' }}>
                                            <Clock size={18} />
                                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#1e293b' }}>
                                                ประวัติการตรวจรับของลูกค้า (SLA Timeline)
                                            </h3>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', paddingLeft: '0.5rem' }}>
                                            <div style={{ position: 'absolute', left: '14px', top: '10px', bottom: '10px', width: '2px', background: '#e2e8f0' }} />
                                            
                                            {[
                                                { label: 'งานในใบงานเสร็จครบ 100%', time: wo.inspectionTimeline?.allTasksCompletedAt, color: '#10b981' },
                                                { label: 'สร้าง QR Code ส่งมอบงานสำเร็จ', time: wo.inspectionTimeline?.qrGeneratedAt, color: '#6366f1' },
                                                { label: 'ลูกค้าสแกนเปิดลิงก์ตรวจรับครั้งแรก', time: wo.inspectionTimeline?.customerFirstScannedAt, color: '#f59e0b' },
                                                { label: 'ลูกค้าเริ่มพิจารณาประเมินผลงาน', time: wo.inspectionTimeline?.inspectionStartedAt, color: '#ec4899' },
                                                { label: 'ลูกค้ากดยืนยันผลตรวจรับเรียบร้อย', time: wo.inspectionTimeline?.inspectionSubmittedAt, color: '#22c55e' }
                                            ].map((step, idx) => {
                                                const isActive = !!step.time;
                                                return (
                                                    <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                                        <div style={{
                                                            width: '10px',
                                                            height: '10px',
                                                            borderRadius: '50%',
                                                            background: isActive ? step.color : '#cbd5e1',
                                                            border: `4px solid ${isActive ? '#f1f5f9' : '#fff'}`,
                                                            boxShadow: isActive ? `0 0 8px ${step.color}` : 'none',
                                                            marginTop: '4px',
                                                            flexShrink: 0
                                                        }} />
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isActive ? '#334155' : '#94a3b8' }}>
                                                                {step.label}
                                                            </span>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isActive ? '#64748b' : '#cbd5e1' }}>
                                                                {formatTime(step.time)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Right Side: CSAT Satisfaction Survey */}
                                {hasSurvey && wo.satisfactionSurvey && (
                                    <div style={{
                                        background: '#ffffff',
                                        borderRadius: '24px',
                                        padding: '1.5rem',
                                        border: '1px solid #86efac',
                                        boxShadow: '0 4px 6px -1px rgba(34,197,94,0.02)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#15803d' }}>
                                            <Sparkles size={18} style={{ color: '#22c55e' }} />
                                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#1e293b' }}>
                                                ผลประเมินความพึงพอใจลูกค้า (CSAT 5 มิติ)
                                            </h3>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {[
                                                { label: '1. คุณภาพงานซ่อมแซม (Work Quality)', score: wo.satisfactionSurvey.workQuality },
                                                { label: '2. ความเรียบร้อยหน้างาน (Cleanliness)', score: wo.satisfactionSurvey.siteCleanliness },
                                                { label: '3. ความเป็นมืออาชีพโฟร์แมน (Professionalism)', score: wo.satisfactionSurvey.foremanProfessionalism },
                                                { label: '4. ความถูกต้องตามข้อกำหนดสเปก (Spec Accuracy)', score: wo.satisfactionSurvey.specAccuracy },
                                                { label: '5. การดูแลระมัดระวังทรัพย์สิน (Handover Care)', score: wo.satisfactionSurvey.handoverCare }
                                            ].map((surveyItem, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                                                        {surveyItem.label}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '2px', color: '#eab308' }}>
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <Star 
                                                                key={star} 
                                                                size={14} 
                                                                fill={star <= surveyItem.score ? 'currentColor' : 'none'} 
                                                                strokeWidth={2} 
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {(() => {
                        const displayWo = wo.status === 'Rejected' 
                            ? {
                                ...wo,
                                categories: wo.categories
                                    .map(cat => ({
                                        ...cat,
                                        tasks: cat.tasks.filter((t: any) => t.status === 'Rejected')
                                    }))
                                    .filter(cat => cat.tasks.length > 0)
                              }
                            : wo;

                        return (
                            <WorkOrderCard
                                wo={displayWo}
                                variant="default"
                                showStatusBadge={true}
                                onTaskClick={onTaskClick}
                                initialExpanded={true}
                                taskDecisions={taskDecisions}
                            />
                        );
                    })()}
                </div>

                {/* Footer: PreHandover assign button */}
                {wo.type === 'PreHandover' && wo.status === 'Evaluating' && onPreHandoverAssign && (
                    <div style={{ padding: '16px 28px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={onPreHandoverAssign}
                            style={{
                                padding: '12px 28px', borderRadius: '12px', fontWeight: 800, fontSize: '0.95rem',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#ffffff', border: 'none', cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(16,185,129,0.4)'; }}
                            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)'; }}
                        >
                            <Users size={16} />
                            อนุมัติ &amp; มอบหมายงาน
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
};

export default WorkOrderDetailModal;
