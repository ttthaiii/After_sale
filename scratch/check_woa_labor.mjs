import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

// The exact path from the Firebase screenshot for task "ฟ" (WOA-0002-001) in ART-2026-WOA-0001
async function checkExactPath() {
    const woId = 'ART-2026-WOA-0001';
    const catId = 'WOA-0002';
    const taskId = 'WOA-0002-001';
    const subtaskId = 'WOA-0002-001-0001';
    
    console.log(`\nChecking exact path for task "ฟ" in ${woId}`);
    
    // Check subtask document
    const subtaskDoc = await getDoc(doc(db, 'workOrders', woId, 'categories', catId, 'tasks', taskId, 'subtasks', subtaskId));
    console.log(`Subtask exists: ${subtaskDoc.exists()}`);
    if (subtaskDoc.exists()) {
        const sd = subtaskDoc.data();
        console.log(`Subtask data: currentRevision=${sd.currentRevision} | status=${sd.status}`);
    }
    
    // List ALL subcollections under subtask (can't do directly in SDK, try known names)
    const knownRevIds = ['rev00', 'rev01', 'rev02', 'REV00', 'Rev00', 'revision00'];
    for (const revId of knownRevIds) {
        const revDoc = await getDoc(doc(db, 'workOrders', woId, 'categories', catId, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', revId));
        const drSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catId, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', revId, 'dailyReports'));
        if (revDoc.exists() || drSnap.size > 0) {
            console.log(`\n✅ Found under revisions/${revId}:`);
            console.log(`  Rev doc exists: ${revDoc.exists()}`);
            console.log(`  DailyReports: ${drSnap.size}`);
            for (const dr of drSnap.docs) {
                const drData = dr.data();
                console.log(`  Date: ${dr.id} | labor: ${(drData.labor||[]).length}`);
                (drData.labor || []).forEach((l, i) => {
                    console.log(`    [${i}] workerId=${l.workerId||l.staffId} | name=${l.staffName||l.workerName}`);
                });
            }
        }
    }
    
    // Also check the dailyReports directly under subtask (bypass revisions)
    const directDrSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catId, 'tasks', taskId, 'subtasks', subtaskId, 'dailyReports'));
    if (directDrSnap.size > 0) {
        console.log(`\n✅ DailyReports directly under subtask (no revisions): ${directDrSnap.size}`);
        directDrSnap.docs.forEach(dr => {
            console.log(`  ${dr.id}: labor=${JSON.stringify((dr.data().labor||[]).map(l => l.staffName||l.workerName))}`);
        });
    }
}

checkExactPath().catch(console.error);
