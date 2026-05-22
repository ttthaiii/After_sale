import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
  const woRef = doc(db, 'workOrders', woId);
  const woSnap = await getDoc(woRef);
  const data = woSnap.data();
  console.log("Work order created details:");
  console.log(`- createdAt: ${data.createdAt} (Type: ${typeof data.createdAt})`);
  console.log(`- status: ${data.status} (Type: ${typeof data.status})`);
  console.log(`- projectId: ${data.projectId} (Type: ${typeof data.projectId})`);
  console.log(`- isArchived: ${data.isArchived} (Type: ${typeof data.isArchived})`);
}

main().catch(console.error);
