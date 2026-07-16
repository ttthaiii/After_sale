import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useIsMobile } from '../hooks/useIsMobile';

// Notification bell + dropdown. Extracted from Sidebar (T-002) so it can render in
// the desktop sidebar header OR the mobile top bar without duplicating the dropdown.
// The dropdown anchors to the right of the sidebar on desktop (left:100%) but drops
// straight down on mobile (top:100%) so it never runs off a phone screen.
const NotificationBell = () => {
    const { user } = useAuth();
    const { unreadCount, notifications, markAsRead } = useNotifications();
    const [showNotifications, setShowNotifications] = useState(false);
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    if (!user) return null;

    const dropdownPosition: CSSProperties = isMobile
        ? { top: '100%', right: 0, marginTop: '10px', width: 'min(320px, calc(100vw - 24px))' }
        : { left: '100%', top: 0, marginLeft: '15px', width: '320px' };

    return (
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
                    ...dropdownPosition,
                    background: '#fff',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e5e7eb',
                    zIndex: 1600,
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
                            notifications.map(n => {
                                const isRead = n.recipientRole ? n.readBy?.includes(user?.id) : n.isRead;
                                return (
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
                                                    const idMatch = (n.message || '').match(/[A-Za-z0-9]+-\d{4}-\d+(?:-WO)?/) || (n.title || '').match(/[A-Za-z0-9]+-\d{4}-\d+(?:-WO)?/);
                                                    if (idMatch) {
                                                        const separator = finalPath.includes('?') ? '&' : '?';
                                                        finalPath += `${separator}id=${idMatch[0]}`;
                                                    }
                                                }

                                                console.log("NotificationBell - Clicking Notification:", n);
                                                console.log("NotificationBell - Navigating to:", finalPath);
                                                navigate(finalPath);
                                                setShowNotifications(false);
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
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
