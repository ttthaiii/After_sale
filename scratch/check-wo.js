import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

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

async function main() {
  const woId = "ART-2026-WOA-0002";
  console.log(`Checking Work Order: ${woId}`);
  const woRef = doc(db, 'workOrders', woId);
  const woSnap = await getDoc(woRef);
  if (!woSnap.exists()) {
    console.log("Work order not found!");
    return;
  }
  const woData = woSnap.data();
  console.log("Work Order Data:");
  console.log(`- Status: ${woData.status}`);
  console.log(`- isArchived: ${woData.isArchived}`);
  console.log(`- reporterId: ${woData.reporterId}`);

  // Fetch categories subcollection
  const catRef = collection(db, 'workOrders', woId, 'categories');
  const catSnap = await getDocs(catRef);
  console.log(`Categories found: ${catSnap.size}`);
  for (const catDoc of catSnap.docs) {
    const catData = catDoc.data();
    console.log(`Category: ${catDoc.id} (${catData.name})`);
    
    // Fetch tasks subcollection
    const tasksRef = collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks');
    const tasksSnap = await getDocs(tasksRef);
    console.log(`  Tasks found: ${tasksSnap.size}`);
    for (const taskDoc of tasksSnap.docs) {
      const taskData = taskDoc.data();
      console.log(`  - Task: ${taskDoc.id} (${taskData.name})`);
      console.log(`    Status: ${taskData.status}`);
      console.log(`    Progress: ${taskData.dailyProgress}`);
      console.log(`    Responsible: ${JSON.stringify(taskData.responsibleStaffIds)}`);
    }
  }
}

main().catch(console.error);
