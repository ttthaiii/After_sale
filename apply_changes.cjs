const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'DailyReport.tsx');
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Add Icons
content = content.replace(
    "Eye } from 'lucide-react';",
    "Eye, Menu, Lock, Calendar as CalendarIcon } from 'lucide-react';"
);

// 2. Add State variables
content = content.replace(
    "const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);\n\n    // ✅ Real-time Sync Data",
    `const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
    
    const [activePhotoTab, setActivePhotoTab] = useState<'site' | 'regular' | 'otMorning' | 'otNoon' | 'otEvening'>('site');

    const isEditingPast3Days = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const selected = new Date(reportDate);
        selected.setHours(0,0,0,0);
        const diffTime = today.getTime() - selected.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const hasHistory = selectedTaskInfo?.task.history?.some((h: any) => h.date.startsWith(reportDate));
        return diffDays > 3 && hasHistory;
    }, [reportDate, selectedTaskInfo]);

    const availablePhotoTabs = useMemo(() => {
        const tabs = [
            { id: 'site', title: 'รูปถ่ายหน้างาน', icon: <Camera size={16} />, color: '#3b82f6', list: photos, setList: setPhotos, category: 'site' }
        ];
        
        const hasRegular = labor.some(l => l.shifts?.normal);
        const hasOtMorning = labor.some(l => l.shifts?.otMorning);
        const hasOtNoon = labor.some(l => l.shifts?.otNoon);
        const hasOtEvening = labor.some(l => l.shifts?.otEvening);

        if (hasRegular) tabs.push({ id: 'regular', title: 'รูปเวลาทำงานปกติ', icon: <User size={16} />, color: '#10b981', list: laborRegularPhotos, setList: setLaborRegularPhotos, category: 'laborRegular' });
        if (hasOtMorning) tabs.push({ id: 'otMorning', title: 'รูป OT เช้า', icon: <Clock size={16} />, color: '#f59e0b', list: laborOtMorningPhotos, setList: setLaborOtMorningPhotos, category: 'laborOtMorning' });
        if (hasOtNoon) tabs.push({ id: 'otNoon', title: 'รูป OT เที่ยง', icon: <Clock size={16} />, color: '#f59e0b', list: laborOtNoonPhotos, setList: setLaborOtNoonPhotos, category: 'laborOtNoon' });
        if (hasOtEvening) tabs.push({ id: 'otEvening', title: 'รูป OT เย็น', icon: <Clock size={16} />, color: '#f59e0b', list: laborOtEveningPhotos, setList: setLaborOtEveningPhotos, category: 'laborOtEvening' });

        return tabs;
    }, [photos, laborRegularPhotos, laborOtMorningPhotos, laborOtNoonPhotos, laborOtEveningPhotos, labor]);

    // ✅ Real-time Sync Data`
);

// 3. Update handleDateChange
content = content.replace(
    /const handleDateChange = \(e: React\.ChangeEvent<HTMLInputElement>\) => {[\s\S]*?setReportDate\(newDate\);\n    };/,
    `const handleDateChange = (e: any) => {
        const newDate = e.target.value;
        if (!selectedTaskInfo) return;

        const woDate = selectedTaskInfo.wo.startDate || selectedTaskInfo.wo.createdAt?.split('T')[0];
        if (woDate && newDate < woDate) {
            alert(\`ไม่อนุญาตให้ลงรายงานก่อนวันที่เปิดใบงาน (\${new Date(woDate).toLocaleDateString('th-TH')})\`);
            return;
        }

        const today = new Date();
        today.setHours(0,0,0,0);
        const selected = new Date(newDate);
        selected.setHours(0,0,0,0);
        const diffTime = Math.abs(today.getTime() - selected.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const hasHistory = selectedTaskInfo.task.history?.some((h: any) => h.date.startsWith(newDate));

        if (selected < today && diffDays > 3) {
            if (!hasHistory) {
                const unlockedData = selectedTaskInfo.task.unlockedDates?.[newDate];
                const isUnlocked = unlockedData && new Date(unlockedData.unlockedUntil) >= today;
                
                if (!isUnlocked) {
                   setPendingUnlockDate(newDate);
                   setShowUnlockModal(true);
                   return;
                }
            }
        }
        setReportDate(newDate);
    };`
);

