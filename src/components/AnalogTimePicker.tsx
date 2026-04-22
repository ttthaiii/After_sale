import React, { useState, useEffect, useRef } from 'react';

interface AnalogTimePickerProps {
    value: string; // Format "HH:mm"
    onChange: (time: string) => void;
    onClose: () => void;
}

export const AnalogTimePicker: React.FC<AnalogTimePickerProps> = ({ value, onChange, onClose }) => {
    const [mode, setMode] = useState<'hour' | 'minute'>('hour');
    const [hour, setHour] = useState(0);
    const [minute, setMinute] = useState(0);
    const clockRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                setHour(h);
                setMinute(m);
            }
        }
    }, [value]);

    const updateTimeFromPointer = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent, isFinal = false) => {
        if (!clockRef.current) return;
        const rect = clockRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const dx = clientX - rect.left - centerX;
        const dy = clientY - rect.top - centerY;

        let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;

        const dist = Math.sqrt(dx * dx + dy * dy);

        if (mode === 'hour') {
            let h = Math.round(angle / 30);
            if (h === 0) h = 12;
            if (h === 12) h = 0; // Base 0 for easier math

            // Inner circle check
            // Center is 125, Radius 100. Inner usually ~60-70 radius.
            // Let's say inner threshold is 80px
            const isInner = dist < 84;

            // Outer: 1-12 (mapped to 1-12, 0 is 12 in UI but 0 in value?)
            // Wait, Standard 24h:
            // Top (0 deg): 12 (Outer), 00 (Inner)
            // Right (90 deg): 3 (Outer), 15 (Inner)

            // Adjusted logic:
            // h from calculation (0..11) where 0 is top (if angle adjusted correctly).
            // My angle starts at +90 offset? 
            // angle 0 = 3 o'clock (standard math). +90 => 12 o'clock is 0deg. Correct.

            // h=0 => Top (12). 
            // h=1 => 1 o'clock.

            if (isInner) {
                // Inner ring: 00, 13, 14 ... 23
                if (h === 0) h = 0; // 00
                else h += 12; // 1 -> 13, 2 -> 14...
            } else {
                // Outer ring: 12, 1, 2 ... 11
                if (h === 0) h = 12;
            }

            setHour(h === 24 ? 0 : h); // Safety
        } else {
            let m = Math.round(angle / 6);
            if (m === 60) m = 0;
            setMinute(m);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        updateTimeFromPointer(e);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) updateTimeFromPointer(e);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        setIsDragging(false);
        updateTimeFromPointer(e, true);
        if (mode === 'hour') {
            setMode('minute');
        }
    };

    const handleSave = () => {
        const hStr = hour.toString().padStart(2, '0');
        const mStr = minute.toString().padStart(2, '0');
        onChange(`${hStr}:${mStr}`);
        onClose();
    };

    // Render Helpers
    const renderClockFace = () => {
        const radiusOuter = 100;
        const radiusInner = 66; // 30% smaller
        const center = 125;

        // Hour numbers: 1-12 (Outer), 13-00 (Inner)
        const hoursOuter = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        const hoursInner = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

        const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

        const renderNumbers = (nums: number[], radius: number, isInner = false) => (
            nums.map((num, i) => {
                // i=0 is Top (12 or 00).
                const angleVal = (i * 30 - 90) * (Math.PI / 180);
                const x = center + radius * Math.cos(angleVal);
                const y = center + radius * Math.sin(angleVal);

                const isSelected = mode === 'hour' ? num === hour : num === minute;
                // Special check for minute intermediate (dot)

                return (
                    <div key={`${isInner ? 'i' : 'o'}-${num}`} style={{
                        position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)',
                        fontSize: isInner ? '0.75rem' : '0.9rem', fontWeight: 700,
                        color: isSelected ? '#fff' : isInner ? '#94a3b8' : '#334155',
                        background: isSelected ? '#3b82f6' : 'transparent',
                        width: 32, height: 32, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                        transition: 'all 0.1s'
                    }}>
                        {num.toString().padStart(2, '0')}
                    </div>
                );
            })
        );

        // Hand calculation
        let handAngle = 0;
        let handLength = 90;

        if (mode === 'hour') {
            // Check if inner or outer
            const isInnerHour = hour === 0 || hour > 12;
            handLength = isInnerHour ? 60 : 90;

            // Angle
            // 0 (00) -> -90
            // 12 (12) -> -90
            // 6 (06) -> 90
            // 18 (18) -> 90
            // Formula: (h % 12) * 30 - 90
            handAngle = (hour % 12) * 30 - 90;
        } else {
            handAngle = minute * 6 - 90;
        }

        return (
            <div
                ref={clockRef}
                style={{ width: 250, height: 250, borderRadius: '50%', background: '#f1f5f9', position: 'relative', margin: '0 auto', cursor: 'pointer' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setIsDragging(false)}
            >
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: 6, height: 6, background: '#3b82f6', borderRadius: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }} />

                {/* Hand */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', height: 2, background: '#3b82f6', transformOrigin: 'left center',
                    width: handLength, zIndex: 5,
                    transform: `rotate(${handAngle}deg)`,
                    transition: isDragging ? 'none' : 'width 0.2s, transform 0.2s'
                }} >
                    <div style={{ position: 'absolute', right: -4, top: -14, width: 30, height: 30, borderRadius: '50%', background: '#3b82f6', opacity: 0.3 }} />
                </div>

                {mode === 'hour' && (
                    <>
                        {renderNumbers(hoursOuter, radiusOuter)}
                        {renderNumbers(hoursInner, radiusInner, true)}
                    </>
                )}
                {mode === 'minute' && renderNumbers(minutes, radiusOuter)}
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{ background: '#fff', borderRadius: '24px', width: '320px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '8px', marginBottom: '20px' }}>
                    <div
                        onClick={() => setMode('hour')}
                        style={{ fontSize: '3rem', fontWeight: 800, color: mode === 'hour' ? '#3b82f6' : '#cbd5e1', cursor: 'pointer', lineHeight: 1 }}
                    >
                        {hour.toString().padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '3rem', fontWeight: 800, color: '#cbd5e1', lineHeight: 0.8 }}>:</div>
                    <div
                        onClick={() => setMode('minute')}
                        style={{ fontSize: '3rem', fontWeight: 800, color: mode === 'minute' ? '#3b82f6' : '#cbd5e1', cursor: 'pointer', lineHeight: 1 }}
                    >
                        {minute.toString().padStart(2, '0')}
                    </div>
                </div>

                {renderClockFace()}

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>ยกเลิก</button>
                    <button onClick={handleSave} style={{ border: 'none', background: '#3b82f6', color: '#fff', padding: '10px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>ตกลง</button>
                </div>
            </div>
        </div>
    );
};
