import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyArRwN9_UpULParyEnxmyf9PXuclBg2zAU",
    authDomain: "after-sale-system.firebaseapp.com",
    projectId: "after-sale-system",
    storageBucket: "after-sale-system.firebasestorage.app",
    messagingSenderId: "378333375127",
    appId: "1:378333375127:web:6481088fe3a4763b3357d2",
    measurementId: "G-NTQ39K5Y60"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectDailyContractors() {
    console.log("Fetching all documents from dailyContractors collection...");
    const snap = await getDocs(collection(db, 'dailyContractors'));
    console.log(`Found ${snap.size} documents.`);
    
    const roles = new Set();
    const departments = new Set();
    const list = [];
    
    snap.docs.forEach(doc => {
        const data = doc.data();
        const id = doc.id;
        list.push({ id, ...data });
        if (data.role) roles.add(data.role);
        if (data.department) departments.add(data.department);
    });
    
    console.log("\nUnique Roles:", Array.from(roles));
    console.log("Unique Departments:", Array.from(departments));
    
    console.log("\nSample documents (up to 20):");
    list.slice(0, 20).forEach(item => {
        console.log(`ID: ${item.id} | Name: ${item.name} | Department: ${item.department} | Role: ${item.role} | skillId: ${item.skillId}`);
    });
    
    console.log("\nSearching for any foreman/supervisor related entries:");
    const foremanLike = list.filter(item => {
        const name = (item.name || '').toLowerCase();
        const dept = (item.department || '').toLowerCase();
        const r = (item.role || '').toLowerCase();
        const s = (item.skillId || '').toLowerCase();
        return name.includes('foreman') || name.includes('fm') || name.includes('super') || name.includes('โฟร์') ||
               dept.includes('foreman') || dept.includes('fm') || dept.includes('super') || dept.includes('โฟร์') ||
               r.includes('foreman') || r.includes('fm') || r.includes('super') || r.includes('โฟร์') ||
               s.includes('foreman') || s.includes('fm') || s.includes('super') || s.includes('โฟร์');
    });
    
    console.log(`Found ${foremanLike.length} potential foremen/supervisors:`);
    foremanLike.forEach(item => {
        console.log(JSON.stringify(item, null, 2));
    });
}

inspectDailyContractors().catch(console.error);
