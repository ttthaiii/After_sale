import { useState, useMemo, useEffect } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import HistoryDetailModal from '../components/HistoryDetailModal';
import MasterFilter from '../components/MasterFilter';
import { Archive, Search, Building2, User2, RotateCcw, ChevronRight, FileSpreadsheet, FileText, CheckCircle, SlidersHorizontal, Layers, Clock, XCircle } from 'lucide-react';
import { WorkOrder } from '../types';
import { logService } from '../services/logService';

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
    const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`);
    const [selectedWeek, setSelectedWeek] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSlaStatus, setSelectedSlaStatus] = useState('');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);

    // Base history work orders (before applying search/dropdown filters)
    const baseHistoryWorkOrders = useMemo(() => {
        return workOrders.filter(wo => {
            if (currentRole === 'Foreman') {
                const isOfficiallyFinished = wo.status === 'Completed' || wo.status === 'Rejected' || wo.status === 'Cancelled' || wo.isArchived;
                const matchesUser = (id: string) => id === CURRENT_USER_ID || (user?.employeeId && id === user.employeeId);
                
                const hasCompletedOwnTask = wo.categories.some(cat =>
                    cat.tasks.some(task => 
                        task.responsibleStaffIds?.some(id => matchesUser(id)) && 
                        task.status?.toLowerCase() === 'completed'
                    )
                );
                const isReporter = matchesUser(wo.reporterId || '');
                
                return isOfficiallyFinished || hasCompletedOwnTask || isReporter;
            } else {
                return wo.status === 'Completed' || wo.status === 'Rejected' || wo.status === 'Cancelled' || wo.isArchived;
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
        return staff.filter(s => staffIdsInHistory.has(s.id));
    }, [staff, baseHistoryWorkOrders]);

    // Filtered result for the table
    const archivedWorkOrders = useMemo(() => {
        return baseHistoryWorkOrders.filter(wo => {
            const matchesSearch = wo.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                wo.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesProject = selectedProjectId ? wo.projectId === selectedProjectId : true;
            const matchesStaff = selectedStaffId ? (
                wo.reporterId === selectedStaffId ||
                wo.categories.some(cat =>
                    cat.tasks.some(task => 
                        task.responsibleStaffIds?.includes(selectedStaffId) ||
                        // Fallback: หากเลือกตัวเอง ให้เช็ค employeeId ด้วย
                        (selectedStaffId === CURRENT_USER_ID && user?.employeeId && task.responsibleStaffIds?.includes(user.employeeId))
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
    }, [baseHistoryWorkOrders, searchTerm, selectedProjectId, selectedStaffId, selectedMonth, selectedWeek, selectedCategory, selectedSlaStatus]);

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
                        <span style={{ color: '#64748b', fontSize: '1rem', marginTop: '4px', display: 'block', fontWeight: 500 }}>รายการที่ปิดงานเสร็จสมบูรณ์แล้ว ทั้งหมด {archivedWorkOrders.length} รายการ</span>
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
                                value={selectedStaffId} disabled={currentRole === 'Foreman'}
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

            {/* Compact List Table */}
            <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b', whiteSpace: 'nowrap' }}>เลขที่ใบงาน</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>โครงการ</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>ยูนิต</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>วันที่เริ่ม - จบ</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>ผู้แจ้งซ่อม</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b' }}>โฟร์แมน</th>
                            <th style={{ padding: '16px 12px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b', textAlign: 'center' }}>ความคืบหน้า</th>
                            <th style={{ padding: '16px 12px', fontSize: '0.85rem', fontWeight: 900, color: '#64748b', textAlign: 'center' }}>สถานะ</th>
                            <th style={{ padding: '16px 12px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {archivedWorkOrders.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>ไม่พบรายการสถิติประวัติงานที่ค้นหา</td>
                            </tr>
                        ) : (
                            archivedWorkOrders.map(wo => {
                                const project = projects.find(p => p.id === wo.projectId);

                                // ✅ Find the primary Foreman assigned to this WO
                                const allTasks = wo.categories.flatMap(cat => cat.tasks);
                                const foremanId = allTasks.find(t => t.responsibleStaffIds && t.responsibleStaffIds.length > 0)?.responsibleStaffIds?.[0];
                                const foreman = staff.find(s => s.id === foremanId);

                                const validTasks = allTasks.filter(t => t.status !== 'Rejected');
                                const totalCount = validTasks.length > 0 ? validTasks.length : allTasks.length;
                                const completedCount = validTasks.filter(t => t.status?.toLowerCase() === 'completed').length;
                                const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                                // Determine Actual End Date dynamically based on history and submission timestamps
                                let endDateStr = '-';
                                if (wo.status?.toLowerCase() === 'completed' || percentage === 100) {
                                    let latestDate = new Date(wo.createdAt).getTime();
                                    if (wo.submittedAt) {
                                        latestDate = new Date(wo.submittedAt).getTime();
                                    }
                                    // Scan task histories for the last reported progress
                                    allTasks.forEach(t => {
                                        t.history?.forEach(h => {
                                            const d = new Date(h.date).getTime();
                                            if (d > latestDate) latestDate = d;
                                        });
                                    });
                                    endDateStr = new Date(latestDate).toLocaleDateString('th-TH');
                                } else if (wo.status === 'Rejected' || wo.status === 'Cancelled') {
                                    endDateStr = 'ถูกยกเลิก';
                                } else {
                                    endDateStr = 'ยังไม่จบโครงการ';
                                }

                                return (
                                    <tr
                                        key={wo.id}
                                        onClick={() => setSelectedWO(wo)}
                                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s' }}
                                        onMouseOver={e => e.currentTarget.style.background = '#fcfcfd'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '16px 24px', fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{wo.id}</td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px' }}>
                                                {project?.name || wo.projectId}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 24px', fontWeight: 700, color: '#334155', fontSize: '0.9rem' }}>{wo.locationName}</td>
                                        <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                                            {new Date(wo.createdAt).toLocaleDateString('th-TH')} - {endDateStr}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            {/* Reporter */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: 800, fontSize: '0.9rem' }}>
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                    <User2 size={12} />
                                                </div>
                                                {wo.reporterName.startsWith('คุณ') ? wo.reporterName : `คุณ${wo.reporterName}`}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            {/* Foreman */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', background: '#eef2ff', border: '1px solid #e0e7ff', flexShrink: 0 }}>
                                                    {foreman?.profileImage ? (
                                                        <img loading="lazy" src={foreman.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}><User2 size={12} /></div>
                                                    )}
                                                </div>
                                                {foreman ? (foreman.name.startsWith('คุณ') ? foreman.name : `คุณ${foreman.name}`) : 'ไม่ได้ระบุ'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: percentage === 100 ? '#10b981' : '#64748b' }}>
                                                    {completedCount}/{totalCount}
                                                </span>
                                                <div style={{ width: '60px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${percentage}%`, height: '100%', background: percentage === 100 ? '#10b981' : '#6366f1' }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                                            {wo.status === 'Rejected' ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444', background: '#fef2f2', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #fee2e2' }}>
                                                    <XCircle size={14} /> ยกเลิก
                                                </div>
                                            ) : (wo.status?.toLowerCase() === 'completed' || percentage === 100) ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', background: '#ecfdf5', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #d1fae5' }}>
                                                    <CheckCircle size={14} /> สำเร็จ
                                                </div>
                                            ) : completedCount > 0 ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6366f1', background: '#eff6ff', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #dbeafe' }}>
                                                    <Clock size={14} /> เสร็จบางส่วน
                                                </div>
                                            ) : (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f59e0b', background: '#fffbeb', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #fef3c7' }}>
                                                    <Clock size={14} /> กำลังดำเนินการ
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right', color: '#cbd5e1' }}>
                                            <ChevronRight size={20} />
                                        </td>
                                    </tr>
                                )
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
                    onClose={() => setSelectedWO(null)}
                    projects={projects}
                    staff={staff}
                    contractors={contractors}
                    currentUserId={user?.id}
                />
            )}
        </div>
    );
};

export default History;
