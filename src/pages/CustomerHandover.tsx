import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAlert } from '../context/AlertContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import {
    Star, Sparkles, Building2, ChevronDown, ChevronUp,
    Loader2, CheckCircle2, AlertTriangle, ClipboardList,
    MapPin, Camera, User, Phone, ChevronLeft
} from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

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

// T-craft (2026-07-23) — Critical #2 mitigation: the public /handover page has
// no auth and no server-side rate limit, so repeated reloads of the same QR
// link (accidental or scripted) each re-run the full nested Firestore read
// (categories -> tasks -> subtasks -> revisions -> dailyReports). A single-slot
// localStorage cache absorbs that: reloading the SAME woId within TTL reuses
// the last fetched bundle instead of hitting Firestore again. This only helps
// requests that go through this page's own JS (a script hitting Firestore
// directly bypasses it) — accepted client-side-only tradeoff per user decision.
const HANDOVER_CACHE_KEY = 'after_sale_handover_cache_v1';
const HANDOVER_CACHE_TTL_MS = 60_000;

interface HandoverCacheEntry {
    woId: string;
    ts: number;
    workOrder: any;
    projectName: string;
    phCategoryReports: Record<string, any>;
    contactNames: Record<string, string>;
    contactPhones: Record<string, string>;
}

function readHandoverCache(woId: string): HandoverCacheEntry | null {
    try {
        const raw = window.localStorage.getItem(HANDOVER_CACHE_KEY);
        if (!raw) return null;
        const entry: HandoverCacheEntry = JSON.parse(raw);
        if (entry.woId !== woId) return null;
        if (Date.now() - entry.ts > HANDOVER_CACHE_TTL_MS) return null;
        return entry;
    } catch {
        return null;
    }
}

function writeHandoverCache(entry: HandoverCacheEntry) {
    try {
        window.localStorage.setItem(HANDOVER_CACHE_KEY, JSON.stringify(entry));
    } catch {
        // Storage full/unavailable (e.g. private browsing) — cache is a pure
        // optimization, safe to silently skip.
    }
}

