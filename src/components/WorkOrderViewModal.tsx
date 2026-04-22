import { X, Wrench } from 'lucide-react';
import { WorkOrder, Project } from '../types';

interface WorkOrderViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    wo: WorkOrder | null;
    projects: Project[];
}

const WorkOrderViewModal = ({ isOpen, onClose, wo, projects }: WorkOrderViewModalProps) => {
    if (!isOpen || !wo) return null;

    const project = projects.find(p => p.id === wo.projectId);
    const reportDate = wo.reportDate ? new Date(wo.reportDate).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }) : '-';

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
                <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
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
                    <button
                        onClick={onClose}
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#000000',
                            cursor: 'pointer',
                            padding: '0',
                            borderRadius: '50%',
                            display: 'flex',
                            transition: 'all 0.2s',
                            width: '40px',
                            height: '40px',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* Content Section (Scrollable) */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', background: '#ffffff' }}>
                    
                    {/* General Info (Section 1 from Image 2) */}
                    <section>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '4px', height: '18px', background: '#4f46e5', borderRadius: '4px' }} />
                            ข้อมูลทั่วไป (General Information)
                        </h3>

                        <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
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
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
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

                    {/* Defect List (Section 2 from Image 2) */}
                    <section style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '4px', height: '18px', background: '#f59e0b', borderRadius: '4px' }} />
                            รายการแจ้งซ่อม (Defect List)
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {wo.categories.map((cat, cIdx) => (
                                <div key={cIdx} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    {/* Category Header */}
                                    <div style={{ padding: '12px 20px', background: '#f9fafb', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Wrench size={16} color="#4f46e5" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>{cat.name}</span>
                                    </div>
                                    
                                    {/* Tasks Table/List */}
                                    <div style={{ padding: '16px 20px' }}>
                                        {cat.tasks.map((task, tIdx) => (
                                            <div key={tIdx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9', marginBottom: tIdx === cat.tasks.length - 1 ? 0 : '12px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '16px', marginBottom: '12px' }}>
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
                                                
                                                {/* Images (Exactly like Image 2 thumbnail area) */}
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
                </div>

                {/* Footer Section (Consistent with Dashboard modals) */}
                <div style={{ padding: '1.5rem 2.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
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
