const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyArRwN9_UpULParyEnxmyf9PXuclBg2zAU",
  authDomain: "after-sale-system.firebaseapp.com",
  projectId: "after-sale-system",
  storageBucket: "after-sale-system.firebasestorage.app",
  messagingSenderId: "378333375127",
  appId: "1:378333375127:web:6481088fe3a4763b3357d2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const snap = await getDocs(collection(db, 'workOrders'));

  for (const woDoc of snap.docs) {
    const wo = woDoc.data();
    console.log(`\n=== WO: ${woDoc.id} ===`);
    console.log(`  status            : ${wo.status}`);
    console.log(`  reviewedByAdmin   : ${wo.reviewedByAdmin}`);
    console.log(`  pendingAdminReassign: ${wo.pendingAdminReassign}`);
    console.log(`  adminReviewedAt   : ${wo.adminReviewedAt || '-'}`);

    // Check tasks
    const catsSnap = await getDocs(collection(db, 'workOrders', woDoc.id, 'categories'));
    for (const catDoc of catsSnap.docs) {
      const tasksSnap = await getDocs(collection(db, 'workOrders', woDoc.id, 'categories', catDoc.id, 'tasks'));
      for (const taskDoc of tasksSnap.docs) {
        const t = taskDoc.data();
        if (t.evaluationStatus === 'Rejected' || t.status === 'Rejected' || t.currentRevision) {
          console.log(`  Task: ${t.name || taskDoc.id}`);
          console.log(`    status           : ${t.status}`);
          console.log(`    evaluationStatus : ${t.evaluationStatus}`);
          console.log(`    currentRevision  : ${t.currentRevision}`);
          console.log(`    subtaskOperatorId: ${t.subtaskOperatorId}`);
          console.log(`    responsibleStaffIds: ${JSON.stringify(t.responsibleStaffIds)}`);
        }
      }
    }
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
