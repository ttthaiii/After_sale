import { useState } from 'react';
import { Image as ImageIcon, CheckCircle2, Activity, Lock } from 'lucide-react';
import { MasterTask, DailyReport } from '../types';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import LoadingOverlay from './LoadingOverlay';

interface TaskUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: MasterTask | null;
    categoryId: string;
    workOrderId: string;
    categoryName?: string;
}

// Mock Progress Logs (In real app, fetch from API)
const MOCK_LOGS = [
    { id: 1, date: '10 ม.ค. 10:30', action: 'เข้าหน้างาน', note: 'ช่างเข้าตรวจสอบพื้นที่', progress: 0 },
    { id: 2, date: '10 ม.ค. 11:45', action: 'รื้อถอน', note: 'รื้อถอนอุปกรณ์ชุดเดิมออกแล้ว', progress: 30 },
    { id: 3, date: '11 ม.ค. 09:15', action: 'ติดตั้ง', note: 'กำลังเดินสายไฟใหม่', progress: 60 },
];

const TaskUpdateModal = ({ isOpen, onClose, task, categoryId, workOrderId, categoryName }: TaskUpdateModalProps) => {
    if (!isOpen || !task) return null;

    const { addTaskUpdate, updateTask } = useWorkOrders();
    const { user } = useAuth();
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

    // Date limits: Today and 3 days back
    const today = new Date();
    const maxDate = today.toISOString().split('T')[0];
    const minDate = new Date(today.setDate(today.getDate() - 3)).toISOString().split('T')[0];

    const handleConfirmCompletion = async () => {
        setIsSubmitting(true);
        try {
            // 1. Send Daily Report (Progress 100%)
            const report: DailyReport = {
                id: `REP-${Date.now()}`,
                date: new Date(reportDate).toISOString(),
                workType: 'regular',
                timeRange: { start: '08:00', end: '17:00' },
                workers: [{ workerId: user?.id || 'unknown', name: user?.name || 'Foreman', role: user?.role || 'Foreman' }],
                progress: 100,
                notes: note,
                createdAt: new Date().toISOString(),
                createdBy: user?.id || 'unknown'
            };

            await addTaskUpdate(workOrderId, categoryId, task.id, report);
            
            // 2. Mark task as Verified/Completed
            await updateTask(workOrderId, categoryId, task.id, { status: 'Verified' });
            
            onClose();
        } catch (error) {
            console.error("Failed to update task:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        let color = '#777';
        let label = status;

        if (status === 'Pending') { color = '#FFC107'; label = 'รอเริ่มงาน'; }
        if (status === 'Assigned') { color = '#2196F3'; label = 'มอบหมายแล้ว'; }
        if (status === 'In Progress') { color = '#FF9800'; label = 'กำลังทำ'; }
        if (status === 'Completed') { color = '#4CAF50'; label = 'เสร็จแล้ว'; }
        if (status === 'Verified') { color = '#8BC34A'; label = 'ตรวจสอบแล้ว'; }

        return (
            <span style={{
                background: color + '20',
                color: color,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}></span>
                {label}
            </span>
        );
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '1rem', backdropFilter: 'blur(3px)' }}>
            <LoadingOverlay isVisible={isSubmitting} />
            <div style={{ background: '#1e1e1e', width: '100%', maxWidth: '600px', borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid #333', maxHeight: '90vh' }}>

                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                        <div style={{ fontSize: '0.85rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                            {categoryName}
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', lineHeight: '1.4' }}>{task.name}</h2>
                        <div style={{ marginTop: '10px' }}>
                            <StatusBadge status={task.status} />
                            <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#aaa' }}>ความคืบหน้าจากทีมช่าง: {task.dailyProgress}%</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Report Date</div>
                            <input 
                                type="date"
                                value={reportDate}
                                min={minDate}
                                max={maxDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                style={{
                                    background: '#333',
                                    border: '1px solid #555',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    color: '#fff',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            />
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: '#333',
                                border: '1px solid #555',
                                color: '#ffffff',
                                cursor: 'pointer',
                                padding: '0',
                                borderRadius: '50%',
                                display: 'flex',
                                width: '40px',
                                height: '40px',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.color = '#000000';
                                e.currentTarget.style.borderColor = '#ffffff';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = '#333';
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.borderColor = '#555';
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Progress Logs (From API) */}
                    <div style={{ background: '#252525', borderRadius: '12px', padding: '1.25rem' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={16} /> ประวัติการปฏิบัติงาน (Labor Report Log)
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {MOCK_LOGS.map((log) => (
                                <div key={log.id} style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                                    <div style={{ minWidth: '100px', color: '#777', fontSize: '0.8rem', textAlign: 'right' }}>
                                        {log.date}
                                    </div>
                                    <div style={{ position: 'relative', paddingLeft: '1rem', borderLeft: '2px solid #333', flex: 1 }}>
                                        <div style={{ position: 'absolute', left: '-5px', top: '0', width: '8px', height: '8px', borderRadius: '50%', background: '#646cff' }}></div>
                                        <div style={{ fontWeight: 'bold', color: '#ddd' }}>{log.action} ({log.progress}%)</div>
                                        <div style={{ color: '#aaa', marginTop: '4px' }}>{log.note}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Final Completion Section */}
                    <div style={{ borderTop: '1px solid #333', paddingTop: '1rem' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: '#4CAF50', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={20} /> ปิดงาน / ตรวจสอบความเรียบร้อย (Final Completion)
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            {/* Before Photo (Locked) */}
                            <div style={{ border: '1px solid #333', borderRadius: '12px', padding: '1rem', textAlign: 'center', background: '#252525', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#00000080', padding: '4px', borderRadius: '50%' }}>
                                    <Lock size={12} color="#aaa" />
                                </div>
                                <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#aaa' }}>รูปก่อนซ่อม (Before - Locked)</div>
                                {task.beforePhotoUrl ? (
                                    <img src={task.beforePhotoUrl} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', opacity: 0.8 }} />
                                ) : (
                                    <div style={{ height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#555' }}>
                                        <ImageIcon size={24} />
                                        <span style={{ fontSize: '0.8rem', marginTop: '5px' }}>ไม่มีรูปภาพ</span>
                                    </div>
                                )}
                            </div>

                            {/* After Photo Upload */}
                            <div style={{ border: '2px dashed #4CAF50', borderRadius: '12px', padding: '1rem', textAlign: 'center', background: '#4CAF5010', cursor: 'pointer' }}>
                                <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#4CAF50' }}>รูปหลังซ่อม (Evidence)</div>
                                <div style={{ height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#4CAF50' }}>
                                    <ImageIcon size={24} />
                                    <span style={{ fontSize: '0.8rem', marginTop: '5px' }}>กดเพื่ออัปโหลด</span>
                                </div>
                            </div>
                        </div>

                        {/* Closing Note */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#aaa' }}>หมายเหตุปิดงาน (Closing Note)</label>
                            <textarea
                                rows={3}
                                placeholder="ระบุรายละเอียดการซ่อม..."
                                style={{ width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: 'white', resize: 'none' }}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div style={{ padding: '1.5rem', borderTop: '1px solid #333' }}>
                    <button
                        onClick={handleConfirmCompletion}
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '10px',
                            background: isSubmitting ? '#555' : '#4CAF50',
                            border: 'none',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {isSubmitting ? 'กำลังบันทึก...' : <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            ยืนยันปิดงาน (Confirm Completion)
                        </>}
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: '#777' }}>
                        เมื่อกดยืนยันแล้ว จะไม่สามารถแก้ไขข้อมูลได้อีก
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TaskUpdateModal;
