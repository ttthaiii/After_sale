import { useState } from 'react';
import { WorkOrder } from '../types';
import { Camera, CheckCircle2 } from 'lucide-react';

interface CloseJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (woId: string, notes?: string) => void;
    workOrder: WorkOrder;
    targetTaskId?: string;
}

const CloseJobModal = ({ isOpen, onClose, onConfirm, workOrder, targetTaskId }: CloseJobModalProps) => {
    const [photos, setPhotos] = useState<Record<string, File | null>>({});
    const [note, setNote] = useState('');

    if (!isOpen) return null;

    const allTasks = workOrder.categories.flatMap(c => c.tasks);
    const tasksToVerify = targetTaskId
        ? allTasks.filter(t => t.id === targetTaskId)
        : allTasks;

    const isAllPhotosUploaded = tasksToVerify.every(t => photos[t.id]);

    const handleFileChange = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPhotos(prev => ({ ...prev, [taskId]: e.target.files![0] }));
        }
    };

    const handleConfirm = () => {
        onConfirm(workOrder.id, note);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
        }}>
            <div style={{
                background: '#ffffff',
                width: '100%', maxWidth: tasksToVerify.length === 1 ? '700px' : '1000px',
                borderRadius: '32px',
                boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.4)',
                overflow: 'hidden',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2.5rem',
                    background: '#ffffff',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <CheckCircle2 size={32} style={{ color: '#10b981' }} />
                            {tasksToVerify.length === 1 ? 'ยืนยันการปิดรายการงาน' : 'ยืนยันการปิดใบงานค้าง'}
                        </h2>
                        <div style={{ color: '#64748b', fontSize: '1rem', marginTop: '6px', fontWeight: 600 }}>
                            {workOrder.id} • {workOrder.locationName}
                            {tasksToVerify.length === 1 && ` • ${tasksToVerify[0].name}`}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            padding: '0',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            color: '#000000',
                            transition: 'all 0.2s',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
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

                <div style={{ padding: '2rem 2.5rem', overflowY: 'auto', flex: 1, background: '#fcfcfd' }}>
                    {/* Comparison Banner */}
                    <div style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', padding: '1.5rem', borderRadius: '24px', border: '1px solid #bae6fd', marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '18px' }}>
                        <div style={{ width: '48px', height: '48px', background: '#0284c7', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.2)' }}>
                            <Camera size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.05rem', color: '#0c4a6e', fontWeight: 900 }}>หลักฐานการดำเนินงาน (Verification)</div>
                            <div style={{ fontSize: '0.9rem', color: '#0ea5e9', fontWeight: 700 }}>ถ่ายภาพ After ให้ตรงกับมุมภาพ Before ของรายการงานนี้</div>
                        </div>
                    </div>

                    {/* Verification Row(s) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {tasksToVerify.map((task, index) => (
                            <div key={task.id} style={{
                                background: '#ffffff',
                                borderRadius: '28px',
                                border: '1px solid #e2e8f0',
                                overflow: 'hidden',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.03)'
                            }}>
                                {tasksToVerify.length > 1 && (
                                    <div style={{ padding: '14px 24px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontWeight: 800, color: '#1e293b' }}>
                                        #{index + 1} {task.name}
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', padding: '2rem' }}>
                                    {/* Before Photo */}
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>
                                            รูปก่อนดำเนินงาน (BEFORE)
                                        </div>
                                        <div style={{
                                            width: '100%', height: '240px',
                                            borderRadius: '20px', background: '#f1f5f9',
                                            overflow: 'hidden', border: '1px solid #e2e8f0',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {task.beforePhotoUrl ? (
                                                <img src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Before" />
                                            ) : (
                                                <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                                                    <Camera size={40} />
                                                    <div style={{ fontSize: '0.8rem', marginTop: '8px' }}>ไม่มีรูปภาพแจ้งซ่อม</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* After Photo Upload */}
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>
                                            รูปหลังดำเนินงาน (AFTER)
                                        </div>
                                        <label style={{
                                            width: '100%', height: '240px',
                                            borderRadius: '20px',
                                            background: photos[task.id] ? '#ffffff' : '#f0fdf4',
                                            border: `2px dashed ${photos[task.id] ? '#10b981' : '#34d399'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', overflow: 'hidden', position: 'relative',
                                            transition: 'all 0.2s'
                                        }}>
                                            <input type="file" style={{ display: 'none' }} onChange={(e) => handleFileChange(task.id, e)} accept="image/*" />
                                            {photos[task.id] ? (
                                                <img src={URL.createObjectURL(photos[task.id]!)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="After Preview" />
                                            ) : (
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ width: '56px', height: '56px', background: '#10b981', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
                                                        <Camera size={28} />
                                                    </div>
                                                    <div style={{ fontWeight: 900, color: '#064e3b', fontSize: '1rem' }}>ถ่ายภาพหลังซ่อม</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '4px' }}>Click to upload</div>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Notes */}
                    <div style={{ marginTop: '2.5rem' }}>
                        <div style={{ fontWeight: 900, marginBottom: '12px', color: '#0f172a', fontSize: '1.05rem' }}>สรุปผลการดำเนินงาน (Note)</div>
                        <textarea
                            rows={3}
                            placeholder="ระบุรายละเอียดการแก้ไขเพิ่มเติม..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            style={{
                                width: '100%', padding: '1.25rem',
                                borderRadius: '20px', border: '1px solid #e2e8f0',
                                fontSize: '1rem', outline: 'none', resize: 'none',
                                background: '#ffffff', fontWeight: 500, transition: 'all 0.2s',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)'
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1.75rem 2.5rem',
                    background: '#ffffff',
                    display: 'flex', gap: '1.5rem',
                    borderTop: '1px solid #f1f5f9',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '16px', borderRadius: '16px',
                            border: '1px solid #e2e8f0', background: '#f8fafc',
                            color: '#64748b', fontWeight: 800, cursor: 'pointer'
                        }}
                    >
                        ย้อนกลับ
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isAllPhotosUploaded}
                        style={{
                            flex: 2, padding: '16px', borderRadius: '16px',
                            border: 'none',
                            background: isAllPhotosUploaded ? 'linear-gradient(135deg, #10b981, #059669)' : '#e2e8f0',
                            color: isAllPhotosUploaded ? 'white' : '#94a3b8',
                            fontWeight: 900, fontSize: '1.05rem',
                            cursor: isAllPhotosUploaded ? 'pointer' : 'not-allowed',
                            boxShadow: isAllPhotosUploaded ? '0 10px 15px -3px rgba(16, 185, 129, 0.3)' : 'none',
                            transition: 'all 0.3s'
                        }}
                    >
                        ยืนยันและปิดงาน
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseJobModal;
