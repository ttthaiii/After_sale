import { useState } from 'react';
import { X, User, Save, CheckCircle2, Search } from 'lucide-react';
import { MasterTask, Staff } from '../types';

interface AdminAssignHelperModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: MasterTask | null;
    workOrderId: string;
    staffList: Staff[];
    onAssign: (foremanIds: string[]) => Promise<void>;
}

const AdminAssignHelperModal = ({ isOpen, onClose, task, workOrderId, staffList, onAssign }: AdminAssignHelperModalProps) => {
    const [selectedForemanIds, setSelectedForemanIds] = useState<string[]>(() => {
        if (task?.helperForemanIds && task.helperForemanIds.length > 0) {
            return task.helperForemanIds;
        }
        return task?.assignedForeman ? [task.assignedForeman] : [];
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !task) return null;

    // Filter to only Foremen and search match
    const foremen = staffList
        .filter(s => s.role === 'Foreman')
        .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                     (s.affiliation || '').toLowerCase().includes(searchTerm.toLowerCase()));

    const handleToggleForeman = (id: string) => {
        setSelectedForemanIds(prev => 
            prev.includes(id) 
                ? prev.filter(item => item !== id) 
                : [...prev, id]
        );
    };

    const handleSubmit = async () => {
        if (selectedForemanIds.length === 0) {
            alert('กรุณาเลือกโฟร์แมนผู้ช่วยอย่างน้อย 1 ท่าน');
            return;
        }

        setIsSubmitting(true);
        try {
            await onAssign(selectedForemanIds);
            onClose();
        } catch (error) {
            console.error('Helper assignment failed:', error);
            alert('เกิดข้อผิดพลาดในการมอบหมายงานช่วย');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#ffffff', width: '90%', maxWidth: '460px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>

                {/* Header */}
                <div style={{ padding: '24px', background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>จัดสรรโฟร์แมนผู้ช่วย (Assign Helper)</h2>
                        <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                            {task.name || (task as any).taskName}
                            {task.subtaskName && task.subtaskName !== (task.name || (task as any).taskName) && ` (${task.subtaskName})`}
                            {` (ใบงาน ${workOrderId})`}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px', borderRadius: '12px', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Search Input */}
                    <div style={{ position: 'relative' }}>
                        <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อโฟร์แมน หรือโครงการ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 10px 10px 38px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                outline: 'none',
                                fontSize: '0.88rem',
                                color: '#1e293b',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Foreman List */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px' }}>
                            <User size={18} color="#3b82f6" /> เลือกโฟร์แมนหลังขาย (After Sale Foreman)
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', padding: '4px' }}>
                            {foremen.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                    ไม่พบรายชื่อโฟร์แมน
                                </div>
                            ) : (
                                foremen.map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => handleToggleForeman(s.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px',
                                            border: '1px solid',
                                            borderColor: selectedForemanIds.includes(s.id) ? '#3b82f6' : '#f1f5f9',
                                            background: selectedForemanIds.includes(s.id) ? '#eff6ff' : '#f8fafc',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#cbd5e1', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                            {s.profileImage ? <img src={s.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={16} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{s.affiliation || 'ส่วนกลาง'}</div>
                                        </div>
                                        {selectedForemanIds.includes(s.id) ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '6px', background: '#3b82f6', color: 'white' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </div>
                                        ) : (
                                            <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: '2px solid #cbd5e1' }} />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        style={{
                            flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
                            background: isSubmitting ? '#94a3b8' : '#3b82f6',
                            color: 'white', fontWeight: 800, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            boxShadow: '0 8px 16px -3px rgba(59, 130, 246, 0.3)'
                        }}
                    >
                        <Save size={18} /> {isSubmitting ? 'กำลังบันทึก...' : 'มอบหมายงานช่วย'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminAssignHelperModal;
