import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { ResponsiveModal } from '../components/ui/ResponsiveModal';

interface AlertContextType {
    showAlert: (message: string, title?: string) => Promise<void>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

// Drop-in replacement for window.alert(): showAlert(msg) returns a Promise that
// resolves when the user dismisses the modal, so `await showAlert(msg)` preserves
// the same "pause here until acknowledged" flow every call site already relies on.
export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<{ message: string; title?: string } | null>(null);
    const resolverRef = useRef<(() => void) | null>(null);

    const showAlert = useCallback((message: string, title?: string) => {
        return new Promise<void>((resolve) => {
            resolverRef.current = resolve;
            setState({ message, title });
        });
    }, []);

    const handleClose = () => {
        setState(null);
        resolverRef.current?.();
        resolverRef.current = null;
    };

    const value = useMemo(() => ({ showAlert }), [showAlert]);

    return (
        <AlertContext.Provider value={value}>
            {children}
            <ResponsiveModal isOpen={!!state} onClose={handleClose} maxWidth="380px" zIndex={20000}>
                <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                    {state?.title && (
                        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                            {state.title}
                        </h3>
                    )}
                    <p style={{ margin: '0 0 1.5rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {state?.message}
                    </p>
                    <button
                        onClick={handleClose}
                        style={{
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '0.65rem 2rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minWidth: '120px',
                        }}
                    >
                        ตกลง
                    </button>
                </div>
            </ResponsiveModal>
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error('useAlert must be used within AlertProvider');
    return ctx.showAlert;
};
