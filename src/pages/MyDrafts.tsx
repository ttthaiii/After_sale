import { useState } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import { FileText, Edit, Trash2, Clock, Building2 } from 'lucide-react';
import ForemanReportModal from '../components/ForemanReportModal';
import { WorkOrder } from '../types';

const MyDrafts = () => {
    const { user } = useAuth();
    const { workOrders, projects } = useWorkOrders();
    const [selectedDraft, setSelectedDraft] = useState<WorkOrder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Filter for current user's drafts and rejected work orders
    const drafts = workOrders.filter(wo => (wo.status === 'Draft' || wo.status === 'Rejected') && wo.reporterId === user?.id);

    const handleEdit = (draft: WorkOrder) => {
        setSelectedDraft(draft);
        setIsEditModalOpen(true);
    };

    // Helper to get first image from a draft
    const getFirstImage = (draft: WorkOrder) => {
        for (const cat of draft.categories) {
            for (const task of cat.tasks) {
                if (task.images && task.images.length > 0) return task.images[0];
                if (task.beforePhotoUrl) return task.beforePhotoUrl;
            }
        }
        return null;
    };

    return (
        <div style={{ padding: '0 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '18px', color: '#64748b', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                    <FileText size={28} />
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em' }}>แบบร่างของฉัน (My Drafts)</h1>
                    <span style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '4px', display: 'block', fontWeight: 500 }}>จัดการใบงานที่บันทึกไว้ และรอการส่งข้อมูล</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {drafts.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', background: '#fff', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                        <div style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 600 }}>ไม่มีรายการแบบร่าง</div>
                        <p style={{ color: '#cbd5e1', marginTop: '8px' }}>รายการที่คุณเลือก "บันทึกแบบร่าง" จะปรากฏที่นี่</p>
                    </div>
                ) : (
                    drafts.map(draft => {
                        const firstImage = getFirstImage(draft);
                        const projectName = projects.find(p => p.id === draft.projectId)?.name || draft.projectId;

                        return (
                            <div key={draft.id} style={{ background: '#fff', borderRadius: '24px', border: '1px solid #eef2f6', padding: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700 }}>
                                            <Clock size={14} />
                                            แก้ไขเมื่อ: {new Date(draft.createdAt).toLocaleDateString('th-TH')}
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 850, color: '#0f172a', lineHeight: 1.2 }}>{draft.locationName}</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6366f1', fontSize: '0.9rem', fontWeight: 700, marginTop: '2px' }}>
                                            <Building2 size={16} />
                                            {projectName}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                                        {draft.status === 'Rejected' ? (
                                            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '6px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.05em', border: '1px solid #fee2e2' }}>REJECTED</div>
                                        ) : (
                                            <div style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.05em' }}>DRAFT</div>
                                        )}
                                        {firstImage ? (
                                            <img
                                                src={firstImage}
                                                alt="Draft preview"
                                                style={{ width: '100px', height: '60px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #f8fafc', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                            />
                                        ) : (
                                            <div style={{ width: '100px', height: '60px', borderRadius: '12px', background: '#f8fafc', border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FileText size={20} color="#cbd5e1" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                    <button
                                        onClick={() => handleEdit(draft)}
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)', transition: 'transform 0.2s' }}
                                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <Edit size={16} /> แก้ไข/ส่งงาน
                                    </button>
                                    <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', background: '#fff', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '14px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}>
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {selectedDraft && (
                <ForemanReportModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    editWorkOrder={selectedDraft}
                />
            )}
        </div>
    );
};

export default MyDrafts;
