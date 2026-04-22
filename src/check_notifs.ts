
import { db } from './lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function checkIds() {
    console.log("--- Users (Auth Fallback) ---");
    // We can't easily check localStorage, but we can check staff
    
    console.log("--- Staff Collection ---");
    const staffSnap = await getDocs(collection(db, 'staff'));
    staffSnap.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, Name: ${data.name}, Role: ${data.role}`);
    });

    console.log("--- Notifications Collection (Last 5) ---");
    const notifSnap = await getDocs(collection(db, 'notifications'));
    const sorted = notifSnap.docs.map(d => ({id: d.id, ...d.data()}) as any).sort((a,b) => b.createdAt - a.createdAt).slice(0, 5);
    sorted.forEach((n: any) => {
        console.log(`To ID: ${n.recipientId}, Title: ${n.title}, Read: ${n.isRead}`);
    });
}
// This is just a scratchpad idea, I can't run it easily without a runner.
// I'll use the browser instead.
