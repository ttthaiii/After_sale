import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { chipScrollRow } from './ui/layout';

interface MasterFilterProps {
    selectedMonth: string;
    setSelectedMonth: (month: string) => void;
    selectedWeek: number;
    setSelectedWeek: (week: number) => void;
    style?: React.CSSProperties;
    minimal?: boolean;
    // flat: single horizontal-row toolbar mode (no card) for the /dashboard header bar.
    flat?: boolean;
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
    flat = false,
    allowAllTime = false,
    isAllTime = false,
    setIsAllTime,
    selectedYear = new Date().getFullYear(),
    setSelectedYear
}) => {
    const nowYear = new Date().getFullYear();
    const isMobile = useIsMobile();

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
            flexDirection: (flat && !isMobile) ? 'row' : 'column',
            flexWrap: flat ? 'wrap' : undefined,
            gap: flat ? '10px' : '12px',
            background: (minimal || flat) ? 'transparent' : '#ffffff',
            padding: (minimal || flat) ? '0' : (isMobile ? '16px' : '20px'),
            borderRadius: (minimal || flat) ? '0' : '18px',
            border: (minimal || flat) ? 'none' : '1px solid #e2e8f0',
            boxShadow: (minimal || flat) ? 'none' : '0 2px 10px -4px rgba(0, 0, 0, 0.06)',
            flex: 1,
            height: isMobile ? 'auto' : (flat ? 'auto' : '124px'),
            justifyContent: 'center',
            alignItems: (flat && !isMobile) ? 'center' : 'stretch',
            ...style
        }}>
            {/* Month/Year Selector */}
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                gap: flat ? '8px' : '12px',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: flat ? '10px' : '16px',
                    background: '#f8fafc',
                    padding: flat ? '7px 14px' : '10px 20px',
                    borderRadius: flat ? '12px' : '20px',
                    border: '1px solid #e2e8f0',
                    justifyContent: 'space-between',
                    flex: (flat && !isMobile) ? undefined : 1,
                    minWidth: flat ? '158px' : 0
                }}>
                    <button
                        onClick={() => isAllTime ? setSelectedYear && setSelectedYear(selectedYear - 1) : handleMonthChange(-1)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    >
                        <ChevronLeft size={flat ? 16 : 20} strokeWidth={3} />
                    </button>
                    <div style={{ fontSize: flat ? '0.9rem' : '1.1rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.01em', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                        {/* T-337: all-work mode shows a YEAR selector; month mode shows the month. */}
                        {isAllTime ? `ทั้งปี ${selectedYear}` : monthName}
                    </div>
                    <button
                        onClick={() => isAllTime ? setSelectedYear && setSelectedYear(Math.min(nowYear, selectedYear + 1)) : handleMonthChange(1)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isAllTime && selectedYear >= nowYear ? '#e2e8f0' : '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    >
                        <ChevronRight size={flat ? 16 : 20} strokeWidth={3} />
                    </button>
                </div>

                {/* T-337: month vs year mode is a 2-tab segmented control (clearer than a single toggle). */}
                {allowAllTime && setIsAllTime && (
                    <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', borderRadius: flat ? '14px' : '18px', padding: '4px', height: isMobile ? '44px' : (flat ? '38px' : '100%'), minHeight: flat ? '38px' : '44px', flexShrink: 0 }}>
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
                                        padding: flat ? '6px 14px' : '8px 18px',
                                        borderRadius: flat ? '11px' : '14px',
                                        fontWeight: 800,
                                        fontSize: flat ? '0.82rem' : '0.9rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.25s ease',
                                        boxShadow: active ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                                        whiteSpace: 'nowrap',
                                        flex: isMobile ? 1 : undefined
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
            <div style={{ display: 'flex', alignItems: 'center', gap: flat ? '8px' : '14px', opacity: isAllTime ? 0.5 : 1, pointerEvents: isAllTime ? 'none' : 'auto', transition: 'all 0.3s ease' }}>
                <span style={{ fontSize: flat ? '0.8rem' : '0.85rem', fontWeight: 800, color: '#94a3b8' }}>สัปดาห์</span>
                <div style={{ position: 'relative', flex: isMobile ? 1 : undefined, minWidth: 0 }}>
                    <div style={isMobile ? { ...chipScrollRow, minWidth: 0 } : { display: 'flex', gap: flat ? '6px' : '8px', flexWrap: 'wrap', rowGap: flat ? '6px' : '8px' }}>
                        {weeks.map((w) => (
                            <button
                                key={w}
                                onClick={() => setSelectedWeek(w)}
                                style={{
                                    height: flat ? '34px' : '38px',
                                    minWidth: w === 0 ? (flat ? '62px' : '76px') : (flat ? '34px' : '38px'),
                                    flex: isMobile ? '0 0 auto' : undefined,
                                    borderRadius: flat ? '10px' : '14px',
                                    background: selectedWeek === w ? '#4f46e5' : '#f8fafc',
                                    color: selectedWeek === w ? '#fff' : '#64748b',
                                    fontSize: flat ? '0.82rem' : '0.85rem',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    border: selectedWeek === w ? '2px solid #4f46e5' : '1px solid #e2e8f0',
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
                    {/* swipe hint: fade + arrow so a scrollable-but-clipped row on mobile doesn't read as "cut off" */}
                    {isMobile && (
                        <div style={{
                            position: 'absolute', right: 0, top: 0, bottom: 0, width: '32px',
                            background: 'linear-gradient(to right, transparent, #ffffff 85%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                            pointerEvents: 'none', color: '#94a3b8'
                        }}>
                            <ChevronRight size={14} strokeWidth={3} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MasterFilter;
