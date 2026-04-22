import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, Staff } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { logService } from '../services/logService';

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

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            setLoading(true);
            const cleanUsername = username.trim();
            const cleanPassword = password.trim();

            console.log("Attempting login for:", cleanUsername);

            // ✅ Initial Admin Fallback (for first-time setup)
            if (cleanUsername === 'admin' && cleanPassword === 'admin123') {
                const adminUser: User = {
                    id: 'admin-initial',
                    name: 'Initial Admin',
                    role: 'Admin',
                    avatar: 'https://ui-avatars.com/api/?background=4f46e5&color=fff&name=Admin',
                    assignedProjects: []
                };
                setUser(adminUser);
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(adminUser));

                // ✅ Log Action
                await logService.trackAction({
                    userId: adminUser.id,
                    userName: adminUser.name,
                    role: adminUser.role,
                    action: 'LOGIN',
                    module: 'AUTH',
                    details: 'เข้าสู่ระบบ (Initial Admin)'
                });

                return true;
            }

            const q = query(
                collection(db, 'staff'),
                where('username', '==', cleanUsername)
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const staffData = querySnapshot.docs[0].data() as Staff;
                
                // ✅ Check password against either 'employeeId' or 'password' field
                const isPasswordCorrect = 
                    staffData.employeeId === cleanPassword || 
                    staffData.password === cleanPassword;

                if (!isPasswordCorrect) {
                   console.warn("Password mismatch for:", cleanUsername);
                   return false;
                }

                const loggedInUser: User = {
                    id: querySnapshot.docs[0].id,
                    employeeId: staffData.employeeId || staffData.password || staffData.id,
                    name: staffData.name,
                    role: staffData.role as UserRole,
                    avatar: staffData.profileImage || `https://ui-avatars.com/api/?background=random&name=${staffData.name}`,
                    assignedProjects: staffData.assignedProjects || []
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
                // If not found, let's check ONLY username to see if user exists but password/case is wrong
                const checkUserQuery = query(collection(db, 'staff'), where('username', '==', cleanUsername));
                const userSnap = await getDocs(checkUserQuery);
                if (userSnap.empty) {
                    console.warn("User not found in DB:", cleanUsername);
                } else {
                    console.warn("User found but password mismatch for:", cleanUsername);
                }
                return false;
            }
        } catch (error: any) {
            console.error('Login error detail:', error);
            // ✅ Show error directly for easier debugging of Rules/Index issues
            alert(`เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ${error.message || 'Unknown error'}`);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
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
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
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
