import { useState, useMemo, useEffect, useRef } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useWorkOrders } from '../context/WorkOrderContext';
import { MasterTask, WorkOrder, LaborRecord, TaskUpdate, Project, Contractor } from '../types';
import { Search, Building2, HardHat, Camera, CheckCircle2, User, Users, Plus, Info, AlertCircle, AlertTriangle, XCircle, LayoutDashboard, Clock, MapPin, Package, Bell, CheckSquare, Square, Loader2, Activity, Edit2, Trash2, Paperclip, Eye, ChevronLeft, ChevronRight, Calendar, Lock, TrendingUp, FileText, QrCode, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TaskReviewModal from '../components/TaskReviewModal';
import CustomerInspectionMockup from '../components/CustomerInspectionMockup';
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
    const [searchQuery, setSearchQuery] = useState('');

    const filteredItems = useMemo(() => {
        if (!searchQuery) return availableItems;
        const query = searchQuery.toLowerCase();
        return availableItems.filter(item => 
            (item.name || '').toLowerCase().includes(query) || 
            (item.employeeId || '').toLowerCase().includes(query)
        );
    }, [availableItems, searchQuery]);

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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>เลือก{type === 'Internal' ? 'คนงานบริษัท' : 'ผู้รับเหมา'}</h3>
                        <div style={{
                            background: selectedIds.length > 0 ? '#eff6ff' : '#f8fafc',
                            color: selectedIds.length > 0 ? '#2563eb' : '#64748b',
                            border: '1px solid',
                            borderColor: selectedIds.length > 0 ? '#bfdbfe' : '#e2e8f0',
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: selectedIds.length > 0 ? '0 2px 4px rgba(37, 99, 235, 0.08)' : 'none',
                            transition: 'all 0.2s ease-in-out',
                            whiteSpace: 'nowrap'
                        }}>
                            {selectedIds.length > 0 ? (
                                <>
                                    เลือกแล้ว <span style={{ color: '#1d4ed8', fontSize: '0.95rem', fontWeight: 900 }}>{selectedIds.length}</span> คน
                                </>
                            ) : (
                                'ยังไม่ได้เลือก'
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="ค้นหาคนงาน..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '10px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.8rem',
                                outline: 'none',
                                width: '180px',
                                fontWeight: 700,
                                transition: 'border-color 0.2s'
                            }}
                        />
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem', minHeight: '300px' }}>
                        {filteredItems.length === 0 ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>ไม่พบรายการ</div>
                        ) : (
                            filteredItems.map(item => {
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
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                                            {item.employeeId ? `[${item.employeeId}] ` : ''}{item.name}
                                        </span>
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
    const { 
        workOrders, 
        addTaskUpdate, 
        updateTask, 
        updateWorkOrderStatus, 
        requestRetroactiveUnlock,
        generateDeliveryQrToken,
        submitCustomerInspection
    } = useWorkOrders();
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
    
    // Categorized Photo States
    const [sitePhotos, setSitePhotos] = useState<string[]>([]);
    const [laborRegularPhotos, setLaborRegularPhotos] = useState<string[]>([]);
    const [laborOtMorningPhotos, setLaborOtMorningPhotos] = useState<string[]>([]);
    const [laborOtNoonPhotos, setLaborOtNoonPhotos] = useState<string[]>([]);
    const [laborOtEveningPhotos, setLaborOtEveningPhotos] = useState<string[]>([]);
    const [activePhotoTab, setActivePhotoTab] = useState<'site' | 'regular' | 'otMorning' | 'otNoon' | 'otEvening'>('site');
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    // UI and Custom Calendar states
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [pendingUnlockDate, setPendingUnlockDate] = useState('');
    const [unlockReason, setUnlockReason] = useState('');
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

    const [isEditingExisting, setIsEditingExisting] = useState(false); // ✅ New state for Edit Mode
    const [showSummaryModal, setShowSummaryModal] = useState(false); // ✅ State to control summary modal popup
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingLeaveCertId, setUploadingLeaveCertId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const [activeModal, setActiveModal] = useState<'Internal' | 'Outsource' | null>(null);
    const [timePickerTarget, setTimePickerTarget] = useState<{ id: string, type: 'start' | 'end', shift: 'normal' | 'otMorning' | 'otEvening' | 'leave', currentValue: string } | null>(null);
    const [reportType, setReportType] = useState<TaskUpdate['type']>('Update');
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

    // ✅ Real-time Sync Data from Firestore
    const [realContractors, setRealContractors] = useState<Contractor[]>([]);
    const [realProjects, setRealProjects] = useState<Project[]>([]);
    const [dailyContractors, setDailyContractors] = useState<any[]>([]);
    const [modalAlert, setModalAlert] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'info' | 'warning' | 'error';
    } | null>(null);

    // Task Review Modal states
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewTaskInfo, setReviewTaskInfo] = useState<{ task: MasterTask; wo: WorkOrder } | null>(null);

    // Simulated Customer Inspection Portal States
    const [isCustomerMockupOpen, setIsCustomerMockupOpen] = useState(false);
    const [mockupWorkOrder, setMockupWorkOrder] = useState<WorkOrder | null>(null);

    useEffect(() => {
        const unsubContractors = onSnapshot(collection(db, 'contractors'), (snap) => {
            setRealContractors(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Contractor));
        });
        const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
            setRealProjects(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Project));
        });
        const unsubDailyContractors = onSnapshot(collection(db, 'dailyContractors'), (snap) => {
            setDailyContractors(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });
        return () => {
            unsubContractors();
            unsubProjects();
            unsubDailyContractors();
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
            
            // Reconstruct/merge split labor and leave arrays back into unified labor state
            const mergedLabor: LaborRecord[] = [];
            const laborMap = new Map<string, any>();
            const leaveMap = new Map<string, any>();

            if (existingReport.labor) {
                existingReport.labor.forEach((l: any) => laborMap.set(l.workerId || l.id, l));
            }
            const exLeave = (existingReport as any).leave;
            if (exLeave) {
                exLeave.forEach((l: any) => leaveMap.set(l.workerId || l.id, l));
            }

            const allWorkerIds = Array.from(new Set([...laborMap.keys(), ...leaveMap.keys()]));
            allWorkerIds.forEach((wId) => {
                const l = laborMap.get(wId);
                const lv = leaveMap.get(wId);
                const isInternal = wId.startsWith('DC-') || (l && !l.contractorId) || (lv && !lv.contractorId);
                
                mergedLabor.push({
                    id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    membership: isInternal ? 'Internal' : 'Outsource',
                    staffId: wId,
                    staffName: l?.staffName || l?.workerName || lv?.staffName || lv?.workerName || '',
                    employeeId: l?.employeeId || lv?.employeeId || '',
                    affiliation: l?.staffName || l?.workerName
                        ? (isInternal ? (l?.staffName || l?.workerName || 'General') : (l?.staffName || l?.workerName || 'General'))
                        : (lv?.staffName || lv?.workerName || 'General'),
                    amount: Number(l?.amount) || 1,
                    timeType: 'Normal',
                    shifts: {
                        normal: l?.shifts?.normal || false,
                        otMorning: l?.shifts?.otMorning || false,
                        otNoon: l?.shifts?.otNoon || false,
                        otEvening: l?.shifts?.otEvening || false
                    },
                    shiftTimes: {
                        day: l?.shiftTimes?.day || '08:00 - 17:00',
                        otMorning: l?.shiftTimes?.otMorning || '06:00 - 08:00',
                        otNoon: '12:00 - 13:00',
                        otEvening: l?.shiftTimes?.otEvening || '18:00 - 21:00'
                    },
                    leave: {
                        active: lv?.leaveShifts?.custom || false,
                        time: lv?.leaveTimes?.custom || '08:00 - 17:00',
                        medCertFileUrl: lv?.medCertFileUrl || ''
                    }
                });
            });

            setLabor(mergedLabor);

            // Decode legacy vs structured photos (backward-compatible with LB structure)
            const mapRegularFromDb = (dbShift: any): string[] => {
                if (!dbShift) return [];
                if (Array.isArray(dbShift)) return [dbShift[0] || '', dbShift[1] || '', dbShift[2] || '', dbShift[3] || ''];
                return [dbShift.in || '', dbShift.lunch || '', dbShift.afternoon || '', dbShift.out || ''];
            };
            const mapOtShiftFromDb = (dbShift: any): string[] => {
                if (!dbShift) return [];
                if (Array.isArray(dbShift)) return [dbShift[0] || '', dbShift[1] || ''];
                return [dbShift.in || '', dbShift.out || ''];
            };
            if (existingReport.photos && !Array.isArray(existingReport.photos)) {
                // Structured object format (new / LB-compatible)
                const pObj = existingReport.photos as any;
                setSitePhotos(pObj.site || []);
                setLaborRegularPhotos(mapRegularFromDb(pObj.laborByShift?.regular));
                setLaborOtMorningPhotos(mapOtShiftFromDb(pObj.laborByShift?.otMorning));
                setLaborOtNoonPhotos(mapOtShiftFromDb(pObj.laborByShift?.otNoon));
                setLaborOtEveningPhotos(mapOtShiftFromDb(pObj.laborByShift?.otEvening));
            } else {
                // Legacy array format
                const pArr = (existingReport.photos || []) as string[];
                setSitePhotos(pArr);
                setLaborRegularPhotos(existingReport.laborPhotos || []);
                setLaborOtMorningPhotos([]);
                setLaborOtNoonPhotos([]);
                setLaborOtEveningPhotos([]);
            }
            setActivePhotoTab('site');
            setIsEditingExisting(false); // ✅ Reset to locked mode when switching dates
        } else {
            // Reset form for a new entry on this date, defaulting to the latest valid progress
            const history = selectedTaskInfo.task.history || [];
            const filteredHistory = selectedTaskInfo.task.revisionCreatedAt
                ? history.filter(h => h.date && h.date > selectedTaskInfo.task.revisionCreatedAt)
                : history;
            let min = 0;
            filteredHistory.forEach(h => {
                const hDate = h.date?.split('T')[0] || '';
                if (hDate && hDate < reportDate && h.progress > min) {
                    min = h.progress;
                }
            });
            setProgress(min); 
            setNote('');
            setLabor([]);
            setSitePhotos([]);
            setLaborRegularPhotos([]);
            setLaborOtMorningPhotos([]);
            setLaborOtNoonPhotos([]);
            setLaborOtEveningPhotos([]);
            setActivePhotoTab('site');
            setIsEditingExisting(true); // ✅ New days are always open for editing
        }
    }, [reportDate, selectedTaskInfo?.task.id]);

    // ✅ Track Page View
    useEffect(() => {
        if (user) {
            logService.trackPageView(user, 'REPORTING', 'หน้าส่งงานรายวัน (Daily Report)');
        }
    }, [user]);

    const { newTasks, inProgressTasks, pendingInspectionTasks, pendingDeliveryWorkOrders } = useMemo(() => {
        const _newTasks: { task: MasterTask; wo: WorkOrder; categoryId: string }[] = [];
        const _inProgressTasks: { task: MasterTask; wo: WorkOrder; categoryId: string }[] = [];
        const _pendingInspectionTasks: { task: MasterTask; wo: WorkOrder; categoryId: string }[] = [];
        const _pendingDeliveryWOs: { wo: WorkOrder }[] = [];

        workOrders.forEach(wo => {
            // Only show active work orders
            if (['Draft', 'Completed', 'Rejected', 'Cancelled'].includes(wo.status)) return;

            // Track grouping of tasks for this WO
            let totalActiveTasks = 0;
            let completedActiveTasks = 0;
            const woTasksList: { task: MasterTask; wo: WorkOrder; categoryId: string }[] = [];

            wo.categories.forEach(cat => {
                cat.tasks.forEach(task => {
                    if (task.status === 'Pending' || task.status === 'Verified' || task.status === 'Rejected') return;

                    // Role Segregation & Access Control Logic
                    // 1. Is WO Owner? (Can see all tasks in read-only except their own executable ones)
                    const isWoOwner = wo.woOwnerId === user?.id || (user?.employeeId && wo.woOwnerId === user.employeeId) || wo.reporterId === user?.id || (user?.employeeId && wo.reporterId === user.employeeId);
                    
                    // 2. Is specific Subtask Operator?
                    const isSubtaskOperator = task.subtaskOperatorId === user?.id || 
                        (user?.employeeId && task.subtaskOperatorId === user.employeeId) ||
                        task.responsibleStaffIds?.includes(foremanId);

                    const isAssigned = user?.role === 'Admin' ||
                        user?.role === 'Manager' ||
                        isWoOwner ||
                        isSubtaskOperator ||
                        (wo.reporterId === user?.id && task.status === 'Approved' && (!task.responsibleStaffIds || task.responsibleStaffIds.length === 0));

                    if (isAssigned) {
                        const filteredHistory = task.revisionCreatedAt
                            ? (task.history || []).filter(h => h.date && h.date > task.revisionCreatedAt)
                            : (task.history || []);
                        const historyMax = filteredHistory.reduce((max, h) => Math.max(max, h.progress), 0) || 0;
                        const actualProgress = Math.max(task.dailyProgress || 0, historyMax);
                        
                        // Flag task if the current foreman is only allowed Read-Only (WO Owner but not subtask operator)
                        const isReadOnly = !isSubtaskOperator && isWoOwner && user?.role !== 'Admin' && user?.role !== 'Manager';

                        const item = { 
                            task: { ...task, dailyProgress: actualProgress, isReadOnly }, 
                            wo, 
                            categoryId: cat.id 
                        };

                        if (searchTerm) {
                            const match = (task.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                         (wo.locationName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                         (wo.id || '').toLowerCase().includes(searchTerm.toLowerCase());
                            if (!match) return;
                        }

                        totalActiveTasks++;
                        if (actualProgress === 100) {
                            completedActiveTasks++;
                        }
                        woTasksList.push(item);
                    }
                });
            });

            // WO Grouping Logic: If ALL tasks in the WO are at 100% progress and WO isn't already delivering
            const isWoOwner = wo.woOwnerId === user?.id || (user?.employeeId && wo.woOwnerId === user.employeeId) || wo.reporterId === user?.id || (user?.employeeId && wo.reporterId === user.employeeId);
            
            if (totalActiveTasks > 0 && completedActiveTasks === totalActiveTasks && isWoOwner && wo.status !== 'pending_delivery') {
                // Add to Pending Delivery list
                _pendingDeliveryWOs.push({ wo });
            } else {
                // Distribute tasks normally
                woTasksList.forEach(item => {
                    if (item.task.dailyProgress === 100) {
                        _pendingInspectionTasks.push(item);
                    } else if (item.task.dailyProgress > 0) {
                        _inProgressTasks.push(item);
                    } else {
                        _newTasks.push(item);
                    }
                });
            }
        });

        return { 
            newTasks: _newTasks, 
            inProgressTasks: _inProgressTasks, 
            pendingInspectionTasks: _pendingInspectionTasks,
            pendingDeliveryWorkOrders: _pendingDeliveryWOs
        };
    }, [workOrders, searchTerm, foremanId, user?.role, user?.employeeId, user?.id]);

    // ✅ Deep Link: Open Work Order if ID is in URL with Completed/Inactive Verification (Case C)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const workOrderId = params.get('id');

        if (workOrderId && workOrders.length > 0) {
            // Find task in either newTasks, inProgressTasks, or pendingInspectionTasks
            const item = newTasks.find(n => n.wo.id === workOrderId) || 
                         inProgressTasks.find(i => i.wo.id === workOrderId) ||
                         pendingInspectionTasks.find(p => p.wo.id === workOrderId);
            
            if (item) {
                setHighlightedId(workOrderId);
                // Call handleSelectTask with the found info
                handleSelectTask(item.task, item.wo, item.categoryId);
            } else {
                // If not found in active lists, search the actual workOrder status for a custom premium warning
                const wo = workOrders.find(w => w.id === workOrderId);
                if (wo) {
                    let message = '';
                    let title = 'ใบสั่งงานไม่พร้อมสำหรับการรายงาน';
                    let type: 'success' | 'info' | 'warning' | 'error' = 'info';

                    if (wo.status === 'Completed') {
                        message = 'งานในใบงานนี้ได้รับการรายงานความคืบหน้าครบถ้วนและเสร็จสิ้นเรียบร้อยแล้ว';
                        title = 'ใบสั่งงานเสร็จสิ้นแล้ว';
                        type = 'success';
                    } else if (wo.status === 'Cancelled') {
                        message = 'ใบสั่งงานนี้ถูกยกเลิกการดำเนินงานแล้ว';
                        title = 'ใบสั่งงานถูกยกเลิก';
                        type = 'error';
                    } else if (wo.status === 'Rejected') {
                        message = 'ใบสั่งงานนี้ถูกปฏิเสธโดยแอดมิน กรุณาเข้าหน้า \'ใบงานและติดตามผล\' เพื่อทำการแก้ไขและส่งใหม่';
                        title = 'ใบสั่งงานถูกปฏิเสธการประเมิน';
                        type = 'warning';
                    } else if (wo.status === 'Draft') {
                        message = 'ใบสั่งงานนี้ยังคงอยู่ในสถานะแบบร่าง กรุณาส่งใบงานเพื่อรับการประเมินจากแอดมิน';
                        title = 'ใบสั่งงานแบบร่าง';
                        type = 'warning';
                    } else if (wo.status === 'Evaluating') {
                        message = 'ใบสั่งงานนี้อยู่ระหว่างขั้นตอนการประเมินโดยแอดมิน หรือยังไม่มีงานประเมินที่ระบุให้คุณรับผิดชอบในขณะนี้';
                        title = 'อยู่ระหว่างการประเมิน';
                        type = 'info';
                    } else {
                        const statusThai: Record<string, string> = {
                            'Pending': 'รออนุมัติ',
                            'Approved': 'อนุมัติแล้ว',
                            'Partially Approved': 'อนุมัติบางส่วน',
                            'In Progress': 'กำลังดำเนินการ',
                            'Verified': 'ตรวจสอบแล้ว'
                        };
                        message = `ไม่พบงานที่พร้อมสำหรับการรายงานความคืบหน้าในระบบ (สถานะปัจจุบันของใบงาน: ${statusThai[wo.status] || wo.status})`;
                        title = 'ไม่สามารถรายงานความคืบหน้าได้';
                        type = 'info';
                    }
                    
                    setModalAlert({
                        isOpen: true,
                        title,
                        message,
                        type
                    });
                } else {
                    setModalAlert({
                        isOpen: true,
                        title: 'ไม่พบใบสั่งงาน',
                        message: 'ไม่พบข้อมูลใบสั่งงานนี้ในระบบ หรือคุณไม่มีสิทธิ์ในการรายงานความคืบหน้าของงานชุดนี้',
                        type: 'error'
                    });
                }
            }
            
            // Clear URL parameters in all cases to prevent alerts looping on page update
            const newParams = new URLSearchParams(location.search);
            newParams.delete('id');
            const newSearch = newParams.toString();
            navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
        }
    }, [location.search, newTasks, inProgressTasks, workOrders, navigate]);

    const handleSelectTask = (task: MasterTask, wo: WorkOrder, categoryId: string) => {
        // ✅ 1. Find the history-based minimum progress for the current date
        const history = task.history || [];
        const todayStr = new Date().toISOString().split('T')[0];
        const filteredHistory = task.revisionCreatedAt
            ? history.filter(h => h.date && h.date > task.revisionCreatedAt)
            : history;
        const historyBeforeToday = filteredHistory
            .filter(h => (h.date?.split('T')[0] || '') < todayStr)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        
        const minP = historyBeforeToday.length > 0 ? historyBeforeToday[0].progress : 0;
        const currentP = task.dailyProgress || 0;

        setSelectedTaskInfo({ task, wo, categoryId });
        // ✅ 2. Force initial progress to be at least minP
        setProgress(currentP < minP ? minP : currentP);
        setNote('');
        setLabor([]);
        setSitePhotos([]);
        setLaborRegularPhotos([]);
        setLaborOtMorningPhotos([]);
        setLaborOtNoonPhotos([]);
        setLaborOtEveningPhotos([]);
        setReportType('Update');
        setReportDate(new Date().toISOString().split('T')[0]);
    };

    const getDateStatus = (dateStr: string, task: MasterTask, wo: WorkOrder) => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (dateStr > todayStr) {
            return 'disabled';
        }
        
        const openingDate = wo.startDate || wo.createdAt || '';
        const openingDateStr = openingDate ? new Date(openingDate).toISOString().split('T')[0] : '';
        if (openingDateStr && dateStr < openingDateStr) {
            return 'disabled';
        }
        
        const reported = task.history?.some(h => (h.date?.split('T')[0]) === dateStr);
        if (reported) {
            return 'reported';
        }
        
        const todayVal = new Date(todayStr).getTime();
        const dateVal = new Date(dateStr).getTime();
        const diffTime = todayVal - dateVal;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const unlocked = task.unlockedDates?.[dateStr] && 
            new Date(task.unlockedDates[dateStr].unlockedUntil).getTime() > Date.now();
            
        if (diffDays <= 3 || unlocked) {
            return 'unlocked';
        }
        
        return 'locked';
    };

    const progressBounds = useMemo(() => {
        if (!selectedTaskInfo) return { min: 0, max: 100, isToday: true };
        const history = selectedTaskInfo.task.history || [];
        const filteredHistory = selectedTaskInfo.task.revisionCreatedAt
            ? history.filter(h => h.date && h.date > selectedTaskInfo.task.revisionCreatedAt)
            : history;
        const targetDate = reportDate; // YYYY-MM-DD
        
        let min = 0;
        let max = 100;
        
        filteredHistory.forEach(h => {
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

    const isReportDatePast3Days = useMemo(() => {
        if (!selectedTaskInfo) return false;
        const todayStr = new Date().toISOString().split('T')[0];
        const todayVal = new Date(todayStr).getTime();
        const dateVal = new Date(reportDate).getTime();
        const diffTime = todayVal - dateVal;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const unlocked = selectedTaskInfo.task.unlockedDates?.[reportDate] && 
            new Date(selectedTaskInfo.task.unlockedDates[reportDate].unlockedUntil).getTime() > Date.now();
        return diffDays > 3 && !unlocked;
    }, [reportDate, selectedTaskInfo?.task.unlockedDates]);

    const isProgressNotePhotosEditable = isEditingExisting && !isReportDatePast3Days;

    const hasHistoryForSelectedDate = useMemo(() => {
        if (!selectedTaskInfo) return false;
        return selectedTaskInfo.task.history?.some(h => (h.date?.split('T')[0]) === reportDate) || false;
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
                const contractor = dailyContractors.find(c => c.id === id);
                if (contractor) {
                    newRecords.push({
                        id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        membership: 'Internal',
                        staffId: contractor.id,
                        staffName: contractor.name,
                        employeeId: contractor.employeeId || contractor.id.replace('DC-', ''),
                        affiliation: contractor.skillId || 'General',
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
                        },
                        leave: {
                            active: false,
                            time: '08:00 - 17:00',
                            medCertFileUrl: ''
                        }
                    });
                }
            });
        } else if (activeModal === 'Outsource') {
            selectedIds.forEach(id => {
                const contractor = realContractors.find(c => c.id === id);
                if (contractor) {
                    newRecords.push({
                        id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        membership: 'Outsource',
                        affiliation: contractor.name,
                        contractorId: contractor.id,
                        employeeId: '',
                        amount: 1,
                        timeType: 'Normal',
                        shifts: {
                            normal: config.day,
                            otMorning: false,
                            otNoon: false,
                            otEvening: false
                        },
                        shiftTimes: { day: '' },
                        leave: {
                            active: false,
                            time: '08:00 - 17:00',
                            medCertFileUrl: ''
                        }
                    });
                }
            });
        }

        setLabor([...labor, ...newRecords]);
        setActiveModal(null);
    };

    const isTimeOverlap = (time1: string, time2: string) => {
        if (!time1 || !time2 || time1.includes('--') || time2.includes('--')) return false;
        const parse = (t: string) => {
            const [start, end] = t.split(' - ').map((s) => {
                const [h, m] = s.split(':').map(Number);
                return h * 60 + (m || 0);
            });
            return { start, end };
        };
        try {
            const t1 = parse(time1);
            const t2 = parse(time2);
            return t1.start < t2.end && t2.start < t1.end;
        } catch (e) {
            return false;
        }
    };

    const toggleShift = (id: string, shiftKey: 'normal' | 'otMorning' | 'otNoon' | 'otEvening') => {
        if (!isEditingExisting) return;
        setLabor(prev => prev.map(l => {
            if (l.id !== id) return l;
            const currentShifts = l.shifts || { normal: false, otMorning: false, otNoon: false, otEvening: false };
            const isActive = !currentShifts[shiftKey];
            let newShiftTimes = { ...(l.shiftTimes || {}) };
            let leaveObj = l.leave ? { ...l.leave } : { active: false, time: '08:00 - 17:00' };

            if (isActive && l.membership === 'Internal') {
                if (shiftKey === 'otMorning' && !newShiftTimes.otMorning) newShiftTimes.otMorning = '06:00 - 08:00';
                if (shiftKey === 'otNoon' && !newShiftTimes.otNoon) newShiftTimes.otNoon = '12:00 - 13:00';
                if (shiftKey === 'otEvening' && !newShiftTimes.otEvening) newShiftTimes.otEvening = '18:00 - 21:00';
            }

            // OT shift: if leave is active, block any OT that overlaps with leave time
            if (isActive && shiftKey !== 'normal' && leaveObj.active) {
                const otDefaultTimes: Record<string, string> = {
                    otMorning: '06:00 - 08:00',
                    otNoon: '12:00 - 13:00',
                    otEvening: '18:00 - 21:00',
                };
                const otTime = (newShiftTimes as Record<string, string>)[shiftKey] || otDefaultTimes[shiftKey] || '';
                if (otTime && isTimeOverlap(otTime, leaveObj.time || '08:00 - 17:00')) {
                    return l; // Block: OT overlaps with leave → ignore the click
                }
            }

            let updatedShifts = { ...currentShifts, [shiftKey]: isActive };

            if (shiftKey === 'normal') {
                if (isActive) {
                    // Smart Adjustment: if normal time overlaps with active leave, adjust normal time to complement leave period
                    const regTime = newShiftTimes.day || '08:00 - 17:00';
                    if (leaveObj.active && isTimeOverlap(regTime, leaveObj.time || '08:00 - 17:00')) {
                        const leaveTime = leaveObj.time || '08:00 - 17:00';
                        if (leaveTime === '08:00 - 12:00') {
                            newShiftTimes.day = '13:00 - 17:00'; // Morning leave → work afternoon
                        } else if (leaveTime === '13:00 - 17:00') {
                            newShiftTimes.day = '08:00 - 12:00'; // Afternoon leave → work morning
                        } else {
                            // Non-standard leave overlap → deactivate leave (cannot auto-adjust)
                            leaveObj.active = false;
                        }
                    }
                } else {
                    // If normal work is unchecked, wipe all OT shifts
                    updatedShifts.otMorning = false;
                    updatedShifts.otNoon = false;
                    updatedShifts.otEvening = false;
                }
            }

            return { ...l, shifts: updatedShifts, shiftTimes: newShiftTimes, leave: leaveObj };
        }));
    };

    const openTimePicker = (id: string, shift: 'normal' | 'otMorning' | 'otEvening' | 'leave', type: 'start' | 'end') => {
        if (!isEditingExisting) return;
        const record = labor.find(l => l.id === id);
        if (!record) return;
        let rangeStr = '';
        if (shift === 'leave') {
            rangeStr = record.leave?.time || '08:00 - 17:00';
        } else if (record.shiftTimes) {
            if (shift === 'normal') rangeStr = record.shiftTimes.day || '08:00 - 17:00';
            else rangeStr = record.shiftTimes[shift] || '';
        }
        if (!rangeStr) rangeStr = '00:00 - 00:00';
        const [start, end] = rangeStr.split(' - ').map(s => s.trim());
        setTimePickerTarget({ id, shift, type, currentValue: (type === 'start' ? start : end) || '00:00' });
    };

    const handleTimeChange = (val: string) => {
        if (!timePickerTarget) return;
        const { id, type, shift } = timePickerTarget;
        setLabor(prev => prev.map(l => {
            if (l.id !== id) return l;

            if (shift === 'leave') {
                const leaveObj = l.leave || { active: true, time: '08:00 - 17:00' };
                let range = leaveObj.time || '08:00 - 17:00';
                let [start, end] = range.split(' - ').map(s => s.trim());
                if (type === 'start') start = val;
                else end = val;
                const newRange = `${start} - ${end}`;

                // Smart Overlap & Auto adjustment logic when leave time changes!
                const updatedLeave = { ...leaveObj, time: newRange };
                let updatedTimes = l.shiftTimes ? { ...l.shiftTimes } : { day: '08:00 - 17:00' };
                let shiftsObj = l.shifts ? { ...l.shifts } : { normal: false, otMorning: false, otNoon: false, otEvening: false };

                // Smart Adjustment for standard half-days
                if (newRange === '08:00 - 12:00') {
                    if (updatedTimes.day === '08:00 - 17:00' && shiftsObj.normal) {
                        updatedTimes.day = '13:00 - 17:00';
                    }
                } else if (newRange === '13:00 - 17:00') {
                    if (updatedTimes.day === '08:00 - 17:00' && shiftsObj.normal) {
                        updatedTimes.day = '08:00 - 12:00';
                    }
                }

                // If it overlaps, auto-deactivate normal work hours
                const regTime = updatedTimes.day || '08:00 - 17:00';
                if (shiftsObj.normal && isTimeOverlap(newRange, regTime)) {
                    shiftsObj.normal = false;
                    // Wipe OT shifts too
                    shiftsObj.otMorning = false;
                    shiftsObj.otNoon = false;
                    shiftsObj.otEvening = false;
                }

                return { ...l, leave: updatedLeave, shiftTimes: updatedTimes, shifts: shiftsObj };
            } else {
                const times = { ...(l.shiftTimes || {}) };
                let range = '';
                if (shift === 'normal') range = times.day || '08:00 - 17:00';
                else range = times[shift] || '00:00 - 00:00';
                let [start, end] = range.split(' - ').map(s => s.trim());
                if (type === 'start') start = val;
                else end = val;
                const newRange = `${start} - ${end}`;

                let shiftsObj = l.shifts ? { ...l.shifts } : { normal: false, otMorning: false, otNoon: false, otEvening: false };
                let leaveObj = l.leave ? { ...l.leave } : { active: false, time: '08:00 - 17:00' };

                if (shift === 'normal') {
                    times.day = newRange;
                    // If regular time overlaps with leave time, auto-uncheck leave
                    if (leaveObj.active && isTimeOverlap(newRange, leaveObj.time || '08:00 - 17:00')) {
                        leaveObj.active = false;
                    }
                } else {
                    times[shift] = newRange;
                }

                return { ...l, shiftTimes: times, shifts: shiftsObj, leave: leaveObj };
            }
        }));
    };

    // Active photo tab cleanup effect when worker shifts change
    useEffect(() => {
        const isRegularActive = labor.some(l => l.shifts?.normal);
        const isOtMorningActive = labor.some(l => l.shifts?.otMorning);
        const isOtNoonActive = labor.some(l => l.shifts?.otNoon);
        const isOtEveningActive = labor.some(l => l.shifts?.otEvening);

        if (activePhotoTab === 'regular' && !isRegularActive) setActivePhotoTab('site');
        if (activePhotoTab === 'otMorning' && !isOtMorningActive) setActivePhotoTab('site');
        if (activePhotoTab === 'otNoon' && !isOtNoonActive) setActivePhotoTab('site');
        if (activePhotoTab === 'otEvening' && !isOtEveningActive) setActivePhotoTab('site');
    }, [labor, activePhotoTab]);

    // Slot-based photo remove: for shift photos, clear the slot (keep array length); for site, filter out.
    const handleRemoveSlotPhoto = (tab: 'site' | 'regular' | 'otMorning' | 'otNoon' | 'otEvening', index: number) => {
        if (tab === 'site') {
            setSitePhotos(prev => prev.filter((_, i) => i !== index));
        } else {
            const clearSlot = (prev: string[]) => { const u = [...prev]; u[index] = ''; return u; };
            if (tab === 'regular') setLaborRegularPhotos(clearSlot);
            else if (tab === 'otMorning') setLaborOtMorningPhotos(clearSlot);
            else if (tab === 'otNoon') setLaborOtNoonPhotos(clearSlot);
            else if (tab === 'otEvening') setLaborOtEveningPhotos(clearSlot);
        }
    };

    // Slot-based photo upload: site appends freely, shift photos go to a specific slot index.
    const handleSlotPhotoUpload = async (
        tab: 'site' | 'regular' | 'otMorning' | 'otNoon' | 'otEvening',
        slotIndex: number,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (!file || !selectedTaskInfo) return;
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `progress_${tab}_slot${slotIndex}_${Date.now()}.${fileExt}`;
            const storagePath = `work_orders/${selectedTaskInfo.wo.id}/progress/${fileName}`;
            const storageRef = ref(storage, storagePath);
            const compressedFile = await compressImage(file, 1280, 0.7);
            const snapshot = await uploadBytes(storageRef, compressedFile, {
                cacheControl: 'public, max-age=31536000',
                contentType: compressedFile.type || 'image/jpeg',
            });
            const downloadURL = await getDownloadURL(snapshot.ref);
            if (tab === 'site') {
                setSitePhotos(prev => [...prev, downloadURL]);
            } else {
                const putSlot = (prev: string[]) => { const u = [...prev]; u[slotIndex] = downloadURL; return u; };
                if (tab === 'regular') setLaborRegularPhotos(putSlot);
                else if (tab === 'otMorning') setLaborOtMorningPhotos(putSlot);
                else if (tab === 'otNoon') setLaborOtNoonPhotos(putSlot);
                else if (tab === 'otEvening') setLaborOtEveningPhotos(putSlot);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            alert('อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleUploadLeaveCert = async (laborId: string, file: File | null) => {
        if (!file || !selectedTaskInfo) return;
        if (uploadingLeaveCertId === laborId) return; // prevent double-upload

        setUploadingLeaveCertId(laborId);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `leave_${laborId}_${Date.now()}.${fileExt}`;
            const storagePath = `work_orders/${selectedTaskInfo.wo.id}/leave_certs/${fileName}`;
            const storageRef = ref(storage, storagePath);

            const compressedFile = await compressImage(file, 1280, 0.7);
            const metadata = {
                cacheControl: 'public, max-age=31536000',
                contentType: compressedFile.type || 'image/jpeg',
            };

            const snapshot = await uploadBytes(storageRef, compressedFile, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setLabor(prev => prev.map(l => {
                if (l.id === laborId) {
                    return {
                        ...l,
                        leave: {
                            ...(l.leave || { active: true, time: '08:00 - 17:00' }),
                            medCertFileUrl: downloadURL
                        }
                    };
                }
                return l;
            }));
        } catch (error) {
            console.error('Leave cert upload failed:', error);
            alert('อัปโหลดใบรับรองแพทย์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setUploadingLeaveCertId(null);
        }
    };

    const handleRemoveLeaveCert = (laborId: string) => {
        setLabor(prev => prev.map(l => {
            if (l.id === laborId) {
                return {
                    ...l,
                    leave: {
                        ...(l.leave || { active: true, time: '08:00 - 17:00' }),
                        medCertFileUrl: ''
                    }
                };
            }
            return l;
        }));
    };

    const handleConfirmReview = async (
        woId: string, 
        categoryId: string, 
        taskId: string, 
        status: 'Verified' | 'Rejected', 
        updates: {
            ownerName?: string;
            rejectReason?: string;
            notes?: string;
            currentRevision?: string;
            evaluationChecklist?: Record<string, number | boolean>;
            overallSatisfaction?: number;
        }
    ) => {
        try {
            const now = new Date().toISOString();
            
            if (status === 'Verified') {
                await updateTask(woId, categoryId, taskId, {
                    status: 'Verified',
                    ownerName: updates.ownerName || '',
                    notes: updates.notes || '',
                    evaluationChecklist: updates.evaluationChecklist || {},
                    overallSatisfaction: updates.overallSatisfaction || 0,
                    updatedAt: now
                });
                
                if (selectedTaskInfo?.task.id === taskId) {
                    setSelectedTaskInfo(null);
                }

                setModalAlert({
                    isOpen: true,
                    title: 'ตรวจรับงานสำเร็จ',
                    message: 'ระบบได้ตรวจรับงานเรียบร้อยแล้ว รายการนี้จะย้ายไปอยู่ในส่วนของประวัติงานย้อนหลัง',
                    type: 'success'
                });
            } else if (status === 'Rejected') {
                await updateTask(woId, categoryId, taskId, {
                    status: 'Rejected',
                    revisionName: updates.rejectReason || '',
                    revisionCreatedAt: now,
                    currentRevision: updates.currentRevision || 'rev01',
                    evaluationChecklist: updates.evaluationChecklist || {},
                    dailyProgress: 0,
                    updatedAt: now
                });

                if (selectedTaskInfo?.task.id === taskId) {
                    setSelectedTaskInfo(null);
                }

                setModalAlert({
                    isOpen: true,
                    title: 'ส่งกลับแก้ไขสำเร็จ',
                    message: `ระบบได้ส่งกลับแก้ไข (ตีกลับ) เรียบร้อยแล้ว โปรเกรสของงานถูกรีเซ็ตเป็น 0% (${updates.currentRevision || 'REV. 01'})`,
                    type: 'warning'
                });
            }
        } catch (error) {
            console.error("Error confirming review:", error);
            setModalAlert({
                isOpen: true,
                title: 'เกิดข้อผิดพลาด',
                message: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
                type: 'error'
            });
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
        if (submittingRef.current || isSubmitting) return;
        if (!selectedTaskInfo) return;
        if (labor.length === 0) return alert('กรุณาระบุข้อมูลแรงงานที่เข้าดำเนินการ');

        // --- Photo validation (ตาม LB: site≥2, regular=4, OT=2) ---
        if (sitePhotos.filter(Boolean).length < 2) return alert('กรุณาแนบรูปถ่ายหน้างานอย่างน้อย 2 รูป');
        const isRegularActive = labor.some(l => l.shifts?.normal);
        if (isRegularActive && laborRegularPhotos.filter(Boolean).length < 4) {
            return alert('กรุณาแนบรูปถ่ายแรงงานกะปกติให้ครบ 4 รูป (เข้า / พักเที่ยง / เข้าบ่าย / ออก)');
        }
        const isOtMorningActive = labor.some(l => l.shifts?.otMorning);
        if (isOtMorningActive && laborOtMorningPhotos.filter(Boolean).length < 2) {
            return alert('กรุณาแนบรูปถ่ายแรงงาน OT เช้าให้ครบ 2 รูป (เข้า / ออก)');
        }
        const isOtNoonActive = labor.some(l => l.shifts?.otNoon);
        if (isOtNoonActive && laborOtNoonPhotos.filter(Boolean).length < 2) {
            return alert('กรุณาแนบรูปถ่ายแรงงาน OT เที่ยงให้ครบ 2 รูป (เข้า / ออก)');
        }
        const isOtEveningActive = labor.some(l => l.shifts?.otEvening);
        if (isOtEveningActive && laborOtEveningPhotos.filter(Boolean).length < 2) {
            return alert('กรุณาแนบรูปถ่ายแรงงาน OT เย็นให้ครบ 2 รูป (เข้า / ออก)');
        }

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
        const history = selectedTaskInfo.task.history || [];
        const filteredHistory = selectedTaskInfo.task.revisionCreatedAt
            ? history.filter(h => h.date && h.date > selectedTaskInfo.task.revisionCreatedAt)
            : history;
        const existingHistory = filteredHistory.find(h => (h.date?.split('T')[0]) === reportDate);
        if (existingHistory && !isEditingExisting) {
            alert(`คุณเคยส่งรายงานของวันที่ ${new Date(reportDate).toLocaleDateString('th-TH')} ไปแล้วในใบงานนี้ หากต้องการแก้ไขกรุณากดปุ่มแก้ไขข้อมูล`);
            return;
        }

        // If all validation passes, show the summary modal instead of submitting immediately
        setShowSummaryModal(true);
    };

    const handleFinalSubmit = async () => {
        if (submittingRef.current || isSubmitting) return;
        if (!selectedTaskInfo) return;

        submittingRef.current = true;
        setIsSubmitting(true);
        try {
            const history = selectedTaskInfo.task.history || [];
            const filteredHistory = selectedTaskInfo.task.revisionCreatedAt
                ? history.filter(h => h.date && h.date > selectedTaskInfo.task.revisionCreatedAt)
                : history;
            const existingHistory = filteredHistory.find(h => (h.date?.split('T')[0]) === reportDate);
            const laborPayload = labor
                .filter((l) => l.shifts?.normal || l.shifts?.otMorning || l.shifts?.otNoon || l.shifts?.otEvening)
                .map((l) => ({
                    membership: l.membership || 'Internal',
                    workerId: l.staffId || l.contractorId || l.id,
                    workerName: l.staffName || l.affiliation || '',
                    staffId: l.staffId || '',
                    staffName: l.staffName || '',
                    contractorId: l.contractorId || '',
                    employeeId: l.employeeId || '',
                    shiftTimes: {
                        day: l.shifts?.normal ? l.shiftTimes?.day || '08:00 - 17:00' : null,
                        otEvening: l.shifts?.otEvening ? l.shiftTimes?.otEvening || '18:00 - 21:00' : null,
                        otMorning: l.shifts?.otMorning ? l.shiftTimes?.otMorning || '06:00 - 08:00' : null,
                        otNoon: l.shifts?.otNoon ? '12:00 - 13:00' : null,
                    },
                    shifts: {
                        normal: l.shifts?.normal || false,
                        otEvening: l.shifts?.otEvening || false,
                        otMorning: l.shifts?.otMorning || false,
                        otNoon: l.shifts?.otNoon || false,
                    },
                    expectedShifts: {
                        normal: l.shifts?.normal || false,
                        otEvening: l.shifts?.otEvening || false,
                        otMorning: l.shifts?.otMorning || false,
                        otNoon: l.shifts?.otNoon || false,
                    },
                    expectedHours: {
                        normal: l.shifts?.normal ? 8 : 0,
                        otMorning: l.shifts?.otMorning ? 2 : 0,
                        otNoon: l.shifts?.otNoon ? 1 : 0,
                        otEvening: l.shifts?.otEvening ? 3 : 0,
                    },
                    amount: l.amount || 1
                }));

            const leavePayload = labor
                .filter((l) => l.leave?.active)
                .map((l) => ({
                    workerId: l.staffId || l.id,
                    workerName: l.staffName || '',
                    employeeId: l.employeeId || '',
                    leaveTimes: {
                        custom: l.leave?.time || '08:00 - 17:00'
                    },
                    leaveShifts: {
                        custom: true
                    },
                    medCertFileUrl: l.leave?.medCertFileUrl || '',
                    leaveType: l.leave?.medCertFileUrl ? 'paid' : 'unpaid'
                }));

            // Structure photos payload — LB-compatible Firestore format
            // regular: string[] (4 slots), OT: { in, out } | null
            const photosPayload = {
                site: sitePhotos.filter(Boolean),
                laborByShift: {
                    regular: laborRegularPhotos.some(Boolean) ? laborRegularPhotos.slice(0, 4) : null,
                    otMorning: (laborOtMorningPhotos[0] || laborOtMorningPhotos[1])
                        ? { in: laborOtMorningPhotos[0] || '', out: laborOtMorningPhotos[1] || '' } : null,
                    otNoon: (laborOtNoonPhotos[0] || laborOtNoonPhotos[1])
                        ? { in: laborOtNoonPhotos[0] || '', out: laborOtNoonPhotos[1] || '' } : null,
                    otEvening: (laborOtEveningPhotos[0] || laborOtEveningPhotos[1])
                        ? { in: laborOtEveningPhotos[0] || '', out: laborOtEveningPhotos[1] || '' } : null,
                }
            };

            const foremanEmpId = user?.employeeId || user?.id || '101527';
            let updatedEditHistory = (existingHistory as any)?.editHistory || [];
            if (isEditingExisting && existingHistory) {
                const prevSnapshot = {
                    labor: (existingHistory as any).labor || [],
                    leave: (existingHistory as any).leave || [],
                    photos: (existingHistory as any).photos || null,
                    note: (existingHistory as any).note || '',
                    progress: (existingHistory as any).progress || 0,
                    serverTimestamp: (existingHistory as any).serverTimestamp || (existingHistory as any).date || ''
                };
                const editRecord = {
                    editedAt: new Date().toISOString(),
                    editedBy: foremanEmpId,
                    snapshot: prevSnapshot
                };
                updatedEditHistory = [...updatedEditHistory, editRecord];
            }

            const isWoaWop = selectedTaskInfo.wo.id.toUpperCase().includes('WOA') || selectedTaskInfo.wo.id.toUpperCase().includes('WOP');
            const updateId = isWoaWop ? reportDate : ((isEditingExisting && existingHistory) ? existingHistory.id : `h-${Date.now()}`);
            const newUpdate: TaskUpdate & { projectLocationId?: string, editHistory?: any[], createdBy?: string, updatedBy?: string, createdAt?: string, updatedAt?: string } = {
                id: updateId,
                date: `${reportDate}T${new Date().toISOString().split('T')[1]}`,
                note,
                progress,
                photos: photosPayload,
                labor: laborPayload as any,
                leave: leavePayload,
                type: reportType,
                projectLocationId: selectedTaskInfo.wo.projectId || '',
                ...(updatedEditHistory.length > 0 ? { editHistory: updatedEditHistory } : {}),
                createdBy: isEditingExisting && existingHistory ? ((existingHistory as any).createdBy || foremanEmpId) : foremanEmpId,
                createdAt: isEditingExisting && existingHistory ? ((existingHistory as any).createdAt || new Date().toISOString()) : new Date().toISOString(),
                updatedBy: foremanEmpId,
                updatedAt: new Date().toISOString()
            };

            await addTaskUpdate(selectedTaskInfo.wo.id, selectedTaskInfo.categoryId, selectedTaskInfo.task.id, newUpdate as any);
            alert('บันทึกรายงานเรียบร้อยแล้ว');

            setShowSummaryModal(false); // ปิดหน้าต่างสรุปข้อมูลเมื่อสำเร็จ

            if (existingHistory) {
                // ✅ กรณีแก้ไขข้อมูลเดิม — คงอยู่ที่หน้าเดิม แค่ปิด Edit Mode
                setIsEditingExisting(false);
            } else {
                // ✅ กรณีส่งรายงานใหม่ — reset ทุกอย่างกลับไปหน้าว่าง
                setSelectedTaskInfo(null);
                setProgress(0);
                setNote('');
                setLabor([]);
                setSitePhotos([]);
                setLaborRegularPhotos([]);
                setLaborOtMorningPhotos([]);
                setLaborOtNoonPhotos([]);
                setLaborOtEveningPhotos([]);
                setReportType('Update');
                setReportDate(new Date().toISOString().split('T')[0]);
            }
        } catch (error) {
            console.error('Submit failed:', error);
            alert('บันทึกรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } finally {
            submittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const handleCancelEdit = () => {
        if (!selectedTaskInfo) return;
        
        const confirmCancel = window.confirm('คุณต้องการยกเลิกการแก้ไขใช่หรือไม่? การเปลี่ยนแปลงทั้งหมดที่ยังไม่ได้บันทึกจะสูญหาย');
        if (!confirmCancel) return;

        // Search for the existing report for this exact date to revert the state
        const history = selectedTaskInfo.task.history || [];
        const filteredHistory = selectedTaskInfo.task.revisionCreatedAt
            ? history.filter(h => h.date && h.date > selectedTaskInfo.task.revisionCreatedAt)
            : history;
        const existingReport = filteredHistory.find(h => (h.date?.split('T')[0]) === reportDate);

        if (existingReport) {
            // Revert progress and note
            setProgress(existingReport.progress);
            setNote(existingReport.note || '');
            
            // Reconstruct/merge split labor and leave arrays back into unified labor state
            const mergedLabor: LaborRecord[] = [];
            const laborMap = new Map<string, any>();
            const leaveMap = new Map<string, any>();

            if (existingReport.labor) {
                existingReport.labor.forEach((l: any) => laborMap.set(l.workerId || l.id, l));
            }
            const exLeave = (existingReport as any).leave;
            if (exLeave) {
                exLeave.forEach((l: any) => leaveMap.set(l.workerId || l.id, l));
            }

            const allWorkerIds = Array.from(new Set([...laborMap.keys(), ...leaveMap.keys()]));
            allWorkerIds.forEach((wId) => {
                const l = laborMap.get(wId);
                const lv = leaveMap.get(wId);
                const isInternal = wId.startsWith('DC-') || (l && !l.contractorId) || (lv && !lv.contractorId);
                
                mergedLabor.push({
                    id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    membership: isInternal ? 'Internal' : 'Outsource',
                    staffId: wId,
                    staffName: l?.staffName || l?.workerName || lv?.staffName || lv?.workerName || '',
                    employeeId: l?.employeeId || lv?.employeeId || '',
                    affiliation: l?.staffName || l?.workerName
                        ? (isInternal ? (l?.staffName || l?.workerName || 'General') : (l?.staffName || l?.workerName || 'General'))
                        : (lv?.staffName || lv?.workerName || 'General'),
                    amount: Number(l?.amount) || 1,
                    timeType: 'Normal',
                    shifts: {
                        normal: l?.shifts?.normal || false,
                        otMorning: l?.shifts?.otMorning || false,
                        otNoon: l?.shifts?.otNoon || false,
                        otEvening: l?.shifts?.otEvening || false
                    },
                    shiftTimes: {
                        day: l?.shiftTimes?.day || '08:00 - 17:00',
                        otMorning: l?.shiftTimes?.otMorning || '06:00 - 08:00',
                        otNoon: '12:00 - 13:00',
                        otEvening: l?.shiftTimes?.otEvening || '18:00 - 21:00'
                    },
                    leave: {
                        active: lv?.leaveShifts?.custom || false,
                        time: lv?.leaveTimes?.custom || '08:00 - 17:00',
                        medCertFileUrl: lv?.medCertFileUrl || ''
                    }
                });
            });

            setLabor(mergedLabor);

            // Decode photos
            const mapRegularFromDb = (dbShift: any): string[] => {
                if (!dbShift) return [];
                if (Array.isArray(dbShift)) return [dbShift[0] || '', dbShift[1] || '', dbShift[2] || '', dbShift[3] || ''];
                return [dbShift.in || '', dbShift.lunch || '', dbShift.afternoon || '', dbShift.out || ''];
            };
            const mapOtShiftFromDb = (dbShift: any): string[] => {
                if (!dbShift) return [];
                if (Array.isArray(dbShift)) return [dbShift[0] || '', dbShift[1] || ''];
                return [dbShift.in || '', dbShift.out || ''];
            };
            if (existingReport.photos && !Array.isArray(existingReport.photos)) {
                const pObj = existingReport.photos as any;
                setSitePhotos(pObj.site || []);
                setLaborRegularPhotos(mapRegularFromDb(pObj.laborByShift?.regular));
                setLaborOtMorningPhotos(mapOtShiftFromDb(pObj.laborByShift?.otMorning));
                setLaborOtNoonPhotos(mapOtShiftFromDb(pObj.laborByShift?.otNoon));
                setLaborOtEveningPhotos(mapOtShiftFromDb(pObj.laborByShift?.otEvening));
            } else {
                const pArr = (existingReport.photos || []) as string[];
                setSitePhotos(pArr);
                setLaborRegularPhotos(existingReport.laborPhotos || []);
                setLaborOtMorningPhotos([]);
                setLaborOtNoonPhotos([]);
                setLaborOtEveningPhotos([]);
            }
            setActivePhotoTab('site');
        }

        setIsEditingExisting(false);
    };

    const hasUnsavedChanges = () => {
        if (!selectedTaskInfo) return false;
        
        const history = selectedTaskInfo.task.history || [];
        const filteredHistory = selectedTaskInfo.task.revisionCreatedAt
            ? history.filter(h => h.date && h.date > selectedTaskInfo.task.revisionCreatedAt)
            : history;
        const existingReport = filteredHistory.find(h => (h.date?.split('T')[0]) === reportDate);
        
        if (existingReport) {
            // If they are in edit mode, they have active unsaved editing
            return isEditingExisting;
        } else {
            // For new reports, we check if they filled out any form data
            const isLaborDirty = labor.length > 0;
            const isPhotosDirty = sitePhotos.some(Boolean) || 
                                  laborRegularPhotos.some(Boolean) || 
                                  laborOtMorningPhotos.some(Boolean) || 
                                  laborOtNoonPhotos.some(Boolean) || 
                                  laborOtEveningPhotos.some(Boolean);
            const isNoteDirty = note.trim() !== '';
            
            // Re-evaluating default progress bounds
            let minProgress = 0;
            filteredHistory.forEach(h => {
                const hDate = h.date?.split('T')[0] || '';
                if (hDate && hDate < reportDate && h.progress > minProgress) {
                    minProgress = h.progress;
                }
            });
            const isProgressDirty = progress !== minProgress;

            return isLaborDirty || isPhotosDirty || isNoteDirty || isProgressDirty;
        }
    };

    const handleDateChange = (newDateStr: string) => {
        if (newDateStr === reportDate) return;
        if (hasUnsavedChanges()) {
            const discard = window.confirm('คุณมีรายการที่ยังไม่ได้บันทึกค้างอยู่ หากเปลี่ยนวันที่ การเปลี่ยนแปลงทั้งหมดในหน้านี้จะสูญหาย คุณต้องการเปลี่ยนวันโดยละทิ้งการแก้ไขใช่หรือไม่?');
            if (!discard) return;
        }
        setReportDate(newDateStr);
    };

    const renderTaskCard = (task: MasterTask, wo: WorkOrder, categoryId: string, isNew: boolean) => {
        const isReadOnly = (task as any).isReadOnly;
        const isSelected = selectedTaskInfo?.task.id === task.id;
        const isHighlighted = highlightedId === wo.id;
        const project = realProjects.find(p => p.id === wo.projectId);

        // Circular Progress Calculation
        const progressColor = task.dailyProgress === 100 ? '#10b981' : task.dailyProgress > 0 ? '#3b82f6' : '#e2e8f0';
        const isCompleted100 = (task.dailyProgress || 0) >= 100;

        return (
            <div
                key={task.id}
                onClick={() => {
                    if (isReadOnly) {
                        alert('คุณเห็นงานนี้ในฐานะผู้ดูแลภาพรวมใบงาน (Owner) เท่านั้น ไม่สามารถแก้ไขหรือบันทึกรายงานได้ (เฉพาะช่างผู้มาช่วยเท่านั้นที่อัปเดตได้)');
                        return;
                    }
                    handleSelectTask(task, wo, categoryId);
                }}
                style={{
                    padding: '12px 14px', borderRadius: '16px', marginBottom: '8px',
                    border: '1px solid', 
                    borderColor: isSelected ? '#3b82f6' : isHighlighted ? '#3b82f6' : isReadOnly ? '#cbd5e1' : isCompleted100 ? '#a7f3d0' : isNew ? '#fcd34d' : '#f1f5f9',
                    background: isSelected ? '#eff6ff' : isHighlighted ? '#eff6ff' : isReadOnly ? '#f8fafc' : isCompleted100 ? '#f0fdf4' : isNew ? '#fffbeb' : '#fff',
                    cursor: isReadOnly ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                    boxShadow: isSelected || isHighlighted ? '0 8px 12px -3px rgba(59, 130, 246, 0.15)' : isCompleted100 ? '0 4px 6px -1px rgba(16, 185, 129, 0.08)' : '0 2px 4px -1px rgba(0,0,0,0.05)',
                    transform: isHighlighted && !isSelected ? 'scale(1.02)' : 'none',
                    position: 'relative',
                    opacity: isReadOnly ? 0.75 : 1,
                    display: 'flex', alignItems: 'center', gap: '12px'
                }}
            >
                {/* Circular Progress */}
                <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                    <svg height="64" width="64" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="32" cy="32" r="26" stroke="#e2e8f0" strokeWidth="6" fill="none" />
                        <circle
                            cx="32" cy="32" r="26"
                            stroke={progressColor} strokeWidth="6" fill="none"
                            strokeDasharray={2 * Math.PI * 26}
                            strokeDashoffset={(2 * Math.PI * 26) - (task.dailyProgress / 100) * (2 * Math.PI * 26)}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        />
                    </svg>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#334155', letterSpacing: '-0.03em' }}>{task.dailyProgress}%</span>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', background: '#dbeafe', padding: '2px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{task.id || task.taskCode}</div>
                        {isReadOnly && <div style={{ background: '#cbd5e1', color: '#475569', fontSize: '0.58rem', fontWeight: 800, padding: '2px 5px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '2px' }}><Lock size={8} /> ดูได้อย่างเดียว</div>}
                        {isNew && <div style={{ background: '#ef4444', color: '#fff', fontSize: '0.58rem', fontWeight: 800, padding: '2px 5px', borderRadius: '6px' }}>ใหม่</div>}
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                        {task.name}
                        {task.currentRevision && task.currentRevision !== 'rev00' && (
                            <span style={{ color: '#ef4444', marginLeft: '6px', fontWeight: 900, background: '#fef2f2', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fca5a5', fontSize: '0.62rem', display: 'inline-block' }}>
                                REV. {parseInt(task.currentRevision.replace('rev', ''))}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                        <Building2 size={11} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wo.locationName}</span>
                    </div>
                    {isCompleted100 && (
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ 
                                color: '#15803d', 
                                background: '#dcfce7', 
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                fontWeight: 800, 
                                fontSize: '0.65rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                            }}>
                                <CheckCircle2 size={10} style={{ color: '#10b981' }} /> รอส่งมอบภาพรวม
                            </span>
                        </div>
                    )}
                </div>

                {/* Project Image */}
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                    {getTaskImage(task) ?
                        <img loading="lazy" src={getTaskImage(task)!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Task" /> :
                        (project?.imageUrl ?
                            <img loading="lazy" src={project.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Project" /> :
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}><Building2 size={20} /></div>
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

    const renderLeaveTimeInput = (id: string, rangeStr: string) => {
        const [start, end] = rangeStr.split(' - ').map(s => s.trim());
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', pointerEvents: isEditingExisting ? 'auto' : 'none' }}>
                <div
                    onClick={() => openTimePicker(id, 'leave', 'start')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px',
                        padding: '2px 6px', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: 700, color: '#e11d48',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    <Clock size={12} color="#f43f5e" />
                    {start}
                </div>
                <span style={{ color: '#fecdd3', fontWeight: 700 }}>-</span>
                <div
                    onClick={() => openTimePicker(id, 'leave', 'end')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px',
                        padding: '2px 6px', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: 700, color: '#e11d48',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    {end}
                </div>
            </div>
        );
    };

    const availableStaff = dailyContractors
        .filter(c => (c.department || '').toLowerCase().endsWith('wh'))
        .filter(c => !labor.some(l => l.staffId === c.id));

    const availableContractors = realContractors.filter(c => !labor.some(l => l.contractorId === c.id));

    return (
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isSidebarOpen ? '360px 1fr' : '1fr', 
            gap: '2rem', 
            height: 'calc(100vh - 120px)',
            transition: 'grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {timePickerTarget && <AnalogTimePicker value={timePickerTarget.currentValue} onChange={handleTimeChange} onClose={() => setTimePickerTarget(null)} />}
            {activeModal && <BatchAddModal type={activeModal} availableItems={activeModal === 'Internal' ? availableStaff : availableContractors} onClose={() => setActiveModal(null)} onAdd={handleBatchAdd} />}
            {showSummaryModal && selectedTaskInfo && (() => {
                const totalManpower = labor.filter(l => l.shifts?.normal || l.shifts?.otMorning || l.shifts?.otNoon || l.shifts?.otEvening).reduce((acc, l) => acc + (Number(l.amount) || 1), 0);
                const internalCount = labor.filter(l => l.membership === 'Internal' && (l.shifts?.normal || l.shifts?.otMorning || l.shifts?.otNoon || l.shifts?.otEvening)).reduce((acc, l) => acc + (Number(l.amount) || 1), 0);
                const subcoCount = labor.filter(l => l.membership === 'Outsource' && (l.shifts?.normal || l.shifts?.otMorning || l.shifts?.otNoon || l.shifts?.otEvening)).reduce((acc, l) => acc + (Number(l.amount) || 1), 0);
                const leaveCount = labor.filter(l => l.leave?.active).length;

                // ✅ Reconstruct original daily report labor for detailed change comparison (Retroactive highlights)
                const originalReport = isEditingExisting && selectedTaskInfo?.task?.history?.find(h => (h.date?.split('T')[0]) === reportDate);
                const originalLaborMap = new Map<string, any>();
                
                if (originalReport) {
                    if (originalReport.labor) {
                        originalReport.labor.forEach((l: any) => {
                            const wId = l.workerId || l.id || l.staffId || '';
                            if (wId) {
                                originalLaborMap.set(wId, {
                                    staffId: wId,
                                    employeeId: l.employeeId || '',
                                    staffName: l.staffName || l.workerName || '',
                                    membership: l.membership || (wId.startsWith('DC-') ? 'Internal' : 'Outsource'),
                                    shifts: {
                                        normal: l.shifts?.normal || false,
                                        otMorning: l.shifts?.otMorning || false,
                                        otNoon: l.shifts?.otNoon || false,
                                        otEvening: l.shifts?.otEvening || false,
                                    },
                                    leave: {
                                        active: false,
                                        leaveType: ''
                                    },
                                    amount: Number(l.amount) || 1
                                });
                            }
                        });
                    }
                    const exLeave = (originalReport as any).leave;
                    if (exLeave) {
                        exLeave.forEach((lv: any) => {
                            const wId = lv.workerId || lv.id || lv.staffId || '';
                            if (wId) {
                                const existing = originalLaborMap.get(wId);
                                if (existing) {
                                    existing.leave = {
                                        active: lv.leaveShifts?.custom || false,
                                        leaveType: lv.leaveType || (lv.medCertFileUrl ? 'Paid' : 'Unpaid')
                                    };
                                } else {
                                    originalLaborMap.set(wId, {
                                        staffId: wId,
                                        employeeId: lv.employeeId || '',
                                        staffName: lv.staffName || lv.workerName || '',
                                        membership: wId.startsWith('DC-') ? 'Internal' : 'Outsource',
                                        shifts: { normal: false, otMorning: false, otNoon: false, otEvening: false },
                                        leave: {
                                            active: lv.leaveShifts?.custom || false,
                                            leaveType: lv.leaveType || (lv.medCertFileUrl ? 'Paid' : 'Unpaid')
                                        },
                                        amount: Number(lv.amount) || 1
                                    });
                                }
                            }
                        });
                    }
                }

                // Check if progress or notes have changed
                const isProgressChanged = originalReport && originalReport.progress !== progress;
                const isNoteChanged = originalReport && (originalReport.note || '') !== note;

                // Find completely removed workers
                const removedWorkers = [];
                if (originalReport) {
                    for (const [wId, orig] of originalLaborMap.entries()) {
                        const isStillPresent = labor.some(l => (l.staffId || l.id) === wId);
                        if (!isStillPresent) {
                            removedWorkers.push(orig);
                        }
                    }
                }

                return (
                    <div style={{ 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        background: 'rgba(15, 23, 42, 0.65)', 
                        backdropFilter: 'blur(10px)',
                        zIndex: 2000, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ 
                            background: '#ffffff', 
                            borderRadius: '24px', 
                            padding: '2rem', 
                            width: '580px', 
                            maxWidth: '100%', 
                            maxHeight: '90vh',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Modal Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                                <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '16px', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckSquare size={24} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                                        {isEditingExisting ? 'ตรวจสอบการแก้ไขรายงานประจำวัน' : 'ตรวจสอบรายงานประจำวัน'}
                                    </h3>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                                        โปรดตรวจสอบรายละเอียดข้อมูลก่อนกดยืนยันการส่งรายงาน
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setShowSummaryModal(false)}
                                    style={{ 
                                        border: 'none', 
                                        background: 'none', 
                                        color: '#94a3b8', 
                                        cursor: 'pointer', 
                                        padding: '4px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>

                            {/* Modal Body Container (Scrollable) */}
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '1rem', 
                                overflowY: 'auto', 
                                paddingRight: '4px',
                                maxHeight: 'calc(90vh - 200px)' 
                            }}>
                                {/* General Operations Info Card */}
                                <div style={{ 
                                    background: isProgressChanged ? '#fff7ed' : '#f8fafc', 
                                    borderRadius: '16px', 
                                    border: isProgressChanged ? '1.5px solid #ea580c' : '1px solid #e2e8f0', 
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <FileText size={14} color={isProgressChanged ? "#ea580c" : "#64748b"} /> 
                                        ข้อมูลการดำเนินงาน
                                        {isProgressChanged && (
                                            <span style={{ 
                                                fontSize: '0.65rem', 
                                                fontWeight: 800, 
                                                padding: '2px 6px', 
                                                borderRadius: '6px', 
                                                background: '#ea580c', 
                                                color: '#ffffff',
                                                marginLeft: '6px'
                                            }}>
                                                แก้ไขความคืบหน้า
                                            </span>
                                        )}
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '4px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>วันที่รายงาน:</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                                                <Calendar size={14} color="#3b82f6" />
                                                {new Date(reportDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>ความคืบหน้างาน:</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 800, color: '#2563eb' }}>
                                                <TrendingUp size={14} color="#2563eb" />
                                                {isProgressChanged ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.85rem' }}>{originalReport.progress}%</span>
                                                        <span style={{ color: '#ea580c', fontSize: '0.85rem' }}>→</span>
                                                        <span style={{ color: '#2563eb', fontWeight: 900 }}>{progress}%</span>
                                                    </div>
                                                ) : (
                                                    <span>{progress}%</span>
                                                )}
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                                                    ({progress === 100 ? 'ปิดงาน' : reportType === 'Problem' ? 'รายงานปัญหาหน้างาน' : 'อัปเดตความคืบหน้า'})
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Labor Headcount Summary Card */}
                                <div style={{ 
                                    background: '#f8fafc', 
                                    borderRadius: '16px', 
                                    border: '1px solid #e2e8f0', 
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <HardHat size={14} color="#64748b" /> กำลังพลปฏิบัติงานทั้งหมด
                                        </h4>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1e40af', background: '#eff6ff', padding: '4px 10px', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
                                            {totalManpower} คน
                                        </span>
                                    </div>

                                    {/* Sub-counts */}
                                    <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }}></div>
                                            <span>คนงานบริษัท: <span style={{ color: '#0f172a', fontWeight: 900 }}>{internalCount} คน</span></span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></div>
                                            <span>ทีมงานผู้รับเหมา: <span style={{ color: '#0f172a', fontWeight: 900 }}>{subcoCount} คน</span></span>
                                        </div>
                                        {leaveCount > 0 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></div>
                                                <span>ลางาน: <span style={{ color: '#ef4444', fontWeight: 900 }}>{leaveCount} คน</span></span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Worker List inside modal */}
                                    <div style={{ 
                                        maxHeight: '260px', 
                                        overflowY: 'auto', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        gap: '6px',
                                        paddingRight: '2px',
                                        marginTop: '4px'
                                    }}>
                                        {labor.map((l) => {
                                            const activeShifts = [];
                                            if (l.shifts?.normal) activeShifts.push({ name: 'ปกติ', key: 'normal' });
                                            if (l.shifts?.otMorning) activeShifts.push({ name: 'OT เช้า', key: 'otMorning' });
                                            if (l.shifts?.otNoon) activeShifts.push({ name: 'OT เที่ยง', key: 'otNoon' });
                                            if (l.shifts?.otEvening) activeShifts.push({ name: 'OT เย็น', key: 'otEvening' });
                                            if (l.leave?.active) activeShifts.push({ name: 'ลางาน', key: 'leave' });

                                            const wId = l.staffId || l.id;
                                            const orig = originalLaborMap.get(wId);
                                            const isNewWorker = isEditingExisting && originalReport && !orig;
                                            const isShiftChanged = isEditingExisting && originalReport && orig && (
                                                (orig.shifts.normal !== l.shifts?.normal) ||
                                                (orig.shifts.otMorning !== l.shifts?.otMorning) ||
                                                (orig.shifts.otNoon !== l.shifts?.otNoon) ||
                                                (orig.shifts.otEvening !== l.shifts?.otEvening) ||
                                                (orig.leave.active !== l.leave?.active)
                                            );

                                            // Find removed shifts for this worker
                                            const removedShifts = [];
                                            if (orig) {
                                                if (orig.shifts.normal && !l.shifts?.normal) removedShifts.push('ปกติ');
                                                if (orig.shifts.otMorning && !l.shifts?.otMorning) removedShifts.push('OT เช้า');
                                                if (orig.shifts.otNoon && !l.shifts?.otNoon) removedShifts.push('OT เที่ยง');
                                                if (orig.shifts.otEvening && !l.shifts?.otEvening) removedShifts.push('OT เย็น');
                                                if (orig.leave.active && !l.leave?.active) removedShifts.push('ลางาน');
                                            }

                                            return (
                                                <div key={l.id} style={{ 
                                                    display: 'flex', 
                                                    flexDirection: 'column',
                                                    padding: '8px 12px', 
                                                    background: isNewWorker ? '#f0fdf4' : isShiftChanged ? '#fff7ed' : '#ffffff', 
                                                    borderRadius: '10px', 
                                                    border: isNewWorker ? '1.5px solid #10b981' : isShiftChanged ? '1.5px solid #ea580c' : '1px solid #f1f5f9' 
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                            <div style={{ 
                                                                width: 24, 
                                                                height: 24, 
                                                                borderRadius: 6, 
                                                                background: l.membership === 'Internal' ? '#eff6ff' : '#f0fdf4', 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'center', 
                                                                flexShrink: 0 
                                                            }}>
                                                                {l.membership === 'Internal' ? <User size={12} color="#2563eb" /> : <HardHat size={12} color="#059669" />}
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
                                                                {l.employeeId ? `${l.employeeId} : ` : ''}{l.staffName || l.affiliation}
                                                                {isNewWorker && (
                                                                    <span style={{ 
                                                                        fontSize: '0.6rem', 
                                                                        fontWeight: 800, 
                                                                        padding: '1px 5px', 
                                                                        borderRadius: '4px', 
                                                                        background: '#10b981', 
                                                                        color: '#ffffff',
                                                                        marginLeft: '6px'
                                                                    }}>
                                                                        เพิ่มใหม่
                                                                    </span>
                                                                )}
                                                                {isShiftChanged && (
                                                                    <span style={{ 
                                                                        fontSize: '0.6rem', 
                                                                        fontWeight: 800, 
                                                                        padding: '1px 5px', 
                                                                        borderRadius: '4px', 
                                                                        background: '#ea580c', 
                                                                        color: '#ffffff',
                                                                        marginLeft: '6px'
                                                                    }}>
                                                                        แก้ไขเวลา
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                            {activeShifts.map((sh, sIdx) => {
                                                                let bg = '#dbeafe';
                                                                let text = '#1e40af';
                                                                if (sh.name.startsWith('OT')) { bg = '#fef3c7'; text = '#92400e'; }
                                                                if (sh.name === 'ลางาน') { bg = '#fee2e2'; text = '#991b1b'; }

                                                                // Check if this shift is newly added
                                                                const isShiftAdded = isEditingExisting && originalReport && orig && (
                                                                    (sh.key === 'normal' && !orig.shifts.normal) ||
                                                                    (sh.key === 'otMorning' && !orig.shifts.otMorning) ||
                                                                    (sh.key === 'otNoon' && !orig.shifts.otNoon) ||
                                                                    (sh.key === 'otEvening' && !orig.shifts.otEvening) ||
                                                                    (sh.key === 'leave' && !orig.leave.active)
                                                                );

                                                                return (
                                                                    <span key={sIdx} style={{ 
                                                                        fontSize: '0.65rem', 
                                                                        fontWeight: 800, 
                                                                        padding: '2px 6px', 
                                                                        borderRadius: '6px', 
                                                                        background: bg, 
                                                                        color: text,
                                                                        border: isShiftAdded ? '1.5px dashed #ea580c' : '1px solid transparent',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '2px'
                                                                    }}>
                                                                        {isShiftAdded && <span style={{ fontWeight: 900, color: '#ea580c' }}>+</span>}
                                                                        {sh.name}
                                                                    </span>
                                                                );
                                                            })}
                                                            {Number(l.amount) > 1 && (
                                                                <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '2px 6px', borderRadius: '6px', background: '#e2e8f0', color: '#475569' }}>
                                                                    จำนวน {l.amount} คน
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Removed Shifts Row */}
                                                    {removedShifts.length > 0 && (
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            gap: '4px', 
                                                            alignItems: 'center', 
                                                            fontSize: '0.65rem', 
                                                            color: '#ef4444', 
                                                            fontWeight: 700, 
                                                            marginTop: '4px',
                                                            paddingTop: '4px',
                                                            borderTop: '1px dotted #fecaca'
                                                        }}>
                                                            <span style={{ color: '#94a3b8' }}>นำออก:</span>
                                                            {removedShifts.map((sh, idx) => (
                                                                <span key={idx} style={{ 
                                                                    background: '#fee2e2', 
                                                                    color: '#b91c1c', 
                                                                    padding: '1px 5px', 
                                                                    borderRadius: '4px',
                                                                    textDecoration: 'line-through' 
                                                                }}>
                                                                    {sh}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Removed Workers Section */}
                                        {removedWorkers.length > 0 && (
                                            <div style={{ 
                                                marginTop: '10px', 
                                                paddingTop: '10px', 
                                                borderTop: '1px dashed #fca5a5' 
                                            }}>
                                                <h5 style={{ margin: '0 0 6px 0', fontSize: '0.75rem', fontWeight: 800, color: '#ef4444' }}>
                                                    คนงานที่ถูกลบออก ({removedWorkers.length} คน)
                                                </h5>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {removedWorkers.map((rw) => {
                                                        const origShifts = [];
                                                        if (rw.shifts.normal) origShifts.push('ปกติ');
                                                        if (rw.shifts.otMorning) origShifts.push('OT เช้า');
                                                        if (rw.shifts.otNoon) origShifts.push('OT เที่ยง');
                                                        if (rw.shifts.otEvening) origShifts.push('OT เย็น');
                                                        if (rw.leave.active) origShifts.push('ลางาน');

                                                        return (
                                                            <div key={rw.staffId} style={{ 
                                                                display: 'flex', 
                                                                justifyContent: 'space-between', 
                                                                alignItems: 'center', 
                                                                padding: '8px 12px', 
                                                                background: '#fef2f2', 
                                                                borderRadius: '10px', 
                                                                border: '1px solid #fca5a5',
                                                                opacity: 0.8
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                                    <div style={{ 
                                                                        width: 24, 
                                                                        height: 24, 
                                                                        borderRadius: 6, 
                                                                        background: '#fee2e2', 
                                                                        display: 'flex', 
                                                                        alignItems: 'center', 
                                                                        justifyContent: 'center', 
                                                                        flexShrink: 0 
                                                                    }}>
                                                                        <User size={12} color="#ef4444" />
                                                                    </div>
                                                                    <div style={{ 
                                                                        fontSize: '0.8rem', 
                                                                        fontWeight: 800, 
                                                                        color: '#991b1b', 
                                                                        textDecoration: 'line-through',
                                                                        whiteSpace: 'nowrap', 
                                                                        overflow: 'hidden', 
                                                                        textOverflow: 'ellipsis' 
                                                                    }}>
                                                                        {rw.employeeId ? `${rw.employeeId} : ` : ''}{rw.staffName}
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                    {origShifts.map((sh, sIdx) => (
                                                                        <span key={sIdx} style={{ 
                                                                            fontSize: '0.65rem', 
                                                                            fontWeight: 800, 
                                                                            padding: '2px 6px', 
                                                                            borderRadius: '6px', 
                                                                            background: '#fee2e2', 
                                                                            color: '#991b1b',
                                                                            textDecoration: 'line-through'
                                                                        }}>
                                                                            {sh}
                                                                        </span>
                                                                    ))}
                                                                    {Number(rw.amount) > 1 && (
                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '2px 6px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b' }}>
                                                                            จำนวน {rw.amount} คน
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Attached Photos Card */}
                                <div style={{ 
                                    background: '#f8fafc', 
                                    borderRadius: '16px', 
                                    border: '1px solid #e2e8f0', 
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Camera size={14} color="#64748b" /> รูปภาพที่แนบรายงาน
                                    </h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>
                                            <CheckCircle2 size={12} color="#15803d" />
                                            <span>รูปถ่ายหน้างาน ({sitePhotos.filter(Boolean).length} รูป)</span>
                                        </div>
                                        {laborRegularPhotos.some(Boolean) && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>
                                                <CheckCircle2 size={12} color="#15803d" />
                                                <span>รูปถ่ายคนงานปกติ ({laborRegularPhotos.filter(Boolean).length} รูป)</span>
                                            </div>
                                        )}
                                        {(laborOtMorningPhotos.some(Boolean) || laborOtNoonPhotos.some(Boolean) || laborOtEveningPhotos.some(Boolean)) && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>
                                                <CheckCircle2 size={12} color="#15803d" />
                                                <span>รูปถ่ายคนงาน OT ({laborOtMorningPhotos.filter(Boolean).length + laborOtNoonPhotos.filter(Boolean).length + laborOtEveningPhotos.filter(Boolean).length} รูป)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Site Notes (หมายเหตุ) Card */}
                                <div style={{ 
                                    background: isNoteChanged ? '#fff7ed' : '#f8fafc', 
                                    borderRadius: '16px', 
                                    border: isNoteChanged ? '1.5px solid #ea580c' : '1px solid #e2e8f0', 
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Info size={14} color={isNoteChanged ? "#ea580c" : "#64748b"} /> 
                                        หมายเหตุ (Site Notes)
                                        {isNoteChanged && (
                                            <span style={{ 
                                                fontSize: '0.65rem', 
                                                fontWeight: 800, 
                                                padding: '2px 6px', 
                                                borderRadius: '6px', 
                                                background: '#ea580c', 
                                                color: '#ffffff',
                                                marginLeft: '6px'
                                            }}>
                                                แก้ไขแล้ว
                                            </span>
                                        )}
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {isNoteChanged && originalReport.note && (
                                            <div style={{ 
                                                fontSize: '0.75rem', 
                                                color: '#94a3b8', 
                                                textDecoration: 'line-through',
                                                background: '#fee2e2',
                                                padding: '6px 8px',
                                                borderRadius: '8px',
                                                border: '1px solid #fecaca'
                                            }}>
                                                เดิม: {originalReport.note}
                                            </div>
                                        )}
                                        <p style={{ 
                                            margin: '4px 0 0 0', 
                                            fontSize: '0.8rem', 
                                            fontWeight: note ? 700 : 500, 
                                            color: note ? '#334155' : '#94a3b8', 
                                            background: '#ffffff',
                                            padding: '10px 12px',
                                            borderRadius: '10px',
                                            border: '1px solid #f1f5f9',
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: 1.4
                                        }}>
                                            {note || 'ไม่ได้ระบุหมายเหตุเพิ่มเติม'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Action Buttons */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                                <button 
                                    onClick={() => setShowSummaryModal(false)}
                                    style={{ 
                                        flex: 1, 
                                        padding: '12px', 
                                        borderRadius: '14px', 
                                        border: '2px solid #cbd5e1', 
                                        background: '#ffffff', 
                                        color: '#475569',
                                        fontSize: '0.85rem',
                                        fontWeight: 800, 
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#94a3b8';
                                        e.currentTarget.style.background = '#f8fafc';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                        e.currentTarget.style.background = '#ffffff';
                                    }}
                                >
                                    กลับไปแก้ไข
                                </button>
                                <button 
                                    onClick={handleFinalSubmit}
                                    disabled={submittingRef.current || isSubmitting}
                                    style={{ 
                                        flex: 1, 
                                        padding: '12px', 
                                        borderRadius: '14px', 
                                        border: 'none', 
                                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
                                        color: '#ffffff',
                                        fontSize: '0.85rem',
                                        fontWeight: 800, 
                                        cursor: (submittingRef.current || isSubmitting) ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSubmitting) {
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.35)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSubmitting) {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.25)';
                                        }
                                    }}
                                >
                                    {(submittingRef.current || isSubmitting) ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>กำลังส่งรายงาน...</span>
                                        </>
                                    ) : (
                                        <span>ส่งรายงานเลย</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {showUnlockModal && selectedTaskInfo && (
                <div style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    background: 'rgba(15, 23, 42, 0.6)', 
                    backdropFilter: 'blur(8px)',
                    zIndex: 2000, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                }}>
                    <div style={{ 
                        background: '#ffffff', 
                        borderRadius: '24px', 
                        padding: '2rem', 
                        width: '450px', 
                        maxWidth: '90%', 
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '12px', color: '#ef4444' }}>
                                <Lock size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>ขออนุมัติปลดล็อกแก้ไขย้อนหลัง</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>สำหรับใบงานที่ต้องการปลดล็อกเกิน 3 วันที่กำหนด</p>
                            </div>
                        </div>

                        <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: '14px', border: '1px solid #bfdbfe' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', display: 'block', marginBottom: '2px' }}>วันที่ต้องการปลดล็อก:</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#1e3a8a' }}>
                                {new Date(pendingUnlockDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>เหตุผลความจำเป็นในการปลดล็อก: <span style={{ color: '#ef4444' }}>*</span></label>
                            <textarea 
                                placeholder="กรุณาระบุรายละเอียด เช่น ลืมกดรายงานในระบบ, รอเอกสารยืนยัน..."
                                value={unlockReason}
                                onChange={(e) => setUnlockReason(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    padding: '12px', 
                                    borderRadius: '12px', 
                                    border: '1px solid #cbd5e1', 
                                    background: '#f8fafc',
                                    fontSize: '0.85rem', 
                                    outline: 'none', 
                                    minHeight: '80px',
                                    resize: 'none',
                                    transition: 'all 0.2s',
                                    boxSizing: 'border-box'
                                }} 
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                            <button 
                                onClick={() => {
                                    setShowUnlockModal(false);
                                    setUnlockReason('');
                                }} 
                                style={{ 
                                    flex: 1, 
                                    padding: '12px', 
                                    borderRadius: '12px', 
                                    border: '1px solid #cbd5e1', 
                                    background: '#fff', 
                                    color: '#64748b',
                                    fontSize: '0.85rem',
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                ยกเลิก
                            </button>
                            <button 
                                onClick={async () => {
                                    if (!unlockReason.trim()) {
                                        alert('กรุณาระบุเหตุผลในการขอปลดล็อก');
                                        return;
                                    }
                                    try {
                                        await requestRetroactiveUnlock(
                                            selectedTaskInfo.wo.id,
                                            selectedTaskInfo.categoryId,
                                            selectedTaskInfo.task.id,
                                            pendingUnlockDate,
                                            unlockReason
                                        );
                                        alert('ส่งคำขอปลดล็อกสำเร็จ (ได้รับการอนุมัติระบบอัตโนมัติเป็นเวลา 24 ชั่วโมง)');
                                        setReportDate(pendingUnlockDate);
                                        setShowUnlockModal(false);
                                        setUnlockReason('');
                                    } catch (err) {
                                        console.error(err);
                                        alert('เกิดข้อผิดพลาดในการปลดล็อก');
                                    }
                                }} 
                                style={{ 
                                    flex: 2, 
                                    padding: '12px', 
                                    borderRadius: '12px', 
                                    border: 'none', 
                                    background: '#3b82f6', 
                                    color: '#fff', 
                                    fontSize: '0.85rem',
                                    fontWeight: 900, 
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                ยืนยันขอปลดล็อก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSidebarOpen && (
                <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ background: '#3b82f6', color: '#fff', padding: '8px', borderRadius: '10px' }}><LayoutDashboard size={20} /></div>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>งานรอรายงานผล</h2>
                            </div>
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#64748b',
                                    transition: 'all 0.2s',
                                    padding: 0,
                                    outline: 'none',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}
                                onMouseOver={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#3b82f6'; }}
                                onMouseOut={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                                title="ซ่อนแถบซ้าย"
                            >
                                <ChevronLeft size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                            <input type="text" placeholder="ค้นหาเลขที่งาน หรือ สถานที่..." style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                        {pendingDeliveryWorkOrders.length === 0 && newTasks.length === 0 && inProgressTasks.length === 0 && pendingInspectionTasks.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}><div style={{ fontSize: '0.9rem', fontWeight: 700 }}>ไม่มีงานที่ต้องรายงานในขณะนี้</div></div> :
                            <>
                                {pendingDeliveryWorkOrders.length > 0 && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#6366f1', marginLeft: '8px', marginBottom: '10px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Package size={12} style={{ color: '#6366f1' }} /> งานที่รอส่งมอบภาพรวม (Delivery)
                                        </h3>
                                        {pendingDeliveryWorkOrders.map(({ wo }: any) => (
                                            <div 
                                                key={wo.id}
                                                style={{
                                                    background: '#f8fafc',
                                                    border: '2px solid #e0e7ff',
                                                    borderRadius: '16px',
                                                    padding: '14px',
                                                    marginBottom: '10px',
                                                    boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.05)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#4f46e5', background: '#e0e7ff', padding: '2px 8px', borderRadius: '6px' }}>{wo.id}</span>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>เสร็จครบ 100%</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#1e293b' }}>📍 {wo.locationName}</div>
                                                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('คุณต้องการสร้าง QR Code สำหรับส่งมอบงานให้ลูกค้าตรวจรับใช่หรือไม่?')) {
                                                                try {
                                                                    const token = await generateDeliveryQrToken(wo.id, user?.employeeId || user?.id || 'unknown');
                                                                    alert(`สร้าง QR Code ตรวจรับงานเรียบร้อย!\nToken: ${token}`);
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert('เกิดข้อผิดพลาดในการสร้าง QR Code');
                                                                }
                                                            }
                                                        }}
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px',
                                                            borderRadius: '10px',
                                                            border: 'none',
                                                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                                            color: '#fff',
                                                            fontWeight: 800,
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px',
                                                            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.15)'
                                                        }}
                                                    >
                                                        <QrCode size={12} /> QR Code
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            // Auto-generate token if not exists, and launch simulator directly
                                                            try {
                                                                let token = wo.deliveryQrToken;
                                                                if (!token) {
                                                                    token = await generateDeliveryQrToken(wo.id, user?.employeeId || user?.id || 'unknown');
                                                                }
                                                                setMockupWorkOrder(wo);
                                                                setIsCustomerMockupOpen(true);
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert('เกิดข้อผิดพลาดในการจำลองหน้าลูกค้า');
                                                            }
                                                        }}
                                                        style={{
                                                            flex: 1.2,
                                                            padding: '8px',
                                                            borderRadius: '10px',
                                                            border: '1.5px solid #22c55e',
                                                            background: '#f0fdf4',
                                                            color: '#166534',
                                                            fontWeight: 800,
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <Sparkles size={12} style={{ color: '#22c55e' }} /> จำลองตรวจรับ
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {newTasks.length > 0 && <div style={{ marginBottom: '1.5rem' }}><h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', marginLeft: '8px', marginBottom: '10px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}><Bell size={12} fill="currentColor" /> งานใหม่ (New Assignments)</h3>{newTasks.map(({ task, wo, categoryId }: any) => renderTaskCard(task, wo, categoryId, true))}</div>}
                                {inProgressTasks.length > 0 && <div style={{ marginBottom: '1.5rem' }}><h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', marginLeft: '8px', marginBottom: '10px', textTransform: 'uppercase' }}>งานที่กำลังทำ (In Progress)</h3>{inProgressTasks.map(({ task, wo, categoryId }: any) => renderTaskCard(task, wo, categoryId, false))}</div>}
                                {pendingInspectionTasks.length > 0 && <div><h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', marginLeft: '8px', marginBottom: '10px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={12} style={{ color: '#10b981' }} /> งานที่รอตรวจสอบ (Pending Inspection)</h3>{pendingInspectionTasks.map(({ task, wo, categoryId }: any) => renderTaskCard(task, wo, categoryId, false))}</div>}
                            </>
                        }
                    </div>
                </div>
            )}

            <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'visible', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {!selectedTaskInfo ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {!isSidebarOpen && (
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                style={{
                                    position: 'absolute',
                                    top: '20px',
                                    left: '20px',
                                    background: '#eff6ff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    padding: '8px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                    color: '#2563eb',
                                    boxShadow: '0 4px 6px -1px rgba(59,130,246,0.1)',
                                    transition: 'all 0.2s',
                                    zIndex: 10
                                }}
                                onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                                onMouseOut={e => e.currentTarget.style.background = '#eff6ff'}
                            >
                                <ChevronRight size={16} strokeWidth={2.5} /> แสดงรายการงาน
                            </button>
                        )}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                            <LayoutDashboard size={64} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
                            <h3 style={{ margin: 0, fontWeight: 800 }}>เลือกรายการงานที่ต้องการรายงานผล</h3>
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>รายการงานที่ท่านได้รับมอบหมายจะแสดงในแถบด้านซ้าย</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'visible', display: 'flex', minHeight: '130px' }}>
                                <div style={{ width: '150px', background: '#f1f5f9', position: 'relative', flexShrink: 0, borderTopLeftRadius: '15px', borderBottomLeftRadius: '15px', overflow: 'hidden' }}>
                                    {getTaskImage(selectedTaskInfo.task) ? <img src={getTaskImage(selectedTaskInfo.task)!} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setZoomImage(getTaskImage(selectedTaskInfo.task)!)} alt="Task" /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}><AlertCircle size={24} /></div>}
                                    <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>BEFORE</div>
                                </div>
                                <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                {!isSidebarOpen && (
                                                    <button
                                                        onClick={() => setIsSidebarOpen(true)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            background: '#eff6ff',
                                                            border: '1px solid #dbeafe',
                                                            borderRadius: '8px',
                                                            padding: '4px 10px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 800,
                                                            color: '#2563eb',
                                                            transition: 'all 0.2s',
                                                            marginRight: '4px'
                                                        }}
                                                        onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; }}
                                                        onMouseOut={e => { e.currentTarget.style.background = '#eff6ff'; }}
                                                    >
                                                        <ChevronRight size={14} strokeWidth={2.5} />
                                                        แสดงรายการงาน
                                                    </button>
                                                )}
                                                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', background: '#dbeafe', padding: '2px 8px', borderRadius: '6px' }}>{selectedTaskInfo.task.id || selectedTaskInfo.task.taskCode}</div>
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
                                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span>{selectedTaskInfo.task.name}</span>
                                                {selectedTaskInfo.task.currentRevision && selectedTaskInfo.task.currentRevision !== 'rev00' && (
                                                    <span style={{ color: '#ef4444', fontWeight: 900, background: '#fef2f2', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '0.72rem' }}>
                                                        งานแก้ไข - REV. {parseInt(selectedTaskInfo.task.currentRevision.replace('rev', ''))}
                                                    </span>
                                                )}
                                            </h2>
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
                                                justifyContent: 'space-between',
                                                position: 'relative'
                                            }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>รายงานระบุวันที่</div>
                                                <div 
                                                    onClick={() => setShowCalendarDropdown(!showCalendarDropdown)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        color: '#1e40af',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 900,
                                                        cursor: 'pointer',
                                                        userSelect: 'none'
                                                    }}
                                                >
                                                    <Calendar size={14} />
                                                    <span>{new Date(reportDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>

                                                {showCalendarDropdown && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        right: 0,
                                                        marginTop: '8px',
                                                        zIndex: 1000,
                                                        background: '#fff',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '16px',
                                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                                        padding: '16px',
                                                        width: '280px'
                                                    }}>
                                                        {/* Calendar Header */}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (calendarMonth === 0) {
                                                                        setCalendarMonth(11);
                                                                        setCalendarYear(prev => prev - 1);
                                                                    } else {
                                                                        setCalendarMonth(prev => prev - 1);
                                                                    }
                                                                }}
                                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
                                                            >
                                                                <ChevronLeft size={16} />
                                                            </button>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
                                                                {['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][calendarMonth]} {calendarYear + 543}
                                                            </span>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (calendarMonth === 11) {
                                                                        setCalendarMonth(0);
                                                                        setCalendarYear(prev => prev + 1);
                                                                    } else {
                                                                        setCalendarMonth(prev => prev + 1);
                                                                    }
                                                                }}
                                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
                                                            >
                                                                <ChevronRight size={16} />
                                                            </button>
                                                        </div>

                                                        {/* Weekdays */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
                                                            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day, i) => (
                                                                <span key={i} style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>{day}</span>
                                                            ))}
                                                        </div>

                                                        {/* Monthly Days Grid */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                                                            {/* Blank cells for padding first day */}
                                                            {Array.from({ length: new Date(calendarYear, calendarMonth, 1).getDay() }).map((_, idx) => (
                                                                <div key={`blank-${idx}`} style={{ width: '32px', height: '32px' }} />
                                                            ))}

                                                            {/* Actual Days */}
                                                            {Array.from({ length: new Date(calendarYear, calendarMonth + 1, 0).getDate() }).map((_, idx) => {
                                                                const day = idx + 1;
                                                                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                                const status = getDateStatus(dateStr, selectedTaskInfo.task, selectedTaskInfo.wo);
                                                                
                                                                let dotColor = '';
                                                                if (status === 'reported') dotColor = '#10b981';
                                                                else if (status === 'unlocked') dotColor = '#f59e0b';
                                                                else if (status === 'locked') dotColor = '#ef4444';

                                                                const isSelected = reportDate === dateStr;
                                                                const isDisabled = status === 'disabled';

                                                                return (
                                                                    <div 
                                                                        key={`day-${day}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (isDisabled) return;
                                                                            if (status === 'locked') {
                                                                                setPendingUnlockDate(dateStr);
                                                                                setUnlockReason('');
                                                                                setShowUnlockModal(true);
                                                                                setShowCalendarDropdown(false);
                                                                            } else {
                                                                                handleDateChange(dateStr);
                                                                                setShowCalendarDropdown(false);
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            width: '32px',
                                                                            height: '32px',
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            borderRadius: '8px',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: 800,
                                                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                                            position: 'relative',
                                                                            background: isSelected ? '#3b82f6' : 'transparent',
                                                                            color: isDisabled ? '#cbd5e1' : isSelected ? '#fff' : '#334155',
                                                                            opacity: isDisabled ? 0.6 : 1,
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                        onMouseOver={e => {
                                                                            if (!isDisabled && !isSelected) {
                                                                                e.currentTarget.style.background = '#f1f5f9';
                                                                            }
                                                                        }}
                                                                        onMouseOut={e => {
                                                                            if (!isDisabled && !isSelected) {
                                                                                e.currentTarget.style.background = 'transparent';
                                                                            }
                                                                        }}
                                                                    >
                                                                        {day}
                                                                        {dotColor && (
                                                                            <div style={{
                                                                                position: 'absolute',
                                                                                bottom: '3px',
                                                                                width: '4px',
                                                                                height: '4px',
                                                                                borderRadius: '50%',
                                                                                background: isSelected ? '#fff' : dotColor
                                                                            }} />
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Calendar Legend */}
                                                        <div style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            marginTop: '16px',
                                                            paddingTop: '12px',
                                                            borderTop: '1px solid #f1f5f9',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 800
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                                                <span>มีข้อมูล</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                                                                <span>ยังไม่ได้ลง</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                                                                <span>ไม่มีข้อมูล</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                            {isReportDatePast3Days && (
                                <div style={{
                                    background: '#fff7ed',
                                    border: '1px solid #fed7aa',
                                    borderRadius: '16px',
                                    padding: '1.25rem',
                                    marginBottom: '2rem',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '1rem',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                }}>
                                    <div style={{ background: '#ffedd5', padding: '10px', borderRadius: '12px', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Lock size={20} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: '0 0 4px 0', color: '#c2410c', fontSize: '0.95rem', fontWeight: 900 }}>รายงานนี้ถูกล็อกการแก้ไขความคืบหน้าและรูปภาพ</h4>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#ea580c', fontWeight: 600, lineHeight: 1.5 }}>
                                            เนื่องจากวันที่รายงานเกิน 3 วันที่กำหนด คุณสามารถแก้ไขได้เฉพาะข้อมูลแรงงานและการเข้าทำงานเท่านั้น หากต้องการแก้ไขความคืบหน้า รูปภาพ หรือโน้ตหน้างาน กรุณากดที่วันที่รายงานและส่งคำขอปลดล็อกย้อนหลังจากแอดมิน
                                        </p>
                                    </div>
                                </div>
                            )}
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
                                            isEditingExisting ? (
                                                <>
                                                    <button 
                                                        onClick={async () => {
                                                            const confirmSave = window.confirm('คุณต้องการบันทึกการแก้ไขข้อมูลรายงานรายวันนี้ใช่หรือไม่?');
                                                            if (confirmSave) {
                                                                await handleSubmit();
                                                            }
                                                        }}
                                                        disabled={isSubmitting || isUploading}
                                                        style={{ 
                                                            padding: '6px 12px', 
                                                            borderRadius: '8px', 
                                                            border: '1px solid #10b981', 
                                                            background: '#f0fdf4', 
                                                            color: '#10b981', 
                                                            fontSize: '0.75rem', 
                                                            fontWeight: 800, 
                                                            cursor: (isSubmitting || isUploading) ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <CheckCircle2 size={14} /> บันทึกการแก้ไข
                                                    </button>
                                                    <button 
                                                        onClick={handleCancelEdit}
                                                        style={{ 
                                                            padding: '6px 12px', 
                                                            borderRadius: '8px', 
                                                            border: '1px solid #ef4444', 
                                                            background: '#fef2f2', 
                                                            color: '#ef4444', 
                                                            fontSize: '0.75rem', 
                                                            fontWeight: 800, 
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <XCircle size={14} /> ยกเลิก
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={() => setIsEditingExisting(true)}
                                                    style={{ 
                                                        padding: '6px 12px', 
                                                        borderRadius: '8px', 
                                                        border: '1px solid #6366f1', 
                                                        background: '#fff', 
                                                        color: '#6366f1', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 800, 
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Edit2 size={14} /> แก้ไขข้อมูล
                                                </button>
                                            )
                                        )}
                                        {isEditingExisting && (
                                            <>
                                                <button onClick={() => setActiveModal('Internal')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> คนงานบริษัท (Internal)</button>
                                                <button onClick={() => setActiveModal('Outsource')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> ทีมงานผู้รับเหมา (Subco)</button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflowX: 'auto' }}>
                                    {labor.length === 0 ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 700 }}>
                                            <Users size={32} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                                            <div>ยังไม่มีข้อมูลแรงงาน (กรุณากดปุ่มเพิ่มคนงานด้านบน)</div>
                                        </div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                    <th style={{ padding: '12px 10px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textAlign: 'center', width: '50px' }}>No.</th>
                                                    <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', minWidth: '220px' }}>ชื่อแรงงาน</th>
                                                    <th style={{ padding: '12px 10px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textAlign: 'center', width: '140px' }}>เวลาทำงานปกติ</th>
                                                    <th style={{ padding: '12px 10px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textAlign: 'center', width: '140px' }}>OT : เช้า</th>
                                                    <th style={{ padding: '12px 10px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textAlign: 'center', width: '140px' }}>OT : เที่ยง</th>
                                                    <th style={{ padding: '12px 10px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textAlign: 'center', width: '140px' }}>OT : เย็น</th>
                                                    <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', minWidth: '200px' }}>Leave : ลา</th>
                                                    <th style={{ padding: '12px 10px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textAlign: 'center', width: '80px' }}>จัดการ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {labor.map((l, idx) => (
                                                    <tr key={l.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'all 0.15s' }}>
                                                        <td style={{ padding: '12px 10px', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textAlign: 'center' }}>{idx + 1}</td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: l.membership === 'Internal' ? '#eff6ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                    {l.membership === 'Internal' ? <User size={14} color="#2563eb" /> : <HardHat size={14} color="#059669" />}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                                                                        {l.employeeId ? `${l.employeeId} : ` : ''}{l.staffName || l.affiliation}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>
                                                                        {l.membership === 'Internal' ? 'คนงานบริษัท (Internal)' : 'ทีมงานผู้รับเหมา (Subco)'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        
                                                        {/* Normal Shift */}
                                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                <div 
                                                                    onClick={() => isEditingExisting && toggleShift(l.id, 'normal')} 
                                                                    style={{ 
                                                                        width: 18, height: 18, borderRadius: 4, 
                                                                        border: '2px solid #2563eb', 
                                                                        background: l.shifts?.normal ? '#2563eb' : '#fff', 
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                                        cursor: isEditingExisting ? 'pointer' : 'default',
                                                                        opacity: isEditingExisting ? 1 : 0.6
                                                                    }}
                                                                >
                                                                    {l.shifts?.normal && <CheckCircle2 size={12} color="#fff" />}
                                                                </div>
                                                                {l.shifts?.normal ? (
                                                                    l.membership === 'Internal' ? renderTimeInput(l.id, 'normal', l.shiftTimes?.day || '08:00 - 17:00') : (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                                                                            <Clock size={12} /> 08:00 - 17:00
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    <span style={{ color: '#cbd5e1', fontWeight: 800 }}>-</span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* OT Morning */}
                                                        {(() => {
                                                            const otMorningTime = l.shiftTimes?.otMorning || '06:00 - 08:00';
                                                            const isOtMorningBlockedByLeave = l.leave?.active ? isTimeOverlap(otMorningTime, l.leave.time || '08:00 - 17:00') : false;
                                                            const canTickOtMorning = isEditingExisting && l.shifts?.normal && !isOtMorningBlockedByLeave;
                                                            return (
                                                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                        <div
                                                                            onClick={() => canTickOtMorning && toggleShift(l.id, 'otMorning')}
                                                                            title={isOtMorningBlockedByLeave ? 'โอทีเช้าทับกับเวลาลา' : undefined}
                                                                            style={{
                                                                                width: 18, height: 18, borderRadius: 4,
                                                                                border: `2px solid ${isOtMorningBlockedByLeave ? '#fca5a5' : '#f59e0b'}`,
                                                                                background: l.shifts?.otMorning ? '#f59e0b' : (isOtMorningBlockedByLeave ? '#fef2f2' : '#fff'),
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                cursor: canTickOtMorning ? 'pointer' : 'not-allowed',
                                                                                opacity: canTickOtMorning || l.shifts?.otMorning ? 1 : 0.4
                                                                            }}
                                                                        >
                                                                            {l.shifts?.otMorning && <CheckCircle2 size={12} color="#fff" />}
                                                                        </div>
                                                                        {l.shifts?.otMorning ? (
                                                                            l.membership === 'Internal' ? renderTimeInput(l.id, 'otMorning', otMorningTime) : (
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                                                                                    <Clock size={12} /> 06:00 - 08:00
                                                                                </div>
                                                                            )
                                                                        ) : (
                                                                            <span style={{ color: isOtMorningBlockedByLeave ? '#fca5a5' : '#cbd5e1', fontWeight: 800, fontSize: '0.65rem' }}>{isOtMorningBlockedByLeave ? '🚫' : '-'}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })()}

                                                        {/* OT Noon */}
                                                        {(() => {
                                                            const isOtNoonBlockedByLeave = l.leave?.active ? isTimeOverlap('12:00 - 13:00', l.leave.time || '08:00 - 17:00') : false;
                                                            const canTickOtNoon = isEditingExisting && l.shifts?.normal && !isOtNoonBlockedByLeave;
                                                            return (
                                                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                        <div
                                                                            onClick={() => canTickOtNoon && toggleShift(l.id, 'otNoon')}
                                                                            title={isOtNoonBlockedByLeave ? 'โอทีเที่ยงทับกับเวลาลา' : undefined}
                                                                            style={{
                                                                                width: 18, height: 18, borderRadius: 4,
                                                                                border: `2px solid ${isOtNoonBlockedByLeave ? '#fca5a5' : '#f59e0b'}`,
                                                                                background: l.shifts?.otNoon ? '#f59e0b' : (isOtNoonBlockedByLeave ? '#fef2f2' : '#fff'),
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                cursor: canTickOtNoon ? 'pointer' : 'not-allowed',
                                                                                opacity: canTickOtNoon || l.shifts?.otNoon ? 1 : 0.4
                                                                            }}
                                                                        >
                                                                            {l.shifts?.otNoon && <CheckCircle2 size={12} color="#fff" />}
                                                                        </div>
                                                                        {l.shifts?.otNoon ? (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                                                                                <Clock size={12} /> 12:00 - 13:00
                                                                            </div>
                                                                        ) : (
                                                                            <span style={{ color: isOtNoonBlockedByLeave ? '#fca5a5' : '#cbd5e1', fontWeight: 800, fontSize: '0.65rem' }}>{isOtNoonBlockedByLeave ? '🚫' : '-'}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })()}

                                                        {/* OT Evening */}
                                                        {(() => {
                                                            const otEveningTime = l.shiftTimes?.otEvening || '18:00 - 21:00';
                                                            const isOtEveningBlockedByLeave = l.leave?.active ? isTimeOverlap(otEveningTime, l.leave.time || '08:00 - 17:00') : false;
                                                            const canTickOtEvening = isEditingExisting && l.shifts?.normal && !isOtEveningBlockedByLeave;
                                                            return (
                                                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                        <div
                                                                            onClick={() => canTickOtEvening && toggleShift(l.id, 'otEvening')}
                                                                            title={isOtEveningBlockedByLeave ? 'โอทีเย็นทับกับเวลาลา' : undefined}
                                                                            style={{
                                                                                width: 18, height: 18, borderRadius: 4,
                                                                                border: `2px solid ${isOtEveningBlockedByLeave ? '#fca5a5' : '#f59e0b'}`,
                                                                                background: l.shifts?.otEvening ? '#f59e0b' : (isOtEveningBlockedByLeave ? '#fef2f2' : '#fff'),
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                cursor: canTickOtEvening ? 'pointer' : 'not-allowed',
                                                                                opacity: canTickOtEvening || l.shifts?.otEvening ? 1 : 0.4
                                                                            }}
                                                                        >
                                                                            {l.shifts?.otEvening && <CheckCircle2 size={12} color="#fff" />}
                                                                        </div>
                                                                        {l.shifts?.otEvening ? (
                                                                            l.membership === 'Internal' ? renderTimeInput(l.id, 'otEvening', otEveningTime) : (
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                                                                                    <Clock size={12} /> 18:00 - 21:00
                                                                                </div>
                                                                            )
                                                                        ) : (
                                                                            <span style={{ color: isOtEveningBlockedByLeave ? '#fca5a5' : '#cbd5e1', fontWeight: 800, fontSize: '0.65rem' }}>{isOtEveningBlockedByLeave ? '🚫' : '-'}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })()}

                                                        {/* Leave : ลา */}
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div 
                                                                    onClick={() => {
                                                                        if (!isEditingExisting) return;
                                                                        setLabor(prev => prev.map(item => {
                                                                            if (item.id === l.id) {
                                                                                const leaveActive = !item.leave?.active;
                                                                                let updatedTimes = item.shiftTimes ? { ...item.shiftTimes } : { day: '08:00 - 17:00' };
                                                                                let shiftsObj = item.shifts ? { ...item.shifts } : { normal: false, otMorning: false, otNoon: false, otEvening: false };
                                                                                const leaveTime = item.leave?.time || '08:00 - 17:00';
                                                                                
                                                                                if (leaveActive) {
                                                                                    if (leaveTime === '08:00 - 12:00') {
                                                                                        if (updatedTimes.day === '08:00 - 17:00' && shiftsObj.normal) updatedTimes.day = '13:00 - 17:00';
                                                                                    } else if (leaveTime === '13:00 - 17:00') {
                                                                                        if (updatedTimes.day === '08:00 - 17:00' && shiftsObj.normal) updatedTimes.day = '08:00 - 12:00';
                                                                                    }
                                                                                    const regTime = updatedTimes.day || '08:00 - 17:00';
                                                                                    if (shiftsObj.normal && isTimeOverlap(leaveTime, regTime)) {
                                                                                        shiftsObj.normal = false;
                                                                                        shiftsObj.otMorning = false;
                                                                                        shiftsObj.otNoon = false;
                                                                                        shiftsObj.otEvening = false;
                                                                                    }
                                                                                }
                                                                                return {
                                                                                    ...item,
                                                                                    shifts: shiftsObj,
                                                                                    shiftTimes: updatedTimes,
                                                                                    leave: {
                                                                                        active: leaveActive,
                                                                                        time: leaveTime,
                                                                                        medCertFileUrl: item.leave?.medCertFileUrl || ''
                                                                                    }
                                                                                };
                                                                            }
                                                                            return item;
                                                                        }));
                                                                    }} 
                                                                    style={{ 
                                                                        width: 18, height: 18, borderRadius: 4, 
                                                                        border: '2px solid #ef4444', 
                                                                        background: l.leave?.active ? '#ef4444' : '#fff', 
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                                        cursor: isEditingExisting ? 'pointer' : 'default',
                                                                        opacity: isEditingExisting ? 1 : 0.6
                                                                    }}
                                                                >
                                                                    {l.leave?.active && <CheckCircle2 size={12} color="#fff" />}
                                                                </div>
                                                                {l.leave?.active ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        {/* Leave Time */}
                                                                        {renderLeaveTimeInput(l.id, l.leave?.time || '08:00 - 17:00')}
                                                                        
                                                                        {/* Attachment Upload & Action Icons */}
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            {l.leave?.medCertFileUrl ? (
                                                                                <>
                                                                                    <a 
                                                                                        href={l.leave.medCertFileUrl} 
                                                                                        target="_blank" 
                                                                                        rel="noreferrer" 
                                                                                        style={{ 
                                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                                                            width: '24px', height: '24px', borderRadius: '6px', 
                                                                                            background: '#eff6ff', color: '#2563eb', transition: 'all 0.2s'
                                                                                        }}
                                                                                        title="ดูใบรับรองแพทย์"
                                                                                    >
                                                                                        <Eye size={12} />
                                                                                    </a>
                                                                                    {isEditingExisting && (
                                                                                        <button 
                                                                                            onClick={() => handleRemoveLeaveCert(l.id)} 
                                                                                            style={{ 
                                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                                                                width: '24px', height: '24px', borderRadius: '6px', 
                                                                                                background: '#fef2f2', color: '#ef4444', border: 'none', 
                                                                                                cursor: 'pointer', transition: 'all 0.2s', padding: 0
                                                                                            }}
                                                                                            title="ลบรูปแนบ"
                                                                                        >
                                                                                            <Trash2 size={12} />
                                                                                        </button>
                                                                                    )}
                                                                                </>
                                                                            ) : (
                                                                                isEditingExisting ? (
                                                                                    uploadingLeaveCertId === l.id ? (
                                                                                        // Loading spinner while uploading
                                                                                        <div
                                                                                            style={{
                                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                                width: '24px', height: '24px', borderRadius: '6px',
                                                                                                background: '#fef3c7'
                                                                                            }}
                                                                                            title="กำลังอัปโหลด..."
                                                                                        >
                                                                                            <svg
                                                                                                width="12" height="12" viewBox="0 0 24 24"
                                                                                                style={{ animation: 'spin 0.8s linear infinite' }}
                                                                                            >
                                                                                                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                                                                                                <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="3" fill="none" strokeDasharray="31.4" strokeDashoffset="10" />
                                                                                            </svg>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <label
                                                                                            style={{
                                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                                width: '24px', height: '24px', borderRadius: '6px',
                                                                                                background: '#f1f5f9', color: '#64748b', cursor: 'pointer',
                                                                                                transition: 'all 0.2s'
                                                                                            }}
                                                                                            title="แนบใบรับรองแพทย์/หลักฐาน"
                                                                                        >
                                                                                            <Paperclip size={12} />
                                                                                            <input
                                                                                                type="file"
                                                                                                accept="image/*"
                                                                                                style={{ display: 'none' }}
                                                                                                onChange={(e) => handleUploadLeaveCert(l.id, e.target.files?.[0] || null)}
                                                                                            />
                                                                                        </label>
                                                                                    )
                                                                                ) : (
                                                                                    <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>ไม่มีหลักฐาน</span>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ color: '#cbd5e1', fontWeight: 800 }}>-</span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Actions (Delete Row) */}
                                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                                            {isEditingExisting ? (
                                                                <button 
                                                                    onClick={() => setLabor(labor.filter(item => item.id !== l.id))} 
                                                                    style={{
                                                                        background: 'none', border: 'none', cursor: 'pointer', 
                                                                        color: '#ef4444', transition: 'all 0.2s', padding: '4px'
                                                                    }}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>ล็อกแล้ว</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </section>

                            {/* ปรับสัดส่วน Grid ให้ช่องความคืบหน้าแคบลง และช่องรูปถ่ายกว้างขึ้นเพื่อปุ่มแท็บจะไม่ตกบรรทัดใหม่ */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) 2.8fr', gap: '2.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={20} color="#10b981" /> ความคืบหน้า</h3>
                                    <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                                            <div style={{ flex: 1, position: 'relative', opacity: isProgressNotePhotosEditable ? 1 : 0.6, pointerEvents: isProgressNotePhotosEditable ? 'auto' : 'none', transition: 'all 0.3s' }}>
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
                                                    disabled={!isProgressNotePhotosEditable}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value, 10);
                                                        if (isNaN(val)) {
                                                            setProgress(0);
                                                        } else {
                                                            setProgress(Math.min(100, Math.max(0, val)));
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        setProgress(Math.min(progressBounds.max, Math.max(progressBounds.min, progress)));
                                                    }}
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
                                            {isProgressNotePhotosEditable && progress > 0 && <button onClick={() => setProgress(0)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>ล้างค่า</button>}
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1rem', pointerEvents: isProgressNotePhotosEditable ? 'auto' : 'none', opacity: isProgressNotePhotosEditable ? 1 : 0.6 }}>
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

                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Camera size={20} color="#3b82f6" /> รูปถ่ายรายงานผล
                                    </h3>

                                    {/* === LB-Style Pill Tab Buttons === */}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                                        {[
                                            { id: 'site' as const, label: 'รูปถ่ายหน้างาน', required: 2, current: sitePhotos.filter(Boolean).length, isMinimum: true, show: true },
                                            { id: 'regular' as const, label: 'กะปกติ', required: 4, current: laborRegularPhotos.filter(Boolean).length, isMinimum: false, show: labor.some(l => l.shifts?.normal) },
                                            { id: 'otMorning' as const, label: 'OT เช้า', required: 2, current: laborOtMorningPhotos.filter(Boolean).length, isMinimum: false, show: labor.some(l => l.shifts?.otMorning) },
                                            { id: 'otNoon' as const, label: 'OT เที่ยง', required: 2, current: laborOtNoonPhotos.filter(Boolean).length, isMinimum: false, show: labor.some(l => l.shifts?.otNoon) },
                                            { id: 'otEvening' as const, label: 'OT เย็น', required: 2, current: laborOtEveningPhotos.filter(Boolean).length, isMinimum: false, show: labor.some(l => l.shifts?.otEvening) },
                                        ].filter(tab => tab.show).map(tab => {
                                            const isComplete = tab.current >= tab.required;
                                            const isActive = activePhotoTab === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActivePhotoTab(tab.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '10px 12px', borderRadius: '14px', border: '2px solid',
                                                        borderColor: isActive ? (isComplete ? '#059669' : '#334155') : (isComplete ? '#10b981' : '#cbd5e1'),
                                                        background: isActive ? (isComplete ? '#d1fae5' : '#f1f5f9') : (isComplete ? '#ecfdf5' : '#ffffff'),
                                                        color: isComplete ? '#059669' : '#475569',
                                                        cursor: 'pointer', textAlign: 'left',
                                                        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                                                        transform: isActive ? 'scale(1.02)' : 'scale(1)',
                                                        boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                                                        minWidth: '135px',
                                                    }}
                                                >
                                                    <span style={{ flexShrink: 0 }}>
                                                        {isComplete
                                                            ? <CheckCircle2 size={18} color="#059669" />
                                                            : <Camera size={18} color="#94a3b8" />}
                                                    </span>
                                                    <span style={{ flex: 1 }}>
                                                        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, lineHeight: 1.2 }}>{tab.label}</span>
                                                        <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: isComplete ? '#059669' : '#94a3b8', marginTop: '2px' }}>
                                                            แนบแล้ว {tab.current}/{tab.required} รูป{tab.isMinimum ? ' (ขั้นต่ำ)' : ''}
                                                        </span>
                                                    </span>
                                                    <ChevronRight size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* === Active Tab Content === */}
                                    <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', minHeight: '160px' }}>

                                        {/* Site Photos: Free upload grid */}
                                        {activePhotoTab === 'site' && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>
                                                {sitePhotos.filter(Boolean).map((p, i) => (
                                                    <div key={i} style={{ position: 'relative', width: 110, height: 110, borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                                                        <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setZoomImage(p)} alt="" />
                                                        {isProgressNotePhotosEditable && (
                                                            <button onClick={() => handleRemoveSlotPhoto('site', i)} style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Trash2 size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {isProgressNotePhotosEditable && (
                                                    <label style={{ width: 110, height: 110, border: '2px dashed #3b82f6', borderRadius: 14, background: '#eff6ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', cursor: isUploading ? 'not-allowed' : 'pointer', gap: '6px', transition: 'all 0.2s', opacity: isUploading ? 0.6 : 1 }}>
                                                        {isUploading ? <Loader2 className="animate-spin" size={22} /> : <Camera size={22} />}
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 900, textAlign: 'center' }}>{isUploading ? 'กำลังอัป...' : 'เพิ่มรูป'}</span>
                                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleSlotPhotoUpload('site', sitePhotos.length, e)} disabled={isUploading} />
                                                    </label>
                                                )}
                                                {sitePhotos.filter(Boolean).length === 0 && (
                                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, padding: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <AlertCircle size={14} color="#ef4444" /> ยังไม่มีรูปภาพหน้างาน — กรุณาแนบอย่างน้อย 2 รูป
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Shift Photos: Slot-based with labels */}
                                        {(['regular', 'otMorning', 'otNoon', 'otEvening'] as const).map(shiftKey => {
                                            if (activePhotoTab !== shiftKey) return null;

                                            // Derive time labels from labor shiftTimes
                                            const getShiftTime = (key: 'day' | 'otMorning' | 'otNoon' | 'otEvening') => {
                                                const times = labor.filter(l => l.shifts?.[key === 'day' ? 'normal' : key]).map(l => l.shiftTimes?.[key]).filter(Boolean);
                                                return times[0] || '';
                                            };
                                            const parseStart = (range: string) => range?.split(' - ')[0] || '';
                                            const parseEnd = (range: string) => range?.split(' - ')[1] || '';

                                            let slotLabels: string[];
                                            if (shiftKey === 'regular') {
                                                const dayRange = getShiftTime('day');
                                                const startT = parseStart(dayRange);
                                                const endT = parseEnd(dayRange);
                                                slotLabels = [
                                                    startT ? `เช้า (${startT})` : 'เช้า',
                                                    'พักเที่ยง (12:00)',
                                                    'เข้าบ่าย (13:00)',
                                                    endT ? `ออก (${endT})` : 'ออก',
                                                ];
                                            } else {
                                                const otKey = shiftKey as 'otMorning' | 'otNoon' | 'otEvening';
                                                const otRange = getShiftTime(otKey);
                                                const startT = parseStart(otRange);
                                                const endT = parseEnd(otRange);
                                                slotLabels = [
                                                    startT ? `เข้า (${startT})` : 'เข้า',
                                                    endT ? `ออก (${endT})` : 'ออก',
                                                ];
                                            }

                                            const shiftPhotos = {
                                                regular: laborRegularPhotos,
                                                otMorning: laborOtMorningPhotos,
                                                otNoon: laborOtNoonPhotos,
                                                otEvening: laborOtEveningPhotos,
                                            }[shiftKey];
                                            return (
                                                <div key={shiftKey} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                    {slotLabels.map((slotLabel, slotIdx) => {
                                                        const photoUrl = shiftPhotos[slotIdx];
                                                        return (
                                                            <div key={slotIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                                {photoUrl ? (
                                                                    <div style={{ position: 'relative', width: 120, height: 120, borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                                                                        <img src={photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setZoomImage(photoUrl)} alt={slotLabel} />
                                                                        {isProgressNotePhotosEditable && (
                                                                            <button onClick={() => handleRemoveSlotPhoto(shiftKey, slotIdx)} style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                <Trash2 size={11} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : isProgressNotePhotosEditable ? (
                                                                    <label style={{ width: 120, height: 120, border: '2px dashed #cbd5e1', borderRadius: 14, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: isUploading ? 'not-allowed' : 'pointer', gap: '6px', transition: 'all 0.2s', opacity: isUploading ? 0.6 : 1 }}>
                                                                        {isUploading ? <Loader2 className="animate-spin" size={22} /> : <Camera size={22} />}
                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textAlign: 'center' }}>แนบรูป</span>
                                                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleSlotPhotoUpload(shiftKey, slotIdx, e)} disabled={isUploading} />
                                                                    </label>
                                                                ) : (
                                                                    <div style={{ width: 120, height: 120, border: '1px dashed #e2e8f0', borderRadius: 14, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
                                                                        <Camera size={22} />
                                                                    </div>
                                                                )}
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#475569', background: photoUrl ? '#d1fae5' : '#f1f5f9', padding: '3px 12px', borderRadius: '6px', border: `1px solid ${photoUrl ? '#6ee7b7' : '#e2e8f0'}` }}>
                                                                    {photoUrl ? '✓ ' : ''}{slotLabel}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '2.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>หมายเหตุ (Site Notes)</h3>
                                    
                                    {/* Problem Toggle */}
                                    <div 
                                        onClick={() => isProgressNotePhotosEditable && setReportType(prev => prev === 'Problem' ? 'Update' : 'Problem')}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '10px', 
                                            padding: '8px 16px', 
                                            borderRadius: '12px',
                                            background: reportType === 'Problem' ? '#fef2f2' : '#f8fafc',
                                            border: reportType === 'Problem' ? '1px solid #ef4444' : '1px solid #e2e8f0',
                                            cursor: isProgressNotePhotosEditable ? 'pointer' : 'default',
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
                                    disabled={!isProgressNotePhotosEditable}
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
                                                    const totalManpower = h.labor.reduce((acc: number, l: any) => acc + (Number(l.amount) || 1), 0);
                                                    return (
                                                        <div 
                                                            key={h.id} 
                                                            onClick={() => handleDateChange(h.date.split('T')[0])}
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
                        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
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
                            {(!hasHistoryForSelectedDate || isEditingExisting) && (
                                <>
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
                                </>
                            )}
                        </div>

                    </>
                )}
            </div>
            {/* Image Zoom Lightbox Overlay */}
            {zoomImage && (
                <div 
                    onClick={() => setZoomImage(null)}
                    style={{ 
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                        backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)',
                        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' 
                    }}
                >
                    <img 
                        src={zoomImage} 
                        style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} 
                        alt="Zoomed view" 
                    />
                </div>
            )}

            {modalAlert && modalAlert.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000, padding: '2rem', animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.4)', borderRadius: '24px',
                        padding: '2.5rem', maxWidth: '480px', width: '100%', textAlign: 'center',
                        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.1)',
                        animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '20px',
                            background: modalAlert.type === 'success' 
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                                : modalAlert.type === 'warning'
                                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                    : modalAlert.type === 'error'
                                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                        : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem auto', boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                        }}>
                            {modalAlert.type === 'success' ? <CheckCircle2 size={32} /> :
                             modalAlert.type === 'warning' ? <AlertCircle size={32} /> :
                             modalAlert.type === 'error' ? <XCircle size={32} /> : <Info size={32} />}
                        </div>
                        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{modalAlert.title}</h3>
                        <p style={{ margin: '0 0 2rem 0', fontSize: '0.95rem', color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>{modalAlert.message}</p>
                        <button
                            onClick={() => setModalAlert(null)}
                            style={{
                                width: '100%', padding: '12px 24px', background: '#0f172a', color: '#ffffff',
                                border: 'none', borderRadius: '14px', fontSize: '0.95rem', fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
                            }}
                        >
                            ตกลง
                        </button>
                    </div>
                </div>
            )}

            {isReviewModalOpen && reviewTaskInfo && (
                <TaskReviewModal
                    isOpen={isReviewModalOpen}
                    onClose={() => {
                        setIsReviewModalOpen(false);
                        setReviewTaskInfo(null);
                    }}
                    workOrder={reviewTaskInfo.wo}
                    task={reviewTaskInfo.task}
                    onConfirm={handleConfirmReview}
                />
            )}

            {isCustomerMockupOpen && mockupWorkOrder && (
                <CustomerInspectionMockup
                    isOpen={isCustomerMockupOpen}
                    onClose={() => {
                        setIsCustomerMockupOpen(false);
                        setMockupWorkOrder(null);
                    }}
                    workOrder={mockupWorkOrder}
                    onSubmitInspection={async (approvals, survey) => {
                        await submitCustomerInspection(mockupWorkOrder.id, approvals, survey);
                    }}
                />
            )}
        </div>
    );
};

export default DailyReport;
