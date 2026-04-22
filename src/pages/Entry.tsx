import { useState, useMemo, useEffect } from 'react';
import { 
    Plus, 
    Wrench, 
    FileText, 
    Package, 
    Clock, 
    Search, 
    Edit, 
    Trash2, 
    AlertCircle,
    CheckCircle2,
    XCircle,
    ClipboardCheck
} from 'lucide-react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import ForemanReportModal from '../components/ForemanReportModal';
import { WorkOrder, WorkOrderType } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';

const Entry = () => {
    const { user } = useAuth();
    const { workOrders, deleteWorkOrder, archiveWorkOrder } = useWorkOrders();
    const location = useLocation();
    const navigate = useNavigate();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<WorkOrderType>('AfterSale');
    const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    // ✅ Deep Link: Handle highlighting instead of immediate edit
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const workOrderId = params.get('id');

        if (workOrderId && workOrders.length > 0) {
            const wo = workOrders.find(w => w.id === workOrderId);
            if (wo) {
                setHighlightedId(workOrderId);
                
                // Scroll to the element if possible (using ID or a slight delay)
                setTimeout(() => {
                    const el = document.getElementById(`wo-card-${workOrderId}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);

                // Clear highlight after 5 seconds
                setTimeout(() => setHighlightedId(null), 5000);

                // Clear the ID from URL
                const newParams = new URLSearchParams(location.search);
                newParams.delete('id');
                const newSearch = newParams.toString();
                navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
            }
        }
    }, [location.search, workOrders]);

    const handleCreateNew = (type: WorkOrderType) => {
        setSelectedType(type);
        setSelectedOrder(null);
        setIsCreateModalOpen(true);
    };

    const handleEditDraftOrEvaluating = (order: WorkOrder) => {
        setSelectedOrder(order);
        setSelectedType(order.type);
        setIsEditModalOpen(true);
    };

    // Filter logic: Only Draft and Evaluating (รอประเมิน)
    const filteredDrafts = useMemo(() => {
        return workOrders.filter(wo => 
            wo.status === 'Draft' && 
            (user?.role === 'Admin' || wo.reporterId === user?.id) &&
            (searchQuery === '' || wo.locationName.toLowerCase().includes(searchQuery.toLowerCase()) || wo.id.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [workOrders, user, searchQuery]);

    const filteredTracking = useMemo(() => {
        return workOrders
            .filter(wo => 
                (wo.status === 'Evaluating' || wo.status === 'Rejected') && 
                !wo.isArchived &&
                (user?.role === 'Admin' || wo.reporterId === user?.id) &&
                (searchQuery === '' || wo.locationName.toLowerCase().includes(searchQuery.toLowerCase()) || wo.id.toLowerCase().includes(searchQuery.toLowerCase()))
            )
            .sort((a, b) => {
                const dateA = new Date(a.submittedAt || a.createdAt).getTime();
                const dateB = new Date(b.submittedAt || b.createdAt).getTime();
                return dateB - dateA; // Descending: Newest first
            });
    }, [workOrders, user, searchQuery]);

    // Split by type
    const afterSaleDrafts = filteredDrafts.filter(wo => wo.type === 'AfterSale');
    const preHandoverDrafts = filteredDrafts.filter(wo => wo.type === 'PreHandover');
    const afterSaleTracking = filteredTracking.filter(wo => wo.type === 'AfterSale');
    const preHandoverTracking = filteredTracking.filter(wo => wo.type === 'PreHandover');

    const StatusBadge = ({ status }: { status: string }) => {
        const styles: Record<string, { bg: string, text: string, label: string, icon: any }> = {
            'Evaluating': { bg: '#eff6ff', text: '#3b82f6', label: 'รอประเมิน', icon: <Search size={12} /> },
            'Pending': { bg: '#fff7ed', text: '#f97316', label: 'รออนุมัติ', icon: <Clock size={12} /> },
            'Approved': { bg: '#f0fdf4', text: '#22c55e', label: 'อนุมัติแล้ว', icon: <CheckCircle2 size={12} /> },
            'In Progress': { bg: '#f5f3ff', text: '#8b5cf6', label: 'กำลังดำเนินการ', icon: <Wrench size={12} /> },
            'Completed': { bg: '#f0fdf4', text: '#16a34a', label: 'เสร็จสิ้น', icon: <CheckCircle2 size={12} /> },
            'Rejected': { bg: '#fef2f2', text: '#ef4444', label: 'ปฏิเสธ', icon: <XCircle size={12} /> },
        };

        const style = styles[status] || { bg: '#f3f4f6', text: '#6b7280', label: status, icon: <Clock size={12} /> };

        return (
            <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                padding: '4px 10px', 
                borderRadius: '99px', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                backgroundColor: style.bg, 
                color: style.text,
                boxShadow: `inset 0 0 0 1px ${style.text}20`
            }}>
                {style.icon}
                {style.label}
            </span>
        );
    };

    const ActionCard = ({ title, subtitle, icon: Icon, color, onClick }: any) => (
        <button
            onClick={onClick}
            style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '24px',
                padding: '24px 32px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                width: '100%',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                e.currentTarget.style.borderColor = color;
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.borderColor = '#e5e7eb';
            }}
        >
            <div style={{
                background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`,
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: color,
                flexShrink: 0
            }}>
                <Icon size={28} />
            </div>
            <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827' }}>{title}</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>{subtitle}</p>
            </div>
            <div style={{ color: '#9ca3af' }}>
                <Plus size={20} />
            </div>
        </button>
    );

    const SectionHeader = ({ title, count, color }: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '3px', height: '16px', background: color, borderRadius: '4px' }} />
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{title}</h2>
            {count > 0 && (
                <span style={{ 
                    background: `${color}15`, 
                    color: color, 
                    padding: '2px 8px', 
                    borderRadius: '8px', 
                    fontSize: '0.7rem', 
                    fontWeight: 800 
                }}>
                    {count}
                </span>
            )}
        </div>
    );

    const WorkOrderCard = ({ wo, isDraft }: { wo: WorkOrder, isDraft: boolean }) => {
        const rejectionReason = wo.status === 'Rejected' ? wo.categories
            .flatMap(c => c.tasks)
            .find(t => t.status === 'Rejected' && t.rootCause)?.rootCause : null;

        return (
            <div
                id={`wo-card-${wo.id}`}
                style={{
                    background: highlightedId === wo.id ? '#fffbeb' : '#ffffff',
                    border: highlightedId === wo.id ? '2px solid #f59e0b' : '1px solid #f3f4f6',
                    borderRadius: '20px',
                    padding: '16px 20px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'flex-start', // Top-aligned
                    gap: '16px',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: highlightedId === wo.id ? '0 10px 15px -3px rgba(245, 158, 11, 0.2)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    cursor: 'pointer',
                    minHeight: '100px', // Uniform height
                    position: 'relative',
                    transform: highlightedId === wo.id ? 'scale(1.02)' : 'translateY(0)',
                    zIndex: highlightedId === wo.id ? 10 : 1
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#f3f4f6';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
                onClick={() => handleEditDraftOrEvaluating(wo)}
            >
                {/* Icon Column */}
                <div style={{
                    width: '48px',
                    height: '48px',
                    background: '#f8fafc',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: wo.type === 'AfterSale' ? '#6366f1' : '#10b981',
                    flexShrink: 0,
                    marginTop: '2px'
                }}>
                    <Package size={22} />
                </div>

                {/* Content Column */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.02em' }}>{wo.id}</span>
                    </div>
                    
                    <h4 style={{ 
                        margin: 0, 
                        fontSize: '0.95rem', 
                        fontWeight: 800, 
                        color: '#1e293b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {wo.locationName}
                    </h4>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                            {new Date(wo.submittedAt || wo.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!isDraft && <StatusBadge status={wo.status} />}
                        
                        {/* Rejection Reason - Following Status */}
                        {rejectionReason && (
                            <span style={{ 
                                padding: '2px 10px', 
                                background: '#fff1f2', 
                                border: '1px solid #fecaca',
                                borderRadius: '100px',
                                fontSize: '0.75rem', 
                                color: '#991b1b', 
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <AlertCircle size={12} /> {rejectionReason}
                            </span>
                        )}
                    </div>

                    {/* ✅ Status Progress Timeline */}
                    {!isDraft && (
                        <div style={{ 
                            marginTop: '12px', 
                            padding: '12px', 
                            background: '#f8fafc', 
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            {/* Step 1: Submitted */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCircle2 size={12} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1e293b' }}>ส่งแล้ว</span>
                                    <span style={{ fontSize: '0.6rem', color: '#64748b' }}>{new Date(wo.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                                </div>
                            </div>

                            <div style={{ flex: 1, height: '2px', background: wo.adminReviewedAt ? '#22c55e' : '#e2e8f0' }} />

                            {/* Step 2: Admin Reviewed */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ 
                                    width: '18px', height: '18px', borderRadius: '50%', 
                                    background: wo.adminReviewedAt ? '#22c55e' : '#f1f5f9', 
                                    color: wo.adminReviewedAt ? 'white' : '#94a3b8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: wo.adminReviewedAt ? 'none' : '1px solid #e2e8f0'
                                }}>
                                    {wo.adminReviewedAt ? <CheckCircle2 size={12} /> : <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8' }} />}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: wo.adminReviewedAt ? '#1e293b' : '#94a3b8' }}>แอดมินเปิดดู</span>
                                    {wo.adminReviewedAt && <span style={{ fontSize: '0.6rem', color: '#64748b' }}>{new Date(wo.adminReviewedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>}
                                </div>
                            </div>

                            <div style={{ flex: 1, height: '2px', background: (wo.status !== 'Evaluating' && wo.status !== 'Draft') ? '#22c55e' : '#e2e8f0' }} />

                            {/* Step 3: Result */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ 
                                    width: '18px', height: '18px', borderRadius: '50%', 
                                    background: (wo.status !== 'Evaluating' && wo.status !== 'Draft') ? (wo.status === 'Rejected' ? '#ef4444' : '#22c55e') : '#f1f5f9', 
                                    color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: (wo.status !== 'Evaluating' && wo.status !== 'Draft') ? 'none' : '1px solid #e2e8f0'
                                }}>
                                    {(wo.status !== 'Evaluating' && wo.status !== 'Draft') ? (wo.status === 'Rejected' ? <XCircle size={12} /> : <CheckCircle2 size={12} />) : <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8' }} />}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: (wo.status !== 'Evaluating' && wo.status !== 'Draft') ? '#1e293b' : '#94a3b8' }}>
                                        {wo.status === 'Evaluating' ? 'กำลังประเมิน' : (wo.status === 'Rejected' ? 'ปฏิเสธ' : 'ประเมินแล้ว')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions Column - Vertical Arrangement */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center', alignSelf: 'stretch' }}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleEditDraftOrEvaluating(wo); }}
                        title={wo.status === 'Rejected' ? 'แก้ไขใหม่' : 'แก้ไข'}
                        style={{ 
                            padding: '6px 12px', 
                            color: '#4f46e5', 
                            background: '#eff6ff', 
                            border: '1px solid #dbeafe', 
                            borderRadius: '8px', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            transition: 'all 0.15s',
                            minWidth: '94px'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                    >
                        <Edit size={14} />
                        {wo.status === 'Rejected' ? 'แก้ไขใหม่' : 'แก้ไข'}
                    </button>

                    {isDraft && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); if(window.confirm('ต้องการลบแบบร่างนี้?')) deleteWorkOrder(wo.id); }}
                            style={{ 
                                padding: '6px 12px', 
                                color: '#ef4444', 
                                background: '#fef2f2', 
                                border: '1px solid #fee2e2', 
                                borderRadius: '8px', 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                transition: 'all 0.15s',
                                minWidth: '94px'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                        >
                            <Trash2 size={14} />
                            ลบแบบร่าง
                        </button>
                    )}
                    
                    {(wo.status === 'Rejected' || wo.status === 'Evaluating') && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); if(window.confirm('ยืนยันการยกเลิกใบงานนี้?')) archiveWorkOrder(wo.id); }}
                            style={{ 
                                padding: '6px 12px', 
                                color: '#ef4444', 
                                background: '#fff1f2', 
                                border: '1px solid #fee2e2', 
                                borderRadius: '8px', 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                transition: 'all 0.15s',
                                minWidth: '94px'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#fff1f2'; }}
                        >
                            <XCircle size={14} />
                            ยกเลิก
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const ScrollableZone = ({ children, emptyIcon: EmptyIcon, emptyText }: any) => (
        <div style={{ 
            height: '280px', 
            overflowY: 'auto', 
            paddingRight: '8px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#e5e7eb transparent'
        }}>
            {children.length > 0 ? children : (
                <div style={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f9fafb',
                    border: '1px dashed #e5e7eb',
                    borderRadius: '24px',
                    color: '#9ca3af'
                }}>
                    <EmptyIcon size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>{emptyText}</p>
                </div>
            )}
        </div>
    );

    return (
        <div style={{ 
            padding: '40px', 
            maxWidth: '1600px', 
            margin: '0 auto', 
            fontFamily: "'Plus Jakarta Sans', 'Sarabun', sans-serif" 
        }}>
            {/* Header Area */}
            <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.025em' }}>
                        ใบงานและติดตามผล
                    </h1>
                    <p style={{ margin: '8px 0 0 0', fontSize: '1rem', color: '#6b7280', fontWeight: 500 }}>
                        ศุนย์รวมการจัดการใบงานและติดตามสถานะประเมิน
                    </p>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                        <input 
                            type="text" 
                            placeholder="ค้นหาเลขที่หรือสถานที่..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '12px 16px 12px 40px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                width: '320px',
                                outline: 'none',
                                fontSize: '0.9rem',
                                background: '#f9fafb',
                                transition: 'all 0.2s'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Top Action Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '48px' }}>
                <ActionCard 
                    title="แจ้งซ่อมทั่วไป"
                    subtitle="งานซ่อมบำรุงและดูแลหลังการขาย (After Sale)"
                    icon={Wrench}
                    color="#6366f1"
                    onClick={() => handleCreateNew('AfterSale')}
                />
                <ActionCard 
                    title="ตรวจรับห้อง"
                    subtitle="การตรวจรับมอบคุณภาพก่อนส่งมอบ (Pre-handover)"
                    icon={ClipboardCheck}
                    color="#10b981"
                    onClick={() => handleCreateNew('PreHandover')}
                />
            </div>

            {/* Dashboard Content: 4-Zone Grid */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px' // Reduced gap as requested
            }}>
                
                {/* 1. After Sale Drafts */}
                <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #f3f4f6', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ 
                            background: '#6366f115', color: '#6366f1',
                            width: '32px', height: '32px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Wrench size={18} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#111827' }}>แบบร่างแจ้งซ่อมทั่วไป</h2>
                    </div>
                    <ScrollableZone emptyIcon={FileText} emptyText="ไม่มีแบบร่างในหมวดนี้">
                        {afterSaleDrafts.map(wo => <WorkOrderCard key={wo.id} wo={wo} isDraft={true} />)}
                    </ScrollableZone>
                </div>

                {/* 2. Pre-Handover Drafts */}
                <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #f3f4f6', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ 
                            background: '#10b98115', color: '#10b981',
                            width: '32px', height: '32px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <ClipboardCheck size={18} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#111827' }}>แบบร่างตรวจรับห้อง</h2>
                    </div>
                    <ScrollableZone emptyIcon={FileText} emptyText="ไม่มีแบบร่างในหมวดนี้">
                        {preHandoverDrafts.map(wo => <WorkOrderCard key={wo.id} wo={wo} isDraft={true} />)}
                    </ScrollableZone>
                </div>

                {/* 3. After Sale Tracking */}
                <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #f3f4f6', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ 
                            background: '#6366f115', color: '#6366f1',
                            width: '32px', height: '32px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Clock size={18} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#111827' }}>ติดตามการแจ้งซ่อม</h2>
                    </div>
                    <SectionHeader title="รายการรอประเมิน / แก้ไข" count={afterSaleTracking.length} color="#6366f1" />
                    <ScrollableZone emptyIcon={Clock} emptyText="ไม่มีงานที่รอประเมิน">
                        {afterSaleTracking.map(wo => <WorkOrderCard key={wo.id} wo={wo} isDraft={false} />)}
                    </ScrollableZone>
                </div>

                {/* 4. Pre-Handover Tracking */}
                <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #f3f4f6', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ 
                            background: '#10b98115', color: '#10b981',
                            width: '32px', height: '32px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Clock size={18} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#111827' }}>ติดตามการตรวจรับ</h2>
                    </div>
                    <SectionHeader title="รายการรอประเมิน / แก้ไข" count={preHandoverTracking.length} color="#10b981" />
                    <ScrollableZone emptyIcon={Clock} emptyText="ไม่มีงานที่รอประเมิน">
                        {preHandoverTracking.map(wo => <WorkOrderCard key={wo.id} wo={wo} isDraft={false} />)}
                    </ScrollableZone>
                </div>

            </div>

            {/* Modals */}
            <ForemanReportModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
                initialWorkType={selectedType}
            />

            <ForemanReportModal 
                isOpen={isEditModalOpen} 
                onClose={() => setIsEditModalOpen(false)} 
                editWorkOrder={selectedOrder || undefined}
            />
        </div>
    );
};

export default Entry;
