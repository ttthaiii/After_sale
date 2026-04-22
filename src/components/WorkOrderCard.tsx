import { useState } from 'react';
import { WorkOrder, MasterTask } from '../types';
import { ChevronDown, ChevronRight, Clock, MapPin, User, HardHat, Info, FileText, Search, CheckCircle2, XCircle } from 'lucide-react';
import ImageOverlay from './ImageOverlay';
import { useWorkOrders } from '../context/WorkOrderContext';

interface WorkOrderCardProps {
    wo: WorkOrder;
    onTaskClick?: (task: MasterTask, categoryId: string, workOrderId: string, categoryName: string) => void;
    onVerifyTask?: (task: MasterTask) => void;
    showStatusBadge?: boolean;
    variant?: 'default' | 'compact';
    onClick?: () => void;
    initialExpanded?: boolean;
    taskDecisions?: Record<string, 'Approved' | 'Assigned' | 'Rejected'>;
    style?: React.CSSProperties;
}

const WorkOrderCard = ({
    wo,
    onTaskClick,
    onVerifyTask,
    showStatusBadge = true,
    variant = 'default',
    onClick,
    initialExpanded,
    taskDecisions,
    style
}: WorkOrderCardProps) => {
    const { projects, staff: staffList, contractors } = useWorkOrders();
    const isCompact = variant === 'compact';
    const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(
        wo.categories.reduce((acc, cat) => ({ ...acc, [cat.id]: false }), {}) // Default collapse all categories
    );
    const [overlayImage, setOverlayImage] = useState<string | null>(null);

    const toggleCat = (catId: string) => {
        setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return '#f59e0b'; // Amber
            case 'Approved': return '#10b981'; // Emerald
            case 'Partially Approved': return '#84cc16'; // Lime
            case 'Rejected': return '#ef4444'; // Red
            case 'In Progress': return '#3b82f6'; // Blue
            case 'Completed': return '#8b5cf6'; // Violet
            case 'Verified': return '#06b6d4'; // Cyan
            case 'Assigned': return '#f59e0b'; // Amber
            default: return '#6b7280';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'Pending': return 'รอตรวจสอบ';
            case 'Approved': return 'อนุมัติแล้ว';
            case 'Partially Approved': return 'อนุมัติบางส่วน';
            case 'Rejected': return 'ไม่อนุมัติ';
            case 'In Progress': return 'กำลังดำเนินการ';
            case 'Completed': return 'เสร็จสมบูรณ์';
            case 'Verified': return 'ตรวจสอบแล้ว';
            case 'Assigned': return 'มอบหมายแล้ว';
            default: return status;
        }
    };

    const getAssigneeInfo = (task: MasterTask) => {
        if (task.contractorId) {
            const con = contractors.find(c => c.id === task.contractorId);
            return { name: con?.name || 'Unknown Contractor', type: 'Contractor', phone: '02-xxx-xxxx' };
        }
        if (task.responsibleStaffIds && task.responsibleStaffIds.length > 0) {
            const staff = staffList.find(s => s.id === task.responsibleStaffIds![0]);
            return { name: staff?.name || 'Unknown Staff', type: 'Staff', phone: staff?.phone || '-' };
        }
        if (task.assignee) {
            return { name: task.assignee, type: 'Staff', phone: '-' };
        }
        return null;
    };

    const getTimeElapsed = (workOrder: WorkOrder) => {
        const baseDate = new Date(workOrder.submittedAt || workOrder.createdAt);
        const now = new Date();
        const diff = now.getTime() - baseDate.getTime();
        
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

        let label = 'ค้างตรวจสอบ ';
        let color = '#10b981'; // Default Green (<1d)
        let isDelayed = false;

        if (days >= 3) {
            label = `ล่าช้า ${days} วัน ${hours} ชม.`;
            color = '#ef4444'; // Red
            isDelayed = true;
        } else if (days === 2) {
            label = `ค้าง ${days} วัน ${hours} ชม.`;
            color = '#f97316'; // Orange
        } else if (days === 1) {
            label = `ค้าง ${days} วัน ${hours} ชม.`;
            color = '#f59e0b'; // Yellow (Amber)
        } else {
            label = `ค้าง ${hours} ชม.`;
            color = '#10b981'; // Green
        }

        return { label, color, isDelayed };
    };

    const timeInfo = getTimeElapsed(wo);

    const [showDetails, setShowDetails] = useState(initialExpanded !== undefined ? initialExpanded : variant === 'default');

    return (
        <div
            onClick={onClick}
            style={{
                border: '1px solid #e2e8f0',
                borderRadius: '24px',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: isCompact ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : '0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                marginBottom: isCompact ? '0' : '1rem',
                cursor: onClick ? 'pointer' : 'default',
                ...style
            }}
            onMouseOver={e => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 20px -5px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                }
            }}
            onMouseOut={e => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isCompact ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : '0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                }
            }}
        >
            {/* Header: Project & ID */}
            <div
                onClick={() => {
                    if (isCompact && onClick) {
                        onClick();
                    } else if (!isCompact) {
                        setShowDetails(!showDetails);
                    }
                }}
                style={{
                    background: '#ffffff',
                    padding: isCompact ? '1.25rem' : '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    position: 'relative'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: isCompact ? '1rem' : '1.25rem' }}>
                    <div style={{
                        background: '#f1f5f9',
                        width: isCompact ? '40px' : '48px',
                        height: isCompact ? '40px' : '48px',
                        borderRadius: isCompact ? '10px' : '14px',
                        color: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                        {projects.find(p => p.id === wo.projectId)?.imageUrl ? (
                            <img loading="lazy" src={projects.find(p => p.id === wo.projectId)?.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Clock size={isCompact ? 20 : 24} />
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: isCompact ? '1rem' : '1.15rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{wo.id}</div>
                        <div style={{ fontSize: isCompact ? '0.75rem' : '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontWeight: 600 }}>
                            <MapPin size={isCompact ? 10 : 12} style={{ opacity: 0.7 }} /> {projects.find(p => p.id === wo.projectId)?.name || 'ไม่ระบุโครงการ'}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: isCompact ? '0.5rem' : '1.25rem' }}>
                    {/* Elapsed Time / Delay Indicator */}
                    {wo.status === 'Evaluating' && (
                        <div style={{
                            fontSize: isCompact ? '0.7rem' : '0.8rem',
                            fontWeight: 800,
                            padding: isCompact ? '4px 8px' : '6px 12px',
                            borderRadius: '10px',
                            background: `${timeInfo.color}08`,
                            color: timeInfo.color,
                            border: `1px solid ${timeInfo.color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: timeInfo.isDelayed ? '0 0 10px rgba(239, 68, 68, 0.1)' : 'none'
                        }}>
                            <Clock size={14} />
                            {timeInfo.label}
                        </div>
                    )}

                    {showStatusBadge && wo.status !== 'Evaluating' && (
                        <div style={{
                            fontSize: isCompact ? '0.7rem' : '0.8rem',
                            fontWeight: 800,
                            padding: isCompact ? '4px 10px' : '6px 16px',
                            borderRadius: '10px',
                            background: `${getStatusColor(wo.status)}08`,
                            color: getStatusColor(wo.status),
                            border: `1px solid ${getStatusColor(wo.status)}15`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: getStatusColor(wo.status) }}></div>
                            {getStatusLabel(wo.status)}
                        </div>
                    )}
                    {!isCompact && (
                        <div style={{ color: '#94a3b8', transition: 'transform 0.2s' }}>
                            {showDetails ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Info Section */}
            {showDetails && !isCompact && (
                <>
                    {/* Info Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
                        gap: '1.5rem',
                        padding: '1.5rem',
                        background: '#ffffff',
                        borderBottom: '1px solid #f1f5f9'
                    }}>
                        {/* ข้อมูลงาน */}
                        <div style={{
                            background: '#fcfcfd',
                            padding: '1.25rem',
                            borderRadius: '16px',
                            border: '1px solid #f1f5f9',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>ข้อมูลงาน</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>วันที่แจ้งซ่อม</span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{wo.reportDate ? new Date(wo.reportDate).toLocaleDateString('th-TH') : '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>วันนัดดำเนินการ</span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{wo.appointmentDate ? new Date(wo.appointmentDate).toLocaleDateString('th-TH') : '-'}</span>
                            </div>
                            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px', marginTop: '4px' }}>
                                <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '4px' }}>ปัญหาเบื้องต้น</div>
                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem', lineHeight: 1.4 }}>{wo.initialProblem || 'ไม่ได้ระบุ'}</div>
                            </div>
                        </div>

                        {/* ข้อมูลสถานที่ */}
                        <div style={{
                            background: '#fcfcfd',
                            padding: '1.25rem',
                            borderRadius: '16px',
                            border: '1px solid #f1f5f9',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>ข้อมูลสถานที่</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>อาคาร</span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{wo.building || wo.locationName.split(' - ')[1] || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>ชั้น</span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{wo.floor || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>ห้อง</span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{wo.room || wo.locationName.split(' - ')[0].replace('Unit ', '') || '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Reporter Info Bar */}
                    {(wo.reporterName || wo.reporterPhone) && (
                        <div style={{
                            background: '#f0fdf4',
                            padding: '10px 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            borderBottom: '1px solid #dcfce7',
                        }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                overflow: 'hidden', background: '#dcfce7',
                                border: '1px solid #86efac', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                {staffList.find(s => s.name === wo.reporterName)?.profileImage ? (
                                    <img loading="lazy" src={staffList.find(s => s.name === wo.reporterName)?.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <User size={14} strokeWidth={3} color="#10b981" />
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#166534' }}>{wo.reporterName}</span>
                                <span style={{ color: '#86efac', fontWeight: 300 }}>|</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>
                                    <Info size={14} /> {wo.reporterPhone}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Categories & Tasks */}
                    <div style={{ padding: '1.5rem', background: '#fcfcfd' }}>
                        {wo.categories.map(cat => {
                            const isExpanded = expandedCats[cat.id];
                            return (
                                <div key={cat.id} style={{ marginBottom: '1.25rem' }}>
                                    <div
                                        onClick={() => toggleCat(cat.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            padding: '0.85rem 1.25rem',
                                            background: isExpanded ? '#ffffff' : '#fcfcfd',
                                            borderRadius: '12px',
                                            marginBottom: '0.5rem',
                                            border: '1px solid #f1f5f9',
                                        }}
                                    >
                                        <div style={{ color: '#94a3b8' }}>
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </div>
                                        <span style={{ marginLeft: '12px', fontWeight: 800, color: '#334155', fontSize: '0.95rem' }}>{cat.name}</span>
                                        <span style={{ marginLeft: 'auto', background: '#ffffff', color: '#64748b', padding: '4px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, border: '1px solid #f1f5f9' }}>
                                            {cat.tasks.length} รายการ
                                        </span>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '0' }}>
                                            {cat.tasks.some(t => t.status === 'Pending') ? (
                                                /* TABLE VIEW FOR INSPECTION (PENDING) */
                                                <div style={{
                                                    background: '#ffffff',
                                                    borderRadius: '16px',
                                                    border: '1px solid #f1f5f9',
                                                    overflow: 'hidden',
                                                    marginTop: '4px',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                                }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                                            <tr>
                                                                <th style={{ padding: '12px 20px', color: '#64748b', fontWeight: 700, width: '60px' }}>ลำดับ</th>
                                                                <th style={{ padding: '12px 20px', color: '#64748b', fontWeight: 700 }}>รายละเอียด</th>
                                                                <th style={{ padding: '12px 20px', color: '#64748b', fontWeight: 700, textAlign: 'center' }}>จำนวน</th>
                                                                <th style={{ padding: '12px 20px', color: '#64748b', fontWeight: 700, textAlign: 'center' }}>หน่วย</th>
                                                                <th style={{ padding: '12px 20px', color: '#64748b', fontWeight: 700, textAlign: 'center', width: '120px' }}>รูปภาพ</th>
                                                                <th style={{ padding: '12px 20px', color: '#64748b', fontWeight: 700, textAlign: 'center', width: '100px' }}>สถานะประเมิน</th>
                                                                <th style={{ padding: '12px 20px', color: '#64748b', fontWeight: 700, textAlign: 'right', width: '140px' }}>การจัดการ</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {cat.tasks.map((task, idx) => {
                                                                const imageUrl = (task.attachments && task.attachments.length > 0 && task.attachments[0].url) ||
                                                                    task.afterPhotoUrl ||
                                                                    task.latestPhotoUrl ||
                                                                    ((task as any).images && (task as any).images.length > 0 && (task as any).images[0]) ||
                                                                    task.beforePhotoUrl;

                                                                return (
                                                                    <tr key={task.id} style={{ borderBottom: idx === cat.tasks.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '20px', color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '20px' }}>
                                                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{task.name}</div>
                                                                            {task.position && <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, marginTop: '2px' }}>จุดที่พบ: {task.position}</div>}
                                                                        </td>
                                                                        <td style={{ padding: '20px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>{task.amount || '-'}</td>
                                                                        <td style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{task.unit || '-'}</td>
                                                                        <td style={{ padding: '20px', textAlign: 'center' }}>
                                                                            <div
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (imageUrl) setOverlayImage(imageUrl);
                                                                                }}
                                                                                style={{
                                                                                    display: 'inline-flex',
                                                                                    cursor: imageUrl ? 'zoom-in' : 'default',
                                                                                    borderRadius: '12px',
                                                                                    overflow: 'hidden',
                                                                                    border: '1.5px solid #f1f5f9',
                                                                                    width: '80px',
                                                                                    height: '60px',
                                                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                                                    transition: 'border-color 0.2s'
                                                                                }}
                                                                                onMouseOver={e => imageUrl && (e.currentTarget.style.borderColor = '#3b82f6')}
                                                                                onMouseOut={e => (e.currentTarget.style.borderColor = '#f1f5f9')}
                                                                            >
                                                                                {imageUrl ? (
                                                                                    <img src={imageUrl} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                ) : (
                                                                                    <div style={{ width: '100%', height: '100%', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', gap: '4px' }}>
                                                                                        <FileText size={16} />
                                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>ไม่มีรูปภาพ</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '20px', textAlign: 'center' }}>
                                                                            {taskDecisions?.[task.id] === 'Approved' || taskDecisions?.[task.id] === 'Assigned' ? (
                                                                                <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                    <CheckCircle2 size={24} />
                                                                                </div>
                                                                            ) : taskDecisions?.[task.id] === 'Rejected' ? (
                                                                                <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                    <XCircle size={24} />
                                                                                </div>
                                                                            ) : (
                                                                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>รอระบุผล</div>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '20px', textAlign: 'right' }}>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (onTaskClick) onTaskClick(task, cat.id, wo.id, cat.name);
                                                                                }}
                                                                                style={{
                                                                                    padding: '10px 20px',
                                                                                    background: '#fffbeb',
                                                                                    border: '1px solid #fef3c7',
                                                                                    borderRadius: '12px',
                                                                                    color: '#d97706',
                                                                                    fontSize: '0.85rem',
                                                                                    fontWeight: 800,
                                                                                    cursor: 'pointer',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '8px',
                                                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                                    boxShadow: '0 2px 4px rgba(217, 119, 6, 0.05)'
                                                                                }}
                                                                                onMouseOver={e => {
                                                                                    e.currentTarget.style.background = '#fef3c7';
                                                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.15)';
                                                                                    e.currentTarget.style.borderColor = '#fbbf24';
                                                                                }}
                                                                                onMouseOut={e => {
                                                                                    e.currentTarget.style.background = '#fffbeb';
                                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(217, 119, 6, 0.05)';
                                                                                    e.currentTarget.style.borderColor = '#fef3c7';
                                                                                }}
                                                                            >
                                                                                <Search size={14} strokeWidth={2.5} />
                                                                                <span>ตรวจสอบ</span>
                                                                                <ChevronRight size={14} strokeWidth={2.5} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                /* ORIGINAL CARD VIEW FOR ACTIVE TASKS (IN PROGRESS) */
                                                cat.tasks.map(task => {
                                                    const isRejected = task.status === 'Rejected';
                                                    const assignee = getAssigneeInfo(task);
                                                    return (
                                                        <div
                                                            key={task.id}
                                                            style={{
                                                                background: isRejected ? '#fff1f1' : '#ffffff',
                                                                padding: '1.25rem',
                                                                borderRadius: '16px',
                                                                border: '1px solid',
                                                                borderColor: isRejected ? '#fee2e2' : '#f1f5f9',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                            }}
                                                        >
                                                            <div style={{ flex: 1 }}>
                                                                {task.position && (
                                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b82f6', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                        จุดที่พบ: {task.position}
                                                                    </div>
                                                                )}
                                                                <div style={{ marginBottom: '8px', fontSize: '1rem', fontWeight: 700, color: isRejected ? '#94a3b8' : '#334155', textDecoration: isRejected ? 'line-through' : 'none' }}>
                                                                    {task.name}
                                                                    {task.amount !== undefined && (
                                                                        <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                                                            ({task.amount} {task.unit})
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                                                        <div style={{ width: `${task.dailyProgress || 0}%`, height: '100%', background: task.dailyProgress === 100 ? '#10b981' : '#3b82f6', transition: 'width 0.5s' }}></div>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: task.dailyProgress === 100 ? '#10b981' : '#64748b' }}>
                                                                        {task.dailyProgress || 0}%
                                                                    </div>
                                                                </div>

                                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
                                                                    <div style={{
                                                                        color: getStatusColor(task.status),
                                                                        display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800,
                                                                        background: `${getStatusColor(task.status)}08`,
                                                                        padding: '4px 12px', borderRadius: '10px',
                                                                        border: `1px solid ${getStatusColor(task.status)}15`
                                                                    }}>
                                                                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: getStatusColor(task.status) }}></div>
                                                                        {getStatusLabel(task.status)}
                                                                    </div>
                                                                    {assignee && (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontWeight: 500, border: '1px solid #e2e8f0' }}>
                                                                            <div style={{
                                                                                width: '24px', height: '24px', borderRadius: '50%',
                                                                                background: '#e2e8f0', overflow: 'hidden', border: '1px solid #cbd5e1',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                            }}>
                                                                                {(() => {
                                                                                    const staff = staffList.find(s => s.id === (task.responsibleStaffIds?.[0]));
                                                                                    if (staff?.profileImage) {
                                                                                        return <img loading="lazy" src={staff.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                                                                    }
                                                                                    return assignee.type === 'Staff' ? <User size={13} /> : <HardHat size={13} />;
                                                                                })()}
                                                                            </div>
                                                                            <span style={{ fontWeight: 700 }}>{assignee.name}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                                {task.dailyProgress === 100 && onVerifyTask && (
                                                                    <div
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onVerifyTask(task);
                                                                        }}
                                                                        style={{
                                                                            color: '#ffffff', padding: '8px 18px', background: '#10b981', borderRadius: '12px',
                                                                            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 800,
                                                                            border: '1px solid #059669', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                                                                        }}
                                                                    >
                                                                        <span>ยืนยันปิดงาน</span>
                                                                        <ChevronRight size={14} />
                                                                    </div>
                                                                )}

                                                                {task.dailyProgress !== 100 && (
                                                                    <div
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (onTaskClick) onTaskClick(task, cat.id, wo.id, cat.name);
                                                                        }}
                                                                        style={{
                                                                            color: '#f59e0b', padding: '8px 18px', background: '#fffbeb', borderRadius: '12px',
                                                                            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 800,
                                                                            border: '1px solid #fef3c7', cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <span>ตรวจสอบ</span>
                                                                        <ChevronRight size={16} />
                                                                    </div>
                                                                )}

                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const imageUrl = (task.attachments && task.attachments.length > 0 && task.attachments[0].url) ||
                                                                            task.afterPhotoUrl ||
                                                                            task.latestPhotoUrl ||
                                                                            (task.images && task.images.length > 0 && task.images[0]) ||
                                                                            task.beforePhotoUrl;
                                                                        if (imageUrl) setOverlayImage(imageUrl);
                                                                    }}
                                                                    style={{ display: 'flex', gap: '4px', cursor: 'zoom-in' }}
                                                                >
                                                                    {(() => {
                                                                        const imageUrl = (task.attachments && task.attachments.length > 0 && task.attachments[0].url) ||
                                                                            task.afterPhotoUrl ||
                                                                            task.latestPhotoUrl ||
                                                                            (task.images && task.images.length > 0 && task.images[0]) ||
                                                                            task.beforePhotoUrl;

                                                                        if (imageUrl) {
                                                                            return (
                                                                                <div style={{ width: '100px', height: '75px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                                                    <img loading="lazy" src={imageUrl} alt="Task Image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                </div>
                                                                            );
                                                                        } else {
                                                                            return (
                                                                                <div style={{ width: '100px', height: '75px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>ไม่มีรูปภาพ</div>
                                                                            );
                                                                        }
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )
                                    }
                                </div>
                            );
                        })}
                    </div>
                </>
            )
            }

            <ImageOverlay
                src={overlayImage || ''}
                isOpen={!!overlayImage}
                onClose={() => setOverlayImage(null)}
            />
        </div >
    );
};

export default WorkOrderCard;
