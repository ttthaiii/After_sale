import { db } from '../lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, query, where, collectionGroup } from 'firebase/firestore';

/**
 * 🚨 ปฏิบัติการย้ายไอดีพนักงานทั้งระบบ (Universal Staff ID Migration)
 * ทำหน้าที่ย้าย Document ID จาก Sxxx ไปเป็น EmployeeID และตามแก้ Reference ทั้งหมด
 */
export const performUniversalStaffMigration = async () => {
    console.log('🚀 Starting Universal Staff Migration...');
    try {
        // 1. ดึงข้อมูลพนักงานทั้งหมดมาทำ Mapping
        const staffSnap = await getDocs(collection(db, 'staff'));
        const idMapping: { [oldId: string]: string } = {};
        const staffDataMap: { [oldId: string]: any } = {};

        staffSnap.forEach(s => {
            const data = s.data();
            const oldId = s.id;
            const newId = data.employeeId || data.password || oldId;
            
            if (oldId !== newId) {
                idMapping[oldId] = newId;
                staffDataMap[oldId] = { ...data, employeeId: newId, password: newId };
                // ลบฟิลด์ id ที่ซ้ำซ้อนใน data ออก
                delete staffDataMap[oldId].id;
            }
        });

        const oldIds = Object.keys(idMapping);
        if (oldIds.length === 0) {
            console.log('✅ No ID mismatches found. System is already aligned.');
            return { success: true, message: 'ข้อมูลเป็นระเบียบอยู่แล้วครับ' };
        }

        console.log(`Found ${oldIds.length} staff members to migrate.`);

        // --- เริ่มขั้นตอนการแก้ไข (กวาดล้างทั้งระบบ) ---

        // 2. ย้ายข้อมูลในคอลเลกชัน 'staff'
        for (const oldId of oldIds) {
            const newId = idMapping[oldId];
            console.log(`Moving staff ${oldId} -> ${newId}`);
            await setDoc(doc(db, 'staff', newId), staffDataMap[oldId]);
            await deleteDoc(doc(db, 'staff', oldId));
        }

        // 3. แก้ไข 'workOrders' (Root Level)
        const woSnap = await getDocs(collection(db, 'workOrders'));
        for (const woDoc of woSnap.docs) {
            const woData = woDoc.data();
            if (woData.reporterId && idMapping[woData.reporterId]) {
                const batch = writeBatch(db);
                batch.update(woDoc.ref, { reporterId: idMapping[woData.reporterId] });
                await batch.commit();
                console.log(`Updated reporterId in WO ${woDoc.id}`);
            }

            // 🔍 ลึกลงไปใน Tasks (Sub-collections)
            // หมายเหตุ: ใช้ collectionGroup เพื่อเข้าถึงกิ่ง tasks ของทุุกใบงานพร้อมกัน
            const tasksSnap = await getDocs(collection(db, `workOrders/${woDoc.id}/categories`));
            for (const catDoc of tasksSnap.docs) {
                const subTasksSnap = await getDocs(collection(db, `workOrders/${woDoc.id}/categories/${catDoc.id}/tasks`));
                for (const taskDoc of subTasksSnap.docs) {
                    const taskData = taskDoc.data();
                    let needsUpdate = false;
                    const updates: any = {};

                    // แก้ไข responsibleStaffIds
                    if (taskData.responsibleStaffIds) {
                        const newStaffIds = taskData.responsibleStaffIds.map((id: string) => idMapping[id] || id);
                        if (JSON.stringify(newStaffIds) !== JSON.stringify(taskData.responsibleStaffIds)) {
                            updates.responsibleStaffIds = newStaffIds;
                            needsUpdate = true;
                        }
                    }

                    if (needsUpdate) {
                        await setDoc(taskDoc.ref, updates, { merge: true });
                        console.log(`Updated staff refs in Task ${taskDoc.id}`);
                    }

                    // 🔍 ลึกลงไปใน Daily Reports ของ Task นั้นๆ
                    const reportsSnap = await getDocs(collection(db, `workOrders/${woDoc.id}/categories/${catDoc.id}/tasks/${taskDoc.id}/dailyreport`));
                    for (const reportDoc of reportsSnap.docs) {
                        const reportData = reportDoc.data();
                        let reportNeedsUpdate = false;
                        const reportUpdates: any = {};

                        if (reportData.createdBy && idMapping[reportData.createdBy]) {
                            reportUpdates.createdBy = idMapping[reportData.createdBy];
                            reportNeedsUpdate = true;
                        }

                        if (reportData.workers) {
                            const newWorkers = reportData.workers.map((w: any) => ({
                                ...w,
                                workerId: idMapping[w.workerId] || w.workerId
                            }));
                            if (JSON.stringify(newWorkers) !== JSON.stringify(reportData.workers)) {
                                reportUpdates.workers = newWorkers;
                                reportNeedsUpdate = true;
                            }
                        }

                        if (reportNeedsUpdate) {
                            await setDoc(reportDoc.ref, reportUpdates, { merge: true });
                        }
                    }
                }
            }
        }

        // 4. แก้ไข 'activity_logs'
        const logsSnap = await getDocs(collection(db, 'activity_logs'));
        for (const logDoc of logsSnap.docs) {
            const logData = logDoc.data();
            if (logData.userId && idMapping[logData.userId]) {
                await setDoc(logDoc.ref, { userId: idMapping[logData.userId] }, { merge: true });
            }
        }

        console.log('✅ Universal Migration Completed Successfully!');
        return { success: true, message: `ย้ายข้อมูลสำเร็จ ${oldIds.length} รายการ และปรับปรุงใบงานทั้งหมดแล้วครับ` };

    } catch (error) {
        console.error('❌ Migration Critical Error:', error);
        return { success: false, message: `เกิดข้อผิดพลาด: ${error}` };
    }
};

/**
 * 🗑️ Clear all notifications from Firestore
 */
export const clearAllNotifications = async () => {
    try {
        console.log('--- Starting Notification Cleanup ---');
        const notiRef = collection(db, 'notifications');
        const snapshot = await getDocs(notiRef);
        
        if (snapshot.empty) {
            console.log('No notifications to clear.');
            return { success: true, count: 0 };
        }

        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Successfully cleared ${snapshot.size} notifications.`);
        return { success: true, count: snapshot.size };
    } catch (error) {
        console.error('Error clearing notifications:', error);
        throw error;
    }
};
