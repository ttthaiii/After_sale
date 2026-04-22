import React, { useState } from 'react';
import {
    Activity,
    CheckCircle2,
    Clock,
    AlertTriangle,
    TrendingUp,
    BarChart3,
    Users,
    Zap,
    X,
    ChevronDown,
    AlertCircle
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
    PieChart,
    Pie,
    ComposedChart,
    Area,
    Line,
} from 'recharts';
import ForemanCalendar from '../components/ForemanCalendar';

// --- Sub-components ---

export const StatCard = ({ title, value, icon, color, subtext, gradient, onClick, trend, style }: any) => (
    <div
        onClick={onClick}
        style={{
            background: gradient || '#ffffff',
            padding: '1.5rem',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: gradient ? 'none' : '1px solid #e2e8f0',
            boxShadow: gradient ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minHeight: '160px',
            position: 'relative',
            overflow: 'hidden',
            ...style,
        }}
        onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px)';
            if (onClick) e.currentTarget.style.cursor = 'pointer';
        }}
        onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
        <div style={{ position: 'absolute', right: '-10%', top: '-10%', opacity: 0.1, color: gradient ? '#fff' : color }}>
            {React.cloneElement(icon, { size: 120 })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div style={{ background: gradient ? 'rgba(255,255,255,0.2)' : (color || '#64748b') + '15', padding: '12px', borderRadius: '14px', color: gradient ? '#fff' : color || '#64748b', display: 'flex' }}>
                {icon}
            </div>
            {trend && (
                <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', borderRadius: '20px', background: trend > 0 ? '#dcfce7' : '#fee2e2', color: trend > 0 ? '#166534' : '#991b1b' }}>
                    {trend > 0 ? '+' : ''}{trend}%
                </div>
            )}
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: gradient ? 'rgba(255,255,255,0.8)' : '#64748b', fontWeight: 600, marginBottom: '4px' }}>{title}</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: gradient ? '#fff' : '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
            {subtext && <div style={{ fontSize: '0.75rem', color: gradient ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginTop: '8px', fontWeight: 500 }}>{subtext}</div>}
        </div>
    </div>
);

export const SectionHeader = ({ title, icon, subtitle, actions }: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon && <div style={{ color: '#4f46e5' }}>{icon}</div>}
            <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>{title}</h3>
                {subtitle && <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>{subtitle}</p>}
            </div>
        </div>
        {actions && <div>{actions}</div>}
    </div>
);

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

