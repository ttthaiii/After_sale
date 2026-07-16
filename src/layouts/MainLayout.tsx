import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

const MainLayout = () => {
    const { isAuthenticated, loading } = useAuth();
    const isMobile = useIsMobile();
    const [drawerOpen, setDrawerOpen] = useState(false);

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                <div style={{ color: '#4f46e5', fontWeight: 600 }}>กำลังโหลด...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Mobile: off-canvas drawer + top bar (T-002). Desktop layout is untouched below.
    if (isMobile) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflowX: 'hidden' }}>
                <header style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '0.6rem 1rem',
                    background: '#ffffff',
                    borderBottom: '1px solid #e2e8f0',
                    flexShrink: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                    <button
                        onClick={() => setDrawerOpen(true)}
                        aria-label="เปิดเมนู"
                        style={{
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '8px',
                            cursor: 'pointer',
                            color: '#374151',
                            display: 'flex'
                        }}
                    >
                        <Menu size={22} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#4f46e5', letterSpacing: '-0.5px' }}>Master Task</h2>
                    <NotificationBell />
                </header>

                {/* Backdrop */}
                {drawerOpen && (
                    <div
                        onClick={() => setDrawerOpen(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1400 }}
                    />
                )}

                {/* Off-canvas drawer */}
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    height: '100vh',
                    zIndex: 1500,
                    transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.25s ease'
                }}>
                    <Sidebar isMobile onNavigate={() => setDrawerOpen(false)} />
                </div>

                <main style={{
                    flex: 1,
                    padding: '1rem',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    background: '#f1f5f9',
                    color: '#111827',
                    boxSizing: 'border-box'
                }}>
                    <Outlet />
                </main>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                padding: '2rem',
                overflowY: 'auto',
                overflowX: 'hidden', // Prevent incidental horizontal scroll
                background: '#f1f5f9',
                color: '#111827',
                boxSizing: 'border-box'
            }}>
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
