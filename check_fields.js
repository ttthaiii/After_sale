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

async function checkTaskFields() {
    const ids = ['ART-2026-WOA-0001', 'LR-2026-WOA-0003', 'LR-2026-WOA-0002'];
    for (const id of ids) {
        console.log(`\n=========================================`);
        console.log(`WO ID: ${id}`);
        const { getDoc, doc } = await import('firebase/firestore');
        const woDoc = await getDoc(doc(db, 'workOrders', id));
        if (woDoc.exists()) {
            console.log(`WO Status: ${woDoc.data().status}`);
        } else {
            console.log(`WO Doc does not exist!`);
        }
        const catSnap = await getDocs(collection(db, 'workOrders', id, 'categories'));
        for (const catDoc of catSnap.docs) {
            const taskSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks'));
            for (const tDoc of taskSnap.docs) {
                const task = tDoc.data();
                console.log(`Task ID: ${tDoc.id}`);
                console.log(`  - status: ${task.status}`);
                console.log(`  - name: ${task.name}`);
                console.log(`  - rootCause: ${task.rootCause}`);
                console.log(`  - notes: ${task.notes}`);
                console.log(`  - remarks: ${task.remarks}`);
                console.log(`  - responsibleStaffIds: ${JSON.stringify(task.responsibleStaffIds)}`);
            }
        }
    }
}

checkTaskFields().catch(console.error);
