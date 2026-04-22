import { FileText, User, Phone } from 'lucide-react';
import { WorkOrder, MasterTask } from '../types';
import WorkOrderCard from './WorkOrderCard';
import { useWorkOrders } from '../context/WorkOrderContext';
import LoadingOverlay from './LoadingOverlay';
import { useState } from 'react';

interface WorkOrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    wo: WorkOrder;
    onTaskClick: (task: MasterTask, categoryId: string, workOrderId: string, categoryName?: string) => void;
    onComplete?: (wo: WorkOrder) => void;
    taskDecisions?: Record<string, 'Approved' | 'Assigned' | 'Rejected'>;
}

const WorkOrderDetailModal = ({
    isOpen,
    onClose,
    wo,
    onTaskClick,
    onComplete,
    taskDecisions
}: WorkOrderDetailModalProps) => {
    const { staff } = useWorkOrders();
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            padding: '2rem'
        }} onClick={onClose}>
            <LoadingOverlay isVisible={isSubmitting} />
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
                    padding: '1.75rem 2.5rem',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
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
                            marginLeft: 'auto',
                            marginRight: '24px'
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

                    <button
                        onClick={onClose}
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#000000',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
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

                {/* Content */}
                <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                    <WorkOrderCard
                        wo={wo}
                        variant="default"
                        showStatusBadge={true}
                        onTaskClick={onTaskClick}
                        initialExpanded={true}
                        taskDecisions={taskDecisions}
                    />
                </div>

                {/* Footer */}
                {onComplete && (
                    <div style={{
                        padding: '1.5rem 2.5rem',
                        background: '#ffffff',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '1rem'
                    }}>
                        <button
                            onClick={async () => {
                                if (onComplete) {
                                    setIsSubmitting(true);
                                    try {
                                        await onComplete(wo);
                                    } finally {
                                        setIsSubmitting(false);
                                    }
                                }
                            }}
                            disabled={isSubmitting}
                            style={{
                                background: '#4f46e5',
                                color: '#ffffff',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: '12px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <FileText size={18} /> บันทึกผลการตรวจสอบ
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
};

export default WorkOrderDetailModal;
