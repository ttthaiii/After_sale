import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { ActivityLog } from '../types';

class LogService {
    private collectionRef = collection(db, 'activity_logs');

    /**
     * บันทึกกิจกรรมของผู้ใช้งานลง Firestore
     */
    async trackAction(params: {
        userId: string;
        userName: string;
        role: string;
        action: ActivityLog['action'];
        module: ActivityLog['module'];
        details: string;
        projectId?: string;
        targetId?: string;
    }) {
        try {
            await addDoc(this.collectionRef, {
                ...params,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            // Silently fail logging to not interrupt user flow, but log to console for debugging
            console.error('Failed to log activity:', error);
        }
    }

    /**
     * Helper for page views (can be called in useEffect)
     */
    async trackPageView(user: any, module: ActivityLog['module'], pageName: string) {
        if (!user) return;

        // ✅ Run lazy cleanup occasionally (approx 10% of page views or on login)
        if (Math.random() < 0.1) {
            this.cleanupOldLogs(6);
        }

        return this.trackAction({
            userId: user.id || user.uid,
            userName: user.name || user.email,
            role: user.role || 'Guest',
            action: 'VIEW_PAGE',
            module,
            details: `เข้าดูหน้า: ${pageName}`
        });
    }

    /**
     * ✅ Cleanup logs older than specified months
     * This uses a simple batch delete to keep Firestore clean.
     */
    async cleanupOldLogs(months: number = 6) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - months);

            const q = query(
                this.collectionRef,
                where('timestamp', '<', cutoffDate),
                limit(100) // Small batches to avoid timeout
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return;

            const batch = writeBatch(db);
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log(`Cleaned up ${snapshot.size} old logs.`);
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }
}

export const logService = new LogService();
