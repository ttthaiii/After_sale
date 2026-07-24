import { Wrench, FileText, ExternalLink, Clock } from 'lucide-react';
import { WorkOrder, Project } from '../types';
import { formatDate } from '../utils/date';
import { useIsMobile } from '../hooks/useIsMobile';
import { ModalCloseButton } from './ui/ModalCloseButton';

interface WorkOrderViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    wo: WorkOrder | null;
    projects: Project[];
}

const WorkOrderViewModal = ({ isOpen, onClose, wo, projects }: WorkOrderViewModalProps) => {
    const isMobile = useIsMobile();
    if (!isOpen || !wo) return null;

    const project = projects.find(p => p.id === wo.projectId);
    const reportDate = formatDate(wo.reportDate);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(8px)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: 2000,
                padding: '20px'
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#ffffff',
                    width: '100%',
                    maxWidth: '1000px',
                    maxHeight: '90vh',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden'
                }}
            >
                {/* Header Section (Exactly like Image 2) */}
                <div style={{ padding: isMobile ? '1rem' : '1.5rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            background: wo.type === 'AfterSale' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            padding: '10px',
                            borderRadius: '12px',
                            color: '#ffffff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                        }}>
                            <Wrench size={24} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                                {wo.type === 'AfterSale' ? 'รายละเอียดใบงานแจ้งซ่อม' : 'รายละเอียดใบงานตรวจรับ'}
                            </h2>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                {wo.type === 'AfterSale' ? 'After Sale Service' : 'Pre-handover Inspection'}
                            </p>
                        </div>
                    </div>
                    <ModalCloseButton onClick={onClose} buttonSize={40} style={{ borderRadius: '50%' }} />
                </div>

                {/* Content Section (Scrollable) */}
                <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '32px', display: 'flex', flexDirection: 'column', gap: isMobile ? '20px' : '32px', background: '#ffffff' }}>
                    
                    {/* General Info (Section 1 from Image 2) */}
                    <section>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '4px', height: '18px', background: '#4f46e5', borderRadius: '4px' }} />
                            ข้อมูลทั่วไป (General Information)
                        </h3>

                        <div style={{ background: '#f8fafc', padding: isMobile ? '16px' : '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '24px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>โครงการ (Project)</label>
                                <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }}>
                                    {project?.name || wo.projectId}
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>วันที่แจ้ง (Report Date)</label>
                                <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }}>
                                    {reportDate}
                                </div>
                            </div>
                            
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>สถานที่ (Location Details)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>อาคาร (Bldg)</div>
                                        <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }}>
                                            {wo.building || '-'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>ชั้น (Floor)</div>
                                        <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }}>
                                            {wo.floor || '-'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>ห้อง (Room)</div>
                                        <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }}>
                                            {wo.room || wo.locationName || '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>รายละเอียดเพิ่มเติม</label>
                                <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#0f172a', fontWeight: 700, minHeight: '40px' }}>
                                    {wo.initialProblem || '-'}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>ชื่อผู้แจ้ง (Reporter)</label>
                                <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }}>
                                    {wo.reporterName}
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>เบอร์โทร (Phone)</label>
                                <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }}>
                                    {wo.reporterPhone || '-'}
                                </div>
                            </div>
                        </div>
                    </section>

                    {wo.type === 'PreHandover' ? (<>
                        {/* PreHandover Section 2: SLA + Documents */}
                        <section>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '4px', height: '18px', background: '#10b981', borderRadius: '4px' }} />
                                ข้อมูลการตรวจรับ
                            </h3>
                            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '20px', alignItems: 'flex-start' }}>
                                {/* SLA */}
                                <div>
                                    <label style={{ display: 'flex', fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600, alignItems: 'center', gap: '6px' }}>
                                        <Clock size={13} /> กำหนดแล้วเสร็จ (SLA)
                                    </label>
                                    <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#0f172a', fontWeight: 700 }}>
                                        {(wo as any).phEstimatedSla || '-'}
                                    </div>
                                </div>
                                {/* Documents */}
                                <div>
                                    <label style={{ display: 'flex', fontSize: '0.75rem', color: '#64748b', marginBottom: '8px', fontWeight: 600, alignItems: 'center', gap: '6px' }}>
                                        <FileText size={13} /> เอกสารแนบ (Documents)
                                    </label>
                                    {((wo as any).documents?.length || 0) === 0 ? (
                                        <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            ไม่มีเอกสารแนบ
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {(wo as any).documents.map((doc: any, i: number) => (
                                                <a
                                                    key={i}
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '10px 14px', background: '#ffffff',
                                                        border: '1px solid #d1d5db', borderRadius: '8px',
                                                        color: '#1d4ed8', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem',
                                                        transition: 'border-color 0.15s'
                                                    }}
                                                    onMouseOver={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                                                    onMouseOut={e => (e.currentTarget.style.borderColor = '#d1d5db')}
                                                >
                                                    <FileText size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                                                    <ExternalLink size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* PreHandover Section 3: Work Categories Summary */}
                        <section style={{ marginBottom: '20px' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '4px', height: '18px', background: '#f59e0b', borderRadius: '4px' }} />
                                หมวดงานตรวจรับ (Work Categories)
                            </h3>
                            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                {/* Table header */}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 140px', padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>หมวดงาน</span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textAlign: 'center' }}>จำนวนจุดที่พบ</span>
                                </div>
                                {wo.categories.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>ไม่มีข้อมูลหมวดงาน</div>
                                ) : (
                                    wo.categories.map((cat, cIdx) => (
                                        <div key={cIdx} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 140px', padding: '12px 20px', borderBottom: cIdx === wo.categories.length - 1 ? 'none' : '1px solid #f1f5f9', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Wrench size={14} color="#6366f1" />
                                                <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>{cat.name}</span>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-block', padding: '4px 16px',
                                                    background: (cat as any).defectCount > 0 ? '#fef3c7' : '#f1f5f9',
                                                    color: (cat as any).defectCount > 0 ? '#92400e' : '#64748b',
                                                    borderRadius: '20px', fontWeight: 800, fontSize: '0.9rem',
                                                    border: `1px solid ${(cat as any).defectCount > 0 ? '#fcd34d' : '#e2e8f0'}`
                                                }}>
                                                    {(cat as any).defectCount ?? 0} จุด
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                                {/* Footer total */}
                                {wo.categories.length > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 140px', padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>รวมทั้งหมด ({wo.categories.length} หมวด)</span>
                                        <span style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                                            {wo.categories.reduce((sum, cat) => sum + ((cat as any).defectCount || 0), 0)} จุด
                                        </span>
                                    </div>
                                )}
                            </div>
                        </section>
                    </>) : (
                    /* AfterSale: existing defect list */
                    <section style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '4px', height: '18px', background: '#f59e0b', borderRadius: '4px' }} />
                            รายการแจ้งซ่อม (Defect List)
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {wo.categories.map((cat, cIdx) => (
                                <div key={cIdx} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 20px', background: '#f9fafb', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Wrench size={16} color="#4f46e5" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>{cat.name}</span>
                                    </div>
                                    <div style={{ padding: '16px 20px' }}>
                                        {cat.tasks.map((task, tIdx) => (
                                            <div key={tIdx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9', marginBottom: tIdx === cat.tasks.length - 1 ? 0 : '12px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 2fr 1fr', gap: '16px', marginBottom: '12px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>จุดที่พบ (Position)</div>
                                                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{task.position || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>รายละเอียด (Detail)</div>
                                                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{task.name}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>จำนวน</div>
                                                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{task.amount} {task.unit || 'จุด'}</div>
                                                    </div>
                                                </div>
                                                {((task.images?.length || 0) > 0 || task.beforePhotoUrl) && (
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '8px' }}>รูปภาพประกอบ (Evidence)</div>
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            {task.images?.map((img, i) => (
                                                                <img key={i} src={img} style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} alt="Defect" />
                                                            ))}
                                                            {!task.images?.length && task.beforePhotoUrl && (
                                                                <img src={task.beforePhotoUrl} style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} alt="Defect" />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                    )}
                </div>

                {/* Footer Section (Consistent with Dashboard modals) */}
                <div style={{ padding: isMobile ? '1rem' : '1.5rem 2.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer'
                        }}
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkOrderViewModal;
