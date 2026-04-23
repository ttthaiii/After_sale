import { useState, useMemo, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useWorkOrders } from '../context/WorkOrderContext';
import { MasterTask, WorkOrder, LaborRecord, TaskUpdate, Staff, Project, Contractor } from '../types';
import { Search, Building2, HardHat, Camera, CheckCircle2, User, Users, Plus, Info, AlertCircle, AlertTriangle, XCircle, LayoutDashboard, Clock, MapPin, Package, Bell, CheckSquare, Square, Loader2, Activity, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { AnalogTimePicker } from '../components/AnalogTimePicker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageCompression';
import { useNavigate, useLocation } from 'react-router-dom';
import { logService } from '../services/logService';

// Helper for SLA Countdown component
const SLACountdown = ({ startTime, durationHours = 24 }: { startTime: string, durationHours?: number }) => {
    const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, isOverdue: boolean } | null>(null);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const start = new Date(startTime).getTime();
            const end = start + (durationHours * 60 * 60 * 1000);
            const now = new Date().getTime();
            const diff = end - now;

            if (diff < 0) {
                const overdueDiff = Math.abs(diff);
                const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((overdueDiff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeLeft({ days, hours, minutes, isOverdue: true });
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeLeft({ days, hours, minutes, isOverdue: false });
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 60000); // Update every minute
        return () => clearInterval(timer);
    }, [startTime, durationHours]);

    if (!timeLeft) return <div>...</div>;

    return (
        <div style={{ background: '#fff', padding: '12px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', minWidth: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>เป้าหมาย (SLA)</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#334155' }}>{durationHours} ชม.</span>
            </div>
            <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, #e2e8f0 0%, #cbd5e1 50%, #e2e8f0 100%)', marginBottom: '8px', opacity: 0.6 }}></div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: timeLeft.isOverdue ? '#ef4444' : '#f59e0b', marginBottom: '2px', textTransform: 'uppercase' }}>
                    {timeLeft.isOverdue ? 'เกินกำหนด' : 'เหลือเวลา'}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: timeLeft.isOverdue ? '#ef4444' : '#f97316', lineHeight: 1 }}>
                    <span>{timeLeft.days}<span style={{ fontSize: '0.8rem', fontWeight: 700 }}>วัน</span> </span>
                    {timeLeft.hours.toString().padStart(2, '0')}<span style={{ fontSize: '0.8rem', fontWeight: 700 }}>:</span>{timeLeft.minutes.toString().padStart(2, '0')}
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, marginLeft: '2px' }}>ชม.</span>
                </div>
            </div>
        </div>
    );
};

