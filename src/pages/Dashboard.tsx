import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import {
    TrendingUp,
    AlertTriangle,
    AlertCircle,
    Clock,
    Activity,
    BarChart3,
    CheckCircle2,
    Users,
    Zap,
    ChevronDown,
    X,
    Edit2,
    Check,
    FileText,
    MapPin,
    UserCheck
} from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/date';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    ReferenceLine,
    Label,
    LabelList,
    Area,
    PieChart,
    Pie,
    ComposedChart,
    Line,
} from 'recharts';
import ForemanCalendar from '../components/ForemanCalendar';
import WorkOrderViewModal from '../components/WorkOrderViewModal';
import HistoryDetailModal from '../components/HistoryDetailModal';
import MasterFilter from '../components/MasterFilter';

// Modular Imports
import { DashboardStats } from '../types/dashboard';
import { StatCard, SectionHeader } from '../components/DashboardShared';
import DashboardComparison from './DashboardComparison';
import { useIsMobile } from '../hooks/useIsMobile';
import { gridCols } from '../components/ui/responsiveGrid';
import { scaleFont } from '../components/ui/responsiveText';
const ProgressDeltaBar = ({ prev, delta, isTask = false }: any) => {
    const safePrev = Math.min(Math.max(prev, 0), 100);
    const safeDelta = Math.min(Math.max(delta, 0), 100 - safePrev);
    return (
        <div style={{ width: '160px', display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>{prev}%</span>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>→</span>
                <span style={{ fontSize: '1rem', fontWeight: 900, color: isTask ? '#10b981' : '#4f46e5' }}>{prev + delta}%</span>
                <div style={{ padding: '2px 6px', borderRadius: '6px', background: isTask ? '#ecfdf5' : '#eef2ff', color: isTask ? '#10b981' : '#4f46e5', fontSize: '0.75rem', fontWeight: 900, marginLeft: '4px' }}>
                    {delta >= 0 ? '+' : ''}{delta}%
                </div>
            </div>
            <div style={{ height: '6px', width: '100%', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${safePrev}%`, background: '#cbd5e1', height: '100%', transition: 'width 0.5s ease' }} />
                <div style={{ width: `${safeDelta}%`, background: isTask ? '#10b981' : '#4f46e5', height: '100%', transition: 'width 0.5s ease' }} />
            </div>
        </div>
    );
};

const TaskItemCard = ({ task, isSingleTask = false, reportDate, workOrderId, onUpdate }: any) => {
    const { user } = useAuth();
    const { addTaskUpdate, workOrders } = useWorkOrders();
    const [isLaborExpanded, setIsLaborExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabor, setTempLabor] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ✅ Find actual Work Order to check ownership or Admin/Manager status
    const workOrder = workOrders.find((wo: any) => wo.id === workOrderId);
    const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';
    const isOwner = workOrder?.reporterId === user?.id || task?.responsibleStaffIds?.includes(user?.id);
    const canEditLabor = isAdminOrManager || isOwner;

    // Console log for debugging if needed (remove before production if preferred)
    useEffect(() => {
        if (workOrderId && !canEditLabor) {
            console.log(`Auditing WO: ${workOrderId} | User: ${user?.name} | canEdit: ${canEditLabor}`);
        }
    }, [workOrderId, canEditLabor, user]);

    // Reset temp labor when start editing
    const startEditing = () => {
        setTempLabor(JSON.parse(JSON.stringify(task.labor || [])));
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!workOrder || !task.id) return;
        setIsSubmitting(true);
        try {
            // Find the category and task within the work order
            const category = workOrder.categories?.find((c: any) => c.tasks?.some((t: any) => t.id === task.id));
            if (!category) throw new Error("Category not found");

            // ✅ Core Safety: We ONLY update labor. We keep original progress and note from the history entry.
            // addTaskUpdate handles finding the correct history date and merging.
            const reportPayload: any = {
                id: `h-${reportDate}-${task.id}`, // Unique ID for this date/task combination
                date: reportDate,
                progress: task.dailyProgress || 0,
                notes: task.note || "",
                labor: tempLabor,
                type: 'Update',
                createdAt: new Date().toISOString(),
                createdBy: user?.id || 'system'
            };

            await addTaskUpdate(
                workOrder.id,
                category.id,
                task.id,
                reportPayload
            );
            
            setIsEditing(false);
            if (onUpdate) onUpdate(); // Refresh the list if possible
            alert("บันทึกการปรับปรุงค่าแรงเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Error saving labor:", error);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleShift = (idx: number, shiftKey: string) => {
        const newLabor = [...tempLabor];
        const record = newLabor[idx];
        if (!record.shifts) record.shifts = { normal: false, otMorning: false, otNoon: false, otEvening: false };
        record.shifts[shiftKey] = !record.shifts[shiftKey];
        
        // Auto-recalculate hours based on shifts (Simplified for manual correction)
        let total = 0;
        if (record.shifts.normal) total += 8;
        if (record.shifts.otMorning) total += 1.5;
        if (record.shifts.otNoon) total += 1;
        if (record.shifts.otEvening) total += 1.5;
        record.totalHours = total;
        record.normalHours = record.shifts.normal ? 8 : 0;
        record.otHours = (record.shifts.otMorning ? 1.5 : 0) + (record.shifts.otNoon ? 1 : 0) + (record.shifts.otEvening ? 1.5 : 0);
        
        setTempLabor(newLabor);
    };

    const updateAmount = (idx: number, amt: number) => {
        const newLabor = [...tempLabor];
        newLabor[idx].amount = Math.max(1, amt);
        setTempLabor(newLabor);
    };

    return (
        <div style={{ background: '#fff', borderRadius: '20px', border: `1px solid ${isEditing ? '#6366f1' : '#e2e8f0'}`, padding: '1.5rem', boxShadow: isEditing ? '0 10px 25px -5px rgba(99, 102, 241, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.3s' }}>
            <div
                onClick={() => !isEditing && setIsLaborExpanded(!isLaborExpanded)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: (isLaborExpanded || isEditing || task.labor?.length > 0) ? '1.25rem' : '0', cursor: isEditing ? 'default' : 'pointer' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ background: isEditing ? '#eef2ff' : '#ecfdf5', color: isEditing ? '#6366f1' : '#10b981', padding: '10px', borderRadius: '12px' }}>
                        {isEditing ? <Edit2 size={20} /> : <Zap size={20} />}
                    </div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {task.taskName}
                            {!isEditing && <ChevronDown size={16} style={{ transform: isLaborExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', color: '#94a3b8' }} />}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                            {task.note && <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>📝 {task.note}</span>}
                            {task.labor?.length > 0 && (
                                <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Users size={12} /> {task.labor.reduce((acc: number, l: any) => acc + (l.amount || 0), 0)} คน
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {!isSingleTask && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>ความคืบหน้า</div>
                        <ProgressDeltaBar prev={task.prevProgress} delta={task.delta} isTask={true} />
                    </div>
                )}
            </div>
            
            {/* ✅ ALWAYS SHOW basic labor summary or photos if they exist, or expand fully if editing */}
            {(isLaborExpanded || isEditing || (task.labor?.length > 0 && !isLaborExpanded)) && (() => {
                const laborData = isEditing ? tempLabor : (task.labor || []);
                const internals = laborData.filter((l: any) => l.membership === 'Internal');
                const outsources = laborData.filter((l: any) => l.membership !== 'Internal');
                
                // If not expanded and not editing, just show a "Quick View" of workers
                if (!isLaborExpanded && !isEditing && task.labor?.length > 0) {
                    return (
                        <div onClick={() => setIsLaborExpanded(true)} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {task.laborPhotos?.slice(0, 3).map((p: string, i: number) => (
                                    <img key={i} src={p} style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                                ))}
                                {task.laborPhotos?.length > 3 && <div style={{ width: '40px', height: '30px', background: '#e2e8f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', fontWeight: 800 }}>+{task.laborPhotos.length - 3}</div>}
                                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, marginLeft: task.laborPhotos?.length > 0 ? '8px' : '0' }}>
                                    คลิกเพื่อดูรายละเอียดแรงงานและชั่วโมงงาน...
                                </span>
                            </div>
                            {canEditLabor && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); startEditing(); }}
                                    style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    แก้ไข
                                </button>
                            )}
                        </div>
                    );
                }

                const renderLaborTable = (title: string, data: any[], isInternal: boolean) =>
                    data.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: isInternal ? '#1e40af' : '#065f46', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '4px', height: '14px', borderRadius: '4px', background: isInternal ? '#3b82f6' : '#10b981' }} />
                                {title}
                            </div>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                    <thead style={{ background: isInternal ? '#f8fafc' : '#f0fdf4' }}>
                                        <tr>
                                            <th style={{ padding: '10px 16px', color: '#64748b', fontWeight: 800, borderBottom: '1px solid #e2e8f0', width: '35%' }}>รายชื่อ</th>
                                            <th style={{ padding: '10px 12px', color: '#64748b', fontWeight: 800, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>ปกติ (8)</th>
                                            <th style={{ padding: '10px 12px', color: '#64748b', fontWeight: 800, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>โอเช้า</th>
                                            <th style={{ padding: '10px 12px', color: '#64748b', fontWeight: 800, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>โอเที่ยง</th>
                                            <th style={{ padding: '10px 12px', color: '#64748b', fontWeight: 800, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>โอเย็น</th>
                                            <th style={{ padding: '10px 16px', color: '#64748b', fontWeight: 800, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>รวมชม.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((lab: any, dIdx: number) => {
                                            const originalIdx = laborData.findIndex((l: any) => l.id === lab.id);
                                            return (
                                                <tr key={dIdx} style={{ borderBottom: dIdx === data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#1e293b' }}>
                                                        {lab.staffName || lab.affiliation}{' '}
                                                        {!isEditing && lab.amount > 1 && <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '6px' }}>({lab.amount} คน)</span>}
                                                        {isEditing && !isInternal && (
                                                            <input 
                                                                type="number" 
                                                                min="1" 
                                                                value={lab.amount} 
                                                                onChange={(e) => updateAmount(originalIdx, parseInt(e.target.value) || 1)}
                                                                style={{ width: '45px', marginLeft: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 4px', fontSize: '0.8rem', fontWeight: 900, textAlign: 'center' }} 
                                                            />
                                                        )}
                                                    </td>
                                                    {[
                                                        { key: 'normal', color: '#10b981', border: '#bbf7d0' },
                                                        { key: 'otMorning', color: '#0ea5e9', border: '#bae6fd' },
                                                        { key: 'otNoon', color: '#f59e0b', border: '#fef3c7' },
                                                        { key: 'otEvening', color: '#ea580c', border: '#fed7aa' }
                                                    ].map(shift => (
                                                        <td key={shift.key} style={{ padding: '12px', textAlign: 'center' }}>
                                                            <div 
                                                                onClick={() => isEditing && toggleShift(originalIdx, shift.key)}
                                                                style={{ 
                                                                    width: '18px', height: '18px', borderRadius: '6px', 
                                                                    background: lab.shifts?.[shift.key] ? shift.color : '#f1f5f9', 
                                                                    margin: '0 auto', border: lab.shifts?.[shift.key] ? `2px solid ${shift.border}` : '1px solid #e2e8f0',
                                                                    cursor: isEditing ? 'pointer' : 'default',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }} 
                                                            >
                                                                {lab.shifts?.[shift.key] && <Check size={12} color="#fff" strokeWidth={4} />}
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                                                        {lab.totalHours} <span style={{ fontSize: '0.7rem', color: '#64748b' }}>ชม.</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );

                return (
                    <div style={{ background: '#f8fafc', borderRadius: '16px', border: `1px solid ${isEditing ? '#6366f1' : '#e2e8f0'}`, padding: '20px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Users size={16} /> {isEditing ? 'กำลังปรับแก้ข้อมูลคนงาน (Auditing Labor)' : 'รายละเอียดการลงแรงงาน (Labor Breakdown)'}
                            </div>
                            {canEditLabor && !isEditing && (
                                <button 
                                    onClick={startEditing}
                                    style={{ padding: '6px 12px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', color: '#6366f1', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Edit2 size={14} /> แก้ไขค่าแรงย้อนหลัง
                                </button>
                            )}
                        </div>

                        {/* ✅ Labor Proof Photo View */}
                        {task.laborPhotos && task.laborPhotos.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', marginBottom: '8px' }}>📸 รูปถ่ายยืนยันแรงงานในวันนั้น:</div>
                                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                                    {task.laborPhotos.map((p: string, pIdx: number) => (
                                        <img key={pIdx} src={p} style={{ height: '80px', width: '120px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #e2e8f0' }} alt="Proof" />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {renderLaborTable('DC ใน (พนักงาน)', internals, true)}
                            {renderLaborTable('DC นอก (ผู้รับเหมา/ซับ)', outsources, false)}
                        </div>

                        {isEditing && (
                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '12px' }}>
                                <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}>ยกเลิก</button>
                                <button onClick={handleSave} disabled={isSubmitting} style={{ flex: 2, padding: '12px', borderRadius: '12px', background: '#6366f1', border: 'none', color: '#fff', fontWeight: 900, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                                    {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการปรับปรุงข้อมูล'}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
};


const renderSCurveLegend = (props: any) => {
    const { payload } = props;
    const explanations: any = {
        ideal: 'เส้นเป้าหมายความคืบหน้าที่ควรจะได้ตามเวลา',
        manpower: 'การใช้คนงานไปจริงๆ ในแต่ละวัน (เชื่อมโยงกับงานที่เพิ่มขึ้น)',
        progress: 'ความคืบหน้าสะสม (%) ของทุกใบงานในโครงการ',
    };
    const thaiNames: any = {
        ideal: 'เป้าหมายมาตรฐาน',
        manpower: 'จำนวนแรงงานรวม',
        progress: 'ความคืบหน้าจริง',
    };
    return (
        <>
            <style>{`
        .scurve-legend-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          font-weight: 800;
          color: #64748b;
          cursor: help;
        }
        .scurve-legend-tooltip {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          bottom: 150%;
          left: 50%;
          transform: translateX(-50%);
          background-color: #1e293b;
          color: #fff;
          text-align: center;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
          z-index: 50;
          transition: opacity 0.2s, visibility 0.2s;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          pointer-events: none;
        }
        .scurve-legend-tooltip::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -5px;
          border-width: 5px;
          border-style: solid;
          border-color: #1e293b transparent transparent transparent;
        }
        .scurve-legend-item:hover .scurve-legend-tooltip {
          visibility: visible;
          opacity: 1;
        }
      `}</style>
            <ul style={{ listStyle: 'none', display: 'flex', justifyContent: 'center', gap: '20px', padding: 0, margin: '0 0 10px 0' }}>
                {payload.map((entry: any, index: number) => (
                    <li key={`item-${index}`} className="scurve-legend-item">
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: entry.color }} />
                        {thaiNames[entry.value] || entry.value}
                        <div className="scurve-legend-tooltip">{explanations[entry.value] || entry.value}</div>
                    </li>
                ))}
                <li className="scurve-legend-item">
                    <div style={{ height: '0px', width: '12px', borderBottom: '2px dashed #94a3b8' }} />
                    สิ้นสุดสัปดาห์
                    <div className="scurve-legend-tooltip">เส้นแบ่งแยกข้อมูลเพื่อแสดงจุดสิ้นสุดสัปดาห์ (วันอาทิตย์)</div>
                </li>
            </ul>
        </>
    );
};

const WOSummaryModal = ({ isOpen, onClose, data, onViewDetail, selectedMonth, getProjectName }: any) => {
    if (!isOpen || !data) return null;
    const { day, openedWOs = [], closedWOs = [] } = data;
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const [yr, mn] = selectedMonth.split('-');
    const displayMonth = monthNames[parseInt(mn) - 1];
    const displayYear = yr;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
            <div style={{ background: '#fff', width: '100%', maxWidth: '700px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'modalSlideUp 0.3s ease-out' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'linear-gradient(to right, #f8fafc, #fff)' }}>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', marginBottom: '4px' }}>
                            สรุปใบงาน - วันที่ {day} {displayMonth} {displayYear}
                        </h3>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                            {openedWOs.length > 0 && (
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, background: '#fef3c7', color: '#f59e0b', padding: '4px 12px', borderRadius: '10px' }}>
                                    เปิดใหม่ {openedWOs.length} รายการ
                                </span>
                            )}
                            {closedWOs.length > 0 && (
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, background: '#f5f3ff', color: '#8b5cf6', padding: '4px 12px', borderRadius: '10px' }}>
                                    ปิดสำเร็จ {closedWOs.length} รายการ
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ padding: '10px', borderRadius: '14px', border: 'none', background: '#f8fafc', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <X size={20} />
                    </button>
                </div>
                <div style={{ padding: '2rem', maxHeight: '60vh', overflowY: 'auto' }}>
                    {openedWOs.length > 0 && (
                        <div style={{ marginBottom: '2.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                                <div style={{ width: '4px', height: '20px', background: '#f59e0b', borderRadius: '2px' }} />
                                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>ใบงานที่เปิดใหม่ / กำลังดำเนินการ</h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {openedWOs.map((wo: any) => (
                                    <div key={wo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: '#fff7ed', borderRadius: '20px', border: '1px solid #fed7aa', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.05)' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f59e0b', marginBottom: '4px' }}>#{wo.id}</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#451a03' }}>{getProjectName(wo.projectId)}</div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9a3412', marginTop: '2px' }}>{wo.locationName}</div>
                                        </div>
                                        <button onClick={() => onViewDetail(wo, 'opened')} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #f59e0b', background: '#fff', color: '#f59e0b', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                                            ดูใบงาน
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {closedWOs.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                                <div style={{ width: '4px', height: '20px', background: '#8b5cf6', borderRadius: '2px' }} />
                                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>ใบงานที่ปิดงานสำเร็จวันนี้</h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {closedWOs.map((wo: any) => (
                                    <div key={wo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: '#f5f3ff', borderRadius: '20px', border: '1px solid #ddd6fe', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.05)' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#8b5cf6', marginBottom: '4px' }}>#{wo.id}</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2e1065' }}>{getProjectName(wo.projectId)}</div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5b21b6', marginTop: '2px' }}>{wo.locationName}</div>
                                        </div>
                                        <button onClick={() => onViewDetail(wo, 'closed')} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #8b5cf6', background: '#fff', color: '#8b5cf6', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                                            ดูประวัติ
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {openedWOs.length === 0 && closedWOs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>ไม่มีรายการใบงานในวันนี้</div>
                    )}
                </div>
                <style>{`
          @keyframes modalSlideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
            </div>
        </div>
    );
};



const TaskHistoryModal = ({ isOpen, onClose, task }: any) => {
    if (!isOpen || !task) return null;

    // Sort ascending for timeline view
    const history = [...(task.history || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group by revisionId
    const revGroups: Record<string, any[]> = {};
    history.forEach((log: any) => {
        const revId = log.revisionId || 'rev00';
        if (!revGroups[revId]) revGroups[revId] = [];
        revGroups[revId].push(log);
    });
    const sortedRevKeys = Object.keys(revGroups).sort((a, b) => a.localeCompare(b));

    const calcHrs = (logs: any[]) => logs.reduce((sum: number, log: any) =>
        sum + (log.labor || []).reduce((s: number, l: any) => {
            const eh = l.expectedHours || {};
            return s + (eh.normal||0) + (eh.otNoon||0) + (eh.otEvening||0) + (eh.otMorning||0);
        }, 0), 0);

    const totalHrsAll = calcHrs(history);
    const totalDaysAll = new Set(history.map((l: any) => l.date?.split('T')[0]).filter(Boolean)).size;

    const revNum = (revId: string) => parseInt(String(revId).replace(/[^0-9]/g, '')) || 0;

    const fmtDate = (d: Date) =>
        `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()+543}`;

    const revColors = [
        { bg: '#eff6ff', border: '#bfdbfe', headerBg: '#dbeafe', text: '#1d4ed8', badge: '#2563eb' },
        { bg: '#fff7ed', border: '#fed7aa', headerBg: '#ffedd5', text: '#c2410c', badge: '#ea580c' },
        { bg: '#f0fdf4', border: '#bbf7d0', headerBg: '#dcfce7', text: '#15803d', badge: '#16a34a' },
        { bg: '#fdf4ff', border: '#e9d5ff', headerBg: '#f3e8ff', text: '#7e22ce', badge: '#9333ea' },
    ];

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', width: '740px', maxWidth: '100%', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', animation: 'modalSlideUp 0.3s ease-out' }}>

                {/* Modal Header */}
                <div style={{ padding: '24px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>ประวัติการปฏิบัติงาน</h3>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 12px 0', fontWeight: 600 }}>{task.taskName} · {task.locationName || task.projectName}</p>
                        {/* Cumulative summary chips */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '4px 12px', background: '#f1f5f9', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#334155' }}>
                                📋 {sortedRevKeys.length} ครั้ง{sortedRevKeys.length > 1 ? ' (มีการแก้ไข)' : ''}
                            </span>
                            <span style={{ padding: '4px 12px', background: '#ede9fe', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#6d28d9' }}>
                                ⏱ รวม {totalHrsAll} ชม. (ทุก REV.)
                            </span>
                            <span style={{ padding: '4px 12px', background: '#ecfeff', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, color: '#0891b2' }}>
                                📅 {totalDaysAll} วันทำงาน
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#fff', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px 32px', maxHeight: '65vh', overflowY: 'auto', background: '#fff' }}>
                    {history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>ยังไม่มีบันทึกการปฏิบัติงาน</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {sortedRevKeys.map((revId, revIdx) => {
                                const logs = revGroups[revId];
                                const col = revColors[revIdx % revColors.length];
                                const revHrs = calcHrs(logs);
                                const revDays = new Set(logs.map((l: any) => l.date?.split('T')[0]).filter(Boolean)).size;
                                const firstProg = logs[0]?.progress ?? 0;
                                const lastProg = logs[logs.length - 1]?.progress ?? 0;
                                // Find start progress of this revision (progress before first entry)
                                const allBeforeThisRev = history.filter((l: any) => (l.revisionId || 'rev00') !== revId);
                                const progBefore = allBeforeThisRev.length > 0
                                    ? Math.max(...allBeforeThisRev.map((l: any) => l.progress || 0))
                                    : 0;
                                const rNum = revNum(revId);

                                return (
                                    <div key={revId} style={{ border: `1.5px solid ${col.border}`, borderRadius: '20px', overflow: 'hidden', background: col.bg }}>
                                        {/* Revision Header */}
                                        <div style={{ padding: '14px 20px', background: col.headerBg, borderBottom: `1px solid ${col.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ padding: '3px 10px', background: col.badge, color: '#fff', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 900 }}>
                                                    REV.{rNum}
                                                </span>
                                                {rNum > 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: col.text, fontWeight: 700 }}>การแก้ไขครั้งที่ {rNum}</span>
                                                )}
                                                {rNum === 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: col.text, fontWeight: 700 }}>งานเริ่มต้น</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.7)', color: col.text, borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                    {progBefore}% → {lastProg}%
                                                </span>
                                                <span style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.7)', color: col.text, borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                    {revDays} วัน · {revHrs} ชม.
                                                </span>
                                            </div>
                                        </div>

                                        {/* Mini timeline for this revision */}
                                        {(() => {
                                            const revMs = logs.map((l: any) => new Date(l.date).getTime()).filter(Number.isFinite);
                                            if (!revMs.length) return null;
                                            // Use task.startDate if set and earlier than first log (handles retroactive start date changes)
                                            const startDateMs = task.startDate ? new Date(task.startDate.split('T')[0] + 'T00:00:00').getTime() : null;
                                            const firstLogMs = Math.min(...revMs);
                                            const revFirstDate = new Date(startDateMs && startDateMs < firstLogMs ? startDateMs : firstLogMs);
                                            const revMaxDate = new Date(Math.max(...revMs));
                                            const isLastRev = revIdx === sortedRevKeys.length - 1;
                                            const isRejected = logs[0]?.revisionStatus === 'closed_rejected';
                                            const _qrRaw = (isLastRev && task.wo?.inspectionTimeline?.qrGeneratedAt)
                                                ? new Date(task.wo.inspectionTimeline.qrGeneratedAt) : null;
                                            // Only valid if QR was generated AFTER work completion (else it's a previous rev's QR)
                                            const qrDate = (_qrRaw && _qrRaw.getTime() > revMaxDate.getTime()) ? _qrRaw : null;
                                            const approvalDate = (!isRejected && task.wo?.completedAt)
                                                ? new Date(task.wo.completedAt) : null;
                                            const daysBetween = (a: Date | null, b: Date | null) =>
                                                (a && b) ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000)) : null;
                                            const daysWork = daysBetween(revFirstDate, revMaxDate);
                                            const daysToQr = daysBetween(revMaxDate, qrDate);
                                            const daysResult = daysBetween(qrDate || revMaxDate, approvalDate);
                                            const resultStatus = isRejected ? 'reject' : (isLastRev && lastProg >= 100) ? (approvalDate ? 'done' : 'pending') : 'wait';

                                            const nodeBase: React.CSSProperties = { width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 };
                                            const nodeStyles: Record<string, React.CSSProperties> = {
                                                done:    { ...nodeBase, background: '#1D9E75', color: '#fff' },
                                                reject:  { ...nodeBase, background: '#E24B4A', color: '#fff' },
                                                pending: { ...nodeBase, background: '#EF9F27', color: '#fff' },
                                                wait:    { ...nodeBase, background: '#f1f5f9', border: '1.5px solid #cbd5e1', color: '#94a3b8' },
                                            };
                                            const connLine = (done: boolean, danger = false, dashed = false): React.CSSProperties => ({
                                                height: '3px', width: '100%',
                                                background: dashed ? 'repeating-linear-gradient(90deg,#EF9F27 0,#EF9F27 6px,transparent 6px,transparent 11px)'
                                                    : danger ? '#E24B4A' : done ? '#1D9E75' : '#e2e8f0',
                                            });
                                            const stageWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '88px' };
                                            const lbl: React.CSSProperties = { fontSize: '12px', color: '#64748b', marginTop: '6px', textAlign: 'center', lineHeight: '1.5' };
                                            const lbl2: React.CSSProperties = { fontSize: '11px', color: '#94a3b8' };
                                            // paddingTop = (nodeSize - lineHeight) / 2 = (46 - 3) / 2 ≈ 21px — aligns line center to circle center
                                            const conn: React.CSSProperties = { flex: 1, minWidth: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '21px' };

                                            return (
                                                <div style={{ padding: '14px 20px 12px', background: 'rgba(0,0,0,0.03)', borderBottom: `1px solid ${col.border}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto' }}>
                                                        {/* Stage 1: เริ่มงาน */}
                                                        <div style={stageWrap}>
                                                            <div style={nodeStyles.done}><CheckCircle2 size={20} /></div>
                                                            <div style={lbl}><strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>โฟรแมน</strong>เริ่มงาน<br/><span style={lbl2}>{fmtDate(revFirstDate)}</span></div>
                                                        </div>
                                                        {/* Conn 1→2 */}
                                                        <div style={conn}>
                                                            <div style={connLine(true)}></div>
                                                            {daysWork !== null && daysWork > 0 && <span style={{ ...lbl2, marginTop: '3px', whiteSpace: 'nowrap' }}>{daysWork} วัน</span>}
                                                        </div>
                                                        {/* Stage 2: งานเสร็จ */}
                                                        <div style={stageWrap}>
                                                            <div style={nodeStyles[lastProg >= 100 ? 'done' : 'wait']}><Check size={20} /></div>
                                                            <div style={lbl}><strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>งานเสร็จ</strong>{lastProg >= 100 ? '100%' : `${lastProg}%`}<br/><span style={lbl2}>{lastProg >= 100 ? fmtDate(revMaxDate) : '—'}</span></div>
                                                        </div>
                                                        {/* Conn 2→3 */}
                                                        <div style={conn}>
                                                            <div style={connLine(!!qrDate)}></div>
                                                            {daysToQr !== null && <span style={{ ...lbl2, marginTop: '3px', whiteSpace: 'nowrap' }}>{daysToQr} วัน</span>}
                                                        </div>
                                                        {/* Stage 3: ส่ง QR */}
                                                        <div style={stageWrap}>
                                                            <div style={nodeStyles[qrDate ? 'done' : 'wait']}><FileText size={20} /></div>
                                                            <div style={lbl}><strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>ส่ง QR</strong><span style={lbl2}>{qrDate ? fmtDate(qrDate) : '—'}</span></div>
                                                        </div>
                                                        {/* Conn 3→4 */}
                                                        <div style={conn}>
                                                            <div style={connLine(resultStatus === 'done', isRejected, resultStatus === 'pending')}></div>
                                                            {daysResult !== null && <span style={{ ...lbl2, color: isRejected ? '#dc2626' : '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap' }}>{daysResult} วัน</span>}
                                                        </div>
                                                        {/* Stage 4: ผลตรวจ */}
                                                        <div style={stageWrap}>
                                                            <div style={nodeStyles[resultStatus]}>
                                                                {resultStatus === 'reject' ? <X size={20} /> : resultStatus === 'done' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                                                            </div>
                                                            <div style={{ ...lbl, color: isRejected ? '#dc2626' : '#64748b' }}>
                                                                <strong style={{ fontSize: '13px', color: isRejected ? '#dc2626' : '#1e293b', display: 'block' }}>ลูกค้า</strong>
                                                                {isRejected ? 'ไม่ผ่าน' : resultStatus === 'done' ? 'ตรวจผ่าน' : 'รอตรวจ'}
                                                                <br/><span style={lbl2}>{approvalDate ? fmtDate(approvalDate) : '—'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Daily entries within this revision */}
                                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {logs.map((log: any, logIdx: number) => {
                                                const logDate = new Date(log.date);
                                                const prevProg = logIdx > 0 ? (logs[logIdx - 1].progress || 0) : progBefore;
                                                const totalWorkers = (log.labor || []).reduce((acc: number, l: any) => acc + (l.amount || 1), 0);
                                                const isProblem = log.type === 'Problem';
                                                const logHrs = calcHrs([log]);
                                                // photos: { laborByShift: { regular, otMorning, otNoon, otEvening }, site }
                                                const _shiftLabel: Record<string, string> = { regular: 'กะปกติ', otMorning: 'OT เช้า', otNoon: 'OT เที่ยง', otEvening: 'OT เย็น' };
                                                // isLabor=true → slot0=เข้า slot1=ออก (เฉพาะเมื่อมีพอดี 2 รูป)
                                                const photosByShift: { label: string; urls: string[]; isLabor: boolean }[] = [];
                                                if (Array.isArray(log.photos)) {
                                                    const urls = log.photos.map((p: any) => typeof p === 'string' ? p : (p.url || p.downloadUrl || p.uri || null)).filter(Boolean);
                                                    if (urls.length) photosByShift.push({ label: 'รูปภาพ', urls, isLabor: false });
                                                } else if (log.photos) {
                                                    if (Array.isArray(log.photos.site) && log.photos.site.filter(Boolean).length > 0)
                                                        photosByShift.push({ label: 'รูปหน้างาน', urls: log.photos.site.filter(Boolean), isLabor: false });
                                                    if (log.photos.laborByShift) {
                                                        for (const [shift, urls] of Object.entries(log.photos.laborByShift)) {
                                                            if (Array.isArray(urls) && (urls as string[]).filter(Boolean).length > 0)
                                                                photosByShift.push({ label: _shiftLabel[shift] || shift, urls: (urls as string[]).filter(Boolean), isLabor: true });
                                                        }
                                                    }
                                                }
                                                const totalPhotos = photosByShift.reduce((a, s) => a + s.urls.length, 0);

                                                return (
                                                    <div key={logIdx} style={{ background: isProblem ? '#fff1f2' : '#fff', borderRadius: '14px', border: `1px solid ${isProblem ? '#fca5a5' : '#e2e8f0'}`, overflow: 'hidden' }}>
                                                        {/* Log row header */}
                                                        <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {isProblem && <AlertCircle size={14} color="#ef4444" />}
                                                                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: isProblem ? '#dc2626' : '#0f172a' }}>
                                                                    {fmtDate(logDate)}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                {isProblem && <span style={{ padding: '2px 8px', background: '#fef2f2', color: '#ef4444', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>🚨 พบปัญหา</span>}
                                                                <span style={{ padding: '2px 10px', background: '#e0e7ff', color: '#4338ca', borderRadius: '6px', fontSize: '0.73rem', fontWeight: 900 }}>
                                                                    {prevProg}% → {log.progress}%
                                                                </span>
                                                                {totalWorkers > 0 && (
                                                                    <span style={{ padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                                                        👷 {totalWorkers} คน
                                                                    </span>
                                                                )}
                                                                {logHrs > 0 && (
                                                                    <span style={{ padding: '2px 8px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>
                                                                        รวม {logHrs} ชม.
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Workers */}
                                                        {(log.labor || []).length > 0 && (
                                                            <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                {(log.labor || []).map((l: any, lIdx: number) => {
                                                                    const name = l.workerName || l.staffName || l.workerId || '—';
                                                                    const timeRange = l.shiftTimes?.day?.trim() || null;
                                                                    const eh = l.expectedHours || {};
                                                                    const normalHrs = eh.normal || 0;
                                                                    const otHrs = (eh.otNoon||0) + (eh.otEvening||0) + (eh.otMorning||0);
                                                                    const otBreakdown = [
                                                                        eh.otMorning  ? `OT เช้า ${eh.otMorning}ชม.`  : null,
                                                                        eh.otNoon     ? `OT เที่ยง ${eh.otNoon}ชม.`   : null,
                                                                        eh.otEvening  ? `OT เย็น ${eh.otEvening}ชม.`  : null,
                                                                    ].filter(Boolean);
                                                                    const wHrs = normalHrs + otHrs;
                                                                    const isMember = l.membership === 'Internal';
                                                                    return (
                                                                        <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px' }}>
                                                                            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: isMember ? '#ede9fe' : '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                                                                                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: isMember ? '#6d28d9' : '#a16207' }}>{isMember ? 'DC' : 'OT'}</span>
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>{name}</div>
                                                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                    {timeRange && (
                                                                                        <span style={{ fontSize: '0.72rem', color: '#0891b2', fontWeight: 700, background: '#ecfeff', padding: '2px 7px', borderRadius: '5px' }}>🕐 {timeRange}</span>
                                                                                    )}
                                                                                    {normalHrs > 0 && (
                                                                                        <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700, background: '#f1f5f9', padding: '2px 7px', borderRadius: '5px' }}>ปกติ {normalHrs} ชม.</span>
                                                                                    )}
                                                                                    {otBreakdown.map((ot, i) => (
                                                                                        <span key={i} style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 700, background: '#fefce8', padding: '2px 7px', borderRadius: '5px', border: '1px solid #fde68a' }}>{ot}</span>
                                                                                    ))}
                                                                                    {wHrs > 0 && (
                                                                                        <span style={{ fontSize: '0.73rem', color: '#7c3aed', fontWeight: 900, background: '#f5f3ff', padding: '2px 7px', borderRadius: '5px' }}>= {wHrs} ชม.</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Foreman note — Site Notes จากช่างตอนลงรายงาน */}
                                                        {log.note && (
                                                            <div style={{ margin: '0 16px 10px', padding: '10px 14px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>📝</span>
                                                                <div>
                                                                    <div style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>
                                                                        หมายเหตุช่าง <span style={{ fontWeight: 600, opacity: 0.7 }}>(Site Notes)</span>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.82rem', color: '#78350f', fontWeight: 600, lineHeight: 1.5 }}>{log.note}</div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Photos — toggle */}
                                                        {totalPhotos > 0 && (
                                                            <details style={{ margin: '0 16px 10px' }}>
                                                                <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569', border: '1px solid #e2e8f0', userSelect: 'none' }}>
                                                                    <span>📷</span> ดูรูป ({totalPhotos} รูป)
                                                                </summary>
                                                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    {photosByShift.map((group, gi) => (
                                                                        <div key={gi}>
                                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{group.label}</div>
                                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                                {group.urls.map((url, pi) => {
                                                                                    const slotLabel = group.isLabor && group.urls.length === 2
                                                                                        ? (pi === 0 ? 'เข้า' : 'ออก') : null;
                                                                                    return (
                                                                                        <div key={pi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                                                                <img src={url} alt={`${group.label}-${pi}`} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'block' }} />
                                                                                            </a>
                                                                                            {slotLabel && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b' }}>{slotLabel}</span>}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </details>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Rejection banner — shown at bottom of REV if it was rejected */}
                                            {(() => {
                                                const anyLog = logs[0];
                                                const revStatus = anyLog?.revisionStatus;
                                                const rejectReason = anyLog?.revisionRejectReason;
                                                const defectCats = anyLog?.revisionDefectCategories;
                                                if (revStatus !== 'closed_rejected') return null;
                                                const defectList = defectCats ? Object.entries(defectCats).filter(([,v]) => v).map(([k]) => k.split('(')[0].trim()) : [];
                                                return (
                                                    <div style={{ margin: '4px 0 4px', padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fca5a5', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>❌</span>
                                                        <div>
                                                            <div style={{ fontSize: '0.68rem', color: '#991b1b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>ลูกค้า Reject — ต้องแก้ไข</div>
                                                            {rejectReason && <div style={{ fontSize: '0.82rem', color: '#7f1d1d', fontWeight: 700, marginBottom: '4px' }}>"{rejectReason}"</div>}
                                                            {defectList.length > 0 && (
                                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                                    {defectList.map((d, i) => (
                                                                        <span key={i} style={{ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 700, background: '#fee2e2', padding: '2px 7px', borderRadius: '5px' }}>{d}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '12px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' }}>ปิดหน้าต่าง</button>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { workOrders, projects, staff, loading } = useWorkOrders();
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdminOrManager = (user?.role as any) === 'Admin' || (user?.role as any) === 'Manager' || (user?.role as any) === 'Director' || (user?.role as any) === 'Approver' || (user?.role as any) === 'BackOffice';
    const isForeman = user?.role === 'Foreman';
    const isMobile = useIsMobile();

    const [adminActiveTab] = useState<'overview' | 'comparison'>(() => {
        if (!isAdminOrManager) return 'overview';
        return (localStorage.getItem('dashboard_active_tab') as any) || 'overview';
    });

    useEffect(() => {
        localStorage.setItem('dashboard_active_tab', adminActiveTab);
    }, [adminActiveTab]);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    });
    const [selectedWeek, setSelectedWeek] = useState(0);
    const [selectedBarWOs, setSelectedBarWOs] = useState<any>(null);
    const [statusFilters] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState(isAdminOrManager ? 'insights' : 'operations');
    const [selectedForemanId, setSelectedForemanId] = useState<string | null>(null);
    const [taskCatFilter, setTaskCatFilter] = useState<string>('');
    const [taskStatusFilter, setTaskStatusFilter] = useState<string>('');
    const [taskWoTypeFilter, setTaskWoTypeFilter] = useState<string>('');

    const activeForemen = useMemo(() => {
        const foremanIdsWithWork = new Set<string>();
        workOrders.forEach((wo: any) => {
            if (wo.reporterId) foremanIdsWithWork.add(wo.reporterId);
            wo.categories?.forEach((c: any) => c.tasks.forEach((t: any) => {
                t.responsibleStaffIds?.forEach((id: string) => foremanIdsWithWork.add(id));
            }));
        });
        
        // ✅ ปรับให้หาเจอทั้งจาก ID เดิม และ Employee ID ใหม่
        return staff.filter((s: any) => {
            if (s.role !== 'Foreman') return false;
            return foremanIdsWithWork.has(s.id) || (s.employeeId && foremanIdsWithWork.has(s.employeeId));
        });
    }, [staff, workOrders]);

    const [selectedViewWO, setSelectedViewWO] = useState<any>(null);
    const [selectedHistoryWO, setSelectedHistoryWO] = useState<any>(null);
    const [lastBarContext, setLastBarContext] = useState<any>(null);
    const [activeProgressIndex, setActiveProgressIndex] = useState<any>(null);
    const [selectedLaborDetail, setSelectedLaborDetail] = useState<any>(null);
    const [highlightedSection] = useState<string | null>(null);
    const [drillDownProject, setDrillDownProject] = useState<string | null>(null);
    const [selectedSCurveProject, setSelectedSCurveProject] = useState<string>('');
    const [highlightedWOId, setHighlightedWOId] = useState<string | null>(null);
    const [selectedTaskHistory, setSelectedTaskHistory] = useState<any>(null);
    const [selectedComparisonCategory, setSelectedComparisonCategory] = useState<string | null>(null);
    const [selectedOpCategory, setSelectedOpCategory] = useState('urgent');
    const opListRef = useRef<HTMLDivElement>(null);
    const userHasManuallySelected = useRef(false);
    const [hoveredBarKey, setHoveredBarKey] = useState<string | null>(null);
    const [donutFilter, setDonutFilter] = useState<string | null>(null);

    const getProjectName = (id: string) => projects.find((p: any) => p.id === id)?.name || id;

    const isWorkOrderCompleted = (wo: any) => {
        if (wo.status === 'Completed' || wo.status === 'Verified') return true;
        let totalP = 0, tCount = 0;
        wo.categories?.forEach((c: any) => c.tasks.forEach((t: any) => {
            if (t.status !== 'Rejected') {
                totalP += t.dailyProgress || 0;
                tCount++;
            }
        }));
        return tCount > 0 && Math.round(totalP / tCount) === 100;
    };

    const getSLATimeStatus = (wo: any) => {
        const now = Date.now();
        // 1. Separate Logic for "Evaluating" (Site Survey) status
        if (wo.status === 'Evaluating') {
            const createdAt = new Date(wo.createdAt).getTime();
            const hoursPassed = (now - createdAt) / (3600 * 1000);

            // Only show Late Evaluation warning for Admin/Manager after 24h
            if (isAdminOrManager && hoursPassed > 24) {
                const days = Math.floor(hoursPassed / 24);
                const hours = Math.floor(hoursPassed % 24);
                const timeStr = days > 0 ? `${days}ว ${hours}ชม.` : `${hours}ชม.`;
                return { text: `ประเมินล่าช้า ${timeStr}`, color: '#f97316', bg: '#fff7ed', level: 'warning' };
            }

            // For Foreman, hide SLA alerts while in Evaluating
            return null;
        }

        // 2. Normal Logic for Active tasks (Approved/In Progress)
        const slaHoursMap: any = { 'Immediately': 4, '24h': 24, '1-3d': 72, '3-7d': 168, '7-14d': 336, '14-30d': 720 };
        let minHoursLeft = Infinity;
        let isOverdue = false;
        let mostUrgentLimit = 24;
        let urgentTaskName = '';
        let urgentCategoryName = '';

        wo.categories?.forEach((c: any) => {
            c.tasks.forEach((t: any) => {
                if (t.status === 'Completed' || t.status === 'Verified' || t.status === 'Rejected') return;
                const limit = slaHoursMap[t.slaCategory || '24h'] || 24;
                const start = t.startDate
                    ? new Date(`${t.startDate.split('T')[0]}T08:00:00`).getTime()
                    : (t.slaStartTime ? new Date(t.slaStartTime).getTime() : new Date(wo.createdAt).getTime());
                const hoursLeft = limit - (now - start) / (3600 * 1000);
                if (hoursLeft < minHoursLeft) {
                    minHoursLeft = hoursLeft;
                    mostUrgentLimit = limit;
                    urgentTaskName = t.name;
                    urgentCategoryName = c.name;
                }
                if (hoursLeft < 0) isOverdue = true;
            });
        });
        if (minHoursLeft === Infinity) return null;
        const warningThreshold = mostUrgentLimit * 0.3;
        if (isOverdue) {
            const absHours = Math.abs(minHoursLeft);
            const days = Math.floor(absHours / 24);
            const hours = Math.floor(absHours % 24);
            const minutes = Math.floor(absHours * 60 % 60);
            const timeStr = days > 0 ? `${days}ว ${hours}ชม.` : `${hours}ชม. ${minutes}น.`;
            return { text: `เกินกำหนด ${timeStr}`, color: '#ef4444', bg: '#fee2e2', level: 'critical', hoursLeft: minHoursLeft, taskName: urgentTaskName, categoryName: urgentCategoryName };
        } else {
            const days = Math.floor(minHoursLeft / 24);
            const hours = Math.floor(minHoursLeft % 24);
            const isWarning = minHoursLeft < warningThreshold;
            const color = isWarning ? '#f59e0b' : '#3b82f6';
            const bg = isWarning ? '#fef3c7' : '#eff6ff';
            return {
                text: `เหลือ ${days > 0 ? `${days}ว ` : ''}${hours}ชม.`,
                color, bg,
                level: isWarning ? 'warning' : 'normal',
                hoursLeft: minHoursLeft,
                taskName: urgentTaskName,
                categoryName: urgentCategoryName
            };
        }
    };

    const baseAccessibleWOs = useMemo(() => {
        if (!user) return [];

        // Refined guard for Admin/Manager: 
        // 1. In Overview mode: Show data if either a specific Foreman OR a Project filter is applied
        // 2. In Comparison mode: ALWAYS show data (global view)
        const hasAdminFilter = selectedForemanId || selectedSCurveProject;
        const isComparisonMode = adminActiveTab === 'comparison';

        if (isAdminOrManager && !hasAdminFilter && !isComparisonMode) return [];

        if (isAdminOrManager && (hasAdminFilter || isComparisonMode)) {
            return workOrders.filter((wo: any) => {
                if (wo.isArchived || wo.status === 'Cancelled') return false;
                
                // ✅ Check both IDs for foreman matching
                const matchesForeman = !selectedForemanId || (
                    wo.reporterId === selectedForemanId || 
                    wo.categories.some((c: any) => c.tasks.some((t: any) => t.responsibleStaffIds?.includes(selectedForemanId)))
                );
                
                const matchesProject = !selectedSCurveProject || wo.projectId === selectedSCurveProject;
                return matchesForeman && matchesProject;
            });
        }

        let base = user.role === 'Foreman'
            ? workOrders.filter((wo: any) => {
                const matchesUser = (id: string) => id === user.id || (user.employeeId && id === user.employeeId);
                const isReporter = matchesUser(wo.reporterId || '');
                const isResponsible = wo.categories?.some((c: any) => 
                    c.tasks?.some((t: any) => t.responsibleStaffIds?.some((id: string) => matchesUser(id)))
                );
                return isReporter || isResponsible;
            })
            : workOrders;
        return base.filter((wo: any) => !wo.isArchived && wo.status !== 'Cancelled');
    }, [workOrders, user, isAdminOrManager, selectedForemanId, selectedSCurveProject]);

    const availableProjectsThisMonth = useMemo(() => {
        if (!selectedMonth) return [];
        const [year, monthNum] = selectedMonth.split('-').map(Number);
        const startOfMonthTime = new Date(year, monthNum - 1, 1).getTime();
        const endOfMonthTime = new Date(year, monthNum, 0, 23, 59, 59).getTime();
        const statsMap: any = {};

        const SKIP_STATUSES = ['Draft', 'Pending', 'Cancelled', 'Evaluating'];
        const matchUid = (id: string) => id === user?.id || (user?.employeeId && id === user?.employeeId);
        const viewingAs = isAdminOrManager ? selectedForemanId : null;
        const hasOwnerTask = (wo: any) =>
            (wo.categories || []).some((c: any) =>
                (c.tasks || []).some((t: any) => {
                    const owners: string[] = t.responsibleStaffIds || [];
                    if (viewingAs) return owners.includes(viewingAs) || (!owners.length && wo.reporterId === viewingAs);
                    return owners.some((id: string) => matchUid(id)) || (!owners.length && matchUid(wo.reporterId || ''));
                })
            );

        // Use baseAccessibleWOs so the project list doesn't shrink when one is selected
        baseAccessibleWOs.forEach((wo: any) => {
            if (SKIP_STATUSES.includes(wo.status)) return;
            if (!hasOwnerTask(wo)) return;
            const created = new Date(wo.createdAt).getTime();
            const completed = wo.completedAt ? new Date(wo.completedAt).getTime() : null;
            const isActive = created <= endOfMonthTime && (!completed || completed >= startOfMonthTime);
            if (isActive) {
                statsMap[wo.projectId] = true;
            }
        });

        return projects.filter((p: any) => statsMap[p.id]);
    }, [baseAccessibleWOs, projects, selectedMonth, user, isAdminOrManager, selectedForemanId]);

    const selectableProjects = useMemo(() => {
        if (!user || user.role !== 'Foreman') return projects;
        const accessibleProjectIds = new Set(baseAccessibleWOs.map((wo: any) => wo.projectId));
        return projects.filter((p: any) => accessibleProjectIds.has(p.id));
    }, [projects, baseAccessibleWOs, user]);

    useEffect(() => {
        if (!user) return;
        // Clear the project filter only when the selected project is no longer
        // available in the current month — NOT based on the active tab. The old
        // `viewMode === 'operations'` branch reset the selection on every change,
        // wiping the user's choice before it could filter the operations data.
        const currentIsValid = selectedSCurveProject === '' || availableProjectsThisMonth.some((p: any) => p.id === selectedSCurveProject);
        if (!currentIsValid) {
            setSelectedSCurveProject('');
        }
    }, [availableProjectsThisMonth, selectedSCurveProject, user]);

    const allAccessibleWOs = useMemo(() => {
        let base = [...baseAccessibleWOs];
        if (selectedSCurveProject) base = base.filter((wo: any) => wo.projectId === selectedSCurveProject);
        return base;
    }, [baseAccessibleWOs, selectedSCurveProject]);

    const filteredData = useMemo(() => {
        let base = [...allAccessibleWOs];
        const [year, month] = selectedMonth.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1).getTime();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();
        base = base.filter((wo: any) => {
            const created = new Date(wo.createdAt).getTime();
            const completed = wo.completedAt ? new Date(wo.completedAt).getTime() : null;
            // Original Strict Logic: Created or Completed in this month
            return (created >= startOfMonth && created <= endOfMonth) || (completed && completed >= startOfMonth && completed <= endOfMonth);
        });
        if (selectedWeek > 0) {
            base = base.filter((wo: any) => {
                const day = new Date(wo.createdAt).getDate();
                const actualW = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
                return actualW === selectedWeek || (selectedWeek === 5 && day > 28);
            });
        }
        if (statusFilters.length > 0) {
            base = base.filter((wo: any) => {
                const isCompleted = isWorkOrderCompleted(wo);
                let show = false;
                if (statusFilters.includes('completed') && isCompleted) show = true;
                if (statusFilters.includes('ongoing') && !isCompleted && ['In Progress', 'Approved', 'Partially Approved', 'Pending', 'Rejected'].includes(wo.status)) show = true;
                if (statusFilters.includes('evaluating') && wo.status === 'Evaluating') show = true;
                return show;
            });
        }
        if (taskWoTypeFilter === 'wop') base = base.filter((wo: any) => wo.workOrderCode === 'WOP' || (wo as any).type === 'PreHandover');
        if (taskWoTypeFilter === 'woa') base = base.filter((wo: any) => wo.workOrderCode !== 'WOP' && (wo as any).type !== 'PreHandover');
        return base;
    }, [allAccessibleWOs, selectedMonth, selectedWeek, statusFilters, taskWoTypeFilter]);

    // ✅ Phase 1: Flat-map tasks for Task-Centric Dashboard
    const flatTasks = useMemo(() => {
        const tasks: any[] = [];
        const _isAdminOrManager = (user?.role as any) === 'Admin' || (user?.role as any) === 'Manager' || (user?.role as any) === 'Director' || (user?.role as any) === 'Approver' || (user?.role as any) === 'BackOffice';
        const matchesUser = (id: string) => {
            if (!user) return false;
            // Admin viewing a specific foreman → match selected foreman's ID
            if (_isAdminOrManager && selectedForemanId) return id === selectedForemanId;
            // Admin with only project filter → show all tasks
            if (_isAdminOrManager) return true;
            return id === user.id || (user.employeeId && id === user.employeeId);
        };

        filteredData.forEach((wo: any) => {
            wo.categories?.forEach((cat: any) => {
                cat.tasks?.forEach((task: any) => {
                    const isResponsible = _isAdminOrManager
                        ? (task.responsibleStaffIds?.some((id: string) => matchesUser(id)) || (!selectedForemanId && task.responsibleStaffIds?.length >= 0))
                        : task.responsibleStaffIds?.some((id: string) => matchesUser(id));

                    // Show only tasks where this user is directly responsible
                    if (isResponsible) {
                        tasks.push({
                            ...task,
                            woId: wo.id,
                            woStatus: wo.status,
                            locationName: wo.locationName,
                            projectId: wo.projectId,
                            projectName: getProjectName(wo.projectId),
                            categoryName: cat.name,
                            parentWO: wo
                        });
                    }
                });
            });
        });
        
        // Sort by WO ID to facilitate grouping, then by task name
        return tasks.sort((a, b) => {
            if (a.woId !== b.woId) return a.woId.localeCompare(b.woId);
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [filteredData, user, projects, selectedForemanId]);

    const getTaskDisplayStatus = (t: any): string => {
        if (t.status === 'Completed' && t.evaluationStatus === 'Assigned') return 'รอลูกค้าประเมิน';
        const p = t.dailyProgress ?? t.progress ?? (['Completed', 'Verified'].includes(t.status) ? 100 : 0);
        if (p === 100 || t.status === 'Completed' || t.status === 'Verified') return 'เสร็จสมบูรณ์';
        if (p > 0) return 'กำลังดำเนินการ';
        return 'ยังไม่เริ่ม';
    };
    const taskCatOptions = useMemo(() => {
        const base = taskStatusFilter ? flatTasks.filter((t: any) => getTaskDisplayStatus(t) === taskStatusFilter) : flatTasks;
        return Array.from(new Set(base.map((t: any) => t.categoryName).filter(Boolean))).sort() as string[];
    }, [flatTasks, taskStatusFilter]);
    const taskStatusOptions = useMemo(() => {
        const base = taskCatFilter ? flatTasks.filter((t: any) => t.categoryName === taskCatFilter) : flatTasks;
        return Array.from(new Set(base.map((t: any) => getTaskDisplayStatus(t)))).sort() as string[];
    }, [flatTasks, taskCatFilter]);
    const filteredFlatTasks = useMemo(() => flatTasks.filter((t: any) => {
        if (highlightedWOId && t.woId !== highlightedWOId) return false;
        if (taskCatFilter && t.categoryName !== taskCatFilter) return false;
        if (taskStatusFilter && getTaskDisplayStatus(t) !== taskStatusFilter) return false;
        return true;
    }), [flatTasks, highlightedWOId, taskCatFilter, taskStatusFilter]);

    // Comparison Dashboard specific broad filtering
    const comparisonFilteredData = useMemo(() => {
        let base = [...allAccessibleWOs];
        const [year, month] = selectedMonth.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1).getTime();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();

        return base.filter((wo: any) => {
            const created = new Date(wo.createdAt).getTime();
            const completed = wo.completedAt ? new Date(wo.completedAt).getTime() : Infinity;
            return created <= endOfMonth && completed >= startOfMonth;
        });
    }, [allAccessibleWOs, selectedMonth]);

    const getDashboardStats = useCallback((filteredWOs: any[]) => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1).getTime();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();

        const nowMs = Date.now();
        const isAdminOrManager = (user?.role as any) === 'Admin' || (user?.role as any) === 'Manager' || (user?.role as any) === 'Director' || (user?.role as any) === 'Approver' || (user?.role as any) === 'BackOffice';

        // Monthly Cutoff Logic: If looking at a past month, 'now' should be the end of that month.
        const effectiveNow = nowMs > endOfMonth ? endOfMonth : nowMs;
        const now = effectiveNow;
        const slaHoursMap: Record<string, number> = { 'Immediately': 4, '24h': 24, '1-3d': 72, '3-7d': 168, '7-14d': 336, '14-30d': 720 };

        // Ownership helpers — defined early so WO-level filters can use them
        const _matchUid = (id: string) => id === user?.id || (user?.employeeId && id === user?.employeeId);
        const _viewingAs = isAdminOrManager ? selectedForemanId : null;
        const _hasOwnerTask = (wo: any) =>
            (wo.categories || []).some((c: any) =>
                (c.tasks || []).some((t: any) => {
                    const owners: string[] = t.responsibleStaffIds || [];
                    if (_viewingAs) return owners.includes(_viewingAs) || (!owners.length && wo.reporterId === _viewingAs);
                    return owners.some((id: string) => _matchUid(id)) || (!owners.length && _matchUid(wo.reporterId || ''));
                })
            );

        const EXCLUDED_STATUSES = ['Draft', 'Pending', 'Cancelled', 'Evaluating'];

        const newThisMonthData = allAccessibleWOs.filter((wo: any) => {
            if (EXCLUDED_STATUSES.includes(wo.status)) return false;
            const created = new Date(wo.createdAt).getTime();
            return created >= startOfMonth && created <= endOfMonth && _hasOwnerTask(wo);
        });

        const carriedOverData = allAccessibleWOs.filter((wo: any) => {
            if (EXCLUDED_STATUSES.includes(wo.status)) return false;
            const created = new Date(wo.createdAt).getTime();
            const completed = wo.completedAt ? new Date(wo.completedAt).getTime() : null;
            if (created >= startOfMonth) return false;
            return (!isWorkOrderCompleted(wo) || (completed && completed >= startOfMonth)) && _hasOwnerTask(wo);
        });

        const newThisMonth = newThisMonthData.length;
        const carriedOver = carriedOverData.length;
        const totalInMonth = newThisMonth + carriedOver;
        const closedWOsInScope = [...newThisMonthData, ...carriedOverData].filter((wo: any) => wo.status === 'Completed' || wo.status === 'Verified').length;
        const total = allAccessibleWOs.length;
        const totalAssignments = filteredWOs.length;

        const pendingAdminEval = allAccessibleWOs.filter((wo: any) =>
            ['Pending', 'Evaluating'].includes(wo.status) ||
            (wo.status === 'Rejected' && wo.pendingAdminReassign === true)
        ).length;

        let closed = 0;
        let open = 0;
        let evaluating = 0;
        let highRisk = 0, slaMetCount = 0, totalTaskCount = 0;

        // ✅ Count tasks instead of Work Orders for core metrics
        // "evaluating" = Foreman done, waiting for customer on-site — NOT yet Completed/Verified by customer
        const isForCustomerEval = (wo: any) => {
            if (['Completed', 'Verified'].includes(wo.status)) return false;
            if (wo.status === 'pending_delivery') return true;
            const allTasks = (wo.categories || []).flatMap((c: any) => c.tasks || []);
            return allTasks.length > 0 && allTasks.every((t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100);
        };
        // Filter to tasks the current foreman is responsible for
        const matchUid = (id: string) => id === user?.id || (user?.employeeId && id === user?.employeeId);
        const viewingAs = isAdminOrManager ? selectedForemanId : null;
        const isOwnerTask = (t: any, wo: any) => {
            const owners: string[] = t.responsibleStaffIds || [];
            if (viewingAs) return owners.includes(viewingAs) || (!owners.length && wo.reporterId === viewingAs);
            return owners.some((id: string) => matchUid(id)) || (!owners.length && matchUid(wo.reporterId || ''));
        };
        // Count evaluating at WO level only (for the "evaluating" stat card)
        evaluating = allAccessibleWOs.filter(isForCustomerEval).length;
        // Count tasks only from WOs in scope (same set as totalInMonth) — excludes draft, prev-month closed, pending-admin
        const inScopeWOs = [...newThisMonthData, ...carriedOverData];
        inScopeWOs.forEach((wo: any) => {
            if (['Draft', 'Cancelled'].includes(wo.status)) return;
            (wo.categories || []).forEach((c: any) => {
                (c.tasks || []).forEach((t: any) => {
                    if (!isOwnerTask(t, wo)) return;
                    const tStatus = (t.status || '').toLowerCase();
                    const isWaitingCustomerEval = tStatus === 'completed' && t.evaluationStatus === 'Assigned';
                    const isCompleted = !isWaitingCustomerEval && (tStatus === 'completed' || tStatus === 'verified');
                    // งานถึง 100% แล้ว (รวม for-checking) = นับ SLA ฝั่งช่าง
                    const isWorkDone = isCompleted || tStatus === 'for-checking' || isWaitingCustomerEval || (t.dailyProgress ?? t.progress ?? 0) === 100;
                    if (isCompleted) closed++;
                    else if (!isWorkDone) open++;
                    if (isWorkDone) {
                        // SLA counting — work is done when progress hits 100%, customer eval time not counted
                        const slaLimit = slaHoursMap[t.slaCategory || '24h'] || 24;
                        const slaStart = t.slaStartTime
                            ? new Date(t.slaStartTime).getTime()
                            : (t.startDate
                                ? new Date(`${t.startDate.split('T')[0]}T08:00:00`).getTime()
                                : new Date(wo.createdAt).getTime());
                        // slaEnd: completedAt → max(history dates) → updatedAt → skip
                        // qrGeneratedAt excluded: generated same day as start (not work completion)
                        // wo.completedAt excluded: customer acceptance date, not work completion
                        const _histMsArr = (t.history || []).map((h: any) => new Date(h.date).getTime()).filter(Number.isFinite);
                        const _maxHistMs = _histMsArr.length ? Math.max(..._histMsArr) : null;
                        const slaEnd =
                            t.completedAt ? new Date(t.completedAt).getTime() :
                            _maxHistMs !== null ? _maxHistMs :
                            t.updatedAt ? new Date(t.updatedAt).getTime() :
                            null;
                        if (slaEnd !== null && slaEnd >= slaStart) {
                            totalTaskCount++;
                            if ((slaEnd - slaStart) / (1000 * 3600) <= slaLimit) {
                                slaMetCount++;
                            }
                        }
                    }
                });
            });
        });

        filteredWOs.forEach((wo: any) => {
            const isFocusMatch = !highlightedWOId || wo.id?.toString().trim() === highlightedWOId?.toString().trim();
            (wo.categories || []).forEach((c: any) => {
                (c.tasks || []).forEach((t: any) => {
                    const limit = slaHoursMap[t.slaCategory || '24h'] || 24;
                    const start = t.startDate
                    ? new Date(`${t.startDate.split('T')[0]}T08:00:00`).getTime()
                    : (t.slaStartTime ? new Date(t.slaStartTime).getTime() : new Date(wo.createdAt).getTime());

                    if (!(t.dailyProgress === 100 || t.status === 'Completed' || t.status === 'Verified')) {
                        if (t.status !== 'Rejected') {
                            const hoursLeft = limit - (now - start) / (1000 * 3600);
                            if (hoursLeft < limit * 0.3) {
                                if (isFocusMatch) highRisk++;
                            }
                        }
                    }
                });
            });
        });

        const slaScore = totalTaskCount > 0 ? Math.round(slaMetCount / totalTaskCount * 100) : null;
        const daysInMonth = new Date(year, month, 0).getDate();
        const filterStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const filterEndStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        const isInRange = (dStr: string) => dStr >= filterStartStr && dStr <= filterEndStr;

        const dailyAggregation: any = {};
        const projectAggregation: any = {};
        const categoryAggregation: any = {};
        const foremanAggregation: any = {};
        const internalRate = 550; // THB/Hour
        const outsourceRate = 850; // THB/Hour
        let totalProgressDelta = 0;

        filteredWOs.forEach((wo: any) => {
            const pId = wo.projectId || 'Unknown';
            if (!projectAggregation[pId]) projectAggregation[pId] = { delta: 0, hours: 0, taskCount: 0, slaMet: 0, totalDuration: 0, workDuration: 0, totalRatio: 0, cases: [] };
            const woSlaStart = wo.createdAt ? new Date(wo.createdAt).getTime() : now;
            (wo.categories || []).forEach((c: any) => {
                (c.tasks || []).forEach((t: any) => {
                    let lastP = 0;
                    const history = [...(t.history || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const currentSlaType = t.slaCategory || '24h';
                    const limit = slaHoursMap[currentSlaType] || 24;
                    const start = t.startDate
                        ? new Date(`${t.startDate.split('T')[0]}T08:00:00`).getTime()
                        : (t.slaStartTime ? new Date(t.slaStartTime).getTime() : woSlaStart);
                    let isSlaMet = false;
                    let duration = 0;
                    const tStatus = (t.status || '').toLowerCase();
                    const isWaitingEval = tStatus === 'completed' && t.evaluationStatus === 'Assigned';
                    const isFullyDone = !isWaitingEval && (tStatus === 'completed' || tStatus === 'verified');
                    if (isFullyDone) {
                        const lastUpdate = history[history.length - 1];
                        // Never use `now` — would count customer wait time against foreman
                        const end =
                            t.completedAt ? new Date(t.completedAt).getTime() :
                            lastUpdate ? new Date(lastUpdate.date).getTime() :
                            wo.inspectionTimeline?.qrGeneratedAt ? new Date(wo.inspectionTimeline.qrGeneratedAt).getTime() :
                            wo.completedAt ? new Date(wo.completedAt).getTime() :
                            null;
                        if (end === null || end < start) return; // no valid end, or stale completedAt from prior round

                        const workHours = history.reduce((acc: number, h: any) => {
                            let hTotal = 0;
                            (h.labor || []).forEach((lab: any) => {
                                let hrs = 0;
                                if (lab.shifts) {
                                    if (lab.shifts.normal) hrs += 8;
                                    if (lab.shifts.otMorning) hrs += 2;
                                    if (lab.shifts.otNoon) hrs += 1;
                                    if (lab.shifts.otEvening) hrs += 3;
                                } else {
                                    hrs = lab.timeType === 'Normal' ? 8 : 2;
                                }
                                hTotal += hrs * (lab.amount || 1);
                            });
                            return acc + hTotal;
                        }, 0);

                        const calendarHours = (end - start) / (3600 * 1000);
                        duration = Math.max(calendarHours, workHours);

                        if (duration <= limit) isSlaMet = true;
                        const workDays = new Set(history.map((h: any) => h.date.split('T')[0])).size;

                        projectAggregation[pId].totalDuration += duration;
                        projectAggregation[pId].workDuration += workDays * 8;
                        projectAggregation[pId].totalRatio += duration / limit * 100;

                        const foremanIds = t.responsibleStaffIds || [wo.reporterId].filter(Boolean);
                        foremanIds.forEach((fId: string) => {
                            if (!foremanAggregation[fId]) foremanAggregation[fId] = { id: fId, totalJobs: 0, slaMet: 0, totalDuration: 0, taskCount: 0 };
                            foremanAggregation[fId].totalJobs++;
                            if (isSlaMet) foremanAggregation[fId].slaMet++;
                            foremanAggregation[fId].totalDuration += duration;
                            foremanAggregation[fId].taskCount++;
                        });

                        const isCurrentUserTask = isAdminOrManager
                            ? true
                            : foremanIds.some((id: string) => id === user?.id || (user?.employeeId && id === user.employeeId));

                        if (!isCurrentUserTask) {
                            if (isSlaMet) projectAggregation[pId].slaMet++;
                            projectAggregation[pId].taskCount++;
                            return;
                        }

                        const latestNote = history.filter((h: any) => h.notes).slice(-1)[0]?.notes || t.notes || '';

                        projectAggregation[pId].cases.push({
                            id: wo.id.slice(-6),
                            fullId: wo.id,
                            label: `${wo.id.slice(-6)} · ${(t.name || c.name || '').slice(0, 12)}`,
                            taskName: t.name,
                            categoryName: c.name,
                            total: duration,
                            work: workDays * 8,
                            actualManHours: workHours,
                            target: limit,
                            calendarDays: calendarHours / 24,
                            targetDays: limit / 24,
                            workDays: workDays,
                            ratio: duration / limit * 100,
                            deviation: 100 - (duration / limit * 100),
                            workRatio: workDays * 8 / limit * 100,
                            notes: latestNote
                        });
                        if (isSlaMet) projectAggregation[pId].slaMet++;
                        projectAggregation[pId].taskCount++;
                    }

                    const catName = t.rootCause || c.name || "ทั่วไป";
                    const taskResponsibleIds = t.responsibleStaffIds || [wo.reporterId].filter(Boolean);
                    const isMyTask = isAdminOrManager || taskResponsibleIds.some((id: string) => id === user?.id || (user?.employeeId && id === user.employeeId));

                    if (isMyTask) {
                        if (!categoryAggregation[catName]) categoryAggregation[catName] = { name: catName, count: 0, cost: 0, hours: 0, projects: {} };
                        categoryAggregation[catName].count++;
                        categoryAggregation[catName].projects[pId] = (categoryAggregation[catName].projects[pId] || 0) + 1;
                    }

                    history.forEach((h: any) => {
                        const currP = h.progress || 0;
                        const dStr = h.date.split('T')[0];
                        if (isInRange(h.date)) {
                            const d = Math.max(0, currP - lastP);
                            totalProgressDelta += d;
                            if (!dailyAggregation[dStr]) dailyAggregation[dStr] = { delta: 0, hours: 0, completedCount: 0, taskCount: 0, slaMet: 0 };
                            dailyAggregation[dStr].delta += d;
                            projectAggregation[pId].delta += d;

                            if (isMyTask) {
                                (h.labor || []).forEach((lab: any) => {
                                    let labHrs = 0;
                                    if (lab.shifts) {
                                        if (lab.shifts.normal) labHrs += 8;
                                        if (lab.shifts.otMorning) labHrs += 2;
                                        if (lab.shifts.otNoon) labHrs += 1;
                                        if (lab.shifts.otEvening) labHrs += 3;
                                    } else {
                                        labHrs = lab.timeType === 'Normal' ? 8 : 2;
                                    }
                                    const cost = labHrs * (lab.amount || 1) * (lab.membership === 'Internal' ? internalRate : outsourceRate);
                                    if (!categoryAggregation[catName]) categoryAggregation[catName] = { name: catName, count: 0, cost: 0, hours: 0, projects: {} };
                                    categoryAggregation[catName].cost += cost;
                                    categoryAggregation[catName].hours += labHrs * (lab.amount || 1);
                                });
                            }
                        }
                        lastP = currP;
                    });
                });
            });
        });

        const stalledCases = filteredWOs.filter((wo: any) => {
            if (wo.status === 'Completed' || wo.status === 'Cancelled' || wo.status === 'Rejected') return false;
            let lastUpdateTime = new Date(wo.createdAt).getTime();
            (wo.categories || []).forEach((c: any) => c.tasks.forEach((t: any) => (t.history || []).forEach((h: any) => {
                const dt = new Date(h.date).getTime();
                if (dt > lastUpdateTime) lastUpdateTime = dt;
            })));
            return now - lastUpdateTime > 48 * 3600 * 1000;
        });

        const urgentTasks: any[] = [];
        const upcomingTasks: any[] = [];
        let dueTodayCount = 0;
        const sevenDaysLaterMs = nowMs + 7 * 24 * 60 * 60 * 1000;

        allAccessibleWOs.forEach((wo: any) => {
            if (wo.status === 'Evaluating' && !isAdminOrManager) return;
            if (wo.status === 'Draft') return;
            const isFocusMatch = !highlightedWOId || wo.id?.toString().trim() === highlightedWOId?.toString().trim();
            const status = getSLATimeStatus(wo);
            const isCompleted = isWorkOrderCompleted(wo);

            if (isFocusMatch && !isCompleted && status) {
                if (status.level === 'critical' || status.level === 'warning') {
                    urgentTasks.push({
                        ...wo,
                        woId: wo.id,
                        statusInfo: status,
                        taskName: status.taskName || wo.locationName
                    });
                }
                if (status.text?.includes('เหลือ') && !status.text?.includes('ว')) {
                    const hoursStr = status.text.match(/\d+/);
                    const hours = hoursStr ? parseInt(hoursStr[0]) : 24;
                    if (hours <= 24) dueTodayCount++;
                } else if (status.level === 'critical') {
                    dueTodayCount++;
                }
            }

            if (wo.startDate && isFocusMatch) {
                const startMs = new Date(wo.startDate).getTime();
                if (startMs > nowMs && startMs <= sevenDaysLaterMs) upcomingTasks.push(wo);
            }
        });

        const projectsMap: any = {};
        const laborByProject: any = {};
        let internalHours = 0, outsourceHours = 0, totalHours = 0, internalCount = 0, outsourceCount = 0;

        filteredWOs.forEach((wo: any) => {
            const isFocusMatch = !highlightedWOId || wo.id?.toString().trim() === highlightedWOId?.toString().trim();
            const pId = wo.projectId || 'Unknown';
            if (!projectsMap[pId]) projectsMap[pId] = {
                name: getProjectName(pId),
                total: 0, completed: 0, active: 0, stalled: 0, highRisk: 0,
                inProgress: 0, evaluating: 0, categories: {},
                completedJobs: [], evaluatingJobs: [], inProgressJobs: []
            };

            // ✅ Count tasks instead of Work Orders for project statistics
            (wo.categories || []).forEach((c: any) => {
                (c.tasks || []).forEach((t: any) => {
                    const tResponsible = t.responsibleStaffIds || [wo.reporterId].filter(Boolean);
                    const isMineTask = isAdminOrManager || tResponsible.some((id: string) => id === user?.id || (user?.employeeId && id === user.employeeId));
                    if (!isMineTask) return;
                    projectsMap[pId].total++;
                    const isTaskCompleted = t.dailyProgress === 100 || t.status === 'Completed' || t.status === 'Verified';
                    if (isTaskCompleted) {
                        projectsMap[pId].completed++;
                    } else {
                        projectsMap[pId].active++;
                        if (wo.status === 'Evaluating') projectsMap[pId].evaluating++;
                        else projectsMap[pId].inProgress++;
                    }
                });

                const myTasks = (c.tasks || []).filter((t: any) => {
                    const tResponsible = t.responsibleStaffIds || [wo.reporterId].filter(Boolean);
                    return isAdminOrManager || tResponsible.some((id: string) => id === user?.id || (user?.employeeId && id === user.employeeId));
                });
                if (!projectsMap[pId].categories[c.name]) projectsMap[pId].categories[c.name] = { name: c.name, total: 0, completed: 0, slaMet: 0, stalled: 0 };
                projectsMap[pId].categories[c.name].total += myTasks.length;
                projectsMap[pId].categories[c.name].completed += myTasks.filter((t: any) => t.dailyProgress === 100 || t.status === 'Completed' || t.status === 'Verified').length;
            });

            const isWOCompleted = isWorkOrderCompleted(wo);
            if (isWOCompleted) {
                projectsMap[pId].completedJobs.push({ id: wo.id, name: wo.locationName });
            } else {
                let lastUpdateTime = new Date(wo.createdAt).getTime();
                (wo.categories || []).forEach((c: any) => c.tasks.forEach((t: any) => (t.history || []).forEach((h: any) => {
                    const dt = new Date(h.date).getTime();
                    if (dt > lastUpdateTime) lastUpdateTime = dt;
                })));
                const isStalled = now - lastUpdateTime > 48 * 3600 * 1000;
                if (isStalled) projectsMap[pId].stalled++;
                
                if (wo.status === 'Evaluating') {
                    projectsMap[pId].evaluatingJobs.push({ id: wo.id, name: wo.locationName });
                } else {
                    projectsMap[pId].inProgressJobs.push({ id: wo.id, name: wo.locationName });
                }
                const slaStatus = getSLATimeStatus(wo);
                if (slaStatus && (slaStatus.level === 'critical' || slaStatus.level === 'warning')) projectsMap[pId].highRisk++;
            }

            if (!laborByProject[pId]) laborByProject[pId] = { name: getProjectName(pId), internalWorkers: 0, outsourceWorkers: 0 };

            if (highlightedWOId && isFocusMatch) {
                closed = isWorkOrderCompleted(wo) ? 1 : 0;
                open = (!isWorkOrderCompleted(wo) && ['In Progress', 'Approved', 'Partially Approved', 'Pending', 'Rejected'].includes(wo.status)) ? 1 : 0;
                evaluating = isForCustomerEval(wo) ? 1 : 0;
            }

            const taskMapByDate: any = {};
            (wo.categories || []).forEach((c: any) => {
                (c.tasks || []).forEach((t: any) => {
                    const tResp = t.responsibleStaffIds || [wo.reporterId].filter(Boolean);
                    if (!isAdminOrManager && !tResp.some((id: string) => id === user?.id || (user?.employeeId && id === user.employeeId))) return;
                    (t.history || []).forEach((log: any) => {
                        let dateStr = '';
                        if (log.date) {
                            const parsed = new Date(log.date);
                            if (!isNaN(parsed.getTime())) {
                                dateStr = parsed.toISOString().split('T')[0];
                            }
                        }
                        if (!dateStr) return;
                        const key = `${wo.id}_${t.id || t.name}_${dateStr}`;
                        if (!taskMapByDate[key] || new Date(log.date).getTime() > taskMapByDate[key].timestamp) {
                            taskMapByDate[key] = { timestamp: new Date(log.date).getTime(), dateStr, labor: log.labor || [] };
                        }
                    });
                });
            });

            Object.values(taskMapByDate).forEach((entry: any) => {
                entry.labor.forEach((lab: any) => {
                    let hours = 0;
                    if (lab.shifts) {
                        if (lab.shifts.normal) hours += 8;
                        if (lab.shifts.otMorning) hours += 2;
                        if (lab.shifts.otNoon) hours += 1;
                        if (lab.shifts.otEvening) hours += 3;
                    } else {
                        hours = lab.timeType === 'Normal' ? 8 : 2;
                    }
                    const hVal = hours * (lab.amount || 1);
                    totalHours += hVal;
                    projectAggregation[pId].hours += hVal;
                    if (dailyAggregation[entry.dateStr]) dailyAggregation[entry.dateStr].hours += hVal;

                    if (lab.membership === 'Internal') {
                        if (isFocusMatch) {
                            internalCount += lab.amount || 1;
                            internalHours += hVal;
                        }
                        laborByProject[pId].internalWorkers += lab.amount || 1;
                    } else {
                        if (isFocusMatch) {
                            outsourceCount += lab.amount || 1;
                            outsourceHours += hVal;
                        }
                        laborByProject[pId].outsourceWorkers += lab.amount || 1;
                    }
                });
            });
        });

        const laborByProjectArray = Object.values(laborByProject).map((p: any, idx: number) => {
            const pId = Object.keys(laborByProject)[idx];
            const agg = projectAggregation[pId] || { delta: 0, hours: 0, taskCount: 0, slaMet: 0 };
            const pMap = projectsMap[pId] || { total: 0, active: 0, stalled: 0, highRisk: 0, categories: {} };
            const prod = agg.hours > 0 ? (agg.delta / (agg.hours / 8)).toFixed(1) : '0';
            const sla = agg.taskCount > 0 ? Math.round(agg.slaMet / agg.taskCount * 100) : 100;
            return {
                id: pId, name: p.name, internal: p.internalWorkers, outsource: p.outsourceWorkers,
                totalWorkers: p.internalWorkers + p.outsourceWorkers, productivity: prod, slaScore: sla,
                total: pMap.total, active: pMap.active, stalled: pMap.stalled, highRisk: pMap.highRisk,
                completed: pMap.completed, inProgress: pMap.inProgress, evaluating: pMap.evaluating,
                inProgressJobs: pMap.inProgressJobs || [], completedJobs: pMap.completedJobs || [],
                evaluatingJobs: pMap.evaluatingJobs || [], categories: Object.values(pMap.categories),
                avgTotal: agg.taskCount > 0 ? agg.totalDuration / agg.taskCount : 0,
                avgWork: agg.taskCount > 0 ? agg.workDuration / agg.taskCount : 0,
                performanceRatio: agg.taskCount > 0 ? agg.totalRatio / agg.taskCount : 0,
                deviation: agg.taskCount > 0 ? 100 - agg.totalRatio / agg.taskCount : 0,
                taskCount: agg.taskCount, cases: agg.cases.sort((a: any, b: any) => b.ratio - a.ratio).slice(0, 15),
            };
        }).filter((p: any) => p.total > 0).sort((a: any, b: any) => b.highRisk !== a.highRisk ? b.highRisk - a.highRisk : b.total - a.total);

        const totalBudget = projects.reduce((acc: number, p: any) => acc + (p.budget || 0), 0);
        const totalActualCost = filteredWOs.reduce((acc: number, wo: any) => {
            let woCost = 0;
            wo.categories?.forEach((c: any) => c.tasks.forEach((t: any) => woCost += (t.amount || Math.random() * 2 + 1) * 12500));
            return acc + woCost;
        }, 0);

        const chronicIssues = Object.values(filteredWOs.reduce((acc: any, wo: any) => {
            if (highlightedWOId && wo.id?.toString().trim() !== highlightedWOId?.toString().trim()) return acc;
            wo.categories?.forEach((c: any) => {
                c.tasks.forEach((t: any) => {
                    const key = t.rootCause || c.name;
                    if (!acc[key]) acc[key] = { name: key, count: 0 };
                    acc[key].count++;
                });
            });
            return acc;
        }, {})).sort((a: any, b: any) => b.count - a.count).slice(0, 5).map((item: any) => ({ ...item, action: 'ตรวจสอบแผนปฏิบัติงานรายวัน' }));

        return {
            total, closed, open, evaluating, highRisk, totalHours, totalBudget, totalActualCost,
            internalCount, outsourceCount, slaScore, slaMetCount, totalTaskCount,
            projectStats: Object.values(projectsMap).sort((a: any, b: any) => b.total - a.total),
            stalledCases, chronicIssues, budgetPerformance: [], laborByProject: laborByProjectArray, totalAssignments,
            totalInMonth, newThisMonth, carriedOver, closedWOsInScope, dueTodayCount, pendingAdminEval,
            urgentTasks: urgentTasks.sort((a: any, b: any) => (a.statusInfo?.hoursLeft || 0) - (b.statusInfo?.hoursLeft || 0)),
            upcomingTasks: upcomingTasks.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
            laborStats: [{ name: 'DC ใน (Internal)', value: internalHours, color: '#4f46e5' }, { name: 'DC นอก (Outsource)', value: outsourceHours, color: '#10b981' }],
            internalHours, outsourceHours,
            categoryStats: Object.values(categoryAggregation).sort((a: any, b: any) => b.count - a.count).map((cat: any, idx) => ({ ...cat, color: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e', '#14b8a6'][idx % 8] })),
            foremanStats: Object.values(foremanAggregation).map((f: any) => {
                const s = staff.find(st => st.id === f.id);
                return { ...f, name: s ? s.name : `โฟร์แมน ${f.id.slice(-4)}`, slaScore: f.taskCount > 0 ? Math.round((f.slaMet / f.taskCount) * 100) : 100, avgResolution: f.taskCount > 0 ? (f.totalDuration / f.taskCount).toFixed(1) : '0' };
            }).sort((a: any, b: any) => b.slaScore !== a.slaScore ? b.slaScore - a.slaScore : b.totalJobs - a.totalJobs),
        };
    }, [selectedMonth, allAccessibleWOs, isWorkOrderCompleted, highlightedWOId, getProjectName, isAdminOrManager, staff, user, selectedForemanId]);

    const stats = useMemo<DashboardStats>(() => getDashboardStats(filteredData), [getDashboardStats, filteredData]);
    const comparisonStats = useMemo<DashboardStats>(() => getDashboardStats(comparisonFilteredData), [getDashboardStats, comparisonFilteredData]);

    // Health cards use baseAccessibleWOs so ALL projects remain visible when a project filter is active
    const healthCardProjects = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1).getTime();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();
        const slaHoursMap: Record<string, number> = { 'Immediately': 4, '24h': 24, '1-3d': 72, '3-7d': 168, '7-14d': 336, '14-30d': 720 };
        const now = Date.now();
        const projectAgg: Record<string, { id: string; name: string; cases: any[] }> = {};

        baseAccessibleWOs
            .filter((wo: any) => {
                const created = new Date(wo.createdAt).getTime();
                return created >= startOfMonth && created <= endOfMonth;
            })
            .forEach((wo: any) => {
                const pId = wo.projectId;
                if (!pId) return;
                if (!projectAgg[pId]) projectAgg[pId] = { id: pId, name: getProjectName(pId), cases: [] };
                const woSlaStart = wo.createdAt ? new Date(wo.createdAt).getTime() : now;
                (wo.categories || []).forEach((c: any) => {
                    (c.tasks || []).forEach((t: any) => {
                        const isCompleted = t.dailyProgress === 100 || t.status === 'Completed' || t.status === 'Verified';
                        if (!isCompleted) return;
                        const limit = slaHoursMap[t.slaCategory || '24h'] || 24;
                        const start = t.startDate
                            ? new Date(`${t.startDate.split('T')[0]}T08:00:00`).getTime()
                            : (t.slaStartTime ? new Date(t.slaStartTime).getTime() : woSlaStart);
                        const history = [...(t.history || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        const lastUpdate = history[history.length - 1];
                        const end = lastUpdate ? new Date(lastUpdate.date).getTime() : now;
                        const workHours = history.reduce((acc: number, h: any) => {
                            let hTotal = 0;
                            (h.labor || []).forEach((lab: any) => {
                                let hrs = lab.shifts
                                    ? (lab.shifts.normal ? 8 : 0) + (lab.shifts.otMorning ? 2 : 0) + (lab.shifts.otNoon ? 1 : 0) + (lab.shifts.otEvening ? 3 : 0)
                                    : (lab.timeType === 'Normal' ? 8 : 2);
                                hTotal += hrs * (lab.amount || 1);
                            });
                            return acc + hTotal;
                        }, 0);
                        const calendarHours = (end - start) / 3600000;
                        const duration = Math.max(calendarHours, workHours);
                        const foremanIds = t.responsibleStaffIds || [wo.reporterId].filter(Boolean);
                        const isCurrentUserTask = isAdminOrManager
                            ? true
                            : foremanIds.some((id: string) => id === user?.id || (user?.employeeId && id === user.employeeId));
                        if (!isCurrentUserTask) return;
                        const workDays = new Set(history.map((h: any) => h.date.split('T')[0])).size;
                        projectAgg[pId].cases.push({
                            id: wo.id.slice(-6), fullId: wo.id,
                            label: `${wo.id.slice(-6)} · ${(t.name || c.name || '').slice(0, 12)}`,
                            total: duration, calendarDays: calendarHours / 24, targetDays: limit / 24,
                            workDays, ratio: duration / limit * 100, deviation: 100 - (duration / limit * 100),
                        });
                    });
                });
            });

        return Object.values(projectAgg).filter((p: any) => p.cases.length > 0);
    }, [baseAccessibleWOs, selectedMonth, getProjectName, isAdminOrManager, user]);

    const projectTrend = useMemo(() => {
        const SLA_MAP: Record<string, number> = { 'Immediately': 4, '24h': 24, '1-3d': 72, '3-7d': 168, '7-14d': 336, '14-30d': 720 };
        const [selYear, selMonth] = selectedMonth.split('-').map(Number);
        const months: string[] = [];
        for (let i = 3; i >= 0; i--) {
            let m = selMonth - i; let y = selYear;
            while (m <= 0) { m += 12; y--; }
            months.push(`${y}-${String(m).padStart(2, '0')}`);
        }
        const byMonth: Record<string, Record<string, { met: number; total: number }>> = {};
        months.forEach(m => { byMonth[m] = {}; });

        allAccessibleWOs.forEach((wo: any) => {
            const pId = wo.projectId || 'unknown';
            const woStart = wo.createdAt ? new Date(wo.createdAt).getTime() : Date.now();
            (wo.categories || []).forEach((c: any) => {
                (c.tasks || []).forEach((t: any) => {
                    const foremanIds: string[] = t.responsibleStaffIds || [wo.reporterId].filter(Boolean);
                    const isMyTask = isAdminOrManager || foremanIds.some((id: string) => id === user?.id || (user?.employeeId && id === user.employeeId));
                    if (!isMyTask) return;
                    const tStatusLower = (t.status || '').toLowerCase();
                    const isDone = tStatusLower === 'completed' || tStatusLower === 'verified';
                    const isWaiting = tStatusLower === 'completed' && t.evaluationStatus === 'Assigned';
                    if (!isDone || isWaiting) return;
                    const history = [...(t.history || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const last = history[history.length - 1];
                    if (!last) return;
                    const endMs = new Date(last.date).getTime();
                    const taskMonth = `${new Date(endMs).getFullYear()}-${String(new Date(endMs).getMonth() + 1).padStart(2, '0')}`;
                    if (!byMonth[taskMonth]) return;
                    const limit = SLA_MAP[t.slaCategory || '24h'] || 24;
                    const startMs = t.startDate
                        ? new Date(`${t.startDate.split('T')[0]}T08:00:00`).getTime()
                        : (t.slaStartTime ? new Date(t.slaStartTime).getTime() : woStart);
                    const calHours = (endMs - startMs) / 3600000;
                    const isSlaMet = calHours <= limit;
                    if (!byMonth[taskMonth][pId]) byMonth[taskMonth][pId] = { met: 0, total: 0 };
                    byMonth[taskMonth][pId].total++;
                    if (isSlaMet) byMonth[taskMonth][pId].met++;
                });
            });
        });

        const trend: Record<string, number[]> = {};
        months.forEach((m, idx) => {
            Object.entries(byMonth[m]).forEach(([pId]) => {
                if (!trend[pId]) trend[pId] = Array(months.length).fill(-1);
            });
            Object.keys(trend).forEach(pId => {
                const d = byMonth[m][pId];
                trend[pId][idx] = d ? (d.total > 0 ? Math.round(d.met / d.total * 100) : -1) : trend[pId][idx];
            });
        });
        return { months, trend };
    }, [selectedMonth, allAccessibleWOs, isAdminOrManager, user]);

    // Auto-select category based on data — re-runs when urgentTasks changes, respects manual selection
    useEffect(() => {
        if (userHasManuallySelected.current) return;
        if (allAccessibleWOs.length === 0) return;

        if ((stats.urgentTasks || []).length > 0) {
            setSelectedOpCategory('urgent');
            return;
        }
        const hasInProgress = allAccessibleWOs.some((wo: any) =>
            !isWorkOrderCompleted(wo) && ['In Progress', 'Approved', 'Partially Approved', 'Rejected'].includes(wo.status)
        );
        if (hasInProgress) { setSelectedOpCategory('inProgress'); return; }
        if ((stats.evaluating || 0) > 0) { setSelectedOpCategory('evaluating'); return; }
        setSelectedOpCategory('urgent'); // all empty → show urgent (ไม่มีงาน)
    }, [(stats.urgentTasks || []).length, allAccessibleWOs.length, stats.evaluating]);

    const maxDevRaw = stats.laborByProject.length > 0 ? Math.max(100, ...stats.laborByProject.map((p: any) => Math.abs(p.deviation))) : 100;
    const maxDev = Math.ceil(maxDevRaw / 50) * 50;
    const devTicks = [-maxDev, -maxDev / 2, 0, maxDev / 2, maxDev].map((v) => Math.round(v));

    const handleLaborDetailClick = (projectId: string, dateStr: string) => {
        const project = projects.find((p: any) => p.id === projectId);
        if (!project || !dateStr) return;
        const _matchUid = (id: string) => id === user?.id || (user?.employeeId && id === user?.employeeId);
        const _viewingForeman = isAdminOrManager ? selectedForemanId : null;
        const woGroups: any[] = [];
        const projectWOs = workOrders.filter((wo: any) => wo.projectId === projectId);
        projectWOs.forEach((wo: any) => {
            const woTasks: any[] = [];
            let woPrevProgressSum = 0, woCurrProgressSum = 0, totalTasksInWO = 0;
            let hasActivityToday = false;
            wo.categories?.forEach((cat: any) => {
                cat.tasks.forEach((task: any) => {
                    const _owners: string[] = task.responsibleStaffIds || [];
                    const _isOwner = _viewingForeman
                        ? _owners.includes(_viewingForeman) || (!_owners.length && wo.reporterId === _viewingForeman)
                        : _owners.some((id: string) => _matchUid(id)) || (!_owners.length && _matchUid(wo.reporterId || ''));
                    if (!_isOwner) return;
                    totalTasksInWO++;
                    const history = task.history || [];
                    const todayLog = history.find((h: any) => h.date.startsWith(dateStr));
                    const logTodayOrBefore = history.filter((h: any) => h.date.split('T')[0] <= dateStr).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    const currProg = logTodayOrBefore.length > 0 ? logTodayOrBefore[0].progress : 0;
                    woCurrProgressSum += currProg;
                    const logBeforeToday = history.filter((h: any) => h.date.split('T')[0] < dateStr).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    const prevProg = logBeforeToday.length > 0 ? logBeforeToday[0].progress : 0;
                    woPrevProgressSum += prevProg;
                    if (todayLog) {
                        hasActivityToday = true;
                        const taskLabor = (todayLog.labor || []).map((lab: any) => {
                            const n = lab.shifts?.normal ? 8 : 0;
                            const om = lab.shifts?.otMorning ? 2 : 0;
                            const on = lab.shifts?.otNoon ? 1 : 0;
                            const oe = lab.shifts?.otEvening ? 3 : 0;
                            const h = n + om + on + oe;
                            return { ...lab, totalHours: h * (lab.amount || 1), normalHours: n * (lab.amount || 1), otHours: (om + on + oe) * (lab.amount || 1) };
                        });
                        woTasks.push({ taskName: task.name, prevProgress: prevProg, currentProgress: todayLog.progress, delta: todayLog.progress - prevProg, note: todayLog.note, type: todayLog.type, labor: taskLabor });
                    }
                });
            });
            if (hasActivityToday) {
                const woPrevAvg = totalTasksInWO > 0 ? Math.round(woPrevProgressSum / totalTasksInWO) : 0;
                const woCurrAvg = totalTasksInWO > 0 ? Math.round(woCurrProgressSum / totalTasksInWO) : 0;
                woGroups.push({ woId: wo.id, prevOverall: woPrevAvg, currOverall: woCurrAvg, delta: woCurrAvg - woPrevAvg, tasks: woTasks, totalTasks: totalTasksInWO });
            }
        });
        setSelectedLaborDetail({ projectName: (project as any).name, date: dateStr, woGroups });
    };

    const categoryData = useMemo(() => {
        const counts: any = {};
        filteredData.forEach((wo: any) => {
            (wo.categories || []).forEach((c: any) => { counts[c.name] = (counts[c.name] || 0) + 1; });
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a: any, b: any) => b.value - a.value).slice(0, 5);
    }, [filteredData]);

    const [catSort, setCatSort] = useState<'count' | 'fast' | 'rev'>('count');

    const smartCategoryData = useMemo(() => {
        const map: Record<string, { count: number; totalDays: number; completedCount: number; totalRev: number }> = {};
        filteredData.forEach((wo: any) => {
            (wo.categories || []).forEach((c: any) => {
                const name = c.name || 'ไม่ระบุ';
                (c.tasks || []).forEach((t: any) => {
                    const tResp = t.responsibleStaffIds || [wo.reporterId].filter(Boolean);
                    const isMine = isAdminOrManager || tResp.some((id: string) => id === user?.id || (user?.employeeId && id === user.employeeId));
                    if (!isMine) return;
                    const isWaitingEval = t.status === 'Completed' && t.evaluationStatus === 'Assigned';
                    const isDone = !isWaitingEval && (t.status === 'Completed' || t.status === 'Verified' || t.dailyProgress === 100);
                    if (!isDone) return;
                    if (!map[name]) map[name] = { count: 0, totalDays: 0, completedCount: 0, totalRev: 0 };
                    map[name].count++;
                    const revCount = t.currentRevision ? parseInt(String(t.currentRevision).replace(/[^0-9]/g, '')) || 0 : 0;
                    map[name].totalRev += revCount;
                    const history = t.history || [];
                    // ใช้ logic เดียวกับ Task Performance Details table (expectedHours)
                    const totalLaborHrs = history.reduce((sum: number, h: any) =>
                        sum + (h.labor || []).reduce((s: number, l: any) => {
                            const eh = l.expectedHours || {};
                            return s + (eh.normal || 0) + (eh.otNoon || 0) + (eh.otEvening || 0) + (eh.otMorning || 0);
                        }, 0), 0);
                    const workDays = totalLaborHrs >= 8 ? Math.round(totalLaborHrs / 8) : (totalLaborHrs > 0 ? 1 : 0);
                    if (workDays > 0) {
                        map[name].totalDays += workDays;
                        map[name].completedCount++;
                    }
                });
            });
        });
        const arr = Object.entries(map).map(([name, d]) => ({
            name,
            count: d.count,
            avgDays: d.completedCount > 0 ? +(d.totalDays / d.completedCount).toFixed(1) : null,
            totalRev: d.totalRev,
            avgRev: d.count > 0 ? +(d.totalRev / d.count).toFixed(1) : 0,
        }));
        if (catSort === 'count') return arr.sort((a, b) => b.count - a.count).slice(0, 6);
        if (catSort === 'fast') return arr.filter(x => x.avgDays !== null).sort((a: any, b: any) => a.avgDays - b.avgDays).slice(0, 6);
        return arr.sort((a, b) => b.avgRev - a.avgRev).slice(0, 6);
    }, [filteredData, catSort, isAdminOrManager, user]);


    const timelineData = useMemo(() => {
        const [year, monthNum] = selectedMonth.split('-').map(Number);
        let startDay = 1;
        let endDay = new Date(year, monthNum, 0).getDate();
        if (selectedWeek > 0) {
            startDay = (selectedWeek - 1) * 7 + 1;
            if (selectedWeek < 4) endDay = startDay + 6;
            else if (selectedWeek === 4) endDay = 28;
        }
        const dataPoints = [];
        for (let d = startDay; d <= endDay; d++) {
            const dateStr = `${year}-${monthNum.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            
            let openedTasksCount = 0;
            let closedTasksCount = 0;
            let isRelatedDay = false;

            allAccessibleWOs.forEach((wo: any) => {
                let woCreatedDate = '';
                if (wo.createdAt) {
                    const parsed = new Date(wo.createdAt);
                    if (!isNaN(parsed.getTime())) {
                        woCreatedDate = parsed.toISOString().split('T')[0];
                    }
                }
                const isWOCreatedToday = woCreatedDate === dateStr;
                const isTargetWO = wo.id?.toString().trim() === highlightedWOId?.toString().trim();

                (wo.categories || []).forEach((c: any) => {
                    (c.tasks || []).forEach((t: any) => {
                        // Task "opened" when WO is created
                        if (isWOCreatedToday) {
                            openedTasksCount++;
                            if (isTargetWO) isRelatedDay = true;
                        }

                        // Task "closed" when it reaches 100% progress
                        const history = t.history || [];
                        const completionUpdate = history.find((h: any) => h.progress === 100 && h.date.startsWith(dateStr));
                        if (completionUpdate) {
                            closedTasksCount++;
                            if (isTargetWO) isRelatedDay = true;
                        }
                    });
                });
            });

            dataPoints.push({ 
                day: d, 
                name: `${String(d).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}`, 
                openedCount: openedTasksCount, 
                closedCount: closedTasksCount,
                isHighlighted: isRelatedDay 
            });
        }
        return dataPoints;
    }, [allAccessibleWOs, selectedMonth, selectedWeek, highlightedWOId]);

    const sCurveData = useMemo(() => {
        const [year, monthNum] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const mkSkeleton = () => Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, manpower: null as any, slaOk: null as any, slaRisk: null as any, slaBreach: null as any, hasHighlight: false }));
        if (!selectedSCurveProject || !selectedMonth || allAccessibleWOs.length === 0) return mkSkeleton();
        const startOfMonthTime = new Date(year, monthNum - 1, 1).getTime();
        const endOfMonthTime = new Date(year, monthNum, 0, 23, 59, 59).getTime();

        const dataArr = [];
        const projectWOs = allAccessibleWOs.filter((wo: any) =>
            wo.status !== 'Cancelled' &&
            !wo.isArchived &&
            new Date(wo.createdAt).getTime() <= endOfMonthTime &&
            (!wo.completedAt || new Date(wo.completedAt).getTime() >= startOfMonthTime)
        );

        if (projectWOs.length === 0) return mkSkeleton();

        const slaHours: Record<string, number> = { 'Immediately': 4, '24h': 24, '1-3d': 72, '3-7d': 168, '7-14d': 336, '14-30d': 720 };
        const matchesUid = (id: string) => id === user?.id || (user?.employeeId && id === user?.employeeId);
        const viewingForeman = isAdminOrManager ? selectedForemanId : null;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${monthNum.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            const endOfDayTime = new Date(year, monthNum - 1, d, 23, 59, 59).getTime();
            let dailyLabor = 0, slaOk = 0, slaRisk = 0, slaBreach = 0, hasHighlightActivity = false;
            const taskDetails: any[] = [];
            projectWOs.forEach((wo: any) => {
                const woStart = wo.createdAt ? new Date(wo.createdAt).getTime() : endOfDayTime;
                (wo.categories || []).forEach((cat: any) => {
                    cat.tasks.forEach((task: any) => {
                        if (task.status === 'Cancelled' || task.status === 'Rejected') return;
                        const taskOwners: string[] = task.responsibleStaffIds || [];
                        const isUserTask = viewingForeman
                            ? taskOwners.includes(viewingForeman) || (!taskOwners.length && wo.reporterId === viewingForeman)
                            : taskOwners.some((id: string) => matchesUid(id)) || (!taskOwners.length && matchesUid(wo.reporterId || ''));
                        if (!isUserTask) return;
                        const history = task.history || [];
                        const logToday = history.find((h: any) => h.date.startsWith(dateStr));
                        if (logToday) {
                            const todayLabor = (logToday.labor || []).reduce((lAcc: number, l: any) => lAcc + (l.amount || 0), 0);
                            dailyLabor += todayLabor;
                            if (wo.id?.toString().trim() === highlightedWOId?.toString().trim()) hasHighlightActivity = true;
                            const prevLog = history
                                .filter((h: any) => new Date(h.date).getTime() < new Date(year, monthNum - 1, d).getTime())
                                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                            const progFrom = prevLog?.progress ?? 0;
                            const progTo = logToday.progress ?? progFrom;
                            const tLimit = slaHours[task.slaCategory || '24h'] || 24;
                            const tStart = task.startDate
                                ? new Date(`${task.startDate.split('T')[0]}T08:00:00`).getTime()
                                : (task.slaStartTime ? new Date(task.slaStartTime).getTime() : woStart);
                            let slaStatus: 'ok' | 'risk' | 'breach' = 'ok';
                            if (tStart <= endOfDayTime) {
                                const elapsed = (endOfDayTime - tStart) / 3600000;
                                if (elapsed > tLimit) slaStatus = 'breach';
                                else if (elapsed > tLimit * 0.7) slaStatus = 'risk';
                            }
                            if (todayLabor > 0) taskDetails.push({ taskName: task.name || '—', woName: wo.locationName || `#${wo.id}`, progFrom, progTo, slaStatus, labor: todayLabor });
                        }
                        const latestLogByDay = history
                            .filter((h: any) => new Date(h.date).getTime() <= endOfDayTime)
                            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                        const isDoneByDay = (latestLogByDay?.progress ?? 0) >= 100;
                        if (isDoneByDay) return;
                        const limit = slaHours[task.slaCategory || '24h'] || 24;
                        const start = task.startDate
                            ? new Date(`${task.startDate.split('T')[0]}T08:00:00`).getTime()
                            : (task.slaStartTime ? new Date(task.slaStartTime).getTime() : woStart);
                        if (start > endOfDayTime) return;
                        const elapsedHours = (endOfDayTime - start) / 3600000;
                        if (elapsedHours > limit) slaBreach++;
                        else if (elapsedHours > limit * 0.7) slaRisk++;
                        else slaOk++;
                    });
                });
            });
            const sortedDetails = [...taskDetails].sort((a, b) => { const o: any = {ok:0,risk:1,breach:2}; return o[a.slaStatus]-o[b.slaStatus]; });
            dataArr.push({ day: d, manpower: dailyLabor, totalWorkedTasks: dailyLabor > 0 ? sortedDetails.length : null, slaOk: dailyLabor > 0 ? slaOk : null, slaRisk: dailyLabor > 0 ? slaRisk : null, slaBreach: dailyLabor > 0 ? slaBreach : null, hasHighlight: hasHighlightActivity, taskDetails: dailyLabor > 0 ? sortedDetails : [] });
        }
        return dataArr;
    }, [allAccessibleWOs, selectedSCurveProject, selectedMonth, highlightedWOId, user, isAdminOrManager, selectedForemanId]);

    if (loading || !user) return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '1rem', color: '#64748b' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>กำลังเตรียมข้อมูลแดชบอร์ด...</div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );

    const ProgressDonutChart = ({ allWOs, currentUser }: { allWOs: any[]; currentUser: any }) => {
        const [activeIdx, setActiveIdx] = useState<number | null>(null);
        const isMyT = (t: any) => t.subtaskOperatorId && (t.subtaskOperatorId === currentUser?.id || t.subtaskOperatorId === currentUser?.employeeId);
        const allMySubtasks = allWOs.flatMap((wo: any) =>
            (wo.categories || []).flatMap((cat: any) => {
                const catTasks: any[] = cat.tasks || [];
                const myCat = catTasks.filter(isMyT);
                return myCat.length > 0 ? myCat : (catTasks.some((t: any) => t.subtaskOperatorId) ? [] : catTasks);
            })
        );
        const getProg = (t: any) => t.dailyProgress ?? t.progress ?? (['Completed', 'Verified'].includes(t.status) ? 100 : 0);
        const donutData = [
            { key: 'notStarted', name: 'ยังไม่เริ่ม', value: allMySubtasks.filter((t: any) => getProg(t) === 0 && !['Completed', 'Verified'].includes(t.status)).length, color: '#E24B4A', range: '0%' },
            { key: 'inProgress', name: 'กำลังทำ', value: allMySubtasks.filter((t: any) => { const p = getProg(t); return p >= 1 && p <= 70; }).length, color: '#378ADD', range: '1–70%' },
            { key: 'nearDone', name: 'ใกล้เสร็จ', value: allMySubtasks.filter((t: any) => { const p = getProg(t); return p >= 71 && p < 100; }).length, color: '#1D9E75', range: '71–99%' },
        ];
        const pending = donutData.reduce((s, d) => s + d.value, 0);
        const active = activeIdx !== null ? donutData[activeIdx] : null;
        const pct = (v: number) => pending > 0 ? Math.round(v / pending * 100) : 0;
        const handleSliceClick = (_: any, idx: number) => {
            const key = donutData[idx].key;
            setDonutFilter(prev => prev === key ? null : key);
            setSelectedOpCategory('inProgress');
            opListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
            if (percent < 0.06) return null;
            const RADIAN = Math.PI / 180;
            const r = innerRadius + (outerRadius - innerRadius) * 0.5;
            const x = cx + r * Math.cos(-midAngle * RADIAN);
            const y = cy + r * Math.sin(-midAngle * RADIAN);
            return (
                <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '11px', fontWeight: 700, pointerEvents: 'none' }}>
                    {`${Math.round(percent * 100)}%`}
                </text>
            );
        };
        const activeFilter = donutData.find(d => d.key === donutFilter);
        return (
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', alignItems: 'center', flex: 1 }}>
                {/* donut left */}
                <div style={{ position: 'relative', width: isMobile ? '210px' : '270px', height: isMobile ? '210px' : '270px', flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={isMobile ? 58 : 82} outerRadius={isMobile ? 92 : 128} paddingAngle={3} dataKey="value"
                                label={renderLabel} labelLine={false}
                                onMouseEnter={(_: any, i: number) => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)}
                                onClick={handleSliceClick} strokeWidth={0} style={{ cursor: 'pointer' }}>
                                {donutData.map((d, i) => (
                                    <Cell key={i} fill={d.color} opacity={donutFilter ? (donutFilter === d.key ? 1 : 0.2) : (activeIdx === null || activeIdx === i ? 1 : 0.3)} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: scaleFont(isMobile, '2.6rem'), fontWeight: 800, color: active ? active.color : '#0f172a', lineHeight: 1 }}>{active ? active.value : pending}</div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px', whiteSpace: 'nowrap', fontWeight: 600 }}>{active ? active.name : 'งานค้างอยู่'}</div>
                    </div>
                </div>

                {/* right: stat list */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* filter chip */}
                    {activeFilter && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <span style={{ background: activeFilter.color + '18', color: activeFilter.color, padding: '2px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${activeFilter.color}44` }}>
                                กรอง: {activeFilter.name}
                            </span>
                            <span style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '0.68rem', fontWeight: 600 }} onClick={() => setDonutFilter(null)}>✕</span>
                        </div>
                    )}

                    {donutData.map((d, i) => {
                        const isSelected = donutFilter === d.key;
                        const isHovered = activeIdx === i;
                        return (
                            <div key={i} onClick={() => handleSliceClick(null, i)}
                                onMouseEnter={() => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)}
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '14px', background: isSelected ? d.color + '12' : isHovered ? '#f8fafc' : 'transparent', border: `1px solid ${isSelected ? d.color + '44' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.15s', opacity: donutFilter && !isSelected ? 0.4 : 1 }}>
                                <div style={{ width: '4px', height: '44px', borderRadius: '4px', background: d.color, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>{d.name}</span>
                                            <span style={{ fontSize: '0.62rem', color: '#94a3b8', marginLeft: '5px' }}>{d.range}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: d.color, lineHeight: 1 }}>{d.value}</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: d.color + 'bb' }}>{pct(d.value)}%</span>
                                        </div>
                                    </div>
                                    <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${pct(d.value)}%`, height: '100%', background: d.color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div style={{ marginTop: '4px', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>รวมงานค้าง</span>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#374151' }}>{pending} รายการ</span>
                    </div>
                </div>
            </div>
        );
    };

    const WorkloadTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const displayPayload = hoveredBarKey
                ? payload.filter((entry: any) => entry.dataKey === hoveredBarKey)
                : payload;

            if (displayPayload.length === 0) return null;

            return (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.98)',
                    padding: '1.25rem',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(8px)',
                    minWidth: isMobile ? 0 : '240px'
                }}>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 900, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart3 size={16} color="#4f46e5" /> {label}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {displayPayload.map((entry: any, index: number) => {
                            const isProgress = entry.dataKey === 'inProgress';
                            const jobs = isProgress ? data.inProgressJobs : entry.dataKey === 'completed' ? data.completedJobs : data.evaluatingJobs;

                            return (
                                <div key={`tooltip-row-${index}`} style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: entry.color, fontWeight: 800, fontSize: '0.85rem' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }} />
                                            {entry.name}
                                        </div>
                                        <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#1e293b' }}>{entry.value} งาน</div>
                                    </div>

                                    {jobs && jobs.length > 0 && (
                                        <div style={{
                                            marginTop: '6px',
                                            paddingLeft: '16px',
                                            borderLeft: `2px solid ${entry.color}40`,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px'
                                        }}>
                                            {jobs.slice(0, 5).map((job: any, jIdx: number) => (
                                                <div key={`job-${jIdx}`} style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                                    <span style={{ color: entry.dataKey === 'completed' ? '#10b981' : entry.dataKey === 'inProgress' ? '#0ea5e9' : '#eab308', fontWeight: 800 }}>#{job.id}</span> • {job.name}
                                                </div>
                                            ))}
                                            {jobs.length > 5 && (
                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>...และอีก {jobs.length - 5} รายการ</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ width: '100%', margin: 0, paddingBottom: '3rem' }}>
            <style>{`
                .task-row-premium {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    cursor: default;
                }
                .task-row-premium:hover {
                    background: #fdfdfd !important;
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
                    z-index: 10;
                }
                .premium-action-btn {
                    transition: all 0.2s ease;
                }
                .premium-action-btn:hover {
                    background: #4f46e5 !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25) !important;
                    transform: translateY(-1px);
                    border-color: #4f46e5 !important;
                }
                .section-highlight {
                    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1), 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
                    border-color: #4f46e5 !important;
                }
            `}</style>
            {/* Sticky Header */}
            <div style={{ position: isMobile ? 'static' : 'sticky', top: isMobile ? undefined : '-2rem', zIndex: 100, backgroundColor: 'rgba(248, 250, 252, 1)', backdropFilter: 'blur(12px)', paddingTop: '1rem', paddingBottom: '1rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '1rem' : '0', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', borderBottom: '1px solid #e2e8f0', margin: '-2rem -2rem 2.5rem -2rem', paddingLeft: '2rem', paddingRight: '2rem', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                    <div style={{ minWidth: isMobile ? 0 : '400px' }}>
                        <h1 style={{ margin: 0, fontSize: scaleFont(isMobile, '2.5rem'), fontWeight: 900, color: '#0f172a', letterSpacing: '-0.04em', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', padding: '12px', borderRadius: '20px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {viewMode === 'operations' ? <Activity size={32} /> : <BarChart3 size={32} />}
                            </div>
                            <span style={{ minWidth: '150px' }}>{isForeman
                                ? viewMode === 'operations' ? 'ปฏิบัติการ' : 'ผลงาน'
                                : 'ศูนย์สรุปข้อมูลโครงการ'}</span>
                        </h1>
                        <p style={{ margin: '12px 0 0 0', fontSize: '1.1rem', color: '#64748b', fontWeight: 600, minHeight: '3em', display: 'flex', alignItems: 'center' }}>
                            {isForeman
                                ? viewMode === 'operations'
                                    ? `สวัสดีคุณ ${user?.name}, จัดการงานเร่งด่วนและวางแผนงานในมือวันนี้`
                                    : `ตรวจสอบประสิทธิภาพและสรุปผลงานของคุณ ${user?.name}`
                                : 'วิเคราะห์ภาพรวมโครงการ ประสิทธิภาพ SLA และการบริหารจัดการต้นทุน'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : undefined, alignItems: 'flex-start', gap: '12px' }}>
                    {!isAdminOrManager && (
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'row' : 'column',
                        background: '#ffffff',
                        padding: isMobile ? '6px' : '12px 16px',
                        borderRadius: isMobile ? '18px' : '32px',
                        border: '1px solid #e2e8f0',
                        gap: '8px',
                        width: isMobile ? '100%' : '200px',
                        height: isMobile ? 'auto' : '128px',
                        justifyContent: 'center',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    }}>
                            {[{ id: 'operations', label: 'ปฏิบัติการ' }, { id: 'insights', label: 'ผลงาน' }].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => setViewMode(mode.id)}
                                    style={{ width: isMobile ? 'auto' : '100%', flex: isMobile ? 1 : undefined, height: '42px', borderRadius: '16px', border: 'none', background: viewMode === mode.id ? '#4f46e5' : 'transparent', color: viewMode === mode.id ? '#fff' : '#64748b', fontWeight: 900, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: viewMode === mode.id ? '0 10px 15px -3px rgba(79, 70, 229, 0.3)' : 'none' }}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <MasterFilter selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} style={{ height: isMobile ? 'auto' : '128px', padding: isMobile ? '16px' : '24px', width: isMobile ? '100%' : undefined }} />
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: '#ffffff',
                        padding: '14px 18px',
                        borderRadius: '32px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
                        gap: '4px',
                        justifyContent: 'center',
                        width: isMobile ? '100%' : (isAdminOrManager ? '280px' : '260px'),
                        height: 'auto',
                        transition: 'all 0.3s ease',
                        opacity: (isAdminOrManager && adminActiveTab === 'comparison') ? 0.4 : 1,
                        pointerEvents: (isAdminOrManager && adminActiveTab === 'comparison') ? 'none' : 'auto',
                    }}>
                        {/* Clear Data Button (Top) */}
                        <button
                            disabled={!selectedForemanId && !selectedSCurveProject && !highlightedWOId && selectedWeek === 0 && !taskWoTypeFilter}
                            onClick={() => {
                                setSelectedForemanId(null);
                                setSelectedSCurveProject('');
                                setHighlightedWOId(null);
                                setSelectedWeek(0);
                                setTaskWoTypeFilter('');
                                const d = new Date();
                                const currentMonth = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                                setSelectedMonth(currentMonth);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                background: (selectedForemanId || selectedSCurveProject !== '' || highlightedWOId || selectedWeek !== 0) ? '#fef2f2' : '#f8fafc',
                                color: (selectedForemanId || selectedSCurveProject !== '' || highlightedWOId || selectedWeek !== 0) ? '#ef4444' : '#cbd5e1',
                                border: (selectedForemanId || selectedSCurveProject !== '' || highlightedWOId || selectedWeek !== 0) ? '1px solid #fee2e2' : '1px solid #f1f5f9',
                                padding: '6px 12px',
                                fontSize: '0.85rem',
                                fontWeight: 900,
                                borderRadius: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                width: '100%'
                            }}
                        >
                            <X size={16} /> ล้างข้อมูล
                        </button>

                        {isAdminOrManager && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid #e2e8f0', paddingRight: '10px', height: '1.2rem', minWidth: '80px' }}>
                                    <Users size={14} color="#4f46e5" />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', whiteSpace: 'nowrap' }}>โฟร์แมน:</span>
                                </div>
                                <select
                                    value={selectedForemanId || ''}
                                    onChange={(e) => setSelectedForemanId(e.target.value || null)}
                                    style={{ padding: '2px', border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 800, color: selectedForemanId ? '#4f46e5' : '#1e293b', outline: 'none', cursor: 'pointer', flex: 1, width: '100%' }}
                                >
                                    <option value="">เลือกพนักงาน</option>
                                    {activeForemen.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid #e2e8f0', paddingRight: '10px', height: '1.2rem', minWidth: '80px' }}>
                                <Activity size={14} color="#4f46e5" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', whiteSpace: 'nowrap' }}>โครงการ:</span>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <select
                                    value={selectedSCurveProject || ''}
                                    onChange={(e) => setSelectedSCurveProject(e.target.value)}
                                    style={{ padding: '2px', border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 800, color: selectedSCurveProject ? '#4f46e5' : '#1e293b', outline: 'none', cursor: 'pointer', width: '100%', textOverflow: 'ellipsis' }}
                                >
                                    <option value="">ทั้งหมด</option>
                                    {availableProjectsThisMonth.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid #e2e8f0', paddingRight: '10px', height: '1.2rem', minWidth: '80px' }}>
                                <FileText size={14} color="#b45309" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', whiteSpace: 'nowrap' }}>ประเภท:</span>
                            </div>
                            <select
                                value={taskWoTypeFilter}
                                onChange={(e) => setTaskWoTypeFilter(e.target.value)}
                                style={{ padding: '2px', border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: 800, color: taskWoTypeFilter ? '#b45309' : '#1e293b', outline: 'none', cursor: 'pointer', flex: 1 }}
                            >
                                <option value="">ทั้งหมด</option>
                                <option value="woa">หลังขาย (WOA)</option>
                                <option value="wop">ก่อนโอน (WOP)</option>
                            </select>
                        </div>
                    </div>

                    {highlightedWOId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#eef2ff', padding: '8px 16px', borderRadius: '28px', border: '2px solid #4f46e5', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)', height: '50px', alignSelf: 'center' }}>
                            <Zap size={16} color="#4f46e5" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#4f46e5' }}>#{highlightedWOId}</span>
                            <button
                                onClick={() => setHighlightedWOId(null)}
                                style={{ border: 'none', background: '#4f46e5', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {adminActiveTab === 'comparison' ? (
                <DashboardComparison
                    stats={comparisonStats}
                    getProjectName={getProjectName}
                    selectedCategory={selectedComparisonCategory}
                    setSelectedCategory={setSelectedComparisonCategory}
                />
            ) : (
                <>


                    {/* Operations Mode (Foreman) */}
                    {viewMode === 'operations' && !isAdminOrManager ? (
                        <>
                            {/* Stat Cards — all clickable, drill-down to list below */}
                            {(() => {
                                const _isMySubtask = (t: any) => t.subtaskOperatorId && (t.subtaskOperatorId === user?.id || t.subtaskOperatorId === user?.employeeId);
                                const isIncomplete = (t: any) => (t.dailyProgress ?? t.progress ?? 0) < 100 && t.status !== 'Completed' && t.status !== 'Verified';
                                const countTasks = (wos: any[]) => wos.flatMap((wo: any) => (wo.categories || []).flatMap((cat: any) => {
                                    const catTasks: any[] = cat.tasks || [];
                                    const myCat = catTasks.filter(_isMySubtask);
                                    const show = myCat.length > 0 ? myCat : (catTasks.some((t: any) => t.subtaskOperatorId) ? [] : catTasks);
                                    return show.filter(isIncomplete);
                                })).length;
                                const urgentWOIds = new Set((stats.urgentTasks || []).map((wo: any) => String(wo.id)));
                                const urgentSubtaskCount = countTasks(stats.urgentTasks || []);
                                const inProgressCount = countTasks(
                                    allAccessibleWOs.filter((wo: any) =>
                                        !isWorkOrderCompleted(wo) &&
                                        !urgentWOIds.has(String(wo.id)) &&
                                        ['In Progress', 'Approved', 'Partially Approved', 'Pending', 'Rejected'].includes(wo.status) &&
                                        !(wo.status === 'Rejected' && wo.pendingAdminReassign === true)
                                    )
                                );
                                const selectAndScroll = (cat: string) => {
                                    userHasManuallySelected.current = true;
                                    setSelectedOpCategory(cat);
                                    setDonutFilter(null);
                                    setTimeout(() => opListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                                };
                                const activeStyle = (cat: string, color: string, rgb: string) => ({
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                                    border: selectedOpCategory === cat ? `2px solid ${color}` : '1px solid #e2e8f0',
                                    boxShadow: selectedOpCategory === cat ? `0 10px 25px -5px rgba(${rgb},0.3)` : '0 4px 6px -1px rgba(0,0,0,0.05)',
                                    transform: selectedOpCategory === cat ? 'translateY(-6px)' : 'none',
                                });
                                return (
                                    <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, 'repeat(auto-fit, minmax(210px, 1fr))', 'repeat(2, 1fr)'), gap: isMobile ? '12px' : '1.5rem', marginBottom: '2.5rem' }}>
                                        <StatCard
                                            title="เร่งด่วน SLA"
                                            value={urgentSubtaskCount}
                                            icon={<AlertTriangle size={24} />}
                                            color="#ef4444"
                                            gradient={selectedOpCategory === 'urgent' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : undefined}
                                            style={activeStyle('urgent', '#ef4444', '239,68,68')}
                                            onClick={() => selectAndScroll('urgent')}
                                            subtext="งานย่อยที่เลยหรือใกล้ครบกำหนด"
                                        />
                                        <StatCard
                                            title="ปกติ"
                                            value={inProgressCount}
                                            icon={<Zap size={24} />}
                                            color="#0ea5e9"
                                            gradient={selectedOpCategory === 'inProgress' ? 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)' : undefined}
                                            style={activeStyle('inProgress', '#0ea5e9', '14,165,233')}
                                            onClick={() => selectAndScroll('inProgress')}
                                            subtext="งานที่ดำเนินการอยู่ ไม่เร่งด่วน"
                                        />
                                        <StatCard
                                            title="รอแอดมินประเมิน"
                                            value={stats.pendingAdminEval}
                                            icon={<Clock size={24} />}
                                            color="#6366f1"
                                            gradient={selectedOpCategory === 'pendingAdmin' ? 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' : undefined}
                                            style={activeStyle('pendingAdmin', '#6366f1', '99,102,241')}
                                            onClick={() => selectAndScroll('pendingAdmin')}
                                            subtext="ใบงานที่ส่งรอแอดมินอนุมัติ/มอบหมาย"
                                        />
                                        <StatCard
                                            title="รอลูกค้าประเมิน"
                                            value={stats.evaluating}
                                            icon={<Clock size={24} />}
                                            color="#eab308"
                                            gradient={selectedOpCategory === 'evaluating' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined}
                                            style={activeStyle('evaluating', '#f59e0b', '245,158,11')}
                                            onClick={() => selectAndScroll('evaluating')}
                                            subtext="รอลูกค้าตรวจรับงานหน้าไซต์"
                                        />
                                    </div>
                                );
                            })()}

                            {/* Operations Grid - Row 1 */}
                            <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, 'minmax(0, 1.3fr) minmax(0, 1fr)'), gap: '2rem', marginBottom: '2.5rem', alignItems: 'stretch' }}>
                                <div ref={opListRef} id="urgent-section" style={{ background: '#fff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', scrollMarginTop: '80px' }}>
                                    <SectionHeader
                                        title={selectedOpCategory === 'urgent' ? 'รายการดูแลเร่งด่วน SLA' : selectedOpCategory === 'evaluating' ? 'รายการที่รอลูกค้าประเมิน' : selectedOpCategory === 'inProgress' ? 'งานปกติ' : selectedOpCategory === 'pendingAdmin' ? 'ใบงานรอแอดมินประเมิน' : 'ภาพรวมใบงานทั้งหมด'}
                                        icon={selectedOpCategory === 'urgent' ? <AlertTriangle size={20} color="#ef4444" /> : selectedOpCategory === 'evaluating' ? <Clock size={20} color="#f59e0b" /> : selectedOpCategory === 'inProgress' ? <Zap size={20} color="#0ea5e9" /> : selectedOpCategory === 'pendingAdmin' ? <Clock size={20} color="#6366f1" /> : <Activity size={20} color="#4f46e5" />}
                                        subtitle={selectedOpCategory === 'urgent' ? 'ใบงานที่ต้องรีบดำเนินการเพื่อรักษามาตรฐาน SLA — คลิกเพื่อบันทึกรายงาน' : selectedOpCategory === 'evaluating' ? 'ใบงานที่รอลูกค้าตรวจรับงานหน้าไซต์ — คลิกเพื่อติดตามสถานะ' : selectedOpCategory === 'inProgress' ? 'งานที่กำลังดำเนินการอยู่และยังไม่ถึงกำหนด SLA — คลิกเพื่อบันทึกรายงานประจำวัน' : selectedOpCategory === 'pendingAdmin' ? 'ใบงานที่ส่งไปรอแอดมินอนุมัติ/มอบหมายงาน — คลิกเพื่อดูรายละเอียด' : 'ใบงานที่ยังไม่ปิดจบ เรียงตามความเร่งด่วน SLA'}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '1rem', maxHeight: '510px', overflowY: 'auto', paddingRight: '8px' }}>
                                        {(() => {
                                            const isMySubtask = (t: any) => t.subtaskOperatorId && (t.subtaskOperatorId === user?.id || t.subtaskOperatorId === user?.employeeId);

                                            const SubtaskCard = ({ task, wo, categoryName, sla, isEval = false }: any) => {
                                                const prog = task.dailyProgress ?? task.progress ?? (['Completed', 'Verified'].includes(task.status) ? 100 : 0);
                                                const name = task.name || task.taskName || task.subtaskName || task.description || '—';
                                                const rawId = task.subtaskId || task.id || '';
                                                const shortId = rawId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
                                                const isDone = prog >= 100 || task.status === 'Completed' || task.status === 'Verified';
                                                const progColor = prog >= 80 ? '#10b981' : prog >= 40 ? '#0ea5e9' : '#f59e0b';
                                                const revNum = task.currentRevision ? parseInt(task.currentRevision.replace('rev', '')) : null;
                                                const bg = isDone ? '#f0fdf4' : '#f0f9ff';
                                                const borderColor = isDone ? '#bbf7d0' : '#bae6fd';
                                                const navTarget = isEval ? `/work-orders?id=${wo.id}` : `/daily-report?id=${wo.id}`;
                                                const btnLabel = isEval ? '🔍 ติดตามสถานะ' : isDone ? '✅ งานเสร็จแล้ว' : '📝 บันทึกรายงาน';
                                                const btnColor = isDone ? '#059669' : '#075985';
                                                return (
                                                    <div onClick={() => navigate(navTarget)} style={{ padding: '1rem 1.25rem', background: bg, borderRadius: '20px', border: `1px solid ${borderColor}`, cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                        onMouseOver={(e) => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateX(0)')}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{shortId}</span>
                                                                    {isEval && revNum !== null && revNum > 0 && <span style={{ fontSize: '0.62rem', fontWeight: 900, padding: '1px 7px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '5px', color: '#b91c1c', whiteSpace: 'nowrap' }}>REV. {revNum}</span>}
                                                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 7px', background: isDone ? 'rgba(16,185,129,0.1)' : 'rgba(14,165,233,0.1)', border: `1px solid ${isDone ? '#a7f3d0' : '#bae6fd'}`, borderRadius: '5px', color: isDone ? '#059669' : '#0369a1', whiteSpace: 'nowrap' }}>{categoryName}</span>
                                                                </div>
                                                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                                                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>📍 {wo.locationName} · 🏗️ {getProjectName(wo.projectId)}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                                                {sla && <span style={{ fontSize: '0.68rem', fontWeight: 800, color: sla.level === 'critical' ? '#b91c1c' : '#d97706', background: sla.level === 'critical' ? '#fee2e2' : '#fef3c7', padding: '2px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}>{sla.text}</span>}
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 900, color: isDone ? '#059669' : progColor }}>{prog}%</span>
                                                            </div>
                                                        </div>
                                                        {!isDone && (
                                                            <div style={{ marginTop: '8px' }}>
                                                                <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                                                                    <div style={{ width: `${prog}%`, height: '100%', background: progColor, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                                                </div>
                                                            </div>
                                                        )}
                                                        <button onClick={(e) => { e.stopPropagation(); navigate(navTarget); }} style={{ width: '100%', marginTop: '10px', padding: '6px', background: 'rgba(0,0,0,0.03)', border: `1px solid ${borderColor}`, borderRadius: '10px', color: btnColor, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
                                                            {btnLabel}
                                                        </button>
                                                    </div>
                                                );
                                            };

                                            const WOCard = ({ wo, bg, border, idColor, actionLabel, actionNav, statusBadge }: any) => {
                                                const allSubtasks = wo.categories?.flatMap((c: any) => c.tasks || []) || [];
                                                const mySubtasks = allSubtasks.filter(isMySubtask);
                                                const relevantTasks = mySubtasks.length > 0 ? mySubtasks : allSubtasks;
                                                const getAvgProg = (tasks: any[]) => tasks.length > 0 ? Math.round(tasks.reduce((s: number, t: any) => s + (t.dailyProgress ?? t.progress ?? (['Completed', 'Verified'].includes(t.status) ? 100 : 0)), 0) / tasks.length) : null;
                                                const prog = getAvgProg(relevantTasks);
                                                const overallProg = mySubtasks.length > 0 && mySubtasks.length < allSubtasks.length ? getAvgProg(allSubtasks) : null;
                                                return (
                                                    <div onClick={() => navigate(actionNav)} style={{ padding: '1.25rem 1.5rem', background: bg, borderRadius: '24px', border: `1px solid ${border}`, cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseOver={(e) => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateX(0)')}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: prog !== null || statusBadge ? '10px' : '0' }}>
                                                            <div>
                                                                <div style={{ fontWeight: 900, color: idColor, fontSize: '1.05rem', marginBottom: '2px' }}>#{wo.id?.slice(-6)}</div>
                                                                <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 700 }}>{wo.locationName}</div>
                                                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>🏗️ {getProjectName(wo.projectId)}</div>
                                                                {wo.categories && wo.categories.length > 0 && (
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '7px' }}>
                                                                        {wo.categories.slice(0, 4).map((cat: any, i: number) => {
                                                                            const catMyTasks = mySubtasks.length > 0 ? cat.tasks?.filter((t: any) => isMySubtask(t)) : cat.tasks;
                                                                            const total = catMyTasks?.length || 0;
                                                                            if (total === 0) return null;
                                                                            const pending = catMyTasks?.filter((t: any) => (t.dailyProgress ?? t.progress ?? 0) < 100 && t.status !== 'Rejected').length || 0;
                                                                            return (
                                                                                <span key={i} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', background: pending > 0 ? 'rgba(14,165,233,0.1)' : 'rgba(16,185,129,0.08)', border: `1px solid ${pending > 0 ? '#bae6fd' : '#a7f3d0'}`, borderRadius: '6px', color: pending > 0 ? '#0369a1' : '#059669', whiteSpace: 'nowrap' }}>
                                                                                    {cat.name}{pending > 0 ? ` ·${pending}` : ' ✓'}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                        {wo.categories.length > 4 && (
                                                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', background: 'rgba(0,0,0,0.04)', borderRadius: '6px', color: '#94a3b8' }}>+{wo.categories.length - 4}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {statusBadge}
                                                        </div>
                                                        {prog !== null && (
                                                            <div style={{ marginBottom: '10px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                                                                    <span>{mySubtasks.length > 0 ? `งานของฉัน · ${mySubtasks.length} งานย่อย` : `รวม · ${allSubtasks.length} งานย่อย`}</span>
                                                                    <span style={{ color: prog >= 80 ? '#059669' : prog >= 40 ? '#0369a1' : '#d97706' }}>{prog}%</span>
                                                                </div>
                                                                <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '6px', overflow: 'hidden', marginBottom: overallProg !== null ? '6px' : '0' }}>
                                                                    <div style={{ width: `${prog}%`, height: '100%', background: prog >= 80 ? '#10b981' : prog >= 40 ? '#0ea5e9' : '#f59e0b', borderRadius: '6px', transition: 'width 0.5s ease' }} />
                                                                </div>
                                                                {overallProg !== null && (
                                                                    <div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94a3b8', fontWeight: 500, marginBottom: '3px' }}>
                                                                            <span>รวมทั้ง WO · {allSubtasks.length} งานย่อย</span>
                                                                            <span>{overallProg}%</span>
                                                                        </div>
                                                                        <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '3px', overflow: 'hidden' }}>
                                                                            <div style={{ width: `${overallProg}%`, height: '100%', background: '#cbd5e1', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        <button onClick={(e) => { e.stopPropagation(); navigate(actionNav); }} style={{ width: '100%', padding: '7px', background: 'rgba(0,0,0,0.04)', border: `1px solid ${border}`, borderRadius: '12px', color: idColor, fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                                                            {actionLabel}
                                                        </button>
                                                    </div>
                                                );
                                            };

                                            if (selectedOpCategory === 'urgent') {
                                                const urgentWOs = stats.urgentTasks || [];
                                                const urgentFlat: any[] = urgentWOs.flatMap((wo: any) => {
                                                    const sla = wo.statusInfo || getSLATimeStatus(wo);
                                                    return (wo.categories || []).flatMap((cat: any) => {
                                                        const catTasks: any[] = cat.tasks || [];
                                                        const myCat = catTasks.filter(isMySubtask);
                                                        const show = myCat.length > 0 ? myCat : (catTasks.some((t: any) => t.subtaskOperatorId) ? [] : catTasks);
                                                        return show
                                                            .filter((t: any) => (t.dailyProgress ?? t.progress ?? 0) < 100 && t.status !== 'Completed' && t.status !== 'Verified')
                                                            .map((t: any) => ({ task: t, wo, categoryName: cat.name, sla }));
                                                    });
                                                });
                                                if (urgentFlat.length === 0) return <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>ไม่มีงานด่วนคงค้างในขณะนี้ 🎉</div>;
                                                return urgentFlat.map((item: any, idx: number) => (
                                                    <SubtaskCard key={`urg-${idx}`} task={item.task} wo={item.wo} categoryName={item.categoryName} sla={item.sla} />
                                                ));
                                            } else if (selectedOpCategory === 'evaluating') {
                                                const isForCustomerEvalLocal = (wo: any) => {
                                                    if (['Completed', 'Verified'].includes(wo.status)) return false;
                                                    if (wo.status === 'pending_delivery') return true;
                                                    const allTasks = (wo.categories || []).flatMap((c: any) => c.tasks || []);
                                                    return allTasks.length > 0 && allTasks.every((t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100);
                                                };
                                                const evalWOs = allAccessibleWOs.filter(isForCustomerEvalLocal);
                                                const evalFlat = evalWOs.flatMap((wo: any) =>
                                                    (wo.categories || []).flatMap((cat: any) => {
                                                        const catTasks = cat.tasks || [];
                                                        const myCat = catTasks.filter(isMySubtask);
                                                        const show = myCat.length > 0 ? myCat : (catTasks.some((t: any) => t.subtaskOperatorId) ? [] : catTasks);
                                                        return show.map((t: any) => ({ task: t, wo, categoryName: cat.name }));
                                                    })
                                                );
                                                return evalFlat.length > 0 ? evalFlat.map((item: any, idx: number) => (
                                                    <SubtaskCard key={`eval-${idx}`} task={item.task} wo={item.wo} categoryName={item.categoryName} sla={null} isEval={true} />
                                                )) : <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>ไม่มีงานรอประเมิน ขอบคุณที่เคลียร์งานครับ! 👍</div>;
                                            } else if (selectedOpCategory === 'inProgress') {
                                                const _urgentWOIds = new Set((stats.urgentTasks || []).map((wo: any) => String(wo.id)));
                                                const activeWOs = allAccessibleWOs.filter((wo: any) => !isWorkOrderCompleted(wo) && !_urgentWOIds.has(String(wo.id)) && ['In Progress', 'Approved', 'Partially Approved', 'Pending', 'Rejected'].includes(wo.status) && !(wo.status === 'Rejected' && wo.pendingAdminReassign === true));
                                                const progFilter = (p: number) => {
                                                    if (!donutFilter) return p < 100;
                                                    if (donutFilter === 'notStarted') return p === 0;
                                                    if (donutFilter === 'inProgress') return p >= 1 && p <= 70;
                                                    if (donutFilter === 'nearDone') return p >= 71 && p < 100;
                                                    return p < 100;
                                                };
                                                const flat = activeWOs.flatMap((wo: any) =>
                                                    (wo.categories || []).flatMap((cat: any) => {
                                                        const catTasks = cat.tasks || [];
                                                        const myCatTasks = catTasks.filter(isMySubtask);
                                                        const show = myCatTasks.length > 0 ? myCatTasks : (catTasks.some((t: any) => t.subtaskOperatorId) ? [] : catTasks);
                                                        return show
                                                            .filter((t: any) => progFilter(t.dailyProgress ?? t.progress ?? 0) && t.status !== 'Completed' && t.status !== 'Verified')
                                                            .map((t: any) => ({ task: t, wo, categoryName: cat.name }));
                                                    })
                                                );
                                                const filterLabel = donutFilter ? { notStarted: 'ยังไม่เริ่ม', inProgress: 'กำลังทำ', nearDone: 'ใกล้เสร็จ' }[donutFilter] : null;
                                                return (
                                                    <>
                                                        {filterLabel && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.72rem' }}>
                                                                <span style={{ background: '#f1f5f9', padding: '2px 10px', borderRadius: '8px', color: '#64748b', fontWeight: 700 }}>กรอง: {filterLabel}</span>
                                                                <span style={{ cursor: 'pointer', color: '#94a3b8', fontWeight: 600 }} onClick={() => setDonutFilter(null)}>✕ ล้าง</span>
                                                            </div>
                                                        )}
                                                        {flat.length > 0 ? flat.map((item: any, idx: number) => (
                                                            <SubtaskCard key={`ip-${idx}`} task={item.task} wo={item.wo} categoryName={item.categoryName} sla={getSLATimeStatus(item.wo)} />
                                                        )) : <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>ไม่มีงานย่อยในกลุ่มนี้</div>}
                                                    </>
                                                );
                                            } else if (selectedOpCategory === 'pendingAdmin') {
                                                const pendingWOs = allAccessibleWOs.filter((wo: any) =>
                                                    ['Pending', 'Evaluating'].includes(wo.status) ||
                                                    (wo.status === 'Rejected' && wo.pendingAdminReassign === true)
                                                );
                                                if (pendingWOs.length === 0) return <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>ไม่มีใบงานรอแอดมินในขณะนี้ 🎉</div>;
                                                return pendingWOs.map((wo: any, idx: number) => {
                                                    const statusLabel = wo.status === 'Pending' ? 'รอประเมิน' : wo.status === 'Rejected' ? 'ถูกปฏิเสธ' : 'กำลังประเมิน';
                                                    const statusColor = wo.status === 'Pending' ? '#6366f1' : wo.status === 'Rejected' ? '#dc2626' : '#8b5cf6';
                                                    const taskCount = (wo.categories || []).reduce((s: number, c: any) => s + (c.tasks || []).length, 0);
                                                    return (
                                                        <div key={`pa-${idx}`} onClick={() => navigate(`/work-orders?highlight=${wo.id}`)}
                                                            style={{ padding: '1rem 1.25rem', background: '#faf5ff', borderRadius: '20px', border: '1px solid #e9d5ff', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateX(4px)')}
                                                            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateX(0)')}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6366f1', fontFamily: 'monospace' }}>{wo.id}</span>
                                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff', background: statusColor, padding: '2px 10px', borderRadius: '20px' }}>{statusLabel}</span>
                                                            </div>
                                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e1b4b', marginBottom: '4px' }}>{wo.locationName || wo.building || '—'}</div>
                                                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: '#7c3aed' }}>
                                                                <span>📋 {taskCount} รายการ</span>
                                                                {wo.reportDate && <span>📅 {wo.reportDate}</span>}
                                                                {wo.reporterName && <span>👤 {wo.reporterName}</span>}
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); navigate(`/work-orders?highlight=${wo.id}`); }}
                                                                style={{ width: '100%', marginTop: '10px', padding: '7px', background: 'rgba(99,102,241,0.08)', border: '1px solid #c4b5fd', borderRadius: '12px', color: '#6366f1', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
                                                                🔍 ไปหน้าติดตามใบงาน
                                                            </button>
                                                        </div>
                                                    );
                                                });
                                            } else {
                                                // 'all' — flat subtasks across all active WOs, sorted by SLA urgency
                                                const activeWOs = allAccessibleWOs.filter((wo: any) => !isWorkOrderCompleted(wo)).sort((a: any, b: any) => {
                                                    const score = (s: any) => s?.level === 'critical' ? 0 : s?.level === 'warning' ? 1 : 2;
                                                    return score(getSLATimeStatus(a)) - score(getSLATimeStatus(b));
                                                });
                                                const flat = activeWOs.flatMap((wo: any) =>
                                                    (wo.categories || []).flatMap((cat: any) => {
                                                        const catTasks = cat.tasks || [];
                                                        const myCatTasks = catTasks.filter(isMySubtask);
                                                        const show = myCatTasks.length > 0 ? myCatTasks : (catTasks.some((t: any) => t.subtaskOperatorId) ? [] : catTasks);
                                                        return show.map((t: any) => ({ task: t, wo, categoryName: cat.name }));
                                                    })
                                                );
                                                return flat.length > 0 ? flat.map((item: any, idx: number) => (
                                                    <SubtaskCard key={`all-${idx}`} task={item.task} wo={item.wo} categoryName={item.categoryName} sla={getSLATimeStatus(item.wo)} />
                                                )) : <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>ไม่มีงานคงค้างในขณะนี้ 🎉</div>;
                                            }
                                        })()}
                                    </div>
                                </div>

                                <div style={{ background: '#fff', padding: '2rem', borderRadius: '32px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                                    <SectionHeader
                                        title="การกระจายความคืบหน้า"
                                        icon={<Activity size={20} />}
                                        subtitle={selectedOpCategory === 'urgent' ? 'งานเร่งด่วน SLA' : selectedOpCategory === 'evaluating' ? 'งานรอลูกค้าประเมิน' : selectedOpCategory === 'inProgress' ? 'งานปกติ' : selectedOpCategory === 'pendingAdmin' ? 'ใบงานรอแอดมินประเมิน' : 'งานย่อยทั้งหมด'}
                                    />
                                    <div style={{ marginTop: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        {(() => {
                                            const isForCustomerEvalLocal = (wo: any) => {
                                                if (['Completed', 'Verified'].includes(wo.status)) return false;
                                                if (wo.status === 'pending_delivery') return true;
                                                const allTasks = (wo.categories || []).flatMap((c: any) => c.tasks || []);
                                                return allTasks.length > 0 && allTasks.every((t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100);
                                            };
                                            const donutWOs =
                                                selectedOpCategory === 'urgent' ? (stats.urgentTasks || []) :
                                                selectedOpCategory === 'evaluating' ? allAccessibleWOs.filter(isForCustomerEvalLocal) :
                                                selectedOpCategory === 'inProgress' ? allAccessibleWOs.filter((wo: any) => !isWorkOrderCompleted(wo) && !new Set((stats.urgentTasks || []).map((u: any) => String(u.id))).has(String(wo.id)) && ['In Progress', 'Approved', 'Partially Approved', 'Pending', 'Rejected'].includes(wo.status) && !(wo.status === 'Rejected' && wo.pendingAdminReassign === true)) :
                                                selectedOpCategory === 'pendingAdmin' ? [] :
                                                allAccessibleWOs;
                                            return <ProgressDonutChart allWOs={donutWOs} currentUser={user} />;
                                        })()}

                                    </div>
                                </div>
                            </div>

                        </>
                    ) : (
                        /* Insights Mode */
                        <>
                            {/* Performance Hero Card — Foreman only */}
                            {isForeman ? (() => {
                                // derive from healthCardProjects — same source as Project Health Pulse
                                const relevantProjects = selectedSCurveProject
                                    ? healthCardProjects.filter((p: any) => p.id === selectedSCurveProject)
                                    : healthCardProjects;
                                const hcTotal = relevantProjects.reduce((s: number, p: any) => s + p.cases.length, 0);
                                const hcMet = relevantProjects.reduce((s: number, p: any) => s + p.cases.filter((c: any) => c.deviation >= 0).length, 0);
                                const hasScore = hcTotal > 0;
                                const score = hasScore ? Math.round(hcMet / hcTotal * 100) : 0;
                                const slaColor = !hasScore ? '#94a3b8' : score >= 85 ? '#1D9E75' : score >= 65 ? '#378ADD' : score >= 40 ? '#EF9F27' : '#E24B4A';
                                const statusLabel = !hasScore ? 'ไม่มีข้อมูล' : score >= 85 ? 'ยอดเยี่ยม' : score >= 65 ? 'ดี' : score >= 40 ? 'ควรปรับปรุง' : 'ต้องแก้ไขด่วน';
                                const statusBg = !hasScore ? '#f8fafc' : score >= 85 ? '#E1F5EE' : score >= 65 ? '#E6F1FB' : score >= 40 ? '#FAEEDA' : '#FCEBEB';
                                const statusTextColor = !hasScore ? '#64748b' : score >= 85 ? '#0F6E56' : score >= 65 ? '#185FA5' : score >= 40 ? '#854F0B' : '#A32D2D';
                                const closedWOs = stats.closedWOsInScope ?? 0;
                                const closeRate = stats.totalInMonth > 0 ? Math.round(closedWOs / stats.totalInMonth * 100) : 0;
                                const lateCount = (stats.urgentTasks || []).filter((wo: any) => wo.statusInfo?.level === 'critical').length;
                                const topUrgent = (stats.urgentTasks || [])[0];
                                const nextUpcoming = (stats.upcomingTasks || [])[0];
                                const circ = 2 * Math.PI * 52;
                                return (
                                <div style={{ background: '#fff', borderRadius: '24px', border: '0.5px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', padding: '1.5rem 2rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: gridCols(isMobile, '180px 1fr'), gap: '1.5rem', alignItems: 'center' }}>

                                    {/* LEFT: gauge */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                                            <svg width="160" height="160" viewBox="0 0 160 160">
                                                <defs>
                                                    <linearGradient id="slaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor={slaColor} stopOpacity="1"/>
                                                        <stop offset="100%" stopColor={slaColor} stopOpacity="0.6"/>
                                                    </linearGradient>
                                                </defs>
                                                {/* Background track */}
                                                <circle cx="80" cy="80" r="65" fill="none" stroke="#f1f5f9" strokeWidth="12"/>
                                                {/* Progress arc */}
                                                <circle cx="80" cy="80" r="65" fill="none" stroke={`url(#slaGrad)`} strokeWidth="12"
                                                    strokeDasharray={`${(score / 100) * (2 * Math.PI * 65)} ${2 * Math.PI * 65}`}
                                                    strokeLinecap="round" transform="rotate(-90 80 80)"
                                                    style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 6px ${slaColor}66)` }}
                                                />
                                                {/* Inner glow circle */}
                                                <circle cx="80" cy="80" r="53" fill={statusBg} opacity="0.5"/>
                                            </svg>
                                            {/* Center text overlay */}
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ fontSize: '32px', fontWeight: 900, color: slaColor, lineHeight: 1, letterSpacing: '-0.03em' }}>{hasScore ? `${score}%` : 'N/A'}</div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '4px' }}>SLA score</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: statusBg, color: statusTextColor, padding: '6px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>
                                            {statusLabel}
                                        </div>
                                        {lateCount > 0 && (
                                            <div style={{ fontSize: '11px', color: '#A32D2D', textAlign: 'center', lineHeight: 1.6 }}>มีงาน late {lateCount} รายการ</div>
                                        )}
                                    </div>

                                    {/* MIDDLE: stats + progress */}
                                    {(() => {
                                        const closedWOs = stats.closedWOsInScope ?? 0;
                                        const pendingWOs = stats.totalInMonth - closedWOs;
                                        const totalTasks = stats.closed + stats.open;
                                        const woRate = stats.totalInMonth > 0 ? Math.round(closedWOs / stats.totalInMonth * 100) : 0;
                                        const taskRate = totalTasks > 0 ? Math.round(stats.closed / totalTasks * 100) : 0;
                                        return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {(() => {
                                            // Use same source as SLA gauge (healthCardProjects) for consistency
                                            const _hcRel = selectedSCurveProject
                                                ? healthCardProjects.filter((p: any) => p.id === selectedSCurveProject)
                                                : healthCardProjects;
                                            const _hcTot = _hcRel.reduce((s: number, p: any) => s + p.cases.length, 0);
                                            const _hcMet = _hcRel.reduce((s: number, p: any) => s + p.cases.filter((c: any) => c.deviation >= 0).length, 0);
                                            const slaOnTime = _hcMet;
                                            const slaLate = _hcTot - _hcMet;
                                            return (
                                        <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, 'repeat(4,1fr)', 'repeat(2,1fr)'), gap: '12px' }}>
                                            {/* WO dual-number card */}
                                            <div style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', padding: '1.5rem', borderRadius: '24px', minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
                                                <div style={{ position: 'absolute', right: '-10%', top: '-10%', opacity: 0.1, color: '#fff' }}><FileText size={120} /></div>
                                                <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '12px', color: '#fff', display: 'inline-flex' }}><FileText size={18} /></div>
                                                <div style={{ position: 'relative', zIndex: 1 }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, marginBottom: '12px' }}>ใบงาน</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                                                        <div>
                                                            <div style={{ fontSize: scaleFont(isMobile, '2.5rem'), fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em' }}>{stats.totalInMonth}</div>
                                                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: '5px', fontWeight: 500 }}>ทำทั้งหมด</div>
                                                        </div>
                                                        <div style={{ width: '1px', height: '44px', background: 'rgba(255,255,255,0.3)' }} />
                                                        <div>
                                                            <div style={{ fontSize: scaleFont(isMobile, '2.5rem'), fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em' }}>{closedWOs}</div>
                                                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: '5px', fontWeight: 500 }}>เสร็จแล้ว</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Task dual-number card */}
                                            <div style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', padding: '1.5rem', borderRadius: '24px', minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
                                                <div style={{ position: 'absolute', right: '-10%', top: '-10%', opacity: 0.1, color: '#fff' }}><CheckCircle2 size={120} /></div>
                                                <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '12px', color: '#fff', display: 'inline-flex' }}><CheckCircle2 size={18} /></div>
                                                <div style={{ position: 'relative', zIndex: 1 }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, marginBottom: '12px' }}>รายการย่อย</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                                                        <div>
                                                            <div style={{ fontSize: scaleFont(isMobile, '2.5rem'), fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em' }}>{totalTasks}</div>
                                                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: '5px', fontWeight: 500 }}>ทำทั้งหมด</div>
                                                        </div>
                                                        <div style={{ width: '1px', height: '44px', background: 'rgba(255,255,255,0.3)' }} />
                                                        <div>
                                                            <div style={{ fontSize: scaleFont(isMobile, '2.5rem'), fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em' }}>{stats.closed}</div>
                                                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: '5px', fontWeight: 500 }}>เสร็จแล้ว</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* On-time SLA card */}
                                            <div onClick={() => document.getElementById('job-details-section')?.scrollIntoView({ behavior: 'smooth' })} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.cursor = 'pointer'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }} style={{ background: 'linear-gradient(135deg, #22C55E 0%, #15803D 100%)', padding: '1.5rem', borderRadius: '24px', minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden', textAlign: 'center', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                                                <div style={{ position: 'absolute', right: '-10%', top: '-10%', opacity: 0.1, color: '#fff' }}><Zap size={120} /></div>
                                                <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '12px', color: '#fff', display: 'inline-flex' }}><Zap size={18} /></div>
                                                <div style={{ position: 'relative', zIndex: 1 }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, marginBottom: '10px' }}>เสร็จทัน SLA</div>
                                                    <div style={{ fontSize: scaleFont(isMobile, '3.5rem'), fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em' }}>{slaOnTime}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: '8px', fontWeight: 500 }}>จาก {stats.closed} รายการที่เสร็จ →</div>
                                                </div>
                                            </div>
                                            {/* Late SLA card */}
                                            <div onClick={() => document.getElementById('job-details-section')?.scrollIntoView({ behavior: 'smooth' })} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.cursor = 'pointer'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }} style={{ background: slaLate > 0 ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)', padding: '1.5rem', borderRadius: '24px', minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden', textAlign: 'center', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                                                <div style={{ position: 'absolute', right: '-10%', top: '-10%', opacity: 0.1, color: '#fff' }}><AlertTriangle size={120} /></div>
                                                <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '12px', color: '#fff', display: 'inline-flex' }}><AlertTriangle size={18} /></div>
                                                <div style={{ position: 'relative', zIndex: 1 }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, marginBottom: '10px' }}>เลย SLA</div>
                                                    <div style={{ fontSize: scaleFont(isMobile, '3.5rem'), fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em' }}>{slaLate}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: '8px', fontWeight: 500 }}>{slaLate > 0 ? 'รายการเกินกำหนด → ดูรายละเอียด' : 'ทุกงานทันกำหนด 🎉'}</div>
                                                </div>
                                            </div>
                                        </div>
                                            );
                                        })()}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>ความคืบหน้าเดือนนี้</span>
                                            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                                                <div style={{ width: `${Math.min(closeRate, 100)}%`, height: '100%', background: slaColor, borderRadius: '99px', transition: 'width 1s ease' }} />
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: slaColor, whiteSpace: 'nowrap' }}>{closeRate}%</span>
                                            <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>ปิดแล้ว {closedWOs} · ค้าง {stats.totalInMonth - closedWOs}</span>
                                        </div>
                                    </div>
                                        );
                                    })()}


                                </div>
                                );
                            })() : (
                                <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, 'repeat(auto-fit, minmax(240px, 1fr))', 'repeat(2, 1fr)'), gap: isMobile ? '12px' : '1.5rem', marginBottom: '2.5rem' }}>
                                    <StatCard title="งานทั้งหมดที่ดูแล" value={stats.totalInMonth} icon={<Activity size={24} />} color="#3b82f6" gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" subtext={<span>ใหม่ <b>{stats.newThisMonth}</b> / ค้าง <b>{stats.carriedOver}</b> (รวมทั้งฟิลเตอร์)</span>} />
                                    <StatCard title="งานที่ปิดจบสำเร็จ" value={stats.closed} icon={<CheckCircle2 size={24} />} color="#10b981" gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)" subtext="ความสำเร็จรวมที่ส่งมอบเดือนนี้" />
                                    <StatCard title="ประสิทธิภาพ SLA เฉลี่ย" value={stats.slaScore !== null && stats.slaScore !== undefined ? `${stats.slaScore}%` : 'N/A'} icon={<TrendingUp size={24} />} color="#4f46e5" gradient="linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)" subtext={stats.slaScore != null && stats.slaScore > 80 ? 'อยู่ในเกณฑ์ดีเยี่ยม' : stats.slaScore != null ? 'ควรปรับปรุงความเร็ว' : 'ยังไม่มีงานที่วัดได้'} />
                                    <StatCard title="ชั่วโมงการทำงานรวม" value={`${stats.totalHours.toLocaleString()} ชม.`} icon={<Activity size={24} />} color="#8b5cf6" gradient="linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" subtext="ลงแรงงานจริงสะสมรายเดือน" />
                                </div>
                            )}

                            {/* Activity Calendar Section */}
                            {(isForeman || isAdminOrManager) && (
                                <div id="activity-calendar-section" className={highlightedSection === 'activity-calendar-section' ? 'section-highlight' : ''} style={{ marginBottom: '2rem', transition: 'all 0.5s', borderRadius: '32px' }}>
                                    {(!isForeman && !selectedForemanId) ? (
                                        <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '4rem 2rem', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                            <div style={{ background: '#f5f3ff', width: '80px', height: '80px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', margin: '0 auto 1.5rem auto' }}>
                                                <Clock size={40} />
                                            </div>
                                            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', marginBottom: '12px' }}>ปฏิทินกิจกรรมการทำงาน</h3>
                                            <p style={{ color: '#64748b', fontWeight: 600, maxWidth: '500px', margin: '0 auto', fontSize: '1rem', lineHeight: 1.6 }}>
                                                กรุณาเลือก <span style={{ color: '#4f46e5', fontWeight: 800 }}>"รายชื่อพนักงาน"</span> จากตัวกรองด้านบน <br />
                                                เพื่อดูปฏิทินงานรายวัน ตรวจสอบรายชื่อคนงาน และบันทึกรายละเอียด
                                            </p>
                                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                                <div style={{ padding: '8px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Users size={16} /> ตรวจสอบรายชื่อคนงานรายวัน
                                                </div>
                                                <div style={{ padding: '8px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <TrendingUp size={16} /> คลิกวันเพื่อแก้ไขข้อมูล
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <ForemanCalendar
                                            workOrders={workOrders}
                                            currentUserId={isForeman ? (user?.id || '') : (selectedForemanId || '')}
                                            projects={selectableProjects}
                                            highlightProjectId={selectedSCurveProject || null}
                                            highlightedWOId={highlightedWOId}
                                            selectedMonth={selectedMonth}
                                        />
                                    )}
                                </div>
                            )}

                            {!isForeman && <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, '1.4fr 1fr'), gap: '2rem', marginBottom: '2.5rem' }}>
                                <div style={{ background: '#fff', padding: '2rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                    <SectionHeader
                                        title="สถิติการเปิด-ปิดรายการงาน (Task Statistics)"
                                        icon={<TrendingUp size={22} />}
                                        subtitle={`สรุปจำนวนรายการงานที่เปิดใหม่และทำเสร็จสำเร็จราย${selectedWeek === 0 ? 'เดือน' : `สัปดาห์ที่ ${selectedWeek}`}`}
                                        actions={
                                            <div style={{ padding: '6px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 800 }}>
                                                <span style={{ color: '#f59e0b' }}>เปิด {timelineData.reduce((acc, d) => acc + d.openedCount, 0)}</span>
                                                <span style={{ color: '#94a3b8', margin: '0 8px' }}>|</span>
                                                <span style={{ color: '#8b5cf6' }}>ปิด {timelineData.reduce((acc, d) => acc + d.closedCount, 0)}</span>
                                            </div>
                                        }
                                    />
                                    <div style={{ height: '320px', width: '100%' }}>
                                        <ResponsiveContainer>
                                            <BarChart
                                                key={`timeline-${highlightedWOId || 'none'}`}
                                                data={timelineData}
                                                onMouseMove={(state) => { if (state && state.activeLabel !== undefined) setActiveProgressIndex(state.activeLabel); else setActiveProgressIndex(null); }}
                                                onMouseLeave={() => setActiveProgressIndex(null)}
                                                onClick={(state: any) => {
                                                    if (state && state.activeLabel !== undefined) {
                                                        const dataPoint = timelineData.find(d => d.day === state.activeLabel);
                                                        if (dataPoint && (dataPoint.openedCount > 0 || dataPoint.closedCount > 0)) {
                                                            setSelectedBarWOs(dataPoint);
                                                        }
                                                    }
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                    labelFormatter={(value) => {
                                                        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                                                        const [yr, mn] = selectedMonth.split('-');
                                                        return `${value} ${monthNames[parseInt(mn) - 1]} ${yr}`;
                                                    }}
                                                />
                                                <Legend verticalAlign="top" align="right" />
                                                <Bar dataKey="openedCount" name="เปิดงานใหม่" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20}>
                                                    {timelineData.map((item, index) => <Cell key={`cell-opened-${index}`} fillOpacity={highlightedWOId ? (item.isHighlighted ? 1 : 0.25) : (activeProgressIndex === null || activeProgressIndex === item.day ? 1 : 0.3)} stroke={highlightedWOId && item.isHighlighted ? '#b45309' : 'none'} strokeWidth={2} />)}
                                                </Bar>
                                                <Bar dataKey="closedCount" name="ปิดงานสำเร็จ" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20}>
                                                    {timelineData.map((item, index) => <Cell key={`cell-closed-${index}`} fillOpacity={highlightedWOId ? (item.isHighlighted ? 1 : 0.25) : (activeProgressIndex === null || activeProgressIndex === item.day ? 1 : 0.3)} stroke={highlightedWOId && item.isHighlighted ? '#5b21b6' : 'none'} strokeWidth={2} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div style={{ background: '#fff', padding: '2rem', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
                                    <SectionHeader title="สัดส่วนการใช้แรงงาน (Efficiency)" icon={<Users size={20} />} subtitle="ชั่วโมงงานภายใน vs ผู้รับเหมา" />
                                    <div style={{ height: '320px', position: 'relative' }}>
                                        {/* Centered Summary Total */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '45%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            textAlign: 'center',
                                            pointerEvents: 'none',
                                            zIndex: 10
                                        }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '-5px' }}>
                                                {highlightedWOId ? 'ใบงานที่เน้น' : 'ชั่วโมงรวม'}
                                            </div>
                                            <div style={{ fontSize: scaleFont(isMobile, '2.4rem'), fontWeight: 900, color: '#1e293b', lineHeight: 1.1 }}>
                                                {((stats.internalHours || 0) + (stats.outsourceHours || 0)).toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4f46e5' }}>ชม. งาน</div>
                                        </div>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart key={`pie-${highlightedWOId || 'none'}`}>
                                                <Pie data={stats.laborStats} cx="50%" cy="45%" innerRadius={isMobile ? 52 : 70} outerRadius={isMobile ? 78 : 100} paddingAngle={8} dataKey="value">
                                                    {stats.laborStats.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>}

                            {/* S-Curve Chart */}
                            <div style={{ gridColumn: '1/-1', background: '#ffffff', borderRadius: '32px', padding: '2.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', marginBottom: '2.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', padding: '14px', borderRadius: '18px', color: '#fff' }}>
                                            <TrendingUp size={28} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>SLA Pressure vs Manpower</h3>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>แท่ง = จำนวนงาน active แยกตามสถานะ SLA รายวัน · เส้น = คนงานที่ใช้จริง</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ height: '400px', width: '100%', position: 'relative' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart
                                            key={`scurve-${highlightedWOId || 'none'}-${selectedSCurveProject || 'all'}`}
                                            data={sCurveData}
                                            margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                                            onClick={(e) => {
                                                if (e && e.activeLabel && selectedSCurveProject) {
                                                    const dayStr = e.activeLabel.toString().padStart(2, '0');
                                                    handleLaborDetailClick(selectedSCurveProject, `${selectedMonth}-${dayStr}`);
                                                }
                                            }}
                                            style={{ cursor: selectedSCurveProject ? 'pointer' : 'default' }}
                                        >
                                            <defs>
                                                <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700, dy: 5 }} label={{ value: 'วันที่ในเดือน', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11, fontWeight: 800 }} />
                                            <YAxis yAxisId="left" hide={!selectedSCurveProject} axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} label={{ value: 'งานที่ทำ (ใบ)', angle: -90, position: 'insideLeft', offset: 15, fill: '#64748b', fontSize: 11, fontWeight: 800 }} />
                                            <YAxis yAxisId="right" orientation="right" hide={!selectedSCurveProject} axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#2563eb', fontSize: 12, fontWeight: 700 }} label={{ value: 'คนงาน (แรง)', angle: 90, position: 'insideRight', offset: 15, fill: '#2563eb', fontSize: 11, fontWeight: 800 }} />
                                            <Tooltip
                                                content={(props: any) => {
                                                    if (!props.active || !props.payload?.length) return null;
                                                    const d = props.payload[0]?.payload;
                                                    if (!d) return null;
                                                    const slaIcon = (s: string) => s === 'breach' ? '🔴' : s === 'risk' ? '⚠️' : '✅';
                                                    return (
                                                        <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 10px 20px -3px rgba(0,0,0,0.15)', padding: '12px 16px', fontSize: '12px', minWidth: '210px', maxWidth: '290px' }}>
                                                            <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: '8px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span>{d.taskDetails?.length || 0} งาน</span>
                                                                <span style={{ color: '#2563eb', fontSize: '12px', fontWeight: 700 }}>👷 {d.manpower} แรง</span>
                                                            </div>
                                                            {d.taskDetails?.length > 0 ? d.taskDetails.map((t: any, i: number) => (
                                                                <div key={i} style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : undefined, paddingTop: i > 0 ? '7px' : undefined, marginTop: i > 0 ? '7px' : undefined }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                                        <span style={{ fontWeight: 700, color: '#334155', flex: 1, lineHeight: '1.3' }}>{slaIcon(t.slaStatus)} {t.taskName}</span>
                                                                        <span style={{ color: '#64748b', flexShrink: 0, fontSize: '11px' }}>{t.labor} แรง</span>
                                                                    </div>
                                                                    <div style={{ color: '#64748b', marginTop: '3px', fontSize: '11px' }}>
                                                                        โปรเกรส: <span style={{ color: '#475569', fontWeight: 700 }}>{t.progFrom}%</span> → <span style={{ color: '#1e293b', fontWeight: 700 }}>{t.progTo}%</span>
                                                                    </div>
                                                                </div>
                                                            )) : <div style={{ color: '#94a3b8' }}>ไม่มีการลงข้อมูลวันนี้</div>}
                                                        </div>
                                                    );
                                                }}
                                            />
                                            <Legend verticalAlign="top" content={() => (
                                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px', fontSize: '12px' }}>
                                                    {[['#97C459','on track'],['#EF9F27','ใกล้หมด SLA'],['#E24B4A','เกิน SLA แล้ว']].map(([c,l]) => (
                                                        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
                                                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: c, flexShrink: 0 }} />
                                                            {l}
                                                        </span>
                                                    ))}
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
                                                        <span style={{ display: 'inline-block', width: '18px', height: '2px', background: '#2563eb', verticalAlign: 'middle' }} />
                                                        คนงาน (แรง)
                                                    </span>
                                                </div>
                                            )} />
                                            {selectedMonth && (() => {
                                                const [yr, mo] = selectedMonth.split('-');
                                                const dim = new Date(parseInt(yr), parseInt(mo), 0).getDate();
                                                const sundays: number[] = [];
                                                for (let d = 1; d <= dim; d++) {
                                                    if (new Date(parseInt(yr), parseInt(mo) - 1, d).getDay() === 0) sundays.push(d);
                                                }
                                                return sundays.map((day) => <ReferenceLine key={`sun-${day}`} x={day} yAxisId="left" stroke="#e2e8f0" strokeWidth={1} strokeDasharray="3 3" />);
                                            })()}
                                            {selectedMonth && (() => {
                                                const d = new Date();
                                                const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                                if (selectedMonth === currentMonthStr) {
                                                    return <ReferenceLine x={d.getDate()} yAxisId="left" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 5" label={{ position: 'top', value: 'วันนี้', fill: '#2563eb', fontSize: 10, fontWeight: 900 }} />;
                                                }
                                                return null;
                                            })()}
                                            {selectedSCurveProject && (
                                                <Bar yAxisId="left" dataKey="totalWorkedTasks" name="งานที่ทำวันนี้"
                                                    shape={(props: any) => {
                                                        const { x, y, width, height, payload } = props;
                                                        if (!height || height <= 0) return <g />;
                                                        const tasks: any[] = payload.taskDetails || [];
                                                        if (!tasks.length) return <g />;
                                                        const n = tasks.length;
                                                        const segH = height / n;
                                                        return (
                                                            <g>
                                                                {tasks.map((task: any, i: number) => {
                                                                    const color = task.slaStatus === 'breach' ? '#E24B4A' : task.slaStatus === 'risk' ? '#EF9F27' : '#97C459';
                                                                    const sy = y + height - (i + 1) * segH;
                                                                    const isTop = i === n - 1;
                                                                    return (
                                                                        <g key={i}>
                                                                            {isTop
                                                                                ? <path d={`M${x+3},${sy} Q${x},${sy} ${x},${sy+3} L${x},${sy+segH} L${x+width},${sy+segH} L${x+width},${sy+3} Q${x+width},${sy} ${x+width-3},${sy} Z`} fill={color} />
                                                                                : <rect x={x} y={sy} width={width} height={segH} fill={color} />
                                                                            }
                                                                            {i < n - 1 && <line x1={x} y1={sy + segH} x2={x + width} y2={sy + segH} stroke="white" strokeWidth={2} />}
                                                                        </g>
                                                                    );
                                                                })}
                                                            </g>
                                                        );
                                                    }}
                                                />
                                            )}
                                            {selectedSCurveProject && <Line yAxisId="right" type="monotone" dataKey="manpower" stroke="#2563eb" strokeWidth={2} connectNulls={false} dot={(props: any) => { const { cx, cy, payload } = props; return <circle cx={cx} cy={cy} r={payload.hasHighlight ? 6 : 3} fill="#2563eb" stroke={payload.hasHighlight ? '#fff' : 'none'} strokeWidth={2} />; }} activeDot={{ r: 8 }} name="manpower" />}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                    {!selectedSCurveProject && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.88)', padding: '1rem 2rem', borderRadius: '16px', border: '1px solid #e2e8f0', backdropFilter: 'blur(4px)' }}>
                                                <p style={{ margin: 0, color: '#64748b', fontWeight: 700, fontSize: '0.95rem' }}>เลือกโปรเจกต์จากการ์ด SLA ด้านล่างเพื่อดูกราฟ</p>
                                                <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>โครงสร้างเดือน {selectedMonth} แสดงตามแกนเวลา</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Grid: SLA Cards + Category + (Project Track full-width) + Task Details */}
                            <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, '1fr 1fr'), gap: '2rem' }}>
                                {/* Col 1: SLA Section — overview or drill-down */}
                                <div id="analytics-detail-section" className={highlightedSection === 'analytics-detail-section' ? 'section-highlight' : ''} style={{ background: '#fff', padding: '1.75rem', borderRadius: '32px', border: '1px solid #e2e8f0', overflow: 'hidden', transition: 'all 0.5s' }}>
                                    <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <SectionHeader title="SLA รายโครงการ (Project Health Pulse)" icon={<TrendingUp size={20} />} subtitle="คลิกโปรเจกต์เพื่อฟิลเตอร์ข้อมูลทั้ง dashboard" />
                                        {selectedSCurveProject && (
                                            <button onClick={() => { setSelectedSCurveProject(''); setHighlightedWOId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}>
                                                <X size={10} /> ล้างฟิลเตอร์
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, 'repeat(2, 1fr)'), gap: '10px', overflowY: 'auto', maxHeight: '520px', alignItems: 'stretch' }}>
                                        {healthCardProjects.map((p: any) => {
                                            const cases = p.cases ?? [];
                                            const caseTotal = cases.length;
                                            const onTime  = cases.filter((c: any) => c.deviation >= 0).length;
                                            const atRisk  = cases.filter((c: any) => c.deviation < 0 && c.deviation >= -30).length;
                                            const late    = cases.filter((c: any) => c.deviation < -30).length;
                                            const sla = caseTotal > 0 ? Math.round(onTime / caseTotal * 100) : 100;
                                            const accentColor = sla >= 80 ? '#10b981' : sla >= 50 ? '#f59e0b' : '#ef4444';
                                            const verdictBg   = sla >= 80 ? '#ecfdf5' : sla >= 50 ? '#fffbeb' : '#fef2f2';
                                            const verdictText = sla >= 80 ? '#065f46' : sla >= 50 ? '#92400e' : '#991b1b';
                                            const verdictLabel = sla >= 80 ? 'On Track' : sla >= 50 ? 'ระวัง' : 'ล่าช้า';
                                            const worstCase = caseTotal > 0 ? [...cases].sort((a: any, b: any) => a.deviation - b.deviation)[0] : null;
                                            const worstDev  = worstCase ? Math.round(Math.abs(worstCase.deviation)) : 0;
                                            const worstDays = worstCase && worstCase.deviation < 0 ? +(worstCase.calendarDays - worstCase.targetDays).toFixed(1) : 0;
                                            const isSelected = p.id ? selectedSCurveProject === p.id : false;
                                            const isOtherSelected = selectedSCurveProject !== '' && !isSelected;
                                            return (
                                                <div
                                                    key={p.name}
                                                    onClick={() => { if (p.id) setSelectedSCurveProject(selectedSCurveProject === p.id ? '' : p.id); }}
                                                    style={{ background: isSelected ? '#f8faff' : '#fff', border: isSelected ? `2px solid ${accentColor}` : '1px solid #e2e8f0', borderRadius: '16px', padding: '1.1rem 1.25rem 1.1rem 1.5rem', cursor: p.id ? 'pointer' : 'default', transition: 'opacity 0.15s, border-color 0.15s, box-shadow 0.15s', position: 'relative', overflow: 'hidden', opacity: isOtherSelected ? 0.5 : 1, boxShadow: isSelected ? `0 0 0 3px ${accentColor}20` : 'none' }}
                                                    onMouseOver={(e) => { e.currentTarget.style.boxShadow = isSelected ? `0 0 0 3px ${accentColor}35` : '0 2px 8px rgba(0,0,0,0.06)'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.boxShadow = isSelected ? `0 0 0 3px ${accentColor}20` : 'none'; }}
                                                >
                                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: accentColor, borderRadius: '16px 0 0 16px' }} />
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>{p.name}</div>
                                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: verdictBg, color: verdictText, marginTop: '3px', display: 'inline-block' }}>{verdictLabel}</span>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: accentColor }}>{sla}%</div>
                                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '1px' }}>{onTime}/{caseTotal} รายการทันกำหนด</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', height: '5px', borderRadius: '99px', overflow: 'hidden', gap: '2px', margin: '0 0 8px' }}>
                                                        {onTime > 0  && <div style={{ flex: onTime,  background: '#10b981', borderRadius: '99px' }} />}
                                                        {atRisk > 0  && <div style={{ flex: atRisk,  background: '#f59e0b', borderRadius: '99px' }} />}
                                                        {late > 0    && <div style={{ flex: late,    background: '#ef4444', borderRadius: '99px' }} />}
                                                        {caseTotal === 0 && <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '99px' }} />}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                                        {([['#10b981', `ทันกำหนด ${onTime}`], ['#f59e0b', `เกือบช้า ${atRisk}`], ['#ef4444', `ล่าช้า ${late}`]] as [string, string][]).map(([color, label]) => (
                                                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: '#64748b' }}>
                                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                                                {label}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {worstCase && worstCase.deviation < 0 ? (
                                                        <div style={{ background: '#fafafa', border: '0.5px solid #f1f5f9', borderRadius: '8px', padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>รายการที่แย่สุด</div>
                                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginTop: '1px' }}>{worstCase.label} {worstDays > 0 ? `— ช้า ${worstDays} วัน` : ''}</div>
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>-{worstDev}%</div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: '8px', padding: '7px 10px', marginBottom: '10px' }}>
                                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#065f46' }}>ทุกรายการผ่าน SLA</div>
                                                        </div>
                                                    )}
                                                    {(() => {
                                                        const tData = projectTrend.trend[p.id] || [];
                                                        const hasData = tData.some((v: number) => v >= 0);
                                                        const last = tData[tData.length - 1] ?? -1;
                                                        const prev = tData[tData.length - 2] ?? -1;
                                                        const trendDir = (last >= 0 && prev >= 0) ? (last > prev ? 'up' : last < prev ? 'down' : 'flat') : 'none';
                                                        const trendLabel = trendDir === 'up' ? 'แนวโน้มดีขึ้น' : trendDir === 'down' ? 'แย่ลงต่อเนื่อง' : trendDir === 'flat' ? 'คงที่' : '';
                                                        const trendColor = trendDir === 'up' ? '#10b981' : trendDir === 'down' ? '#ef4444' : '#f59e0b';
                                                        return (
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '0.5px solid #f1f5f9' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    {hasData && (
                                                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '18px' }}>
                                                                            {tData.map((v: number, i: number) => {
                                                                                const h = v >= 0 ? Math.max(Math.round(v / 100 * 16), 2) : 3;
                                                                                const bc = v >= 80 ? '#10b981' : v >= 50 ? '#f59e0b' : v >= 0 ? '#ef4444' : '#e2e8f0';
                                                                                const isLast = i === tData.length - 1;
                                                                                return <div key={i} style={{ width: '4px', height: `${h}px`, background: bc, borderRadius: '2px', opacity: isLast ? 1 : 0.55 }} />;
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                    {trendLabel && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: trendColor }}>{trendDir === 'up' ? '▲' : trendDir === 'down' ? '▼' : '—'} {trendLabel}</span>}
                                                                </div>
                                                                <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>ดูรายการ →</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Col 2: Category Chart */}
                                <div style={{ background: '#fff', padding: '1.75rem', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                        <SectionHeader title="งานที่รับผิดชอบแยกตามหมวด" icon={<BarChart3 size={20} />} subtitle="หมวดงานที่ทำมากสุด — ใช้ติดตามปัญหาซ้ำและวิเคราะห์ต้นเหตุ" />
                                        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', gap: '2px', flexShrink: 0 }}>
                                            {([['count', 'จำนวน'], ['fast', 'จบเร็ว'], ['rev', 'REV']] as const).map(([key, label]) => (
                                                <button key={key} onClick={() => setCatSort(key)} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '5px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: catSort === key ? '#fff' : 'transparent', color: catSort === key ? '#4f46e5' : '#94a3b8', boxShadow: catSort === key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none', transition: 'all 0.18s' }}>{label}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '280px' }}>
                                        {(() => {
                                            const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
                                            const BGS    = ['#eef2ff', '#e0f2fe', '#dcfce7', '#fef3c7', '#ede9fe', '#fee2e2'];
                                            const maxCount = smartCategoryData[0]?.count || 1;
                                            const maxRev   = Math.max(...smartCategoryData.map((c: any) => c.avgRev || 0), 0.001);
                                            const fastItems = smartCategoryData.filter((c: any) => c.avgDays !== null);
                                            const maxDays  = Math.max(...fastItems.map((c: any) => c.avgDays), 0.001);
                                            const minDays  = Math.min(...fastItems.map((c: any) => c.avgDays), 0);
                                            return smartCategoryData.slice(0, 5).map((cat, idx) => {
                                                const color = COLORS[idx] || '#94a3b8';
                                                const bgc   = BGS[idx]   || '#f1f5f9';
                                                const barPct = catSort === 'count'
                                                    ? (cat.count / maxCount) * 100
                                                    : catSort === 'rev'
                                                    ? ((cat as any).avgRev / maxRev) * 100
                                                    : cat.avgDays !== null
                                                    ? (maxDays - minDays > 0 ? (1 - (cat.avgDays! - minDays) / (maxDays - minDays)) * 100 : 100)
                                                    : 5;
                                                const badge = catSort === 'fast' && cat.avgDays !== null
                                                    ? `จบใน ${cat.avgDays} วัน`
                                                    : catSort === 'rev'
                                                    ? `เฉลี่ย ${(cat as any).avgRev} REV/งาน`
                                                    : `${cat.count} งาน`;
                                                const isSelected = taskCatFilter === cat.name;
                                                const isOtherSelected = taskCatFilter !== '' && !isSelected;
                                                return (
                                                    <div key={cat.name}
                                                        onClick={() => setTaskCatFilter(isSelected ? '' : cat.name)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: isSelected ? bgc : '#fafafa', border: `1px solid ${isSelected ? color + '60' : '#f1f5f9'}`, transition: 'all 0.18s', cursor: 'pointer', opacity: isOtherSelected ? 0.4 : 1 }}
                                                        onMouseOver={e => { if (!isSelected) { e.currentTarget.style.background = bgc; e.currentTarget.style.borderColor = color + '40'; } }}
                                                        onMouseOut={e => { if (!isSelected) { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#f1f5f9'; } }}
                                                    >
                                                        <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: isSelected || idx === 0 ? color : bgc, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isSelected || idx === 0 ? '#fff' : color }}>{idx + 1}</span>
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                <span style={{ fontSize: '0.83rem', fontWeight: isSelected ? 700 : 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65%' }}>{cat.name}</span>
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color, flexShrink: 0 }}>{badge}</span>
                                                            </div>
                                                            <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${Math.max(barPct, 4)}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width 0.45s ease' }} />
                                                            </div>
                                                        </div>
                                                        {isSelected && <div style={{ fontSize: '0.68rem', fontWeight: 700, color, background: color + '18', padding: '2px 8px', borderRadius: '99px', flexShrink: 0 }}>✕</div>}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>

                                {/* Job Performance Details */}
                                <div id="job-details-section" className={highlightedSection === 'job-details-section' ? 'section-highlight' : ''} style={{ gridColumn: '1/-1', background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '32px', border: '1px solid #e2e8f0', transition: 'all 0.5s' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                                        <SectionHeader title="รายละเอียดรายการงานที่ดำเนินการ (Task Performance Details)" icon={<Activity size={24} />} subtitle="รายการงานย่อยทั้งหมดที่คุณรับผิดชอบ แยกตามใบงานอ้างอิง" />
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                                            {highlightedWOId && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '5px 10px' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb' }}>#{highlightedWOId.slice(-6)}</span>
                                                    <button onClick={() => setHighlightedWOId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: '0.75rem', padding: '0', lineHeight: 1 }}>✕</button>
                                                </div>
                                            )}
                                            <select value={taskWoTypeFilter} onChange={e => setTaskWoTypeFilter(e.target.value)} style={{ fontSize: '0.78rem', fontWeight: 700, padding: '6px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: taskWoTypeFilter ? '#fef3c7' : '#f8fafc', color: taskWoTypeFilter ? '#b45309' : '#64748b', cursor: 'pointer', outline: 'none' }}>
                                                <option value="">ประเภท: ทั้งหมด</option>
                                                <option value="woa">หลังขาย (WOA)</option>
                                                <option value="wop">ก่อนโอน (WOP)</option>
                                            </select>
                                            <select value={taskCatFilter} onChange={e => setTaskCatFilter(e.target.value)} style={{ fontSize: '0.78rem', fontWeight: 700, padding: '6px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: taskCatFilter ? '#eff6ff' : '#f8fafc', color: taskCatFilter ? '#2563eb' : '#64748b', cursor: 'pointer', outline: 'none' }}>
                                                <option value="">หมวดงาน: ทั้งหมด</option>
                                                {taskCatOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <select value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)} style={{ fontSize: '0.78rem', fontWeight: 700, padding: '6px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: taskStatusFilter ? '#f0fdf4' : '#f8fafc', color: taskStatusFilter ? '#059669' : '#64748b', cursor: 'pointer', outline: 'none' }}>
                                                <option value="">สถานะ: ทั้งหมด</option>
                                                {taskStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            {(taskCatFilter || taskStatusFilter || taskWoTypeFilter || highlightedWOId) && (
                                                <button onClick={() => { setTaskCatFilter(''); setTaskStatusFilter(''); setTaskWoTypeFilter(''); setHighlightedWOId(null); }} style={{ fontSize: '0.72rem', fontWeight: 800, padding: '6px 10px', borderRadius: '10px', border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' }}>✕ ล้าง</button>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px', overscrollBehavior: 'contain' }}>
                                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                                            <thead>
                                                {/* Group label row — sticky top:0 */}
                                                <tr style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                                                    <th colSpan={3} style={{ padding: '8px 0.75rem 5px', position: 'sticky', top: 0, zIndex: 21, background: '#fff', boxShadow: '0 8px 0 0 #fff' }}></th>
                                                    <th colSpan={3} style={{ padding: '8px 4px 5px', color: '#2563eb', background: '#eff6ff', borderRadius: '6px 6px 0 0', borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 21, boxShadow: '0 8px 0 0 #fff' }}>🎯 เป้าหมาย</th>
                                                    <th colSpan={2} style={{ padding: '8px 4px 5px', color: '#0d9488', background: '#f0fdf4', borderRadius: '6px 6px 0 0', borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 21, boxShadow: '0 8px 0 0 #fff' }}>✅ ผลจริง</th>
                                                    <th colSpan={3} style={{ padding: '8px 4px 5px', color: '#b45309', background: '#fff7ed', borderRadius: '6px 6px 0 0', borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 21, boxShadow: '0 8px 0 0 #fff' }}>⚡ ความพยายาม</th>
                                                    <th colSpan={1} style={{ padding: '8px 4px 5px', color: '#6d28d9', background: '#faf5ff', borderRadius: '6px 6px 0 0', borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 21, boxShadow: '0 8px 0 0 #fff' }}>💎 คุณภาพ</th>
                                                    <th colSpan={2} style={{ padding: '8px 0.75rem 5px', position: 'sticky', top: 0, zIndex: 21, background: '#fff', boxShadow: '0 8px 0 0 #fff' }}></th>
                                                </tr>
                                                {/* Column headers row — sticky top:33px (ต่อจาก group row) */}
                                                <tr style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                                                    <th style={{ padding: '4px 0.75rem 10px', minWidth: '140px', textAlign: 'left', position: 'sticky', top: 33, zIndex: 20, background: '#fff', borderBottom: '2px solid #e2e8f0' }}>รายการงาน</th>
                                                    <th style={{ padding: '4px 8px 10px', minWidth: '90px', textAlign: 'center', position: 'sticky', top: 33, zIndex: 20, background: '#fff', borderBottom: '2px solid #e2e8f0' }}>ตำแหน่ง</th>
                                                    <th style={{ padding: '4px 8px 10px', minWidth: '90px', textAlign: 'center', position: 'sticky', top: 33, zIndex: 20, background: '#fff', borderBottom: '2px solid #e2e8f0' }}>หมวดหมู่</th>
                                                    <th style={{ padding: '4px 8px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#3b82f6', background: '#eff6ff', borderLeft: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 33, zIndex: 20 }}>วันนัดดำเนินการ</th>
                                                    <th style={{ padding: '4px 8px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#3b82f6', background: '#eff6ff', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 33, zIndex: 20 }}>SLA</th>
                                                    <th style={{ padding: '4px 8px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#3b82f6', background: '#eff6ff', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 33, zIndex: 20 }}>กำหนดส่ง</th>
                                                    <th style={{ padding: '4px 8px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#0d9488', background: '#f0fdf4', borderLeft: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 33, zIndex: 20 }}>วันเสร็จ</th>
                                                    <th style={{ padding: '4px 8px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#0d9488', background: '#f0fdf4', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 33, zIndex: 20 }}>+/- วัน</th>
                                                    <th style={{ padding: '4px 8px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#b45309', background: '#fff7ed', borderLeft: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 33, zIndex: 20 }}>ช่วงเวลาที่ใช้</th>
                                                    <th style={{ padding: '4px 8px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#b45309', background: '#fff7ed', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 33, zIndex: 20 }}>วันทำจริง</th>
                                                    <th style={{ padding: '4px 8px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#b45309', background: '#fff7ed', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 33, zIndex: 20 }}>ชม.รวม</th>
                                                    <th style={{ padding: '4px 8px 10px', textAlign: 'center', color: '#6d28d9', background: '#faf5ff', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 33, zIndex: 20 }}>REV.</th>
                                                    <th style={{ padding: '4px 8px 10px', textAlign: 'center', position: 'sticky', top: 33, zIndex: 20, background: '#fff', borderBottom: '2px solid #e2e8f0' }}>สถานะ</th>
                                                    <th style={{ padding: '4px 0.75rem 10px', textAlign: 'center', position: 'sticky', top: 33, zIndex: 20, background: '#fff', borderBottom: '2px solid #e2e8f0' }}>จัดการ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    let lastWoId = '';
                                                    if (filteredFlatTasks.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={14} style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                                                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            <AlertCircle size={40} opacity={0.3} />
                                                                        </div>
                                                                        <div>
                                                                            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#64748b', margin: 0 }}>ไม่พบรายการงาน</p>
                                                                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>ลองปรับเปลี่ยนช่วงเวลาหรือฟิลเตอร์ของคุณ</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return filteredFlatTasks.map((task: any, index: number) => {
                                                        const showHeader = task.woId !== lastWoId;
                                                        lastWoId = task.woId;
                                                        const p = task.dailyProgress || 0;
                                                        const isCancelled = task.woStatus === 'Cancelled' || task.woStatus === 'Rejected';
                                                        const woStatusMap: Record<string, { label: string; color: string }> = {
                                                            'Pending':           { label: 'รอประเมิน',          color: '#94a3b8' },
                                                            'Evaluating':        { label: 'รอประเมิน',          color: '#94a3b8' },
                                                            'Assigned':          { label: 'มอบหมายแล้ว',        color: '#6366f1' },
                                                            'Approved':          { label: 'มอบหมายแล้ว',        color: '#6366f1' },
                                                            'Partially Approved':{ label: 'มอบหมายบางส่วน',    color: '#a78bfa' },
                                                            'In Progress':       { label: 'กำลังดำเนินการ',     color: '#3b82f6' },
                                                            'in-progress':       { label: 'กำลังดำเนินการ',     color: '#3b82f6' },
                                                            'pending_delivery':  { label: 'รอลูกค้าประเมิน',   color: '#d97706' },
                                                            'for-checking':      { label: 'รอลูกค้าประเมิน',   color: '#d97706' },
                                                            'Completed':         { label: 'สำเร็จสมบูรณ์',     color: '#059669' },
                                                            'completed':         { label: 'สำเร็จสมบูรณ์',     color: '#059669' },
                                                            'Verified':          { label: 'สำเร็จสมบูรณ์',     color: '#059669' },
                                                            'Rejected':          { label: 'ส่งคืนแก้ไข',       color: '#ef4444' },
                                                            'Cancelled':         { label: 'ยกเลิก',             color: '#64748b' },
                                                        };
                                                        const woStatusInfo = woStatusMap[task.woStatus] ?? { label: task.woStatus || '-', color: '#94a3b8' };
                                                        const woStatusLabel = woStatusInfo.label;
                                                        const woStatusColor = woStatusInfo.color;
                                                        const nextTask = flatTasks[index + 1];
                                                        const isLastInGroup = !nextTask || nextTask.woId !== task.woId;

                                                        // ── Deadline & performance calculations ───────────────────
                                                        const _slaHrs: Record<string,number> = {'Immediately':4,'24h':24,'1-3d':72,'3-7d':168,'7-14d':336,'14-30d':720};
                                                        const _slaLabel: Record<string,string> = {'Immediately':'ด่วน','24h':'1วัน','1-3d':'3วัน','3-7d':'7วัน','7-14d':'14วัน','14-30d':'30วัน'};
                                                        const wo = task.parentWO;
                                                        const isWoCompleted = task.woStatus === 'Completed' || task.woStatus === 'completed' || task.woStatus === 'Verified';

                                                        // Task deadline — WOP: use wo.scheduledDate / wo.phActualSla when task fields absent
                                                        const isWop = !!(task as any).isPreHandover;
                                                        const rawStartStr = task.startDate || (isWop ? wo?.scheduledDate : null);
                                                        const taskStartDate = rawStartStr ? new Date(rawStartStr.split('T')[0] + 'T08:00:00') : null;
                                                        const tSlaKey = task.slaCategory || (isWop ? (wo?.phActualSla || '24h') : '24h');
                                                        const tSlaHrs = _slaHrs[tSlaKey] || 24;
                                                        const tStartMs = rawStartStr
                                                            ? new Date(rawStartStr.split('T')[0] + 'T08:00:00').getTime()
                                                            : (task.slaStartTime ? new Date(task.slaStartTime).getTime() : new Date(wo.createdAt).getTime());
                                                        const tDeadlineMs = tStartMs + tSlaHrs * 3600000;
                                                        const tDeadlineDate = new Date(tDeadlineMs);

                                                        // Completion date — วันที่งานช่างเสร็จ 100% ไม่ใช่วันที่ลูกค้ารับมอบ
                                                        const woCompletedAt = wo.completedAt ? new Date(wo.completedAt) : null;
                                                        // max(history dates) — same logic as History.tsx
                                                        // rev01 work is always later than rev00, so max = current rev's last date
                                                        let latestHistMs = 0;
                                                        (task.history || []).forEach((h: any) => {
                                                            const d = new Date(h.date).getTime();
                                                            if (!isNaN(d) && d > latestHistMs) latestHistMs = d;
                                                        });
                                                        const isTaskDone = task.dailyProgress >= 100 || task.status === 'Completed' || task.status === 'Verified' || isWoCompleted;
                                                        const taskCompletedAt = task.completedAt
                                                            ? new Date(task.completedAt)
                                                            : (isTaskDone && latestHistMs > 0)
                                                            ? new Date(latestHistMs)
                                                            : (isTaskDone && isWoCompleted && woCompletedAt ? woCompletedAt : null);

                                                        // Calendar days from startDate to completion
                                                        const tStartDate = task.startDate ? new Date(task.startDate.split('T')[0] + 'T08:00:00') : null;
                                                        const calDaysUsed = (tStartDate && taskCompletedAt)
                                                            ? Math.max(1, Math.ceil((taskCompletedAt.getTime() - tStartDate.getTime()) / 86400000)) : null;

                                                        // Distinct workdays from labor logs
                                                        const logDaysSet = new Set(
                                                            (task.history || []).map((h: any) =>
                                                                h.date || h.workDate || (h.createdAt ? h.createdAt.split('T')[0] : null)
                                                            ).filter(Boolean)
                                                        );
                                                        const logDaysCount = logDaysSet.size;

                                                        // +/- days vs task deadline
                                                        const taskDaysDiff = (isWoCompleted && taskCompletedAt)
                                                            ? Math.round((taskCompletedAt.getTime() - tDeadlineMs) / 86400000) : null;

                                                        // REV (field is string 'rev1', 'rev2', etc.)
                                                        const revNum = task.currentRevision
                                                            ? parseInt(String(task.currentRevision).replace(/[^0-9]/g, '')) || 0 : 0;

                                                        // Total labor hours — history[].labor[].expectedHours (ไม่คูณ amount)
                                                        const totalLaborHrs = (task.history || []).reduce((sum: number, h: any) =>
                                                            sum + ((h.labor || []).reduce((s: number, l: any) => {
                                                                const eh = l.expectedHours || {};
                                                                return s + (eh.normal || 0) + (eh.otNoon || 0) + (eh.otEvening || 0) + (eh.otMorning || 0);
                                                            }, 0)), 0);
                                                        // วันทำจริง: ≥8ชม. = วัน, <8ชม. = แสดงเป็นชม.
                                                        const workDaysVal = totalLaborHrs >= 8 ? Math.round(totalLaborHrs / 8) : null;
                                                        const workHrsOnly = totalLaborHrs > 0 && totalLaborHrs < 8 ? totalLaborHrs : null;

                                                        const fmtDeadline = (d: Date) => {
                                                            const dd = d.getDate().toString().padStart(2,'0');
                                                            const mm = (d.getMonth()+1).toString().padStart(2,'0');
                                                            const yy = (d.getFullYear()+543).toString().slice(-2);
                                                            return `${dd}/${mm}/${yy}`;
                                                        };
                                                        const _dash = <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>;

                                                        return (
                                                            <React.Fragment key={`${task.woId}-${task.id}`}>
                                                                {showHeader && (
                                                                    <tr>
                                                                        <td colSpan={14} style={{ padding: '5px 8px 2px 8px' }}>
                                                                            <div style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'space-between',
                                                                                padding: '4px 10px',
                                                                                background: 'linear-gradient(90deg, #f8fafc 0%, #ffffff 100%)',
                                                                                borderRadius: '8px',
                                                                                border: '1px solid #e2e8f0',
                                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                                                            }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <div style={{
                                                                                        width: '22px',
                                                                                        height: '22px',
                                                                                        borderRadius: '6px',
                                                                                        background: '#eef2ff',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center'
                                                                                    }}>
                                                                                        <FileText size={12} color="#4f46e5" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.82rem', letterSpacing: '-0.01em' }}>{task.woId}</span>
                                                                                            <span style={{
                                                                                                padding: '1px 6px',
                                                                                                background: '#4f46e5',
                                                                                                color: '#fff',
                                                                                                borderRadius: '4px',
                                                                                                fontSize: '0.62rem',
                                                                                                fontWeight: 800,
                                                                                                textTransform: 'uppercase'
                                                                                            }}>CASE</span>
                                                                                            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                                                {task.projectName} <span style={{ opacity: 0.5, margin: '0 2px' }}>•</span> {task.locationName}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>
                                                                                    สถานะ: <span style={{ color: woStatusColor, fontWeight: 800 }}>{woStatusLabel}</span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                <tr 
                                                                    className="task-row-premium"
                                                                    style={{ 
                                                                        background: '#ffffff', 
                                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                        opacity: isCancelled ? 0.5 : 1,
                                                                        position: 'relative'
                                                                    }}
                                                                >
                                                                    <td style={{ padding: '0.35rem 0.6rem', position: 'relative' }}>
                                                                        {/* Group Connector Line */}
                                                                        {!isLastInGroup && (
                                                                            <div style={{ 
                                                                                position: 'absolute', 
                                                                                left: '26px', 
                                                                                top: '1.5rem', 
                                                                                bottom: '-0.5rem', 
                                                                                width: '2px', 
                                                                                background: '#f1f5f9',
                                                                                zIndex: 0
                                                                            }} />
                                                                        )}
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1 }}>
                                                                            <div style={{ 
                                                                                width: '10px', 
                                                                                height: '10px', 
                                                                                borderRadius: '50%', 
                                                                                background: p === 100 ? '#10b981' : p > 0 ? '#3b82f6' : '#cbd5e1',
                                                                                border: '2px solid #fff',
                                                                                boxShadow: '0 0 0 1px #f1f5f9'
                                                                            }} />
                                                                            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.82rem' }}>
                                                                                {task.name || 'ไม่ระบุชื่อรายการ'}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <div style={{ padding: '3px', borderRadius: '6px', background: '#f8fafc' }}>
                                                                                <MapPin size={12} color="#94a3b8" />
                                                                            </div>
                                                                            {task.position || '-'}
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        <div style={{
                                                                            display: 'inline-flex',
                                                                            padding: '2px 7px',
                                                                            background: '#f1f5f9',
                                                                            color: '#475569',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.7rem',
                                                                            fontWeight: 700,
                                                                            border: '1px solid #e2e8f0'
                                                                        }}>
                                                                            {task.categoryName}
                                                                        </div>
                                                                    </td>

                                                                    {/* วันนัดดำเนินการ — task.startDate | GROUP BORDER: เป้าหมาย */}
                                                                    <td style={{ whiteSpace: 'nowrap', padding: '0 6px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>
                                                                        {taskStartDate ? fmtDeadline(taskStartDate) : _dash}
                                                                    </td>

                                                                    {/* SLA */}
                                                                    <td style={{ whiteSpace: 'nowrap', padding: '0 6px', textAlign: 'center' }}>
                                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366f1', background: '#eef2ff', padding: '2px 7px', borderRadius: '6px' }}>
                                                                            {_slaLabel[tSlaKey] || tSlaKey}
                                                                        </span>
                                                                    </td>

                                                                    {/* กำหนดส่ง */}
                                                                    <td style={{ whiteSpace: 'nowrap', padding: '0 6px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                                                                        {fmtDeadline(tDeadlineDate)}
                                                                    </td>

                                                                    {/* วันเสร็จ | GROUP BORDER: ผลจริง */}
                                                                    <td style={{ whiteSpace: 'nowrap', padding: '0 6px', fontSize: '0.78rem', fontWeight: 700, color: taskDaysDiff !== null ? (taskDaysDiff > 0 ? '#dc2626' : '#059669') : '#475569', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>
                                                                        {taskCompletedAt ? fmtDeadline(taskCompletedAt) : _dash}
                                                                    </td>

                                                                    {/* +/- วัน: + = เลยกำหนด = แดง, - = ก่อนกำหนด = เขียว */}
                                                                    <td style={{ whiteSpace: 'nowrap', padding: '0 6px', textAlign: 'center' }}>
                                                                        {taskDaysDiff !== null ? (
                                                                            taskDaysDiff > 0
                                                                                ? <span style={{ fontSize: '0.78rem', fontWeight: 900, padding: '2px 7px', borderRadius: '6px', background: '#fef2f2', color: '#dc2626' }}>+{taskDaysDiff}</span>
                                                                                : <span style={{ fontSize: '0.78rem', fontWeight: 900, padding: '2px 7px', borderRadius: '6px', background: '#f0fdf4', color: '#059669' }}>{taskDaysDiff}</span>
                                                                        ) : _dash}
                                                                    </td>

                                                                    {/* ช่วงเวลาทั้งหมด | GROUP BORDER: ความพยายาม */}
                                                                    <td style={{ whiteSpace: 'nowrap', padding: '0 6px', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>
                                                                        {calDaysUsed !== null
                                                                            ? <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>{calDaysUsed}<span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>วัน</span></span>
                                                                            : _dash}
                                                                    </td>

                                                                    {/* วันทำจริง */}
                                                                    <td style={{ whiteSpace: 'nowrap', padding: '0 6px', textAlign: 'center' }}>
                                                                        {workDaysVal !== null
                                                                            ? <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0891b2' }}>{workDaysVal}<span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>วัน</span></span>
                                                                            : workHrsOnly !== null
                                                                            ? <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0891b2' }}>{workHrsOnly}<span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>ชม.</span></span>
                                                                            : _dash}
                                                                    </td>

                                                                    {/* ชม. */}
                                                                    <td style={{ whiteSpace: 'nowrap', padding: '0 6px', textAlign: 'center' }}>
                                                                        {totalLaborHrs > 0
                                                                            ? <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#7c3aed' }}>{totalLaborHrs}<span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>ชม.</span></span>
                                                                            : _dash}
                                                                    </td>

                                                                    {/* REV. | GROUP BORDER: คุณภาพ */}
                                                                    <td style={{ padding: '0 6px', textAlign: 'center', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                                                        {revNum > 0
                                                                            ? <span style={{ fontSize: '0.72rem', fontWeight: 900, padding: '2px 6px', borderRadius: '6px', background: '#fef3c7', color: '#d97706' }}>REV.{revNum}</span>
                                                                            : _dash}
                                                                    </td>

                                                                    <td style={{ padding: '0 4px', textAlign: 'center' }}>
                                                                        {task.status === 'Completed' && task.evaluationStatus === 'Assigned' ? (
                                                                            <span style={{
                                                                                padding: '2px 7px',
                                                                                background: '#fff7ed',
                                                                                color: '#ea580c',
                                                                                borderRadius: '8px',
                                                                                fontSize: '0.7rem',
                                                                                fontWeight: 800,
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px',
                                                                                border: '1px solid #fed7aa'
                                                                            }}>
                                                                                <UserCheck size={14} />
                                                                                รอลูกค้าประเมิน
                                                                            </span>
                                                                        ) : (
                                                                            <span style={{
                                                                                padding: '2px 7px',
                                                                                background: p === 100 ? '#ecfdf5' : p > 0 ? '#eff6ff' : '#f8fafc',
                                                                                color: p === 100 ? '#10b981' : p > 0 ? '#3b82f6' : '#64748b',
                                                                                borderRadius: '8px',
                                                                                fontSize: '0.7rem',
                                                                                fontWeight: 800,
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '6px',
                                                                                border: `1px solid ${p === 100 ? '#d1fae5' : p > 0 ? '#dbeafe' : '#f1f5f9'}`
                                                                            }}>
                                                                                {p === 100 ? <CheckCircle2 size={14} /> : p > 0 ? <Clock size={14} /> : <AlertCircle size={14} />}
                                                                                {p === 100 ? 'เสร็จสมบูรณ์' : p > 0 ? 'กำลังดำเนินการ' : 'ยังไม่เริ่ม'}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ textAlign: 'right', paddingRight: '0.75rem' }}>
                                                                        <button 
                                                                            onClick={() => {
                                                                                setSelectedTaskHistory({
                                                                                    taskName: task.name,
                                                                                    projectName: task.projectName,
                                                                                    locationName: task.locationName,
                                                                                    history: task.history || [],
                                                                                    rejectReason: task.rejectReason || null,
                                                                                    currentRevision: task.currentRevision || null,
                                                                                    completedAt: task.completedAt || null,
                                                                                    wo: { inspectionTimeline: wo.inspectionTimeline || null, completedAt: wo.completedAt || null },
                                                                                });
                                                                            }}
                                                                            className="premium-action-btn"
                                                                            style={{
                                                                                padding: '4px 10px',
                                                                                background: '#ffffff',
                                                                                border: '1px solid #e2e8f0',
                                                                                borderRadius: '8px',
                                                                                color: '#4f46e5',
                                                                                fontSize: '0.7rem',
                                                                                fontWeight: 800,
                                                                                cursor: 'pointer',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '5px',
                                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                        >
                                                                            <Activity size={13} /> ดูประวัติงาน
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            </React.Fragment>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Executive Summary */}
                                <div style={{ gridColumn: '1/-1', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '2rem', borderRadius: '32px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>สรุปภาพรวม (Executive Summary)</h3>
                                        <p style={{ margin: '8px 0 0 0', opacity: 0.8, fontSize: '0.9rem', maxWidth: '600px' }}>
                                            จากการทำงานตั้งแต่ช่วงเวลาที่เลือก ({selectedMonth}{selectedWeek > 0 ? ` สัปดาห์ที่ ${selectedWeek}` : ''}), คุณมีความสามารถในการรักษามาตรฐาน SLA ได้ถึง {stats.slaScore}% โดยมีการบริหารจัดการแรงงานรวม {stats.internalCount + stats.outsourceCount} อัตรา สะท้อนถึงประสิทธิภาพในการควบคุมงาน {(categoryData[0] as any)?.name || 'งานซ่อม'} เป็นอันดับหนึ่ง
                                        </p>
                                    </div>
                                    <button onClick={() => window.print()} style={{ background: '#fff', color: '#0f172a', border: 'none', padding: '12px 24px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CheckCircle2 size={18} /> พิมพ์รายงานสรุป
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Labor Detail Modal */}
            {selectedLaborDetail && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ backgroundColor: '#fff', width: '1100px', maxWidth: '100%', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', animation: 'modalSlideUp 0.3s ease-out' }}>
                        <div style={{ padding: '24px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>รายละเอียดแรงงาน: {selectedLaborDetail.projectName}</h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0', fontWeight: 600 }}>
                                    {selectedLaborDetail.date ? `วันที่ ${formatDate(selectedLaborDetail.date)}` : 'สรุปภาพรวมทั้งหมด'}
                                </p>
                            </div>
                            <button onClick={() => setSelectedLaborDetail(null)} style={{ background: '#fff', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a', fontSize: '24px', fontWeight: 900 }} title="ปิดหน้าต่าง">×</button>
                        </div>
                        <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto' }}>
                            {(() => {
                                let totalW = 0, totalN = 0, totalO = 0, totalInt = 0, totalExt = 0;
                                selectedLaborDetail.woGroups?.forEach((g: any) => {
                                    g.tasks.forEach((t: any) => {
                                        t.labor?.forEach((l: any) => {
                                            const amt = l.amount || 0;
                                            totalW += amt;
                                            if (l.membership === 'Internal') totalInt += amt; else totalExt += amt;
                                            totalN += l.normalHours || 0;
                                            totalO += l.otHours || 0;
                                        });
                                    });
                                });
                                return (
                                    <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, 'repeat(3, 1fr)', 'repeat(2,1fr)'), gap: '1.5rem', marginBottom: '2.5rem' }}>
                                        <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: '24px', borderRadius: '24px', border: '1px solid #bfdbfe', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Users size={14} /> จำนวนคนงานรวม
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                <div style={{ fontSize: scaleFont(isMobile, '2rem'), fontWeight: 900, color: '#1e3a8a' }}>{totalW} <span style={{ fontSize: '1rem', fontWeight: 700 }}>คน</span></div>
                                                {totalExt > 0 && <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '12px' }}>(ใน {totalInt} / นอก {totalExt})</div>}
                                            </div>
                                        </div>
                                        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', padding: '24px', borderRadius: '24px', border: '1px solid #bbf7d0', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.08)' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={14} /> ชั่วโมงงานปกติ
                                            </div>
                                            <div style={{ fontSize: scaleFont(isMobile, '2rem'), fontWeight: 900, color: '#064e3b' }}>{totalN} <span style={{ fontSize: '1rem', fontWeight: 700 }}>ชม.</span></div>
                                        </div>
                                        <div style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)', padding: '24px', borderRadius: '24px', border: '1px solid #fbcfe8', boxShadow: '0 4px 12px rgba(236, 72, 153, 0.08)' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#be185d', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Zap size={14} /> ชั่วโมง OT
                                            </div>
                                            <div style={{ fontSize: scaleFont(isMobile, '2rem'), fontWeight: 900, color: '#831843' }}>{totalO} <span style={{ fontSize: '1rem', fontWeight: 700 }}>ชม.</span></div>
                                        </div>
                                    </div>
                                );
                            })()}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                                {selectedLaborDetail.woGroups && selectedLaborDetail.woGroups.length > 0
                                    ? selectedLaborDetail.woGroups.map((group: any, gIdx: number) => (
                                        <div key={gIdx} style={{ background: '#f8fafc', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                            <div style={{ background: '#fff', padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ background: '#4f46e5', color: '#fff', padding: '6px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>WO</div>
                                                    <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                                                        #{group.woId}
                                                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, marginLeft: '8px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '8px' }}>
                                                            ทั้งหมด {group.totalTasks} งานย่อย
                                                        </span>
                                                    </h4>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Overall Progress Delta</div>
                                                    <ProgressDeltaBar prev={group.prevOverall} delta={group.delta} isTask={false} />
                                                </div>
                                            </div>
                                            <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                                {group.tasks.map((task: any, tIdx: number) => (
                                                    <TaskItemCard 
                                                        key={tIdx} 
                                                        task={task} 
                                                        isSingleTask={group.totalTasks === 1} 
                                                        reportDate={selectedLaborDetail.date}
                                                        workOrderId={group.woId}
                                                        onUpdate={() => {
                                                            // Optional: Re-fetch or locally update the modal state if needed
                                                            // For now, alert handles feedback
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                    : (
                                        <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '32px', color: '#94a3b8', fontWeight: 700 }}>
                                            <div style={{ marginBottom: '1rem' }}><Activity size={48} style={{ opacity: 0.3, margin: '0 auto' }} /></div>
                                            ไม่มีการบันทึกงานในวันนี้
                                        </div>
                                    )}
                            </div>
                        </div>
                        <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                            <button onClick={() => setSelectedLaborDetail(null)} style={{ padding: '12px 32px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer' }}>ปิดหน้าต่าง</button>
                        </div>
                    </div>
                </div>
            )}

            {/* WOSummaryModal */}
            <WOSummaryModal
                isOpen={!!selectedBarWOs}
                onClose={() => setSelectedBarWOs(null)}
                data={selectedBarWOs}
                onViewDetail={(wo: any, type: string) => {
                    setLastBarContext(selectedBarWOs);
                    setSelectedBarWOs(null);
                    setTimeout(() => {
                        if (type === 'closed') setSelectedHistoryWO(wo);
                        else setSelectedViewWO(wo);
                    }, 50);
                }}
                selectedMonth={selectedMonth}
                getProjectName={getProjectName}
            />

            {/* WorkOrderViewModal */}
            <WorkOrderViewModal
                isOpen={!!selectedViewWO}
                onClose={() => {
                    setSelectedViewWO(null);
                    if (lastBarContext) { setSelectedBarWOs(lastBarContext); setLastBarContext(null); }
                }}
                wo={selectedViewWO}
                projects={projects || []}
            />

            {/* HistoryDetailModal */}
            {selectedHistoryWO && (
                <HistoryDetailModal
                    isOpen={!!selectedHistoryWO}
                    onClose={() => {
                        setSelectedHistoryWO(null);
                        if (lastBarContext) { setSelectedBarWOs(lastBarContext); setLastBarContext(null); }
                    }}
                    workOrder={selectedHistoryWO}
                    projects={projects}
                    staff={staff}
                    contractors={[]}
                />
            )}

            {/* TaskHistoryModal */}
            <TaskHistoryModal isOpen={!!selectedTaskHistory} onClose={() => setSelectedTaskHistory(null)} task={selectedTaskHistory} />
        </div>
    );
};

export default Dashboard;
