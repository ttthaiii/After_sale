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

async function searchForemenNames() {
    const dcSnap = await getDocs(collection(db, 'dailyContractors'));
    const dcList = dcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const targets = ["ฐิติ", "มังกร", "ไท", "ลุงนุ", "วุฒิชัย", "อรุณรื่น", "นิรันดร์", "ปลื้มกลาง", "ธิดารัตน์", "ชัยพร", "กัญญพัชร", "กัลย์พิสชา", "วรวลัญช์"];
    
    console.log("Searching in dailyContractors for foremen keywords:");
    dcList.forEach(item => {
        const name = item.name || '';
        const found = targets.filter(t => name.includes(t));
        if (found.length > 0) {
            console.log(`Match found: ID: ${item.id} | Name: ${item.name} | Dept: ${item.department} | Skill: ${item.skillId} (Matched: ${found.join(', ')})`);
        }
    });
}

searchForemenNames().catch(console.error);
