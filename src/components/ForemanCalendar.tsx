import React, { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, FileText, X, AlertCircle, Users, Edit2, Check, Plus, Search, Trash2, Clock } from 'lucide-react';
import { WorkOrder, Project, Staff, Contractor, LaborRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import ImageOverlay from './ImageOverlay';
import { AnalogTimePicker } from './AnalogTimePicker';

interface ForemanCalendarProps {
    workOrders: WorkOrder[];
    currentUserId: string;
    projects: Project[];
    highlightProjectId?: string | null;
    highlightedWOId?: string | null;
    selectedMonth?: string; // Format: YYYY-MM
}

const ForemanCalendar: React.FC<ForemanCalendarProps> = ({ workOrders, currentUserId, projects, highlightProjectId, highlightedWOId, selectedMonth }) => {
    const [currentDate] = useState(new Date());
    const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);


    const year = selectedMonth ? parseInt(selectedMonth.split('-')[0]) : currentDate.getFullYear();
    const month = selectedMonth ? parseInt(selectedMonth.split('-')[1]) - 1 : currentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const { dailyData, taskFirstDayMap } = useMemo(() => {
        const tempMap: Record<string, Record<string, any>> = {};
        const firstDayMap: Record<string, string> = {};

        workOrders.forEach(wo => {
            if (!wo.categories) return;
            const project = projects.find(p => p.id === wo.projectId);
            wo.categories.forEach(cat => {
                cat.tasks.forEach(task => {
                    const isResponsible = task.responsibleStaffIds?.includes(currentUserId);
                    if (task.history && task.history.length > 0) {
                        const sortedHistory = [...task.history].sort((a, b) => a.date.localeCompare(b.date));
                        sortedHistory.forEach((h, hIdx) => {
                            const isUserInLabor = h.labor?.some(l => l.staffId === currentUserId);
                            if (isResponsible || isUserInLabor) {
                                const ds = new Date(h.date).toISOString().split('T')[0];
                                if (!firstDayMap[task.id] || ds < firstDayMap[task.id]) {
                                    firstDayMap[task.id] = ds;
                                }

                                if (!tempMap[ds]) tempMap[ds] = {};
                                const currentHDate = new Date(h.date).getTime();
                                const existing = tempMap[ds][task.id];

                                const prevProgress = hIdx > 0 ? sortedHistory[hIdx - 1].progress : 0;
                                const progressDelta = h.progress - prevProgress;

                                if (!existing || currentHDate > existing.timestamp) {
                                    let normalHours = 0; let otHours = 0; let manpower = 0;
                                    h.labor?.forEach(l => {
                                        manpower += (l.amount || 1);
                                        if (l.shifts) {
                                            if (l.shifts.normal) normalHours += ((l.amount || 1) * 8);
                                            if (l.shifts.otMorning) otHours += ((l.amount || 1) * 1.5);
                                            if (l.shifts.otNoon) otHours += ((l.amount || 1) * 1);
                                            if (l.shifts.otEvening) otHours += ((l.amount || 1) * 1.5);
                                        }
                                    });
                                    tempMap[ds][task.id] = {
                                        timestamp: currentHDate,
                                        taskId: task.id,
                                        woId: wo.id,
                                        projectId: wo.projectId,
                                        projectName: project?.name || 'ไม่ระบุโครงการ',
                                        taskName: task.name,
                                        progress: h.progress,
                                        progressDelta,
                                        note: h.notes || h.note || '',
                                        photos: h.photos || [],
                                        labor: h.labor || [],
                                        type: h.type || 'Normal',
                                        normalHours, otHours, manpower,
                                        time: new Date(h.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                                    };
                                }
                            }
                        });
                    }
                });
            });
        });

        const data: Record<string, any[]> = {};
        Object.keys(tempMap).forEach(dateStr => {
            data[dateStr] = Object.values(tempMap[dateStr]).sort((a, b) => b.timestamp - a.timestamp);
        });

        return { dailyData: data, taskFirstDayMap: firstDayMap };
    }, [workOrders, currentUserId, projects]);

    const PALETTE = [
        { bg: '#eef2ff', border: '#6366f1', text: '#3730a3' },
        { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
        { bg: '#fff7ed', border: '#f97316', text: '#9a3412' },
        { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
        { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6' },
        { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
    ];

    const getColorForTask = (rowIdx: number) => PALETTE[rowIdx % PALETTE.length];

    const { taskRowMap, woColorMap, monthTasks, maxRows } = useMemo(() => {
        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const taskDetails: Record<string, { start: string, end: string, woId: string }> = {};

        workOrders.forEach(wo => {
            wo.categories?.forEach(cat => {
                cat.tasks.forEach(task => {
                    const isResponsible = task.responsibleStaffIds?.includes(currentUserId);
                    const hasHistory = task.history?.some(h =>
                        h.date.startsWith(monthPrefix) && h.labor?.some(l => l.staffId === currentUserId)
                    );

                    if (isResponsible || hasHistory) {
                        const historyInMonth = (task.history || []).filter(h => h.date.startsWith(monthPrefix));
                        if (historyInMonth.length > 0) {
                            const sortedH = [...historyInMonth].sort((a, b) => a.date.localeCompare(b.date));
                            const start = sortedH[0].date.split('T')[0];
                            const actualEnd = sortedH[sortedH.length - 1].date.split('T')[0];
                            const isCompleted = task.status === 'Completed' || task.status === 'Rejected';

                            taskDetails[task.id] = { start, end: isCompleted ? actualEnd : '9999-12-31', woId: wo.id };
                        }
                    }
                });
            });
        });

        const sortedTasks = Object.entries(taskDetails)
            .map(([taskId, details]) => ({ taskId, ...details }))
            .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

        const rowMap: Record<string, number> = {};
        const woColorMapTable: Record<string, number> = {};
        const slotEndDates: string[] = [];
        let woColorCounter = 0;

        sortedTasks.forEach((task) => {
            if (woColorMapTable[task.woId] === undefined) woColorMapTable[task.woId] = woColorCounter++;
            let assignedRow = false;
            for (let i = 0; i < slotEndDates.length; i++) {
                if (task.start > slotEndDates[i]) { rowMap[task.taskId] = i; slotEndDates[i] = task.end; assignedRow = true; break; }
            }
            if (!assignedRow) { rowMap[task.taskId] = slotEndDates.length; slotEndDates.push(task.end); }
        });

        return { taskRowMap: rowMap, woColorMap: woColorMapTable, monthTasks: sortedTasks, maxRows: Math.max(slotEndDates.length, 1) };
    }, [workOrders, currentUserId, year, month]);

    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const calendarCells = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarCells.push(<div key={`empty-${i}`} style={{ background: '#f8fafc', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = dailyData[dateStr] || [];
        const isToday = new Date().toISOString().split('T')[0] === dateStr;
        const rowSlots = new Array(maxRows).fill(null);
        dayEvents.forEach(e => {
            const rowIdx = taskRowMap[e.taskId];
            if (rowIdx !== undefined) rowSlots[rowIdx] = { ...e, type: 'active', color: getColorForTask(woColorMap[e.woId]) };
        });

        const totalDayHours = dayEvents.reduce((acc: number, ev: any) => {
            let hours = 0;
            ev.labor?.forEach((l: any) => {
                const count = l.amount || 1;
                if (l.shifts?.normal) hours += (count * 8);
                if (l.shifts?.otMorning) hours += (count * 2);
                if (l.shifts?.otNoon) hours += (count * 1);
                if (l.shifts?.otEvening) hours += (count * 3);
            });
            return acc + hours;
        }, 0);

        calendarCells.push(
            <div key={day} onClick={() => { if (dayEvents.length > 0) setSelectedDateStr(dateStr) }} style={{ background: isToday ? '#eff6ff' : '#ffffff', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '8px 0px', minHeight: '110px', cursor: dayEvents.length > 0 ? 'pointer' : 'default', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {dayEvents.some((e: any) => e.type === 'Problem') && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />}
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: isToday ? '#2563eb' : '#475569', background: isToday ? '#dbeafe' : 'none', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>{day}</span>
                    </div>
                    {totalDayHours > 0 && (
                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#6366f1', background: '#f5f3ff', padding: '2px 6px', borderRadius: '6px', border: '1px solid #ddd6fe' }}>
                            {totalDayHours} ชม.
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {rowSlots.map((item: any, idx) => {
                        if (!item) return <div key={idx} style={{ height: '19px' }} />;
                        // Show actual task info if it's an active event
                        const label = item.projectName && item.taskName ? `${item.projectName} - ${item.taskName}` : '...';
                        return (
                            <div key={idx} style={{ 
                                background: item.color?.bg || '#f1f5f9', 
                                color: item.color?.text || '#64748b', 
                                fontSize: '0.65rem', 
                                fontWeight: 900, 
                                height: '19px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                padding: '0 6px', 
                                overflow: 'hidden', 
                                whiteSpace: 'nowrap', 
                                textOverflow: 'ellipsis', 
                                marginBottom: '1px',
                                borderLeft: `3px solid ${item.color?.border || 'transparent'}`,
                                opacity: (highlightedWOId && item.woId?.toString().trim() !== highlightedWOId?.toString().trim()) || (highlightProjectId && item.projectId !== highlightProjectId) ? 0.15 : 1
                            }}>
                                {label}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}><CalendarIcon size={20} /></div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>ประวัติการเข้าปฏิบัติงาน (Activity Calendar)</h2>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {dayNames.map((day, idx) => <div key={day} style={{ padding: '10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: idx === 0 || idx === 6 ? '#ef4444' : '#64748b' }}>{day}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>{calendarCells}</div>
            {selectedDateStr && <DailyDetailDrawer dateStr={selectedDateStr} events={dailyData[selectedDateStr] || []} taskRowMap={taskRowMap} onClose={() => setSelectedDateStr(null)} />}
        </div>
    );
};

const DailyDetailDrawer = ({ dateStr, events, taskRowMap, onClose }: { dateStr: string, events: any[], taskRowMap: Record<string, number>, onClose: () => void }) => {
    const { user } = useAuth();
    const { addTaskUpdate, workOrders, staff: masterStaff, contractors: masterContractors } = useWorkOrders();
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isEditingId, setIsEditingId] = useState<string | null>(null);
    const [tempLabor, setTempLabor] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Time Picker State
    const [activePicker, setActivePicker] = useState<{ laborIdx: number, shift: string, part: 'start' | 'end', value: string } | null>(null);

    // Add Person Modal State
    const [showSelection, setShowSelection] = useState<'Internal' | 'Subco' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const formattedDate = new Date(dateStr).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const startEditing = (ev: any) => {
        const wo = workOrders.find(w => w.id === ev.woId);
        const task = wo?.categories?.flatMap(c => c.tasks).find(t => t.id === ev.taskId);
        const historyEntry = task?.history?.find((h: any) => h.date.startsWith(dateStr));
        // Deep copy labor records including shiftTimes
        setTempLabor(JSON.parse(JSON.stringify(historyEntry?.labor || ev.labor || [])));
        setIsEditingId(ev.taskId);
    };

    const handleSave = async (ev: any) => {
        setIsSubmitting(true);
        try {
            const wo = workOrders.find(w => w.id === ev.woId);
            const category = wo?.categories?.find(c => c.tasks.some(t => t.id === ev.taskId));
            if (!wo || !category) throw new Error("WorkOrder not found");
            await addTaskUpdate(wo.id, category.id, ev.taskId, {
                progress: ev.progress,
                note: ev.note || "",
                labor: tempLabor,
                type: 'Update',
                reportDate: dateStr
            });
            setIsEditingId(null);
            alert("บันทึกแก้ไขค่าแรงเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Save error:", error);
            alert("ไม่สามารถบันทึกข้อมูลได้");
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleShift = (idx: number, shiftKey: string) => {
        const newLabor = [...tempLabor];
        const record = newLabor[idx];
        if (!record.shifts) record.shifts = { normal: false, otMorning: false, otNoon: false, otEvening: false };
        if (!record.shiftTimes) record.shiftTimes = { day: '08:00 - 17:00', otMorning: '06:00 - 08:00', otNoon: '12:00 - 13:00', otEvening: '18:00 - 21:00' };

        record.shifts[shiftKey] = !record.shifts[shiftKey];
        setTempLabor(newLabor);
    };

    const openTimePicker = (lIdx: number, shift: string, part: 'start' | 'end', currentVal: string) => {
        const fullRange = currentVal || '08:00 - 17:00';
        const [start, end] = fullRange.split(' - ');
        setActivePicker({ laborIdx: lIdx, shift, part, value: part === 'start' ? start : end });
    };

    const handleTimeSelect = (newTime: string) => {
        if (!activePicker) return;
        const { laborIdx, shift, part } = activePicker;
        const newLabor = [...tempLabor];
        const record = newLabor[laborIdx];
        if (!record.shiftTimes) record.shiftTimes = {};
        const key = shift === 'normal' ? 'day' : shift;

        const currentRange = record.shiftTimes[key] || '08:00 - 17:00';
        const parts = currentRange.split(' - ');
        if (part === 'start') parts[0] = newTime;
        else parts[1] = newTime;

        record.shiftTimes[key] = parts.join(' - ');
        setTempLabor(newLabor);
        setActivePicker(null);
    };

    const removePerson = (idx: number) => {
        const newLabor = [...tempLabor];
        newLabor.splice(idx, 1);
        setTempLabor(newLabor);
    };

    const addPerson = (person: any, type: 'Internal' | 'Subco') => {
        const newRecord: any = {
            membership: type === 'Internal' ? 'Internal' : 'Outsource',
            id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            shifts: { normal: true, otMorning: false, otNoon: false, otEvening: false },
            shiftTimes: { day: '08:00 - 17:00', otMorning: '06:00 - 08:00', otNoon: '12:00 - 13:00', otEvening: '18:00 - 21:00' },
            amount: 1
        };

        if (type === 'Internal') {
            newRecord.staffId = person.id;
            newRecord.staffName = person.name;
            newRecord.affiliation = person.affiliation || 'General';
        } else {
            newRecord.contractorId = person.id;
            newRecord.affiliation = person.name;
        }

        setTempLabor([...tempLabor, newRecord]);
        setShowSelection(null);
        setSearchQuery('');
    };

    const filteredMasters = useMemo(() => {
        const list = showSelection === 'Internal' ? masterStaff : masterContractors;
        return list.filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }, [showSelection, searchQuery, masterStaff, masterContractors]);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'relative', width: '100%', maxWidth: '550px', height: '100%', background: '#ffffff', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', animation: 'slide-in 0.3s ease-out' }}>
                <style>{`@keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

                <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#0f172a', margin: 0 }}>รายละเอียดรายวัน</h3>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{formattedDate}</div>
                    </div>
                    <button onClick={onClose} style={{ background: '#fff', border: '1px solid #e2e8f0', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {events.map((ev, idx) => {
                            const isEditing = isEditingId === ev.taskId;
                            const currentLabor = isEditing ? tempLabor : (ev.labor || []);

                            return (
                                <div key={idx} style={{ background: '#fff', borderRadius: '20px', border: isEditing ? '2px solid #6366f1' : '1px solid #e2e8f0', padding: '24px', boxShadow: isEditing ? '0 15px 40px -10px rgba(99, 102, 241, 0.2)' : 'none' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#6366f1', background: '#eef2ff', padding: '4px 10px', borderRadius: '8px' }}>{ev.projectName}</span>
                                            <h4 style={{ fontSize: '1.15rem', fontWeight: 950, color: '#0f172a', margin: '6px 0 0' }}>{ev.taskName}</h4>
                                        </div>
                                        {!isEditing && (
                                            <button onClick={() => startEditing(ev)} style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#6366f1', padding: '8px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 850, cursor: 'pointer' }}>
                                                <Edit2 size={14} style={{ marginRight: '6px' }} /> แก้ไข
                                            </button>
                                        )}
                                    </div>

                                    {/* Labor Cards */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                        {currentLabor.map((lab: any, lIdx: number) => (
                                            <div key={lIdx} style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}><Users size={18} /></div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>{lab.staffName || lab.affiliation}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{lab.membership === 'Internal' ? 'คนงานบริษัท' : 'ซับเหมอ'}</div>
                                                    </div>
                                                    {isEditing && (
                                                        <button onClick={() => removePerson(lIdx)} style={{ background: '#fef2f2', border: 'none', width: '32px', height: '32px', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {['normal', 'otMorning', 'otNoon', 'otEvening'].map(s => {
                                                        const active = lab.shifts?.[s];
                                                        if (!isEditing && !active) return null;
                                                        const timeKey = s === 'normal' ? 'day' : s;
                                                        const timeVal = lab.shiftTimes?.[timeKey] || '00:00 - 00:00';

                                                        return (
                                                            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: isEditing ? '#fff' : 'none', padding: isEditing ? '8px 12px' : 0, borderRadius: '10px', border: isEditing ? '1px solid #e2e8f0' : 'none' }}>
                                                                <div onClick={() => isEditing && toggleShift(lIdx, s)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isEditing ? 'pointer' : 'default', minWidth: '90px' }}>
                                                                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: active ? '#6366f1' : '#f1f5f9', border: '1.5px solid', borderColor: active ? '#6366f1' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {active && <Check size={12} color="#fff" />}
                                                                    </div>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{s === 'normal' ? 'Day' : s === 'otMorning' ? 'OT เช้า' : s === 'otNoon' ? 'OT เที่ยง' : 'OT เย็น'}</span>
                                                                </div>

                                                                {active && (() => {
                                                                    const timeKey = s === 'normal' ? 'day' : s;
                                                                    const timeVal = lab.shiftTimes?.[timeKey] || '08:00 - 17:00';
                                                                    const [start, end] = timeVal.split(' - ');
                                                                    return (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                                                                            {isEditing ? (
                                                                                <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '2px', borderRadius: '10px', gap: '4px', border: '1px solid #e2e8f0' }}>
                                                                                    <button 
                                                                                        onClick={() => openTimePicker(lIdx, s, 'start', timeVal)}
                                                                                        style={{ padding: '4px 10px', borderRadius: '8px', border: 'none', background: '#fff', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                                                                    >
                                                                                        {start}
                                                                                    </button>
                                                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>-</span>
                                                                                    <button 
                                                                                        onClick={() => openTimePicker(lIdx, s, 'end', timeVal)}
                                                                                        style={{ padding: '4px 10px', borderRadius: '8px', border: 'none', background: '#fff', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                                                                    >
                                                                                        {end}
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '8px' }}>
                                                                                    <Clock size={12} color="#64748b" />
                                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1e293b' }}>{timeVal}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {isEditing && (
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                                <button onClick={() => setShowSelection('Internal')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px dashed #cbd5e1', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Plus size={16} /> ทีมบริษัท</button>
                                                <button onClick={() => setShowSelection('Subco')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px dashed #cbd5e1', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Plus size={16} /> ทีมซับ</button>
                                            </div>
                                        )}
                                    </div>

                                    {isEditing && (
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button onClick={() => setIsEditingId(null)} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 800, cursor: 'pointer' }}>ยกเลิก</button>
                                            <button onClick={() => handleSave(ev)} disabled={isSubmitting} style={{ flex: 2, padding: '14px', borderRadius: '14px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 950, cursor: 'pointer' }}>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกแก้ไขค่าแรง'}</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Selection Modal (Searchable) */}
                {showSelection && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, background: '#fff', display: 'flex', flexDirection: 'column', animation: 'fade-in 0.2s' }}>
                        <style>{`@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button onClick={() => setShowSelection(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    autoFocus
                                    placeholder={`ค้นหาชื่อ${showSelection === 'Internal' ? 'พนักงาน' : 'ทีมซับ'}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: '2px solid #6366f1', background: '#f8faff', fontSize: '1rem', fontWeight: 700 }}
                                />
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                            {filteredMasters.map((p: any) => (
                                <div key={p.id} onClick={() => addPerson(p, showSelection)} style={{ padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9', marginBottom: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }} onMouseOver={(e) => e.currentTarget.style.background = '#f8faff'} onMouseOut={(e) => e.currentTarget.style.background = 'none'}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: 900 }}>{p.name?.[0]}</div>
                                    <div>
                                        <div style={{ fontWeight: 900, color: '#0f172a' }}>{p.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{p.affiliation || 'General'}</div>
                                    </div>
                                    <Plus size={18} style={{ marginLeft: 'auto', color: '#6366f1' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Analog Time Picker Modal */}
                {activePicker && (
                    <AnalogTimePicker 
                        value={activePicker.value}
                        onChange={handleTimeSelect}
                        onClose={() => setActivePicker(null)}
                    />
                )}

                <ImageOverlay src={previewImage || ''} isOpen={!!previewImage} onClose={() => setPreviewImage(null)} />
            </div>
        </div>
    );
};

export default ForemanCalendar;