// Batch Config Modal
const BatchAddModal = ({
    type,
    availableItems,
    onClose,
    onAdd
}: {
    type: 'Internal' | 'Outsource';
    availableItems: any[];
    onClose: () => void;
    onAdd: (selectedIds: string[], config: any) => void;
}) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [config, setConfig] = useState<any>({
        day: true,
        otMorning: false,
        otNoon: false,
        otEvening: false,
        timeDay: '08:00 - 17:00',
        timeOtMorning: '06:00 - 08:00',
        timeOtEvening: '18:00 - 21:00'
    });

    // Internal state for TimePicker inside BatchModal
    const [modalTimeTarget, setModalTimeTarget] = useState<{ field: string, type: 'start' | 'end', currentValue: string } | null>(null);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleConfirm = () => {
        if (selectedIds.length === 0) return alert('กรุณาเลือกคนงานอย่างน้อย 1 คน');
        onAdd(selectedIds, config);
    };

    const openModalTimePicker = (field: string, type: 'start' | 'end', value: string) => {
        setModalTimeTarget({ field, type, currentValue: value });
    };

    const handleModalTimeChange = (newTime: string) => {
        if (!modalTimeTarget) return;
        const { field, type } = modalTimeTarget;
        const currentRange = config[field] || '00:00 - 00:00';
        let [start, end] = currentRange.split(' - ').map((s: string) => s.trim());

        if (type === 'start') start = newTime;
        else end = newTime;

        setConfig({ ...config, [field]: `${start} - ${end} ` });
        setModalTimeTarget(null); // Close picker
    };

    const BatchTimeInput = ({ label, field, timeField }: { label: string, field: string, timeField?: string }) => {
        const isActive = config[field];
        // Parse current value to show start/end 
        const [startTime, endTime] = (config[timeField || ''] || '00:00 - 00:00').split(' - ');

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', border: isActive ? '1px solid #3b82f6' : '1px solid #f1f5f9', borderRadius: '10px', background: isActive ? '#eff6ff' : '#f8fafc' }}>
                <div onClick={() => setConfig({ ...config, [field]: !isActive })} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: isActive ? '2px solid #2563eb' : '2px solid #cbd5e1', background: isActive ? '#2563eb' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isActive && <CheckCircle2 size={12} color="#fff" />}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isActive ? '#1e40af' : '#64748b' }}>{label}</span>
                </div>
                {isActive && timeField && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' }}>
                        <div
                            onClick={() => openModalTimePicker(timeField, 'start', startTime)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px',
                                padding: '4px 8px', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 700, color: '#334155'
                            }}
                        >
                            <Clock size={12} color="#94a3b8" />
                            {startTime}
                        </div>
                        <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>-</span>
                        <div
                            onClick={() => openModalTimePicker(timeField, 'end', endTime)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px',
                                padding: '4px 8px', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 700, color: '#334155'
                            }}
                        >
                            {endTime}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {modalTimeTarget && (
                <div style={{ zIndex: 3000, position: 'relative' }}>
                    <AnalogTimePicker
                        value={modalTimeTarget.currentValue}
                        onChange={handleModalTimeChange}
                        onClose={() => setModalTimeTarget(null)}
                    />
                </div>
            )}

            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '24px', width: '500px', maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 900 }}>เลือก{type === 'Internal' ? 'คนงานบริษัท' : 'ผู้รับเหมา'}</h3>

                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem', minHeight: '300px' }}>
                        {availableItems.length === 0 ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>ไม่พบรายการ</div>
                        ) : (
                            availableItems.map(item => {
                                const isSelected = selectedIds.includes(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleSelect(item.id)}
                                        style={{
                                            padding: '10px', borderRadius: '8px', marginBottom: '4px', cursor: 'pointer',
                                            background: isSelected ? '#eff6ff' : '#fff',
                                            border: '1px solid', borderColor: isSelected ? '#3b82f6' : 'transparent',
                                            display: 'flex', alignItems: 'center', gap: '10px'
                                        }}
                                    >
                                        {isSelected ? <CheckSquare size={20} color="#3b82f6" /> : <Square size={20} color="#cbd5e1" />}
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{item.name}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid #f1f5f9' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>กำหนดเวลางาน (Batch Setting)</h4>
                        <p style={{ margin: '-4px 0 12px 0', fontSize: '0.75rem', color: '#94a3b8' }}>*เวลาที่ระบุจะถูกนำไปใช้กับทุกคนที่เลือก</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <BatchTimeInput label="Day (ปกติ)" field="day" timeField={type === 'Internal' ? "timeDay" : undefined} />
                            {type === 'Internal' && (
                                <>
                                    <BatchTimeInput label="OT เช้า" field="otMorning" timeField="timeOtMorning" />
                                    <BatchTimeInput label="OT เที่ยง" field="otNoon" />
                                    <BatchTimeInput label="OT เย็น" field="otEvening" timeField="timeOtEvening" />
                                </>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>ยกเลิก</button>
                        <button onClick={handleConfirm} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>เพิ่ม {selectedIds.length} รายการ</button>
                    </div>
                </div>
            </div>
        </>
    );
};


const DailyReport = () => {
    const { workOrders, addTaskUpdate, updateTask, updateWorkOrderStatus } = useWorkOrders();
    const { user } = useAuth(); // ✅ Use authenticated user
    const { sendNotification } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();
    const foremanId = user?.id || 'admin-initial';
    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    const [selectedTaskInfo, setSelectedTaskInfo] = useState<{ task: MasterTask; wo: WorkOrder; categoryId: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [progress, setProgress] = useState(0);
    const [note, setNote] = useState('');
    const [labor, setLabor] = useState<LaborRecord[]>([]);
    const [photos, setPhotos] = useState<string[]>([]);
    const [laborPhotos, setLaborPhotos] = useState<string[]>([]);
    const [isEditingExisting, setIsEditingExisting] = useState(false); // ✅ New state for Edit Mode
    const [isUploading, setIsUploading] = useState(false);
    const [isLaborUploading, setIsLaborUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeModal, setActiveModal] = useState<'Internal' | 'Outsource' | null>(null);
    const [timePickerTarget, setTimePickerTarget] = useState<{ id: string, type: 'start' | 'end', shift: 'normal' | 'otMorning' | 'otEvening', currentValue: string } | null>(null);
    const [reportType, setReportType] = useState<TaskUpdate['type']>('Update');
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

    // ✅ Real-time Sync Data from Firestore
    const [realStaff, setRealStaff] = useState<Staff[]>([]);
    const [realContractors, setRealContractors] = useState<Contractor[]>([]);
    const [realProjects, setRealProjects] = useState<Project[]>([]);

    useEffect(() => {
        const unsubStaff = onSnapshot(collection(db, 'staff'), (snap) => {
            setRealStaff(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Staff));
        });
        const unsubContractors = onSnapshot(collection(db, 'contractors'), (snap) => {
            setRealContractors(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Contractor));
        });
        const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
            setRealProjects(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Project));
        });
        return () => {
            unsubStaff();
            unsubContractors();
            unsubProjects();
        };
    }, []);

    // ✅ Sync Form Data when Date or Task Changes
    useEffect(() => {
        if (!selectedTaskInfo) return;

        // Search for an existing report for this exact date
        const existingReport = selectedTaskInfo.task.history?.find(h => (h.date?.split('T')[0]) === reportDate);

        if (existingReport) {
            // Fill form with existing data
            setProgress(existingReport.progress);
            setNote(existingReport.note || '');
            setLabor(existingReport.labor || []);
            setPhotos(existingReport.photos || []);
            setLaborPhotos(existingReport.laborPhotos || []);
            setIsEditingExisting(false); // ✅ Reset to locked mode when switching dates
        } else {
            // Reset form for a new entry on this date, defaulting to the latest valid progress
            const history = selectedTaskInfo.task.history || [];
            let min = 0;
            history.forEach(h => {
                const hDate = h.date?.split('T')[0] || '';
                if (hDate && hDate < reportDate && h.progress > min) {
                    min = h.progress;
                }
            });
            setProgress(min); 
            setNote('');
            setLabor([]);
            setPhotos([]);
            setLaborPhotos([]);
            setIsEditingExisting(true); // ✅ New days are always open for editing
        }
    }, [reportDate, selectedTaskInfo?.task.id]);

    // ✅ Track Page View
    useEffect(() => {
        if (user) {
            logService.trackPageView(user, 'REPORTING', 'หน้าส่งงานรายวัน (Daily Report)');
        }
    }, [user]);

    const { newTasks, inProgressTasks } = useMemo(() => {
        const _newTasks: { task: MasterTask; wo: WorkOrder; categoryId: string }[] = [];
        const _inProgressTasks: { task: MasterTask; wo: WorkOrder; categoryId: string }[] = [];

        workOrders.forEach(wo => {
            // Only show work orders that are active (Approved, Partially Approved, Pending, In Progress)
            // Note: 'Pending' is used for jobs that skipped evaluation or legacy
            if (['Draft', 'Evaluating', 'Completed', 'Rejected', 'Cancelled'].includes(wo.status)) return;

            wo.categories.forEach(cat => {
                cat.tasks.forEach(task => {
                    // Show tasks that are Approved (Ready), Assigned (Specific person) or In Progress
                    // 🛡️ RELAXED FILTER: If it's not 100% and not rejected/cancelled, show it!
                    if (task.status === 'Completed' || (task.dailyProgress || 0) >= 100 || task.status === 'Rejected') return;

                    // Filter by assigned staff (or show all for Admins/Managers)
                    // Also show to the reporter if the task is Approved (Ready to start)
                    const isAssigned = user?.role === 'Admin' ||
                        user?.role === 'Manager' ||
                        task.responsibleStaffIds?.includes(foremanId) ||
                        (wo.reporterId === user?.id && task.status === 'Approved' && (!task.responsibleStaffIds || task.responsibleStaffIds.length === 0));

                        if (isAssigned && (task.dailyProgress || 0) < 100) {
                            // ✅ Find the absolute maximum progress from history to ensure correct display
                            const historyMax = task.history?.reduce((max, h) => Math.max(max, h.progress), 0) || 0;
                            const actualProgress = Math.max(task.dailyProgress || 0, historyMax);
                            
                            const item = { 
                                task: { ...task, dailyProgress: actualProgress }, 
                                wo, 
                                categoryId: cat.id 
                            };
                            const hasProgress = actualProgress > 0;
                            
                            if (searchTerm) {
                                const match = task.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                             wo.locationName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                             wo.id.toLowerCase().includes(searchTerm.toLowerCase());
                                if (!match) return;
                            }

                            if (hasProgress) _inProgressTasks.push(item);
                            else _newTasks.push(item);
                        }
                    });
                });
            });

            return { newTasks: _newTasks, inProgressTasks: _inProgressTasks };
        }, [workOrders, searchTerm, foremanId, user?.role]);

    // ✅ Deep Link: Open Work Order if ID is in URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const workOrderId = params.get('id');

        if (workOrderId && (newTasks.length > 0 || inProgressTasks.length > 0)) {
            // Find task in either newTasks or inProgressTasks
            const item = newTasks.find(n => n.wo.id === workOrderId) || inProgressTasks.find(i => i.wo.id === workOrderId);
            
            if (item) {
                setHighlightedId(workOrderId);
                // Call handleSelectTask with the found info
                handleSelectTask(item.task, item.wo, item.categoryId);
                
                // Clear URL parameters
                const newParams = new URLSearchParams(location.search);
                newParams.delete('id');
                const newSearch = newParams.toString();
                navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
            }
        }
    }, [location.search, newTasks, inProgressTasks]);

    const handleSelectTask = (task: MasterTask, wo: WorkOrder, categoryId: string) => {
        // ✅ 1. Find the history-based minimum progress for the current date
        const history = task.history || [];
        const todayStr = new Date().toISOString().split('T')[0];
        const historyBeforeToday = history
            .filter(h => (h.date?.split('T')[0] || '') < todayStr)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        
        const minP = historyBeforeToday.length > 0 ? historyBeforeToday[0].progress : 0;
        const currentP = task.dailyProgress || 0;

        setSelectedTaskInfo({ task, wo, categoryId });
        // ✅ 2. Force initial progress to be at least minP
        setProgress(currentP < minP ? minP : currentP);
        setNote('');
        setLabor([]);
        setPhotos([]);
        setReportType('Update');
        setReportDate(new Date().toISOString().split('T')[0]);
    };

    const progressBounds = useMemo(() => {
        if (!selectedTaskInfo) return { min: 0, max: 100, isToday: true };
        const history = selectedTaskInfo.task.history || [];
        const targetDate = reportDate; // YYYY-MM-DD
        
        let min = 0;
        let max = 100;
        
        history.forEach(h => {
            const hDate = h.date?.split('T')[0] || '';
            if (!hDate) return;

            if (hDate < targetDate) {
                if (h.progress > min) min = h.progress;
            } else if (hDate > targetDate) {
                if (h.progress < max) max = h.progress;
            }
        });
        
        const isToday = reportDate === new Date().toISOString().split('T')[0];
        const effectiveMax = isToday ? 100 : Math.min(max, 99);
        
        return { min, max: effectiveMax, isToday };
    }, [selectedTaskInfo, reportDate]);

    // Redundant force-sync removed, handled by onChange constraints and initialization

    const getTaskImage = (task: MasterTask) => {
        // Check all possible image fields in order of priority
        const img =
            task.beforePhotoUrl ||
            task.latestPhotoUrl ||
            task.afterPhotoUrl ||
            ((task as any).images && (task as any).images.length > 0 ? (task as any).images[0] : null) ||
            (task.attachments && task.attachments.length > 0 ? task.attachments[0].url : null);

        if (img && typeof img === 'string' && (img.startsWith('http') || img.startsWith('https') || img.startsWith('blob:'))) {
            return img;
        }
        return null;
    };

    const handleBatchAdd = (selectedIds: string[], config: any) => {
        const newRecords: LaborRecord[] = [];

        if (activeModal === 'Internal') {
            selectedIds.forEach(id => {
                // ✅ Handle DC placeholder
                if (id === 'DC-TEAM') {
                    newRecords.push({
                        id: `L - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `,
                        membership: 'Internal',
                        staffId: 'DC',
                        staffName: 'DC',
                        affiliation: 'DC',
                        amount: 1,
                        timeType: 'Normal',
                        shifts: {
                            normal: config.day,
                            otMorning: config.otMorning,
                            otNoon: config.otNoon,
                            otEvening: config.otEvening
                        },
                        shiftTimes: {
                            day: config.timeDay,
                            otMorning: config.timeOtMorning,
                            otNoon: '12:00 - 13:00',
                            otEvening: config.timeOtEvening
                        }
                    });
                    return;
                }

                const staff = realStaff.find(s => s.id === id);
                if (staff) {
                    newRecords.push({
                        id: `L - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `,
                        membership: 'Internal',
                        staffId: staff.id,
                        staffName: staff.name,
                        affiliation: staff.affiliation || 'General',
                        amount: 1,
                        timeType: 'Normal',
                        shifts: {
                            normal: config.day,
                            otMorning: config.otMorning,
                            otNoon: config.otNoon,
                            otEvening: config.otEvening
                        },
                        shiftTimes: {
                            day: config.timeDay,
                            otMorning: config.timeOtMorning,
                            otNoon: '12:00 - 13:00',
                            otEvening: config.timeOtEvening
                        }
                    });
                }
            });
        } else if (activeModal === 'Outsource') {
            selectedIds.forEach(id => {
                const contractor = realContractors.find(c => c.id === id);
                if (contractor) {
                    newRecords.push({
                        id: `L - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `,
                        membership: 'Outsource',
                        affiliation: contractor.name,
                        contractorId: contractor.id,
                        amount: 1,
                        timeType: 'Normal',
                        shifts: {
                            normal: config.day,
                            otMorning: false,
                            otNoon: false,
                            otEvening: false
                        },
                        shiftTimes: { day: '' }
                    });
                }
            });
        }

        setLabor([...labor, ...newRecords]);
        setActiveModal(null);
    };

    const toggleShift = (id: string, shiftKey: 'normal' | 'otMorning' | 'otNoon' | 'otEvening') => {
        if (!isEditingExisting) return;
        setLabor(prev => prev.map(l => {
            if (l.id !== id) return l;
            const currentShifts = l.shifts || { normal: false, otMorning: false, otNoon: false, otEvening: false };
            const isActive = !currentShifts[shiftKey];
            let newShiftTimes = { ...(l.shiftTimes || {}) };
            if (isActive && l.membership === 'Internal') {
                if (shiftKey === 'otMorning' && !newShiftTimes.otMorning) newShiftTimes.otMorning = '06:00 - 08:00';
                if (shiftKey === 'otNoon' && !newShiftTimes.otNoon) newShiftTimes.otNoon = '12:00 - 13:00';
                if (shiftKey === 'otEvening' && !newShiftTimes.otEvening) newShiftTimes.otEvening = '18:00 - 21:00';
            }
            return { ...l, shifts: { ...currentShifts, [shiftKey]: isActive }, shiftTimes: newShiftTimes };
        }));
    };

    const openTimePicker = (id: string, shift: 'normal' | 'otMorning' | 'otEvening', type: 'start' | 'end') => {
        if (!isEditingExisting) return;
        const record = labor.find(l => l.id === id);
        if (!record || !record.shiftTimes) return;
        let rangeStr = '';
        if (shift === 'normal') rangeStr = record.shiftTimes.day || '08:00 - 17:00';
        else rangeStr = record.shiftTimes[shift] || '';
        const [start, end] = rangeStr.split(' - ').map(s => s.trim());
        setTimePickerTarget({ id, shift, type, currentValue: (type === 'start' ? start : end) || '00:00' });
    };

    const handleTimeChange = (val: string) => {
        if (!timePickerTarget) return;
        const { id, type, shift } = timePickerTarget;
        setLabor(prev => prev.map(l => {
            if (l.id !== id) return l;
            const times = { ...(l.shiftTimes || {}) };
            let range = '';
            if (shift === 'normal') range = times.day || '08:00 - 17:00';
            else range = times[shift] || '00:00 - 00:00';
            let [start, end] = range.split(' - ').map(s => s.trim());
            if (type === 'start') start = val;
            else end = val;
            const newRange = `${start} - ${end} `;
            if (shift === 'normal') times.day = newRange;
            else times[shift] = newRange;
            return { ...l, shiftTimes: times };
        }));
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedTaskInfo) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `progress_${Date.now()}.${fileExt}`;
            const storagePath = `work_orders/${selectedTaskInfo.wo.id}/progress/${fileName}`;
            const storageRef = ref(storage, storagePath);

            // 1. บีบอัดรูปภาพ (ลดขนาดไฟล์)
            const compressedFile = await compressImage(file, 1280, 0.7);

            // 2. ตั้งค่า Cache Control 
            const metadata = {
                cacheControl: 'public, max-age=31536000',
                contentType: compressedFile.type || 'image/jpeg',
            };

            const snapshot = await uploadBytes(storageRef, compressedFile, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setPhotos(prev => [...prev, downloadURL]);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleLaborPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedTaskInfo) return;

        setIsLaborUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `labor_${Date.now()}.${fileExt}`;
            const storagePath = `work_orders/${selectedTaskInfo.wo.id}/labor_proof/${fileName}`;
            const storageRef = ref(storage, storagePath);

            const compressedFile = await compressImage(file, 1280, 0.7);
            const metadata = {
                cacheControl: 'public, max-age=31536000',
                contentType: compressedFile.type || 'image/jpeg',
            };

            const snapshot = await uploadBytes(storageRef, compressedFile, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setLaborPhotos(prev => [...prev, downloadURL]);
        } catch (error) {
            console.error('Labor photo upload failed:', error);
            alert('อัปโหลดรูปภาพแรงงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsLaborUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleBounceBackSLA = async (workOrderId: string, categoryId: string, taskId: string) => {
        if (!window.confirm('คุณต้องการตีกลับใบงานนี้เพื่อให้แอดมินประเมิน SLA ใหม่ใช่หรือไม่?\n(งานจะถูกถอดออกจากการมอบหมายและส่งกลับไปที่แอดมิน)')) return;
        
        setIsSubmitting(true);
        try {
            // 1. Reset task status to Pending and clear assignment/SLA
            await updateTask(workOrderId, categoryId, taskId, {
                status: 'Pending',
                slaCategory: null,
                responsibleStaffIds: []
            });

            // 1.5 Update Work Order status back to Evaluating so Admin can see it
            await updateWorkOrderStatus(workOrderId, 'Evaluating');

            // 2. Send Notification to Admin
            await sendNotification({
                recipientRole: 'Admin',
                senderId: user?.id || 'foreman',
                senderName: user?.name || 'Foreman',
                title: 'ใบงานถูกตีกลับ (SLA Mismatch)',
                message: `งาน "${selectedTaskInfo?.task.name}" ถูกตีกลับโดยโฟร์แมนเพื่อขอประเมิน SLA ใหม่`,
                type: 'warning',
                targetPath: `/evaluation?id=${workOrderId}`
            });

            // 3. Activity Log
            logService.trackAction({
                userId: user?.id || 'unknown',
                userName: user?.name || 'Unknown',
                role: user?.role || 'Foreman',
                action: 'UPDATE', // Match existing ActivityLog['action'] type
                module: 'REPORTING',
                details: `Foreman rejected SLA (${selectedTaskInfo?.task.slaCategory}) and requested re-evaluation. Expected: ${selectedTaskInfo?.task.estimatedSla}`,
                targetId: taskId
            });

            alert('ตีกลับใบงานเรียบร้อยแล้ว');
            setSelectedTaskInfo(null);
        } catch (err) {
            console.error("Bounce back error:", err);
            alert('เกิดข้อผิดพลาดในการตีกลับใบงาน');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedTaskInfo) return;
        if (photos.length === 0) return alert('กรุณาถ่ายรูปอัปเดตหน้างานอย่างน้อย 1 รูป');
        if (laborPhotos.length === 0) return alert('กรุณาถ่ายรูปยืนยันคนงานเข้าปฏิบัติงานอย่างน้อย 1 รูป');
        if (labor.length === 0) return alert('กรุณาระบุข้อมูลแรงงานที่เข้าดำเนินการ');

        // ✅ 1. Timeline-consistent Progress Validation
        if (progress <= progressBounds.min) {
            alert(`ความคืบหน้าสำหรับวันที่เลือกต้องมากกว่า ${progressBounds.min}% (ตามประวัติก่อนหน้า)`);
            return;
        }
        if (progress > progressBounds.max) {
            alert(`ความคืบหน้าสำหรับวันที่เลือกต้องไม่เกิน ${progressBounds.max}% ${!progressBounds.isToday && progress === 100 ? '(ห้ามลงปิดงาน 100% ย้อนหลัง)' : '(เนื่องจากมีข้อมูลวันที่หลังจากนี้ลงไปแล้ว)'}`);
            return;
        }

        // ✅ 2. Prevent Duplicate Date Entry
        const existingHistory = selectedTaskInfo.task.history?.find(h => (h.date?.split('T')[0]) === reportDate);
        if (existingHistory && !isEditingExisting) {
            alert(`คุณเคยส่งรายงานของวันที่ ${new Date(reportDate).toLocaleDateString('th-TH')} ไปแล้วในใบงานนี้ หากต้องการแก้ไขกรุณากดปุ่มแก้ไขข้อมูล`);
            return;
        }

        setIsSubmitting(true);
        try {
                const updateId = (isEditingExisting && existingHistory) ? existingHistory.id : `h-${Date.now()}`;
                const newUpdate: TaskUpdate = {
                    id: updateId,
                    date: `${reportDate}T${new Date().toISOString().split('T')[1]}`, // Use Report Date with current time
                    note,
                    progress,
                    photos,
                    laborPhotos,
                    labor,
                    type: reportType
                };

            await addTaskUpdate(selectedTaskInfo.wo.id, selectedTaskInfo.categoryId, selectedTaskInfo.task.id, newUpdate as any);
            alert('บันทึกรายงานเรียบร้อยแล้ว');
            setSelectedTaskInfo(null);
            setProgress(0);
            setNote('');
            setLabor([]);
            setPhotos([]);
            setLaborPhotos([]);
            setReportType('Update');
            setReportDate(new Date().toISOString().split('T')[0]);
        } catch (error) {
            console.error('Submit failed:', error);
            alert('บันทึกรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderTaskCard = (task: MasterTask, wo: WorkOrder, categoryId: string, isNew: boolean) => {
        const isSelected = selectedTaskInfo?.task.id === task.id;
        const isHighlighted = highlightedId === wo.id;
        const project = realProjects.find(p => p.id === wo.projectId);

        // Circular Progress Calculation
        const progressColor = task.dailyProgress === 100 ? '#10b981' : task.dailyProgress > 0 ? '#3b82f6' : '#e2e8f0';

        return (
            <div
                key={task.id}
                onClick={() => handleSelectTask(task, wo, categoryId)}
                style={{
                    padding: '16px', borderRadius: '20px', marginBottom: '12px',
                    border: '1px solid', borderColor: isSelected ? '#3b82f6' : isHighlighted ? '#3b82f6' : isNew ? '#fcd34d' : '#f1f5f9',
                    background: isSelected ? '#eff6ff' : isHighlighted ? '#eff6ff' : isNew ? '#fffbeb' : '#fff',
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: isSelected || isHighlighted ? '0 10px 15px -3px rgba(59, 130, 246, 0.15)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
                    transform: isHighlighted && !isSelected ? 'scale(1.02)' : 'none',
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: '16px'
                }}
            >
                {/* Circular Progress */}
                <div style={{ position: 'relative', width: '88px', height: '88px', flexShrink: 0 }}>
                    <svg height="88" width="88" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="44" cy="44" r="38" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                        <circle
                            cx="44" cy="44" r="38"
                            stroke={progressColor} strokeWidth="8" fill="none"
                            strokeDasharray={2 * Math.PI * 38}
                            strokeDashoffset={(2 * Math.PI * 38) - (task.dailyProgress / 100) * (2 * Math.PI * 38)}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        />
                    </svg>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#334155', letterSpacing: '-0.03em' }}>{task.dailyProgress}%</span>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', background: '#dbeafe', padding: '2px 6px', borderRadius: '4px' }}>{wo.id}</div>
                        {isNew && <div style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 800, padding: '2px 6px', borderRadius: '8px' }}>ใหม่</div>}
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={12} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wo.locationName}</span>
                    </div>
                </div>

                {/* Project Image */}
                <div style={{ width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                    {getTaskImage(task) ?
                        <img loading="lazy" src={getTaskImage(task)!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Task" /> :
                        (project?.imageUrl ?
                            <img loading="lazy" src={project.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Project" /> :
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}><Building2 size={24} /></div>
                        )
                    }
                </div>
            </div>
        );
    };

    const renderTimeInput = (id: string, shift: 'normal' | 'otMorning' | 'otEvening', rangeStr: string) => {
        const [start, end] = rangeStr.split(' - ').map(s => s.trim());
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: isEditingExisting ? 'auto' : 'none' }}>
                <div
                    onClick={() => openTimePicker(id, shift, 'start')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                        padding: '4px 8px', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: 700, color: '#334155',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    <Clock size={12} color="#94a3b8" />
                    {start}
                </div>
                <span style={{ color: '#cbd5e1', fontWeight: 700 }}>-</span>
                <div
                    onClick={() => openTimePicker(id, shift, 'end')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                        padding: '4px 8px', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: 700, color: '#334155',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    {end}
                </div>
            </div>
        );
    };

    const availableStaff = [
        { id: 'DC-TEAM', name: 'DC' },
        ...realStaff
    ].filter(s => !labor.some(l => l.staffId === (s.id === 'DC-TEAM' ? 'DC' : s.id)));

    const availableContractors = realContractors.filter(c => !labor.some(l => l.contractorId === c.id));

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 1fr) 2fr', gap: '2rem', height: 'calc(100vh - 120px)' }}>
            {timePickerTarget && <AnalogTimePicker value={timePickerTarget.currentValue} onChange={handleTimeChange} onClose={() => setTimePickerTarget(null)} />}
            {activeModal && <BatchAddModal type={activeModal} availableItems={activeModal === 'Internal' ? availableStaff : availableContractors} onClose={() => setActiveModal(null)} onAdd={handleBatchAdd} />}

            <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                        <div style={{ background: '#3b82f6', color: '#fff', padding: '8px', borderRadius: '10px' }}><LayoutDashboard size={20} /></div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>งานรอรายงานผล</h2>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                        <input type="text" placeholder="ค้นหาเลขที่งาน หรือ สถานที่..." style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {newTasks.length === 0 && inProgressTasks.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}><div style={{ fontSize: '0.9rem', fontWeight: 700 }}>ไม่มีงานที่ต้องรายงานในขณะนี้</div></div> :
                        <>
                            {newTasks.length > 0 && <div style={{ marginBottom: '1.5rem' }}><h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', marginLeft: '8px', marginBottom: '10px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}><Bell size={12} fill="currentColor" /> งานใหม่ (New Assignments)</h3>{newTasks.map(({ task, wo, categoryId }: any) => renderTaskCard(task, wo, categoryId, true))}</div>}
                            {inProgressTasks.length > 0 && <div><h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', marginLeft: '8px', marginBottom: '10px', textTransform: 'uppercase' }}>งานที่กำลังทำ (In Progress)</h3>{inProgressTasks.map(({ task, wo, categoryId }: any) => renderTaskCard(task, wo, categoryId, false))}</div>}
                        </>
                    }
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {!selectedTaskInfo ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <LayoutDashboard size={64} style={{ opacity: 0.1, marginBottom: '1.5rem' }} /><h3 style={{ margin: 0, fontWeight: 800 }}>เลือกรายการงานที่ต้องการรายงานผล</h3><p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>รายการงานที่ท่านได้รับมอบหมายจะแสดงในแถบด้านซ้าย</p>
                    </div>
                ) : (
                    <>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', minHeight: '130px' }}>
                                <div style={{ width: '150px', background: '#f1f5f9', position: 'relative', flexShrink: 0 }}>
                                    {getTaskImage(selectedTaskInfo.task) ? <img src={getTaskImage(selectedTaskInfo.task)!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}><AlertCircle size={24} /></div>}
                                    <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>BEFORE</div>
                                </div>
                                <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', background: '#dbeafe', padding: '2px 8px', borderRadius: '6px' }}>{selectedTaskInfo.wo.id}</div>
                                                {(() => {
                                                    const project = realProjects.find(p => p.id === selectedTaskInfo.wo.projectId);
                                                    return project ? (
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>🏢 {project.name}</div>
                                                    ) : null;
                                                })()}
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px', border: '1px solid #dbeafe' }}>
                                                        <MapPin size={12} color="#3b82f6" />
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af' }}>{selectedTaskInfo.task.position || '-'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f0fdf4', padding: '2px 8px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                                                        <Package size={12} color="#15803d" />
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>{selectedTaskInfo.task.amount || 1} {selectedTaskInfo.task.unit || 'จุด'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>{selectedTaskInfo.task.name}</h2>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', minWidth: '200px', marginLeft: '20px' }}>
                                            {/* Zone A: SLA + Countdown */}
                                            {(() => {
                                                const slaHoursMap = {
                                                    'Immediately': 4,
                                                    '24h': 24,
                                                    '1-3d': 72,
                                                    '3-7d': 168,
                                                    '7-14d': 336,
                                                    '14-30d': 720
                                                };
                                                const slaDuration = slaHoursMap[selectedTaskInfo.task.slaCategory as keyof typeof slaHoursMap] || 24;
                                                return (
                                                    <div style={{ width: '100%' }}>
                                                        <SLACountdown startTime={selectedTaskInfo.task.slaStartTime || selectedTaskInfo.task.startDate || new Date().toISOString()} durationHours={slaDuration} />
                                                    </div>
                                                );
                                            })()}

                                            {/* Zone B: Date Selection */}
                                            <div style={{ 
                                                width: '100%', 
                                                padding: '8px 16px', 
                                                background: '#f8fafc', 
                                                borderRadius: '12px', 
                                                border: '1px solid #e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>รายงานระบุวันที่</div>
                                                <input 
                                                    type="date"
                                                    value={reportDate}
                                                    min={new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                                                    max={new Date().toISOString().split('T')[0]}
                                                    onChange={(e) => setReportDate(e.target.value)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#1e40af',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 900,
                                                        outline: 'none',
                                                        cursor: 'pointer',
                                                        width: '120px'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                            {/* SLA MISMATCH WARNING & BOUNCE BACK */}
                            {selectedTaskInfo.task.estimatedSla && 
                             selectedTaskInfo.task.slaCategory && 
                             selectedTaskInfo.task.estimatedSla !== selectedTaskInfo.task.slaCategory && 
                             (selectedTaskInfo.task.dailyProgress || 0) === 0 && (
                                <div style={{ 
                                    background: '#fff7ed', 
                                    border: '1px solid #fed7aa', 
                                    borderRadius: '12px', 
                                    padding: '1.25rem', 
                                    marginBottom: '2rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <div style={{ background: '#ffedd5', padding: '10px', borderRadius: '12px', color: '#f97316' }}>
                                            <AlertTriangle size={24} />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: '0 0 4px 0', color: '#9a3412', fontSize: '0.95rem', fontWeight: 900 }}>SLA ไม่ตรงตามที่คาดการณ์</h4>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#c2410c', fontWeight: 500 }}>
                                                คุณขอ: <span style={{ fontWeight: 800 }}>{selectedTaskInfo.task.estimatedSla}</span> | 
                                                แอดมินระบุ: <span style={{ fontWeight: 800 }}>{selectedTaskInfo.task.slaCategory}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleBounceBackSLA(selectedTaskInfo.wo.id, selectedTaskInfo.categoryId, selectedTaskInfo.task.id)}
                                        disabled={isSubmitting}
                                        style={{
                                            background: '#ef4444',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '10px 18px',
                                            borderRadius: '10px',
                                            fontSize: '0.85rem',
                                            fontWeight: 800,
                                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <XCircle size={18} /> ตีกลับให้ประเมินใหม่
                                    </button>
                                </div>
                            )}

                            <section style={{ marginBottom: '2.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20} color="#3b82f6" /> การจัดการคนงาน (Labor)</h3>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {selectedTaskInfo.task.history?.some(h => (h.date?.split('T')[0]) === reportDate) && (
                                            <button 
                                                onClick={() => setIsEditingExisting(!isEditingExisting)}
                                                style={{ 
                                                    padding: '6px 12px', 
                                                    borderRadius: '8px', 
                                                    border: `1px solid ${isEditingExisting ? '#10b981' : '#6366f1'}`, 
                                                    background: isEditingExisting ? '#f0fdf4' : '#fff', 
                                                    color: isEditingExisting ? '#10b981' : '#6366f1', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 800, 
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {isEditingExisting ? (
                                                    <><CheckCircle2 size={14} /> กำลังแก้ไข...</>
                                                ) : (
                                                    <><Edit2 size={14} /> แก้ไขข้อมูล</>
                                                )}
                                            </button>
                                        )}
                                        {isEditingExisting && (
                                            <>
                                                <button onClick={() => setActiveModal('Internal')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> คนงานบริษัท (Internal)</button>
                                                <button onClick={() => setActiveModal('Outsource')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> คนงานผู้รับเหมา (Subio)</button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {labor.length === 0 ? <div style={{ padding: '2rem', textAlign: 'center', border: '2px dashed #e2e8f0', borderRadius: '20px', color: '#94a3b8' }}>ยังไม่มีข้อมูลแรงงาน</div> : labor.map(l => (
                                        <div key={l.id} style={{ padding: '16px', borderRadius: '16px', background: '#fff', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: l.membership === 'Internal' ? '#eff6ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{l.membership === 'Internal' ? <User size={22} color="#2563eb" /> : <HardHat size={22} color="#059669" />}</div>
                                                    <div><div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>{l.staffName || l.affiliation}</div><div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>{l.membership === 'Internal' ? 'คนงานบริษัท (Internal)' : 'ทีมงานผู้รับเหมา (Subio)'}</div></div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    {l.membership === 'Outsource' && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>จำนวน (คน)</span>
                                                            <input type="number" min="1" value={l.amount} onChange={(e) => setLabor(labor.map(item => item.id === l.id ? { ...item, amount: Math.max(1, parseInt(e.target.value) || 1) } : item))} disabled={!isEditingExisting} style={{ width: '60px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 8px', fontSize: '0.9rem', fontWeight: 700, outline: 'none', textAlign: 'center', color: '#15803d' }} />
                                                        </div>
                                                    )}
                                                    {isEditingExisting && (
                                                        <button onClick={() => setLabor(labor.filter(item => item.id !== l.id))} style={{
                                                            background: '#fff',
                                                            border: '1px solid #eff6ff',
                                                            borderRadius: '50%',
                                                            width: '36px', height: '36px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            cursor: 'pointer', color: '#ef4444', transition: 'all 0.2s', padding: 0,
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                                        }}
                                                            onMouseOver={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                                            onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#ef4444'; }}
                                                        >
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9', opacity: isEditingExisting ? 1 : 0.7, pointerEvents: isEditingExisting ? 'auto' : 'none' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div onClick={() => toggleShift(l.id, 'normal')} style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid #2563eb', background: l.shifts?.normal ? '#2563eb' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{l.shifts?.normal && <CheckCircle2 size={12} color="#fff" />}</div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Day (ปกติ)</span>
                                                    {l.shifts?.normal && l.membership === 'Internal' && renderTimeInput(l.id, 'normal', l.shiftTimes?.day || '08:00 - 17:00')}
                                                </div>
                                                <div style={{ width: 1, height: 24, background: '#cbd5e1' }} />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b' }}>OT:</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div onClick={() => toggleShift(l.id, 'otMorning')} style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid #f59e0b', background: l.shifts?.otMorning ? '#f59e0b' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{l.shifts?.otMorning && <CheckCircle2 size={12} color="#fff" />}</div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>เช้า</span>
                                                    {l.shifts?.otMorning && l.membership === 'Internal' && renderTimeInput(l.id, 'otMorning', l.shiftTimes?.otMorning || '06:00 - 08:00')}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div onClick={() => toggleShift(l.id, 'otNoon')} style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid #f59e0b', background: l.shifts?.otNoon ? '#f59e0b' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{l.shifts?.otNoon && <CheckCircle2 size={12} color="#fff" />}</div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>เที่ยง</span>
                                                    {l.shifts?.otNoon && l.membership === 'Internal' && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}><Clock size={12} /> 12:00 - 13:00 (1 ชม.)</div>}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div onClick={() => toggleShift(l.id, 'otEvening')} style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid #f59e0b', background: l.shifts?.otEvening ? '#f59e0b' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{l.shifts?.otEvening && <CheckCircle2 size={12} color="#fff" />}</div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>เย็น</span>
                                                    {l.shifts?.otEvening && l.membership === 'Internal' && renderTimeInput(l.id, 'otEvening', l.shiftTimes?.otEvening || '18:00 - 21:00')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={20} color="#10b981" /> ความคืบหน้า</h3>
                                    <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                                            <div style={{ flex: 1, position: 'relative', opacity: isEditingExisting ? 1 : 0.6, pointerEvents: isEditingExisting ? 'auto' : 'none', transition: 'all 0.3s' }}>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="5"
                                                    value={progress}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        setProgress(Math.min(progressBounds.max, Math.max(progressBounds.min, val)));
                                                    }}
                                                    style={{ 
                                                        width: '100%', 
                                                        height: '10px', 
                                                        borderRadius: '6px', 
                                                        appearance: 'none', 
                                                        background: `linear-gradient(to right, #475569 0%, #475569 ${progressBounds.min}%, #3b82f6 ${progressBounds.min}%, #3b82f6 ${progress}%, #e2e8f0 ${progress}%, #e2e8f0 100%)`, 
                                                        cursor: 'pointer', 
                                                        outline: 'none',
                                                        transition: 'all 0.2s'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ position: 'relative', width: '100px' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={progress}
                                                    disabled={!isEditingExisting}
                                                    onChange={(e) => setProgress(Math.min(progressBounds.max, Math.max(progressBounds.min, parseInt(e.target.value) || 0)))}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 30px 8px 12px',
                                                        borderRadius: '10px',
                                                        border: '1px solid #3b82f6',
                                                        fontSize: '1rem',
                                                        fontWeight: 900,
                                                        color: '#1e40af',
                                                        textAlign: 'center',
                                                        outline: 'none',
                                                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.1)'
                                                    }}
                                                />
                                                <span style={{ position: 'absolute', right: '10px', top: '51%', transform: 'translateY(-50%)', fontSize: '0.8rem', fontWeight: 800, color: '#3b82f6' }}>%</span>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: progress <= progressBounds.min || progress > progressBounds.max ? '#ef4444' : '#64748b' }}>
                                                {(() => {
                                                    const hasDataOnDate = selectedTaskInfo?.task.history?.some(h => (h.date?.split('T')[0]) === reportDate);
                                                    if (hasDataOnDate && !isEditingExisting) {
                                                        return `* รายงานนี้ถูกบันทึกไว้แล้วที่ ${progress}%`;
                                                    }
                                                    if (reportDate === new Date().toISOString().split('T')[0]) {
                                                        return `* ความคืบหน้าปัจจุบันต้องระบุมากกว่า ${progressBounds.min}%`;
                                                    }
                                                    return `* สำหรับวันที่เลือก ต้องระบุระหว่าง ${progressBounds.min + 1}% ถึง ${progressBounds.max}%`;
                                                })()}
                                            </div>
                                            {isEditingExisting && progress > 0 && <button onClick={() => setProgress(0)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>ล้างค่า</button>}
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1rem', pointerEvents: isEditingExisting ? 'auto' : 'none', opacity: isEditingExisting ? 1 : 0.6 }}>
                                            {[0, 25, 50, 75, 100].map(v => {
                                                const isLocked = v < progressBounds.min || v > progressBounds.max;
                                                return (
                                                <button
                                                    key={v}
                                                    onClick={() => setProgress(v)}
                                                    disabled={isLocked}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 0',
                                                        borderRadius: '8px',
                                                        border: '1px solid',
                                                        borderColor: progress === v ? '#3b82f6' : '#e2e8f0',
                                                        background: progress === v ? '#eff6ff' : isLocked ? '#f1f5f9' : '#fff',
                                                        color: progress === v ? '#2563eb' : isLocked ? '#94a3b8' : '#64748b',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 800,
                                                        cursor: isLocked ? 'not-allowed' : 'pointer',
                                                        transition: 'all 0.2s',
                                                        opacity: isLocked ? 0.6 : 1,
                                                        textDecoration: isLocked ? 'line-through' : 'none'
                                                    }}
                                                >
                                                    {v === 0 ? 'ล้าง' : v === 100 ? 'เสร็จสิ้น' : `${v}%`}
                                                </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {progress === 100 && reportDate !== new Date().toISOString().split('T')[0] && (
                                        <div style={{ marginTop: '1rem', padding: '12px', background: '#fff7ed', borderRadius: '12px', fontSize: '0.75rem', color: '#c2410c', fontWeight: 700, display: 'flex', gap: '8px', border: '1px solid #ffedd5' }}>
                                            <AlertCircle size={14} /> <span>ข้อควรระวัง: การลงปิดงาน (100%) ย้อนหลัง ควรทำเฉพาะในกรณีที่ไม่มีรายงานของวันถัดไป</span>
                                        </div>
                                    )}
                                    {progress === 100 && reportDate === new Date().toISOString().split('T')[0] && <div style={{ marginTop: '1rem', padding: '12px', background: '#eff6ff', borderRadius: '12px', fontSize: '0.75rem', color: '#1e40af', fontWeight: 700, display: 'flex', gap: '8px' }}><Info size={14} /> <span>ยืนยันที่ 100% ระบบจะใช้รูปภาพเป็นรูป "หลังซ่อม"</span></div>}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    {/* Column 1: Work Progress Photos */}
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Camera size={20} color="#3b82f6" /> รูปภาพหน้างาน</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                                            {isEditingExisting && (
                                                <label style={{ height: 100, border: '2px dashed #3b82f6', borderRadius: 16, background: '#eff6ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.6 : 1 }}>
                                                    {isUploading ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 900, marginTop: 4 }}>{isUploading ? 'กำลังโหลด' : 'ถ่ายรูปหน้างาน'}</span>
                                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={isUploading} />
                                                </label>
                                            )}
                                            {photos.map((p, i) => (
                                                <div key={i} style={{ position: 'relative', height: 100, borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                    <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    {isEditingExisting && (
                                                        <button onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 4, padding: 2, cursor: 'pointer' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {photos.length === 0 && <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} /> ต้องมีรูปภาพอย่างน้อย 1 รูป</div>}
                                    </div>

                                    {/* Column 2: Labor Proof Photos */}
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20} color="#15803d" /> รูปถ่ายแรงงาน</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                                            {isEditingExisting && (
                                                <label style={{ height: 100, border: '2px dashed #15803d', borderRadius: 16, background: '#f0fdf4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#15803d', cursor: isLaborUploading ? 'not-allowed' : 'pointer', opacity: isLaborUploading ? 0.6 : 1 }}>
                                                    {isLaborUploading ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 900, marginTop: 4 }}>{isLaborUploading ? 'กำลังโหลด' : 'ถ่ายรูปคนงาน'}</span>
                                                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleLaborPhotoUpload} disabled={isLaborUploading} />
                                                </label>
                                            )}
                                            {laborPhotos.map((p, i) => (
                                                <div key={i} style={{ position: 'relative', height: 100, borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                    <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    {isEditingExisting && (
                                                        <button onClick={() => setLaborPhotos(laborPhotos.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 4, padding: 2, cursor: 'pointer' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {laborPhotos.length === 0 && <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} /> ต้องมีรูปยืนยันคนงานอย่างน้อย 1 รูป</div>}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '2.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>หมายเหตุ (Site Notes)</h3>
                                    
                                    {/* Problem Toggle */}
                                    <div 
                                        onClick={() => isEditingExisting && setReportType(prev => prev === 'Problem' ? 'Update' : 'Problem')}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '10px', 
                                            padding: '8px 16px', 
                                            borderRadius: '12px',
                                            background: reportType === 'Problem' ? '#fef2f2' : '#f8fafc',
                                            border: reportType === 'Problem' ? '1px solid #ef4444' : '1px solid #e2e8f0',
                                            cursor: isEditingExisting ? 'pointer' : 'default',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ 
                                            width: '40px', 
                                            height: '22px', 
                                            background: reportType === 'Problem' ? '#ef4444' : '#cbd5e1', 
                                            borderRadius: '20px', 
                                            position: 'relative',
                                            transition: 'all 0.3s'
                                        }}>
                                            <div style={{ 
                                                width: '16px', 
                                                height: '16px', 
                                                background: '#fff', 
                                                borderRadius: '50%', 
                                                position: 'absolute', 
                                                top: '3px',
                                                left: reportType === 'Problem' ? '21px' : '3px',
                                                transition: 'all 0.3s',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                            }} />
                                        </div>
                                        <span style={{ 
                                            fontSize: '0.85rem', 
                                            fontWeight: 800, 
                                            color: reportType === 'Problem' ? '#ef4444' : '#64748b' 
                                        }}>
                                            {reportType === 'Problem' ? '🚨 พบปัญหาหน้างาน' : 'สถานะปกติ'}
                                        </span>
                                    </div>
                                </div>
                                <textarea 
                                    placeholder={reportType === 'Problem' ? "ระบุรายละเอียดปัญหาที่พบ..." : "ระบุรายละเอียดเพิ่มเติม..."}
                                    disabled={!isEditingExisting}
                                    style={{ 
                                        width: '100%', 
                                        padding: '1rem', 
                                        borderRadius: '16px', 
                                        border: reportType === 'Problem' ? '2px solid #ef4444' : '1px solid #e2e8f0', 
                                        background: reportType === 'Problem' ? '#fff' : '#f8fafc', 
                                        fontSize: '0.9rem', 
                                        outline: 'none', 
                                        minHeight: '100px',
                                        transition: 'all 0.2s'
                                    }} 
                                    value={note} 
                                    onChange={e => setNote(e.target.value)} 
                                />
                            </div>

                            {/* Work History Timeline (Previous Logs) */}
                            {selectedTaskInfo.task.history && selectedTaskInfo.task.history.length > 0 && (
                                <div style={{ marginTop: '2.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Activity size={20} color="#6366f1" /> ประวัติการปฏิบัติงาน (Work History)
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {[...(selectedTaskInfo.task.history || [])]
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map((h) => {
                                                    const totalManpower = h.labor.reduce((acc: number, l: any) => acc + l.amount, 0);
                                                    return (
                                                        <div 
                                                            key={h.id} 
                                                            onClick={() => setReportDate(h.date.split('T')[0])}
                                                    style={{ 
                                                        padding: '16px', 
                                                        borderRadius: '16px', 
                                                        background: (h.date.split('T')[0]) === reportDate ? '#eff6ff' : (h.type === 'Problem' ? '#fef2f2' : '#fff'), 
                                                        border: `2px solid ${(h.date.split('T')[0]) === reportDate ? '#3b82f6' : (h.type === 'Problem' ? '#fecaca' : '#e2e8f0')}`, 
                                                        boxShadow: (h.date.split('T')[0]) === reportDate ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        transform: (h.date.split('T')[0]) === reportDate ? 'translateY(-2px)' : 'none'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 900, color: h.type === 'Problem' ? '#ef4444' : '#1e293b' }}>
                                                                {h.type === 'Problem' && '🚨 '}
                                                                {new Date(h.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: h.type === 'Problem' ? '#ef4444' : '#6366f1', background: h.type === 'Problem' ? '#fee2e2' : '#eef2ff', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                                                Progress: {h.progress}%
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
                                                            <Users size={12} style={{ marginRight: '4px' }} /> {totalManpower} คน
                                                        </div>
                                                    </div>
                                                    {h.note && (
                                                        <div style={{ 
                                                            fontSize: '0.85rem', 
                                                            color: h.type === 'Problem' ? '#b91c1c' : '#475569', 
                                                            marginBottom: '12px', 
                                                            background: h.type === 'Problem' ? '#fff' : '#f8fafc', 
                                                            padding: '10px', 
                                                            borderRadius: '10px', 
                                                            borderLeft: `3px solid ${h.type === 'Problem' ? '#ef4444' : '#6366f1'}`,
                                                            fontWeight: h.type === 'Problem' ? 700 : 400
                                                        }}>
                                                            {h.type === 'Problem' && <div style={{ marginBottom: '4px', fontWeight: 900 }}>รายงานปัญหาจากหน้างาน:</div>}
                                                            {h.note}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                        {h.labor.map((l, lIdx) => (
                                                            <span key={lIdx} style={{ fontSize: '0.7rem', color: '#4b5563', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                                                {l.staffName || l.affiliation}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer: Standardized Close Button & Submit */}
                        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                onClick={() => setSelectedTaskInfo(null)}
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
                            <div style={{ flex: 1 }}></div>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || isUploading}
                                style={{
                                    padding: '12px 32px', borderRadius: '14px', border: 'none',
                                    background: (isSubmitting || isUploading) ? '#94a3b8' : '#2563eb',
                                    color: '#fff', fontWeight: 900, cursor: (isSubmitting || isUploading) ? 'not-allowed' : 'pointer',
                                    boxShadow: (isSubmitting || isUploading) ? 'none' : '0 4px 6px rgba(37, 99, 235, 0.2)',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                {(isSubmitting || isUploading) && <Loader2 className="animate-spin" size={20} />}
                                {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการส่งรายงาน'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DailyReport;
