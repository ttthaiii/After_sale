import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ClipboardList, Clock, LogOut, CheckCircle2, Users, Archive, Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useState } from 'react';

const Sidebar = () => {
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

    return (
        <aside style={{
            width: '260px',
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
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div style={{
                            position: 'absolute',
                            left: '100%',
                            top: '0',
                            marginLeft: '15px',
                            width: '320px',
                            background: '#fff',
                            borderRadius: '16px',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            border: '1px solid #e5e7eb',
                            zIndex: 1000,
                            maxHeight: '480px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
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
                                    notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => {
                                                markAsRead(n.id);
                                                if (n.targetPath) {
                                                    let finalPath = n.targetPath;
                                                    
                                                    // ✅ Force redirect to /daily-report for foremen
                                                    const userRole = (user?.role || '').toLowerCase();
                                                    if (userRole === 'foreman' && (finalPath === '/dashboard' || finalPath === '/work-orders' || finalPath === '/')) {
                                                        finalPath = '/daily-report';
                                                    }

                                                    // Fallback: If targetPath doesn't have an ID but the message does, extract it
                                                    if (!finalPath.includes('?id=')) {
                                                        const idMatch = (n.message || '').match(/WO-\d{4}-\d+/) || (n.title || '').match(/WO-\d{4}-\d+/);
                                                        if (idMatch) {
                                                            const separator = finalPath.includes('?') ? '&' : '?';
                                                            finalPath += `${separator}id=${idMatch[0]}`;
                                                        }
                                                    }

                                                    console.log("Sidebar - Clicking Notification:", n);
                                                    console.log("Sidebar - Navigating to:", finalPath);
                                                    navigate(finalPath);
                                                    setShowNotifications(false);
                                                }
                                            }}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '10px',
                                                marginBottom: '4px',
                                                cursor: 'pointer',
                                                background: n.isRead ? 'transparent' : '#f0f7ff',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = n.isRead ? '#f9fafb' : '#e0efff'}
                                            onMouseOut={(e) => e.currentTarget.style.background = n.isRead ? 'transparent' : '#f0f7ff'}
                                        >
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>{n.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.4 }}>{n.message}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '4px' }}>
                                                จาก {n.senderName} • {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleTimeString('th-TH') : 'เมื่อครู่'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <nav style={{ flex: 1, padding: '1rem' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {allowedMenuItems.map((item) => (
                        <li key={item.path} style={{ marginBottom: '0.5rem' }}>
                            <Link
                                to={item.path}
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
                    onClick={logout}
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
