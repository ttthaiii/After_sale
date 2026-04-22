import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

const MainLayout = () => {
    const { isAuthenticated, loading } = useAuth();

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
