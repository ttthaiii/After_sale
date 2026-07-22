import React, { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, FileText, AlertCircle, Users, Edit2, Check, Plus, Search, Trash2, Clock, X, Camera } from 'lucide-react';
import { WorkOrder, Project } from '../types';
import { useWorkOrders } from '../context/WorkOrderContext';
import ImageOverlay from './ImageOverlay';
import { AnalogTimePicker } from './AnalogTimePicker';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { formatDate } from '../utils/date';

interface ForemanCalendarProps {
    workOrders: WorkOrder[];
    currentUserId: string;
    projects: Project[];
    highlightProjectId?: string | null;
    highlightedWOId?: string | null;
    selectedMonth?: string; // Format: YYYY-MM
    // T-336: when set to a projectId, show ALL foremen's activity for that project
    // (project-wide mode) instead of filtering to currentUserId.
    allForemenForProject?: string | null;
}

// Helper to get leave hours from time range string
const getLeaveHours = (timeRange: string): number => {
    if (!timeRange) return 8;
    if (timeRange === '08:00 - 17:00') return 8;
    if (timeRange === '08:00 - 12:00' || timeRange === '13:00 - 17:00') return 4;
    
    try {
        const parts = timeRange.split(' - ');
        if (parts.length !== 2) return 8;
        const [startStr, endStr] = parts;
        const [sh, smStr] = startStr.split(':');
        const [eh, emStr] = endStr.split(':');
        const startMin = parseInt(sh, 10) * 60 + parseInt(smStr || '0', 10);
        const endMin = parseInt(eh, 10) * 60 + parseInt(emStr || '0', 10);
        let diffMin = endMin - startMin;
        
        if (startMin <= 720 && endMin >= 780) {
            diffMin -= 60;
        }
        const hrs = diffMin / 60;
        return Math.max(0, hrs);
    } catch (e) {
        return 8;
    }
};

// Helper to get shift hours from custom time range string
const getShiftHours = (timeRange: string, defaultHours: number): number => {
    if (!timeRange) return defaultHours;
    try {
        const parts = timeRange.split(' - ');
        if (parts.length !== 2) return defaultHours;
        const [startStr, endStr] = parts;
        const [sh, smStr] = startStr.split(':');
        const [eh, emStr] = endStr.split(':');
        const startMin = parseInt(sh, 10) * 60 + parseInt(smStr || '0', 10);
        const endMin = parseInt(eh, 10) * 60 + parseInt(emStr || '0', 10);
        let diffMin = endMin - startMin;
        
        if (startMin <= 720 && endMin >= 780) {
            diffMin -= 60;
        }
        const hrs = diffMin / 60;
        return Math.max(0, hrs);
    } catch (e) {
        return defaultHours;
    }
};

