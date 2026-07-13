import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, CheckCircle2, Clock, Archive, Users, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const BottomNav = () => {
    const { user } = useAuth();
    const { unreadCount } = useNotifications();
    const location = useLocation();

    if (!user) return null;

    const allItems = [
        {
            label: 'ภาพรวม',
            path: '/dashboard',
            icon: LayoutDashboard,
            roles: ['Foreman', 'BackOffice', 'Approver', 'Admin', 'Manager'],
        },
        {
            label: 'ใบงาน',
            path: '/work-orders',
            icon: ClipboardList,
            roles: ['Foreman'],
        },
        {
            label: 'รายงาน',
            path: '/daily-report',
            icon: ClipboardList,
            roles: ['Foreman'],
        },
        {
            label: 'ตรวจสอบ',
            path: '/evaluation',
            icon: CheckCircle2,
            roles: ['BackOffice', 'Admin', 'Manager', 'Approver'],
        },
        {
            label: 'ติดตาม',
            path: '/sla-monitor',
            icon: Clock,
            roles: ['BackOffice', 'Approver', 'Admin', 'Manager'],
        },
        {
            label: 'ประวัติ',
            path: '/history',
            icon: Archive,
            roles: ['Foreman', 'BackOffice', 'Approver', 'Admin', 'Manager'],
        },
        {
            label: 'จัดการ',
            path: '/admin',
            icon: Users,
            roles: ['Admin'],
        },
    ];

    const items = allItems.filter(item => item.roles.includes(user.role));

    const handleNav = (e: React.MouseEvent) => {
        if ((window as any).hasUnsavedChanges) {
            const ok = window.confirm(
                'คุณมีข้อมูลที่ยังไม่ได้บันทึก หากเปลี่ยนหน้า ข้อมูลจะหายไป\n\nต้องการเปลี่ยนหน้าหรือไม่?'
            );
            if (!ok) e.preventDefault();
        }
    };

    return (
        <nav style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: `calc(60px + env(safe-area-inset-bottom))`,
            paddingBottom: 'env(safe-area-inset-bottom)',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'stretch',
            zIndex: 200,
        }}>
            {items.map(item => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                const isBell = item.path === '/daily-report' && unreadCount > 0;

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={handleNav}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            textDecoration: 'none',
                            color: isActive ? '#4f46e5' : '#94a3b8',
                            background: 'none',
                            border: 'none',
                            padding: '8px 4px',
                            position: 'relative',
                            transition: 'color 0.15s',
                        }}
                    >
                        {/* Active indicator bar */}
                        {isActive && (
                            <span style={{
                                position: 'absolute',
                                top: 0,
                                left: '20%',
                                right: '20%',
                                height: '2.5px',
                                background: '#4f46e5',
                                borderRadius: '0 0 4px 4px',
                            }} />
                        )}

                        <span style={{ position: 'relative', display: 'flex' }}>
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                            {/* Bell badge — show on รายงาน tab for Foreman if unread */}
                            {isBell && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-5px',
                                    background: '#ef4444',
                                    color: '#fff',
                                    borderRadius: '50%',
                                    width: '14px',
                                    height: '14px',
                                    fontSize: '8px',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1.5px solid #fff',
                                }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </span>

                        <span style={{
                            fontSize: '0.6rem',
                            fontWeight: isActive ? 700 : 500,
                            letterSpacing: '0.01em',
                        }}>
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
};

export default BottomNav;