const TaskItemCard = ({ task, isSingleTask = false }: any) => {
    const [isLaborExpanded, setIsLaborExpanded] = useState(false);
    return (
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div
                onClick={() => setIsLaborExpanded(!isLaborExpanded)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isLaborExpanded ? '1.25rem' : '0', cursor: 'pointer' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#ecfdf5', color: '#10b981', padding: '8px', borderRadius: '10px' }}>
                        <Zap size={18} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {task.taskName}
                            <ChevronDown size={14} style={{ transform: isLaborExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', color: '#94a3b8' }} />
                        </div>
                        {task.note && <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>📝 {task.note}</div>}
                    </div>
                </div>
                {!isSingleTask && (
                    <div style={{ textAlign: 'right' }}>
                        <ProgressDeltaBar prev={task.prevProgress} delta={task.delta} isTask={true} />
                    </div>
                )}
            </div>
            {isLaborExpanded && task.labor && task.labor.length > 0 && (() => {
                const internals = task.labor.filter((l: any) => l.membership === 'Internal');
                const outsources = task.labor.filter((l: any) => l.membership !== 'Internal');
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
                                        {data.map((lab: any, iIdx: number) => (
                                            <tr
                                                key={iIdx}
                                                style={{ borderBottom: iIdx === data.length - 1 ? 'none' : '1px solid #f1f5f9', transition: 'background 0.2s' }}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                            >
                                                <td style={{ padding: '12px 16px', fontWeight: 800, color: '#1e293b' }}>
                                                    {lab.staffName || lab.affiliation}{' '}
                                                    {lab.amount > 1 && <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '6px' }}>({lab.amount} คน)</span>}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: lab.shifts?.normal ? '#10b981' : '#e2e8f0', margin: '0 auto', border: lab.shifts?.normal ? '2px solid #bbf7d0' : 'none' }} />
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: lab.shifts?.otMorning ? '#0ea5e9' : '#e2e8f0', margin: '0 auto', border: lab.shifts?.otMorning ? '2px solid #bae6fd' : 'none' }} />
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: lab.shifts?.otNoon ? '#f59e0b' : '#e2e8f0', margin: '0 auto', border: lab.shifts?.otNoon ? '2px solid #fef3c7' : 'none' }} />
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: lab.shifts?.otEvening ? '#ea580c' : '#e2e8f0', margin: '0 auto', border: lab.shifts?.otEvening ? '2px solid #fed7aa' : 'none' }} />
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                                                    {lab.totalHours} <span style={{ fontSize: '0.7rem', color: '#64748b' }}>ชม.</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                return (
                    <div style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', marginTop: '8px', animation: 'fadeIn 0.3s' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={16} /> รายละเอียดการลงแรงงาน (Labor Breakdown)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {renderLaborTable('DC ใน (พนักงาน)', internals, true)}
                            {renderLaborTable('DC นอก (ผู้รับเหมา/ซับ)', outsources, false)}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export const WOGroupCard = ({ group }: any) => (
    <div style={{ background: '#f8fafc', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
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
                <TaskItemCard key={tIdx} task={task} isSingleTask={group.totalTasks === 1} />
            ))}
        </div>
    </div>
);

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

// --- Main OverviewContent Component ---

const OverviewContent = ({
    stats,
    viewMode,
    isForeman,
    user,
    isAdminOrManager,
    selectedMonth,
    selectedWeek,
    selectedForemanId,
    selectedSCurveProject,
    highlightedWOId,
    workOrders,
    navigate,
    selectedOpCategory,
    setSelectedOpCategory,
    getProjectName,
    setHoveredBarKey,
    WorkloadTooltip,
    timelineData,
    activeProgressIndex,
    setActiveProgressIndex,
    sCurveData,
    handleLaborDetailClick,
    categoryData,
    filteredData,
    setSelectedTaskHistory,
    highlightedSection,
    selectableProjects,
    getSLATimeStatus,
    isWorkOrderCompleted
}: any) => {
    return (
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
                                        const items = workOrders.filter((wo: any) => wo.status === 'Evaluating');
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
                                        const items = workOrders.filter((wo: any) => !isWorkOrderCompleted(wo) && ['In Progress', 'Approved', 'Partially Approved', 'Pending', 'Rejected'].includes(wo.status));
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

                    {/* Charts Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                        <div style={{ background: '#fff', padding: '2rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                            <SectionHeader
                                title="สถิติการเปิด-ปิดใบงาน (Work Order Stats)"
                                icon={<TrendingUp size={22} />}
                                subtitle={`สรุปจำนวนการเปิดงานใหม่และปิดงานสำเร็จราย${selectedWeek === 0 ? 'เดือน' : `สัปดาห์ที่ ${selectedWeek}`}`}
                                actions={
                                    <div style={{ padding: '6px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 800 }}>
                                        <span style={{ color: '#f59e0b' }}>เปิด {timelineData.reduce((acc: any, d: any) => acc + d.openedCount, 0)}</span>
                                        <span style={{ color: '#94a3b8', margin: '0 8px' }}>|</span>
                                        <span style={{ color: '#8b5cf6' }}>ปิด {timelineData.reduce((acc: any, d: any) => acc + d.closedCount, 0)}</span>
                                    </div>
                                }
                            />
                            <div style={{ height: '320px', width: '100%' }}>
                                <ResponsiveContainer>
                                    <BarChart
                                        data={timelineData}
                                        onMouseMove={(state) => { if (state && state.activeLabel !== undefined) setActiveProgressIndex(state.activeLabel); else setActiveProgressIndex(null); }}
                                        onMouseLeave={() => setActiveProgressIndex(null)}
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
                                            {timelineData.map((item: any, index: any) => <Cell key={`cell-opened-${index}`} fillOpacity={highlightedWOId ? (item.isHighlighted ? 1 : 0.25) : (activeProgressIndex === null || activeProgressIndex === item.day ? 1 : 0.3)} stroke={highlightedWOId && item.isHighlighted ? '#b45309' : 'none'} strokeWidth={2} />)}
                                        </Bar>
                                        <Bar dataKey="closedCount" name="ปิดงานสำเร็จ" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20}>
                                            {timelineData.map((item: any, index: any) => <Cell key={`cell-closed-${index}`} fillOpacity={highlightedWOId ? (item.isHighlighted ? 1 : 0.25) : (activeProgressIndex === null || activeProgressIndex === item.day ? 1 : 0.3)} stroke={highlightedWOId && item.isHighlighted ? '#5b21b6' : 'none'} strokeWidth={2} />)}
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
                                    <PieChart>
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

                    {/* Bottom Grid */}
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
                            <SectionHeader title="ผลงานแยกตามโครงการ (Project Performance Summary)" icon={<Activity size={20} />} subtitle="สรุปข้อมูลการดำเนินงานและความรวดเร็วแยกโครงการ" />
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
                                        {stats.laborByProject.map((p: any) => (
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
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div id="job-details-section" className={highlightedSection === 'job-details-section' ? 'section-highlight' : ''} style={{ gridColumn: '1/-1', background: '#ffffff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', transition: 'all 0.5s', marginTop: '2rem' }}>
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
                                        const totalP = wo.categories?.reduce((acc: number, c: any) => acc + (c.tasks?.reduce((tAcc: number, t: any) => tAcc + (t.dailyProgress || 0), 0) || 0), 0) || 0;
                                        const tCount = wo.categories?.reduce((acc: number, c: any) => acc + (c.tasks?.length || 0), 0) || 1;
                                        const p = Math.round(totalP / tCount);
                                        return (
                                            <tr key={wo.id} style={{ background: '#f8fafc', borderRadius: '12px' }}>
                                                <td style={{ padding: '1rem', fontWeight: 800, color: '#0f172a', borderRadius: '12px 0 0 12px' }}>{wo.id}</td>
                                                <td>
                                                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>{getProjectName(wo.projectId)}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{wo.locationName}</div>
                                                </td>
                                                <td style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>{wo.categories?.[0]?.name || '-'}</td>
                                                <td>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', color: '#166534', backgroundColor: '#dcfce7' }}>{wo.status}</span>
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
                                                        style={{ padding: '8px 16px', borderRadius: '10px', background: '#6366f1', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                                                    >
                                                        ดูประวัติ
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default OverviewContent;
