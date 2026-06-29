import { useState, useEffect } from 'react';
import { X, Clock, Users, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { WorkOrder, Staff } from '../types';

interface Assignment {
    foremanId: string;
    foremanName: string;
}

interface PreHandoverAssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    wo: WorkOrder;
    staffList: Staff[];
    onConfirm: (confirmedSla: string, assignments: { catId: string; foremanId: string; foremanName: string }[], scheduledDate: string) => Promise<void>;
}

const SLA_OPTIONS = ['7-14d', '14-30d', '30-60d', '60d+'];

const PreHandoverAssignModal = ({ isOpen, onClose, wo, staffList, onConfirm }: PreHandoverAssignModalProps) => {
    const foremanList = staffList.filter(s => s.role === 'Foreman');

    const [confirmedSla, setConfirmedSla] = useState((wo as any).phEstimatedSla || '14-30d');
    const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
    const [assignAllId, setAssignAllId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [scheduledDate, setScheduledDate] = useState((wo as any).scheduledDate || new Date().toISOString().split('T')[0]);

    // Init from existing category assignments (if re-opening)
    useEffect(() => {
        if (!isOpen) return;
        setConfirmedSla((wo as any).phActualSla || (wo as any).phEstimatedSla || '14-30d');
        setScheduledDate((wo as any).scheduledDate || new Date().toISOString().split('T')[0]);
        const init: Record<string, Assignment> = {};
        for (const cat of wo.categories) {
            const fId = (cat as any).assignedForemanId;
            const fName = (cat as any).assignedForemanName;
            if (fId && fName) init[cat.id] = { foremanId: fId, foremanName: fName };
        }
        setAssignments(init);
        setAssignAllId('');
    }, [isOpen, wo.id]);

    if (!isOpen) return null;

    // Mutual exclusive: assignAll mode vs individual mode
    const assignAllMode = assignAllId !== '';                                         // "all at once" selected
    const hasAnyIndividual = Object.keys(assignments).length > 0;                    // any individual assigned
    const allIndividualAssigned = wo.categories.every(c => assignments[c.id]?.foremanId);
    const canConfirm = assignAllMode || allIndividualAssigned;

    const handleAssignAllChange = (foremanId: string) => {
        setAssignAllId(foremanId);
        // Clear individual assignments when user picks "assign all"
        if (foremanId) setAssignments({});
    };

    const handleCategoryAssign = (catId: string, foremanId: string) => {
        if (!foremanId) {
            const next = { ...assignments };
            delete next[catId];
            setAssignments(next);
            return;
        }
        const foreman = foremanList.find(f => f.id === foremanId);
        if (!foreman) return;
        setAssignments(prev => ({ ...prev, [catId]: { foremanId: foreman.id, foremanName: foreman.name } }));
    };

    const handleConfirm = async () => {
        if (!canConfirm) return;
        setIsSaving(true);
        try {
            let list;
            if (assignAllMode) {
                const foreman = foremanList.find(f => f.id === assignAllId)!;
                list = wo.categories.map(cat => ({ catId: cat.id, foremanId: foreman.id, foremanName: foreman.name }));
            } else {
                list = wo.categories.map(cat => ({
                    catId: cat.id,
                    foremanId: assignments[cat.id].foremanId,
                    foremanName: assignments[cat.id].foremanName
                }));
            }
            await onConfirm(confirmedSla, list, scheduledDate);
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const selectStyle: React.CSSProperties = {
        width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
        borderRadius: '8px', fontSize: '0.85rem', background: '#fff',
        color: '#0f172a', cursor: 'pointer', outline: 'none',
        appearance: 'none' as any
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 3000,
                background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '680px',
                    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '10px', borderRadius: '12px', color: '#fff', display: 'flex' }}>
                            <Users size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>อนุมัติ & มอบหมายงานตรวจรับ</h2>
                            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>{wo.id} · {wo.building ? `อาคาร ${wo.building}` : ''} ชั้น {wo.floor} ห้อง {wo.room}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, color: '#64748b' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* SLA Section */}
                    <section>
                        <h3 style={{ margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={15} color="#6366f1" /> ยืนยัน SLA
                        </h3>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', color: '#334155', marginBottom: '4px' }}>SLA คาดการณ์จากโฟรแมน (reference)</div>
                                <div style={{ fontWeight: 700, color: '#6366f1', fontSize: '0.95rem' }}>{(wo as any).phEstimatedSla || '-'}</div>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#334155' }}>→</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>SLA ที่ยืนยัน (จริง)</div>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={confirmedSla}
                                        onChange={e => setConfirmedSla(e.target.value)}
                                        style={{ ...selectStyle, paddingRight: '32px', fontWeight: 700, color: '#10b981', border: '1.5px solid #10b981' }}
                                    >
                                        {SLA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#10b981' }} />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Scheduled Date Section */}
                    <section>
                        <h3 style={{ margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={15} color="#3b82f6" /> วันนัดดำเนินการ
                        </h3>
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px 16px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#1d4ed8', marginBottom: '8px', fontWeight: 600 }}>
                                กำหนดวันเริ่มดำเนินงานตรวจรับ (โฟรแมนจะเห็นในหน้า Daily Report)
                            </div>
                            <input
                                type="date"
                                value={scheduledDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setScheduledDate(e.target.value)}
                                style={{
                                    padding: '8px 12px', border: '1px solid #93c5fd', borderRadius: '8px',
                                    fontSize: '0.9rem', fontWeight: 700, color: '#1e40af',
                                    background: '#fff', outline: 'none', cursor: 'pointer',
                                }}
                            />
                        </div>
                    </section>

                    {/* Assignment Section */}
                    <section>
                        <h3 style={{ margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={15} color="#f59e0b" /> มอบหมายหมวดงาน
                        </h3>

                        {/* Assign All Row */}
                        <div style={{
                            background: hasAnyIndividual ? '#f8fafc' : '#fffbeb',
                            border: `1px solid ${hasAnyIndividual ? '#e2e8f0' : (assignAllMode ? '#10b981' : '#fde68a')}`,
                            borderRadius: '12px', padding: '14px 16px', marginBottom: '12px',
                            opacity: hasAnyIndividual ? 0.45 : 1,
                            transition: 'all 0.2s'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: hasAnyIndividual ? '#334155' : '#92400e', marginBottom: '8px' }}>
                                มอบหมายทุกหมวดพร้อมกัน (เลือกแล้วจะล็อครายหมวด)
                            </div>
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={assignAllId}
                                    onChange={e => handleAssignAllChange(e.target.value)}
                                    disabled={hasAnyIndividual}
                                    style={{
                                        ...selectStyle, paddingRight: '32px',
                                        background: hasAnyIndividual ? '#f1f5f9' : '#fff',
                                        cursor: hasAnyIndividual ? 'not-allowed' : 'pointer',
                                        border: assignAllMode ? '1.5px solid #10b981' : '1px solid #d1d5db',
                                        fontWeight: assignAllMode ? 700 : 400,
                                        color: assignAllMode ? '#065f46' : '#334155'
                                    }}
                                >
                                    <option value="">— เลือกโฟรแมน —</option>
                                    {foremanList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: assignAllMode ? '#10b981' : '#334155' }} />
                            </div>
                        </div>

                        {hasAnyIndividual && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#f59e0b', background: '#fffbeb', padding: '6px 12px', borderRadius: '8px', border: '1px solid #fde68a', marginBottom: '12px' }}>
                                <AlertCircle size={13} />
                                มีการมอบหมายรายหมวดแล้ว — "มอบหมายทุกหมวด" ถูกปิดเพื่อป้องกันข้อมูลซ้ำซ้อน
                            </div>
                        )}

                        {/* Per-category table */}
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>หมวดงาน</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textAlign: 'center' }}>จุดที่พบ</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>มอบหมายให้</span>
                            </div>
                            {wo.categories.map((cat, i) => {
                                const assigned = assignAllMode
                                    ? { foremanId: assignAllId, foremanName: foremanList.find(f => f.id === assignAllId)?.name || '' }
                                    : assignments[cat.id];
                                const isLocked = assignAllMode; // locked by "assign all"
                                return (
                                    <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', padding: '12px 16px', borderBottom: i === wo.categories.length - 1 ? 'none' : '1px solid #f8fafc', alignItems: 'center', background: assigned?.foremanId ? '#f0fdf4' : '#fff', opacity: isLocked ? 0.7 : 1, transition: 'all 0.15s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {assigned?.foremanId ? <CheckCircle2 size={14} color="#10b981" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid #d1d5db' }} />}
                                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>{cat.name}</span>
                                        </div>
                                        <span style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.88rem', color: (cat as any).defectCount > 0 ? '#92400e' : '#334155' }}>
                                            {(cat as any).defectCount ?? 0} จุด
                                        </span>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={assigned?.foremanId || ''}
                                                onChange={e => handleCategoryAssign(cat.id, e.target.value)}
                                                disabled={isLocked}
                                                style={{ ...selectStyle, paddingRight: '28px', border: assigned?.foremanId ? '1.5px solid #10b981' : '1px solid #d1d5db', color: assigned?.foremanId ? '#065f46' : '#334155', fontWeight: assigned?.foremanId ? 700 : 400, background: isLocked ? '#f1f5f9' : '#fff', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                                            >
                                                <option value="">— ยังไม่มอบหมาย —</option>
                                                {foremanList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                            </select>
                                            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#334155' }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Footer: summary */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                                    มอบหมายแล้ว {assignAllMode ? wo.categories.length : Object.keys(assignments).length}/{wo.categories.length} หมวด
                                </span>
                                <span style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#1e293b' }}>
                                    {wo.categories.reduce((s, c) => s + ((c as any).defectCount || 0), 0)} จุด
                                </span>
                                <span />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 28px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '10px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canConfirm || isSaving}
                        style={{
                            padding: '10px 28px', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem', cursor: (!canConfirm || isSaving) ? 'not-allowed' : 'pointer',
                            background: (!canConfirm || isSaving) ? '#e2e8f0' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: (!canConfirm || isSaving) ? '#334155' : '#ffffff', border: 'none',
                            boxShadow: canConfirm && !isSaving ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        {isSaving ? 'กำลังบันทึก...' : (
                            <><CheckCircle2 size={16} /> ยืนยันอนุมัติ & มอบหมาย</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreHandoverAssignModal;
