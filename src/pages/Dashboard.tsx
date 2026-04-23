import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
    Check
} from 'lucide-react';
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
    const displayYear = parseInt(yr) + 543;
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
    const history = [...(task.history || [])].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', width: '700px', maxWidth: '100%', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', animation: 'modalSlideUp 0.3s ease-out' }}>
                <div style={{ padding: '24px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>ประวัติการปฏิบัติงาน ({history.length} ครั้ง)</h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0', fontWeight: 600 }}>{task.taskName} | {task.locationName || task.projectName}</p>
                    </div>
                    <button onClick={onClose} style={{ background: '#fff', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
                <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto', background: '#fff' }}>
                    {history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>ยังไม่มีบันทึกการปฏิบัติงาน</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {history.map((log: any, idx: number) => {
                                const logDate = new Date(log.date);
                                const totalLabor = (log.labor || []).reduce((acc: number, l: any) => acc + (l.amount || 0), 0);
                                return (
                                    <div key={idx} style={{ padding: '20px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: log.type === 'Problem' ? '#ef4444' : '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {logDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} {logDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                                {log.type === 'Problem' && <AlertCircle size={18} color="#ef4444" />}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {log.type === 'Problem' && (
                                                    <span style={{ padding: '4px 12px', background: '#fef2f2', color: '#ef4444', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #fee2e2' }}>🚨 พบปัญหาหน้างาน</span>
                                                )}
                                                <span style={{ padding: '4px 12px', background: '#e0e7ff', color: '#4338ca', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>Progress: {log.progress}%</span>
                                                <span style={{ padding: '4px 12px', background: '#f1f5f9', color: '#475569', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>คนงาน: {totalLabor} คน</span>
                                            </div>
                                        </div>
                                        {log.taskName && (
                                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#6366f1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Activity size={14} />{log.taskName}
                                            </div>
                                        )}
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>รายละเอียดคนงาน:</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {(log.labor || []).length > 0
                                                    ? (log.labor || []).map((l: any, lIdx: number) => (
                                                        <span key={lIdx} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                            {l.role || l.skill || l.affiliation}: {l.amount} คน
                                                        </span>
                                                    ))
                                                    : <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>ไม่มีรายละเอียดรายคน</span>}
                                            </div>
                                        </div>
                                        <div style={{ padding: '12px 16px', background: log.type === 'Problem' ? '#fff1f2' : '#fff', border: log.type === 'Problem' ? '2px solid #fca5a5' : '1px solid #e2e8f0', borderRadius: '16px', boxShadow: log.type === 'Problem' ? '0 4px 6px -1px rgba(239, 68, 68, 0.1)' : 'none' }}>
                                            <div style={{ fontSize: '0.7rem', color: log.type === 'Problem' ? '#ef4444' : '#94a3b8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>หมายเหตุ:</div>
                                            <div style={{ fontSize: '0.875rem', color: log.type === 'Problem' ? '#991b1b' : '#334155', fontWeight: 600, minHeight: '1.2em' }}>{log.note || '-'}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
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
    const [hoveredBarKey, setHoveredBarKey] = useState<string | null>(null);

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
                const start = t.slaStartTime ? new Date(t.slaStartTime).getTime() : new Date(wo.createdAt).getTime();
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
            return { text: `เกินกำหนด ${timeStr}`, color: '#ef4444', bg: '#fee2e2', level: 'critical', taskName: urgentTaskName, categoryName: urgentCategoryName };
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

        // Use baseAccessibleWOs so the project list doesn't shrink when one is selected
        baseAccessibleWOs.forEach((wo: any) => {
            const created = new Date(wo.createdAt).getTime();
            const completed = wo.completedAt ? new Date(wo.completedAt).getTime() : null;
            const isActive = created <= endOfMonthTime && (!completed || completed >= startOfMonthTime);
            if (isActive) {
                statsMap[wo.projectId] = true;
            }
        });

        return projects.filter((p: any) => statsMap[p.id]);
    }, [baseAccessibleWOs, projects, selectedMonth]);

    const selectableProjects = useMemo(() => {
        if (!user || user.role !== 'Foreman') return projects;
        const accessibleProjectIds = new Set(baseAccessibleWOs.map((wo: any) => wo.projectId));
        return projects.filter((p: any) => accessibleProjectIds.has(p.id));
    }, [projects, baseAccessibleWOs, user]);

    useEffect(() => {
        if (!user) return;
        if (viewMode === 'operations') {
            if (selectedSCurveProject !== '') setSelectedSCurveProject('');
        } else {
            const currentIsValid = selectedSCurveProject === '' || availableProjectsThisMonth.some((p: any) => p.id === selectedSCurveProject);
            if (!currentIsValid) {
                setSelectedSCurveProject('');
            }
        }
    }, [availableProjectsThisMonth, selectedSCurveProject, user, viewMode]);

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
        return base;
    }, [allAccessibleWOs, selectedMonth, selectedWeek, statusFilters]);

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

        const newThisMonthData = allAccessibleWOs.filter((wo: any) => {
            const created = new Date(wo.createdAt).getTime();
            return created >= startOfMonth && created <= endOfMonth;
        });

        const carriedOverData = allAccessibleWOs.filter((wo: any) => {
            const created = new Date(wo.createdAt).getTime();
            const completed = wo.completedAt ? new Date(wo.completedAt).getTime() : null;
            if (created >= startOfMonth) return false;
            return !isWorkOrderCompleted(wo) || (completed && completed >= startOfMonth);
        });

        const newThisMonth = newThisMonthData.length;
        const carriedOver = carriedOverData.length;
        const totalInMonth = newThisMonth + carriedOver;
        const total = allAccessibleWOs.length;
        const totalAssignments = filteredWOs.length;

        let closed = filteredWOs.filter((wo: any) => isWorkOrderCompleted(wo)).length;
        let open = allAccessibleWOs.filter((wo: any) => !isWorkOrderCompleted(wo) && ['In Progress', 'Approved', 'Partially Approved', 'Pending', 'Rejected'].includes(wo.status)).length;
        let evaluating = allAccessibleWOs.filter((wo: any) => wo.status === 'Evaluating').length;
        let highRisk = 0, slaMetCount = 0, totalTaskCount = 0;

        filteredWOs.forEach((wo: any) => {
            const isFocusMatch = !highlightedWOId || wo.id?.toString().trim() === highlightedWOId?.toString().trim();
            (wo.categories || []).forEach((c: any) => {
                (c.tasks || []).forEach((t: any) => {
                    const limit = slaHoursMap[t.slaCategory || '24h'] || 24;
                    const start = t.slaStartTime ? new Date(t.slaStartTime).getTime() : new Date(wo.createdAt).getTime();

                    if (t.dailyProgress === 100 || t.status === 'Completed' || t.status === 'Verified') {
                        if (isFocusMatch) {
                            totalTaskCount++;
                        }
                        const lastUpdate = (t.history || []).slice(-1)[0];
                        const end = lastUpdate ? new Date(lastUpdate.date).getTime() : now;
                        if ((end - start) / (1000 * 3600) <= limit) {
                            if (isFocusMatch) slaMetCount++;
                        }
                    } else if (t.status !== 'Rejected') {
                        const hoursLeft = limit - (now - start) / (1000 * 3600);
                        if (hoursLeft < limit * 0.3) {
                            if (isFocusMatch) highRisk++;
                        }
                    }
                });
            });
        });

        const slaScore = totalTaskCount > 0 ? Math.round(slaMetCount / totalTaskCount * 100) : 100;
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
                    const start = t.slaStartTime ? new Date(t.slaStartTime).getTime() : woSlaStart;
                    let isSlaMet = false;
                    let duration = 0;
                    if (t.dailyProgress === 100 || t.status === 'Completed' || t.status === 'Verified') {
                        const lastUpdate = history[history.length - 1];
                        const end = lastUpdate ? new Date(lastUpdate.date).getTime() : now;

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

                        const latestNote = history.filter((h: any) => h.notes).slice(-1)[0]?.notes || t.notes || '';

                        projectAggregation[pId].cases.push({
                            id: wo.id.slice(-6),
                            fullId: wo.id,
                            taskName: t.name,
                            categoryName: c.name,
                            total: duration,
                            work: workDays * 8,
                            actualManHours: workHours,
                            target: limit,
                            ratio: duration / limit * 100,
                            deviation: 100 - (duration / limit * 100),
                            workRatio: workDays * 8 / limit * 100,
                            notes: latestNote
                        });
                        if (isSlaMet) projectAggregation[pId].slaMet++;
                        projectAggregation[pId].taskCount++;
                    }

                    const catName = t.rootCause || c.name || "ทั่วไป";
                    if (!categoryAggregation[catName]) categoryAggregation[catName] = { name: catName, count: 0, cost: 0, hours: 0, projects: {} };
                    categoryAggregation[catName].count++;
                    categoryAggregation[catName].projects[pId] = (categoryAggregation[catName].projects[pId] || 0) + 1;

                    history.forEach((h: any) => {
                        const currP = h.progress || 0;
                        const dStr = h.date.split('T')[0];
                        if (isInRange(h.date)) {
                            const d = Math.max(0, currP - lastP);
                            totalProgressDelta += d;
                            if (!dailyAggregation[dStr]) dailyAggregation[dStr] = { delta: 0, hours: 0, completedCount: 0, taskCount: 0, slaMet: 0 };
                            dailyAggregation[dStr].delta += d;
                            projectAggregation[pId].delta += d;

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
                                categoryAggregation[catName].cost += cost;
                                categoryAggregation[catName].hours += labHrs * (lab.amount || 1);
                            });
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
            projectsMap[pId].total++;
            const isCompleted = isWorkOrderCompleted(wo);
            if (isCompleted) {
                projectsMap[pId].completed++;
                projectsMap[pId].completedJobs.push({ id: wo.id, name: wo.locationName });
            } else {
                projectsMap[pId].active++;
                let lastUpdateTime = new Date(wo.createdAt).getTime();
                (wo.categories || []).forEach((c: any) => c.tasks.forEach((t: any) => (t.history || []).forEach((h: any) => {
                    const dt = new Date(h.date).getTime();
                    if (dt > lastUpdateTime) lastUpdateTime = dt;
                })));
                const isStalled = now - lastUpdateTime > 48 * 3600 * 1000;
                if (isStalled) projectsMap[pId].stalled++;
                else if (wo.status === 'Evaluating') {
                    projectsMap[pId].evaluating++;
                    projectsMap[pId].evaluatingJobs.push({ id: wo.id, name: wo.locationName });
                } else {
                    projectsMap[pId].inProgress++;
                    projectsMap[pId].inProgressJobs.push({ id: wo.id, name: wo.locationName });
                }
                const slaStatus = getSLATimeStatus(wo);
                if (slaStatus && (slaStatus.level === 'critical' || slaStatus.level === 'warning')) projectsMap[pId].highRisk++;
            }

            (wo.categories || []).forEach((c: any) => {
                if (!projectsMap[pId].categories[c.name]) projectsMap[pId].categories[c.name] = { name: c.name, total: 0, completed: 0, slaMet: 0, stalled: 0 };
                projectsMap[pId].categories[c.name].total++;
                if (isCompleted) projectsMap[pId].categories[c.name].completed++;
            });

            if (!laborByProject[pId]) laborByProject[pId] = { name: getProjectName(pId), internalWorkers: 0, outsourceWorkers: 0 };

            if (highlightedWOId && isFocusMatch) {
                closed = isWorkOrderCompleted(wo) ? 1 : 0;
                open = (!isWorkOrderCompleted(wo) && ['In Progress', 'Approved', 'Partially Approved', 'Pending', 'Rejected'].includes(wo.status)) ? 1 : 0;
                evaluating = wo.status === 'Evaluating' ? 1 : 0;
            }

            const taskMapByDate: any = {};
            (wo.categories || []).forEach((c: any) => {
                (c.tasks || []).forEach((t: any) => {
                    (t.history || []).forEach((log: any) => {
                        const dateStr = new Date(log.date).toISOString().split('T')[0];
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
            internalCount, outsourceCount, slaScore, projectStats: Object.values(projectsMap).sort((a: any, b: any) => b.total - a.total),
            stalledCases, chronicIssues, budgetPerformance: [], laborByProject: laborByProjectArray, totalAssignments,
            totalInMonth, newThisMonth, carriedOver, dueTodayCount,
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
    }, [selectedMonth, allAccessibleWOs, isWorkOrderCompleted, highlightedWOId, getProjectName, isAdminOrManager, staff]);

    const stats = useMemo<DashboardStats>(() => getDashboardStats(filteredData), [getDashboardStats, filteredData]);
    const comparisonStats = useMemo<DashboardStats>(() => getDashboardStats(comparisonFilteredData), [getDashboardStats, comparisonFilteredData]);

    const maxDevRaw = stats.laborByProject.length > 0 ? Math.max(100, ...stats.laborByProject.map((p: any) => Math.abs(p.deviation))) : 100;
    const maxDev = Math.ceil(maxDevRaw / 50) * 50;
    const devTicks = [-maxDev, -maxDev / 2, 0, maxDev / 2, maxDev].map((v) => Math.round(v));

    const handleLaborDetailClick = (projectId: string, dateStr: string) => {
        const project = projects.find((p: any) => p.id === projectId);
        if (!project || !dateStr) return;
        const woGroups: any[] = [];
        const projectWOs = workOrders.filter((wo: any) => wo.projectId === projectId);
        projectWOs.forEach((wo: any) => {
            const woTasks: any[] = [];
            let woPrevProgressSum = 0, woCurrProgressSum = 0, totalTasksInWO = 0;
            let hasActivityToday = false;
            wo.categories?.forEach((cat: any) => {
                cat.tasks.forEach((task: any) => {
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
            const opened = allAccessibleWOs.filter((wo: any) => {
                if (!wo.createdAt) return false;
                try { return new Date(wo.createdAt).toISOString().split('T')[0] === dateStr; } catch { return wo.createdAt.startsWith(dateStr); }
            });
            const closed = allAccessibleWOs.filter((wo: any) => {
                if (!isWorkOrderCompleted(wo)) return false;
                const completionTime = wo.completedAt || wo.lastUpdate || wo.createdAt;
                if (!completionTime) return false;
                try { return new Date(completionTime).toISOString().split('T')[0] === dateStr; } catch { return completionTime.startsWith(dateStr); }
            });
            const isRelatedDay = opened.some((wo: any) => wo.id?.toString().trim() === highlightedWOId?.toString().trim()) ||
                closed.some((wo: any) => wo.id?.toString().trim() === highlightedWOId?.toString().trim());
            dataPoints.push({ day: d, name: `${d} ${new Date(year, monthNum - 1).toLocaleDateString('th-TH', { month: 'short' })}`, openedCount: opened.length, closedCount: closed.length, openedWOs: opened, closedWOs: closed, isHighlighted: isRelatedDay });
        }
        return dataPoints;
    }, [allAccessibleWOs, selectedMonth, selectedWeek, highlightedWOId]);

    const sCurveData = useMemo(() => {
        if (!selectedSCurveProject || !selectedMonth || allAccessibleWOs.length === 0) return [];
        const [year, monthNum] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const startOfMonthTime = new Date(year, monthNum - 1, 1).getTime();
        const endOfMonthTime = new Date(year, monthNum, 0, 23, 59, 59).getTime();

        const dataArr = [];
        const projectWOs = allAccessibleWOs.filter((wo: any) =>
            wo.status !== 'Cancelled' &&
            !wo.isArchived &&
            new Date(wo.createdAt).getTime() <= endOfMonthTime &&
            (!wo.completedAt || new Date(wo.completedAt).getTime() >= startOfMonthTime)
        );

        if (projectWOs.length === 0) return [];

        let baselineProgressSum = 0, totalPossibleProgress = 0;
        projectWOs.forEach((wo: any) => {
            (wo.categories || []).forEach((cat: any) => {
                cat.tasks.forEach((task: any) => {
                    if (task.status === 'Cancelled' || task.status === 'Rejected') return;
                    totalPossibleProgress += 100;
                    const history = [...(task.history || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const lastLogBeforeMonth = history.filter((h: any) => new Date(h.date).getTime() < startOfMonthTime).pop();
                    baselineProgressSum += lastLogBeforeMonth ? lastLogBeforeMonth.progress || 0 : 0;
                });
            });
        });

        const potentialMonthlyGain = totalPossibleProgress - baselineProgressSum;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${monthNum.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            const endOfDayTime = new Date(year, monthNum - 1, d, 23, 59, 59).getTime();
            let dailyLabor = 0, currentProgressSum = 0, hasHighlightActivity = false;
            projectWOs.forEach((wo: any) => {
                (wo.categories || []).forEach((cat: any) => {
                    cat.tasks.forEach((task: any) => {
                        if (task.status === 'Cancelled' || task.status === 'Rejected') return;
                        const history = task.history || [];
                        const logToday = history.find((h: any) => h.date.startsWith(dateStr));
                        if (logToday) {
                            dailyLabor += (logToday.labor || []).reduce((lAcc: number, l: any) => lAcc + (l.amount || 0), 0);
                            if (wo.id?.toString().trim() === highlightedWOId?.toString().trim()) hasHighlightActivity = true;
                        }
                        const latestLogByDay = history.filter((h: any) => new Date(h.date).getTime() <= endOfDayTime).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                        currentProgressSum += latestLogByDay ? latestLogByDay.progress || 0 : 0;
                    });
                });
            });
            let currentActualRelative = potentialMonthlyGain > 0 ? Math.round((currentProgressSum - baselineProgressSum) / potentialMonthlyGain * 100) : 100;
            currentActualRelative = Math.min(100, Math.max(0, currentActualRelative));
            const idealProgress = Math.round(d / daysInMonth * 100);
            dataArr.push({ day: d, manpower: dailyLabor, progress: currentActualRelative, ideal: idealProgress, hasHighlight: hasHighlightActivity });
        }
        return dataArr;
    }, [allAccessibleWOs, selectedSCurveProject, selectedMonth, highlightedWOId]);

    if (loading || !user) return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '1rem', color: '#64748b' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>กำลังเตรียมข้อมูลแดชบอร์ด...</div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );

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
                    minWidth: '240px'
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
            {/* Sticky Header */}
            <div style={{ position: 'sticky', top: '-2rem', zIndex: 100, backgroundColor: 'rgba(248, 250, 252, 1)', backdropFilter: 'blur(12px)', paddingTop: '1rem', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', margin: '-2rem -2rem 2.5rem -2rem', paddingLeft: '2rem', paddingRight: '2rem', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                    <div style={{ minWidth: '400px' }}>
                        <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.04em', display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {!isAdminOrManager && (
                    <div style={{
                        display: 'flex', 
                        flexDirection: 'column', 
                        background: '#ffffff', 
                        padding: '12px 16px', 
                        borderRadius: '32px', 
                        border: '1px solid #e2e8f0', 
                        gap: '8px', 
                        width: '200px', 
                        height: '128px',
                        justifyContent: 'center', 
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    }}>
                            {[{ id: 'operations', label: 'ปฏิบัติการ' }, { id: 'insights', label: 'ผลงาน' }].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => setViewMode(mode.id)}
                                    style={{ width: '100%', height: '42px', borderRadius: '16px', border: 'none', background: viewMode === mode.id ? '#4f46e5' : 'transparent', color: viewMode === mode.id ? '#fff' : '#64748b', fontWeight: 900, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: viewMode === mode.id ? '0 10px 15px -3px rgba(79, 70, 229, 0.3)' : 'none' }}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <MasterFilter selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} style={{ height: '128px', padding: '24px' }} />
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: '#ffffff',
                        padding: '20px 24px',
                        borderRadius: '32px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
                        gap: '10px',
                        justifyContent: 'center',
                        width: isAdminOrManager ? '280px' : '260px',
                        height: '128px',
                        transition: 'all 0.3s ease',
                        opacity: (isAdminOrManager && adminActiveTab === 'comparison') ? 0.4 : 1,
                        pointerEvents: (isAdminOrManager && adminActiveTab === 'comparison') ? 'none' : 'auto',
                    }}>
                        {/* Clear Data Button (Top) */}
                        <button
                            disabled={!selectedForemanId && !selectedSCurveProject && !highlightedWOId && selectedWeek === 0}
                            onClick={() => {
                                setSelectedForemanId(null);
                                setSelectedSCurveProject('');
                                setHighlightedWOId(null);
                                setSelectedWeek(0);
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid #e2e8f0', paddingRight: '10px', height: '1.2rem', minWidth: '95px' }}>
                                    <Users size={16} color="#4f46e5" />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b' }}>โฟร์แมน:</span>
                                </div>
                                <select
                                    value={selectedForemanId || ''}
                                    onChange={(e) => setSelectedForemanId(e.target.value || null)}
                                    style={{ padding: '2px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 800, color: selectedForemanId ? '#4f46e5' : '#1e293b', outline: 'none', cursor: 'pointer', flex: 1, width: '100%' }}
                                >
                                    <option value="">เลือกพนักงาน</option>
                                    {activeForemen.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid #e2e8f0', paddingRight: '10px', height: '1.2rem', minWidth: '95px' }}>
                                <Activity size={16} color="#4f46e5" />
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b' }}>โครงการ:</span>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <select
                                    value={selectedSCurveProject || ''}
                                    onChange={(e) => setSelectedSCurveProject(e.target.value)}
                                    style={{ padding: '2px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 800, color: selectedSCurveProject ? '#4f46e5' : '#1e293b', outline: 'none', cursor: 'pointer', width: '100%', textOverflow: 'ellipsis' }}
                                >
                                    <option value="">ทั้งหมด</option>
                                    {availableProjectsThisMonth.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
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
                            {/* Stat Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                                <StatCard
                                    title="งานทั้งหมดที่ดูแล (Total Jobs)"
                                    value={stats.totalInMonth}
                                    icon={<Activity size={24} />}
                                    color="#3b82f6"
                                    gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                                    subtext={<span>ใหม่ <b style={{ fontSize: '1rem' }}>{stats.newThisMonth}</b> / ค้าง <b style={{ fontSize: '1rem' }}>{stats.carriedOver}</b></span>}
                                />
                                <StatCard
                                    title="งานที่ปิดจบสำเร็จ (Successfully Closed)"
                                    value={stats.closed}
                                    icon={<CheckCircle2 size={24} />}
                                    color="#10b981"
                                    gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                                    subtext="ความสำเร็จรวมที่ส่งมอบเดือนนี้"
                                />
                                <StatCard
                                    title="งานที่รอประเมิน"
                                    value={stats.evaluating}
                                    icon={<Clock size={24} />}
                                    color="#eab308"
                                    gradient={selectedOpCategory === 'evaluating' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined}
                                    style={{ cursor: 'pointer', border: selectedOpCategory === 'evaluating' ? '2px solid #f59e0b' : '1px solid #e2e8f0', boxShadow: selectedOpCategory === 'evaluating' ? '0 10px 25px -5px rgba(245, 158, 11, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)', transform: selectedOpCategory === 'evaluating' ? 'translateY(-6px)' : 'none' }}
                                    onClick={() => setSelectedOpCategory('evaluating')}
                                    subtext="งานใหม่เข้ามารอรับเรื่องและประเมิน"
                                />
                                <StatCard
                                    title="งานเร่งด่วน (Urgent SLA)"
                                    value={stats.urgentTasks?.length || 0}
                                    icon={<AlertTriangle size={24} />}
                                    color="#ef4444"
                                    gradient={selectedOpCategory === 'urgent' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : undefined}
                                    style={{ cursor: 'pointer', border: selectedOpCategory === 'urgent' ? '2px solid #ef4444' : '1px solid #e2e8f0', boxShadow: selectedOpCategory === 'urgent' ? '0 10px 25px -5px rgba(239, 68, 68, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)', transform: selectedOpCategory === 'urgent' ? 'translateY(-6px)' : 'none' }}
                                    onClick={() => setSelectedOpCategory('urgent')}
                                    subtext={<span>ใกล้ครบกำหนด <b style={{ color: '#991b1b' }}>{stats.dueTodayCount}</b> รายงานวันนี้</span>}
                                />
                            </div>

                            {/* Operations Grid - Row 1 */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
                                <div id="urgent-section" style={{ background: '#fff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column' }}>
                                    <SectionHeader
                                        title={selectedOpCategory === 'urgent' ? 'รายการดูแลเร่งด่วน (Urgent SLA)' : selectedOpCategory === 'evaluating' ? 'รายการที่รอประเมิน (Evaluating)' : 'งานที่กำลังดำเนินการ (Ongoing)'}
                                        icon={selectedOpCategory === 'urgent' ? <AlertTriangle size={20} color="#ef4444" /> : selectedOpCategory === 'evaluating' ? <Clock size={20} color="#f59e0b" /> : <Activity size={20} color="#0ea5e9" />}
                                        subtitle={selectedOpCategory === 'urgent' ? 'รายการใบงานที่ต้องรีบดำเนินการเพื่อรักษามาตรฐาน SLA' : selectedOpCategory === 'evaluating' ? 'รายการใบงานใหม่ที่รอการตรวจสอบหน้างานจริง' : 'รายการใบงานที่ช่างกำลังเริ่มปฏิบัติงานในขณะนี้'}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '1rem', maxHeight: '550px', overflowY: 'auto', paddingRight: '8px' }}>
                                        {(() => {
                                            if (selectedOpCategory === 'urgent') {
                                                const items = stats.urgentTasks || [];
                                                return items.length > 0 ? items.map((task: any, idx: number) => {
                                                    const tId = task.woId || task.id || '';
                                                    return (
                                                        <div key={`urgent-${idx}`} onClick={() => navigate(`/daily-report?id=${tId}`)} style={{ padding: '1.25rem 1.5rem', background: '#fff1f1', borderRadius: '24px', border: '1px solid #fecaca', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease' }} onMouseOver={(e) => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateX(0)')}>
                                                            <div>
                                                                <div style={{ fontWeight: 900, color: '#991b1b', fontSize: '1.1rem', marginBottom: '2px' }}>#{tId.slice(-6)}</div>
                                                                <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 800 }}>
                                                                    {task.statusInfo?.categoryName && (
                                                                        <span style={{ color: '#ef4444', marginRight: '6px' }}>[{task.statusInfo.categoryName}]</span>
                                                                    )}
                                                                    {task.taskName}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>🏗️ {getProjectName(workOrders.find((w: any) => w.id === tId)?.projectId || '')}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontWeight: 900, color: '#ef4444', fontSize: '0.95rem', background: '#fee2e2', padding: '4px 10px', borderRadius: '10px' }}>{task.statusInfo?.text || 'ด่วน'}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '4px', fontWeight: 800 }}>เลทตัวคูณ SLA</div>
                                                            </div>
                                                        </div>
                                                    );
                                                }) : <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>ไม่มีงานด่วนคงค้างในขณะนี้ 🎉</div>;
                                            } else if (selectedOpCategory === 'evaluating') {
                                                const items = allAccessibleWOs.filter((wo: any) => wo.status === 'Evaluating');
                                                return items.length > 0 ? items.map((wo: any) => (
                                                    <div key={`eval-${wo.id}`} onClick={() => navigate(`/work-orders?id=${wo.id}`)} style={{ padding: '1.25rem 1.5rem', background: '#fffbeb', borderRadius: '24px', border: '1px solid #fef3c7', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease' }} onMouseOver={(e) => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateX(0)')}>
                                                        <div>
                                                            <div style={{ fontWeight: 900, color: '#92400e', fontSize: '1.1rem', marginBottom: '2px' }}>{wo.id}</div>
                                                            <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 700 }}>{wo.locationName}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>🏗️ {getProjectName(wo.projectId)}</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontWeight: 900, color: '#d97706', fontSize: '0.85rem', background: '#fef3c7', padding: '4px 12px', borderRadius: '10px', display: 'inline-block' }}>รอประเมิน</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '4px', fontWeight: 600 }}>งานใหม่เข้าวันนี้</div>
                                                        </div>
                                                    </div>
                                                )) : <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>ไม่มีงานรอประเมิน ขอบคุณที่เคลียร์งานครับ! 👍</div>;
                                            } else {
                                                const items = allAccessibleWOs.filter((wo: any) => !isWorkOrderCompleted(wo) && ['In Progress', 'Approved', 'Partially Approved', 'Pending', 'Rejected'].includes(wo.status));
                                                return items.length > 0 ? items.map((wo: any) => {
                                                    const slaStatus = getSLATimeStatus(wo);
                                                    return (
                                                        <div key={`ongoing-${wo.id}`} onClick={() => navigate(`/daily-report?id=${wo.id}`)} style={{ padding: '1.25rem 1.5rem', background: '#f0f9ff', borderRadius: '24px', border: '1px solid #bae6fd', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease' }} onMouseOver={(e) => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateX(0)')}>
                                                            <div>
                                                                <div style={{ fontWeight: 900, color: '#075985', fontSize: '1.1rem', marginBottom: '2px' }}>{wo.id}</div>
                                                                <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 700 }}>{wo.locationName}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>🏗️ {getProjectName(wo.projectId)}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontWeight: 900, color: slaStatus?.level === 'danger' || slaStatus?.level === 'warning' ? '#ef4444' : '#0369a1', fontSize: '0.9rem', background: slaStatus?.level === 'danger' || slaStatus?.level === 'warning' ? '#fee2e2' : '#e0f2fe', padding: '6px 14px', borderRadius: '12px', display: 'inline-block' }}>
                                                                    {slaStatus?.text || 'ปกติ'}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#0369a1', marginTop: '4px', fontWeight: 600 }}>กำลังช่างดำเนินการ</div>
                                                            </div>
                                                        </div>
                                                    );
                                                }) : <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>ไม่มีงานค้างในช่วงนี้</div>;
                                            }
                                        })()}
                                    </div>
                                </div>

                                <div style={{ background: '#fff', padding: '2rem', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
                                    <SectionHeader title="ภาระงานแยกโครงการ" icon={<BarChart3 size={20} />} subtitle="สถานะปัจจุบันแยกตามไซต์งาน" />
                                    <div style={{ height: '350px', width: '100%', marginTop: '1rem' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={stats.projectStats}
                                                layout="vertical"
                                                margin={{ left: 30 }}
                                                barGap={2}
                                                onMouseLeave={() => setHoveredBarKey(null)}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} width={80} />
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    content={<WorkloadTooltip />}
                                                />
                                                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.8rem', fontWeight: 700, paddingBottom: '10px' }} />
                                                <Bar
                                                    dataKey="completed"
                                                    name="ดำเนินการเสร็จสิ้น"
                                                    stackId="a"
                                                    fill="#10b981"
                                                    radius={[0, 0, 0, 0]}
                                                    barSize={14}
                                                    onMouseEnter={() => setHoveredBarKey('completed')}
                                                />
                                                <Bar
                                                    dataKey="inProgress"
                                                    name="กำลังดำเนินการ"
                                                    stackId="a"
                                                    fill="#0ea5e9"
                                                    radius={[0, 0, 0, 0]}
                                                    barSize={14}
                                                    onMouseEnter={() => setHoveredBarKey('inProgress')}
                                                />
                                                <Bar
                                                    dataKey="evaluating"
                                                    name="รอประเมิน"
                                                    stackId="a"
                                                    fill="#eab308"
                                                    radius={[0, 4, 4, 0]}
                                                    barSize={14}
                                                    onMouseEnter={() => setHoveredBarKey('evaluating')}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                        </>
                    ) : (
                        /* Insights Mode */
                        <>
                            {/* Stat Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                                <StatCard
                                    title="งานทั้งหมดที่ดูแล (Total Jobs)"
                                    value={stats.totalInMonth}
                                    icon={<Activity size={24} />}
                                    color="#3b82f6"
                                    gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                                    subtext={isForeman
                                        ? (<span>ใหม่ <b style={{ fontSize: '0.9rem' }}>{stats.newThisMonth}</b> / ค้าง <b style={{ fontSize: '0.9rem' }}>{stats.carriedOver}</b></span>)
                                        : (<span>ใหม่ <b style={{ fontSize: '0.9rem' }}>{stats.newThisMonth}</b> / ค้าง <b style={{ fontSize: '0.9rem' }}>{stats.carriedOver}</b> (รวมทั้งฟิลเตอร์)</span>)
                                    }
                                />
                                <StatCard
                                    title="งานที่ปิดจบสำเร็จ (Successfully Closed)"
                                    value={stats.closed}
                                    icon={<CheckCircle2 size={24} />}
                                    color="#10b981"
                                    gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                                    subtext="ความสำเร็จรวมที่ส่งมอบเดือนนี้"
                                />
                                <StatCard title="ประสิทธิภาพ SLA เฉลี่ย" value={`${stats.slaScore}%`} icon={<TrendingUp size={24} />} color="#4f46e5" gradient="linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)" subtext={stats.slaScore > 80 ? 'อยู่ในเกณฑ์ดีเยี่ยม' : 'ควรปรับปรุงความเร็ว'} />
                                <StatCard title="ชั่วโมงการทำงานรวม" value={`${stats.totalHours.toLocaleString()} ชม.`} icon={<Activity size={24} />} color="#8b5cf6" gradient="linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" subtext="ลงแรงงานจริงสะสมรายเดือน" />
                            </div>

                            {/* SLA Analysis Section - MOVED TO TOP */}
                            <div id="analytics-detail-section" className={highlightedSection === 'analytics-detail-section' ? 'section-highlight' : ''} style={{ background: '#ffffff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', marginBottom: '2.5rem', transition: 'all 0.5s' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    {(() => {
                                        const isDetailMode = !!selectedSCurveProject || !!drillDownProject;
                                        const detailName = selectedSCurveProject ? getProjectName(selectedSCurveProject) : drillDownProject;
                                        return (
                                            <>
                                                <SectionHeader
                                                    title={isDetailMode ? `เจาะลึก SLA: ${detailName} ${selectedSCurveProject ? '(ตามฟิลเตอร์)' : '(15 รายการล่าสุด)'}` : 'วิเคราะห์ประสิทธิภาพ SLA รายโครงการ (Project SLA Analysis)'}
                                                    icon={<TrendingUp size={24} />}
                                                    subtitle={isDetailMode ? `รายละเอียดใบงานและระดับความเบี่ยงเบน SLA ในไซต์ ${detailName}` : 'ร้อยละความสำเร็จตามกำหนด SLA เฉลี่ยของทุกประเภท (เป้าหมาย 100%)'}
                                                />
                                            </>
                                        );
                                    })()}
                                </div>
                                {drillDownProject && !selectedSCurveProject && (
                                    <button onClick={() => setDrillDownProject(null)} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }}>
                                        ← ย้อนกลับไปดูทุกโครงการ
                                    </button>
                                )}
                                {selectedSCurveProject && (
                                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4f46e5', background: '#eff6ff', padding: '8px 16px', borderRadius: '12px', display: 'inline-block' }}>
                                            ✨ กำลังแสดงรายละเอียดเจาะลึก: {getProjectName(selectedSCurveProject)}
                                        </div>
                                        <button
                                            onClick={() => { setSelectedSCurveProject(''); setHighlightedWOId(null); }}
                                            style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                        >
                                            <X size={14} /> ล้างฟิลเตอร์โครงการ
                                        </button>

                                        {highlightedWOId && (
                                            <div style={{ padding: '8px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'pulse 2s infinite' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></div>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#92400e' }}>กำลังเน้นใบงาน: {highlightedWOId && highlightedWOId.includes('-') ? highlightedWOId.split('-').slice(-2).join('-') : (highlightedWOId || '-')}</span>
                                                <button
                                                    onClick={() => setHighlightedWOId(null)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#b45309', display: 'flex' }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {!drillDownProject && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 60px', marginBottom: '12px', position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
                                        <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 900 }}>← ล่าช้ากว่ากำหนด (DELAY)</div>
                                        <div style={{ color: '#475569', fontSize: '12px', fontWeight: 900, textAlign: 'center' }}>มาตรฐาน SLA (On-Time)</div>
                                        <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 900, textAlign: 'right' }}>ไวกว่ากำหนด (เสร็จเร็ว) →</div>
                                    </div>
                                )}
                                <div style={{ height: (selectedSCurveProject || drillDownProject) ? '400px' : '500px', position: 'relative', overflowY: 'auto', overflowX: 'hidden', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                                    <ResponsiveContainer width="100%" height={(selectedSCurveProject || drillDownProject) ? '100%' : Math.max(stats.laborByProject.length * 50, 400)}>
                                        <BarChart
                                            data={(selectedSCurveProject || drillDownProject)
                                                ? (stats.laborByProject.find((p: any) => p.id === selectedSCurveProject || p.name === drillDownProject)?.cases || [])
                                                : stats.laborByProject}
                                            layout="vertical"
                                            margin={{ left: 40, right: 40, top: 70, bottom: 20 }}
                                            barGap={-24}
                                            style={{ cursor: 'pointer' }}
                                            onClick={(state: any) => {
                                                if (state && state.activePayload && state.activePayload.length > 0) {
                                                    const data = state.activePayload[0].payload;
                                                    if (selectedSCurveProject || drillDownProject) {
                                                        const id = data.fullId || data.id;
                                                        if (id) {
                                                            setHighlightedWOId(highlightedWOId === id ? null : id);
                                                        }
                                                    } else {
                                                        if (data.id) setSelectedSCurveProject(data.id);
                                                        else if (data.name) setDrillDownProject(data.name);
                                                    }
                                                }
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" axisLine={false} tickLine={false} orientation="top" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} domain={[-maxDev, maxDev]} ticks={devTicks} tickFormatter={(v) => v === 0 ? '0' : v > 0 ? `+${v}%` : `${v}%`} />
                                            <YAxis dataKey={(selectedSCurveProject || drillDownProject) ? 'id' : 'name'} type="category" axisLine={false} tickLine={false} tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }} width={140} />
                                            <Tooltip
                                                content={(props: any) => {
                                                    const { active, payload } = props;
                                                    if (!active || !payload || !payload[0]) return null;
                                                    const data = payload[0].payload;
                                                    const isDetail = !!(selectedSCurveProject || drillDownProject);

                                                    if (isDetail) {
                                                        const dev = data.deviation || 0;
                                                        const isDelayed = dev < 0;

                                                        // Common Inline Styles for consistency
                                                        const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' };
                                                        const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#64748b', fontWeight: 600 };
                                                        const valueStyle: React.CSSProperties = { fontSize: '13px', color: '#1e293b', fontWeight: 800 };

                                                        return (
                                                            <div style={{
                                                                background: '#ffffff',
                                                                border: '1px solid #e2e8f0',
                                                                padding: '20px',
                                                                borderRadius: '16px',
                                                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                                                minWidth: '300px',
                                                                zIndex: 1000
                                                            }}>
                                                                {/* Header */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                                                                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>เลขที่ใบงาน: {data.fullId || data.id}</span>
                                                                    <span style={{
                                                                        fontSize: '10px',
                                                                        fontWeight: 900,
                                                                        padding: '4px 10px',
                                                                        borderRadius: '20px',
                                                                        background: isDelayed ? '#fef2f2' : '#f0f9ff',
                                                                        color: isDelayed ? '#ef4444' : '#0284c7',
                                                                        border: `1px solid ${isDelayed ? '#fee2e2' : '#e0f2fe'}`
                                                                    }}>
                                                                        {isDelayed ? '⚠ ล่าช้า' : '✓ ปกติ'}
                                                                    </span>
                                                                </div>

                                                                {/* Task Info */}
                                                                <div style={{ marginBottom: '16px' }}>
                                                                    <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 900, lineHeight: 1.4 }}>{data.taskName || 'งานไม่ระบุชื่อ'}</h4>
                                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>หมวดหมู่: <span style={{ color: '#334155' }}>{data.categoryName || '-'}</span></div>
                                                                </div>

                                                                {/* Metrics Grid */}
                                                                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                                    <div style={rowStyle}>
                                                                        <span style={labelStyle}>เป้าหมาย (SLA):</span>
                                                                        <span style={valueStyle}>{data.target?.toFixed(0)} ชม.</span>
                                                                    </div>
                                                                    <div style={{ ...rowStyle, borderTop: '1px solid #edf2f7', paddingTop: '8px' }}>
                                                                        <span style={labelStyle}>เวลาที่ใช้ทั้งหมด:</span>
                                                                        <div style={{ textAlign: 'right' }}>
                                                                            <span style={{ ...valueStyle, color: isDelayed ? '#ef4444' : '#1e293b' }}>{data.total?.toFixed(1)} ชม.</span>
                                                                            <span style={{ fontSize: '10px', color: isDelayed ? '#f87171' : '#60a5fa', display: 'block', fontWeight: 800 }}>
                                                                                ({Math.abs(dev).toFixed(0)}% {isDelayed ? 'ช้ากว่าเป้า' : 'เร็วกว่าเป้า'})
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ ...rowStyle, borderTop: '1px solid #edf2f7', paddingTop: '8px', marginBottom: 0 }}>
                                                                        <span style={{ ...labelStyle, color: '#4f46e5' }}>เวลาทำงานจริง (Daily):</span>
                                                                        <span style={{ ...valueStyle, color: '#4f46e5', fontSize: '15px' }}>{data.actualManHours?.toFixed(1)} ชม.</span>
                                                                    </div>
                                                                </div>

                                                                {/* Notes */}
                                                                {data.notes && (
                                                                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dotted #e2e8f0' }}>
                                                                        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>หมายเหตุจากหน้างาน:</span>
                                                                        <p style={{ margin: 0, fontSize: '11px', color: '#475569', fontStyle: 'italic', lineHeight: 1.5 }}>"{data.notes}"</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#1e293b', fontWeight: 800 }}>{data.name}</p>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                                                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>SLA Performance:</span>
                                                                <span style={{ fontSize: '14px', color: data.deviation < 0 ? '#ef4444' : '#10b981', fontWeight: 900 }}>
                                                                    {data.deviation > 0 ? `+${Math.abs(data.deviation).toFixed(1)}%` : `${data.deviation.toFixed(1)}%`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                            />
                                            <ReferenceLine x={0} stroke="#475569" strokeWidth={3}>
                                                <Label value="มาตรฐาน SLA (On-Time)" position="top" offset={45} fill="#475569" fontSize={13} fontWeight={900} />
                                            </ReferenceLine>
                                            {(selectedSCurveProject || drillDownProject) ? (
                                                <Bar
                                                    dataKey="deviation"
                                                    radius={0}
                                                    barSize={28}
                                                    onClick={(data: any) => {
                                                        if (data && (data.fullId || data.id)) {
                                                            setHighlightedWOId(highlightedWOId === (data.fullId || data.id) ? null : (data.fullId || data.id));
                                                        }
                                                    }}
                                                >
                                                    {(stats.laborByProject.find((p: any) => p.id === selectedSCurveProject || p.name === drillDownProject)?.cases || []).map((entry: any, index: number) => {
                                                        const isHighlighted = highlightedWOId === entry.fullId;
                                                        return (
                                                            <Cell
                                                                key={`cell-detail-${index}`}
                                                                fill={entry.deviation < 0 ? '#ef4444' : '#10b981'}
                                                                fillOpacity={(!highlightedWOId || isHighlighted) ? 1 : 0.2}
                                                                stroke={isHighlighted ? '#1e293b' : 'none'}
                                                                strokeWidth={2}
                                                            />
                                                        );
                                                    })}
                                                    <LabelList
                                                        dataKey="deviation"
                                                        position="center"
                                                        content={(props: any) => {
                                                            const { x, y, width, height, value } = props;
                                                            const isSmall = Math.abs(width) < 50;
                                                            return (
                                                                <text x={x + width / 2} y={y + height / 2} dy={4} textAnchor="middle" fill={isSmall ? '#1e293b' : '#fff'} fontSize={10} fontWeight={800} style={{ pointerEvents: 'none' }}>
                                                                    {value > 0 ? `+${value.toFixed(0)}%` : `${value.toFixed(0)}%`}
                                                                </text>
                                                            );
                                                        }}
                                                    />
                                                </Bar>
                                            ) : (
                                                <Bar
                                                    dataKey="deviation"
                                                    radius={0}
                                                    barSize={28}
                                                    onClick={(data: any) => {
                                                        if (data && data.id) setSelectedSCurveProject(data.id);
                                                        else if (data && data.name) setDrillDownProject(data.name);
                                                    }}
                                                >
                                                    {stats.laborByProject.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={entry.deviation < 0 ? '#ef4444' : '#10b981'} />
                                                    ))}
                                                    <LabelList
                                                        dataKey="taskCount"
                                                        position="center"
                                                        content={(props: any) => {
                                                            const { x, y, width, height, value } = props;
                                                            if (selectedSCurveProject || drillDownProject) return null;
                                                            const isSmall = Math.abs(width) < 50;
                                                            return <text x={x + width / 2} y={y + height / 2} dy={4} textAnchor="middle" fill={isSmall ? '#1e293b' : '#fff'} fontSize={10} fontWeight={800} style={{ pointerEvents: 'none' }}>{value} งาน</text>;
                                                        }}
                                                    />
                                                </Bar>
                                            )}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {!(selectedSCurveProject || drillDownProject) && <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>* คลิกที่แท่งของแต่ละโครงการเพื่อเจาะดูรายละเอียดรายใบงาน (Drill-down)</div>}
                            </div>

                            {/* Charts Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                                <div style={{ background: '#fff', padding: '2rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                    <SectionHeader
                                        title="สถิติการเปิด-ปิดใบงาน (Work Order Stats)"
                                        icon={<TrendingUp size={22} />}
                                        subtitle={`สรุปจำนวนการเปิดงานใหม่และปิดงานสำเร็จราย${selectedWeek === 0 ? 'เดือน' : `สัปดาห์ที่ ${selectedWeek}`}`}
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
                                                        return `${value} ${monthNames[parseInt(mn) - 1]} ${parseInt(yr) + 543}`;
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
                                            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#1e293b', lineHeight: 1.1 }}>
                                                {((stats.internalHours || 0) + (stats.outsourceHours || 0)).toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4f46e5' }}>ชม. งาน</div>
                                        </div>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart key={`pie-${highlightedWOId || 'none'}`}>
                                                <Pie data={stats.laborStats} cx="50%" cy="45%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                                                    {stats.laborStats.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* S-Curve Chart */}
                            <div style={{ gridColumn: '1/-1', background: '#ffffff', borderRadius: '32px', padding: '2.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', marginBottom: '2.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', padding: '14px', borderRadius: '18px', color: '#fff' }}>
                                            <TrendingUp size={28} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>วิเคราะห์ความสัมพันธ์ แรงงาน vs ความคืบหน้า (S-Curve)</h3>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>เปรียบเทียบการลงแรงงานรายวันเทียบกับการสะสมงานของโครงการรายเดือน</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ height: '400px', width: '100%' }}>
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
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <defs>
                                                <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700, dy: 5 }} label={{ value: 'วันที่ในเดือน', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11, fontWeight: 800 }} />
                                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#ef4444', fontSize: 12, fontWeight: 700 }} label={{ value: 'จำนวนคน (แรง)', angle: -90, position: 'insideLeft', offset: 15, fill: '#ef4444', fontSize: 11, fontWeight: 800 }} />
                                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fill: '#3b82f6', fontSize: 12, fontWeight: 700 }} label={{ value: 'ความคืบหน้า (%)', angle: 90, position: 'insideRight', offset: 15, fill: '#3b82f6', fontSize: 11, fontWeight: 800 }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 700 }}
                                                formatter={(value: any, name: any) => {
                                                    const thaiNames: any = { ideal: 'เป้าหมายมาตรฐาน', manpower: 'จำนวนแรงงานรวม', progress: 'ความคืบหน้าจริง' };
                                                    const unit = name === 'manpower' ? ' แรง' : '%';
                                                    return [`${value}${unit}`, thaiNames[name] || name];
                                                }}
                                                labelFormatter={(label) => `วันที่ ${label}`}
                                            />
                                            <Legend verticalAlign="top" content={renderSCurveLegend} />
                                            {selectedMonth && (() => {
                                                const [year, month] = selectedMonth.split('-');
                                                const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
                                                const sundays: number[] = [];
                                                for (let d = 1; d <= daysInMonth; d++) {
                                                    if (new Date(parseInt(year), parseInt(month) - 1, d).getDay() === 0) sundays.push(d);
                                                }
                                                return sundays.map((day) => <ReferenceLine key={`week-end-${day}`} x={day} yAxisId="right" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />);
                                            })()}
                                            {highlightedWOId && (
                                                <Line
                                                    yAxisId="left"
                                                    type="monotone"
                                                    dataKey={(entry: any) => entry.hasHighlight ? entry.manpower : null}
                                                    stroke="none"
                                                    dot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                                                    name="กิจกรรมของใบงานที่เน้น"
                                                />
                                            )}
                                            {selectedMonth && (() => {
                                                const d = new Date();
                                                const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                                if (selectedMonth === currentMonthStr) {
                                                    return <ReferenceLine x={d.getDate()} yAxisId="right" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 5" label={{ position: 'top', value: 'วันนี้', fill: '#2563eb', fontSize: 10, fontWeight: 900 }} />;
                                                }
                                                return null;
                                            })()}
                                            <Area yAxisId="right" type="monotone" dataKey="progress" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorProgress)" name="progress" />
                                            <Line
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="manpower"
                                                stroke="#ef4444"
                                                strokeWidth={2}
                                                dot={(props: any) => {
                                                    const { cx, cy, payload } = props;
                                                    if (payload.hasHighlight) return <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                                                    return <circle cx={cx} cy={cy} r={3} fill="#ef4444" />;
                                                }}
                                                activeDot={{ r: 8 }}
                                                name="manpower"
                                            />
                                            <Line yAxisId="right" type="monotone" dataKey="ideal" stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 5" dot={false} name="ideal" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>




                            {/* Activity Calendar Section */}
                            {(isForeman || isAdminOrManager) && (
                                <div id="activity-calendar-section" className={highlightedSection === 'activity-calendar-section' ? 'section-highlight' : ''} style={{ marginBottom: '2.5rem', transition: 'all 0.5s', borderRadius: '32px' }}>
                                    {(!isForeman && !selectedForemanId) ? (
                                        <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '4rem 2rem', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                            <div style={{ background: '#f5f3ff', width: '80px', height: '80px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', margin: '0 auto 1.5rem auto' }}>
                                                <Clock size={40} />
                                            </div>
                                            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', marginBottom: '12px' }}>ประวัติการเข้าปฏิบัติงาน (Activity Calendar)</h3>
                                            <p style={{ color: '#64748b', fontWeight: 600, maxWidth: '500px', margin: '0 auto', fontSize: '1rem', lineHeight: 1.6 }}>
                                                กรุณาเลือก <span style={{ color: '#4f46e5', fontWeight: 800 }}>"รายชื่อพนักงาน"</span> จากตัวกรองด้านบน <br />
                                                เพื่อเรียกดูปฏิทินการทำงาน รายละเอียดชั่วโมง Normal/OT และรูปภาพหน้างานย่อย
                                            </p>
                                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                                <div style={{ padding: '8px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Users size={16} /> ติดตามประสิทธิภาพรายบุคคล
                                                </div>
                                                <div style={{ padding: '8px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <TrendingUp size={16} /> ตรวจสอบความคืบหน้ารายวัน
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

                            {/* Bottom Grid: Category + Project Track + Job Details + Executive Summary */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                <div style={{ background: '#fff', padding: '2rem', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
                                    <SectionHeader title="สถิติแยกตามหมวดหมู่ (Category Analysis)" icon={<BarChart3 size={20} />} subtitle="สัดส่วนจำนวนงานที่ได้รับมอบหมายแยกตามประเภท" />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {categoryData.map((cat: any, idx: number) => (
                                            <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ width: '40px', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>#{idx + 1}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{cat.name} </span>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4f46e5' }}>{cat.value} งาน</span>
                                                    </div>
                                                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${(cat as any).value / ((categoryData[0] as any)?.value || 1) * 100}%`, height: '100%', background: '#4f46e5', borderRadius: '4px' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div id="project-track-section" className={highlightedSection === 'project-track-section' ? 'section-highlight' : ''} style={{ background: '#fff', padding: '2rem', borderRadius: '32px', border: '1px solid #e2e8f0', transition: 'all 0.5s' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <SectionHeader title="ผลงานแยกตามโครงการ (Project Performance Summary)" icon={<Activity size={20} />} subtitle="สรุปข้อมูลการดำเนินงานและความรวดเร็วแยกโครงการ" />
                                        {(selectedSCurveProject || drillDownProject) && (
                                            <button
                                                onClick={() => { setSelectedSCurveProject(''); setDrillDownProject(null); }}
                                                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, padding: '6px 12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <X size={14} /> ดูโครงการทั้งหมด
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 2px' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                                    <th style={{ padding: '0 1rem' }}>โครงการ</th>
                                                    <th style={{ textAlign: 'center' }}>เคสทั้งหมด</th>
                                                    <th style={{ textAlign: 'center' }}>ทำเสร็จทันกำหนด</th>
                                                    <th style={{ textAlign: 'center' }}>ความคุ้มค่า (ROI)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const activePName = selectedSCurveProject ? getProjectName(selectedSCurveProject) : drillDownProject;
                                                    const displayData = activePName
                                                        ? stats.laborByProject.filter((p: any) => p.name === activePName)
                                                        : stats.laborByProject;

                                                    return displayData.map((p: any) => (
                                                        <tr key={p.name} style={{ background: '#ffffff' }}>
                                                            <td style={{ padding: '11px 1rem', fontWeight: 700, color: '#334155', borderRadius: '12px 0 0 12px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.slaScore >= 80 ? '#10b981' : p.slaScore >= 50 ? '#f59e0b' : '#ef4444' }} />
                                                                    {p.name}
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#4f46e5' }}>{p.total} เคส</td>
                                                            <td style={{ textAlign: 'center', fontWeight: 800, color: p.slaScore >= 80 ? '#10b981' : '#f59e0b' }}>
                                                                {p.slaScore}% ทันเวลา
                                                            </td>
                                                            <td style={{ textAlign: 'center', borderRadius: '0 12px 12px 0' }}>
                                                                <span style={{ padding: '4px 10px', borderRadius: '20px', background: parseFloat(p.productivity) >= 20 ? '#dcfce7' : '#fef3c7', color: parseFloat(p.productivity) >= 20 ? '#166534' : '#92400e', fontSize: '0.75rem', fontWeight: 900 }}>
                                                                    {p.productivity}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Job Performance Details */}
                                <div id="job-details-section" className={highlightedSection === 'job-details-section' ? 'section-highlight' : ''} style={{ gridColumn: '1/-1', background: '#ffffff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', transition: 'all 0.5s' }}>
                                    <SectionHeader title="รายละเอียดงานที่ดำเนินการ (Job Performance Details)" icon={<Activity size={24} />} subtitle="รายการใบงานทั้งหมดที่คุณรับผิดชอบในช่วงเวลาที่เลือก" />
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                                    <th style={{ padding: '0 1rem' }}>ID งาน</th>
                                                    <th>โครงการ / สถานที่</th>
                                                    <th>หมวดหมู่</th>
                                                    <th>สถานะ</th>
                                                    <th>ความคืบหน้า</th>
                                                    <th style={{ textAlign: 'right' }}>ดำเนินการ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredData.map((wo: any) => {
                                                    let totalP = 0, tCount = 0;
                                                    wo.categories?.forEach((c: any) => c.tasks.forEach((t: any) => {
                                                        if (t.status !== 'Rejected') { totalP += t.dailyProgress || 0; tCount++; }
                                                    }));
                                                    const p = tCount > 0 ? Math.round(totalP / tCount) : 0;
                                                    const isCancelled = wo.isArchived || wo.status === 'Rejected' || wo.status === 'Cancelled';
                                                    const isCompleted = wo.status === 'Completed' || (p === 100 && tCount > 0);
                                                    const label = isCancelled ? 'ยกเลิก' : isCompleted ? 'เสร็จสิ้น' : wo.status === 'Evaluating' ? 'รอประเมิน' : 'กำลังดำเนินการ';
                                                    const statusColor = isCancelled ? '#991b1b' : isCompleted ? '#166534' : wo.status === 'Evaluating' ? '#0369a1' : '#92400e';
                                                    const statusBg = isCancelled ? '#fee2e2' : isCompleted ? '#dcfce7' : wo.status === 'Evaluating' ? '#e0f2fe' : '#fef3c7';
                                                    const hasProblem = wo.categories?.some((c: any) => c.tasks.some((t: any) => t.history?.some((h: any) => h.type === 'Problem')));
                                                    const isHighlightedTarget = highlightedWOId?.toString().trim() === wo.id?.toString().trim();
                                                    return (
                                                        <tr
                                                            key={wo.id}
                                                            style={{
                                                                background: isHighlightedTarget ? '#eff6ff' : '#f8fafc',
                                                                borderRadius: '12px',
                                                                boxShadow: isHighlightedTarget ? '0 0 0 2px #3b82f6 inset' : 'none',
                                                                transition: 'all 0.3s ease',
                                                                transform: isHighlightedTarget ? 'scale(1.002)' : 'none',
                                                                zIndex: isHighlightedTarget ? 2 : 1,
                                                                position: 'relative'
                                                            }}
                                                        >
                                                            <td style={{ padding: '1rem', fontWeight: 800, color: '#0f172a', borderRadius: '12px 0 0 12px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    {hasProblem && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 2px #fff, 0 0 8px rgba(239, 68, 68, 0.4)' }} />}
                                                                    {wo.id}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>{getProjectName(wo.projectId)}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{wo.locationName}</div>
                                                            </td>
                                                            <td style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>{wo.categories?.[0]?.name || '-'}</td>
                                                            <td>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', color: statusColor, backgroundColor: statusBg }}>
                                                                    {label}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', width: '80px' }}>
                                                                        <div style={{ width: `${p}%`, height: '100%', background: p === 100 ? '#10b981' : '#4f46e5', borderRadius: '3px' }} />
                                                                    </div>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b' }}>{p}%</span>
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'right', paddingRight: '1rem', borderRadius: '0 12px 12px 0' }}>
                                                                <button
                                                                    onClick={() => {
                                                                        const allHistory: any[] = [];
                                                                        wo.categories?.forEach((c: any) => { c.tasks.forEach((t: any) => { if (t.history) t.history.forEach((h: any) => allHistory.push({ ...h, taskName: t.name })); }); });
                                                                        setSelectedTaskHistory({ taskName: `ใบงาน #${wo.id}`, projectName: getProjectName(wo.projectId), locationName: wo.locationName, history: allHistory });
                                                                    }}
                                                                    style={{ padding: '8px 16px', borderRadius: '10px', background: '#6366f1', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                                    onMouseOver={(e) => { e.currentTarget.style.background = '#4f46e5'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                                                    onMouseOut={(e) => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                                                >
                                                                    <Activity size={14} />ดูประวัติการทำงาน
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
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
                                    {selectedLaborDetail.date ? `วันที่ ${new Date(selectedLaborDetail.date).toLocaleDateString('th-TH', { dateStyle: 'long' })}` : 'สรุปภาพรวมทั้งหมด'}
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
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                                        <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: '24px', borderRadius: '24px', border: '1px solid #bfdbfe', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Users size={14} /> จำนวนคนงานรวม
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1e3a8a' }}>{totalW} <span style={{ fontSize: '1rem', fontWeight: 700 }}>คน</span></div>
                                                {totalExt > 0 && <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '12px' }}>(ใน {totalInt} / นอก {totalExt})</div>}
                                            </div>
                                        </div>
                                        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', padding: '24px', borderRadius: '24px', border: '1px solid #bbf7d0', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.08)' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={14} /> ชั่วโมงงานปกติ
                                            </div>
                                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#064e3b' }}>{totalN} <span style={{ fontSize: '1rem', fontWeight: 700 }}>ชม.</span></div>
                                        </div>
                                        <div style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)', padding: '24px', borderRadius: '24px', border: '1px solid #fbcfe8', boxShadow: '0 4px 12px rgba(236, 72, 153, 0.08)' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#be185d', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Zap size={14} /> ชั่วโมง OT
                                            </div>
                                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#831843' }}>{totalO} <span style={{ fontSize: '1rem', fontWeight: 700 }}>ชม.</span></div>
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
