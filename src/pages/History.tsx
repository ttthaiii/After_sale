import { useState, useMemo, useEffect } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import HistoryDetailModal from '../components/HistoryDetailModal';
import MasterFilter from '../components/MasterFilter';
import { Archive, Search, Building2, User2, RotateCcw, ChevronRight, FileSpreadsheet, FileText, CheckCircle, SlidersHorizontal, Layers, Clock, XCircle, Star } from 'lucide-react';
import { WorkOrder, MasterTask } from '../types';
import { logService } from '../services/logService';
import { formatDate } from '../utils/date';

const History = () => {
    const { workOrders, projects, staff, contractors } = useWorkOrders();
    const { user } = useAuth();
    const currentRole = user?.role || 'Approver';
    const CURRENT_USER_ID = user?.id || '';

    // ✅ Track Page View
    useEffect(() => {
        if (user) {
            logService.trackPageView(user, 'HISTORY', 'ประวัติงาน (Job History)');
        }
    }, [user]);

    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState(currentRole === 'Foreman' ? CURRENT_USER_ID : '');
    const effectiveStaffId = currentRole === 'Foreman' ? (user?.employeeId || user?.id || '') : selectedStaffId;
    const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`);
    const [selectedWeek, setSelectedWeek] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSlaStatus, setSelectedSlaStatus] = useState('');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'Active' | 'Archived'>('Archived');

    // Base history work orders (before applying search/dropdown filters)
    const baseHistoryWorkOrders = useMemo(() => {
        return workOrders.filter(wo => {
            const isOfficiallyFinished = wo.status === 'Completed' || wo.status === 'Verified' || wo.status === 'Rejected' || wo.status === 'Cancelled' || wo.isArchived;
            // PreHandover WOs: show if any category has been worked on (dailyProgress > 0) or WO finished
            if ((wo as any).type === 'PreHandover') {
                const hasProgress = wo.categories.some((c: any) => (c.dailyProgress || 0) > 0);
                if (currentRole === 'Foreman') {
                    const matchesUser = (id: string) => id === CURRENT_USER_ID || (user?.employeeId && id === user.employeeId);
                    const isMyCategory = wo.categories.some((c: any) => c.assignedForemanId && matchesUser(c.assignedForemanId));
                    return isMyCategory && (hasProgress || isOfficiallyFinished);
                }
                return hasProgress || isOfficiallyFinished;
            }
            if (currentRole === 'Foreman') {
                const matchesUser = (id: string) => id === CURRENT_USER_ID || (user?.employeeId && id === user.employeeId);

                const hasTaskAssigned = wo.categories.some(cat =>
                    cat.tasks.some(task =>
                        task.responsibleStaffIds?.some(id => matchesUser(id))
                    )
                );
                const isReporter = matchesUser(wo.reporterId || '');

                return isOfficiallyFinished || hasTaskAssigned || isReporter;
            } else {
                // Admin/Approver: show finished WOs + in-progress WOs that have at least one foreman assigned
                const hasAssignedForeman = wo.categories.some(cat =>
                    cat.tasks.some(task =>
                        task.responsibleStaffIds && task.responsibleStaffIds.length > 0
                    )
                );
                return isOfficiallyFinished || hasAssignedForeman;
            }
        });
    }, [workOrders, currentRole, CURRENT_USER_ID, user?.employeeId]);

    // Derived Projects (Only show projects that have jobs in history)
    const activeProjects = useMemo(() => {
        const projectIdsInHistory = new Set(baseHistoryWorkOrders.map(wo => wo.projectId));
        return projects.filter(p => projectIdsInHistory.has(p.id));
    }, [projects, baseHistoryWorkOrders]);

    // Derived Staff (Only show staff that appear in history)
    const activeStaff = useMemo(() => {
        const staffIdsInHistory = new Set();
        baseHistoryWorkOrders.forEach(wo => {
            if (wo.reporterId) staffIdsInHistory.add(wo.reporterId);
            wo.categories.forEach(cat => {
                cat.tasks.forEach(task => {
                    task.responsibleStaffIds?.forEach(id => staffIdsInHistory.add(id));
                });
            });
        });
        return staff.filter(s => staffIdsInHistory.has(s.id) || staffIdsInHistory.has(s.employeeId));
    }, [staff, baseHistoryWorkOrders]);

    // Filtered result for the table
    const archivedWorkOrders = useMemo(() => {
        return baseHistoryWorkOrders.filter(wo => {
            const matchesSearch = (wo.locationName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (wo.id || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesProject = selectedProjectId ? wo.projectId === selectedProjectId : true;
            
            const targetStaff = effectiveStaffId ? staff.find(s => s.id === effectiveStaffId) : null;
            const matchesStaff = effectiveStaffId ? (
                wo.reporterId === effectiveStaffId ||
                (targetStaff && wo.reporterId === targetStaff.employeeId) ||
                wo.categories.some(cat =>
                    cat.tasks.some(task => 
                        task.responsibleStaffIds?.includes(effectiveStaffId) ||
                        (targetStaff && task.responsibleStaffIds?.includes(targetStaff.employeeId)) ||
                        (targetStaff && targetStaff.id && task.responsibleStaffIds?.includes(targetStaff.id))
                    )
                )
            ) : true;

            const woDate = new Date(wo.createdAt);
            const woMonth = `${woDate.getFullYear()}-${(woDate.getMonth() + 1).toString().padStart(2, '0')}`;
            const matchesMonth = selectedMonth ? woMonth === selectedMonth : true;

            let matchesWeek = true;
            if (selectedWeek !== 0) {
                const d = woDate.getDate();
                const w = d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : d <= 28 ? 4 : 5;
                matchesWeek = w === selectedWeek;
            }

            const matchesCategory = selectedCategory ? wo.categories.some(cat => cat.name === selectedCategory) : true;
            const matchesSlaStatus = selectedSlaStatus ? true : true;

            return matchesSearch && matchesProject && matchesStaff && matchesMonth && matchesWeek && matchesCategory && matchesSlaStatus;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [baseHistoryWorkOrders, searchTerm, selectedProjectId, effectiveStaffId, staff, selectedMonth, selectedWeek, selectedCategory, selectedSlaStatus]);

    // Flatten all work orders into all tasks first (1-to-1) before separating by active/archived tabs
    const allHistoryTasks = useMemo(() => {
        const list: { 
            wo: WorkOrder; 
            task: MasterTask; 
            categoryName: string;
            taskIndex: number;
            totalTasksCount: number;
        }[] = [];
        
        archivedWorkOrders.forEach(wo => {
            const allTasks = wo.categories.flatMap(cat => cat.tasks || []);
            
            // Filter out fake/placeholder rejected tasks (status is 'Rejected', no staff assigned, and rootCause is empty or missing)
            const nonFakeTasks = allTasks.filter(t => {
                if (!t) return false;
                const isFakeReject = t.status === 'Rejected' && 
                    (!t.responsibleStaffIds || t.responsibleStaffIds.length === 0) &&
                    (!t.rootCause || t.rootCause.trim() === '');
                return !isFakeReject;
            });
            const totalCount = nonFakeTasks.length;
            
            wo.categories.forEach(cat => {
                const tasks = cat.tasks || [];
                tasks.forEach((task, tIdx) => {
                    if (!task) return;
                    
                    const isFakeReject = task.status === 'Rejected' && 
                        (!task.responsibleStaffIds || task.responsibleStaffIds.length === 0) &&
                        (!task.rootCause || task.rootCause.trim() === '');
                    if (isFakeReject) return;
                    
                    // Task-level staff filtering
                    if (effectiveStaffId) {
                        const targetStaff = staff.find(s => s.id === effectiveStaffId);
                        const isAssigned = task.responsibleStaffIds?.includes(effectiveStaffId) ||
                            (targetStaff && task.responsibleStaffIds?.includes(targetStaff.employeeId)) ||
                            (targetStaff && targetStaff.id && task.responsibleStaffIds?.includes(targetStaff.id));
                        if (!isAssigned) return;
                    }
                    
                    list.push({ 
                        wo, 
                        task, 
                        categoryName: cat.name,
                        taskIndex: tIdx + 1,
                        totalTasksCount: totalCount
                    });
                });
            });
        });
        return list;
    }, [archivedWorkOrders, effectiveStaffId, staff]);

    // Check if the work order is fully completed and evaluated (all tasks are finished/closed)
    const isWorkOrderFullyCompleted = (wo: WorkOrder) => {
        if (wo.status === 'Verified' || wo.status === 'Completed') return true;
        
        const allTasks = wo.categories.flatMap(cat => cat.tasks || []);
        const activeTasks = allTasks.filter(t => {
            if (!t) return false;
            // Filter out fake/placeholder rejected tasks
            const isFakeReject = t.status === 'Rejected' && 
                (!t.responsibleStaffIds || t.responsibleStaffIds.length === 0) &&
                (!t.rootCause || t.rootCause.trim() === '');
            return !isFakeReject;
        });
        
        if (activeTasks.length === 0) return false;
        
        return activeTasks.every(t => 
            t.status === 'Verified' || 
            t.status === 'completed' || 
            t.status === 'Approved' || 
            t.status === 'Cancelled'
        );
    };

    // Calculate accurate Task counts for each sub-tab
    const activeTasksCount = useMemo(() => {
        return allHistoryTasks.filter(item => {
            const foremanId = item.wo.categories.flatMap(cat => cat.tasks || []).find(t => t && t.responsibleStaffIds && t.responsibleStaffIds.length > 0)?.responsibleStaffIds?.[0];
            const hasTaskStaff = item.task.responsibleStaffIds && item.task.responsibleStaffIds.length > 0;
            const isTaskClosed = 
                (item.task.status as string) === 'Verified' || 
                (item.task.status as string) === 'completed' || 
                item.wo.status === 'Verified' || 
                item.wo.status === 'Completed' || 
                item.wo.status === 'Cancelled' || 
                ((item.task.status as string) === 'Rejected' && !hasTaskStaff) ||
                (item.wo.status === 'Rejected' && !foremanId);
            return !isTaskClosed;
        }).length;
    }, [allHistoryTasks]);

    const archivedTasksCount = useMemo(() => {
        return allHistoryTasks.filter(item => {
            const foremanId = item.wo.categories.flatMap(cat => cat.tasks || []).find(t => t && t.responsibleStaffIds && t.responsibleStaffIds.length > 0)?.responsibleStaffIds?.[0];
            const hasTaskStaff = item.task.responsibleStaffIds && item.task.responsibleStaffIds.length > 0;
            const isTaskClosed = 
                (item.task.status as string) === 'Verified' || 
                (item.task.status as string) === 'completed' || 
                item.wo.status === 'Verified' || 
                item.wo.status === 'Completed' || 
                item.wo.status === 'Cancelled' || 
                ((item.task.status as string) === 'Rejected' && !hasTaskStaff) ||
                (item.wo.status === 'Rejected' && !foremanId);
            return isTaskClosed;
        }).length;
    }, [allHistoryTasks]);

    // Choose which list to render in the table based on selected sub-tab
    const displayedTasks = useMemo(() => {
        return allHistoryTasks.filter(item => {
            const foremanId = item.wo.categories.flatMap(cat => cat.tasks || []).find(t => t && t.responsibleStaffIds && t.responsibleStaffIds.length > 0)?.responsibleStaffIds?.[0];
            const hasTaskStaff = item.task.responsibleStaffIds && item.task.responsibleStaffIds.length > 0;
            const isTaskClosed = 
                (item.task.status as string) === 'Verified' || 
                (item.task.status as string) === 'completed' || 
                item.wo.status === 'Verified' || 
                item.wo.status === 'Completed' || 
                item.wo.status === 'Cancelled' || 
                ((item.task.status as string) === 'Rejected' && !hasTaskStaff) ||
                (item.wo.status === 'Rejected' && !foremanId);
            return activeSubTab === 'Active' ? !isTaskClosed : isTaskClosed;
        });
    }, [allHistoryTasks, activeSubTab]);

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedProjectId('');
        setSelectedStaffId(currentRole === 'Foreman' ? CURRENT_USER_ID : '');
        setSelectedMonth(`${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`);
        setSelectedWeek(0);
        setSelectedCategory('');
        setSelectedSlaStatus('');
    };

    const commonInputStyle = {
        width: '100%',
        padding: '10px 12px 10px 42px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        color: '#0f172a',
        fontSize: '0.9rem',
        outline: 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    };

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px 4rem 24px' }}>
            {/* Header & Export Placeholder */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '20px', color: '#6366f1', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.1)' }}>
                        <Archive size={36} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>ประวัติงาน (Job History)</h1>
                        <span style={{ color: '#64748b', fontSize: '1rem', marginTop: '4px', display: 'block', fontWeight: 500 }}>
                            {activeSubTab === 'Active' 
                                ? `รายการงานย่อยที่อยู่ระหว่างดำเนินการและรอตรวจรับ ทั้งหมด ${activeTasksCount} รายการ` 
                                : `คลังประวัติและเอกสารส่งมอบงานสำเร็จ/ยกเลิก ทั้งหมด ${archivedTasksCount} รายการ`}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                        <FileSpreadsheet size={18} style={{ color: '#10b981' }} /> Export Excel
                    </button>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                        <FileText size={18} style={{ color: '#ef4444' }} /> Export PDF
                    </button>
                </div>
            </div>

            {/* Two-Card Filter Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', marginBottom: '2.5rem', alignItems: 'stretch' }}>
                {/* Left Card: Search & Dropdowns */}
                <div style={{ 
                    background: '#ffffff', 
                    padding: '1.5rem', 
                    borderRadius: '32px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px', 
                    justifyContent: 'center' 
                }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text" placeholder="ค้นหา Unit / ID / เลขที่บ้าน..."
                            style={commonInputStyle}
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ position: 'relative' }}>
                            <Building2 size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <select
                                style={{ ...commonInputStyle, appearance: 'none' }}
                                value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
                            >
                                <option value="">ทุกโครงการ</option>
                                {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <User2 size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <select
                                style={{ ...commonInputStyle, appearance: 'none' }}
                                value={effectiveStaffId} disabled={currentRole === 'Foreman'}
                                onChange={e => setSelectedStaffId(e.target.value)}
                            >
                                <option value="">พนักงานทั้งหมด</option>
                                {activeStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            onClick={clearFilters} 
                            style={{ flex: 1, height: '42px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800, fontSize: '0.85rem' }}
                        >
                            <RotateCcw size={16} /> ล้างค่า
                        </button>
                        <button 
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} 
                            style={{ flex: 1, height: '42px', background: showAdvancedFilters ? '#eff6ff' : '#ffffff', border: `1px solid ${showAdvancedFilters ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: '14px', color: showAdvancedFilters ? '#3b82f6' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800, fontSize: '0.85rem' }}
                        >
                            <SlidersHorizontal size={16} /> ตัวเลือกเสริม
                        </button>
                    </div>
                </div>

                {/* Right Card: Master Filter */}
                <MasterFilter 
                    selectedMonth={selectedMonth} 
                    setSelectedMonth={setSelectedMonth} 
                    selectedWeek={selectedWeek} 
                    setSelectedWeek={setSelectedWeek}
                    style={{ height: '100%', justifyContent: 'center', padding: '1.5rem' }} 
                />
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
                <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '20px', borderRadius: '24px', border: '1px solid #e2e8f0', borderStyle: 'dashed' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Layers size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <select
                                    style={{ ...commonInputStyle, appearance: 'none' }}
                                    value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                                >
                                    <option value="">ทุกหมวดหมู่งาน</option>
                                    <option value="งานสถาปัตยกรรม (Architecture)">งานสถาปัตยกรรม (Architecture)</option>
                                    <option value="งานระบบไฟฟ้า (Electrical)">งานระบบไฟฟ้า (Electrical)</option>
                                    <option value="งานระบบประปา/สุขาภิบาล (Plumbing)">งานระบบประปา/สุขาภิบาล (Plumbing)</option>
                                </select>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <Clock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <select
                                    style={{ ...commonInputStyle, appearance: 'none' }}
                                    value={selectedSlaStatus} onChange={e => setSelectedSlaStatus(e.target.value)}
                                >
                                    <option value="">สถานะ SLA (ทั้งหมด)</option>
                                    <option value="Ontime">ตรงตามเวลา (On-time)</option>
                                    <option value="Delayed">ล่าช้า (Delayed)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', background: '#f1f5f9', padding: '4px', borderRadius: '16px', width: 'fit-content' }}>
                <button
                    onClick={() => setActiveSubTab('Active')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        background: activeSubTab === 'Active' ? '#ffffff' : 'transparent',
                        color: activeSubTab === 'Active' ? '#4f46e5' : '#64748b',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: activeSubTab === 'Active' ? '0 4px 12px -2px rgba(79, 70, 229, 0.12)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <Clock size={16} />
                    รายการงานปัจจุบัน ({activeTasksCount})
                </button>
                <button
                    onClick={() => setActiveSubTab('Archived')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        background: activeSubTab === 'Archived' ? '#ffffff' : 'transparent',
                        color: activeSubTab === 'Archived' ? '#4f46e5' : '#64748b',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: activeSubTab === 'Archived' ? '0 4px 12px -2px rgba(79, 70, 229, 0.12)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <Archive size={16} />
                    คลังประวัติสำเร็จ/ยกเลิก ({archivedTasksCount})
                </button>
            </div>
                                 {/* Compact List Table */}
            <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b', whiteSpace: 'nowrap' }}>เลขที่ใบงาน / รายการซ่อม</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>โครงการ / หมวดงาน</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>ยูนิต</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>วันที่เริ่ม - จบ</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>ผู้แจ้งซ่อม</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>ผู้รับผิดชอบ / ช่าง</th>
                            {activeSubTab === 'Active' ? (
                                <th style={{ padding: '16px 12px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b', textAlign: 'center' }}>ความคืบหน้า</th>
                            ) : (
                                <th style={{ padding: '16px 12px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b', textAlign: 'center' }}>การประเมิน</th>
                            )}
                            <th style={{ padding: '16px 12px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b', textAlign: 'center' }}>สถานะ</th>
                            <th style={{ padding: '16px 12px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedTasks.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
                                    {activeSubTab === 'Active' 
                                        ? 'ไม่พบรายการงานที่อยู่ระหว่างดำเนินการ' 
                                        : 'ไม่พบรายการสถิติประวัติงานส่งมอบแล้ว'}
                                </td>
                            </tr>
                        ) : (
                            displayedTasks.map(item => {
                                const wo = item.wo;
                                const task = item.task;
                                const project = projects.find(p => p.id === wo.projectId);

                                // Find the primary Foreman assigned to this WO
                                const allTasks = wo.categories.flatMap(cat => cat.tasks || []);
                                const foremanId = allTasks.find(t => t.responsibleStaffIds && t.responsibleStaffIds.length > 0)?.responsibleStaffIds?.[0];
                                const taskStaffId = task.responsibleStaffIds?.[0];
                                const staffMember = staff.find(s => s.id === taskStaffId) || staff.find(s => s.id === foremanId);

                                const isMyTask = task.responsibleStaffIds?.includes(CURRENT_USER_ID) || 
                                                 (user?.employeeId && task.responsibleStaffIds?.includes(user.employeeId));

                                // Collect other foremen who worked on the same WO
                                const otherStaffIds = Array.from(
                                    new Set(
                                        allTasks
                                            .flatMap(t => t.responsibleStaffIds || [])
                                            .filter(id => !task.responsibleStaffIds?.includes(id))
                                    )
                                );
                                const otherStaffNames = otherStaffIds
                                    .map(id => staff.find(s => s.id === id)?.name)
                                    .filter(Boolean)
                                    .map(name => name.startsWith('คุณ') ? name : `คุณ${name}`);

                                const revNum = task.currentRevision ? (parseInt(task.currentRevision.replace('rev', '')) || 0) : 0;

                                // Calculate task progress dynamically
                                let taskProgress = task.dailyProgress || 0;
                                if (task.status?.toLowerCase() === 'completed' || task.status === 'Verified') {
                                    taskProgress = 100;
                                } else if (task.status?.toLowerCase() === 'in-progress' && taskProgress === 0) {
                                    taskProgress = 50;
                                }

                                // Determine End Date dynamically based on task status, wo status, or history
                                let endDateStr = '-';
                                if (task.status === 'Verified' || wo.status === 'Verified') {
                                    let latestDate = new Date(wo.createdAt).getTime();
                                    if (wo.submittedAt) {
                                        latestDate = new Date(wo.submittedAt).getTime();
                                    }
                                    task.history?.forEach((h: any) => {
                                        const d = new Date(h.date).getTime();
                                        if (d > latestDate) latestDate = d;
                                    });
                                    endDateStr = formatDate(latestDate);
                                } else if (task.status === 'Rejected' || wo.status === 'Rejected') {
                                    endDateStr = 'ปฏิเสธงาน';
                                } else if (wo.status === 'Cancelled') {
                                    endDateStr = 'ยกเลิก';
                                } else {
                                    endDateStr = 'ยังไม่เสร็จ';
                                }

                                return (
                                    <tr
                                        key={`${wo.id}-${task.id}`}
                                        onClick={() => {
                                            setSelectedWO(wo);
                                            setSelectedTaskId(task.id);
                                        }}
                                        style={{ 
                                             borderBottom: '1px solid #f1f5f9', 
                                             cursor: 'pointer', 
                                             transition: 'background 0.2s',
                                             borderLeft: isMyTask ? '4px solid #4f46e5' : 'none'
                                         }}
                                        onMouseOver={e => e.currentTarget.style.background = '#fcfcfd'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {/* WorkOrder ID & Repair Task */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{wo.id}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                     <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>{task.name || 'ไม่ระบุชื่อรายการ'}</span>
                                                     {revNum > 0 && (
                                                         <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#be123c', background: '#fff1f2', padding: '1px 5px', borderRadius: '4px', border: '1px solid #ffe4e6' }}>
                                                             ตีกลับแก้ {revNum} ครั้ง
                                                         </span>
                                                     )}
                                                 </div>
                                            </div>
                                        </td>

                                        {/* Project / Category */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px' }}>
                                                    {project?.name || wo.projectId}
                                                </span>
                                                <span style={{ fontSize: '0.75rem', color: '#4b5563', fontWeight: 600 }}>{item.categoryName}</span>
                                            </div>
                                        </td>

                                        {/* Location */}
                                        <td style={{ padding: '16px 24px', fontWeight: 700, color: '#334155', fontSize: '0.9rem' }}>{wo.locationName}</td>

                                        {/* Date Start - End */}
                                        <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                                            {formatDate(wo.createdAt)} - {endDateStr}
                                        </td>

                                        {/* Reporter */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: 800, fontSize: '0.9rem' }}>
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                    <User2 size={12} />
                                                </div>
                                                {wo.reporterName.startsWith('คุณ') ? wo.reporterName : `คุณ${wo.reporterName}`}
                                            </div>
                                        </td>

                                        {/* Responsible Staff / Foreman */}
                                         <td style={{ padding: '16px 24px' }}>
                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>
                                                     <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', background: '#eef2ff', border: '1px solid #e0e7ff', flexShrink: 0 }}>
                                                         {staffMember?.profileImage ? (
                                                             <img loading="lazy" src={staffMember.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                         ) : (
                                                             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}><User2 size={12} /></div>
                                                         )}
                                                     </div>
                                                     <span>{staffMember ? (staffMember.name.startsWith('คุณ') ? staffMember.name : `คุณ${staffMember.name}`) : 'ไม่ได้ระบุ'}</span>
                                                     {isMyTask && (
                                                         <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#ffffff', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', padding: '2px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                             ฉัน
                                                         </span>
                                                     )}
                                                 </div>
                                                 {otherStaffNames.length > 0 && (
                                                     <div style={{ fontSize: '0.7rem', color: '#94a3b8', paddingLeft: '32px', fontWeight: 600 }}>
                                                         ผู้ร่วมงาน: {otherStaffNames.join(', ')}
                                                     </div>
                                                 )}
                                             </div>
                                         </td>

                                        {/* Progress or Rating */}
                                        {activeSubTab === 'Active' ? (
                                            <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: taskProgress === 100 ? '#10b981' : '#64748b' }}>
                                                        {taskProgress}%
                                                    </span>
                                                    <div style={{ width: '60px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${taskProgress}%`, height: '100%', background: taskProgress === 100 ? '#10b981' : '#1d4ed8' }} />
                                                    </div>
                                                </div>
                                            </td>
                                        ) : (
                                            <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                                                {(isWorkOrderFullyCompleted(wo) && task.status !== 'Rejected') ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#f59e0b' }}>
                                                            <Star size={14} fill="#f59e0b" style={{ stroke: 'none' }} />
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a' }}>
                                                                {(task as any).satisfaction || (wo as any).overallSatisfaction || '5.0'}
                                                            </span>
                                                        </div>
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>ผลประเมิน</span>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>-</span>
                                                )}
                                            </td>
                                        )}

                                        {/* Status Badge */}
                                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                                            {wo.status === 'Cancelled' ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #e2e8f0' }}>
                                                    <XCircle size={14} /> ยกเลิกใบงาน
                                                </div>
                                            ) : (task.status as string) === 'Rejected' || (wo.status === 'Rejected' && (task.status as string) !== 'Verified') ? (
                                                (!task.responsibleStaffIds || task.responsibleStaffIds.length === 0) || !foremanId ? (
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444', background: '#fef2f2', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #fee2e2' }}>
                                                        <XCircle size={14} /> ปฏิเสธโดยแอดมิน
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#be123c', background: '#fff1f2', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #ffe4e6' }}>
                                                        <RotateCcw size={14} /> ส่งคืนแก้ไข (ลูกค้า)
                                                    </div>
                                                )
                                            ) : (task.status as string) === 'Verified' || (wo.status === 'Verified' && (task.status as string) !== 'Rejected') ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', background: '#ecfdf5', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #d1fae5' }}>
                                                    <CheckCircle size={14} /> สำเร็จสมบูรณ์
                                                </div>
                                            ) : wo.status === 'pending_delivery' ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#d97706', background: '#fef3c7', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #fde68a' }}>
                                                    <Clock size={14} /> รอลูกค้าประเมิน
                                                </div>
                                            ) : (task.status as string)?.toLowerCase() === 'completed' ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#d97706', background: '#fffbeb', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #fef3c7' }}>
                                                    <Clock size={14} /> รอ Owner ตรวจรับ
                                                </div>
                                            ) : (task.status as string) === 'Evaluating' || wo.status === 'Evaluating' ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#7c3aed', background: '#f5f3ff', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #ddd6fe' }}>
                                                    <User2 size={14} /> รอมอบหมาย [แอดมิน]
                                                </div>
) : (task.status as string) === 'in-progress' && revNum > 0 ? (
                                                 <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#b45309', background: '#fef3c7', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #fde68a' }}>
                                                     <Clock size={14} /> กำลังรอแก้ไขครั้งที่ {revNum}
                                                 </div>
                                             ) : (
                                                 <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1d4ed8', background: '#eff6ff', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #bfdbfe' }}>
                                                     <Clock size={14} /> กำลังดำเนินการ
                                                 </div>
                                             )}
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right', color: '#cbd5e1' }}>
                                            <ChevronRight size={20} />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Details Modal */}
            {selectedWO && (
                <HistoryDetailModal
                    isOpen={!!selectedWO}
                    workOrder={selectedWO}
                    onClose={() => {
                        setSelectedWO(null);
                        setSelectedTaskId(null);
                    }}
                    projects={projects}
                    staff={staff}
                    contractors={contractors}
                    currentUserId={user?.id}
                    selectedTaskId={selectedTaskId}
                />
            )}
        </div>
    );
};

export default History;
