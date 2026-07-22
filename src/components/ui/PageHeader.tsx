import React from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';

// Shared page header: leading icon + title + optional subtitle + optional action
// controls. On mobile the block stacks (title above actions) and the title font
// shrinks, so pages stop re-implementing the same 2rem-title + action-row header.
interface PageHeaderProps {
    title: React.ReactNode;
    icon?: React.ReactElement;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    style?: React.CSSProperties;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, icon, subtitle, actions, style }) => {
    const isMobile = useIsMobile();
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: isMobile ? '1rem' : '0',
                marginBottom: '1.5rem',
                ...style,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                {icon && <div style={{ color: '#4f46e5', display: 'flex', flexShrink: 0 }}>{icon}</div>}
                <div style={{ minWidth: 0 }}>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: isMobile ? '1.4rem' : '2rem',
                            fontWeight: 900,
                            color: '#0f172a',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <p style={{ margin: 0, fontSize: isMobile ? '0.8rem' : '0.9rem', color: '#64748b', fontWeight: 600 }}>
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {actions && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                    {actions}
                </div>
            )}
        </div>
    );
};

export default PageHeader;
