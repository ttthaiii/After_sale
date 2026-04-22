import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    isVisible: boolean;
    message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = 'กำลังบันทึกข้อมูล...' }) => {
    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate 900 with transparency
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'all 0.3s ease'
        }}>
            <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                padding: '2rem 3rem',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
                <Loader2 
                    className="animate-spin" 
                    size={48} 
                    style={{ color: '#4f46e5' }} // Indigo 600
                />
                <span style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 800, 
                    color: '#1e293b', // Slate 800
                    letterSpacing: '-0.025em'
                }}>
                    {message}
                </span>
                <div style={{ 
                    fontSize: '0.85rem', 
                    color: '#64748b', // Slate 500
                    fontWeight: 500
                }}>
                    กรุณารอสักครู่ ระบบกำลังดำเนินการ
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default LoadingOverlay;
