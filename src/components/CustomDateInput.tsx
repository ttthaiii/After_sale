import React from 'react';
import { Calendar } from 'lucide-react';
import { formatDate } from '../utils/date';

interface CustomDateInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    style?: React.CSSProperties;
    min?: string;
    max?: string;
    disabled?: boolean;
}

export const CustomDateInput: React.FC<CustomDateInputProps> = ({
    value,
    onChange,
    style,
    min,
    max,
    disabled
}) => {
    // Separate layout style (width, margin, flex, display, height) from presentation style
    const layoutStyle: React.CSSProperties = {
        position: 'relative',
        width: style?.width || '100%',
        display: style?.display || 'inline-block',
        margin: style?.margin,
        flex: style?.flex,
        height: style?.height,
        boxSizing: 'border-box',
    };

    // Style for the formatted display wrapper
    const displayStyle: React.CSSProperties = {
        ...style,
        width: '100%',
        height: '100%',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        boxSizing: 'border-box',
    };

    return (
        <div style={layoutStyle}>
            {/* Display wrapper showing formatting in DD/MM/YYYY */}
            <div style={displayStyle}>
                <span>{value ? formatDate(value) : '-'}</span>
                <Calendar size={16} style={{ color: '#94a3b8', flexShrink: 0, marginLeft: '8px' }} />
            </div>

            {/* Transparent native date input overlay */}
            <input
                className="custom-date-input-native"
                type="date"
                value={value}
                onChange={onChange}
                min={min}
                max={max}
                disabled={disabled}
                onClick={(e) => {
                    if (disabled) return;
                    try {
                        (e.currentTarget as any).showPicker();
                    } catch (err) {
                        // Safe fallback if not supported
                    }
                }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    color: 'transparent',
                    background: 'transparent',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    zIndex: 2,
                    border: 'none',
                    margin: 0,
                    padding: 0
                }}
            />
        </div>
    );
};

export default CustomDateInput;
