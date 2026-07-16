import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ClipboardList, Clock, LogOut, CheckCircle2, Users, Archive } from 'lucide-react';
import NotificationBell from './NotificationBell';

interface SidebarProps {
    // Called after a successful navigation / logout so the parent can close the
    // mobile drawer. No-op on desktop.
    onNavigate?: () => void;
    // True when rendered inside the mobile off-canvas drawer (T-002). On mobile the
    // notification bell lives in the top bar, so it is hidden here.
    isMobile?: boolean;
}

const Sidebar = ({ onNavigate, isMobile }: SidebarProps) => {
    const { user, logout } = useAuth();
    const location = useLocation();

    if (!user) return null;

    const menuItems = [
        {
            label: 'ภาพรวมระบบ',
            path: '/dashboard',
            icon: <LayoutDashboard size={20} />,
            roles: ['Foreman', 'BackOffice', 'Approver', 'Admin', 'Manager']
        },
        {
            label: 'ใบงานและติดตามผล',
            path: '/work-orders',
            icon: <ClipboardList size={20} />,
            roles: ['Foreman']
        },
        {
            label: 'บันทึกรายงาน (Daily)',
            path: '/daily-report',
            icon: <ClipboardList size={20} />,
            roles: ['Foreman']
        },
        {
            label: 'ตรวจสอบ/อนุมัติ',
            path: '/evaluation',
            icon: <CheckCircle2 size={20} />,
            roles: ['BackOffice', 'Admin', 'Manager', 'Approver']
        },
        {
            label: 'ติดตามสถานะ',
            path: '/sla-monitor',
            icon: <Clock size={20} />,
            roles: ['BackOffice', 'Approver', 'Admin', 'Manager']
        },
        {
            label: 'ประวัติงาน',
            path: '/history',
            icon: <Archive size={20} />,
            roles: ['Foreman', 'BackOffice', 'Approver', 'Admin', 'Manager']
        },
        {
            label: 'จัดการข้อมูล',
            path: '/admin',
            icon: <Users size={20} />,
            roles: ['Admin']
        },
    ];

    const allowedMenuItems = menuItems.filter(item => item.roles.includes(user.role));

    return (
        <aside style={{
            width: '260px',
            height: isMobile ? '100%' : undefined,
            background: '#ffffff',
            color: '#374151',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #e2e8f0',
            boxShadow: '4px 0 16px rgba(0,0,0,0.03)',
            position: 'relative'
        }}>
            <div style={{
                padding: '1.5rem',
                borderBottom: '1px solid #f3f4f6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#4f46e5', letterSpacing: '-0.5px' }}>Master Task</h2>
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>{user.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>ตำแหน่ง: {user.role}</div>
                    </div>
                </div>

                {/* On mobile the bell is rendered in the top bar (MainLayout), not here. */}
                {!isMobile && <NotificationBell />}
            </div>

            <nav style={{ flex: 1, padding: '1rem' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {allowedMenuItems.map((item) => (
                        <li key={item.path} style={{ marginBottom: '0.5rem' }}>
                            <Link
                                to={item.path}
                                onClick={(e) => {
                                    if ((window as any).hasUnsavedChanges) {
                                        const confirmLeave = window.confirm(
                                            "คุณมีข้อมูลรายงานความคืบหน้าที่ยังไม่ได้บันทึกค้างอยู่ หากสลับไปหน้าอื่น ข้อมูลที่กรอกไว้ทั้งหมดจะสูญหาย\n\nต้องการเปลี่ยนหน้าหรือไม่?"
                                        );
                                        if (!confirmLeave) {
                                            e.preventDefault();
                                            return;
                                        }
                                    }
                                    // Close the mobile drawer after a confirmed navigation.
                                    onNavigate?.();
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    textDecoration: 'none',
                                    fontSize: '0.95rem',
                                    fontWeight: 500,
                                    color: location.pathname === item.path ? '#4f46e5' : '#6b7280',
                                    background: location.pathname === item.path ? '#eef2ff' : 'transparent',
                                    transition: 'all 0.2s ease-in-out'
                                }}
                                onMouseOver={(e) => {
                                    if (location.pathname !== item.path) {
                                        e.currentTarget.style.background = '#f9fafb';
                                        e.currentTarget.style.color = '#111827';
                                    }
                                }}
                                onMouseOut={(e) => {
                                    if (location.pathname !== item.path) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#6b7280';
                                    }
                                }}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div style={{ padding: '1rem', borderTop: '1px solid #f3f4f6' }}>
                <button
                    onClick={(e) => {
                        if ((window as any).hasUnsavedChanges) {
                            const confirmLeave = window.confirm(
                                "คุณมีข้อมูลรายงานความคืบหน้าที่ยังไม่ได้บันทึกค้างอยู่ หากออกจากระบบ ข้อมูลที่กรอกไว้ทั้งหมดจะสูญหาย\n\nต้องการออกจากระบบหรือไม่?"
                            );
                            if (!confirmLeave) {
                                e.preventDefault();
                                return;
                            }
                        }
                        onNavigate?.();
                        logout();
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '0.75rem',
                        background: '#fef2f2',
                        border: '1px solid #fee2e2',
                        color: '#ef4444',
                        cursor: 'pointer',
                        borderRadius: '10px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fef2f2'}
                >
                    <LogOut size={18} />
                    ออกจากระบบ
                </button>
            </div>
          {/* Debug Info (Visible only in development or special toggle) */}
      <div style={{ padding: '8px', fontSize: '10px', opacity: 0.3, borderTop: '1px solid #eee', marginTop: 'auto' }}>
        ID: {user?.id} | Role: {user?.role}
      </div>
        </aside>
    );
};

export default Sidebar;