// 4. Update renderTaskCard onClick
content = content.replace(
    /onClick=\{\(\) => handleSelectTask\(task, wo, categoryId\)\}/g,
    `onClick={() => { handleSelectTask(task, wo, categoryId); setIsSidebarOpen(false); }}`
);

// 5. Add StatusCalendarPopup
content = content.replace(
    "return (",
    `const StatusCalendarPopup = () => {
        const [calMonth, setCalMonth] = useState(new Date(reportDate));
        const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
        const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay();
        const todayStr = new Date().toISOString().split('T')[0];

        const prevMonth = (e: React.MouseEvent) => { e.stopPropagation(); setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)); };
        const nextMonth = (e: React.MouseEvent) => { e.stopPropagation(); setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)); };

        return (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '16px', zIndex: 100, width: '280px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <button onClick={prevMonth} style={{ background: '#f1f5f9', borderRadius: '8px', border: 'none', cursor: 'pointer', padding: '6px 10px', fontWeight: 900 }}>&lt;</button>
                    <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0f172a' }}>{calMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</div>
                    <button onClick={nextMonth} style={{ background: '#f1f5f9', borderRadius: '8px', border: 'none', cursor: 'pointer', padding: '6px 10px', fontWeight: 900 }}>&gt;</button>
                </div>
                {/* Days of week */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>
                    {['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => <div key={d}>{d}</div>)}
                </div>
                {/* Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {Array.from({ length: firstDay }).map((_, i) => <div key={\`empty-\${i}\`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const d = i + 1;
                        const dateStr = \`\${calMonth.getFullYear()}-\${String(calMonth.getMonth() + 1).padStart(2, '0')}-\${String(d).padStart(2, '0')}\`;
                        const isFuture = dateStr > todayStr;
                        const hasHistory = selectedTaskInfo?.task.history?.some((h: any) => h.date.startsWith(dateStr));
                        
                        let statusColor = 'transparent';
                        if (!isFuture) {
                            if (hasHistory) {
                                statusColor = '#22c55e'; // Green
                            } else {
                                const daysDiff = Math.floor((new Date(todayStr).getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
                                if (daysDiff <= 3) statusColor = '#facc15'; // Yellow
                                else statusColor = '#ef4444'; // Red
                            }
                        }

                        const isSelected = dateStr === reportDate;

                        return (
                            <div 
                                key={d} 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isFuture) {
                                        setReportDate(dateStr);
                                        const event = { target: { value: dateStr } };
                                        handleDateChange(event as any);
                                        setShowCalendarDropdown(false);
                                    }
                                }}
                                style={{ 
                                    aspectRatio: '1', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    cursor: isFuture ? 'default' : 'pointer',
                                    opacity: isFuture ? 0.3 : 1,
                                    background: isSelected ? '#eff6ff' : 'transparent',
                                    border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                                    borderRadius: '8px'
                                }}
                            >
                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isSelected ? '#1e40af' : '#334155' }}>{d}</div>
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: statusColor, marginTop: '2px' }} />
                            </div>
                        );
                    })}
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}/>มีข้อมูล</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#facc15' }}/>ยังไม่ได้ลง</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}/>ไม่มีข้อมูล</div>
                </div>
            </div>
        );
    };

    return (`
);

// 6. Update main layout wrapping and date input
content = content.replace(
    "<div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 1fr) 2fr', gap: '2rem', height: 'calc(100vh - 120px)' }}>",
    "<div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 120px)' }}>"
);

