import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Camera, ClipboardCheck, Wrench, ChevronDown, Loader2 } from 'lucide-react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { db, storage } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageCompression';
import { logService } from '../services/logService';
import { Project, WorkOrder, Category, WorkOrderType, MasterTask } from '../types';
import LoadingOverlay from './LoadingOverlay';

// Helper to get all categories for dropdown
const CATEGORIES_LIST = [
    'หมวดงานทั่วไป (General)',
    'งานโครงสร้าง',
    'งานปูนฉาบ/ผิวพื้นผนัง',
    'งานกระเบื้อง/สุขภัณฑ์',
    'งานไฟฟ้า',
    'งานระบบประปา/สุขาภิบาล',
    'งานสี/เคลือบผิว',
    'งานฝ้าเพดาน',
    'งานบานประตู/หน้าต่าง',
    'งานอลูมิเนียม/มุ้งลวด',
    'งานเฟอร์นิเจอร์บิวท์อิน',
    'งานระบบปรับอากาศ (Air)',
    'งานระบบโทรศัพท์/อินเตอร์เน็ต',
    'งานระบบแจ้งเหตุเพลิงใหม่',
    'งานระบบความปลอดภัย',
    'งานพื้น/พื้นไม้ลามิเนต',
];

interface ForemanReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    locationName?: string; // Pre-filled if coming from a unit
    initialWorkType?: WorkOrderType;
    editWorkOrder?: WorkOrder; // ✅ Add this to support editing drafts
}

