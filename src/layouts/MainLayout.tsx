import { Outlet, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

const MainLayout = () => {
    const { isAuthenticated, loading } = useAuth();
    const isMobile = useIsMobile();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { unreadCount } = useNotifications();

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                <div style={{ color: '#4f46e5', fontWeight: 600 }}>กำลังโหลด...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', flexDirection: 'column' }}>
            {/* Mobile top bar */}
            {isMobile && (
                <header style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 1.25rem',
                    height: '56px',
                    background: '#ffffff',
                    borderBottom: '1px solid #e2e8f0',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    flexShrink: 0,
                    zIndex: 100,
                }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#4f46e5', letterSpacing: '-0.5px' }}>
                        Master Task
                    </span>

                    <button
                        onClick={() => setMobileMenuOpen(prev => !prev)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '8px',
                            color: unreadCount > 0 ? '#4f46e5' : '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            position: 'relative',
                        }}
                        aria-label="การแจ้งเตือน"
                    >
                        <Bell size={22} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: '#ef4444',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                fontSize: '9px',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid #fff',
                            }}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                </header>
            )}

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar — desktop only */}
                {!isMobile && (
                    <Sidebar
                        isMobile={false}
                        onClose={() => setMobileMenuOpen(false)}
                    />
                )}

                {/* Mobile notification drawer — slides in from Sidebar when bell tapped */}
                {isMobile && mobileMenuOpen && (
                    <>
                        <div
                            onClick={() => setMobileMenuOpen(false)}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0,0,0,0.4)',
                                zIndex: 199,
                            }}
                        />
                        <Sidebar
                            isMobile={true}
                            onClose={() => setMobileMenuOpen(false)}
                        />
                    </>
                )}

                <main style={{
                    flex: 1,
                    padding: isMobile ? '1rem' : '2rem',
                    paddingTop: isMobile ? 0 : undefined,
                    paddingBottom: isMobile ? 'calc(1rem + 60px + env(safe-area-inset-bottom))' : '2rem',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    background: '#f1f5f9',
                    color: '#111827',
                    boxSizing: 'border-box',
                }}>
                    <Outlet />
                </main>
            </div>

            {/* Bottom navigation — mobile only */}
            {isMobile && <BottomNav />}
        </div>
    );
};

export default MainLayout;
