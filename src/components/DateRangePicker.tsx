import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
    startDate: string; // ISO format (YYYY-MM-DD)
    endDate: string;   // ISO format (YYYY-MM-DD)
    onChange: (start: string, end: string) => void;
    placeholder?: string;
}

const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const DateRangePicker: React.FC<DateRangePickerProps> = ({
    startDate,
    endDate,
    onChange,
    placeholder = 'เลือกช่วงวันที่'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date()); // Controls the left month in view
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatDateThai = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = THAI_MONTHS[date.getMonth()].substring(0, 3);
        const year = (date.getFullYear() + 543).toString().substring(2);
        return `${day} ${month} ${year}`;
    };

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const handleDateClick = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];

        if (!startDate || (startDate && endDate)) {
            // First click or reset
            onChange(dateStr, '');
        } else {
            // Second click
            if (dateStr < startDate) {
                // Swap if second date is earlier
                onChange(dateStr, startDate);
            } else {
                onChange(startDate, dateStr);
            }
            setIsOpen(false); // Close after range complete
        }
    };

    const isSelected = (dateStr: string) => dateStr === startDate || dateStr === endDate;
    const isInRange = (dateStr: string) => startDate && endDate && dateStr > startDate && dateStr < endDate;

    const renderCalendar = (monthOffset: number) => {
        const date = new Date(viewDate.getFullYear(), viewDate.getMonth() + monthOffset, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const today = new Date().toISOString().split('T')[0];

        const days = [];
        // Empty cells for first week
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} style={{ width: '32px', height: '32px' }} />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const current = new Date(year, month, d);
            const currentStr = current.toISOString().split('T')[0];
            const selected = isSelected(currentStr);
            const range = isInRange(currentStr);
            const isToday = currentStr === today;

            days.push(
                <div
                    key={d}
                    onClick={() => handleDateClick(current)}
                    style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: selected || isToday ? 700 : 500,
                        borderRadius: d === 1 && range ? '16px 0 0 16px' : (d === daysInMonth && range ? '0 16px 16px 0' : '50%'),
                        background: selected ? '#6366f1' : (range ? '#eef2ff' : 'transparent'),
                        color: selected ? '#ffffff' : (isToday ? '#6366f1' : '#334155'),
                        position: 'relative',
                        transition: 'all 0.1s'
                    }}
                    onMouseOver={e => {
                        if (!selected && !range) e.currentTarget.style.background = '#f1f5f9';
                    }}
                    onMouseOut={e => {
                        if (!selected && !range) e.currentTarget.style.background = 'transparent';
                    }}
                >
                    {d}
                    {isToday && !selected && (
                        <div style={{ position: 'absolute', bottom: '4px', width: '4px', height: '4px', borderRadius: '50%', background: '#6366f1' }} />
                    )}
                </div>
            );
        }

        return (
            <div style={{ padding: '10px' }}>
                <div style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a', marginBottom: '12px', fontSize: '0.9rem' }}>
                    {THAI_MONTHS[month]} {year + 543}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '8px' }}>
                    {THAI_DAYS.map(day => (
                        <div key={day} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', width: '32px' }}>
                            {day}
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                    {days}
                </div>
            </div>
        );
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '10px 12px 10px 42px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    color: (startDate || endDate) ? '#0f172a' : '#94a3b8',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '42px',
                    position: 'relative'
                }}
            >
                <div style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex' }}>
                    <CalendarIcon size={18} />
                </div>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {startDate ? (
                        <>
                            {formatDateThai(startDate)}
                            {endDate && ` - ${formatDateThai(endDate)}`}
                        </>
                    ) : placeholder}
                </div>
                {(startDate || endDate) && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onChange('', ''); }}
                        style={{ display: 'flex', padding: '4px', borderRadius: '50%', cursor: 'pointer' }}
                        onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <X size={14} color="#94a3b8" />
                    </div>
                )}
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    zIndex: 2000,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '20px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: '580px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
                        <button
                            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px', color: '#64748b' }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px', color: '#64748b' }}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '20px' }}>
                        {renderCalendar(0)}
                        {renderCalendar(1)}
                    </div>

                    <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            onClick={() => {
                                const today = new Date().toISOString().split('T')[0];
                                onChange(today, today);
                                setIsOpen(false);
                            }}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
                        >
                            วันนี้
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{ padding: '6px 20px', borderRadius: '8px', border: 'none', background: '#6366f1', fontSize: '0.8rem', fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                        >
                            ตกลง
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