export default function CustomerHandover() {
    const isMobile = useIsMobile();
    const [searchParams] = useSearchParams();
    const woId = searchParams.get('woId') || '';
    
    const { submitCustomerInspection, submitPhCustomerInspection, logCustomerQrView } = useWorkOrders();
    const showAlert = useAlert();

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

    // PreHandover-specific
    const [phCategoryReports, setPhCategoryReports] = useState<Record<string, any>>({});
    const [catApprovals, setCatApprovals] = useState<Record<string, { status: 'approved' | 'rejected'; reason?: string }>>({});
    const [catRejectReasons, setCatRejectReasons] = useState<Record<string, string>>({});

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

            const cached = readHandoverCache(woId);
            if (cached) {
                setWorkOrder(cached.workOrder);
                setProjectName(cached.projectName);
                setPhCategoryReports(cached.phCategoryReports);
                setContactNames(cached.contactNames);
                setContactPhones(cached.contactPhones);
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
                            
                            // Fetch from revisions dailyReports
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

                    // If PreHandover: fetch dailyReports from current revision (latest per category)
                    let phReportsForCache: Record<string, any> = {};
                    if (woData.type === 'PreHandover') {
                        const phReports: Record<string, any> = {};
                        for (const cat of categories) {
                            try {
                                const phRev = cat.currentRevision || 'rev00';
                                const phSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', cat.id, 'revisions', phRev, 'dailyReports'));
                                const reports = phSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                                    .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                                if (reports.length > 0) phReports[cat.id] = reports[0];
                            } catch (_) {}
                        }
                        setPhCategoryReports(phReports);
                        phReportsForCache = phReports;
                    }

                    // Log view
                    await logCustomerQrView(woSnap.id);

                    // Fetch Project details for name
                    let resolvedProjectName = 'โครงการก่อสร้าง';
                    if (woData.projectId) {
                        const projRef = doc(db, 'projects', woData.projectId);
                        const projSnap = await getDoc(projRef);
                        if (projSnap.exists()) {
                            resolvedProjectName = projSnap.data().name || 'โครงการก่อสร้าง';
                            setProjectName(resolvedProjectName);
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

                    writeHandoverCache({
                        woId,
                        ts: Date.now(),
                        workOrder: fullWorkOrder,
                        projectName: resolvedProjectName,
                        phCategoryReports: phReportsForCache,
                        contactNames: names,
                        contactPhones: phones,
                    });
                }
            } catch (err) {
                console.error("Error fetching Work Order handover data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchWoData();
    }, [woId]);

    // Safe back affordance: only show when there is somewhere to go back to.
    // Opened fresh from a QR code (history.length === 1) → hidden, so the customer
    // is never dumped onto a blank page; the page's own guidance covers that case.
    const canGoBack = typeof window !== 'undefined' && window.history.length > 1;
    const BackButton = () => (
        !canGoBack ? null : (
            <button
                onClick={() => window.history.back()}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569',
                    fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                    borderRadius: '12px', padding: '8px 14px',
                    minWidth: isMobile ? '44px' : undefined, minHeight: isMobile ? '44px' : undefined,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
            >
                <ChevronLeft size={16} />
                <span>ย้อนกลับ</span>
            </button>
        )
    );

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: '16px' }}>
                <Loader2 size={40} className="animate-spin" style={{ color: '#3b82f6' }} />
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#3b82f6', fontFamily: 'system-ui' }}>กำลังโหลดข้อมูลการส่งมอบงาน...</div>
            </div>
        );
    }

    if (!workOrder) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px', boxSizing: 'border-box' }}>
                <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {canGoBack && <div><BackButton /></div>}
                    <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '64px', height: '64px', background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                            <AlertTriangle size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0' }}>ไม่พบข้อมูลการตรวจรับงาน</h3>
                        <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                            ลิงก์ส่งมอบงานอาจไม่ถูกต้อง หรือรายการงานนี้ได้รับการแก้ไขแล้ว โปรดตรวจสอบคิวอาร์โค้ดส่งมอบอีกครั้ง
                        </p>
                    </div>
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
            const notYetVerified = task.status !== 'Complete';
            const notStillRejectedByAdmin = task.status !== 'Rejected' && !isWoPendingReassign;
            return hasCompletedProgress && notYetVerified && notStillRejectedByAdmin;
        })
    );

    const handleSelectAction = async (taskId: string, status: 'approved' | 'rejected') => {
        const incompleteRejectTask = eligibleTasks.find((t: any) => 
            approvals[t.id]?.status === 'rejected' && (
                !rejectReasons[t.id]?.trim() || 
                !contactNames[t.id]?.trim() || 
                !contactPhones[t.id]?.trim()
            )
        );
        
        if (incompleteRejectTask && incompleteRejectTask.id !== taskId) {
            await showAlert(`กรุณากรอกข้อมูลสาเหตุ ชื่อติดต่อกลับ และเบอร์โทร สำหรับรายการแก้ไข "${incompleteRejectTask.name || incompleteRejectTask.taskName}" ก่อนประเมินรายการอื่น`);
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
            await showAlert('กรุณาประเมินงานย่อย (ผ่าน / แก้ไข) ให้ครบถ้วนทุกรายการก่อนกดส่งมอบงาน');
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
            await showAlert('กรุณากรอกสาเหตุ ชื่อผู้แจ้ง และเบอร์โทรสำหรับรายการที่สั่งแก้ไข (Reject)');
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
            await showAlert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px', boxSizing: 'border-box' }}>
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

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <Sparkles size={16} style={{ color: '#3b82f6' }} />
                        <span>ท่านสามารถปิดหน้านี้บนมือถือของท่านได้เลย</span>
                    </div>
                </div>
            </div>
        );
    }

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

    // ─── PreHandover Branch ───────────────────────────────────────────────────
    if (workOrder?.type === 'PreHandover') {
        const phCategories = workOrder.categories || [];
        const phHasRejections = Object.values(catApprovals).some(a => a.status === 'rejected');
        const phIsAllDecided = phCategories.length > 0 && phCategories.every((cat: any) => !!catApprovals[cat.id]);
        const phIsAllApproved = phIsAllDecided && !phHasRejections;

        const handlePhSelectAction = (catId: string, status: 'approved' | 'rejected') => {
            setCatApprovals(prev => {
                if (prev[catId]?.status === status) { const n = { ...prev }; delete n[catId]; return n; }
                return { ...prev, [catId]: { status, reason: catRejectReasons[catId] || '' } };
            });
        };

        const handlePhSubmit = async () => {
            const undecided = phCategories.filter((cat: any) => !catApprovals[cat.id]);
            if (undecided.length > 0) { await showAlert('กรุณาประเมินทุกหมวดงาน (ผ่าน / ส่งแก้ไข) ให้ครบก่อนยืนยัน'); return; }
            const incompleteReject = phCategories.find((cat: any) => catApprovals[cat.id]?.status === 'rejected' && !catRejectReasons[cat.id]?.trim());
            if (incompleteReject) { await showAlert(`กรุณาระบุเหตุผลสำหรับหมวดงาน "${incompleteReject.name}" ที่สั่งแก้ไข`); return; }

            // Merge reasons into catApprovals
            const finalApprovals = { ...catApprovals };
            Object.keys(finalApprovals).forEach(id => { if (finalApprovals[id].status === 'rejected') finalApprovals[id] = { ...finalApprovals[id], reason: catRejectReasons[id] || '' }; });

            setSubmitting(true);
            try {
                const surveyPayload = phHasRejections ? undefined : { workQuality, siteCleanliness, foremanProfessionalism, specAccuracy, handoverCare };
                await submitPhCustomerInspection(workOrder.id, finalApprovals, surveyPayload);
                setSubmitType(phHasRejections ? 'reject' : 'approve');
                setSubmitted(true);
            } catch (err) {
                await showAlert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่');
            } finally {
                setSubmitting(false);
            }
        };

        return (
            <div style={{ background: '#f0fdfa', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '16px', fontFamily: 'system-ui' }}>
                <div style={{ background: '#ffffff', width: '100%', maxWidth: '640px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>

                    {/* Header */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #ccfbf1', background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%)', borderRadius: '24px 24px 0 0' }}>
                        {canGoBack && (
                            <div style={{ marginBottom: '12px' }}><BackButton /></div>
                        )}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ccfbf1', padding: '4px 10px', borderRadius: '50px', border: '1px solid #99f6e4', marginBottom: '8px' }}>
                            <ClipboardList size={12} color="#0d9488" />
                            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0d9488', letterSpacing: '0.05em' }}>PRE-HANDOVER INSPECTION</span>
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>แบบฟอร์มตรวจรับก่อนโอน</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#0d9488', fontSize: '0.78rem' }}>
                            <MapPin size={12} />
                            <span>โครงการ: {projectName} {workOrder.locationName ? `| ${workOrder.locationName}` : ''}</span>
                        </div>
                    </div>

                    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', padding: '12px 14px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <ClipboardList size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                            <div>กรุณาตรวจสอบรายการหมวดงานด้านล่าง และกด "ผ่าน" หรือ "ส่งแก้ไข" ทุกรายการก่อนยืนยันรับมอบงาน</div>
                        </div>

                        {/* Category list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h3 style={{ margin: '0 0 2px 4px', fontSize: '0.82rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>หมวดงานทั้งหมด ({phCategories.length})</h3>
                            {phCategories.map((cat: any) => {
                                const decision = catApprovals[cat.id];
                                const latestReport = phCategoryReports[cat.id];
                                const photos: string[] = (latestReport?.sitePhotos || []).filter(Boolean).slice(0, 4);
                                const isExpanded = !!expandedTaskIds[cat.id];
                                return (
                                    <div key={cat.id} style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${decision?.status === 'approved' ? '#86efac' : decision?.status === 'rejected' ? '#fca5a5' : '#e2e8f0'}`, overflow: 'hidden' }}>
                                        {/* Row header — stacks into two rows on mobile so the approve/reject/
                                            expand buttons always get the full card width and can't get
                                            clipped by the card's overflow:hidden (user-reported 2026-07-23:
                                            chevron was squeezed off-screen next to a long category name). */}
                                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '10px' : 0 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>{cat.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                                    {latestReport ? `รายงานล่าสุด: ${latestReport.date}` : 'ไม่มีข้อมูลรายงาน'}
                                                    {` · ความคืบหน้า ${cat.dailyProgress || 0}%`}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
                                                <button onClick={() => handlePhSelectAction(cat.id, 'approved')} style={{ border: 'none', padding: '5px 11px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', background: decision?.status === 'approved' ? '#22c55e' : '#f1f5f9', color: decision?.status === 'approved' ? '#fff' : '#475569' }}>ผ่าน</button>
                                                <button onClick={() => handlePhSelectAction(cat.id, 'rejected')} style={{ border: 'none', padding: '5px 11px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', background: decision?.status === 'rejected' ? '#ef4444' : '#f1f5f9', color: decision?.status === 'rejected' ? '#fff' : '#475569' }}>ส่งแก้ไข</button>
                                                {(photos.length > 0 || decision?.status === 'rejected') && (
                                                    <button onClick={() => setExpandedTaskIds(p => ({ ...p, [cat.id]: !isExpanded }))} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Expanded: photos + reject reason */}
                                        {isExpanded && (
                                            <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {photos.length > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Camera size={12} /><span>รูปถ่ายจากรายงานล่าสุด</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                            {photos.map((p, i) => (
                                                                <img key={i} src={typeof p === 'string' ? p : URL.createObjectURL(p)} alt="" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {decision?.status === 'rejected' && (
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', marginBottom: '4px' }}>ระบุเหตุผลที่ส่งแก้ไข *</div>
                                                        <textarea
                                                            value={catRejectReasons[cat.id] || ''}
                                                            onChange={e => setCatRejectReasons(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                                            placeholder="เช่น งานฉาบปูนไม่เรียบ, สีไม่สม่ำเสมอ..."
                                                            rows={2}
                                                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #fca5a5', fontSize: '0.83rem', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Rating — only when all approved */}
                        {phIsAllApproved && (
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', fontWeight: 900, color: '#0f172a' }}>แบบประเมินความพึงพอใจ</h3>
                                {renderRating('คุณภาพงาน', workQuality, setWorkQuality)}
                                {renderRating('ความสะอาดหน้างาน', siteCleanliness, setSiteCleanliness)}
                                {renderRating('ความเป็นมืออาชีพของโฟรแมน', foremanProfessionalism, setForemanProfessionalism)}
                                {renderRating('ความถูกต้องตามสเปก', specAccuracy, setSpecAccuracy)}
                                {renderRating('ความระมัดระวังในการส่งมอบ', handoverCare, setHandoverCare)}
                            </div>
                        )}

                        {/* Submit button */}
                        {phIsAllDecided && (
                            <button
                                onClick={handlePhSubmit}
                                disabled={submitting}
                                style={{ width: '100%', padding: '14px', borderRadius: '14px', border: 'none', background: submitting ? '#99f6e4' : phHasRejections ? '#dc2626' : '#0d9488', color: '#fff', fontSize: '0.9rem', fontWeight: 900, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(13,148,136,0.2)' }}
                            >
                                {submitting ? 'กำลังบันทึก...' : phHasRejections ? 'ยืนยันส่งแก้ไข' : 'ยืนยันรับมอบงาน'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    // ─── End PreHandover Branch ────────────────────────────────────────────────

    const hasRejections = Object.values(approvals).some(a => a.status === 'rejected');
    const isAllApproved = eligibleTasks.length > 0 && eligibleTasks.every((task: any) => approvals[task.id]?.status === 'approved');

    return (
        <div style={{ background: '#f4f6fa', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '16px', fontFamily: 'system-ui' }}>
            <div style={{ background: '#ffffff', width: '100%', maxWidth: '640px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
                
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #edf2f7' }}>
                    {canGoBack && (
                        <div style={{ marginBottom: '12px' }}><BackButton /></div>
                    )}
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
                                        {/* Row Header — stacks into two rows on mobile so the approve/reject/
                                            expand buttons always get the full card width and can't get
                                            clipped by the card's overflow:hidden (user-reported 2026-07-23:
                                            chevron was squeezed off-screen next to a long task name). */}
                                        <div style={{ padding: '16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '10px' : 0 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>{task.name || task.taskName}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
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
