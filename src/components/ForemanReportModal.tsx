import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Save, Camera, ClipboardCheck, Wrench, ChevronDown, Loader2, FileText, Paperclip } from 'lucide-react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { db, storage } from '../lib/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageCompression';
import { logService } from '../services/logService';
import { Project, WorkOrder, Category, WorkOrderType, MasterTask } from '../types';
import LoadingOverlay from './LoadingOverlay';
import CustomDateInput from './CustomDateInput';

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

const checkGroupHasReadOnlyItems = (group: { items: any[] }) => {
    return group.items.some(item => 
        item.evaluationStatus === 'Approved' || 
        item.evaluationStatus === 'Assigned' || 
        item.status === 'completed' || 
        item.status === 'in-progress' || 
        item.status === 'for-checking'
    );
};

interface ForemanReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    locationName?: string; // Pre-filled if coming from a unit
    initialWorkType?: WorkOrderType;
    editWorkOrder?: WorkOrder; // ✅ Add this to support editing drafts
}

const ForemanReportModal = ({ isOpen, onClose, locationName = '', initialWorkType = 'AfterSale', editWorkOrder }: ForemanReportModalProps) => {
    const { addWorkOrder } = useWorkOrders();
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

    // ✅ Unsaved changes protection
    const isFormDirty = () => {
        // If not editing, check if any field is filled. If editing, we can also prompt as safety.
        const hasGeneralInfo = formState.projectId || formState.building || formState.floor || formState.room || formState.description || (formState.reporterPhone && formState.reporterPhone !== editWorkOrder?.reporterPhone);
        const hasDefects = groups.some(g => g.items.some(i => i.position || i.detail || i.images.length > 0));
        return !!(hasGeneralInfo || hasDefects);
    };

    const handleClose = () => {
        if (isFormDirty()) {
            if (window.confirm('คุณมีข้อมูลที่กรอกค้างไว้อยู่ หากปิดหน้าต่างนี้ข้อมูลทั้งหมดจะสูญหาย\n\nต้องการทิ้งข้อมูลและปิดหน้าต่างใช่หรือไม่? (Unsaved changes will be lost)')) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const [step, setStep] = useState<'form' | 'preview' | 'success'>('form'); // ✅ New multi-step state
    const [isPreviewDraft, setIsPreviewDraft] = useState(false); // ✅ Distinguish between Draft and Submit
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Fix: Lock button during submission

    // Refs to track initialization state across renders (avoid race condition with async subcollection loading)
    const prevIsOpenRef = useRef(false);
    const groupsLoadedRef = useRef<{ id: string; filled: boolean } | null>(null);
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
        defectCount?: number; // PreHandover only
    }

    // State: Groups of defects
    const [groups, setGroups] = useState<DefectGroup[]>([
        {
            id: crypto.randomUUID(),
            category: CATEGORIES_LIST[0],
            items: [{ id: crypto.randomUUID(), position: '', detail: '', amount: 1, unit: 'จุด', images: [], estimatedSla: '24h' }]
        }
    ]);

    // PreHandover: PDF documents + WO-level SLA
    const [phDocuments, setPhDocuments] = useState<{ name: string; url: string; size: number }[]>([]);
    const [phSla, setPhSla] = useState('14-30d');
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);

    // Update type when prop changes or modal opens
    useEffect(() => {
        const justOpened = isOpen && !prevIsOpenRef.current;
        prevIsOpenRef.current = isOpen;

        if (!isOpen) {
            groupsLoadedRef.current = null;
            return;
        }

        // Reset step/preview only on first open — not on every subcollection update
        if (justOpened) {
            setStep('form');
            setIsPreviewDraft(false);
        }

        if (editWorkOrder) {
            // Always sync form fields (non-disruptive)
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

            const cats = editWorkOrder.categories || [];
            const woid = editWorkOrder.id;
            const loaded = groupsLoadedRef.current;
            const isDifferentWO = !loaded || loaded.id !== woid;
            // subcollections just arrived: we loaded this WO before but got empty, now has data
            const wasEmptyNowFilled = loaded?.id === woid && !loaded.filled && cats.length > 0;

            if (isDifferentWO || wasEmptyNowFilled) {
                groupsLoadedRef.current = { id: woid, filled: cats.length > 0 };
                if (editWorkOrder.type === 'PreHandover') {
                    // PreHandover: load category + defectCount only
                    setPhDocuments(
                        (cats[0] as any)?.tasks?.[0]?.documents ||
                        (cats[0] as any)?.documents ||
                        (editWorkOrder as any).documents || []
                    );
                    setPhSla((editWorkOrder as any).phEstimatedSla || '14-30d');
                    const loadedGroups = cats.map(cat => ({
                        id: cat.id,
                        category: cat.name,
                        items: [],
                        defectCount: (cat as any).defectCount || 0
                    }));
                    setGroups(loadedGroups.length > 0
                        ? loadedGroups
                        : [{ id: crypto.randomUUID(), category: CATEGORIES_LIST[0], items: [], defectCount: 0 }]);
                } else {
                    // AfterSale: Map Categories → Groups with photo fallback chain
                    setGroups(cats.map(cat => ({
                        id: cat.id,
                        category: cat.name,
                        items: (cat.tasks || []).map(task => ({
                            ...task,
                            id: task.id,
                            position: task.position || '',
                            detail: task.name,
                            amount: task.amount || 1,
                            unit: task.unit || 'จุด',
                            images: Array.from(new Set((
                                task.images && task.images.length > 0
                                    ? task.images
                                    : [
                                        task.beforePhotoUrl,
                                        task.latestPhotoUrl,
                                        task.afterPhotoUrl,
                                        ...(task.attachments?.map(a => a.url) || [])
                                    ]
                            ).filter(url => url && typeof url === 'string') as string[]))
                        }))
                    })));
                }
            }
            // else: same WO already loaded with data → don't overwrite user's in-progress edits
        } else if (justOpened) {
            // New WO — only reset on first open
            setFormState(prev => ({
                ...prev,
                type: initialWorkType,
                description: '',
                reporterName: user?.name || '',
                reporterPhone: '',
                projectId: '',
                location: locationName,
                id: `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`
            }));
            setPhDocuments([]);
            setPhSla('14-30d');
            if (initialWorkType === 'PreHandover') {
                setGroups([{ id: crypto.randomUUID(), category: CATEGORIES_LIST[0], items: [], defectCount: 0 }]);
            } else {
                setGroups([{ id: crypto.randomUUID(), category: CATEGORIES_LIST[0], items: [{ id: crypto.randomUUID(), position: '', detail: '', amount: 1, unit: 'จุด', images: [], estimatedSla: '24h' }] }]);
            }
        }
    }, [isOpen, initialWorkType, user?.name, editWorkOrder]);

    // Handlers
    const addGroup = () => {
        const isPreHandover = formState.type === 'PreHandover';
        setGroups([...groups, {
            id: crypto.randomUUID(),
            category: CATEGORIES_LIST[0],
            items: isPreHandover ? [] : [{ id: crypto.randomUUID(), position: '', detail: '', amount: 1, unit: 'จุด', images: [], estimatedSla: '24h' }],
            defectCount: isPreHandover ? 0 : undefined
        }]);
    };

    const updateGroupDefectCount = (groupId: string, count: number) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, defectCount: count } : g));
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
                    items: [...g.items, { id: crypto.randomUUID(), position: '', detail: '', amount: 1, unit: 'จุด', images: [], estimatedSla: '24h' }]
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

    // PDF document upload (PreHandover)
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploadingDoc(true);
        try {
            for (const file of Array.from(files)) {
                const fileName = `doc_${Date.now()}_${file.name}`;
                const storagePath = `work_orders/${formState.id}/documents/${fileName}`;
                const storageRef = ref(storage, storagePath);
                const metadata = { cacheControl: 'public, max-age=31536000', contentType: file.type || 'application/pdf' };
                const snapshot = await uploadBytes(storageRef, file, metadata);
                const downloadURL = await getDownloadURL(snapshot.ref);
                setPhDocuments(prev => [...prev, { name: file.name, url: downloadURL, size: file.size }]);
            }
        } catch (error) {
            console.error('PDF upload failed:', error);
            alert('อัปโหลดเอกสารไม่สำเร็จ');
        } finally {
            setIsUploadingDoc(false);
            if (e.target) e.target.value = '';
        }
    };

    const removeDocument = (idx: number) => {
        setPhDocuments(prev => prev.filter((_, i) => i !== idx));
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

        // Determine dynamic WO ID
        let finalId = formState.id;
        const isNewOrTempId = !editWorkOrder || (!formState.id.includes('-WOA-') && !formState.id.includes('-WOP-'));

        if (isNewOrTempId) {
            try {
                const selectedProject = allProjects.find(p => p.id === formState.projectId);
                const projectCode = selectedProject?.projectCode || selectedProject?.id || 'WO';
                const currentYear = new Date().getFullYear();
                
                // Determine Job Code: WOA for AfterSale (General Repair), WOP for PreHandover (Room Inspection)
                const jobCode = formState.type === 'AfterSale' ? 'WOA' : 'WOP';

                // Fetch existing work orders for this project
                const q = query(collection(db, 'workOrders'), where('projectId', '==', formState.projectId));
                const querySnapshot = await getDocs(q);

                let maxSequence = 0;
                querySnapshot.docs.forEach(docSnap => {
                    const id = docSnap.id;
                    const parts = id.split('-');
                    if (parts.length === 4 && parts[2] === jobCode) {
                        const year = parseInt(parts[1], 10);
                        if (year === currentYear) {
                            const seq = parseInt(parts[3], 10);
                            if (!isNaN(seq) && seq > maxSequence) {
                                maxSequence = seq;
                            }
                        }
                    }
                });

                const nextSeq = maxSequence + 1;
                const paddedSeq = String(nextSeq).padStart(4, '0');
                finalId = `${projectCode}-${currentYear}-${jobCode}-${paddedSeq}`;
                
                // Keep formState in sync
                setFormState(prev => ({ ...prev, id: finalId }));
            } catch (err) {
                console.error("Failed to generate dynamic WO ID:", err);
                const currentYear = new Date().getFullYear();
                const selectedProject = allProjects.find(p => p.id === formState.projectId);
                const projectCode = selectedProject?.projectCode || selectedProject?.id || 'WO';
                const jobCode = formState.type === 'AfterSale' ? 'WOA' : 'WOP';
                finalId = `${projectCode}-${currentYear}-${jobCode}-${Date.now().toString().slice(-4)}`;
            }
        }

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
            id: finalId,
            projectId: formState.projectId,
            reporterName: formState.reporterName,
            reporterId: editWorkOrder?.reporterId || user?.id || 'unknown',
            woOwnerId: editWorkOrder?.woOwnerId || user?.employeeId || user?.id || 'unknown',
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
        let categories: Category[];
        if (formState.type === 'PreHandover') {
            // PreHandover: category + defectCount only, no individual tasks
            categories = groups.map(group => ({
                id: group.id.startsWith('CAT-') ? group.id : `CAT-${Math.floor(Math.random() * 10000)}`,
                name: group.category,
                defectCount: group.defectCount || 0,
                tasks: []
            }));
            if (categories.length > 0) {
                (categories[0] as any).documents = phDocuments;
            }
            (newWorkOrder as any).phEstimatedSla = phSla;
        } else {
            categories = groups.map(group => ({
                id: group.id.startsWith('CAT-') ? group.id : `CAT-${Math.floor(Math.random() * 10000)}`,
                name: group.category,
                tasks: group.items.map(item => {
                    const { id: itemId, detail, position, amount, unit, images, ...rest } = item;
                    const isItemReadOnly =
                        item.evaluationStatus === 'Approved' ||
                        item.evaluationStatus === 'Assigned' ||
                        item.status === 'completed' ||
                        item.status === 'in-progress' ||
                        item.status === 'for-checking';

                    const finalStatus = isItemReadOnly ? (item.status || 'Pending') : (isDraft ? (item.status || 'Pending') : 'Pending');
                    const finalRootCause = isItemReadOnly ? (item.rootCause || '') : (isDraft ? (item.rootCause || '') : '');

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
                        estimatedSla: (item as any).estimatedSla,
                        images: Array.from(new Set(images)),
                        beforePhotoUrl: images.length > 0 ? images[0] : (item.beforePhotoUrl || null),
                        latestPhotoUrl: images.length > 0 ? images[0] : (item.latestPhotoUrl || null),
                        dailyProgress: item.dailyProgress || 0,
                        description: detail,
                        history: item.history || []
                    } as any;
                })
            })).filter(c => c.tasks.length > 0);
        }

        newWorkOrder.categories = categories;

        // ✅ IMPORTANT: Await the creation to ensure data is saved before notifying
        try {
            await addWorkOrder(newWorkOrder);
        } catch (saveError) {
            console.error('Failed to save work order:', saveError);
            alert('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง\n(' + (saveError instanceof Error ? saveError.message : String(saveError)) + ')');
            setIsSubmitting(false);
            return;
        }

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

                            {isAfterSale ? (
                                <>
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
                                </>
                            ) : (
                                <>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '4px', height: '16px', background: '#10b981', borderRadius: '4px' }}></div>
                                    หมวดงาน ({groups.length} หมวด · รวม {groups.reduce((s, g) => s + (g.defectCount || 0), 0)} จุด) · SLA: {phSla}
                                </h3>
                                {phDocuments.length > 0 && (
                                    <div style={{ marginBottom: '16px', background: '#f0fdf4', borderRadius: '10px', padding: '12px 16px', border: '1px solid #bbf7d0' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 600, marginBottom: '8px' }}>เอกสารแนบ ({phDocuments.length} ไฟล์)</div>
                                        {phDocuments.map((doc, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#047857' }}>
                                                <FileText size={14} /> {doc.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {groups.map(group => (
                                        <div key={group.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                                            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{group.category}</span>
                                            <span style={{ background: '#dcfce7', color: '#166534', borderRadius: '20px', padding: '4px 12px', fontSize: '0.85rem', fontWeight: 700 }}>{group.defectCount || 0} จุด</span>
                                        </div>
                                    ))}
                                </div>
                                </>
                            )}
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
                                onClick={handleClose}
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
                                            <CustomDateInput
                                                value={formState.reportDate}
                                                onChange={(e) => setFormState({ ...formState, reportDate: e.target.value })}
                                                style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', color: '#111827', fontSize: '1rem', outline: 'none' }}
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

                                    {/* PreHandover: Document attachment + SLA */}
                                    {!isAfterSale && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', alignItems: 'flex-start' }}>
                                            {/* PDF Documents */}
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#4b5563', fontWeight: 600 }}>
                                                    เอกสารแนบ (Documents)
                                                </label>
                                                <div style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {phDocuments.map((doc, idx) => (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', borderRadius: '8px', padding: '8px 12px', border: '1px solid #bbf7d0' }}>
                                                            <FileText size={16} color="#059669" style={{ flexShrink: 0 }} />
                                                            <span style={{ flex: 1, fontSize: '0.85rem', color: '#065f46', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>{(doc.size / 1024).toFixed(0)} KB</span>
                                                            <button onClick={() => removeDocument(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px', display: 'flex', alignItems: 'center' }}>
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => document.getElementById('hidden-pdf-input')?.click()}
                                                        disabled={isUploadingDoc}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: isUploadingDoc ? '#f1f5f9' : '#f0f9ff', border: '1px dashed #0284c7', borderRadius: '8px', color: '#0284c7', cursor: isUploadingDoc ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                                                    >
                                                        {isUploadingDoc ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                                                        {isUploadingDoc ? 'กำลังอัปโหลด...' : 'แนบไฟล์ PDF'}
                                                    </button>
                                                </div>
                                            </div>
                                            {/* SLA */}
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#4b5563', fontWeight: 600 }}>SLA คาดการณ์</label>
                                                <div style={{ position: 'relative' }}>
                                                    <select
                                                        value={phSla}
                                                        onChange={(e) => setPhSla(e.target.value)}
                                                        style={{ width: '100%', padding: '10px 14px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', color: '#111827', fontSize: '0.95rem', outline: 'none', appearance: 'none' }}
                                                    >
                                                        <option value="7-14d">7-14 วัน</option>
                                                        <option value="14-30d">14-30 วัน</option>
                                                        <option value="30-60d">30-60 วัน</option>
                                                        <option value="60d+">มากกว่า 60 วัน</option>
                                                    </select>
                                                    <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                                                        <ChevronDown size={16} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Section 2: Defects */}
                            <section style={{ marginBottom: '40px' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '4px', height: '20px', background: '#f59e0b', borderRadius: '4px' }} />
                                    {isAfterSale ? 'รายการแจ้งซ่อม (Defect List)' : 'หมวดงานที่พบ (Work Categories)'}
                                </h3>

                                {/* PreHandover: simplified category + count only */}
                                {!isAfterSale && (
                                    <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        {/* Column headers */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 40px', gap: '12px', padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>หมวดงาน (Category)</span>
                                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textAlign: 'center' }}>จำนวนจุดที่พบ</span>
                                            <span />
                                        </div>
                                        {/* Data rows — no labels, uniform height */}
                                        {groups.map((group, idx) => (
                                            <div key={group.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 40px', gap: '12px', padding: '10px 16px', alignItems: 'center', borderBottom: idx < groups.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <select
                                                        value={group.category}
                                                        onChange={(e) => updateGroupCategory(group.id, e.target.value)}
                                                        style={{ width: '100%', padding: '9px 32px 9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827', fontSize: '0.9rem', outline: 'none', appearance: 'none', height: '40px' }}
                                                    >
                                                        {CATEGORIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}><ChevronDown size={14} /></div>
                                                </div>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={group.defectCount || 0}
                                                    onChange={(e) => updateGroupDefectCount(group.id, parseInt(e.target.value) || 0)}
                                                    style={{ width: '100%', height: '40px', padding: '0 12px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#111827', fontSize: '1rem', fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                                                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                                />
                                                {groups.length > 1 ? (
                                                    <button onClick={() => removeGroup(group.id)} title="ลบหมวดงาน" style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                        <Trash2 size={16} strokeWidth={2} />
                                                    </button>
                                                ) : <div />}
                                            </div>
                                        ))}
                                        {/* Footer: total + add button */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>รวม <strong style={{ color: '#059669' }}>{groups.reduce((s, g) => s + (g.defectCount || 0), 0)}</strong> จุด / {groups.length} หมวด</span>
                                            <button
                                                onClick={addGroup}
                                                style={{ padding: '7px 14px', background: '#f0fdf4', border: '1px solid #10b981', borderRadius: '8px', color: '#059669', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <Plus size={15} /> เพิ่มหมวดงาน
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* AfterSale: original full defect list */}
                                {isAfterSale && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {groups.map((group) => (
                                        <div key={group.id} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>

                                            {/* Group Header */}
                                            <div style={{ padding: '16px 24px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>หมวดงาน (CATEGORY)</label>
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '12px', 
                                                        maxWidth: '300px', 
                                                        background: checkGroupHasReadOnlyItems(group) ? '#f1f5f9' : '#ffffff', 
                                                        padding: '8px 12px', 
                                                        borderRadius: '8px', 
                                                        border: '1px solid #e5e7eb',
                                                        cursor: checkGroupHasReadOnlyItems(group) ? 'not-allowed' : 'default'
                                                    }}>
                                                        <select
                                                            style={{ 
                                                                width: '100%', 
                                                                background: 'transparent', 
                                                                border: 'none', 
                                                                color: checkGroupHasReadOnlyItems(group) ? '#94a3b8' : '#111827', 
                                                                fontSize: '0.95rem', 
                                                                fontWeight: 500, 
                                                                cursor: checkGroupHasReadOnlyItems(group) ? 'not-allowed' : 'pointer', 
                                                                outline: 'none', 
                                                                padding: 0 
                                                            }}
                                                            value={group.category}
                                                            onChange={(e) => updateGroupCategory(group.id, e.target.value)}
                                                            disabled={checkGroupHasReadOnlyItems(group)}
                                                        >
                                                            {CATEGORIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                        <Wrench size={16} color={checkGroupHasReadOnlyItems(group) ? '#94a3b8' : '#6366f1'} />
                                                    </div>
                                                </div>
                                                {groups.length > 1 && !checkGroupHasReadOnlyItems(group) && (
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
                                                {group.items.map((item, idx) => {
                                                    const isItemReadOnly = 
                                                        item.evaluationStatus === 'Approved' || 
                                                        item.evaluationStatus === 'Assigned' || 
                                                        item.status === 'completed' || 
                                                        item.status === 'in-progress' || 
                                                        item.status === 'for-checking';
                                                    return (
                                                        <div key={item.id} style={{
                                                            position: 'relative',
                                                            borderBottom: idx !== group.items.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                                            paddingBottom: idx !== group.items.length - 1 ? '32px' : '0'
                                                        }}>
                                                            {isItemReadOnly && (
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: '0',
                                                                    right: '0',
                                                                    background: item.evaluationStatus === 'Approved' ? '#dcfce7' : '#e0e7ff',
                                                                    color: item.evaluationStatus === 'Approved' ? '#166534' : '#3730a3',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    padding: '6px 12px',
                                                                    borderRadius: '8px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                                                    zIndex: 10
                                                                }}>
                                                                    <ClipboardCheck size={14} /> 
                                                                    {item.evaluationStatus === 'Approved' ? 'อนุมัติแล้ว' : 'มอบหมายงานแล้ว'}
                                                                </div>
                                                            )}
                                                            {group.items.length > 1 && !isItemReadOnly && (
                                                                <button
                                                                    onClick={() => removeItemFromGroup(group.id, item.id)}
                                                                    style={{ 
                                                                        position: 'absolute', 
                                                                        top: '0', 
                                                                        right: '0', 
                                                                        color: '#ef4444', 
                                                                        background: 'none', 
                                                                        border: 'none', 
                                                                        cursor: 'pointer', 
                                                                        display: 'flex', 
                                                                        alignItems: 'center', 
                                                                        justifyContent: 'center',
                                                                        padding: '4px',
                                                                        zIndex: 10
                                                                    }}
                                                                    title="ลบรายการ"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                            {/* SYMMETRICAL GRID: Updated for 5 columns */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.5fr 0.6fr 1.2fr', gap: '16px', marginBottom: '20px' }}>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>จุดที่พบ (Position)</label>
                                                                <input
                                                                    type="text"
                                                                    value={item.position}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'position', e.target.value)}
                                                                    placeholder="เช่น หัวเตียง, ผนัง..."
                                                                    disabled={isItemReadOnly}
                                                                    style={{ 
                                                                        width: '100%', 
                                                                        padding: '10px 14px', 
                                                                        background: isItemReadOnly ? '#f1f5f9' : '#ffffff', 
                                                                        border: '1px solid #d1d5db', 
                                                                        borderRadius: '8px', 
                                                                        color: isItemReadOnly ? '#94a3b8' : '#111827', 
                                                                        outline: 'none', 
                                                                        fontSize: '0.9rem',
                                                                        cursor: isItemReadOnly ? 'not-allowed' : 'text'
                                                                    }}
                                                                    onFocus={(e) => !isItemReadOnly && (e.target.style.borderColor = '#6366f1')}
                                                                    onBlur={(e) => !isItemReadOnly && (e.target.style.borderColor = '#d1d5db')}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>รายละเอียด (Detail)</label>
                                                                <input
                                                                    type="text"
                                                                    value={item.detail}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'detail', e.target.value)}
                                                                    placeholder="ระบุปัญหา..."
                                                                    disabled={isItemReadOnly}
                                                                    style={{ 
                                                                        width: '100%', 
                                                                        padding: '10px 14px', 
                                                                        background: isItemReadOnly ? '#f1f5f9' : '#ffffff', 
                                                                        border: '1px solid #d1d5db', 
                                                                        borderRadius: '8px', 
                                                                        color: isItemReadOnly ? '#94a3b8' : '#111827', 
                                                                        outline: 'none', 
                                                                        fontSize: '0.9rem',
                                                                        cursor: isItemReadOnly ? 'not-allowed' : 'text'
                                                                    }}
                                                                    onFocus={(e) => !isItemReadOnly && (e.target.style.borderColor = '#6366f1')}
                                                                    onBlur={(e) => !isItemReadOnly && (e.target.style.borderColor = '#d1d5db')}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>จำนวน</label>
                                                                <input
                                                                    type="number"
                                                                    value={item.amount}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'amount', parseFloat(e.target.value) || 0)}
                                                                    disabled={isItemReadOnly}
                                                                    style={{ 
                                                                        width: '100%', 
                                                                        padding: '10px 14px', 
                                                                        background: isItemReadOnly ? '#f1f5f9' : '#ffffff', 
                                                                        border: '1px solid #d1d5db', 
                                                                        borderRadius: '8px', 
                                                                        color: isItemReadOnly ? '#94a3b8' : '#111827', 
                                                                        outline: 'none', 
                                                                        fontSize: '0.9rem',
                                                                        cursor: isItemReadOnly ? 'not-allowed' : 'text'
                                                                    }}
                                                                    onFocus={(e) => !isItemReadOnly && (e.target.style.borderColor = '#6366f1')}
                                                                    onBlur={(e) => !isItemReadOnly && (e.target.style.borderColor = '#d1d5db')}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>หน่วย</label>
                                                                <select
                                                                    value={item.unit}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'unit', e.target.value)}
                                                                    disabled={isItemReadOnly}
                                                                    style={{ 
                                                                        width: '100%', 
                                                                        padding: '10px 14px', 
                                                                        background: isItemReadOnly ? '#f1f5f9' : '#ffffff', 
                                                                        border: '1px solid #d1d5db', 
                                                                        borderRadius: '8px', 
                                                                        color: isItemReadOnly ? '#94a3b8' : '#111827', 
                                                                        outline: 'none', 
                                                                        fontSize: '0.9rem', 
                                                                        appearance: 'none',
                                                                        cursor: isItemReadOnly ? 'not-allowed' : 'pointer'
                                                                    }}
                                                                    onFocus={(e) => !isItemReadOnly && (e.target.style.borderColor = '#6366f1')}
                                                                    onBlur={(e) => !isItemReadOnly && (e.target.style.borderColor = '#d1d5db')}
                                                                >
                                                                    {['จุด', 'ตำแหน่ง', 'ชั้น', 'ตรม.', 'แผ่น', 'บาน', 'เครื่อง', 'เมตร', 'เซนติเมตร'].map(u => <option key={u} value={u}>{u}</option>)}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>SLA คาดการณ์</label>
                                                                <select
                                                                    value={(item as any).estimatedSla || '24h'}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'estimatedSla', e.target.value)}
                                                                    disabled={isItemReadOnly}
                                                                    style={{ 
                                                                        width: '100%', 
                                                                        padding: '10px 14px', 
                                                                        background: isItemReadOnly ? '#f1f5f9' : '#ffffff', 
                                                                        border: '1px solid #d1d5db', 
                                                                        borderRadius: '8px', 
                                                                        color: isItemReadOnly ? '#94a3b8' : '#111827', 
                                                                        outline: 'none', 
                                                                        fontSize: '0.9rem',
                                                                        cursor: isItemReadOnly ? 'not-allowed' : 'pointer'
                                                                    }}
                                                                    onFocus={(e) => !isItemReadOnly && (e.target.style.borderColor = '#6366f1')}
                                                                    onBlur={(e) => !isItemReadOnly && (e.target.style.borderColor = '#d1d5db')}
                                                                >
                                                                    <option value="Immediately">ด่วนที่สุด (ทันที)</option>
                                                                    <option value="24h">ภายใน 24 ชม. (ด่วน)</option>
                                                                    <option value="1-3d">1-3 วัน (ปานกลาง)</option>
                                                                    <option value="3-7d">3-7 วัน (ทั่วไป)</option>
                                                                    <option value="7-14d">7-14 วัน</option>
                                                                    <option value="14-30d">14-30 วัน (งานใหญ่)</option>
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
                                                                        {!isItemReadOnly && (
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
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {!isItemReadOnly && (
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
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

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
                                )} {/* end isAfterSale */}
                            </section>
                        </div>

                        {/* Hidden File Inputs */}
                        <input
                            id="hidden-file-input"
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                        />
                        <input
                            id="hidden-pdf-input"
                            type="file"
                            accept=".pdf,application/pdf"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handlePdfUpload}
                        />

                        {/* Footer */}
                        <div style={{ padding: '24px 32px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button
                                onClick={handleClose}
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
