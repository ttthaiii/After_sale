import { useState, useEffect } from 'react';
import { MasterTask, WorkOrder, Staff, LaborRecord, TaskUpdate } from '../types';
import { X, Camera, Plus, Trash2, Users, HardHat, Info, CheckCircle2, AlertCircle, User, Loader2 } from 'lucide-react';
import { MOCK_STAFF, MOCK_CONTRACTORS, MOCK_PROJECTS } from '../data/mockData';
import LoadingOverlay from './LoadingOverlay';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageCompression';

interface DailyReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (taskId: string, woId: string, update: TaskUpdate) => void;
    task: MasterTask;
    wo: WorkOrder;
}

const DailyReportModal = ({ isOpen, onClose, onSubmit, task, wo }: DailyReportModalProps) => {
    const [progress, setProgress] = useState(task.dailyProgress || 0);
    const [note, setNote] = useState('');
    const [labor, setLabor] = useState<LaborRecord[]>([]);
    const [photos, setPhotos] = useState<string[]>([]);
    const [type, setType] = useState<'Normal' | 'Problem'>('Normal');
    const [showStaffSelector, setShowStaffSelector] = useState(false);
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [laborPhotos, setLaborPhotos] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Date limits: Today and 3 days back
    const today = new Date();
    const maxDate = today.toISOString().split('T')[0];
    const minDate = new Date(today.setDate(today.getDate() - 3)).toISOString().split('T')[0];

    // Get project affiliation for smart filtering
    const project = MOCK_PROJECTS.find(p => p.id === wo.projectId);
    const projectAffiliation = project?.affiliation;

    // Filter staff by project affiliation
    const availableStaff = MOCK_STAFF.filter(s => s.affiliation === projectAffiliation || !projectAffiliation);
    const assignedContractor = MOCK_CONTRACTORS.find(c => c.id === task.contractorId);

    useEffect(() => {
        if (isOpen) {
            const currentP = task.dailyProgress || 0;
            setProgress(currentP < minProgress ? minProgress : currentP);
            setNote('');
            setLabor([]);
            setPhotos([]);
            setLaborPhotos([]);
            setType('Normal');
        }
    }, [isOpen, task, minProgress]);

    if (!isOpen) return null;

    const handleAddStaff = (staff: Staff) => {
        const exists = labor.find(l => l.staffId === staff.id);
        if (exists) return;

        const newLabor: LaborRecord = {
            id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            membership: 'Internal',
            staffId: staff.id,
            staffName: staff.name,
            affiliation: staff.affiliation || 'General',
            amount: 1,
            timeType: 'Normal',
            shifts: {
                normal: true,
                otMorning: false,
                otNoon: false,
                otEvening: false
            }
        };
        setLabor([...labor, newLabor]);
        setShowStaffSelector(false);
    };

    const handleAddOutsource = () => {
        if (!assignedContractor) return;
        const newLabor: LaborRecord = {
            id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            membership: 'Outsource',
            affiliation: assignedContractor.name,
            amount: 1,
            timeType: 'Normal',
            shifts: {
                normal: true,
                otMorning: false,
                otNoon: false,
                otEvening: false
            }
        };
        setLabor([...labor, newLabor]);
    };

    const handleRemoveLabor = (id: string) => {
        setLabor(labor.filter(l => l.id !== id));
    };

    const handleUpdateLaborAmount = (id: string, amount: number) => {
        setLabor(labor.map(l => l.id === id ? { ...l, amount: Math.max(1, amount) } : l));
    };

    const toggleShift = (id: string, shift: keyof NonNullable<LaborRecord['shifts']>) => {
        setLabor(labor.map(l => {
            if (l.id !== id) return l;
            const newShifts = { ...l.shifts, [shift]: !l.shifts?.[shift] };
            // Update timeType based on whether any OT is selected
            const hasOT = newShifts.otMorning || newShifts.otNoon || newShifts.otEvening;
            return { 
                ...l, 
                shifts: newShifts,
                timeType: hasOT && !newShifts.normal ? 'OT' : 'Normal' // Keep Normal if normal is checked
            } as LaborRecord;
        }));
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `daily_${wo.id}_${task.id}_${Date.now()}.${fileExt}`;
            const storagePath = `work_orders/${wo.id}/tasks/${task.id}/daily_reports/${fileName}`;
            const storageRef = ref(storage, storagePath);

            const compressedFile = await compressImage(file, 1024, 0.7);
            const metadata = { contentType: compressedFile.type || 'image/jpeg' };

            const snapshot = await uploadBytes(storageRef, compressedFile, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setPhotos([...photos, downloadURL]);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('อัปโหลดรูปภาพไม่สำเร็จ');
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleLaborPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `labor_${wo.id}_${task.id}_${Date.now()}.${fileExt}`;
            const storagePath = `work_orders/${wo.id}/tasks/${task.id}/labor_proof/${fileName}`;
            const storageRef = ref(storage, storagePath);

            const compressedFile = await compressImage(file, 1024, 0.7);
            const metadata = { contentType: compressedFile.type || 'image/jpeg' };

            const snapshot = await uploadBytes(storageRef, compressedFile, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setLaborPhotos([...laborPhotos, downloadURL]);
        } catch (error) {
            console.error('Labor upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    // Calculate min and max allowed progress based on selected reportDate and history
    const { minProgress, maxProgress } = useMemo(() => {
        if (!task.history || task.history.length === 0) return { minProgress: 0, maxProgress: 100 };
        
        // Find history entries strictly BEFORE and strictly AFTER the selected reportDate
        const historyBefore = task.history.filter(h => h.date < reportDate).sort((a, b) => b.date.localeCompare(a.date));
        const historyAfter = task.history.filter(h => h.date > reportDate).sort((a, b) => a.date.localeCompare(b.date));

        const min = historyBefore.length > 0 ? historyBefore[0].progress : 0;
        const max = historyAfter.length > 0 ? historyAfter[0].progress : 100;

        return { minProgress: min, maxProgress: max };
    }, [task.history, reportDate]);

    // Ensure progress is within bounds
    useEffect(() => {
        if (progress < minProgress) setProgress(minProgress);
        if (progress > maxProgress) setProgress(maxProgress);
    }, [minProgress, maxProgress]);

    const handleSubmit = async () => {
        if (photos.length === 0) {
            alert('กรุณาอัปโหลดรูปภาพงานอย่างน้อย 1 รูป');
            return;
        }

        if (progress < minProgress || progress > maxProgress) {
            alert(`ความคืบหน้าต้องอยู่ระหว่าง ${minProgress}% ถึง ${maxProgress}%`);
            return;
        }

        setIsSubmitting(true);
        try {
            const update: TaskUpdate = {
                id: `REP-${Date.now()}`,
                date: reportDate, // ✅ Use user-selected date
                workType: 'regular',
                timeRange: { start: '08:00', end: '17:00' },
                workers: labor.map(l => ({
                    workerId: l.staffId || l.id,
                    name: l.staffName || l.affiliation,
                    role: l.membership
                })),
                progress: progress,
                notes: note,
                photos: photos,
                laborPhotos: laborPhotos, // ✅ Include labor proof photos
                type: type,
                createdAt: new Date().toISOString(),
                createdBy: 'user-id' 
            };

            await onSubmit(task.id, wo.id, update);
            onClose();
        } catch (error) {
            console.error('Submit failed:', error);
            alert('ส่งรายงานไม่สำเร็จ กรุณาลองใหม่');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '20px'
        }}>
            <LoadingOverlay isVisible={isSubmitting} />
            <div style={{
                background: '#fff', width: '100%', maxWidth: '900px', maxHeight: '90vh',
                borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255,255,255,0.1)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 32px', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#ffffff', color: '#1e293b'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ padding: '12px', borderRadius: '14px', background: '#eff6ff', color: '#2563eb' }}>
                            <HardHat size={28} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8' }}>{wo.id}</span>
                                <span style={{ color: '#e2e8f0' }}>•</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8' }}>{wo.locationName}</span>
                            </div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: '#0f172a' }}>{task.name}</h2>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {/* A: Info Box (SLA + Time) */}
                        <div style={{ 
                            background: '#f8fafc', padding: '12px 20px', borderRadius: '16px', border: '1px solid #f1f5f9',
                            display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', minWidth: '160px'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>
                                เป้าหมาย (SLA) <span style={{ color: '#0f172a', marginLeft: '4px' }}>{task.duration || 24} ชม.</span>
                            </div>
                            <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b' }}>
                                เหลือเวลา <span style={{ fontSize: '1.1rem', fontWeight: 950, marginLeft: '4px' }}>0 วัน 20:43 ชม.</span>
                            </div>
                        </div>

                        {/* B: Interaction Box (Date) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>เลือกวันที่รายงาน</div>
                            <input 
                                type="date"
                                value={reportDate}
                                min={minDate}
                                max={maxDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                style={{
                                    background: '#fff',
                                    border: '2px solid #3b82f6',
                                    borderRadius: '10px',
                                    padding: '6px 12px',
                                    color: '#1d4ed8',
                                    fontSize: '0.9rem',
                                    fontWeight: 900,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)'
                                }}
                            />
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                background: '#f8fafc', color: '#64748b', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                            }}
                            onMouseOver={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#ef4444'; }}
                            onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
                    {/* Left Side: Labor & Progress */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {/* Labor Section */}
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Users size={20} color="#3b82f6" />
                                        การจัดการแรงงาน (Labor Tracking)
                                    </h3>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>ระบุจำนวนช่างที่เข้าหน้างานวันนี้</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setShowStaffSelector(!showStaffSelector)}
                                        style={{
                                            padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
                                            background: '#fff', color: '#0f172a', fontSize: '0.8rem', fontWeight: 800,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        <Plus size={14} /> ช่างในโครงการ
                                    </button>
                                    {assignedContractor && (
                                        <button
                                            onClick={handleAddOutsource}
                                            style={{
                                                padding: '8px 14px', borderRadius: '10px', border: '1px solid #dcfce7',
                                                background: '#f0fdf4', color: '#15803d', fontSize: '0.8rem', fontWeight: 800,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            <HardHat size={14} /> {assignedContractor.name}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Staff Selector Dropdown */}
                            {showStaffSelector && (
                                <div style={{
                                    marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '12px',
                                    border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                                        ทีมช่างเฉพาะโครงการ {projectAffiliation}:
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {availableStaff.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => handleAddStaff(s)}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                                                    background: '#fff', color: '#334155', fontSize: '0.8rem', fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {s.name}
                                            </button>
                                        )/*  */)}
                                    </div>
                                </div>
                            )}

                            {/* Labor List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {labor.length === 0 ? (
                                    <div style={{ padding: '32px', textAlign: 'center', border: '2px dashed #e2e8f0', borderRadius: '16px', color: '#94a3b8' }}>
                                        <Users size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                        <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>ยังไม่มีการระบุข้อมูลแรงงาน</div>
                                        <div style={{ fontSize: '0.8rem' }}>คลิกปุ่มด้านบนเพื่อเพิ่มรายชื่อช่าง</div>
                                    </div>
                                ) : (
                                    labor.map(l => (
                                        <div key={l.id} style={{
                                            padding: '12px 16px', borderRadius: '12px', background: '#fff',
                                            border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: l.membership === 'Internal' ? '#eff6ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {l.membership === 'Internal' ? <User size={18} color="#2563eb" /> : <HardHat size={18} color="#059669" />}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1e293b' }}>{l.staffName || l.affiliation}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{l.membership === 'Internal' ? 'ช่างโครงการ' : 'บริษัทรับเหมา'}</div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                {/* Detailed Shift Selectors */}
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    {[
                                                        { key: 'normal', label: 'ปกติ', color: '#64748b', bg: '#f1f5f9' },
                                                        { key: 'otMorning', label: 'โอเช้า', color: '#0ea5e9', bg: '#f0f9ff' },
                                                        { key: 'otNoon', label: 'โอเที่ยง', color: '#f59e0b', bg: '#fffbeb' },
                                                        { key: 'otEvening', label: 'โอเย็น', color: '#ea580c', bg: '#fff7ed' }
                                                    ].map((s: any) => (
                                                        <button
                                                            key={s.key}
                                                            type="button"
                                                            onClick={() => toggleShift(l.id, s.key)}
                                                            style={{
                                                                padding: '4px 8px', borderRadius: '6px', border: '1px solid',
                                                                borderColor: (l.shifts as any)?.[s.key] ? s.color : '#e2e8f0',
                                                                background: (l.shifts as any)?.[s.key] ? s.bg : '#fff',
                                                                color: (l.shifts as any)?.[s.key] ? s.color : '#94a3b8',
                                                                fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                boxShadow: (l.shifts as any)?.[s.key] ? `0 2px 4px ${s.color}20` : 'none'
                                                            }}
                                                        >
                                                            {s.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    style={{
                                                        padding: '4px 8px', borderRadius: '6px', border: '1px solid',
                                                        borderColor: l.timeType === 'Normal' ? '#e2e8f0' : '#ea580c',
                                                        background: l.timeType === 'Normal' ? '#fff' : '#fff7ed',
                                                        color: l.timeType === 'Normal' ? '#64748b' : '#ea580c',
                                                        fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer'
                                                    }}
                                                >
                                                    {l.timeType === 'Normal' ? 'เวลาปกติ' : 'ล่วงเวลา (OT)'}
                                                </button>

                                                {/* Amount Controls */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                    <button onClick={() => handleUpdateLaborAmount(l.id, l.amount - 1)} style={{ width: '24px', height: '24px', border: 'none', background: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>-</button>
                                                    <span style={{ minWidth: '24px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>{l.amount}</span>
                                                    <button onClick={() => handleUpdateLaborAmount(l.id, l.amount + 1)} style={{ width: '24px', height: '24px', border: 'none', background: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>+</button>
                                                </div>

                                                <button onClick={() => handleRemoveLabor(l.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Labor Photos Upload */}
                            <div style={{ marginTop: '24px', padding: '16px', background: '#f0f9ff', borderRadius: '16px', border: '1px dashed #7dd3fc' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Camera size={18} color="#0369a1" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0369a1' }}>รูปภาพแรงงาน / ทีมช่าง (Labor Proof)</span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: '#0ea5e9', fontWeight: 700 }}>แนบรูปทีมช่างหน้างาน</span>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {laborPhotos.map((url, i) => (
                                        <div key={i} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #7dd3fc' }}>
                                            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button 
                                                onClick={() => setLaborPhotos(laborPhotos.filter((_, idx) => idx !== i))}
                                                style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px', cursor: 'pointer' }}
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {laborPhotos.length < 3 && (
                                        <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleLaborPhotoUpload}
                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                                disabled={isUploading}
                                            />
                                            <div style={{ 
                                                width: '100%', height: '100%', borderRadius: '8px', border: '1px dashed #0369a1', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369a1',
                                                background: '#fff'
                                            }}>
                                                {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={20} />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Progress Section */}
                        <section>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle2 size={20} color="#10b981" />
                                    ความคืบหน้างานวันนี้ (Job Progress)
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>ประเมินสัดส่วนงานที่ทำได้สำเร็จ</p>
                            </div>
                            <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#0f172a' }}>{progress}%</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: progress === 100 ? '#10b981' : '#3b82f6' }}>
                                        {progress === 100 ? '✅ พร้อมส่งตรวจรับ' : '🚀 อยู่ระหว่างดำเนินการ'}
                                    </span>
                                </div>
                                <input
                                    type="range" 
                                    min={minProgress} 
                                    max={maxProgress} 
                                    step="5" 
                                    value={progress}
                                    onChange={(e) => setProgress(Number(e.target.value))}
                                    style={{ 
                                        width: '100%', 
                                        height: '10px', 
                                        borderRadius: '6px', 
                                        appearance: 'none', 
                                        background: `linear-gradient(to right, #94a3b8 0%, #94a3b8 ${(minProgress / maxProgress) * 100}%, #e2e8f0 ${(minProgress / maxProgress) * 100}%, #e2e8f0 100%)`, 
                                        cursor: 'pointer', 
                                        outline: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                    {[0, 25, 50, 75, 100].map(val => {
                                        const isDisabled = val < minProgress || val > maxProgress;
                                        return (
                                            <button 
                                                key={val} 
                                                onClick={() => !isDisabled && setProgress(val)} 
                                                disabled={isDisabled}
                                                style={{ 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 800, 
                                                    color: isDisabled ? '#e2e8f0' : '#94a3b8', 
                                                    border: 'none', 
                                                    background: 'none', 
                                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                    textDecoration: isDisabled ? 'line-through' : 'none'
                                                }}
                                            >
                                                {val}%
                                            </button>
                                        );
                                    })}
                                </div>
                                {(minProgress > 0 || maxProgress < 100) && (
                                    <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#ef4444', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <AlertCircle size={12} />
                                        * ความคืบหน้าต้องอยู่ระหว่าง {minProgress}% ถึง {maxProgress}%
                                    </div>
                                )}
                            </div>
                            {progress === 100 && (
                                <div style={{ marginTop: '12px', padding: '12px 16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #dbeafe', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <Info size={16} color="#3b82f6" />
                                    <div style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 700 }}>
                                        <strong>Auto-After System:</strong> เมื่อยืนยันที่ 100% ระบบจะใช้รูปภาพที่อัปเดตล่าสุดเป็นรูป "หลังซ่อม" โดยอัตโนมัติ
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Side: Photos & Notes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {/* Reference Section */}
                        <section>
                            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#475569', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                รูปภาพอ้างอิงและอัปเดต
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                {/* Before Photo */}
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', textAlign: 'center' }}>[ รูปต้นเรื่อง ]</div>
                                    <div style={{ width: '100%', height: '140px', borderRadius: '12px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                        {task.beforePhotoUrl ? (
                                            <img loading="lazy" src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                        ) : (
                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}><Camera size={24} /></div>
                                        )}
                                    </div>
                                </div>
                                {/* New Photo Target */}
                                <div style={{ cursor: 'pointer', position: 'relative' }}>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={handlePhotoUpload} 
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                        disabled={isUploading}
                                    />
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b82f6', marginBottom: '8px', textAlign: 'center' }}>[ ถ่ายรูปอัปเดต ]</div>
                                    <div style={{
                                        width: '100%', height: '140px', borderRadius: '12px', background: '#eff6ff',
                                        border: '2px dashed #3b82f6', display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', color: '#3b82f6', transition: 'all 0.2s'
                                    }}
                                        onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; }}
                                        onMouseOut={e => { e.currentTarget.style.background = '#eff6ff'; }}
                                    >
                                        {isUploading ? (
                                            <Loader2 className="animate-spin" size={28} />
                                        ) : (
                                            <>
                                                <Camera size={28} style={{ marginBottom: '8px' }} />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 900 }}>เพิ่มรูปภาพ</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Photo Gallery */}
                            {photos.length > 0 && (
                                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {photos.map((url, i) => (
                                        <div key={i} style={{ position: 'relative', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                            <img loading="lazy" src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button
                                                onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                                                style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px', cursor: 'pointer' }}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {photos.length === 0 && (
                                <div style={{ marginTop: '12px', padding: '10px', background: '#fff1f2', borderRadius: '8px', border: '1px solid #ffe4e6', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <AlertCircle size={14} color="#e11d48" />
                                    <span style={{ fontSize: '0.75rem', color: '#be123c', fontWeight: 800 }}>ต้องอัปโหลดรูปภาพอย่างน้อย 1 รูป</span>
                                </div>
                            )}
                        </section>

                        {/* Notes Section */}
                        <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#475569', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    บันทึกเพิ่มเติมจากหน้างาน (Site Notes)
                                </h3>
                                {/* Toggle Status */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: type === 'Problem' ? '#ef4444' : '#64748b' }}>
                                        {type === 'Problem' ? '🚨 กำลังรายงานปัญหา' : 'แจ้งพบปัญหาหน้างาน:'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setType(type === 'Normal' ? 'Problem' : 'Normal')}
                                        style={{
                                            width: '50px',
                                            height: '26px',
                                            borderRadius: '13px',
                                            background: type === 'Problem' ? '#ef4444' : '#e2e8f0',
                                            position: 'relative',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            padding: 0
                                        }}
                                    >
                                        <div style={{
                                            position: 'absolute',
                                            top: '3px',
                                            left: type === 'Problem' ? '27px' : '3px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            background: '#fff',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }}>
                                            {type === 'Problem' && <AlertCircle size={10} color="#ef4444" />}
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="เช่น วัสดุมาส่งแล้ว, อยู่ระหว่างรอสีแห้ง, ต้องการช่างเพิ่ม 2 คน..."
                                style={{
                                    flex: 1, width: '100%', padding: '16px', borderRadius: '16px',
                                    border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b',
                                    fontSize: '0.9rem', lineHeight: 1.6, resize: 'none', outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }}
                                onBlur={e => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                            />
                        </section>
                    </div>
                </div>

                {/* Footer Actions */}
                <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '12px 24px', borderRadius: '14px', border: '1px solid #e2e8f0',
                            background: '#fff', color: '#64748b', fontSize: '0.95rem', fontWeight: 800,
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleSubmit}
                        style={{
                            padding: '12px 32px', borderRadius: '14px', border: 'none',
                            background: '#2563eb', color: '#fff', fontSize: '0.95rem', fontWeight: 900,
                            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#1d4ed8'}
                        onMouseOut={e => e.currentTarget.style.background = '#2563eb'}
                    >
                        ยืนยันการส่งรายงาน
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyReportModal;
