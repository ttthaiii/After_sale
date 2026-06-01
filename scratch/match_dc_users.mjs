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

// Simple normalization helper for Thai names (removes spaces, prefixes like นาย/นาง/นางสาว/คุณ)
function normalizeName(name) {
    if (!name) return '';
    return name.replace(/^(นาย|นางสาว|นาง|คุณ|ด\.ช\.|ด\.ญ\.)\s*/, '')
               .replace(/\s+/g, '')
               .trim();
}

async function findMatches() {
    const dcSnap = await getDocs(collection(db, 'dailyContractors'));
    const usersSnap = await getDocs(collection(db, 'users'));
    const staffSnap = await getDocs(collection(db, 'staff'));
    
    const dcList = dcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const staffList = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    console.log(`Loaded ${dcList.length} dailyContractors, ${usersList.length} users, ${staffList.length} staff.`);
    
    // Compare names
    console.log("\nMatching dailyContractors with staff/users by name:");
    
    const matched = [];
    dcList.forEach(dc => {
        const normDc = normalizeName(dc.name);
        
        // Find in staff
        const staffMatches = staffList.filter(s => normalizeName(s.name) === normDc);
        // Find in users
        const userMatches = usersList.filter(u => normalizeName(u.name) === normDc);
        
        if (staffMatches.length > 0 || userMatches.length > 0) {
            matched.push({
                dc,
                staffMatches,
                userMatches
            });
        }
    });
    
    console.log(`Found ${matched.length} matches by normalized name:`);
    matched.forEach(m => {
        console.log(`DC: ${m.dc.id} (${m.dc.name}) | Dept: ${m.dc.department} | Skill: ${m.dc.skillId}`);
        m.staffMatches.forEach(s => {
            console.log(`  -> Matched Staff ID: ${s.id} (${s.name}) | Role: ${s.role} | EmployeeId: ${s.employeeId}`);
        });
        m.userMatches.forEach(u => {
            console.log(`  -> Matched User ID: ${u.id} (${u.name}) | RoleId: ${u.roleId} | SystemCode: ${u.systemCode} | EmployeeId: ${u.employeeId}`);
        });
    });
}

findMatches().catch(console.error);
