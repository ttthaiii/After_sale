import React from 'react';

export const StatCard = ({ title, value, icon, color, subtext, gradient, onClick, trend, style }: any) => (
    <div
        onClick={onClick}
        style={{
            background: gradient || '#ffffff',
            padding: '1.5rem',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: gradient ? 'none' : '1px solid #e2e8f0',
            boxShadow: gradient ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minHeight: '160px',
            position: 'relative',
            overflow: 'hidden',
            ...style,
        }}
        onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px)';
            if (onClick) e.currentTarget.style.cursor = 'pointer';
        }}
        onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
        <div style={{ position: 'absolute', right: '-10%', top: '-10%', opacity: 0.1, color: gradient ? '#fff' : color }}>
            {React.cloneElement(icon, { size: 120 })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div style={{ background: gradient ? 'rgba(255,255,255,0.2)' : (color || '#64748b') + '15', padding: '12px', borderRadius: '14px', color: gradient ? '#fff' : color || '#64748b', display: 'flex' }}>
                {icon}
            </div>
            {trend !== undefined && (
                <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', borderRadius: '20px', background: trend > 0 ? '#dcfce7' : '#fee2e2', color: trend > 0 ? '#166534' : '#991b1b' }}>
                    {trend > 0 ? '+' : ''}{trend}%
                </div>
            )}
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: gradient ? 'rgba(255,255,255,0.8)' : '#64748b', fontWeight: 600, marginBottom: '4px' }}>{title}</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: gradient ? '#fff' : '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
            {subtext && <div style={{ fontSize: '0.75rem', color: gradient ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginTop: '8px', fontWeight: 500 }}>{subtext}</div>}
        </div>
    </div>
);

export const SectionHeader = ({ title, icon, subtitle, actions }: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon && <div style={{ color: '#4f46e5' }}>{icon}</div>}
            <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>{title}</h3>
                {subtitle && <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>{subtitle}</p>}
            </div>
        </div>
        {actions && <div>{actions}</div>}
    </div>
);
