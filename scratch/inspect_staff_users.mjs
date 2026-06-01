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

async function inspectCollections() {
    // 1. Inspect 'staff' collection
    console.log("========================================");
    console.log("Fetching all documents from 'staff' collection...");
    try {
        const staffSnap = await getDocs(collection(db, 'staff'));
        console.log(`Found ${staffSnap.size} documents in 'staff'.`);
        staffSnap.docs.slice(0, 10).forEach(doc => {
            console.log(`ID: ${doc.id} =>`, doc.data());
        });
    } catch(err) {
        console.error("Error fetching 'staff':", err);
    }

    // 2. Inspect 'users' collection
    console.log("\n========================================");
    console.log("Fetching all documents from 'users' collection...");
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        console.log(`Found ${usersSnap.size} documents in 'users'.`);
        usersSnap.docs.slice(0, 15).forEach(doc => {
            console.log(`ID: ${doc.id} =>`, doc.data());
        });
    } catch(err) {
        console.error("Error fetching 'users':", err);
    }
}

inspectCollections().catch(console.error);
