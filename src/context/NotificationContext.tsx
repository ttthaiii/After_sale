import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
    collection, 
    query, 
    onSnapshot, 
    limit,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export interface Notification {
    id: string;
    recipientId?: string; // Optional: specific user
    recipientRole?: string; // Optional: specific role (Admin, Manager, etc.)
    senderId: string;
    senderName: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    targetPath?: string;
    isRead: boolean;
    createdAt: any;
    readBy?: string[]; // Track who has read this role-based notification
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    sendNotification: (notification: Omit<Notification, 'id' | 'isRead' | 'createdAt' | 'readBy'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        const q = query(
            collection(db, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userRole = (user.role || '').toLowerCase();
            const userId = user.id;
            const isAdminLike = userRole.includes('admin') || userRole.includes('manager') || userRole.includes('approver');

            let fetchedNotifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Notification[];
            
            // ✅ Precise Filtering:
            fetchedNotifications = fetchedNotifications.filter(n => {
                const targetRole = (n.recipientRole || '').toLowerCase();
                const targetId = n.recipientId;

                // 1. If notification is DIRECT (has recipientId), show only if it matches current user OR common admin fallbacks
                if (targetId) {
                    const isFallback = targetId === 'admin-initial' || targetId === 'admin' || targetId === 'admin1';
                    if (isFallback) return isAdminLike; // Only Admins see fallback IDs
                    return targetId === userId;
                }

                // 2. If notification is ROLE-BASED (has recipientRole), show only if user matches that role
                if (targetRole) {
                    // Specific guard: Foreman should NEVER see 'admin' role notifications
                    if (targetRole.includes('admin') || targetRole.includes('approver')) {
                        return isAdminLike;
                    }
                    return userRole.includes(targetRole);
                }

                return false;
            });

            // Sort in memory by createdAt (descending)
            fetchedNotifications.sort((a, b) => {
                const timeA = a.createdAt?.seconds || (Date.now() / 1000 + 10000);
                const timeB = b.createdAt?.seconds || (Date.now() / 1000 + 10000);
                return timeB - timeA;
            });

            setNotifications(fetchedNotifications);
            
            // Unread count tracking
            const unread = fetchedNotifications.filter(n => {
                if (n.recipientRole) {
                    return !n.readBy?.includes(userId);
                }
                return !n.isRead;
            });
            setUnreadCount(unread.length);
        }, (error) => {
            console.error("Error fetching notifications:", error);
        });

        return () => unsubscribe();
    }, [user]);

    const markAsRead = useCallback(async (notificationId: string) => {
        if (!user) return;
        try {
            const notificationRef = doc(db, 'notifications', notificationId);
            const notification = notifications.find(n => n.id === notificationId);

            if (notification?.recipientRole) {
                // For role-based, add user to readBy array
                const currentReadBy = notification.readBy || [];
                if (!currentReadBy.includes(user.id)) {
                    await updateDoc(notificationRef, {
                        readBy: [...currentReadBy, user.id]
                    });
                }
            } else {
                // For direct, just mark isRead
                await updateDoc(notificationRef, { isRead: true });
            }
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    }, [user, notifications]);

    const markAllAsRead = useCallback(async () => {
        if (!user) return;
        try {
            // Per-user clearing: role-based notifications track readers in readBy[]
            // (append ONLY this user's id — never touches other admins' unread state);
            // direct notifications use isRead. Mirrors markAsRead for both types.
            const unreadForUser = notifications.filter(n =>
                n.recipientRole ? !n.readBy?.includes(user.id) : !n.isRead
            );
            const promises = unreadForUser.map(n => {
                const notificationRef = doc(db, 'notifications', n.id);
                return n.recipientRole
                    ? updateDoc(notificationRef, { readBy: [...(n.readBy || []), user.id] })
                    : updateDoc(notificationRef, { isRead: true });
            });
            await Promise.all(promises);
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    }, [user, notifications]);

    const sendNotification = useCallback(async (notificationData: Omit<Notification, 'id' | 'isRead' | 'createdAt'>) => {
        try {
            await addDoc(collection(db, 'notifications'), {
                ...notificationData,
                isRead: false,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending notification:", error);
        }
    }, []);

    const value = useMemo(() => ({
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        sendNotification
    }), [notifications, unreadCount, markAsRead, markAllAsRead, sendNotification]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
