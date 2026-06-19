import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkOrders } from '../context/WorkOrderContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { 
    Star, Sparkles, Building2, ChevronDown, ChevronUp, 
    Loader2, CheckCircle2, AlertTriangle, 
    MapPin, User, Phone, Camera
} from 'lucide-react';

const getAfterPhotos = (task: any): string[] => {
    const photosList: string[] = [];
    if (task.history && task.history.length > 0) {
        // Find the history entry representing progress = 100%
        const entry100 = task.history.find((h: any) => Number(h.progress) === 100 || Number(h.dailyProgress) === 100);
        if (entry100) {
            const h = entry100;
            if (h.photos) {
                if (Array.isArray(h.photos)) {
                    h.photos.forEach((p: any) => { if (p) photosList.push(p); });
                } else if (typeof h.photos === 'object') {
                    const siteArr = h.photos.site;
                    if (Array.isArray(siteArr)) {
                        siteArr.forEach((p: any) => { if (p) photosList.push(p); });
                    }
                }
            }
        }
    }
    
    return Array.from(new Set(photosList.filter(Boolean)));
};

export default function CustomerHandover() {
    const [searchParams] = useSearchParams();
    const woId = searchParams.get('woId') || '';
    
    const { submitCustomerInspection, logCustomerQrView } = useWorkOrders();

    // States
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitType, setSubmitType] = useState<'approve' | 'reject' | null>(null);

    // Data States
    const [workOrder, setWorkOrder] = useState<any>(null);
    const [projectName, setProjectName] = useState('โครงการก่อสร้าง');

    // Form / Approvals States
    const [approvals, setApprovals] = useState<Record<string, { 
        status: 'approved' | 'rejected'; 
        reason?: string; 
        defectCategories?: Record<string, boolean>;
        contactName?: string;
        contactPhone?: string;
    }>>({});
    
    const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
    const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
    const [defectCategories] = useState<Record<string, Record<string, boolean>>>({});
    const [contactNames, setContactNames] = useState<Record<string, string>>({});
    const [contactPhones, setContactPhones] = useState<Record<string, string>>({});

    // 5-Star Ratings
    const [workQuality, setWorkQuality] = useState(5);
    const [siteCleanliness, setSiteCleanliness] = useState(5);
    const [foremanProfessionalism, setForemanProfessionalism] = useState(5);
    const [specAccuracy, setSpecAccuracy] = useState(5);
    const [handoverCare, setHandoverCare] = useState(5);

    useEffect(() => {
        const fetchWoData = async () => {
            if (!woId) {
                setLoading(false);
                return;
            }
            try {
                // Fetch WO
                const woRef = doc(db, 'workOrders', woId);
                const woSnap = await getDoc(woRef);
                if (woSnap.exists()) {
                    const woData = woSnap.data();
                    
                    // Fetch categories and tasks subcollections
                    const getSubtaskId = (tId: string): string => {
                        return tId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
                    };

                    const categories: any[] = [];
                    const catsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
                    for (const catDoc of catsSnap.docs) {
                        const catData = catDoc.data();
                        const tasks: any[] = [];
                        const tasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
                        for (const taskDoc of tasksSnap.docs) {
                            const taskData = taskDoc.data();
                            const taskId = taskDoc.id;
                            
                            // Fetch daily reports history
                            const historyList: any[] = [];
                            
                            // 1. Fetch from legacy dailyreport
                            try {
                                const legacySnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'dailyreport'));
                                legacySnap.docs.forEach(d => {
                                    historyList.push({
                                        ...d.data(),
                                        id: d.id
                                    });
                                });
                            } catch (e) {
                                console.error("Error fetching legacy dailyreport:", e);
                            }

                            // 2. Fetch from revisions dailyReports
                            try {
                                const subtaskId = getSubtaskId(taskId);
                                const revisionsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId, 'revisions'));
                                for (const revDoc of revisionsSnap.docs) {
                                    const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', revDoc.id, 'dailyReports'));
                                    reportsSnap.docs.forEach(d => {
                                        historyList.push({
                                            ...d.data(),
                                            id: d.id,
                                            revisionId: revDoc.id
                                        });
                                    });
                                }
                            } catch (e) {
                                console.error("Error fetching revision dailyReports:", e);
                            }

                            const sortedHistory = historyList.sort((a, b) => {
                                const dateA = new Date(a.date || a.createdAt || 0).getTime();
                                const dateB = new Date(b.date || b.createdAt || 0).getTime();
                                return dateB - dateA;
                            });

                            tasks.push({
                                ...taskData,
                                id: taskId,
                                history: sortedHistory
                            });
                        }
                        categories.push({
                            ...catData,
                            id: catDoc.id,
                            tasks
                        });
                    }

                    const fullWorkOrder = {
                        ...woData,
                        id: woSnap.id,
                        categories
                    };
                    
                    setWorkOrder(fullWorkOrder);
                    
                    // Log view
                    await logCustomerQrView(woSnap.id);

                    // Fetch Project details for name
                    if (woData.projectId) {
                        const projRef = doc(db, 'projects', woData.projectId);
                        const projSnap = await getDoc(projRef);
                        if (projSnap.exists()) {
                            setProjectName(projSnap.data().name || 'โครงการก่อสร้าง');
                        }
                    }

                    // Pre-populate contact name and phone from existing task data if present
                    const names: Record<string, string> = {};
                    const phones: Record<string, string> = {};
                    
                    categories.forEach((cat: any) => {
                        cat.tasks?.forEach((task: any) => {
                            if (task.contactName) {
                                names[task.id] = task.contactName;
                            }
                            if (task.contactPhone) {
                                phones[task.id] = task.contactPhone;
                            }
                        });
                    });
                    
                    setContactNames(names);
                    setContactPhones(phones);
                }
            } catch (err) {
                console.error("Error fetching Work Order handover data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchWoData();
    }, [woId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: '16px' }}>
                <Loader2 size={40} className="animate-spin" style={{ color: '#3b82f6' }} />
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#3b82f6', fontFamily: 'system-ui' }}>กำลังโหลดข้อมูลการส่งมอบงาน...</div>
            </div>
        );
    }

    if (!workOrder) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px', boxSizing: 'border-box' }}>
                <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '64px', height: '64px', background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                        <AlertTriangle size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0' }}>ไม่พบข้อมูลการตรวจรับงาน</h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                        ลิงก์ส่งมอบงานอาจไม่ถูกต้อง หรือรายการงานนี้ได้รับการแก้ไขแล้ว โปรดตรวจสอบคิวอาร์โค้ดส่งมอบอีกครั้ง
                    </p>
                </div>
            </div>
        );
    }

    // Filter tasks that are completed and eligible for customer review
    const isWoPendingReassign = 
        workOrder.pendingAdminReassign === true ||
        (workOrder.pendingAdminReassign === undefined && workOrder.reviewedByAdmin === false && workOrder.status === 'Rejected');
    
    const eligibleTasks = (workOrder.categories || []).flatMap((cat: any) => 
        (cat.tasks || []).filter((task: any) => {
            const hasCompletedProgress = task.dailyProgress === 100;
            const notYetVerified = task.status !== 'Verified' && task.status !== 'completed';
            const notStillRejectedByAdmin = task.status !== 'Rejected' && !isWoPendingReassign;
            return hasCompletedProgress && notYetVerified && notStillRejectedByAdmin;
        })
    );

    const handleSelectAction = (taskId: string, status: 'approved' | 'rejected') => {
        const incompleteRejectTask = eligibleTasks.find((t: any) => 
            approvals[t.id]?.status === 'rejected' && (
                !rejectReasons[t.id]?.trim() || 
                !contactNames[t.id]?.trim() || 
                !contactPhones[t.id]?.trim()
            )
        );
        
        if (incompleteRejectTask && incompleteRejectTask.id !== taskId) {
            alert(`กรุณากรอกข้อมูลสาเหตุ ชื่อติดต่อกลับ และเบอร์โทร สำหรับรายการแก้ไข "${incompleteRejectTask.name || incompleteRejectTask.taskName}" ก่อนประเมินรายการอื่น`);
            return;
        }

        setApprovals(prev => {
            const current = prev[taskId];
            if (current && current.status === status) {
                const next = { ...prev };
                delete next[taskId];
                return next;
            }
            return {
                ...prev,
                [taskId]: {
                    status,
                    reason: rejectReasons[taskId] || '',
                    defectCategories: defectCategories[taskId] || {},
                    contactName: contactNames[taskId] || '',
                    contactPhone: contactPhones[taskId] || ''
                }
            };
        });
    };

    const handleFinalSubmit = async () => {
        const unactedTasks = eligibleTasks.filter((t: any) => !approvals[t.id]);
        if (unactedTasks.length > 0) {
            alert('กรุณาประเมินงานย่อย (ผ่าน / แก้ไข) ให้ครบถ้วนทุกรายการก่อนกดส่งมอบงาน');
            return;
        }

        const invalidRejects = eligibleTasks.filter((t: any) => 
            approvals[t.id]?.status === 'rejected' && (
                !rejectReasons[t.id]?.trim() || 
                !contactNames[t.id]?.trim() || 
                !contactPhones[t.id]?.trim()
            )
        );
        if (invalidRejects.length > 0) {
            alert('กรุณากรอกสาเหตุ ชื่อผู้แจ้ง และเบอร์โทรสำหรับรายการที่สั่งแก้ไข (Reject)');
            return;
        }

        setSubmitting(true);
        try {
            const hasRejections = Object.values(approvals).some(a => a.status === 'rejected');
            const surveyPayload = hasRejections ? undefined : {
                workQuality,
                siteCleanliness,
                foremanProfessionalism,
                specAccuracy,
                handoverCare
            };

            await submitCustomerInspection(workOrder.id, approvals, surveyPayload);
            setSubmitType(hasRejections ? 'reject' : 'approve');
            setSubmitted(true);
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px', boxSizing: 'border-box' }}>
                <div style={{ background: '#fff', padding: '3rem 2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', maxWidth: '540px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.06)' }}>
                    {submitType === 'approve' ? (
                        <>
                            <div style={{ width: '80px', height: '80px', background: '#ecfdf5', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto' }}>
                                <CheckCircle2 size={40} />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '0 0 12px 0' }}>ตรวจรับงานเรียบร้อย</h3>
                            <p style={{ fontSize: '0.925rem', color: '#64748b', margin: '0 0 2rem 0', lineHeight: 1.6 }}>
                                ขอบคุณที่ทำการตรวจรับและประเมินความพึงพอใจการปฏิบัติงาน ทางบริษัท After Sale ขอบคุณสำหรับความไว้วางใจค่ะ
                            </p>
                        </>
                    ) : (
                        <>
                            <div style={{ width: '80px', height: '80px', background: '#fffbeb', color: '#f59e0b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto' }}>
                                <AlertTriangle size={40} />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '0 0 12px 0' }}>รับเรื่องส่งแก้ไขเรียบร้อย</h3>
                            <p style={{ fontSize: '0.925rem', color: '#64748b', margin: '0 0 2rem 0', lineHeight: 1.6 }}>
                                ทางบริษัทได้รับแจ้งจุดชำรุดแก้ไขของท่านแล้ว โฟร์แมนและทีมช่างจะเร่งเข้าดำเนินการแก้ไขให้เร็วที่สุดค่ะ
                            </p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    const hasRejections = Object.values(approvals).some(a => a.status === 'rejected');
    const isAllApproved = eligibleTasks.length > 0 && eligibleTasks.every((task: any) => approvals[task.id]?.status === 'approved');

    const renderRating = (label: string, val: number, setVal: (n: number) => void) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e8edf2' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>{label}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} type="button" onClick={() => setVal(s)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: s <= val ? '#f59e0b' : '#cbd5e1' }}>
                        <Star size={20} fill={s <= val ? 'currentColor' : 'none'} />
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div style={{ background: '#f4f6fa', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '16px', fontFamily: 'system-ui' }}>
            <div style={{ background: '#ffffff', width: '100%', maxWidth: '640px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
                
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #edf2f7' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '4px 10px', borderRadius: '50px', border: '1px solid #dbeafe', marginBottom: '8px' }}>
                        <Building2 size={12} color="#3b82f6" />
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#1e40af', letterSpacing: '0.05em' }}>HANDOVER PORTAL</span>
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                        แบบฟอร์มตรวจรับและประเมินผลงานลูกค้า
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#64748b', fontSize: '0.78rem' }}>
                        <MapPin size={12} />
                        <span>โครงการ: {projectName} {workOrder.locationName ? `| สถานที่: ${workOrder.locationName}` : ''}</span>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    <div style={{ background: '#eef2ff', border: '1px solid #e0e7ff', padding: '14px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 700, color: '#4338ca', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <Sparkles size={18} style={{ flexShrink: 0, color: '#6366f1' }} />
                        <div>
                            เรียน คุณลูกค้าตรวจรับงาน โปรดประเมินรายการงานย่อยด้านล่างโดยกด "ผ่าน" หรือ "ส่งแก้ไข" และทำแบบสอบถามก่อนยืนยันค่ะ
                        </div>
                    </div>

                    {/* Tasks list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 style={{ margin: '0 0 4px 4px', fontSize: '0.82rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>รายการงานที่ส่งมอบ ({eligibleTasks.length})</h3>
                        {eligibleTasks.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1', fontSize: '0.85rem', color: '#64748b' }}>
                                ไม่มีรายการที่รอลูกค้าตรวจรับในขณะนี้
                            </div>
                        ) : (
                            eligibleTasks.map((task: any) => {
                                const decision = approvals[task.id];
                                const isExpanded = !!expandedTaskIds[task.id];
                                const photos = getAfterPhotos(task);

                                return (
                                    <div key={task.id} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', borderColor: decision?.status === 'approved' ? '#86efac' : decision?.status === 'rejected' ? '#fca5a5' : '#e2e8f0' }}>
                                        {/* Row Header */}
                                        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>{task.name || task.taskName}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleSelectAction(task.id, 'approved')} style={{ border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', background: decision?.status === 'approved' ? '#22c55e' : '#f1f5f9', color: decision?.status === 'approved' ? '#fff' : '#475569' }}>
                                                    ผ่าน
                                                </button>
                                                <button onClick={() => handleSelectAction(task.id, 'rejected')} style={{ border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', background: decision?.status === 'rejected' ? '#ef4444' : '#f1f5f9', color: decision?.status === 'rejected' ? '#fff' : '#475569' }}>
                                                    แก้ไข
                                                </button>
                                                <button onClick={() => setExpandedTaskIds(p => ({ ...p, [task.id]: !isExpanded }))} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
                                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Row Expanded Details (Photos & Rejection inputs) */}
                                        {isExpanded && (
                                            <div style={{ padding: '16px', borderTop: '1px solid #edf2f7', background: '#fafbfc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {/* Before / After Photos Grid */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                                                    {/* Before Column */}
                                                    <div>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Camera size={12} />
                                                            <span>รูปถ่ายก่อนทำ (BEFORE)</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '110px', borderRadius: '12px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {task.beforePhotoUrl ? (
                                                                <img src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} alt="Before" onClick={() => window.open(task.beforePhotoUrl, '_blank')} />
                                                            ) : (
                                                                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 700 }}>
                                                                    <Camera size={18} /><br />ไม่มีรูปแจ้งซ่อม
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* After Column */}
                                                    <div>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#10b981', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Camera size={12} />
                                                            <span>รูปถ่ายหลังทำ (AFTER)</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '110px', borderRadius: '12px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {photos.length > 0 ? (
                                                                <img src={photos[0]} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} alt="After" onClick={() => window.open(photos[0], '_blank')} />
                                                            ) : (
                                                                <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.65rem', fontWeight: 700 }}>
                                                                    <Camera size={18} /><br />ไม่มีรูปงานเสร็จ
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Additional After Photos if any */}
                                                {photos.length > 1 && (
                                                    <div style={{ marginTop: '-4px', marginBottom: '6px' }}>
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>รูปถ่ายหลังทำเพิ่มเติม:</div>
                                                        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                                                            {photos.slice(1).map((p, idx) => (
                                                                <img key={idx} src={p} alt={`After ${idx + 2}`} style={{ width: '45px', height: '45px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #e2e8f0', cursor: 'pointer', flexShrink: 0 }} onClick={() => window.open(p, '_blank')} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Rejection Input Fields */}
                                                {decision?.status === 'rejected' && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#fff5f5', padding: '12px', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#b91c1c' }}>ระบุจุดชำรุดและวิธีติดต่อ:</div>
                                                        <input 
                                                            type="text" 
                                                            placeholder="ระบุจุดที่ชำรุด/ต้องการให้แก้ไข..." 
                                                            value={rejectReasons[task.id] || ''} 
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setRejectReasons(p => ({ ...p, [task.id]: val }));
                                                                setApprovals(p => ({ ...p, [task.id]: { ...p[task.id], reason: val } }));
                                                            }}
                                                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #fca5a5', fontSize: '0.82rem' }}
                                                        />
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0 8px' }}>
                                                                <User size={14} color="#ef4444" style={{ marginRight: '6px' }} />
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="ชื่อติดต่อ..." 
                                                                    value={contactNames[task.id] || ''} 
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setContactNames(p => ({ ...p, [task.id]: val }));
                                                                        setApprovals(p => ({ ...p, [task.id]: { ...p[task.id], contactName: val } }));
                                                                    }}
                                                                    style={{ padding: '8px 0', border: 'none', outline: 'none', fontSize: '0.8rem', width: '100%' }}
                                                                />
                                                            </div>
                                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0 8px' }}>
                                                                <Phone size={14} color="#ef4444" style={{ marginRight: '6px' }} />
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="เบอร์โทร..." 
                                                                    value={contactPhones[task.id] || ''} 
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setContactPhones(p => ({ ...p, [task.id]: val }));
                                                                        setApprovals(p => ({ ...p, [task.id]: { ...p[task.id], contactPhone: val } }));
                                                                    }}
                                                                    style={{ padding: '8px 0', border: 'none', outline: 'none', fontSize: '0.8rem', width: '100%' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Handover Satisfaction Survey (Only shown when everything approved) */}
                    {isAllApproved && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#fafbfc', border: '1px solid #e8edf2', padding: '16px', borderRadius: '20px' }}>
                            <h4 style={{ margin: '0 0 4px 4px', fontSize: '0.82rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>แบบประเมินความพึงพอใจ</h4>
                            {renderRating("คุณภาพงานซ่อมแซม", workQuality, setWorkQuality)}
                            {renderRating("ความสะอาดหน้างาน", siteCleanliness, setSiteCleanliness)}
                            {renderRating("ความเป็นมืออาชีพของทีมงาน", foremanProfessionalism, setForemanProfessionalism)}
                            {renderRating("ความถูกต้องตรงตามสเปก", specAccuracy, setSpecAccuracy)}
                            {renderRating("ความเอาใจใส่ในการส่งมอบ", handoverCare, setHandoverCare)}
                        </div>
                    )}

                    {/* Submit Button */}
                    {eligibleTasks.length > 0 && (
                        <button 
                            onClick={handleFinalSubmit}
                            disabled={submitting}
                            style={{ 
                                marginTop: '10px', background: hasRejections ? '#ef4444' : '#22c55e', color: '#fff', 
                                border: 'none', padding: '14px', borderRadius: '16px', fontSize: '0.95rem', 
                                fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', 
                                justifyContent: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                            }}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    <span>กำลังส่งข้อมูล...</span>
                                </>
                            ) : (
                                <span>{hasRejections ? 'ส่งจุดที่ต้องแก้ไขกลับให้โฟร์แมน' : 'ยืนยันและส่งมอบงานตรวจรับ'}</span>
                            )}
                        </button>
                    )}

                </div>
            </div>
        </div>
    );
}
