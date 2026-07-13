import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ClipboardList, Clock, LogOut, CheckCircle2, Users, Archive, Bell, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useState } from 'react';

interface SidebarProps {
    isMobile?: boolean;
    onClose?: () => void;
}

const Sidebar = ({ isMobile = false, onClose }: SidebarProps) => {
    const { user, logout } = useAuth();
    const { unreadCount, notifications, markAsRead } = useNotifications();
    const [showNotifications, setShowNotifications] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

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

    const handleNavClick = (e: React.MouseEvent) => {
        if ((window as any).hasUnsavedChanges) {
            const confirmLeave = window.confirm(
                "คุณมีข้อมูลรายงานความคืบหน้าที่ยังไม่ได้บันทึกค้างอยู่ หากสลับไปหน้าอื่น ข้อมูลที่กรอกไว้ทั้งหมดจะสูญหาย\n\nต้องการเปลี่ยนหน้าหรือไม่?"
            );
            if (!confirmLeave) {
                e.preventDefault();
                return;
            }
        }
        if (isMobile) onClose?.();
    };

    // Notification panel: on mobile anchor below the bell button; on desktop to the right
    const notifPanelStyle: React.CSSProperties = isMobile
        ? {
            position: 'fixed',
            top: '56px',
            left: '0',
            right: '0',
            width: '100%',
            background: '#fff',
            borderRadius: '0 0 16px 16px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            zIndex: 1100,
            maxHeight: '60vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }
        : {
            position: 'absolute',
            left: '100%',
            top: '0',
            marginLeft: '15px',
            width: '320px',
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
            zIndex: 1000,
            maxHeight: '480px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        };

    return (
        <aside style={{
            width: '260px',
            background: '#ffffff',
            color: '#374151',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #e2e8f0',
            boxShadow: isMobile ? '4px 0 24px rgba(0,0,0,0.12)' : '4px 0 16px rgba(0,0,0,0.03)',
            position: isMobile ? 'fixed' : 'relative',
            top: isMobile ? 0 : undefined,
            left: isMobile ? 0 : undefined,
            height: isMobile ? '100vh' : undefined,
            zIndex: isMobile ? 200 : undefined,
            overflowY: isMobile ? 'auto' : undefined,
        }}>
            <div style={{
                padding: '1.25rem 1rem 1rem 1.25rem',
                borderBottom: '1px solid #f3f4f6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexShrink: 0
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#4f46e5', letterSpacing: '-0.5px' }}>Master Task</h2>
                    <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>ตำแหน่ง: {user.role}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {/* Bell button */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{
                                background: '#f9fafb',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                padding: '8px',
                                cursor: 'pointer',
                                position: 'relative',
                                color: unreadCount > 0 ? '#4f46e5' : '#6b7280',
                                transition: 'all 0.2s'
                            }}
                            aria-label="การแจ้งเตือน"
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-5px',
                                    right: '-5px',
                                    background: '#ef4444',
                                    color: '#fff',
                                    borderRadius: '50%',
                                    width: '18px',
                                    height: '18px',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px solid #fff'
                                }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div style={notifPanelStyle}>
                                <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>การแจ้งเตือน</h3>
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>ทั้งหมด {notifications.length}</span>
                                </div>
                                <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                                            <Bell size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                            <p style={{ margin: 0, fontSize: '0.85rem' }}>ไม่มีการแจ้งเตือน</p>
                                        </div>
                                    ) : (
                                        notifications.map(n => {
                                            const isRead = n.recipientRole ? n.readBy?.includes(user?.id) : n.isRead;
                                            return (
                                                <div
                                                    key={n.id}
                                                    onClick={() => {
                                                        markAsRead(n.id);
                                                        if (n.targetPath) {
                                                            let finalPath = n.targetPath;

                                                            const userRole = (user?.role || '').toLowerCase();
                                                            if (userRole === 'foreman' && (finalPath === '/dashboard' || finalPath === '/work-orders' || finalPath === '/')) {
                                                                finalPath = '/daily-report';
                                                            }

                                                            if (!finalPath.includes('?id=')) {
                                                                const idMatch = (n.message || '').match(/[A-Za-z0-9]+-\d{4}-\d+(?:-WO)?/) || (n.title || '').match(/[A-Za-z0-9]+-\d{4}-\d+(?:-WO)?/);
                                                                if (idMatch) {
                                                                    const separator = finalPath.includes('?') ? '&' : '?';
                                                                    finalPath += `${separator}id=${idMatch[0]}`;
                                                                }
                                                            }

                                                            console.log("Sidebar - Clicking Notification:", n);
                                                            console.log("Sidebar - Navigating to:", finalPath);
                                                            navigate(finalPath);
                                                            setShowNotifications(false);
                                                            if (isMobile) onClose?.();
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '12px',
                                                        borderRadius: '10px',
                                                        marginBottom: '4px',
                                                        cursor: 'pointer',
                                                        background: isRead ? 'transparent' : '#f0f7ff',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = isRead ? '#f9fafb' : '#e0efff'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = isRead ? 'transparent' : '#f0f7ff'}
                                                >
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>{n.title}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.4 }}>{n.message}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '4px' }}>
                                                        จาก {n.senderName} • {n.createdAt?.seconds ? (() => {
                                                            const d = new Date(n.createdAt.seconds * 1000);
                                                            const hours = String(d.getHours()).padStart(2, '0');
                                                            const minutes = String(d.getMinutes()).padStart(2, '0');
                                                            return `${hours}:${minutes}`;
                                                        })() : 'เมื่อครู่'}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Close button — mobile only */}
                    {isMobile && (
                        <button
                            onClick={onClose}
                            style={{
                                background: '#f9fafb',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                padding: '8px',
                                cursor: 'pointer',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            aria-label="ปิดเมนู"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            <nav style={{ flex: 1, padding: '1rem' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {allowedMenuItems.map((item) => (
                        <li key={item.path} style={{ marginBottom: '0.5rem' }}>
                            <Link
                                to={item.path}
                                onClick={handleNavClick}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: isMobile ? '0.85rem 1rem' : '0.75rem 1rem',
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

            <div style={{ padding: '1rem', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
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

            <div style={{ padding: '8px', fontSize: '10px', opacity: 0.3, borderTop: '1px solid #eee' }}>
                ID: {user?.id} | Role: {user?.role}
            </div>
        </aside>
    );
};

export default Sidebar;
