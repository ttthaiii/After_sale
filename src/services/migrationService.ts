import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { MOCK_PROJECTS, MOCK_STAFF, MOCK_CONTRACTORS, MOCK_WORK_ORDERS } from '../data/mockData';

/**
 * สคริปต์สำหรับย้ายข้อมูลจาก mockData.ts เข้าสู่ Firebase Firestore
 * เรียกใช้ฟังก์ชัน migrateAll() เพียงครั้งเดียวเพื่อเตรียมข้อมูลเริ่มต้น
 */

export const migrateProjects = async () => {
    console.log('Migrating Projects...');
    for (const project of MOCK_PROJECTS) {
        await setDoc(doc(db, 'projects', project.id), project);
    }
};

export const migrateStaff = async () => {
    console.log('Migrating Staff...');
    for (const staff of MOCK_STAFF) {
        await setDoc(doc(db, 'staff', staff.id), staff);
    }
};

export const migrateContractors = async () => {
    console.log('Migrating Contractors...');
    for (const contractor of MOCK_CONTRACTORS) {
        await setDoc(doc(db, 'contractors', contractor.id), contractor);
    }
};

export const migrateWorkOrders = async () => {
    console.log('Migrating Work Orders...');
    for (const wo of MOCK_WORK_ORDERS) {
        await setDoc(doc(db, 'workOrders', wo.id), wo);
    }
};

export const migrateStaffFields = async () => {
    console.log('Migrating Staff Fields (id -> employeeId)...');
    try {
        const snap = await getDocs(collection(db, 'staff'));
        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const updates: any = {};
            
            // 1. กำหนดรหัสพนักงานใหม่ (ลำดับความสำคัญ: employeeIdเดิม > passwordเดิม > docIdเดิม)
            const targetEmpId = data.employeeId || data.password || docSnap.id;
            updates.employeeId = targetEmpId;
            updates.password = targetEmpId; // ทำให้ล็อกอินด้วยรหัสพนักงานได้ทันที

            // 2. ลบฟิลด์ id ที่ซ้ำซ้อนออก
            if ('id' in data) {
                updates.id = deleteField();
            }

            if (Object.keys(updates).length > 0) {
                await updateDoc(docSnap.ref, updates);
                console.log(`Updated Staff ${docSnap.id} -> EmpID: ${targetEmpId}`);
            }
        }
        return true;
    } catch (error) {
        console.error('Migration failed:', error);
        return false;
    }
};

export const migrateAll = async () => {
    try {
        await migrateProjects();
        await migrateStaff();
        await migrateContractors();
        await migrateWorkOrders();
        console.log('✅ Migration Successful!');
        return true;
    } catch (error) {
        console.error('❌ Migration Failed:', error);
        return false;
    }
};
