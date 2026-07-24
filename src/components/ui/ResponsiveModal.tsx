import React from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ModalCloseButton } from './ModalCloseButton';

// Shared modal shell: full-screen overlay + a white panel that never exceeds the
// viewport. On mobile the panel becomes a full-width bottom sheet with reduced
// padding; on desktop it is a centered card capped at `maxWidth`. Replaces the
// 10+ hand-rolled `position:fixed` overlays with fixed 450px widths + 2rem pad.
interface ResponsiveModalProps {
    isOpen: boolean;
    onClose?: () => void;
    children: React.ReactNode;
    maxWidth?: string;
    panelStyle?: React.CSSProperties;
    zIndex?: number;
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
    isOpen,
    onClose,
    children,
    maxWidth = '460px',
    panelStyle,
    zIndex = 10000,
}) => {
    const isMobile = useIsMobile();
    if (!isOpen) return null;
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15,23,42,0.55)',
                display: 'flex',
                alignItems: isMobile ? 'flex-end' : 'center',
                justifyContent: 'center',
                padding: isMobile ? 0 : '2rem',
                zIndex,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#fff',
                    position: 'relative',
                    borderRadius: isMobile ? '24px 24px 0 0' : '24px',
                    width: '100%',
                    maxWidth: isMobile ? '100%' : maxWidth,
                    maxHeight: isMobile ? '92vh' : '90vh',
                    overflowY: 'auto',
                    padding: isMobile ? '1.25rem' : '2rem',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                    ...panelStyle,
                }}
            >
                {onClose && (
                    <ModalCloseButton
                        onClick={onClose}
                        buttonSize={isMobile ? 44 : 32}
                        style={{
                            position: 'absolute', top: '12px', right: '12px',
                            zIndex: 1,
                        }}
                    />
                )}
                {children}
            </div>
        </div>
    );
};

export default ResponsiveModal;
