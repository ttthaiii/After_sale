import React from 'react';
import {
    BarChart3,
    Zap,
    TrendingUp,
    Activity,
    X,
    Users
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    Legend
} from 'recharts';
import { StatCard, SectionHeader } from '../components/DashboardShared';
import { DashboardStats } from '../types/dashboard';

interface DashboardComparisonProps {
    stats: DashboardStats;
    getProjectName: (id: string) => string;
    selectedCategory: string | null;
    setSelectedCategory: (category: string | null) => void;
}

const DashboardComparison: React.FC<DashboardComparisonProps> = ({
    stats,
    getProjectName,
    selectedCategory,
    setSelectedCategory
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Stat Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                <StatCard
                    title="จำนวนหมวดงานที่พบ"
                    value={stats.categoryStats.length}
                    icon={<BarChart3 size={24} />}
                    color="#4f46e5"
                    subtext="แยกประเภทตาม Dashboard จริง"
                />
                <StatCard
                    title="ต้นทุนแรงงานรวม"
                    value={`${(stats.categoryStats.reduce((acc: number, c: any) => acc + (c.cost || 0), 0) / 1000).toFixed(1)}k`}
                    icon={<Zap size={24} />}
                    color="#f59e0b"
                    subtext="คำนวณจาก Rate 550/850 THB"
                />
                <StatCard
                    title="ประสิทธิภาพ SLA เฉลี่ย"
                    value={`${stats.slaScore}%`}
                    icon={<TrendingUp size={24} />}
                    color="#10b981"
                    subtext="ภาพรวมความเร็วในการปิดงาน"
                />
                <StatCard
                    title="ไซต์งานที่มีการเคลื่อนไหว"
                    value={stats.projectStats.length}
                    icon={<Activity size={24} />}
                    color="#3b82f6"
                    subtext="ไซต์ที่มี Daily Report เดือนนี้"
                />
            </div>

            {/* Project Status Breakdown Row */}
            <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <SectionHeader
                    title="วิเคราะห์โครงการแยกตามสถานะงาน (Project Status Breakdown)"
                    icon={<Activity size={22} />}
                    subtitle="เปรียบเทียบสัดส่วนงานที่เสร็จสิ้น งานที่กำลังทำ และงานที่ล่าช้าแยกตามโครงการ"
                />
                <div style={{ height: '450px', width: '100%', marginTop: '1.5rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={stats.laborByProject}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 900 }}
                                width={130}
                            />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                            <Bar dataKey="completed" name="งานที่เสร็จสิ้น (Completed)" stackId="status" fill="#10b981" radius={[0, 0, 0, 0]} barSize={24} />
                            <Bar dataKey="inProgress" name="กำลังดำเนินการ (In Progress)" stackId="status" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={24} />
                            <Bar dataKey="evaluating" name="รอประเมิน (Evaluating)" stackId="status" fill="#eab308" radius={[0, 0, 0, 0]} barSize={24} />
                            <Bar dataKey="stalled" name="ล่าช้า (Stalled/High Risk)" stackId="status" fill="#ef4444" radius={[0, 8, 8, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Main Content Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                {/* Pie Chart Section */}
                <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <SectionHeader
                        title="สัดส่วนการแจ้งซ่อมแยกตามหมวดงาน"
                        icon={<BarChart3 size={22} />}
                        subtitle="เปรียบเทียบปริมาณงานในแต่ละประเภทเพื่อวางแผนกำลังคน"
                        actions={selectedCategory && (
                            <button
                                onClick={() => setSelectedCategory(null)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    background: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    color: '#475569',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <X size={14} /> ล้างหน้าหลัก: {selectedCategory}
                            </button>
                        )}
                    />
                    <div style={{ height: '400px', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        {stats.categoryStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={stats.categoryStats}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
                                    onClick={(data: any) => {
                                        if (data && data.activePayload && data.activePayload.length > 0) {
                                            const entry = data.activePayload[0].payload;
                                            setSelectedCategory(entry.name === selectedCategory ? null : entry.name);
                                        }
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                                        width={130}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        content={({ active, payload }: any) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                                                        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>{data.name}</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem' }}>
                                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>จำนวนงาน:</span>
                                                                <span style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 800 }}>{data.count} งาน</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem' }}>
                                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>ต้นทุนสะสม:</span>
                                                                <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 800 }}>฿{data.cost.toLocaleString()}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem' }}>
                                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>ชั่วโมงงาน:</span>
                                                                <span style={{ fontSize: '0.8rem', color: '#4f46e5', fontWeight: 800 }}>{data.hours.toFixed(1)} ชม.</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar
                                        dataKey="count"
                                        radius={[0, 8, 8, 0]}
                                        barSize={20}
                                        cursor="pointer"
                                    >
                                        {stats.categoryStats.map((entry: any, index: number) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.color}
                                                fillOpacity={selectedCategory ? (selectedCategory === entry.name ? 1 : 0.3) : 1}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                                <BarChart3 size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>ไม่พบข้อมูลหมวดงานในเดือนนี้</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>กรุณาลองเปลี่ยนเดือนที่เลือกด้านบน</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Leaderboard Section */}
                <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <SectionHeader
                        title="อันดับพนักงานผู้รับผิดชอบ (Foreman Leaderboard)"
                        icon={<Users size={22} />}
                        subtitle="เปรียบเทียบ SLA และปริมาณงานที่ปิดจบสำเร็จรายบุคคล"
                    />
                    <div style={{ height: '400px', overflowY: 'auto', marginTop: '1rem', paddingRight: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {stats.foremanStats.map((f: any, idx: number) => (
                                <div key={f.id} style={{
                                    padding: '1.25rem',
                                    background: idx === 0 ? '#f0f9ff' : '#f8fafc',
                                    borderRadius: '20px',
                                    border: idx === 0 ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.2s'
                                }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '12px',
                                            background: idx === 0 ? '#0ea5e9' : '#e2e8f0',
                                            color: idx === 0 ? '#fff' : '#64748b',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 900,
                                            fontSize: '1rem'
                                        }}>
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1e293b' }}>{f.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ปิดงาน {f.totalJobs} รายการ • เฉลี่ย {f.avgResolution} ชม./งาน</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: f.slaScore > 80 ? '#10b981' : '#f59e0b' }}>{f.slaScore}%</div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800 }}>SLA SUCCESS</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Cost vs Volume Row */}
            <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <SectionHeader
                    title="วิเคราะห์ต้นทุนเทียบปริมาณงาน (Cost vs Volume)"
                    icon={<TrendingUp size={22} />}
                    subtitle="หมวดงานที่ใช้ชั่วโมงทำงานมากที่สุดอาจไม่ใช่หมวดงานที่ต้นทุนสูงสุดเสมอไป"
                />
                <div style={{ height: '350px', width: '100%', marginTop: '1.5rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={stats.categoryStats}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                            <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#f59e0b', fontSize: 10 }} />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                            <Bar yAxisId="left" dataKey="count" name="จำนวนงาน (ใบ)" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={24} />
                            <Bar yAxisId="right" dataKey="cost" name="ต้นทุนสะสม (บาท)" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Project Grid Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {stats.projectStats.slice(0, 6).map((project: any) => {
                    const topCat = stats.categoryStats
                        .filter((c: any) => c.projects && c.projects[project.id])
                        .sort((a: any, b: any) => b.projects[project.id] - a.projects[project.id])[0];

                    return (
                        <div key={project.id} style={{
                            background: '#fff',
                            padding: '1.75rem',
                            borderRadius: '32px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05, color: '#4f46e5' }}>
                                <BarChart3 size={100} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                <div style={{ fontWeight: 900, color: '#1e293b', fontSize: '1.1rem', maxWidth: '70%', lineHeight: 1.2 }}>{getProjectName(project.id)}</div>
                                <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900 }}>
                                    SLA {Math.round((project.slaMet / (project.taskCount || 1)) * 100)}%
                                </div>
                            </div>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>หมวดงานที่มีปัญหาหลัก:</div>
                                {topCat ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: topCat.color }}></div>
                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{topCat.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>({topCat.projects[project.id]} งาน)</div>
                                    </div>
                                ) : <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>ไม่มีข้อมูลหมวดงาน</div>}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                                <div>
                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800 }}>ชั่วโมงงาน</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>{project.actualManHours ? project.actualManHours.toFixed(0) : 0}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800 }}>งานที่ปิด</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>{project.completed}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800 }}>งานรอ</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b' }}>{project.evaluating}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={{ textAlign: 'right', padding: '1rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>* ข้อมูลในหน้านี้อ้างอิงจาก Dashboard และ Daily Report ที่กรอกจริงโดยพนักงาน</div>
        </div>
    );
};

export default DashboardComparison;
