import { useState } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import WorkTypeSwitcher from '../components/WorkTypeSwitcher';
import ForemanReportModal from '../components/ForemanReportModal';
import TaskUpdateModal from '../components/TaskUpdateModal';
import { WorkOrderType, MasterTask } from '../types';
import { FolderOpen, MapPin, ChevronDown, ChevronRight, CheckCircle2, Clock, Plus, Activity, Phone } from 'lucide-react';

const WorkOrders = () => {
    const { workOrders } = useWorkOrders();
    const [viewType, setViewType] = useState<WorkOrderType>('AfterSale');
    const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState('');

    // State for Task Update Modal
    const [selectedTask, setSelectedTask] = useState<MasterTask | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
    const [selectedCategoryName, setSelectedCategoryName] = useState('');

    const filteredWOs = workOrders.filter(wo => wo.type === viewType);

    const toggleCat = (catId: string) => {
        setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
    };

    const handleTaskClick = (task: MasterTask, categoryId: string, workOrderId: string, categoryName: string) => {
        setSelectedTask(task);
        setSelectedCategoryId(categoryId);
        setSelectedWorkOrderId(workOrderId);
        setSelectedCategoryName(categoryName);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>รายการแจ้งซ่อม</h1>
                <div style={{ fontSize: '0.9rem', color: '#aaa' }}>
                    ประเภท: <span style={{ color: '#fff', fontWeight: 'bold' }}>{viewType === 'AfterSale' ? 'งานแจ้งซ่อมทั่วไป' : 'งานตรวจรับห้อง'}</span>
                </div>
            </div>

            <WorkTypeSwitcher currentType={viewType} onChange={setViewType} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {filteredWOs.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', background: '#242424', borderRadius: '12px', color: '#777' }}>
                        ไม่พบรายการแจ้งซ่อมในหมวดนี้
                    </div>
                )}

                {filteredWOs.map(wo => (
                    <div key={wo.id} style={{ border: '1px solid #333', borderRadius: '12px', overflow: 'hidden' }}>
                        {/* Header Location */}
                        <div style={{ background: '#2a2a2a', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #333' }}>
                            <div style={{ background: '#646cff20', padding: '0.75rem', borderRadius: '8px', color: '#646cff' }}>
                                <MapPin size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{wo.locationName}</h3>
                                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>ID: {wo.id} • แจ้งเมื่อ: {new Date(wo.createdAt).toLocaleDateString('th-TH')}</div>
                                {(wo.reporterName || wo.reporterPhone) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4CAF50', fontSize: '0.85rem', marginTop: '6px' }}>
                                        <Phone size={14} />
                                        {wo.reporterName} <span style={{ color: '#777' }}>|</span> {wo.reporterPhone}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Categories & Tasks */}
                        <div style={{ padding: '1rem' }}>
                            {wo.categories.map(cat => (
                                <div key={cat.id} style={{ marginBottom: '1rem' }}>
                                    <div
                                        onClick={() => toggleCat(cat.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            padding: '0.75rem',
                                            background: '#333',
                                            borderRadius: '8px',
                                            marginBottom: '0.5rem'
                                        }}
                                    >
                                        {expandedCats[cat.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>{cat.name}</span>
                                        <span style={{ marginLeft: 'auto', background: '#444', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                            {cat.tasks.length} รายการ
                                        </span>
                                    </div>

                                    {expandedCats[cat.id] && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem' }}>
                                            {cat.tasks.map(task => (
                                                <div
                                                    key={task.id}
                                                    onClick={() => handleTaskClick(task, cat.id, wo.id, cat.name)}
                                                    style={{
                                                        background: '#1a1a1a',
                                                        padding: '1rem',
                                                        borderRadius: '8px',
                                                        border: '1px solid #333',
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr auto',
                                                        gap: '1rem',
                                                        alignItems: 'center',
                                                        cursor: 'pointer',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = '#252525'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = '#1a1a1a'}
                                                >
                                                    <div>
                                                        <div style={{ marginBottom: '8px', fontSize: '1rem' }}>{task.name}</div>

                                                        {/* Dual Progress Display */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.85rem' }}>
                                                            {/* Master Status */}
                                                            <div style={{
                                                                color: task.status === 'Completed' ? '#4CAF50' : task.status === 'In Progress' ? '#FF9800' : '#888',
                                                                display: 'flex', alignItems: 'center', gap: '5px'
                                                            }}>
                                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: task.status === 'Completed' ? '#4CAF50' : task.status === 'In Progress' ? '#FF9800' : '#888' }}></span>
                                                                {task.status === 'Pending' && 'รอเริ่มงาน'}
                                                                {task.status === 'Assigned' && 'มอบหมายแล้ว'}
                                                                {task.status === 'In Progress' && 'กำลังดำเนินการ'}
                                                                {task.status === 'Completed' && 'เสร็จสมบูรณ์'}
                                                                {task.status === 'Verified' && 'ตรวจสอบแล้ว'}
                                                            </div>

                                                            {/* API Daily Progress */}
                                                            {task.dailyProgress > 0 && (
                                                                <div style={{ color: '#2196F3', display: 'flex', alignItems: 'center', gap: '5px', background: '#2196F315', padding: '2px 8px', borderRadius: '4px' }}>
                                                                    <Activity size={14} />
                                                                    หน้างานคืบหน้า: {task.dailyProgress}%
                                                                </div>
                                                            )}

                                                            {task.slaStartTime && <span style={{ color: '#ff4d4f', fontSize: '0.75rem', border: '1px solid #ff4d4f', padding: '0 4px', borderRadius: '4px' }}>SLA Active</span>}
                                                        </div>
                                                    </div>

                                                    <div style={{ color: '#aaa' }}>
                                                        <ChevronRight size={20} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating Action Button for Foreman */}
            <button
                onClick={() => {
                    setSelectedLocation('');
                    setIsReportModalOpen(true);
                }}
                style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    background: '#646cff',
                    color: 'white',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(100, 108, 255, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    zIndex: 100
                }}
            >
                <Plus size={32} />
            </button>

            <ForemanReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                locationName={selectedLocation}
            />

            <TaskUpdateModal
                isOpen={!!selectedTask}
                onClose={() => setSelectedTask(null)}
                task={selectedTask}
                categoryId={selectedCategoryId}
                workOrderId={selectedWorkOrderId}
                categoryName={selectedCategoryName}
            />
        </div>
    );
};

export default WorkOrders;
