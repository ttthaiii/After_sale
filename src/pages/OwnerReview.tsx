import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { 
    CheckCircle2, XCircle, Camera, AlertTriangle, 
    Building2, MapPin, Package, UserCheck, FileText, 
    Loader2, Sparkles
} from 'lucide-react';

export default function OwnerReview() {
    const [searchParams] = useSearchParams();
    const woId = searchParams.get('woId') || '';
    const catId = searchParams.get('catId') || '';
    const taskId = searchParams.get('taskId') || '';

    // States
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitType, setSubmitType] = useState<'approve' | 'reject' | null>(null);

    // Data States
    const [workOrder, setWorkOrder] = useState<any>(null);
    const [category, setCategory] = useState<any>(null);
    const [task, setTask] = useState<any>(null);
    const [projectName, setProjectName] = useState('โครงการก่อสร้าง');

    // Form States
    const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
    const [ownerName, setOwnerName] = useState('');
    const [notes, setNotes] = useState('');
    const [rejectReason, setRejectReason] = useState('');

    // Load Task details directly from Firestore
    useEffect(() => {
        const fetchData = async () => {
            if (!woId || !catId || !taskId) {
                setLoading(false);
                return;
            }
            try {
                // Fetch WO
                const woRef = doc(db, 'workOrders', woId);
                const woSnap = await getDoc(woRef);
                if (woSnap.exists()) {
                    const woData = woSnap.data();
                    setWorkOrder({ ...woData, id: woSnap.id });

                    // Fetch Project details for name
                    if (woData.projectId) {
                        const projRef = doc(db, 'projects', woData.projectId);
                        const projSnap = await getDoc(projRef);
                        if (projSnap.exists()) {
                            setProjectName(projSnap.data().name || 'โครงการก่อสร้าง');
                        }
                    }
                }

                // Fetch Category
                const catRef = doc(db, 'workOrders', woId, 'categories', catId);
                const catSnap = await getDoc(catRef);
                if (catSnap.exists()) {
                    setCategory(catSnap.data());
                }

                // Fetch Task
                const taskRef = doc(db, 'workOrders', woId, 'categories', catId, 'tasks', taskId);
                const taskSnap = await getDoc(taskRef);
                if (taskSnap.exists()) {
                    setTask(taskSnap.data());
                }
            } catch (error) {
                console.error("Error loading review task details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [woId, catId, taskId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: '16px' }}>
                <Loader2 size={40} className="animate-spin" style={{ color: '#4f46e5' }} />
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#4f46e5', fontFamily: 'system-ui' }}>กำลังโหลดข้อมูลตรวจรับงาน...</div>
            </div>
        );
    }

    if (!workOrder || !task) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px', boxSizing: 'border-box' }}>
                <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '64px', height: '64px', background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                        <AlertTriangle size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0' }}>ไม่พบข้อมูลรายการงาน</h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                        ลิงก์ตรวจรับงานอาจไม่ถูกต้อง หรือรายการงานนี้ได้รับการแก้ไข/ลบออกจากระบบแล้ว โปรดติดต่อแอดมินหรือโฟร์แมนโครงการ
                    </p>
                </div>
            </div>
        );
    }

    const currentRev = task.currentRevision || 'rev00';
    const revDisplay = currentRev === 'rev00' ? 'REV. 0 (ครั้งแรก)' : `REV. ${parseInt(currentRev.replace('rev', ''))}`;

    const handleApprove = async () => {
        if (!ownerName.trim()) {
            alert('กรุณากรอกชื่อผู้ตรวจรับงาน');
            return;
        }
        setSubmitting(true);
        try {
            const now = new Date().toISOString();
            const taskRef = doc(db, 'workOrders', woId, 'categories', catId, 'tasks', taskId);
            
            await updateDoc(taskRef, {
                status: 'Verified',
                ownerName: ownerName.trim(),
                notes: notes.trim(),
                updatedAt: now
            });

            // Log action if possible, otherwise write directly to Firestore
            setSubmitType('approve');
            setSubmitted(true);
        } catch (error) {
            console.error("Error approving task:", error);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            alert('กรุณาระบุสาเหตุที่ไม่ผ่านหรือจุดงานชำรุดที่ต้องแก้ไข');
            return;
        }
        setSubmitting(true);
        try {
            const now = new Date().toISOString();
            const taskRef = doc(db, 'workOrders', woId, 'categories', catId, 'tasks', taskId);

            const revNum = parseInt(currentRev.replace('rev', '')) || 0;
            const nextRev = `rev${String(revNum + 1).padStart(2, '0')}`;

            await updateDoc(taskRef, {
                status: 'Rejected',
                revisionName: rejectReason.trim(),
                revisionCreatedAt: now,
                currentRevision: nextRev,
                dailyProgress: 0,
                completedAt: deleteField(), // clear stale timestamp so Round N+1 SLA calculates correctly
                updatedAt: now
            });

            setSubmitType('reject');
            setSubmitted(true);
        } catch (error) {
            console.error("Error rejecting task:", error);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px', boxSizing: 'border-box' }}>
                <div style={{
                    background: '#ffffff',
                    width: '100%', maxWidth: '520px',
                    borderRadius: '32px',
                    padding: '2.5rem 2rem',
                    textAlign: 'center',
                    boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.8)'
                }}>
                    {submitType === 'approve' ? (
                        <>
                            <div style={{ width: '80px', height: '80px', background: '#dcfce7', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', boxShadow: '0 8px 20px -6px rgba(16, 185, 129, 0.3)' }}>
                                <CheckCircle2 size={44} />
                            </div>
                            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: 900, color: '#064e3b' }}>
                                อนุมัติและตรวจรับงานสำเร็จ!
                            </h2>
                            <p style={{ margin: '0 0 2rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
                                ขอบคุณสำหรับการสละเวลาตรวจงาน ระบบได้ทำการบันทึกข้อมูลและปิดรายการงานเรียบร้อยแล้ว โฟร์แมนและช่างโครงการจะได้รับแจ้งการปิดงานทันที
                            </p>
                        </>
                    ) : (
                        <>
                            <div style={{ width: '80px', height: '80px', background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', boxShadow: '0 8px 20px -6px rgba(239, 68, 68, 0.3)' }}>
                                <XCircle size={44} />
                            </div>
                            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: 900, color: '#7f1d1d' }}>
                                บันทึกการส่งกลับแก้ไขเรียบร้อย
                            </h2>
                            <p style={{ margin: '0 0 2rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
                                ระบบได้ส่งตีกลับงานนี้เรียบร้อยแล้ว รายการจะถูกย้อนความคืบหน้ากลับเป็น 0% และปรับเป็นรุ่น (Revision) ถัดไป ช่างจะได้รับแจ้งและเริ่มเข้าไปทำการแก้ไขจุดชำรุดทันที
                            </p>
                        </>
                    )}

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <Sparkles size={16} style={{ color: '#4f46e5' }} />
                        <span>ท่านสามารถปิดหน้านี้บนมือถือของท่านได้เลย</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '16px 16px 40px 16px', boxSizing: 'border-box', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                
                {/* Brand Header */}
                <div style={{ textAlign: 'center', margin: '20px 0 24px 0' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#eff6ff', padding: '6px 16px', borderRadius: '50px', border: '1px solid #dbeafe', marginBottom: '12px' }}>
                        <Building2 size={16} style={{ color: '#3b82f6' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1e40af', letterSpacing: '0.05em' }}>TTS ENGINEERING</span>
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>ระบบตรวจรับงานสำหรับลูกค้า (Owner Review)</h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>โปรดตรวจสอบผลงานและระบุผลตรวจรับของท่าน</p>
                </div>

                {/* Project Details Card */}
                <div style={{ background: '#ffffff', borderRadius: '24px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifySelf: 'start', gap: '6px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#4f46e5', background: '#e0e7ff', padding: '3px 8px', borderRadius: '6px' }}>
                            {task.taskCode || task.id}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: '6px' }}>
                            {revDisplay}
                        </span>
                    </div>

                    <h2 style={{ margin: '0 0 12px 0', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                        {task.name}
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', fontSize: '0.8rem', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={13} style={{ color: '#94a3b8' }} />
                            <span style={{ fontWeight: 800, color: '#64748b' }}>โครงการ:</span>
                            <span style={{ fontWeight: 900, color: '#334155' }}>{projectName}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={13} style={{ color: '#94a3b8' }} />
                            <span style={{ fontWeight: 800, color: '#64748b' }}>พื้นที่หน้างาน:</span>
                            <span style={{ fontWeight: 900, color: '#334155' }}>{workOrder.locationName} ({category?.name || 'หมวดงานทั่วไป'})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Package size={13} style={{ color: '#94a3b8' }} />
                            <span style={{ fontWeight: 800, color: '#64748b' }}>ปริมาณงาน:</span>
                            <span style={{ fontWeight: 900, color: '#334155' }}>{task.amount || 1} {task.unit || 'จุด'} ({task.position || '-'})</span>
                        </div>
                        {task.assignee && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <UserCheck size={13} style={{ color: '#94a3b8' }} />
                                <span style={{ fontWeight: 800, color: '#64748b' }}>ช่างผู้รับผิดชอบ:</span>
                                <span style={{ fontWeight: 900, color: '#334155' }}>{task.assignee}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Before / After Photo Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}>
                    {/* Before Photo Card */}
                    <div style={{ background: '#ffffff', borderRadius: '24px', padding: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Camera size={13} />
                            <span>ภาพก่อนดำเนินงาน (BEFORE)</span>
                        </div>
                        <div style={{ width: '100%', height: '220px', borderRadius: '16px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {task.beforePhotoUrl ? (
                                <img src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Before" />
                            ) : (
                                <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                                    <Camera size={32} />
                                    <div style={{ fontSize: '0.75rem', marginTop: '6px', fontWeight: 600 }}>ไม่มีภาพแจ้งซ่อม</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* After Photo Card */}
                    <div style={{ background: '#ffffff', borderRadius: '24px', padding: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Camera size={13} />
                            <span>ภาพหลังดำเนินงานเสร็จสิ้น (AFTER)</span>
                        </div>
                        <div style={{ width: '100%', height: '220px', borderRadius: '16px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {task.latestPhotoUrl || task.afterPhotoUrl ? (
                                <img src={task.latestPhotoUrl || task.afterPhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="After" />
                            ) : (
                                <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                                    <Camera size={32} />
                                    <div style={{ fontSize: '0.75rem', marginTop: '6px', fontWeight: 600 }}>ไม่มีภาพหลังงานเสร็จ</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Last Foreman note */}
                {task.history && task.history.length > 0 && (
                    <div style={{ background: '#ffffff', borderRadius: '24px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={13} />
                            <span>บันทึกการทำงานล่าสุดจากช่างประจำวัน ({task.history[0].date}):</span>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '14px', fontSize: '0.8rem', fontStyle: 'italic', color: '#475569', border: '1px solid #e2e8f0' }}>
                            "{task.history[0].note || 'ไม่มีระบุข้อความหมายเหตุ'}"
                        </div>
                    </div>
                )}

                {/* Interactive Action Forms */}
                {actionType === null ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <button
                            onClick={() => setActionType('approve')}
                            style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '18px 12px',
                                borderRadius: '20px',
                                fontWeight: 900,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 10px 20px -8px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <CheckCircle2 size={24} />
                            <span>อนุมัติผ่านงาน (Approve)</span>
                        </button>

                        <button
                            onClick={() => setActionType('reject')}
                            style={{
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '18px 12px',
                                borderRadius: '20px',
                                fontWeight: 900,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 10px 20px -8px rgba(239, 68, 68, 0.3)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <XCircle size={24} />
                            <span>ส่งกลับแก้ไข (Reject)</span>
                        </button>
                    </div>
                ) : actionType === 'approve' ? (
                    /* Approve Form */
                    <div style={{ background: '#ffffff', borderRadius: '24px', padding: '20px', border: '2px solid #10b981', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#064e3b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                                <span>ยืนยันอนุมัติผ่านงานตรวจรับ (Approve Form)</span>
                            </h4>
                            <button 
                                onClick={() => setActionType(null)}
                                style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                                ย้อนกลับ
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', color: '#475569', marginBottom: '6px' }}>
                                    ชื่อผู้แทนลูกค้า / เจ้าของบ้านผู้ลงนามตรวจรับ <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="กรอกชื่อ-นามสกุล ของท่าน..."
                                    value={ownerName}
                                    onChange={e => setOwnerName(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: '12px',
                                        border: '1.5px solid #cbd5e1', fontSize: '0.85rem', outline: 'none',
                                        fontWeight: 600, boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', color: '#475569', marginBottom: '6px' }}>
                                    คำติชม หรือ ข้อความหมายเหตุเพิ่มเติม (ถ้ามี)
                                </label>
                                <textarea 
                                    rows={3} 
                                    placeholder="ระบุข้อความคำติชม หรือ หมายเหตุเพิ่มเติมเกี่ยวกับงาน..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: '12px',
                                        border: '1.5px solid #cbd5e1', fontSize: '0.85rem', outline: 'none',
                                        fontWeight: 600, boxSizing: 'border-box', resize: 'none'
                                    }}
                                />
                            </div>

                            <button
                                onClick={handleApprove}
                                disabled={submitting || !ownerName.trim()}
                                style={{
                                    background: ownerName.trim() ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '14px 20px',
                                    borderRadius: '14px',
                                    fontWeight: 900,
                                    fontSize: '0.9rem',
                                    cursor: ownerName.trim() ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: ownerName.trim() ? '0 10px 20px -8px rgba(16, 185, 129, 0.3)' : 'none',
                                    transition: 'all 0.2s',
                                    marginTop: '8px'
                                }}
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                <span>{submitting ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันปิดงานโดยสมบูรณ์'}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Reject Form */
                    <div style={{ background: '#ffffff', borderRadius: '24px', padding: '20px', border: '2px solid #ef4444', boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <XCircle size={18} style={{ color: '#ef4444' }} />
                                <span>ยืนยันตีกลับเพื่อแก้ไขงาน (Reject Form)</span>
                            </h4>
                            <button 
                                onClick={() => setActionType(null)}
                                style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                                ย้อนกลับ
                            </button>
                        </div>

                        <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '12px', border: '1px solid #fee2e2', color: '#991b1b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '12px', display: 'flex', gap: '8px' }}>
                            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                            <span>การส่งกลับแก้ไขจะส่งผลให้โปรเกรสลดเหลือ 0% เพื่อให้ช่างเริ่มดำเนินการปรับปรุงและรายงานข้อมูลเข้ามาอีกครั้ง</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', color: '#475569', marginBottom: '6px' }}>
                                    ระบุสาเหตุที่ไม่ผ่านการตรวจรับ / จุดบกพร่องที่ต้องแก้ไข <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <textarea 
                                    rows={4} 
                                    placeholder="ระบุจุดที่ชำรุด งานไม่เรียบร้อย เพื่อให้ช่างนำไปแก้ไขได้ถูกต้อง..."
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: '12px',
                                        border: '1.5px solid #cbd5e1', fontSize: '0.85rem', outline: 'none',
                                        fontWeight: 600, boxSizing: 'border-box', resize: 'none'
                                    }}
                                />
                            </div>

                            <button
                                onClick={handleReject}
                                disabled={submitting || !rejectReason.trim()}
                                style={{
                                    background: rejectReason.trim() ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : '#cbd5e1',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '14px 20px',
                                    borderRadius: '14px',
                                    fontWeight: 900,
                                    fontSize: '0.9rem',
                                    cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: rejectReason.trim() ? '0 10px 20px -8px rgba(239, 68, 68, 0.3)' : 'none',
                                    transition: 'all 0.2s',
                                    marginTop: '8px'
                                }}
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                <span>{submitting ? 'กำลังบันทึกข้อมูล...' : 'ส่งกลับแก้ไข (Create Revision)'}</span>
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
