import React from 'react';
import { X } from 'lucide-react';

// Shared close ("X") button for modals — centralizes the icon/background/border
// colors so a contrast fix (e.g. Android "Force Dark" washing out low-contrast
// icon-on-grey combos, user-flagged 2026-07-24) only needs to change in one
// place instead of the ~28 hand-rolled close buttons that used to exist across
// the app, each with its own slightly different colors.
//
// Icon size is derived from buttonSize (icon-to-button bug, user-flagged
// 2026-07-24: callers resized the button via `style.width/height` without
// resizing the icon, leaving a tiny X inside a large circle) — pass `size`
// only when a deliberate icon/button ratio is needed.
//
const ICON_RATIO = 0.55;

interface ModalCloseButtonProps {
    onClick: () => void;
    variant?: 'light' | 'dark';
    buttonSize?: number;
    size?: number;
    style?: React.CSSProperties;
    'aria-label'?: string;
}

export const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({
    onClick,
    variant = 'light',
    buttonSize = 32,
    size,
    style,
    'aria-label': ariaLabel = 'ปิดหน้าต่าง',
}) => {
    const isDark = variant === 'dark';
    const iconSize = size ?? Math.round(buttonSize * ICON_RATIO);
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: `${buttonSize}px`,
                height: `${buttonSize}px`,
                padding: 0,
                flexShrink: 0,
                background: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
                border: isDark ? '1px solid rgba(255,255,255,0.35)' : '1px solid #94a3b8',
                borderRadius: '10px',
                color: isDark ? '#ffffff' : '#0f172a',
                cursor: 'pointer',
                ...style,
            }}
        >
            <X size={iconSize} strokeWidth={2.5} />
        </button>
    );
};

export default ModalCloseButton;
