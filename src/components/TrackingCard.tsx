import React, { useState } from 'react';
import { WorkOrder, MasterTask, UserRole, Staff, Contractor, Project } from '../types';
import { ChevronDown, Phone, Building2, User, AlertCircle, CheckCircle2, Calendar, Flame, MapPin, Package, Info } from 'lucide-react';

interface TrackingCardProps {
    wo: WorkOrder;
    role: UserRole;
    onVerifyTask?: (taskId: string, woId: string) => void;
    onAssignTask?: (taskId: string, woId: string) => void;
    staffList?: Staff[];
    contractors?: Contractor[];
    projects?: Project[];
}

const TrackingCard = ({ wo, role, onVerifyTask, onAssignTask, staffList = [], contractors = [], projects = [] }: TrackingCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    // Calculate Summary Stats
    const stats = (() => {
        const allTasks = wo.categories.flatMap(c => c.tasks);
        const validTasks = allTasks.filter(t => t.status !== 'Rejected');
        const total = validTasks.length > 0 ? validTasks.length : allTasks.length;
        if (total === 0) return { progress: 0, priorityColor: '#94a3b8' };

        const sumProgress = validTasks.reduce((acc, t) => acc + (t.dailyProgress || 0), 0);
        const avgProgress = Math.round(sumProgress / total);

        // ✅ Calculate Risk based on SLA
        const slaHoursMap = {
            'Immediately': 4,
            '24h': 24,
            '1-3d': 72,
            '3-7d': 168,
            '7-14d': 336,
            '14-30d': 720
        };

        const taskRisks = validTasks.map(t => {
            const isDone = t.dailyProgress === 100 || t.status === 'Completed' || t.status === 'Verified';
            if (isDone) return { diffHours: 9999, isDone: true };

            const limit = slaHoursMap[t.slaCategory as keyof typeof slaHoursMap || '24h'] || 24;
            const start = t.slaStartTime ? new Date(t.slaStartTime).getTime() : new Date(wo.createdAt).getTime();
            const now = Date.now();
            return { diffHours: limit - (now - start) / (1000 * 60 * 60), isDone: false };
        });

        const minDiffHours = taskRisks.length > 0 ? Math.min(...taskRisks.map(r => r.diffHours)) : 9999;
        const allDone = taskRisks.every(r => r.isDone);

        // ✅ User Request: Risk-based coloring
        let color = '#3b82f6'; // Blue (Normal)
        if (allDone) color = '#10b981'; // Green (Safe)
        else if (minDiffHours < 0) color = '#ef4444'; // Red (Critical)
        else if (minDiffHours < 24) color = '#f59e0b'; // Yellow (Warning)

        return { progress: avgProgress, priorityColor: color };
    })();

    const getTaskDetails = (t: MasterTask) => {
        const slaHoursMap = {
            'Immediately': 4,
            '24h': 24,
            '1-3d': 72,
            '3-7d': 168,
            '7-14d': 336,
            '14-30d': 720
        };

        const limit = slaHoursMap[t.slaCategory as keyof typeof slaHoursMap || '24h'] || 24;
        const start = t.slaStartTime ? new Date(t.slaStartTime).getTime() : new Date(wo.createdAt).getTime();
        const now = Date.now();
        const diffHours = limit - (now - start) / (1000 * 60 * 60);

        let statusLabel: string = t.status;
        let statusColor = '#64748b';

        switch (t.status) {
            case 'Completed': statusLabel = 'รอตรวจ'; statusColor = '#10b981'; break;
            case 'In Progress': statusLabel = 'กำลังทำ'; statusColor = '#3b82f6'; break;
            case 'Assigned': statusLabel = 'รอดำเนินการ'; statusColor = '#f59e0b'; break;
            case 'Verified': statusLabel = 'ตรวจแล้ว'; statusColor = '#6366f1'; break;
            case 'Pending': statusLabel = 'รอแอดมิน'; statusColor = '#94a3b8'; break;
        }

        // Responsible Info
        let respName = '-';
        let respPhone = '';
        if (t.contractorId) {
            const contractor = contractors.find(c => c.id === t.contractorId);
            respName = contractor ? `ผู้รับผิดชอบ: ${contractor.name}` : 'ผู้รับผิดชอบค่าใช้จ่าย';
            respPhone = contractor?.phone || '';
        } else if (t.responsibleStaffIds && t.responsibleStaffIds.length > 0) {
            const staffMember = staffList.find(s => s.id === t.responsibleStaffIds![0]);
            respName = staffMember ? `คุณ ${staffMember.name}` : 'เจ้าหน้าที่';
            respPhone = staffMember?.phone || '';
        }

        return {
            ...t,
            diffHours,
            slaText: (() => {
                const isOverdue = diffHours < 0;
                const absHours = Math.abs(diffHours);
                const d = Math.floor(absHours / 24);
                const h = Math.floor(absHours % 24);
                const m = Math.floor((absHours * 60) % 60);
                const timeStr = `${d}วัน ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ชม.`;
                return isOverdue ? `เกิน SLA ${timeStr}` : `เหลือ ${timeStr}`;
            })(),
            isRemainingLow: diffHours > 0 && diffHours < 12,
            statusLabel,
            statusColor,
            respName,
            respPhone
        };
    };

    return (
        <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.08)',
            marginBottom: '1.5rem',
            overflow: 'hidden',
            border: '1px solid #f1f5f9',
            fontFamily: 'inherit',
            position: 'relative'
        }}>
            {/* Image Zoom Overlay */}
            {zoomImage && (
                <div
                    onClick={() => setZoomImage(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, cursor: 'zoom-out'
                    }}
                >
                    <img loading="lazy" src={zoomImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
                </div>
            )}

            <style>
                {`
                    .tracking-card-header:hover {
                        background: linear-gradient(to right, #f8fafc, #f1f5f9) !important;
                    }
                    .view-tasks-btn {
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .view-tasks-btn:hover {
                        background: #1e293b !important;
                        color: #fff !important;
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(30, 41, 59, 0.2);
                    }
                    .task-row:hover {
                        background: #f8fafc !important;
                    }
                `}
            </style>

            {/* Header Contact Bar */}
            <div
                className="tracking-card-header"
                style={{
                    padding: '1.25rem 1.75rem',
                    background: 'linear-gradient(to right, #f8fafc, #ffffff)',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.3s ease'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '14px',
                            background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', border: '1px solid #e2e8f0',
                            boxShadow: '0 8px 16px -4px rgba(15, 23, 42, 0.1)'
                        }}>
                            {projects.find(p => p.id === wo.projectId)?.imageUrl ? (
                                <img loading="lazy" src={projects.find(p => p.id === wo.projectId)?.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 900 }}>{wo.building || 'A'}</div>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.025em' }}>{wo.locationName}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <Building2 size={14} />
                                {projects.find(p => p.id === wo.projectId)?.name || 'Project'} <span style={{ color: '#cbd5e1' }}>•</span> {wo.id}
                            </div>
                        </div>
                    </div>

                    <div style={{ width: '1px', height: '32px', background: '#e2e8f0' }}></div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ผู้แจ้งเคส (Reporter)</div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {wo.reporterName}
                                {(() => {
                                    const allTasks = wo.categories.flatMap(c => c.tasks);
                                    const hasActiveProblem = allTasks.some(t => {
                                        const lastUpdate = t.history?.[t.history.length - 1];
                                        return lastUpdate?.type === 'Problem';
                                    });
                                    if (hasActiveProblem) {
                                        return (
                                            <div style={{
                                                background: '#ef4444',
                                                color: '#fff',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.65rem',
                                                fontWeight: 900,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                animation: 'pulse 2s infinite'
                                            }}>
                                                <AlertCircle size={10} strokeWidth={3} /> พบปัญหา
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                        <a
                            href={`tel:${wo.reporterPhone}`}
                            style={{
                                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px',
                                fontSize: '0.9rem', fontWeight: 900, color: '#2563eb', padding: '10px 18px',
                                background: '#eff6ff', borderRadius: '12px', transition: 'all 0.2s', marginTop: '14px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Phone size={14} fill="#2563eb" />
                            {wo.reporterPhone}
                        </a>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ textAlign: 'right', minWidth: '100px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>ความคืบหน้า</div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: stats.priorityColor, lineHeight: 1 }}>{stats.progress}%</div>
                            <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${stats.progress}%`, height: '100%', background: stats.priorityColor, transition: 'width 0.3s' }}></div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="view-tasks-btn"
                        style={{
                            background: expanded ? '#1e293b' : '#f8fafc',
                            border: `1px solid ${expanded ? '#1e293b' : '#e2e8f0'}`,
                            color: expanded ? '#fff' : '#475569',
                            padding: '10px 20px',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 900,
                            boxShadow: expanded ? '0 10px 20px -5px rgba(30, 41, 59, 0.3)' : 'none'
                        }}
                    >
                        <span>ดูรายการซ่อม ({wo.categories.flatMap(c => c.tasks).length})</span>
                        <ChevronDown size={20} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }} />
                    </button>
                </div>
            </div>

            {/* Task List Content */}
            {expanded && (
                <div style={{ background: '#fff' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>รายการ</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>สถานะ</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>SLA</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>ผู้ดูแล</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>ความคืบหน้า</th>
                                </tr>
                            </thead>
                            <tbody>
                                {wo.categories.map(cat => (
                                    <React.Fragment key={cat.id}>
                                        {/* Category Header */}
                                        <tr style={{ background: '#fcfdfe' }}>
                                            <td colSpan={5} style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '3px', height: '14px', background: '#3b82f6', borderRadius: '2px' }} />
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {cat.name} ({cat.tasks.length})
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                        {cat.tasks.map(t => {
                                            const task = getTaskDetails(t);
                                            const isRowExpanded = expandedTaskIds.has(task.id);
                                            const latestUpdate = task.history?.[task.history.length - 1];

                                            return (
                                                <React.Fragment key={task.id}>
                                                    <tr
                                                        className="task-row"
                                                        onClick={() => {
                                                            const newSet = new Set(expandedTaskIds);
                                                            if (newSet.has(task.id)) {
                                                                newSet.delete(task.id);
                                                            } else {
                                                                newSet.add(task.id);
                                                            }
                                                            setExpandedTaskIds(newSet);
                                                        }}
                                                        style={{ borderBottom: isRowExpanded ? 'none' : '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s' }}
                                                    >
                                                        <td style={{ padding: '16px 24px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <div
                                                                    onClick={(e) => { e.stopPropagation(); task.beforePhotoUrl && setZoomImage(task.beforePhotoUrl); }}
                                                                    style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f1f5f9', overflow: 'hidden', cursor: task.beforePhotoUrl ? 'zoom-in' : 'default' }}
                                                                >
                                                                    {task.beforePhotoUrl ? <img loading="lazy" src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={14} color="#cbd5e1" /></div>}
                                                                </div>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{task.name}</div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px 24px' }}>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 900, padding: '4px 10px', borderRadius: '10px', background: `${task.statusColor}15`, color: task.statusColor }}>
                                                                {task.statusLabel}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '16px 24px', fontSize: '0.8rem', fontWeight: 800, color: task.diffHours < 12 && task.dailyProgress < 100 ? '#ef4444' : '#f97316' }}>
                                                            {task.slaText}
                                                        </td>
                                                        <td style={{ padding: '16px 24px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                                                                {(() => {
                                                                    const staffMember = staffList.find(s => s.id === (t.responsibleStaffIds?.[0]));
                                                                    if (staffMember?.profileImage) {
                                                                        return <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #e2e8f0' }}><img loading="lazy" src={staffMember.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
                                                                    }
                                                                    return task.respName.includes('บริษัท') ? <Building2 size={14} /> : <User size={14} />;
                                                                })()}
                                                                {task.respName}
                                                                {task.respPhone && (
                                                                    <a href={`tel:${task.respPhone}`} onClick={(e) => e.stopPropagation()} style={{ color: '#3b82f6', background: '#eff6ff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        <Phone size={12} fill="#3b82f6" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                                                                {task.status === 'Pending' && role !== 'Foreman' ? (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); onAssignTask?.(task.id, wo.id); }}
                                                                        style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}
                                                                    >
                                                                        <User size={12} /> มอบหมาย
                                                                    </button>
                                                                ) : task.dailyProgress === 100 && role === 'Foreman' && task.status === 'Completed' ? (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); onVerifyTask?.(task.id, wo.id); }}
                                                                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                    >
                                                                        <CheckCircle2 size={12} /> ตรวจรับ
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a' }}>{task.dailyProgress}%</div>
                                                                        <div style={{ width: '50px', height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                                                            <div style={{ width: `${task.dailyProgress}%`, height: '100%', background: task.statusColor }} />
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Detail Expansion Pane */}
                                                    {isRowExpanded && (
                                                        <tr>
                                                            <td colSpan={5} style={{ padding: '0 24px 24px 24px', background: '#fcfdfe' }}>
                                                                <div style={{
                                                                    display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px',
                                                                    padding: '24px', background: '#fff', borderRadius: '16px', border: '1px dashed #e2e8f0',
                                                                    boxShadow: '0 8px 30px rgba(0,0,0,0.03)'
                                                                }}>
                                                                    {/* Left: Reference Info */}
                                                                    <div>
                                                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                                                            <Info size={16} /> ข้อมูลอ้างอิง
                                                                        </h4>
                                                                        <div style={{ display: 'flex', gap: '20px' }}>
                                                                            <div style={{ flexShrink: 0 }}>
                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px' }}>รูปภาพต้นเรื่อง (Before Image)</div>
                                                                                <div
                                                                                    onClick={() => task.beforePhotoUrl && setZoomImage(task.beforePhotoUrl)}
                                                                                    style={{ width: '180px', height: '135px', borderRadius: '12px', background: '#f1f5f9', overflow: 'hidden', cursor: task.beforePhotoUrl ? 'zoom-in' : 'default', border: '1px solid #e2e8f0' }}
                                                                                >
                                                                                    {task.beforePhotoUrl ? <img loading="lazy" src={task.beforePhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={24} color="#cbd5e1" /></div>}
                                                                                </div>
                                                                            </div>
                                                                            {/* Visual Comparison: Show latest progress photo if exists */}
                                                                            {(() => {
                                                                                const latestPhoto = task.history && task.history.length > 0
                                                                                    ? [...task.history].reverse().find(h => h.photos && h.photos.length > 0)?.photos[0]
                                                                                    : null;

                                                                                if (!latestPhoto) return null;

                                                                                return (
                                                                                    <div style={{ flexShrink: 0 }}>
                                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', marginBottom: '8px' }}>ความคืบหน้าล่าสุด (Latest View)</div>
                                                                                        <div
                                                                                            onClick={() => setZoomImage(latestPhoto)}
                                                                                            style={{ width: '180px', height: '135px', borderRadius: '12px', background: '#f1f5f9', overflow: 'hidden', cursor: 'zoom-in', border: '1px solid #e2e8f0' }}
                                                                                        >
                                                                                            <img loading="lazy" src={latestPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                            <div style={{ flex: 1 }}>
                                                                                <div style={{ marginBottom: '16px' }}>
                                                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '4px' }}>รายละเอียดและตำแหน่ง:</div>
                                                                                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#1e293b' }}>{task.name}</div>
                                                                                </div>
                                                                                <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                                    <div style={{ background: '#3b82f6', color: '#fff', padding: '4px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800 }}>
                                                                                        <MapPin size={12} /> จุดที่พบ
                                                                                    </div>
                                                                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e40af' }}>{task.position || 'ระบุไม่ได้'}</span>
                                                                                </div>
                                                                                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#64748b' }}>
                                                                                    <Package size={14} /> <span style={{ fontWeight: 800 }}>จำนวน {task.amount || '1'} {task.unit || 'จุด'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Right: Actual Movement */}
                                                                    <div>
                                                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                                                            <Calendar size={16} /> ความเคลื่อนไหวจริง
                                                                        </h4>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                                                            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', marginBottom: '4px' }}>อัปเดตล่าสุด:</div>
                                                                                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#334155' }}>
                                                                                    {latestUpdate ? new Date(latestUpdate.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'ยังไม่มีข้อมูล'}
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #dcfce7' }}>
                                                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#15803d', marginBottom: '4px' }}>ความต่อเนื่อง:</div>
                                                                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <Flame size={14} fill="#166534" /> {task.dailyProgress > 0 ? 'มีความเคลื่อนไหว' : 'รอดำเนินการ'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div style={{
                                                                            padding: '16px',
                                                                            background: latestUpdate?.type === 'Problem' ? 'rgba(239, 68, 68, 0.03)' : '#fcfdfe',
                                                                            borderRadius: '12px',
                                                                            border: latestUpdate?.type === 'Problem' ? '1px solid #fecaca' : '1px solid #f1f5f9'
                                                                        }}>
                                                                            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: latestUpdate?.type === 'Problem' ? '#ef4444' : '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                {latestUpdate?.type === 'Problem' && <AlertCircle size={12} />}
                                                                                หมายเหตุล่าสุดจากหน้างาน:
                                                                            </div>
                                                                            <div style={{
                                                                                fontSize: '0.85rem',
                                                                                color: latestUpdate?.type === 'Problem' ? '#991b1b' : '#1e293b',
                                                                                fontStyle: 'italic',
                                                                                background: '#fff',
                                                                                padding: '12px',
                                                                                borderRadius: '8px',
                                                                                border: latestUpdate?.type === 'Problem' ? '1px solid #fecaca' : '1px solid #f1f5f9',
                                                                                fontWeight: latestUpdate?.type === 'Problem' ? 700 : 400
                                                                            }}>
                                                                                "{latestUpdate?.note || 'ยังไม่มีการแจ้งความคืบหน้า'}"
                                                                            </div>
                                                                            <div style={{ marginTop: '8px', fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                <div style={{ background: latestUpdate?.type === 'Problem' ? '#fee2e2' : '#f1f5f9', color: latestUpdate?.type === 'Problem' ? '#ef4444' : '#64748b', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                    {latestUpdate?.type === 'Problem' ? '📌 รายงานปัญหา' : 'อัปเดตล่าสุด'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrackingCard;
