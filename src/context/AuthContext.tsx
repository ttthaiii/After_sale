import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { logService } from '../services/logService';
import bcrypt from 'bcryptjs';
import { useAlert } from './AlertContext';

// After Sale owns the user role as a full name (Admin/Manager/Approver/Foreman).
// Read `role` directly from the DB; fall back to legacy Labor codes only for old
// records that were synced in before this field existed.
const resolveUserRole = (userData: any): UserRole => {
    const role = userData.role;
    if (role === 'Admin' || role === 'Manager' || role === 'Approver' || role === 'Foreman') {
        return role;
    }
    // Legacy fallback: users still carrying only a Labor code (AM/FM/PE/GOD)
    if (userData.roleId === 'AM' || userData.roleId === 'PE') return 'Admin';
    return 'Foreman';
};

interface AuthContextType {
    user: User | null;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const showAlert = useAlert();
    const [loading, setLoading] = useState(true);

    // ✅ Force new session reset to prevent multi-tab jumping issues
    const STORAGE_KEY = 'after_sale_v2_session_auth';

    // Persist login state
    useEffect(() => {
        // 🔒 Explicitly clear old localStorage to prevent interference
        localStorage.removeItem('after_sale_v1_auth');
        localStorage.removeItem('after_sale_user');
        
        const savedUser = sessionStorage.getItem(STORAGE_KEY);
        
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                if (parsedUser && parsedUser.id) {
                    setUser(parsedUser);
                }
            } catch (err) {
                console.error("Failed to parse session:", err);
                sessionStorage.removeItem(STORAGE_KEY);
            }
        }
        
        setLoading(false);
    }, []);

    // 🔄 Dynamic Real-time profile updates (for instant assignedProjects alignment)
    useEffect(() => {
        if (!user || user.id === 'admin-initial') return;
        
        const unsub = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const mappedRole = resolveUserRole(userData);
                setUser(prev => {
                    if (!prev) return null;
                    const updated = {
                        ...prev,
                        name: userData.name || prev.name,
                        role: mappedRole,
                        avatar: userData.profileImage || `https://ui-avatars.com/api/?background=random&name=${userData.name}`,
                        assignedProjects: userData.projectLocationIds || []
                    };
                    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                    return updated;
                });
            }
        });
        
        return () => unsub();
    }, [user?.id]);

    const login = useCallback(async (username: string, password: string): Promise<boolean> => {
        try {
            setLoading(true);
            const cleanUsername = username.trim();
            const cleanPassword = password.trim();

            console.log("Attempting login for:", cleanUsername);

            let q = query(
                collection(db, 'users'),
                where('username', '==', cleanUsername.toLowerCase())
            );

            let querySnapshot = await getDocs(q);

            // Fallback for case-sensitive usernames (e.g. Wutchai.O)
            if (querySnapshot.empty) {
                q = query(
                    collection(db, 'users'),
                    where('username', '==', cleanUsername)
                );
                querySnapshot = await getDocs(q);
            }

            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                const empId = querySnapshot.docs[0].id;
                
                let isPasswordCorrect = false;
                if (userData.passwordHash) {
                    try {
                        isPasswordCorrect = bcrypt.compareSync(cleanPassword, userData.passwordHash);
                    } catch (e) {
                        console.error("Bcrypt compare error:", e);
                    }
                }
                if (!isPasswordCorrect && (userData.password === cleanPassword || userData.employeeId === cleanPassword)) {
                    isPasswordCorrect = true;
                }

                if (!isPasswordCorrect) {
                   console.warn("Password mismatch for:", cleanUsername);
                   return false;
                }

                // Block deactivated (soft-deleted) users from logging in.
                if (userData.isActive === false) {
                    console.warn("Login blocked — user is deactivated:", cleanUsername);
                    await showAlert('บัญชีนี้ถูกปิดการใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ');
                    return false;
                }

                const mappedRole = resolveUserRole(userData);

                const loggedInUser: User = {
                    id: empId,
                    employeeId: userData.employeeId || empId,
                    name: userData.name || cleanUsername,
                    role: mappedRole,
                    avatar: userData.profileImage || `https://ui-avatars.com/api/?background=random&name=${userData.name || cleanUsername}`,
                    assignedProjects: userData.projectLocationIds || []
                };

                setUser(loggedInUser);
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser));
                
                // ✅ Log Action
                await logService.trackAction({
                    userId: loggedInUser.id,
                    userName: loggedInUser.name,
                    role: loggedInUser.role,
                    action: 'LOGIN',
                    module: 'AUTH',
                    details: 'เข้าสู่ระบบ'
                });

                return true;
            } else {
                // Try querying doc ID directly
                const directDocSnap = await getDocs(collection(db, 'users'));
                const matchingDoc = directDocSnap.docs.find(d => d.id === cleanUsername);

                if (matchingDoc) {
                    const userData = matchingDoc.data();
                    const empId = matchingDoc.id;
                    
                    let isPasswordCorrect = false;
                    if (userData.passwordHash) {
                        try {
                            isPasswordCorrect = bcrypt.compareSync(cleanPassword, userData.passwordHash);
                        } catch (e) {}
                    }
                    if (!isPasswordCorrect && (userData.password === cleanPassword || userData.employeeId === cleanPassword)) {
                        isPasswordCorrect = true;
                    }

                    if (isPasswordCorrect) {
                        // Block deactivated (soft-deleted) users from logging in.
                        if (userData.isActive === false) {
                            console.warn("Login blocked — user is deactivated:", cleanUsername);
                            await showAlert('บัญชีนี้ถูกปิดการใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ');
                            return false;
                        }
                        const mappedRole = resolveUserRole(userData);
                        const loggedInUser: User = {
                            id: empId,
                            employeeId: userData.employeeId || empId,
                            name: userData.name,
                            role: mappedRole,
                            avatar: userData.profileImage || `https://ui-avatars.com/api/?background=random&name=${userData.name}`,
                            assignedProjects: userData.projectLocationIds || []
                        };

                        setUser(loggedInUser);
                        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser));
                        return true;
                    }
                }
                
                console.warn("User not found or password incorrect in DB:", cleanUsername);
                return false;
            }
        } catch (error: any) {
            console.error('Login error detail:', error);
            await showAlert(`เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ${error.message || 'Unknown error'}`);
            return false;
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    const logout = useCallback(() => {
        if (user) {
            // ✅ Log Action (fire and forget for logout)
            logService.trackAction({
                userId: user.id,
                userName: user.name,
                role: user.role,
                action: 'LOGOUT',
                module: 'AUTH',
                details: 'ออกจากระบบ'
            });
        }
        setUser(null);
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem('after_sale_user');
    }, [user]);

    const value = useMemo(() => ({
        user, login, logout, isAuthenticated: !!user, loading
    }), [user, login, logout, loading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
