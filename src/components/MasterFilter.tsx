import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MasterFilterProps {
    selectedMonth: string;
    setSelectedMonth: (month: string) => void;
    selectedWeek: number;
    setSelectedWeek: (week: number) => void;
    style?: React.CSSProperties;
    minimal?: boolean;
    allowAllTime?: boolean;
    isAllTime?: boolean;
    setIsAllTime?: (val: boolean) => void;
    // T-337: year dimension — only used/shown when isAllTime (all-work mode).
    selectedYear?: number;
    setSelectedYear?: (year: number) => void;
}

const MasterFilter: React.FC<MasterFilterProps> = ({ 
    selectedMonth, 
    setSelectedMonth, 
    selectedWeek, 
    setSelectedWeek,
    style,
    minimal = false,
    allowAllTime = false,
    isAllTime = false,
    setIsAllTime,
    selectedYear = new Date().getFullYear(),
    setSelectedYear
}) => {
    const nowYear = new Date().getFullYear();
    const handleMonthChange = (delta: number) => {
        let year, month;
        if (selectedMonth === 'all') {
            const d = new Date();
            year = d.getFullYear();
            month = d.getMonth() + 1;
        } else {
            [year, month] = selectedMonth.split('-').map(Number);
        }
        const d = new Date(year, month - 1 + delta, 1);
        setSelectedMonth(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
        if (setIsAllTime && isAllTime) setIsAllTime(false);
    };

    const [year, month] = selectedMonth !== 'all' ? selectedMonth.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks = [0, 1, 2, 3, 4];
    if (daysInMonth > 28) weeks.push(5);

    const monthName = `${new Date(year, month - 1, 1).toLocaleDateString('th-TH', { month: 'long' })} ${year}`;

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px', 
            background: minimal ? 'transparent' : '#ffffff', 
            padding: minimal ? '0' : '24px', 
            borderRadius: minimal ? '0' : '32px', 
            border: minimal ? 'none' : '1px solid #e2e8f0', 
            boxShadow: minimal ? 'none' : '0 4px 20px -4px rgba(0, 0, 0, 0.05)', 
            flex: 1,
            height: '124px',
            justifyContent: 'center',
            alignItems: 'stretch',
            ...style
        }}>
            {/* Month/Year Selector */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
            }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px', 
                    background: '#f8fafc', 
                    padding: '10px 20px', 
                    borderRadius: '20px', 
                    border: '1px solid #f1f5f9', 
                    justifyContent: 'space-between',
                    flex: 1
                }}>
                    <button
                        onClick={() => isAllTime ? setSelectedYear && setSelectedYear(selectedYear - 1) : handleMonthChange(-1)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                    >
                        <ChevronLeft size={20} strokeWidth={3} />
                    </button>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.01em', textAlign: 'center' }}>
                        {/* T-337: all-work mode shows a YEAR selector; month mode shows the month. */}
                        {isAllTime ? `ทั้งปี ${selectedYear}` : monthName}
                    </div>
                    <button
                        onClick={() => isAllTime ? setSelectedYear && setSelectedYear(Math.min(nowYear, selectedYear + 1)) : handleMonthChange(1)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isAllTime && selectedYear >= nowYear ? '#e2e8f0' : '#94a3b8', display: 'flex', alignItems: 'center' }}
                    >
                        <ChevronRight size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* T-337: month vs year mode is a 2-tab segmented control (clearer than a single toggle). */}
                {allowAllTime && setIsAllTime && (
                    <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', borderRadius: '18px', padding: '4px', height: '100%', minHeight: '44px' }}>
                        {([['รายเดือน', false], ['รายปี', true]] as [string, boolean][]).map(([label, val]) => {
                            const active = isAllTime === val;
                            return (
                                <button
                                    key={label}
                                    onClick={() => setIsAllTime(val)}
                                    style={{
                                        background: active ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'transparent',
                                        color: active ? '#fff' : '#64748b',
                                        border: 'none',
                                        padding: '8px 18px',
                                        borderRadius: '14px',
                                        fontWeight: 800,
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.25s ease',
                                        boxShadow: active ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Week Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', opacity: isAllTime ? 0.5 : 1, pointerEvents: isAllTime ? 'none' : 'auto', transition: 'all 0.3s ease' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8' }}>สัปดาห์</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {weeks.map((w) => (
                        <button
                            key={w}
                            onClick={() => setSelectedWeek(w)}
                            style={{
                                height: '38px',
                                minWidth: w === 0 ? '76px' : '38px',
                                borderRadius: '14px',
                                background: selectedWeek === w ? '#4f46e5' : '#f8fafc',
                                color: selectedWeek === w ? '#fff' : '#64748b',
                                fontSize: '0.85rem',
                                fontWeight: 900,
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                border: selectedWeek === w ? '2px solid #4f46e5' : '1px solid #f1f5f9',
                                boxShadow: selectedWeek === w ? '0 4px 12px rgba(79, 70, 229, 0.2)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {w === 0 ? 'ทั้งหมด' : w}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MasterFilter;
