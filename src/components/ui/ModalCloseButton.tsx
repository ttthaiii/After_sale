import React from 'react';
import { X } from 'lucide-react';

// Shared close ("X") button for modals — centralizes the icon/background/border
// colors so a contrast fix (e.g. Android "Force Dark" washing out low-contrast
// icon-on-grey combos, user-flagged 2026-07-24) only needs to change in one
// place instead of the ~28 hand-rolled close buttons that used to exist across
// the app, each with its own slightly different colors.
interface ModalCloseButtonProps {
    onClick: () => void;
    variant?: 'light' | 'dark';
    size?: number;
    style?: React.CSSProperties;
    'aria-label'?: string;
}

export const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({
    onClick,
    variant = 'light',
    size = 18,
    style,
    'aria-label': ariaLabel = 'ปิดหน้าต่าง',
}) => {
    const isDark = variant === 'dark';
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                flexShrink: 0,
                background: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
                border: isDark ? '1px solid rgba(255,255,255,0.35)' : '1px solid #94a3b8',
                borderRadius: '10px',
                color: isDark ? '#ffffff' : '#0f172a',
                cursor: 'pointer',
                ...style,
            }}
        >
            <X size={size} strokeWidth={2.5} />
        </button>
    );
};

export default ModalCloseButton;