content = content.replace(
    /\{activeModal && <BatchAddModal [\s\S]*? \/>\}/,
    `$&
            {showUnlockModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', padding: '2rem', borderRadius: '24px', width: '400px', maxWidth: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                            <Lock size={32} />
                        </div>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>วันที่ถูกล็อค</h3>
                        <p style={{ margin: '0 0 2rem 0', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                            ระบบไม่อนุญาตให้ลงรายงานย้อนหลังเกิน 3 วัน<br/>
                            (<span style={{ fontWeight: 700, color: '#ef4444' }}>{pendingUnlockDate}</span>)<br/>
                            คุณต้องการส่งคำร้องให้แอดมินปลดล็อควันที่นี้หรือไม่?
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => { setShowUnlockModal(false); setPendingUnlockDate(null); }} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>ยกเลิก</button>
                            <button onClick={submitUnlockRequest} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)' }}>ส่งคำร้อง</button>
                        </div>
                    </div>
                </div>
            )}`
);

content = content.replace(
    "<div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>",
    "{isSidebarOpen && (\n                <div style={{ width: '380px', flexShrink: 0, background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>"
);

content = content.replace(
    /<\/div>\n            <div style=\{\{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' \}\}>/,
    `            </div>\n            )}\n\n            <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>`
);

content = content.replace(
    /<LayoutDashboard size=\{64\} style=\{\{ opacity: 0\.1, marginBottom: '1\.5rem' \}\} \/>/g,
    `<button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ position: 'absolute', top: '16px', left: '16px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', color: '#64748b', zIndex: 10 }}>\n                            <Menu size={24} />\n                        </button>\n                        <LayoutDashboard size={64} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />`
);

content = content.replace(
    /<div style=\{\{ padding: '1rem 1\.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' \}\}>\n                            <div style=\{\{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', minHeight: '130px' \}\}>/,
    `<div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>\n                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', color: '#64748b', marginTop: '4px', flexShrink: 0 }}>\n                                <Menu size={24} />\n                            </button>\n                            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', minHeight: '130px', flex: 1 }}>`
);

content = content.replace(
    /<input \n[\s\S]*?type="date"[\s\S]*?onChange=\{handleDateChange\}[\s\S]*?\/>/,
    `<div \n                                                    onClick={() => setShowCalendarDropdown(!showCalendarDropdown)}\n                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#fff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}\n                                                >\n                                                    <CalendarIcon size={14} color="#3b82f6" />\n                                                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#1e40af' }}>{new Date(reportDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>\n                                                </div>\n                                                {showCalendarDropdown && <StatusCalendarPopup />}`
);

// 7. Update isEditingPast3Days conditionals for Progress
content = content.replace(
    /<h3 style=\{\{ fontSize: '1\.1rem', fontWeight: 900, color: '#0f172a', margin: 0 \}\}>ความคืบหน้างาน \(%\)<\/h3>/,
    `<h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>ความคืบหน้างาน (%) {isEditingPast3Days && <span style={{fontSize: '0.75rem', color: '#ef4444', fontWeight: 800}}>(ไม่สามารถแก้ไขย้อนหลังเกิน 3 วัน)</span>}</h3>`
);

content = content.replace(
    /disabled=\{\!isEditingExisting\}/g,
    `disabled={!isEditingExisting || isEditingPast3Days}`
);

content = content.replace(
    /cursor: isEditingExisting \? 'pointer' : 'not-allowed'/g,
    `cursor: isEditingExisting && !isEditingPast3Days ? 'pointer' : 'not-allowed'`
);

content = content.replace(
    /opacity: \!isEditingExisting && progress \!== val \? 0\.5 : 1 \}\}/g,
    `opacity: (!isEditingExisting || isEditingPast3Days) && progress !== val ? 0.5 : 1 }}`
);

// 8. Update Photo Tabs UI (replace the vertical list block entirely)
content = content.replace(
    /<div style=\{\{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' \}\}>\n                                    \{\/\* Column 1: Work Progress Photos \*\/\}[\s\S]*?<\/div>\n                            <\/div>\n                            <div style=\{\{ marginTop: '2\.5rem' \}\}>/,
    `<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
                                        {availablePhotoTabs.map((tab) => {
                                            const isActive = activePhotoTab === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActivePhotoTab(tab.id as any)}
                                                    style={{
                                                        padding: '10px 16px',
                                                        borderRadius: '12px',
                                                        border: isActive ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                                        background: isActive ? '#eff6ff' : '#fff',
                                                        color: isActive ? '#1e40af' : '#64748b',
                                                        fontWeight: 800,
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        whiteSpace: 'nowrap',
                                                        transition: 'all 0.2s',
                                                        boxShadow: isActive ? '0 4px 6px -1px rgba(59, 130, 246, 0.1)' : 'none'
                                                    }}
                                                >
                                                    <span style={{ color: isActive ? '#3b82f6' : '#94a3b8' }}>{tab.icon}</span>
                                                    {tab.title}
                                                    {tab.list.length > 0 && <CheckCircle2 size={14} color="#10b981" />}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {(() => {
                                        const activeTab = availablePhotoTabs.find(t => t.id === activePhotoTab) || availablePhotoTabs[0];
                                        return (
                                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {activeTab.icon} <span style={{ color: activeTab.color }}>{activeTab.title}</span> {isEditingPast3Days && <span style={{fontSize: '0.7rem', color: '#ef4444', fontWeight: 800}}>(ไม่สามารถแก้ไขรูปภาพย้อนหลังเกิน 3 วัน)</span>}
                                                </h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                                                    {isEditingExisting && !isEditingPast3Days && (
                                                        <label style={{ height: 100, border: \`2px dashed \${activeTab.color}\`, borderRadius: 16, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: activeTab.color, cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.6 : 1 }}>
                                                            {isUploading ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 900, marginTop: 4 }}>{isUploading ? 'กำลังโหลด' : 'ถ่ายรูป'}</span>
                                                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleGenericPhotoUpload(e, activeTab.category)} disabled={isUploading} />
                                                        </label>
                                                    )}
                                                    {activeTab.list.map((p: string, i: number) => (
                                                        <div key={i} style={{ position: 'relative', height: 100, borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                            <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            {isEditingExisting && !isEditingPast3Days && (
                                                                <button onClick={() => activeTab.setList(activeTab.list.filter((_: any, idx: number) => idx !== i))} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 4, padding: 2, cursor: 'pointer' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                {activeTab.list.length === 0 && <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', background: '#fee2e2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fca5a5' }}><AlertCircle size={14} /> ต้องมีรูปภาพอย่างน้อย 1 รูป</div>}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div style={{ marginTop: '2.5rem' }}>`
);

// 9. Update Notes
content = content.replace(
    /<h3 style=\{\{ fontSize: '1\.1rem', fontWeight: 900, color: '#0f172a', margin: 0 \}\}>หมายเหตุ \(Site Notes\)<\/h3>/,
    `<h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>หมายเหตุ (Site Notes) {isEditingPast3Days && <span style={{fontSize: '0.75rem', color: '#ef4444', fontWeight: 800}}>(ไม่สามารถแก้ไขย้อนหลังเกิน 3 วัน)</span>}</h3>`
);

content = content.replace(
    /onClick=\{\(\) => isEditingExisting && setReportType\(prev => prev === 'Problem' \? 'Update' : 'Problem'\)\}/,
    `onClick={() => isEditingExisting && !isEditingPast3Days && setReportType(prev => prev === 'Problem' ? 'Update' : 'Problem')}`
);

content = content.replace(
    /cursor: isEditingExisting \? 'pointer' : 'not-allowed',/g,
    `cursor: isEditingExisting && !isEditingPast3Days ? 'pointer' : 'not-allowed',`
);

content = content.replace(
    /opacity: isEditingExisting \? 1 : 0\.5,/g,
    `opacity: isEditingExisting && !isEditingPast3Days ? 1 : 0.5,`
);

content = content.replace(
    /background: \!isEditingExisting \? '#f8fafc' : reportType === 'Problem' \? '#fef2f2' : '#fff'/g,
    `background: !isEditingExisting || isEditingPast3Days ? '#f8fafc' : reportType === 'Problem' ? '#fef2f2' : '#fff'`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script completed.');