const ForemanReportModal = ({ isOpen, onClose, locationName = '', initialWorkType = 'AfterSale', editWorkOrder }: ForemanReportModalProps) => {
    const { addWorkOrder, staff: allStaff } = useWorkOrders();
    const { user } = useAuth();
    const { sendNotification } = useNotifications();
    const [allProjects, setAllProjects] = useState<Project[]>([]);

    // ✅ Real-time Sync Projects from Firestore
    useEffect(() => {
        if (!isOpen) return;
        const unsub = onSnapshot(collection(db, 'projects'), (snap) => {
            setAllProjects(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Project));
        });
        return () => unsub();
    }, [isOpen]);

    // ✅ Filter projects based on user assignment
    const projects = user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'BackOffice'
        ? allProjects
        : allProjects.filter(p => user?.assignedProjects?.includes(p.code));

    // Form State
    const [formState, setFormState] = useState({
        projectId: '',
        reporterName: user?.name || '', // ✅ Pre-fill with user's name
        reporterPhone: '',
        reportDate: new Date().toISOString().split('T')[0], // Default Today
        location: locationName,
        building: '',
        floor: '',
        room: '',
        description: '',
        type: initialWorkType,
        id: editWorkOrder?.id || `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}` // ✅ Stable ID for storage path
    });

    const [step, setStep] = useState<'form' | 'preview' | 'success'>('form'); // ✅ New multi-step state
    const [isPreviewDraft, setIsPreviewDraft] = useState(false); // ✅ Distinguish between Draft and Submit
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Fix: Lock button during submission
    const [showProjectError, setShowProjectError] = useState(false); // ✅ Track missing project error
    // Actually, I'll use a simpler approach with state to track which item is being uploaded
    const [uploadTarget, setUploadTarget] = useState<{ groupId: string, itemId: string } | null>(null);

    // Defect State Interfaces
    interface DefectItem extends Partial<MasterTask> {
        id: string;
        position: string;
        detail: string;
        amount: number;
        unit: string;
        images: string[];
    }

    interface DefectGroup {
        id: string;
        category: string;
        items: DefectItem[];
    }

    // State: Groups of defects
    const [groups, setGroups] = useState<DefectGroup[]>([
        {
            id: crypto.randomUUID(),
            category: CATEGORIES_LIST[0],
            items: [{ id: crypto.randomUUID(), position: '', detail: '', amount: 1, unit: 'จุด', images: [] }]
        }
    ]);

    // Update type when prop changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('form'); // Reset to form step when opening
            setIsPreviewDraft(false); // Reset preview mode
            if (editWorkOrder) {
                // ✅ Edit Mode: Load existing data
                setFormState({
                    projectId: editWorkOrder.projectId,
                    reporterName: editWorkOrder.reporterName,
                    reporterPhone: editWorkOrder.reporterPhone,
                    reportDate: editWorkOrder.reportDate || new Date().toISOString().split('T')[0],
                    location: editWorkOrder.locationName,
                    building: editWorkOrder.building || '',
                    floor: editWorkOrder.floor || '',
                    room: editWorkOrder.room || '',
                    description: editWorkOrder.initialProblem || '',
                    type: editWorkOrder.type,
                    id: editWorkOrder.id
                });
                // Map Categories back to Groups
                setGroups((editWorkOrder.categories || []).map(cat => ({
                    id: cat.id,
                    category: cat.name,
                    items: (cat.tasks || []).map(task => ({
                        ...task, // Preserve ALL fields...
                        id: task.id,
                        position: task.position || '',
                        detail: task.name,
                        amount: task.amount || 1,
                        unit: task.unit || 'จุด',
                        images: task.images && task.images.length > 0
                            ? task.images
                            : [
                                task.beforePhotoUrl,
                                task.latestPhotoUrl,
                                task.afterPhotoUrl,
                                ...(task.attachments?.map(a => a.url) || [])
                            ].filter(url => url && typeof url === 'string') as string[]
                    }))
                })));
            } else {
                // New Mode: Reset
                setFormState(prev => ({
                    ...prev,
                    type: initialWorkType,
                    description: '',
                    reporterName: user?.name || '',
                    reporterPhone: '',
                    projectId: '',
                    location: locationName,
                    id: `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}` // ✅ Proper reset
                }));
                setGroups([{
                    id: crypto.randomUUID(),
                    category: CATEGORIES_LIST[0],
                    items: [{ id: crypto.randomUUID(), position: '', detail: '', amount: 1, unit: 'จุด', images: [] }]
                }]);
            }
        }
    }, [isOpen, initialWorkType, user?.name, editWorkOrder]);

    // Handlers
    const addGroup = () => {
        setGroups([...groups, {
            id: crypto.randomUUID(),
            category: CATEGORIES_LIST[0],
            items: [{ id: crypto.randomUUID(), position: '', detail: '', amount: 1, unit: 'จุด', images: [] }]
        }]);
    };

    const removeGroup = (groupId: string) => {
        if (groups.length > 1) {
            setGroups(groups.filter(g => g.id !== groupId));
        }
    };

    const updateGroupCategory = (groupId: string, newCategory: string) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, category: newCategory } : g));
    };

    const addItemToGroup = (groupId: string) => {
        setGroups(groups.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    items: [...g.items, { id: crypto.randomUUID(), position: '', detail: '', amount: 1, unit: 'จุด', images: [] }]
                };
            }
            return g;
        }));
    };

    const removeItemFromGroup = (groupId: string, itemId: string) => {
        setGroups(groups.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    items: g.items.filter(i => i.id !== itemId)
                };
            }
            return g;
        }));
    };

    const updateItem = (groupId: string, itemId: string, field: keyof DefectItem, value: any) => {
        setGroups(groups.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    items: g.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
                };
            }
            return g;
        }));
    };

    // Real Image Upload with Compression
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTarget) return;

        setIsUploading(true);
        try {
            const { groupId, itemId } = uploadTarget;
            const fileExt = file.name.split('.').pop();
            const fileName = `defect_${Date.now()}.${fileExt}`;
            const storagePath = `work_orders/${formState.id}/defects/${fileName}`;
            const storageRef = ref(storage, storagePath);

            // 1. บีบอัดรูปภาพก่อนอัปโหลด (ประหยัดพื้นที่และ Egress)
            const compressedFile = await compressImage(file, 1280, 0.7);

            // 2. ตั้งค่า Cache Control 
            const metadata = {
                cacheControl: 'public, max-age=31536000',
                contentType: compressedFile.type || 'image/jpeg',
            };

            const snapshot = await uploadBytes(storageRef, compressedFile, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setGroups(groups.map(g => {
                if (g.id === groupId) {
                    return {
                        ...g,
                        items: g.items.map(i => {
                            if (i.id === itemId) {
                                return { ...i, images: [...i.images, downloadURL] };
                            }
                            return i;
                        })
                    };
                }
                return g;
            }));
        } catch (error) {
            console.error('Upload failed:', error);
            alert('อัปโหลดรูปภาพไม่สำเร็จ');
        } finally {
            setIsUploading(false);
            setUploadTarget(null);
            if (e.target) e.target.value = ''; // Reset input
        }
    };

    const triggerUpload = (groupId: string, itemId: string) => {
        setUploadTarget({ groupId, itemId });
        document.getElementById('hidden-file-input')?.click();
    };

    const removeImage = (groupId: string, itemId: string, imgIndex: number) => {
        setGroups(groups.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    items: g.items.map(i => {
                        if (i.id === itemId) {
                            return { ...i, images: i.images.filter((_, idx) => idx !== imgIndex) };
                        }
                        return i;
                    })
                };
            }
            return g;
        }));
    };

    const handleSave = async (isDraft: boolean = false) => {
        if (isSubmitting) return; // ✅ Prevent multiple clicks
        setIsSubmitting(true);

        setShowProjectError(false);
        // Determine submittedAt logic
        let finalSubmittedAt = editWorkOrder?.submittedAt || null;
        if (!isDraft) {
            if (!editWorkOrder || editWorkOrder.status === 'Rejected' || editWorkOrder.status === 'Draft') {
                // New WO, Re-submitting a Rejected WO, or Submitting a Draft for the first time -> Update queue time
                finalSubmittedAt = new Date().toISOString();
            }
            // else: if status is 'Evaluating', finalSubmittedAt stays as is (preserved place in queue)
        }

        // Construct WorkOrder
        const newWorkOrder: WorkOrder = {
            id: formState.id,
            projectId: formState.projectId,
            reporterName: formState.reporterName,
            reporterId: editWorkOrder?.reporterId || user?.id || 'unknown',
            reporterPhone: formState.reporterPhone,
            reportDate: formState.reportDate,
            locationName: `${formState.building} ${formState.floor} ${formState.room}`.trim() || formState.location,
            type: formState.type,
            status: isDraft ? 'Draft' : 'Evaluating',
            createdAt: editWorkOrder?.createdAt || new Date().toISOString(),
            submittedAt: finalSubmittedAt,
            categories: [], // Populated below
            building: formState.building,
            floor: formState.floor,
            room: formState.room,
            initialProblem: formState.description
        };

        // Convert Groups to Categories
        const categories: Category[] = groups.map(group => ({
            id: group.id.startsWith('CAT-') ? group.id : `CAT-${Math.floor(Math.random() * 10000)}`,
            name: group.category,
            tasks: group.items.map(item => {
                const { id: itemId, detail, position, amount, unit, images, ...rest } = item;

                // ✅ Reset status and rootCause for fresh evaluation if submitting (not draft)
                const finalStatus = isDraft ? (item.status || 'Pending') : 'Pending';
                const finalRootCause = isDraft ? (item.rootCause || '') : '';

                return {
                    ...rest,
                    id: itemId.startsWith('TASK-') || itemId.startsWith('MT-') ? itemId : `TASK-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`,
                    name: detail || 'No Detail',
                    status: finalStatus,
                    system: 'AfterSale',
                    rootCause: finalRootCause,
                    position: position,
                    amount: amount,
                    unit: unit,
                    images: images,
                    beforePhotoUrl: images.length > 0 ? images[0] : (item.beforePhotoUrl || null),
                    latestPhotoUrl: images.length > 0 ? images[0] : (item.latestPhotoUrl || null),
                    dailyProgress: item.dailyProgress || 0,
                    description: detail,
                    history: item.history || []
                } as any;
            })
        })).filter(c => c.tasks.length > 0);

        newWorkOrder.categories = categories;

        // ✅ IMPORTANT: Await the creation to ensure data is saved before notifying
        await addWorkOrder(newWorkOrder);

        if (isDraft) {
            onClose();
        } else {
            // ✅ Send Notification to all Admins/Managers
            try {
                // ✅ Recipient Logic: Using Role-Based notifications (Admin roles)
                const isUpdate = !!editWorkOrder;

                await sendNotification({
                    recipientRole: 'Admin', // General role target
                    senderId: user?.id || 'unknown',
                    senderName: user?.name || 'Foreman',
                    title: isUpdate ? 'อัปเดต: ใบงานรอประเมิน' : 'มีใบงานใหม่รอประเมิน',
                    message: isUpdate
                        ? `ใบงาน ${newWorkOrder.id} (${newWorkOrder.locationName}) มีการอัปเดตข้อมูลจาก ${user?.name}`
                        : `ใบงาน ${newWorkOrder.id} (${newWorkOrder.locationName}) ถูกส่งมาจาก ${user?.name}`,
                    type: 'info',
                    targetPath: `/evaluation?id=${newWorkOrder.id}`
                });

                // ✅ Debug Log
                await logService.trackAction({
                    userId: user?.id || 'unknown',
                    userName: user?.name || 'Foreman',
                    role: user?.role || 'Foreman',
                    action: 'UPDATE',
                    module: 'WORK_ORDERS',
                    details: `[NOTIFICATION] ส่งแจ้งเตือนแบบ Role-Based (Admin) สำเร็จ`,
                    targetId: newWorkOrder.id
                });

            } catch (err) {
                console.error("Failed to send notification:", err);
                // Also log the error to Activity Logs
                await logService.trackAction({
                    userId: user?.id || 'unknown',
                    userName: user?.name || 'Foreman',
                    role: user?.role || 'Foreman',
                    action: 'UPDATE',
                    module: 'WORK_ORDERS',
                    details: `[ERROR] แจ้งเตือนล้มเหลว: ${err instanceof Error ? err.message : String(err)}`,
                    targetId: newWorkOrder.id
                });
            }
            setStep('success'); // ✅ Step 3
        }
        setIsSubmitting(false);
    };

    const isAfterSale = formState.type === 'AfterSale';

    if (!isOpen) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)', // Lighter overlay
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)',
                padding: '20px',
                boxSizing: 'border-box'
            }}
        >
            <LoadingOverlay isVisible={isSubmitting} />
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#ffffff', // Clean White Background
                    width: '100%',
                    maxWidth: '1000px',
                    maxHeight: '90vh',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    fontFamily: "'Inter', 'Sarabun', sans-serif",
                    color: '#111827' // Zinc 900
                }}
            >
                {step === 'success' ? (
                    <div style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ClipboardCheck size={48} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>ส่งข้อมูลเรียบร้อยแล้ว!</h2>
                            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.5 }}>รายการของคุณถูกส่งไปยังระบบเพื่อรอการตรวจสอบประเมินแล้ว<br />คุณสามารถติดตามสถานะได้ที่เมนู "ติดตามผลงาน"</p>
                        </div>
                        <button
                            onClick={onClose}
                            style={{ padding: '12px 32px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.2)' }}
                        >
                            ตกลง
                        </button>
                    </div>
                ) : step === 'preview' ? (
                    <>
                        {/* Summary/Preview Step */}
                        <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: '#4f46e5', padding: '10px', borderRadius: '12px', color: '#fff' }}>
                                    <ClipboardCheck size={24} />
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{isPreviewDraft ? 'ตรวจสอบข้อมูลแบบร่าง (Draft Summary)' : 'ตรวจสอบความถูกต้อง (Summary)'}</h2>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: '#ffffff' }}>
                            <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '4px', height: '16px', background: '#4f46e5', borderRadius: '4px' }}></div> รายละเอียดโครงการ
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>โครงการ</div>
                                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{projects.find(p => p.id === formState.projectId)?.name || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>วันที่</div>
                                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{new Date(formState.reportDate).toLocaleDateString('th-TH')}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>สถานที่</div>
                                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                            {formState.building && `อาคาร ${formState.building} `}
                                            {formState.floor && `ชั้น ${formState.floor} `}
                                            {formState.room && `ห้อง ${formState.room}`}
                                            {!formState.building && !formState.floor && !formState.room && formState.location}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>ผู้แจ้ง</div>
                                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{formState.reporterName} {formState.reporterPhone && `(${formState.reporterPhone})`}</div>
                                    </div>
                                </div>
                            </div>

                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '4px', height: '16px', background: '#f59e0b', borderRadius: '4px' }}></div> รายการงาน ({groups.reduce((acc, g) => acc + g.items.length, 0)} รายการ)
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {groups.map(group => (
                                    <div key={group.id} style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden' }}>
                                        <div style={{ background: '#f1f5f9', padding: '10px 20px', fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                                            {group.category}
                                        </div>
                                        <div style={{ padding: '0 20px' }}>
                                            {group.items.map((item, idx) => (
                                                <div key={item.id} style={{ padding: '16px 0', borderBottom: idx === group.items.length - 1 ? 'none' : '1px dashed #e2e8f0', display: 'flex', gap: '20px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>{item.detail || 'ไม่ได้ระบุรายละเอียด'}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ตำแหน่ง: {item.position || '-'} | จำนวน: {item.amount} {item.unit}</div>
                                                    </div>
                                                    {item.images.length > 0 && (
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            {item.images.slice(0, 3).map((img, i) => (
                                                                <img key={i} src={img} style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
                                                            ))}
                                                            {item.images.length > 3 && (
                                                                <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>+{item.images.length - 3}</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ padding: '24px 32px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button
                                onClick={() => setStep('form')}
                                style={{ padding: '10px 24px', background: '#ffffff', border: '1px solid #d1d5db', color: '#374151', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                            >
                                ย้อนกลับ (Edit)
                            </button>
                            <button
                                onClick={() => handleSave(isPreviewDraft)}
                                disabled={isSubmitting}
                                style={{
                                    padding: '10px 32px',
                                    background: isSubmitting ? '#94a3b8' : '#4f46e5',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {isSubmitting && <Loader2 className="animate-spin" size={20} />}
                                {isPreviewDraft ? 'ยืนยันบันทึกแบบร่าง (Confirm Draft)' : 'ยืนยันส่งข้อมูล (Confirm)'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Header */}
                        <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    background: isAfterSale ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    padding: '10px',
                                    borderRadius: '12px',
                                    color: '#ffffff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: isAfterSale ? '0 4px 12px rgba(99, 102, 241, 0.2)' : '0 4px 12px rgba(16, 185, 129, 0.2)'
                                }}>
                                    {isAfterSale ? <Wrench size={24} /> : <ClipboardCheck size={24} />}
                                </div>
                                <div>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                        {isAfterSale ? 'After Sale Service' : 'Pre-handover Inspection'}
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
                                    width: '44px',
                                    height: '44px',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#000000';
                                    e.currentTarget.style.color = '#ffffff';
                                    e.currentTarget.style.borderColor = '#000000';
                                }}
                                onMouseOut={(e) => {
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

                        {/* Scrollable Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', background: '#ffffff' }}>

                            {/* Section 1: General Info */}
                            <section>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '4px', height: '20px', background: '#6366f1', borderRadius: '4px' }} />
                                    ข้อมูลทั่วไป (General Information)
                                </h3>

                                <div style={{ background: '#f9fafb', padding: '32px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '28px' }}>
                                    {/* Project & Date Row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#4b5563', fontWeight: 600 }}>โครงการ (Project) *</label>
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        background: '#ffffff',
                                                        border: showProjectError ? '2px solid #ef4444' : '1px solid #d1d5db',
                                                        borderRadius: '10px',
                                                        color: '#111827',
                                                        fontSize: '1rem',
                                                        outline: 'none',
                                                        appearance: 'none',
                                                        transition: 'border-color 0.2s'
                                                    }}
                                                    value={formState.projectId}
                                                    onChange={(e) => {
                                                        setFormState({ ...formState, projectId: e.target.value });
                                                        if (e.target.value) setShowProjectError(false);
                                                    }}
                                                >
                                                    <option value="">-- เลือกโครงการ --</option>
                                                    {projects.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                                <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                                                    <ChevronDown size={18} />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#4b5563', fontWeight: 600 }}>วันที่แจ้ง (Report Date)</label>
                                            <input
                                                type="date"
                                                style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', color: '#111827', fontSize: '1rem', outline: 'none' }}
                                                value={formState.reportDate}
                                                onChange={(e) => setFormState({ ...formState, reportDate: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Symmetrical Location Row */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem', color: '#1f2937', fontWeight: 700 }}>สถานที่ (Location Details)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>อาคาร (Bldg)</label>
                                                <input
                                                    type="text"
                                                    placeholder="อาคาร..."
                                                    style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', color: '#111827', outline: 'none' }}
                                                    value={formState.building}
                                                    onChange={(e) => setFormState({ ...formState, building: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>ชั้น (Floor)</label>
                                                <input
                                                    type="text"
                                                    placeholder="ชั้น..."
                                                    style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', color: '#111827', outline: 'none' }}
                                                    value={formState.floor}
                                                    onChange={(e) => setFormState({ ...formState, floor: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>ห้อง (Room)</label>
                                                <input
                                                    type="text"
                                                    placeholder="ห้อง..."
                                                    style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', color: '#111827', outline: 'none' }}
                                                    value={formState.room}
                                                    onChange={(e) => setFormState({ ...formState, room: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '20px' }}>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>รายละเอียดเพิ่มเติม</label>
                                            <input
                                                type="text"
                                                placeholder="รายละเอียดเพิ่มเติม..."
                                                style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', color: '#111827', outline: 'none' }}
                                                value={formState.description}
                                                onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Reporter Info Row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#4b5563', fontWeight: 600 }}>ชื่อผู้แจ้ง (Reporter)</label>
                                            <input
                                                type="text"
                                                style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', color: '#111827', outline: 'none' }}
                                                placeholder="ระบุชื่อผู้ติดต่อ..."
                                                value={formState.reporterName}
                                                onChange={(e) => setFormState({ ...formState, reporterName: e.target.value })}
                                                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#4b5563', fontWeight: 600 }}>เบอร์โทร (Phone)</label>
                                            <input
                                                type="tel"
                                                style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', color: '#111827', outline: 'none' }}
                                                placeholder="0xxxxxxxxx"
                                                value={formState.reporterPhone}
                                                onChange={(e) => setFormState({ ...formState, reporterPhone: e.target.value })}
                                                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Section 2: Defects */}
                            <section style={{ marginBottom: '40px' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '4px', height: '20px', background: '#f59e0b', borderRadius: '4px' }} />
                                    รายการแจ้งซ่อม (Defect List)
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {groups.map((group) => (
                                        <div key={group.id} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>

                                            {/* Group Header */}
                                            <div style={{ padding: '16px 24px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>หมวดงาน (CATEGORY)</label>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '300px', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                                        <select
                                                            style={{ width: '100%', background: 'transparent', border: 'none', color: '#111827', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', outline: 'none', padding: 0 }}
                                                            value={group.category}
                                                            onChange={(e) => updateGroupCategory(group.id, e.target.value)}
                                                        >
                                                            {CATEGORIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                        <Wrench size={16} color="#6366f1" />
                                                    </div>
                                                </div>
                                                {groups.length > 1 && (
                                                    <button
                                                        onClick={() => removeGroup(group.id)}
                                                        style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500 }}
                                                    >
                                                        <Trash2 size={16} /> ลบหมวด
                                                    </button>
                                                )}
                                            </div>

                                            {/* Items Container */}
                                            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                                {group.items.map((item, idx) => (
                                                    <div key={item.id} style={{
                                                        position: 'relative',
                                                        borderBottom: idx !== group.items.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                                        paddingBottom: idx !== group.items.length - 1 ? '32px' : '0'
                                                    }}>
                                                        {/* SYMMETRICAL GRID: 1.5fr 1fr 0.5fr 0.8fr */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.5fr 0.8fr', gap: '16px', marginBottom: '20px' }}>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>จุดที่พบ (Position)</label>
                                                                <input
                                                                    type="text"
                                                                    value={item.position}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'position', e.target.value)}
                                                                    placeholder="เช่น หัวเตียง, ผนัง..."
                                                                    style={{ width: '100%', padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#111827', outline: 'none', fontSize: '0.9rem' }}
                                                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>รายละเอียด (Detail)</label>
                                                                <input
                                                                    type="text"
                                                                    value={item.detail}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'detail', e.target.value)}
                                                                    placeholder="ระบุปัญหา..."
                                                                    style={{ width: '100%', padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#111827', outline: 'none', fontSize: '0.9rem' }}
                                                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>จำนวน</label>
                                                                <input
                                                                    type="number"
                                                                    value={item.amount}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'amount', parseFloat(e.target.value) || 0)}
                                                                    style={{ width: '100%', padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#111827', outline: 'none', fontSize: '0.9rem' }}
                                                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                                                />
                                                            </div>
                                                            <div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                    <label style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>หน่วย</label>
                                                                    {group.items.length > 1 && (
                                                                        <button
                                                                            onClick={() => removeItemFromGroup(group.id, item.id)}
                                                                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                                                                            title="ลบรายการ"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <select
                                                                    value={item.unit}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'unit', e.target.value)}
                                                                    style={{ width: '100%', padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#111827', outline: 'none', fontSize: '0.9rem', appearance: 'none' }}
                                                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                                                >
                                                                    {['จุด', 'ตำแหน่ง', 'ชั้น', 'ตรม.', 'แผ่น', 'บาน', 'เครื่อง', 'เมตร', 'เซนติเมตร'].map(u => <option key={u} value={u}>{u}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Image Attachment - Simple clean box */}
                                                        <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px dashed #e5e7eb' }}>
                                                            <label style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                                                <Camera size={18} /> รูปภาพประกอบ (Evidence)
                                                            </label>
                                                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                                {item.images.map((img, imgIdx) => (
                                                                    <div key={imgIdx} style={{ position: 'relative', width: '90px', height: '90px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                                        <img src={img} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                        <button
                                                                            onClick={() => removeImage(group.id, item.id, imgIdx)}
                                                                            style={{
                                                                                position: 'absolute',
                                                                                top: 4,
                                                                                right: 4,
                                                                                background: 'rgba(239, 68, 68, 0.9)',
                                                                                color: '#ffffff',
                                                                                border: 'none',
                                                                                borderRadius: '50%',
                                                                                width: '24px',
                                                                                height: '24px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                cursor: 'pointer',
                                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                                                zIndex: 10,
                                                                                padding: 0
                                                                            }}
                                                                        >
                                                                            <X size={14} strokeWidth={3} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    onClick={() => triggerUpload(group.id, item.id)}
                                                                    disabled={isUploading}
                                                                    style={{ width: '90px', height: '90px', borderRadius: '8px', border: '1px dashed #6366f1', background: '#e0e7ff', color: '#4f46e5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: isUploading ? 'not-allowed' : 'pointer', gap: '6px', transition: 'all 0.2s', opacity: isUploading ? 0.6 : 1 }}
                                                                    onMouseOver={(e) => !isUploading && (e.currentTarget.style.background = '#c7d2fe')}
                                                                    onMouseOut={(e) => !isUploading && (e.currentTarget.style.background = '#e0e7ff')}
                                                                >
                                                                    {isUploading && uploadTarget?.itemId === item.id ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} />}
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{isUploading && uploadTarget?.itemId === item.id ? 'Uploading...' : 'Add'}</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                <button
                                                    onClick={() => addItemToGroup(group.id)}
                                                    style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px dashed #9ca3af', borderRadius: '8px', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
                                                    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#4b5563'; e.currentTarget.style.color = '#374151'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.color = '#6b7280'; }}
                                                >
                                                    <Plus size={18} /> เพิ่มรายการ (Add Item)
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        onClick={addGroup}
                                        style={{
                                            width: '100%', padding: '16px', background: '#f0f9ff', border: '1px dashed #0284c7',
                                            borderRadius: '16px', color: '#0284c7', fontSize: '0.95rem', fontWeight: 700,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = '#e0f2fe' }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = '#f0f9ff' }}
                                    >
                                        <Plus size={20} /> เพิ่มหมวดงานใหม่ (New Category)
                                    </button>
                                </div>
                            </section>
                        </div>

                        {/* Hidden File Input */}
                        <input
                            id="hidden-file-input"
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                        />

                        {/* Footer */}
                        <div style={{ padding: '24px 32px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button
                                onClick={onClose}
                                style={{ padding: '10px 24px', background: '#ffffff', border: '1px solid #d1d5db', color: '#374151', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 500, transition: 'all 0.2s' }}
                                onMouseOver={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!formState.projectId) {
                                        setShowProjectError(true);
                                        alert('กรุณาเลือกโครงการ (Please select a project)');
                                        return;
                                    }
                                    setIsPreviewDraft(true);
                                    setStep('preview');
                                }}
                                style={{ padding: '10px 24px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                                onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                            >
                                บันทึกแบบร่าง (Save Draft)
                            </button>
                            <button
                                onClick={() => {
                                    if (!formState.projectId) {
                                        setShowProjectError(true);
                                        alert('กรุณาเลือกโครงการ (Please select a project)');
                                        return;
                                    }
                                    setIsPreviewDraft(false);
                                    setStep('preview');
                                }}
                                style={{ padding: '10px 32px', background: '#4f46e5', border: 'none', color: '#fff', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#4338ca'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#4f46e5'}
                            >
                                <Save size={20} /> ส่งข้อมูล (Submit Job)
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ForemanReportModal;
