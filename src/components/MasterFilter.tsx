import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ChevronDown } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

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
    setIsAllTime
}) => {
    const isMobile = useIsMobile();
    const [popupOpen, setPopupOpen] = useState(false);

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

    if (isMobile) {
        const weekLabel = selectedWeek === 0 ? 'ทั้งหมด' : `สัปดาห์ ${selectedWeek}`;
        return (
            <div style={{ position: 'relative', flex: style?.flex, width: style?.width }}>
                {/* Trigger button */}
                <button
                    onClick={() => setPopupOpen(v => !v)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: popupOpen ? '#f5f3ff' : '#fff',
                        border: `1.5px solid ${popupOpen ? '#4f46e5' : '#e2e8f0'}`,
                        borderRadius: '16px',
                        padding: '9px 14px',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: '#1e293b',
                        cursor: 'pointer',
                        width: '100%',
                        boxShadow: popupOpen ? '0 0 0 3px rgba(79,70,229,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <Calendar size={15} color="#4f46e5" strokeWidth={2.5} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{monthName}</span>
                    <span style={{ color: '#4f46e5', fontWeight: 900, fontSize: '0.8rem', background: '#ede9fe', padding: '2px 8px', borderRadius: '8px' }}>{weekLabel}</span>
                    <ChevronDown size={15} color="#94a3b8" style={{ transform: popupOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                </button>

                {/* Click-outside backdrop */}
                {popupOpen && (
                    <div onClick={() => setPopupOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 499 }} />
                )}

                {/* Dropdown panel */}
                {popupOpen && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        background: '#fff',
                        borderRadius: '18px',
                        border: '1.5px solid #e2e8f0',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                        padding: '14px',
                        zIndex: 500,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                    }}>
                        {/* Month navigator */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: '14px', padding: '8px 14px' }}>
                            <button onClick={() => handleMonthChange(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                <ChevronLeft size={20} strokeWidth={3} />
                            </button>
                            <span style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b' }}>{monthName}</span>
                            <button onClick={() => handleMonthChange(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                <ChevronRight size={20} strokeWidth={3} />
                            </button>
                        </div>

                        {/* Week buttons */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {weeks.map((w) => (
                                <button
                                    key={w}
                                    onClick={() => { setSelectedWeek(w); setPopupOpen(false); }}
                                    style={{
                                        flex: w === 0 ? '1 1 100%' : '1 1 calc(20% - 6px)',
                                        height: '38px',
                                        borderRadius: '12px',
                                        background: selectedWeek === w ? '#4f46e5' : '#f8fafc',
                                        color: selectedWeek === w ? '#fff' : '#64748b',
                                        fontSize: '0.88rem',
                                        fontWeight: 900,
                                        cursor: 'pointer',
                                        border: selectedWeek === w ? '2px solid #4f46e5' : '1px solid #f1f5f9',
                                        boxShadow: selectedWeek === w ? '0 4px 10px rgba(79,70,229,0.2)' : 'none',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {w === 0 ? 'ทั้งหมด' : w}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

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
                        onClick={() => handleMonthChange(-1)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                    >
                        <ChevronLeft size={20} strokeWidth={3} />
                    </button>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.01em', textAlign: 'center' }}>
                        {monthName}
                    </div>
                    <button 
                        onClick={() => handleMonthChange(1)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                    >
                        <ChevronRight size={20} strokeWidth={3} />
                    </button>
                </div>

                {allowAllTime && setIsAllTime && (
                    <button
                        onClick={() => setIsAllTime(!isAllTime)}
                        style={{
                            background: isAllTime ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : '#e2e8f0',
                            color: isAllTime ? '#fff' : '#64748b',
                            border: 'none',
                            padding: '10px 16px',
                            borderRadius: '16px',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            minHeight: '44px',
                            transition: 'all 0.3s ease',
                            boxShadow: isAllTime ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        สรุปข้อมูลทั้งหมด
                    </button>
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
