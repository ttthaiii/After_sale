import { useState, useMemo } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import TrackingCard from '../components/TrackingCard';
import { Clock, Search, Building2, Calendar, LayoutDashboard, User2, Briefcase, Filter, ArrowUpRight } from 'lucide-react';
import { MOCK_PROJECTS, MOCK_STAFF } from '../data/mockData';

type Role = 'Foreman' | 'Director';

const SLAMonitor = () => {
    const { workOrders, updateWorkOrderStatus } = useWorkOrders();
    const [currentRole, setCurrentRole] = useState<Role>('Director'); // Default to Director for demo

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Current User Mock (For Foreman View)
    const CURRENT_FOREMAN_ID = 'S001'; // Foreman Wittaya

    // Filter Logic
    const filteredWorkOrders = useMemo(() => {
        return workOrders.filter(wo => {
            // 1. Role Logic
            if (currentRole === 'Foreman') {
                // Check if user is reporter OR assigned to any task
                const isReporter = wo.reporterName?.includes('Wittaya'); // Mock check
                const isAssigned = wo.categories.some(cat =>
                    cat.tasks.some(task => task.responsibleStaffIds?.includes(CURRENT_FOREMAN_ID))
                );

                if (!isReporter && !isAssigned) return false;
            }

            // 2. Status Logic (Hide Completed/Cancelled unless searching?)
            // Keeping all for now, but maybe hide Completed by default? 
            // Let's show all for tracking history.

            // 3. General Filters
            const matchesSearch = wo.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                wo.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesProject = selectedProjectId ? wo.projectId === selectedProjectId : true;

            const matchesStaff = selectedStaffId ? wo.categories.some(cat =>
                cat.tasks.some(task => task.responsibleStaffIds?.includes(selectedStaffId))
            ) : true;

            const woDate = new Date(wo.createdAt).toISOString().split('T')[0];
            const matchesStartDate = startDate ? woDate >= startDate : true;
            const matchesEndDate = endDate ? woDate <= endDate : true;

            return matchesSearch && matchesProject && matchesStaff && matchesStartDate && matchesEndDate;
        }).sort((a, b) => {
            // Sort by SLA Criticality (Oldest Report Date first)
            const dateA = new Date(a.reportDate || a.createdAt).getTime();
            const dateB = new Date(b.reportDate || b.createdAt).getTime();
            return dateA - dateB;
        });
    }, [workOrders, currentRole, searchTerm, selectedProjectId, selectedStaffId, startDate, endDate]);

    const handleCloseJob = (id: string) => {
        if (confirm('ยืนยันปิดงานซ่อม? (Confirm Close Case)')) {
            updateWorkOrderStatus(id, 'Completed');
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedProjectId('');
        setSelectedStaffId('');
        setStartDate('');
        setEndDate('');
    };

    const commonInputStyle = {
        width: '100%',
        padding: '10px 12px 10px 42px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        color: '#0f172a',
        fontSize: '0.9rem',
        outline: 'none',
        transition: 'all 0.2s',
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '4rem' }}>

            {/* Header Section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Tracking & Monitoring</h1>
                    <div style={{ color: '#64748b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LayoutDashboard size={18} />
                        <span>ติดตามสถานะงานซ่อมและการประเมิน SLA</span>
                    </div>
                </div>

                {/* Role Switcher (Demo Only) */}
                <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '12px', display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => setCurrentRole('Foreman')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            background: currentRole === 'Foreman' ? '#ffffff' : 'transparent',
                            color: currentRole === 'Foreman' ? '#0f172a' : '#64748b',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: currentRole === 'Foreman' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Foreman View
                    </button>
                    <button
                        onClick={() => setCurrentRole('Director')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            background: currentRole === 'Director' ? '#ffffff' : 'transparent',
                            color: currentRole === 'Director' ? '#0f172a' : '#64748b',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: currentRole === 'Director' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Director View
                    </button>
                </div>
            </div>

            {/* Director Toolbar */}
            {currentRole === 'Director' && (
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#4f46e5', fontWeight: 700 }}>
                        <Filter size={20} /> Executive Filters
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text" placeholder="Search Unit/ID..."
                                style={commonInputStyle}
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Building2 size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <select
                                style={{ ...commonInputStyle, appearance: 'none' }}
                                value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
                            >
                                <option value="">All Projects</option>
                                {MOCK_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <User2 size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <select
                                style={{ ...commonInputStyle, appearance: 'none' }}
                                value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}
                            >
                                <option value="">All Staff</option>
                                {MOCK_STAFF.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="date"
                                style={commonInputStyle}
                                value={startDate} onChange={e => setStartDate(e.target.value)}
                            />
                        </div>

                        <button onClick={clearFilters} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 20px', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                            Reset
                        </button>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, color: '#334155' }}>
                        Showing {filteredWorkOrders.length} Tasks
                    </div>
                    {currentRole === 'Director' && (
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></div> Critical</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }}></div> Warning</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }}></div> Normal</div>
                        </div>
                    )}
                </div>

                {filteredWorkOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                        <div style={{ color: '#94a3b8', fontSize: '1.2rem', fontWeight: 600 }}>No work orders found</div>
                    </div>
                ) : (
                    filteredWorkOrders.map(wo => (
                        <TrackingCard
                            key={wo.id}
                            wo={wo}
                            role={currentRole}
                            onCloseJob={handleCloseJob}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default SLAMonitor;