const ForemanCalendar: React.FC<ForemanCalendarProps> = ({ workOrders, currentUserId, projects, highlightProjectId, highlightedWOId, selectedMonth, allForemenForProject }) => {
    const [currentDate] = useState(new Date());
    const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);


    const year = selectedMonth ? parseInt(selectedMonth.split('-')[0]) : currentDate.getFullYear();
    const month = selectedMonth ? parseInt(selectedMonth.split('-')[1]) - 1 : currentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const { dailyData, taskFirstDayMap, taskLastDayMap } = useMemo(() => {
        const tempMap: Record<string, Record<string, any>> = {};
        const firstDayMap: Record<string, string> = {};
        const lastDayMap: Record<string, string> = {};

        workOrders.forEach(wo => {
            if (!wo.categories) return;
            // T-336: project-wide mode → only this project's WOs; per-foreman mode → all (filtered by user below).
            if (allForemenForProject && allForemenForProject !== '__ALL__' && wo.projectId !== allForemenForProject) return;
            const project = projects.find(p => p.id === wo.projectId);
            wo.categories.forEach(cat => {
                cat.tasks.forEach(task => {
                    const isResponsible = task.responsibleStaffIds?.includes(currentUserId);
                    if (task.history && task.history.length > 0) {
                        const sortedHistory = [...task.history].filter(h => h?.date).sort((a, b) => a.date.localeCompare(b.date));
                        sortedHistory.forEach((h, hIdx) => {
                            const isUserInLabor = h.labor?.some(l => l.staffId === currentUserId);
                            if (allForemenForProject || isResponsible || isUserInLabor) {
                                const ds = new Date(h.date).toISOString().split('T')[0];
                                if (!firstDayMap[task.id] || ds < firstDayMap[task.id]) {
                                    firstDayMap[task.id] = ds;
                                }
                                if (!lastDayMap[task.id] || ds > lastDayMap[task.id]) {
                                    lastDayMap[task.id] = ds;
                                }

                                if (!tempMap[ds]) tempMap[ds] = {};
                                const currentHDate = new Date(h.date).getTime();
                                const existing = tempMap[ds][task.id];

                                const prevProgress = hIdx > 0 ? sortedHistory[hIdx - 1].progress : 0;
                                const progressDelta = h.progress - prevProgress;

                                if (!existing || currentHDate > existing.timestamp) {
                                     let normalHours = 0; let otHours = 0; let manpower = 0;
                                     
                                     const leaveList = h.leave || [];
                                     const leaveMap = new Map<string, any>();
                                     leaveList.forEach((lv: any) => {
                                         const wId = lv.workerId || lv.id || lv.staffId || '';
                                         if (wId) {
                                             leaveMap.set(wId, lv);
                                         }
                                     });

                                     h.labor?.forEach(l => {
                                         const wId = l.workerId || l.staffId || l.contractorId || l.id;
                                         const hasLeave = leaveMap.has(wId);
                                         const leaveRecord = leaveMap.get(wId);
                                         const amount = l.amount || 1;
                                         
                                         let leaveHours = 0;
                                         if (hasLeave && leaveRecord) {
                                             const leaveTimeRange = leaveRecord.leaveTimes?.custom || '08:00 - 17:00';
                                             leaveHours = getLeaveHours(leaveTimeRange);
                                         }

                                         let normalHr = 0;
                                         if (l.shifts?.normal) {
                                             const regTime = l.shiftTimes?.day || '08:00 - 17:00';
                                             const duration = getShiftHours(regTime, 8);
                                             normalHr = Math.max(0, duration - (regTime === '08:00 - 17:00' ? leaveHours : 0));
                                         }

                                          const otMorningHr = l.shifts?.otMorning ? getShiftHours(l.shiftTimes?.otMorning || '', 1.5) : 0;
                                          const otNoonHr = l.shifts?.otNoon ? getShiftHours(l.shiftTimes?.otNoon || '12:00 - 13:00', 1) : 0;
                                          const otEveningHr = l.shifts?.otEvening ? getShiftHours(l.shiftTimes?.otEvening || '', 1.5) : 0;

                                         let activeWorkerCount = amount;
                                         if (hasLeave && leaveHours >= 8 && normalHr === 0 && !l.shifts?.otMorning && !l.shifts?.otNoon && !l.shifts?.otEvening) {
                                             activeWorkerCount = 0;
                                         } else if (hasLeave && leaveHours > 0) {
                                             const workingRatio = normalHr / 8;
                                             activeWorkerCount = amount * workingRatio;
                                         }

                                         manpower += activeWorkerCount;
                                         normalHours += (amount * normalHr);
                                         otHours += (amount * (otMorningHr + otNoonHr + otEveningHr));
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
                                         note: (h as any).notes || h.note || '',
                                         photos: h.photos || [],
                                         laborPhotos: h.laborPhotos || [],
                                         photosPayload: (h as any).photosPayload || null,
                                         labor: h.labor || [],
                                         leave: h.leave || [],
                                         type: h.type || 'Normal',
                                         normalHours, otHours, manpower,
                                          time: (() => {
                                              const d = new Date(h.date);
                                              const hours = String(d.getHours()).padStart(2, '0');
                                              const minutes = String(d.getMinutes()).padStart(2, '0');
                                              return `${hours}:${minutes}`;
                                          })()
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

        return { dailyData: data, taskFirstDayMap: firstDayMap, taskLastDayMap: lastDayMap };
    }, [workOrders, currentUserId, projects, allForemenForProject]);

    const PALETTE = [
        { bg: '#eef2ff', border: '#6366f1', text: '#3730a3' },
        { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
        { bg: '#fff7ed', border: '#f97316', text: '#9a3412' },
        { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
        { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6' },
        { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
    ];

    const getColorForTask = (rowIdx: number) => PALETTE[rowIdx % PALETTE.length];

    const { taskRowMap, woColorMap, maxRows } = useMemo(() => {
        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const taskDetails: Record<string, { start: string, end: string, woId: string }> = {};

        workOrders.forEach(wo => {
            if (allForemenForProject && allForemenForProject !== '__ALL__' && wo.projectId !== allForemenForProject) return;
            wo.categories?.forEach(cat => {
                cat.tasks.forEach(task => {
                    const isResponsible = task.responsibleStaffIds?.includes(currentUserId);
                    const hasHistory = task.history?.some(h =>
                        h?.date?.startsWith(monthPrefix) && h.labor?.some(l => l.staffId === currentUserId)
                    );

                    if (allForemenForProject || isResponsible || hasHistory) {
                        const historyInMonth = (task.history || []).filter(h => h?.date?.startsWith(monthPrefix));
                        if (historyInMonth.length > 0) {
                            const sortedH = [...historyInMonth].sort((a, b) => a.date.localeCompare(b.date));
                            const start = sortedH[0].date.split('T')[0];
                            const actualEnd = sortedH[sortedH.length - 1].date.split('T')[0];
                            const isCompleted = ['For Checking', 'pending_delivery', 'Complete', 'Rejected'].includes(task.status);

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
    }, [workOrders, currentUserId, year, month, allForemenForProject]);

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
            const leaveList = ev.leave || [];
            const leaveMap = new Map<string, any>();
            leaveList.forEach((lv: any) => {
                const wId = lv.workerId || lv.id || lv.staffId || '';
                if (wId) {
                    leaveMap.set(wId, lv);
                }
            });

            ev.labor?.forEach((l: any) => {
                const wId = l.workerId || l.staffId || l.contractorId || l.id;
                const hasLeave = leaveMap.has(wId);
                const leaveRecord = leaveMap.get(wId);
                const count = l.amount || 1;
                
                let leaveHours = 0;
                if (hasLeave && leaveRecord) {
                    const leaveTimeRange = leaveRecord.leaveTimes?.custom || '08:00 - 17:00';
                    leaveHours = getLeaveHours(leaveTimeRange);
                }

                let normalHr = 0;
                if (l.shifts?.normal) {
                    const regTime = l.shiftTimes?.day || '08:00 - 17:00';
                    const duration = getShiftHours(regTime, 8);
                    normalHr = Math.max(0, duration - (regTime === '08:00 - 17:00' ? leaveHours : 0));
                }

                hours += (count * normalHr);
                if (l.shifts?.otMorning) {
                    hours += (count * getShiftHours(l.shiftTimes?.otMorning || '', 2));
                }
                if (l.shifts?.otNoon) {
                    hours += (count * getShiftHours(l.shiftTimes?.otNoon || '12:00 - 13:00', 1));
                }
                if (l.shifts?.otEvening) {
                    hours += (count * getShiftHours(l.shiftTimes?.otEvening || '', 3));
                }
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
                                borderLeft: dateStr === taskFirstDayMap[item.taskId] ? `3px solid ${item.color?.border || 'transparent'}` : 'none',
                                borderRight: dateStr === taskLastDayMap[item.taskId] && item.progress === 100 ? `3px solid ${item.color?.border || 'transparent'}` : 'none',
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
            {selectedDateStr && <DailyDetailDrawer dateStr={selectedDateStr} events={(dailyData[selectedDateStr] || []).map(e => ({ ...e, color: getColorForTask(woColorMap[e.woId]) }))} onClose={() => setSelectedDateStr(null)} />}
        </div>
    );
};

const DailyDetailDrawer = ({ dateStr, events, onClose }: { dateStr: string, events: any[], onClose: () => void }) => {
    const { addTaskUpdate, workOrders, contractors: masterContractors } = useWorkOrders();
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewImagesList, setPreviewImagesList] = useState<{ url: string; label: string }[]>([]);
    const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);
    const [isEditingId, setIsEditingId] = useState<string | null>(null);
    const [tempLabor, setTempLabor] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Time Picker State
    const [activePicker, setActivePicker] = useState<{ laborIdx: number, shift: string, part: 'start' | 'end', value: string } | null>(null);

    // Add Person Modal State
    const [showSelection, setShowSelection] = useState<'Internal' | 'Subco' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [dailyContractors, setDailyContractors] = useState<any[]>([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'dailyContractors'), (snap) => {
            setDailyContractors(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });
        return () => unsub();
    }, []);

    const getEventPhotos = (ev: any) => {
        const list: { url: string; label: string }[] = [];
        
        // Helper to get shift times from labor records
        const getShiftTime = (key: 'day' | 'otMorning' | 'otNoon' | 'otEvening') => {
            if (!ev.labor || !Array.isArray(ev.labor)) return '';
            const times = ev.labor
                .filter((l: any) => l.shifts?.[key === 'day' ? 'normal' : key])
                .map((l: any) => l.shiftTimes?.[key])
                .filter(Boolean);
            return times[0] || '';
        };
        const parseStart = (range: string) => range?.split(' - ')[0] || '';
        const parseEnd = (range: string) => range?.split(' - ')[1] || '';

        // Retrieve dynamic shift times for labels
        const normalRange = getShiftTime('day');
        const normalStart = parseStart(normalRange) || '08:00';
        const normalEnd = parseEnd(normalRange) || '17:00';

        const otMorningRange = getShiftTime('otMorning');
        const otMorningStart = parseStart(otMorningRange) || '06:00';
        const otMorningEnd = parseEnd(otMorningRange) || '08:00';

        const otNoonRange = getShiftTime('otNoon');
        const otNoonStart = parseStart(otNoonRange) || '12:00';
        const otNoonEnd = parseEnd(otNoonRange) || '13:00';

        const otEveningRange = getShiftTime('otEvening');
        const otEveningStart = parseStart(otEveningRange) || '18:00';
        const otEveningEnd = parseEnd(otEveningRange) || '21:00';

        if (ev.photos) {
            if (Array.isArray(ev.photos)) {
                // Legacy format (flat array of site photos)
                ev.photos.forEach((url: string) => {
                    list.push({ url, label: 'รูปถ่ายหน้างาน (Site)' });
                });
            } else {
                // Structured object format
                const photosObj = ev.photos;
                
                // 1. Site photos
                if (photosObj.site && Array.isArray(photosObj.site)) {
                    photosObj.site.forEach((url: string) => {
                        list.push({ url, label: 'รูปถ่ายหน้างาน (Site)' });
                    });
                }
                
                // 2. Labor photos grouped by shift
                if (photosObj.laborByShift) {
                    const laborShift = photosObj.laborByShift;
                    
                    // Regular shift
                    if (laborShift.regular && Array.isArray(laborShift.regular)) {
                        const regularLabels = [
                            `กะปกติ: เข้า (${normalStart})`,
                            'กะปกติ: พักเที่ยง (12:00)',
                            'กะปกติ: เข้าบ่าย (13:00)',
                            `กะปกติ: ออก (${normalEnd})`
                        ];
                        laborShift.regular.forEach((url: string, idx: number) => {
                            if (url) {
                                list.push({ url, label: regularLabels[idx] || 'กะปกติ' });
                            }
                        });
                    }
                    
                    // OT Morning
                    if (laborShift.otMorning) {
                        const shift = laborShift.otMorning;
                        if (shift.in) list.push({ url: shift.in, label: `OT เช้า: เข้า (${otMorningStart})` });
                        if (shift.out) list.push({ url: shift.out, label: `OT เช้า: ออก (${otMorningEnd})` });
                    }

                    // OT Noon
                    if (laborShift.otNoon) {
                        const shift = laborShift.otNoon;
                        if (shift.in) list.push({ url: shift.in, label: `OT เที่ยง: เข้า (${otNoonStart})` });
                        if (shift.out) list.push({ url: shift.out, label: `OT เที่ยง: ออก (${otNoonEnd})` });
                    }

                    // OT Evening
                    if (laborShift.otEvening) {
                        const shift = laborShift.otEvening;
                        if (shift.in) list.push({ url: shift.in, label: `OT เย็น: เข้า (${otEveningStart})` });
                        if (shift.out) list.push({ url: shift.out, label: `OT เย็น: ออก (${otEveningEnd})` });
                    }
                }
            }
        }
        
        // Fallback for legacy laborPhotos
        if (list.length === 0 && ev.laborPhotos && Array.isArray(ev.laborPhotos)) {
            ev.laborPhotos.forEach((url: string) => {
                list.push({ url, label: 'รูปถ่ายกำลังพล (Labor)' });
            });
        }
        
        return list;
    };

    const openPhotoViewer = (imageList: { url: string; label: string }[], index: number) => {
        setPreviewImagesList(imageList);
        setPreviewImageIndex(index);
        setPreviewImage(imageList[index]?.url || null);
    };

    const formattedDate = formatDate(dateStr);

    const startEditing = (ev: any) => {
        const wo = workOrders.find(w => w.id === ev.woId);
        const task = wo?.categories?.flatMap(c => c.tasks).find(t => t.id === ev.taskId);
        const historyEntry = task?.history?.find((h: any) => h?.date?.startsWith(dateStr));
        // Deep copy labor records including shiftTimes
        setTempLabor(JSON.parse(JSON.stringify(historyEntry?.labor || ev.labor || [])));
        setIsEditingId(ev.taskId);
    };

    const handleSave = async (ev: any) => {
        setIsSubmitting(true);
        try {
            const wo = workOrders.find(w => w.id === ev.woId);
            const category = wo?.categories?.find(c => c.tasks.some(t => t.id === ev.taskId));
            const task = category?.tasks.find(t => t.id === ev.taskId);
            const historyEntry = task?.history?.find((h: any) => h?.date?.startsWith(dateStr));
            if (!wo || !category || !historyEntry) throw new Error("WorkOrder, Category, or History entry not found");
            
            await addTaskUpdate(wo.id, category.id, ev.taskId, {
                ...(historyEntry as any),
                labor: tempLabor
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
            newRecord.employeeId = person.employeeId || person.id.replace('DC-', '') || '';
            newRecord.affiliation = person.skillId || person.affiliation || person.department || 'General';
        } else {
            newRecord.contractorId = person.id;
            newRecord.affiliation = person.name;
        }

        setTempLabor([...tempLabor, newRecord]);
        setShowSelection(null);
        setSearchQuery('');
    };

    const filteredMasters = useMemo(() => {
        // Normalize query: trim + collapse whitespace + lowercase
        const q = searchQuery.replace(/\s+/g, ' ').trim().toLowerCase();
        if (showSelection === 'Internal') {
            const internalStaffList = dailyContractors.filter(c => (c.department || '').toLowerCase().endsWith('wh'));
            if (!q) return internalStaffList;
            return internalStaffList.filter(p => {
                const name = (p.name || '').replace(/\s+/g, ' ').toLowerCase();
                const empId = (p.employeeId || '').toLowerCase();
                const dept = (p.department || p.affiliation || p.skillId || '').toLowerCase();
                return name.includes(q) || empId.includes(q) || dept.includes(q);
            });
        } else {
            if (!q) return masterContractors;
            return masterContractors.filter(p => {
                const name = (p.name || '').replace(/\s+/g, ' ').toLowerCase();
                const specialty = (p.specialty || []).join(' ').toLowerCase();
                return name.includes(q) || specialty.includes(q);
            });
        }
    }, [showSelection, searchQuery, dailyContractors, masterContractors]);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'relative', width: '100%', maxWidth: '550px', height: '100%', background: '#ffffff', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', animation: 'slide-in 0.3s ease-out' }}>
                <style>{`@keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#0f172a', margin: 0 }}>รายละเอียดรายวัน</h3>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{formattedDate}</div>
                    </div>
                    {/* Hard-coded absolute Close Button with high z-index */}
                    <button 
                        onClick={onClose} 
                        style={{ 
                            position: 'absolute',
                            top: '20px',
                            right: '24px',
                            zIndex: 9999,
                            background: '#f1f5f9', 
                            border: '1px solid #e2e8f0', 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '12px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }} 
                    >
                        <div style={{ position: 'relative', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ position: 'absolute', width: '20px', height: '3px', background: '#334155', transform: 'rotate(45deg)', borderRadius: '4px' }}></div>
                            <div style={{ position: 'absolute', width: '20px', height: '3px', background: '#334155', transform: 'rotate(-45deg)', borderRadius: '4px' }}></div>
                        </div>
                    </button>
                </div>

                {/* Stats Summary Boxes */}
                {(() => {
                    let totalNormal = 0;
                    let totalOT = 0;
                    let totalOutsource = 0;

                    events.forEach(ev => {
                        const leaveList = ev.leave || [];
                        const leaveMap = new Map<string, any>();
                        leaveList.forEach((lv: any) => {
                            const wId = lv.workerId || lv.id || lv.staffId || '';
                            if (wId) {
                                leaveMap.set(wId, lv);
                            }
                        });

                        ev.labor?.forEach((l: any) => {
                            const wId = l.workerId || l.staffId || l.contractorId || l.id;
                            const hasLeave = leaveMap.has(wId);
                            const leaveRecord = leaveMap.get(wId);
                            const count = l.amount || 1;
                            const isOutsource = l.membership === 'Outsource';
                            
                            let leaveHours = 0;
                            if (hasLeave && leaveRecord) {
                                const leaveTimeRange = leaveRecord.leaveTimes?.custom || '08:00 - 17:00';
                                leaveHours = getLeaveHours(leaveTimeRange);
                            }

                            let normalHr = 0;
                            if (l.shifts?.normal) {
                                const regTime = l.shiftTimes?.day || '08:00 - 17:00';
                                const duration = getShiftHours(regTime, 8);
                                normalHr = Math.max(0, duration - (regTime === '08:00 - 17:00' ? leaveHours : 0));
                            }

                            totalNormal += (count * normalHr);
                            if (isOutsource) totalOutsource += (count * normalHr);
                            
                            let ot = 0;
                            if (l.shifts?.otMorning) ot += (count * getShiftHours(l.shiftTimes?.otMorning || '', 2));
                            if (l.shifts?.otNoon) ot += (count * getShiftHours(l.shiftTimes?.otNoon || '12:00 - 13:00', 1));
                            if (l.shifts?.otEvening) ot += (count * getShiftHours(l.shiftTimes?.otEvening || '', 3));
                            
                            totalOT += ot;
                            if (isOutsource) totalOutsource += ot;
                        });
                    });

                    return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '16px 24px', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '16px', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>ชม. ปกติ</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>{totalNormal} <span style={{ fontSize: '0.7rem' }}>ชม.</span></div>
                            </div>
                            <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '16px', border: '1px solid #e0f2fe', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0369a1', marginBottom: '4px' }}>ชม. ผรม. นอก</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0369a1' }}>{totalOutsource} <span style={{ fontSize: '0.7rem' }}>ชม.</span></div>
                            </div>
                            <div style={{ background: '#f5f3ff', padding: '12px', borderRadius: '16px', border: '1px solid #ddd6fe', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6d28d9', marginBottom: '4px' }}>โอที</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#6d28d9' }}>{totalOT} <span style={{ fontSize: '0.7rem' }}>ชม.</span></div>
                            </div>
                        </div>
                    );
                })()}

                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {events.map((ev, idx) => {
                            const isEditing = isEditingId === ev.taskId;
                            const currentLabor = isEditing ? tempLabor : (ev.labor || []);

                            // Compute manpower counts
                            let internalCount = 0;
                            let outsourceCount = 0;
                            currentLabor.forEach((lab: any) => {
                                const isInternal = lab.membership === 'Internal'
                                    || (lab.membership !== 'Outsource' && !lab.contractorId)
                                    || (lab.workerId && String(lab.workerId).startsWith('DC-'))
                                    || (lab.staffId && String(lab.staffId).startsWith('DC-'));
                                const amt = Number(lab.amount) || 1;
                                if (isInternal) {
                                    internalCount += amt;
                                } else {
                                    outsourceCount += amt;
                                }
                            });

                            return (
                                <div key={idx} style={{ background: '#fff', borderRadius: '20px', border: isEditing ? `2px solid ${ev.color?.border || '#6366f1'}` : '1px solid #e2e8f0', borderLeft: `6px solid ${ev.color?.border || '#6366f1'}`, padding: '24px', boxShadow: isEditing ? `0 15px 40px -10px ${ev.color?.border || '#6366f1'}40` : 'none' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: ev.color?.text || '#6366f1', background: ev.color?.bg || '#eef2ff', border: `1px solid ${ev.color?.border || '#c7d2fe'}`, padding: '4px 10px', borderRadius: '8px' }}>{ev.projectName}</span>
                                            <h4 style={{ fontSize: '1.15rem', fontWeight: 950, color: '#0f172a', margin: '6px 0 0' }}>{ev.taskName}</h4>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 850, color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '6px' }}>
                                                    บริษัท: {internalCount} คน
                                                </span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 850, color: '#10b981', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '6px' }}>
                                                    ซับ: {outsourceCount} คน
                                                </span>
                                            </div>
                                            {!isEditing && (
                                                <button onClick={() => startEditing(ev)} style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#6366f1', padding: '8px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 850, cursor: 'pointer' }}>
                                                    <Edit2 size={14} style={{ marginRight: '6px' }} /> แก้ไข
                                                </button>
                                            )}
                                            {!isEditing && (() => {
                                                const allPhotos = getEventPhotos(ev);
                                                if (allPhotos.length === 0) return null;
                                                return (
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        {allPhotos.slice(0, 3).map((ph, pidx) => (
                                                            <img 
                                                                key={pidx} 
                                                                src={ph.url} 
                                                                alt={ph.label} 
                                                                title={ph.label}
                                                                style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0', cursor: 'pointer', background: '#f1f5f9', transition: 'transform 0.15s' }} 
                                                                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                                                onClick={() => openPhotoViewer(allPhotos, pidx)} 
                                                            />
                                                        ))}
                                                        {allPhotos.length > 3 && (
                                                            <div 
                                                                title="ดูรูปภาพเพิ่มเติม"
                                                                style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, color: '#64748b', cursor: 'pointer', transition: 'all 0.15s' }} 
                                                                onMouseOver={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                                                                onMouseOut={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.transform = 'scale(1)'; }}
                                                                onClick={() => openPhotoViewer(allPhotos, 3)}
                                                            >
                                                                +{allPhotos.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Task Notes & Problems Section */}
                                    <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {ev.note && ev.type !== 'Problem' && (
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                    <FileText size={14} color="#64748b" />
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>หมายเหตุ:</span>
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 700, lineHeight: 1.5 }}>{ev.note}</div>
                                            </div>
                                        )}
                                        {ev.type === 'Problem' && (
                                            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                    <AlertCircle size={14} color="#ef4444" />
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ef4444' }}>พบปัญหา/อุปสรรค:</span>
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: '#991b1b', fontWeight: 850, lineHeight: 1.5 }}>{ev.note}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Labor Cards */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                        {currentLabor.map((lab: any, lIdx: number) => (
                                            <div key={lIdx} style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}><Users size={18} /></div>
                                                    <div style={{ flex: 1 }}>
                                                        {(() => {
                                                            const isInternal = lab.membership === 'Internal'
                                                                || (lab.membership !== 'Outsource' && !lab.contractorId)
                                                                || (lab.workerId && String(lab.workerId).startsWith('DC-'))
                                                                || (lab.staffId && String(lab.staffId).startsWith('DC-'));
                                                            const workerId = lab.workerId || lab.staffId || lab.contractorId;
                                                            const matchingContractor = isInternal 
                                                                ? dailyContractors.find(c => c.id === workerId)
                                                                : masterContractors.find(c => c.id === workerId);
                                                            const empId = isInternal 
                                                                ? (lab.employeeId || matchingContractor?.employeeId || (workerId && String(workerId).startsWith('DC-') ? String(workerId).replace('DC-', '') : ''))
                                                                : (lab.contractorId || matchingContractor?.id || '');
                                                            const name = isInternal 
                                                                ? (lab.workerName || lab.staffName || matchingContractor?.name || lab.affiliation || 'ไม่ระบุชื่อ')
                                                                : (matchingContractor?.name || lab.affiliation || lab.workerName || 'ไม่ระบุชื่อ');
                                                            const label = isInternal ? 'คนงานบริษัท (Internal)' : 'ทีมงานผู้รับเหมา (Subco)';
                                                            
                                                            const empIdStr = empId ? `${empId} : ` : '';
                                                            return (
                                                                <>
                                                                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                                                                        {empIdStr}{name}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: isInternal ? '#3b82f6' : '#10b981', fontWeight: 800 }}>
                                                                        {label}
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                    {isEditing && (
                                                        <button onClick={() => removePerson(lIdx)} style={{ background: '#fef2f2', border: 'none', width: '32px', height: '32px', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {['normal', 'otMorning', 'otNoon', 'otEvening'].map(s => {
                                                        const active = lab.shifts?.[s];
                                                        if (!isEditing && !active) return null;

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
                                                <button onClick={() => setShowSelection('Internal')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px dashed #cbd5e1', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Plus size={16} /> ทีมงานบริษัท (Internal)</button>
                                                <button onClick={() => setShowSelection('Subco')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px dashed #cbd5e1', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Plus size={16} /> ทีมงานผู้รับเหมา (Subco)</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Dedicated Daily Report Photos Section */}
                                    {!isEditing && (() => {
                                        const allPhotos = getEventPhotos(ev);
                                        if (allPhotos.length === 0) return null;

                                        const photosObj = ev.photos || {};
                                        const sitePhotos = Array.isArray(photosObj) ? [] : (photosObj.site || []);
                                        const laborShift = Array.isArray(photosObj) ? null : (photosObj.laborByShift || null);
                                        const legacyLabor = ev.laborPhotos || [];

                                        const getShiftTime = (key: 'day' | 'otMorning' | 'otNoon' | 'otEvening') => {
                                            if (!ev.labor || !Array.isArray(ev.labor)) return '';
                                            const times = ev.labor
                                                .filter((l: any) => l.shifts?.[key === 'day' ? 'normal' : key])
                                                .map((l: any) => l.shiftTimes?.[key])
                                                .filter(Boolean);
                                            return times[0] || '';
                                        };
                                        const parseStart = (range: string) => range?.split(' - ')[0] || '';
                                        const parseEnd = (range: string) => range?.split(' - ')[1] || '';

                                        const normalRange = getShiftTime('day');
                                        const normalStart = parseStart(normalRange) || '08:00';
                                        const normalEnd = parseEnd(normalRange) || '17:00';

                                        const otMorningRange = getShiftTime('otMorning');
                                        const otMorningStart = parseStart(otMorningRange) || '06:00';
                                        const otMorningEnd = parseEnd(otMorningRange) || '08:00';

                                        const otNoonRange = getShiftTime('otNoon');
                                        const otNoonStart = parseStart(otNoonRange) || '12:00';
                                        const otNoonEnd = parseEnd(otNoonRange) || '13:00';

                                        const otEveningRange = getShiftTime('otEvening');
                                        const otEveningStart = parseStart(otEveningRange) || '18:00';
                                        const otEveningEnd = parseEnd(otEveningRange) || '21:00';

                                        // Function to open photo in full screen viewer using the index from allPhotos
                                        const handlePhotoClick = (url: string) => {
                                            const idx = allPhotos.findIndex(p => p.url === url);
                                            if (idx !== -1) {
                                                openPhotoViewer(allPhotos, idx);
                                            }
                                        };

                                        // Helper to render thumbnail with label underneath
                                        const renderPhotoThumbnail = (url: string, subLabel: string, fullLabel: string) => (
                                            <div key={url} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '70px' }}>
                                                <img 
                                                    src={url} 
                                                    alt={fullLabel}
                                                    title={fullLabel}
                                                    style={{ width: '70px', height: '70px', borderRadius: '12px', objectFit: 'cover', border: '1.5px solid #e2e8f0', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} 
                                                    onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.borderColor = '#6366f1'; }}
                                                    onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                                    onClick={() => handlePhotoClick(url)} 
                                                />
                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2 }}>{subLabel}</span>
                                            </div>
                                        );

                                        const hasSitePhotos = sitePhotos.length > 0;
                                        const hasLaborPhotos = (laborShift && (
                                            (laborShift.regular && laborShift.regular.some(Boolean)) || 
                                            laborShift.otMorning || 
                                            laborShift.otNoon || 
                                            laborShift.otEvening
                                        )) || legacyLabor.length > 0;

                                        return (
                                            <div style={{ background: '#f8fafc', borderRadius: '20px', padding: '18px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                                                <h5 style={{ fontSize: '0.85rem', fontWeight: 900, color: '#334155', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Camera size={16} color="#6366f1" /> รูปถ่ายรายงานประจำวัน
                                                </h5>

                                                {/* 1. Site Photos Category */}
                                                {hasSitePhotos && (
                                                    <div style={{ marginBottom: hasLaborPhotos ? '16px' : 0 }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#475569', background: '#e2e8f0', padding: '4px 10px', borderRadius: '8px', display: 'inline-block', marginBottom: '10px' }}>
                                                            รูปถ่ายหน้างาน (Site)
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                            {sitePhotos.map((url: string, pIdx: number) => (
                                                                url && renderPhotoThumbnail(url, `รูปที่ ${pIdx + 1}`, 'รูปถ่ายหน้างาน (Site)')
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 2. Labor Photos Category */}
                                                {hasLaborPhotos && (
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1e40af', background: '#dbeafe', padding: '4px 10px', borderRadius: '8px', display: 'inline-block', marginBottom: '10px' }}>
                                                            รูปถ่ายกำลังพล (Labor)
                                                        </div>

                                                        {/* Structured Labor Photos */}
                                                        {laborShift ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                {/* Regular Shift */}
                                                                {laborShift.regular && laborShift.regular.some(Boolean) && (
                                                                    <div>
                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>
                                                                            เวลาทำงานปกติ ({normalStart} - {normalEnd})
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                                            {(() => {
                                                                                const regularSubLabels = ['เข้า', 'พักเที่ยง', 'เข้าบ่าย', 'ออก'];
                                                                                const regularFullLabels = [
                                                                                    `กะปกติ: เข้า (${normalStart})`,
                                                                                    'กะปกติ: พักเที่ยง (12:00)',
                                                                                    'กะปกติ: เข้าบ่าย (13:00)',
                                                                                    `กะปกติ: ออก (${normalEnd})`
                                                                                ];
                                                                                return laborShift.regular.map((url: string, rIdx: number) => {
                                                                                    if (!url) return null;
                                                                                    return renderPhotoThumbnail(url, regularSubLabels[rIdx] || 'กะปกติ', regularFullLabels[rIdx] || 'กะปกติ');
                                                                                });
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* OT Morning */}
                                                                {laborShift.otMorning && (
                                                                    <div>
                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>
                                                                            OT เช้า ({otMorningStart} - {otMorningEnd})
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                                            {laborShift.otMorning.in && renderPhotoThumbnail(laborShift.otMorning.in, 'เข้า', `OT เช้า: เข้า (${otMorningStart})`)}
                                                                            {laborShift.otMorning.out && renderPhotoThumbnail(laborShift.otMorning.out, 'ออก', `OT เช้า: ออก (${otMorningEnd})`)}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* OT Noon */}
                                                                {laborShift.otNoon && (
                                                                    <div>
                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>
                                                                            OT เที่ยง ({otNoonStart} - {otNoonEnd})
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                                            {laborShift.otNoon.in && renderPhotoThumbnail(laborShift.otNoon.in, 'เข้า', `OT เที่ยง: เข้า (${otNoonStart})`)}
                                                                            {laborShift.otNoon.out && renderPhotoThumbnail(laborShift.otNoon.out, 'ออก', `OT เที่ยง: ออก (${otNoonEnd})`)}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* OT Evening */}
                                                                {laborShift.otEvening && (
                                                                    <div>
                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>
                                                                            OT เย็น ({otEveningStart} - {otEveningEnd})
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                                            {laborShift.otEvening.in && renderPhotoThumbnail(laborShift.otEvening.in, 'เข้า', `OT เย็น: เข้า (${otEveningStart})`)}
                                                                            {laborShift.otEvening.out && renderPhotoThumbnail(laborShift.otEvening.out, 'ออก', `OT เย็น: ออก (${otEveningEnd})`)}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            /* Legacy Labor Photos */
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                                {legacyLabor.map((url: string, pIdx: number) => (
                                                                    url && renderPhotoThumbnail(url, `รูปที่ ${pIdx + 1}`, 'รูปถ่ายกำลังพล (Labor)')
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

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
                                    placeholder={`ค้นหาชื่อ${showSelection === 'Internal' ? 'คนงานบริษัท (Internal)' : 'ทีมงานผู้รับเหมา (Subco)'}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: '2px solid #6366f1', background: '#f8faff', fontSize: '1rem', fontWeight: 700 }}
                                />
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                            {filteredMasters.map((p: any) => (
                                <div key={p.id} onClick={() => addPerson(p, showSelection)} style={{ padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9', marginBottom: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }} onMouseOver={(e) => e.currentTarget.style.background = '#f8faff'} onMouseOut={(e) => e.currentTarget.style.background = 'none'}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: showSelection === 'Internal' ? '#eff6ff' : '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showSelection === 'Internal' ? '#3b82f6' : '#10b981', fontWeight: 900, fontSize: '1rem', flexShrink: 0 }}>{p.name?.[0]}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {showSelection === 'Internal' && p.employeeId ? (
                                                <><span style={{ color: '#6366f1', fontWeight: 800, fontSize: '0.85rem', marginRight: '6px' }}>{p.employeeId}</span>{p.name}</>
                                            ) : p.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: showSelection === 'Internal' ? '#3b82f6' : '#10b981', fontWeight: 700, marginTop: '2px' }}>
                                            {showSelection === 'Internal' ? (p.department || p.affiliation || p.skillId || 'General') : (p.specialty?.[0] || p.affiliation || 'ผู้รับเหมา')}
                                        </div>
                                    </div>
                                    <Plus size={18} style={{ marginLeft: 'auto', color: showSelection === 'Internal' ? '#3b82f6' : '#10b981', flexShrink: 0 }} />
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

                <ImageOverlay 
                    src={previewImage || ''} 
                    isOpen={!!previewImage} 
                    onClose={() => {
                        setPreviewImage(null);
                        setPreviewImagesList([]);
                        setPreviewImageIndex(0);
                    }} 
                    images={previewImagesList}
                    currentIndex={previewImageIndex}
                    onIndexChange={(idx) => {
                        setPreviewImageIndex(idx);
                        setPreviewImage(previewImagesList[idx]?.url || null);
                    }}
                />
            </div>
        </div>
    );
};

export default ForemanCalendar;
