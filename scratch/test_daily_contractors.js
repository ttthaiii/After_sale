const admin = require('firebase-admin');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const db = afterSaleApp.firestore();

async function simulateClientFilter() {
  console.log("=== Simulating Client-Side Contractor Filter ===");
  const snap = await db.collection('dailyContractors').get();
  const dailyContractors = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  
  console.log(`Total contractors in Firestore: ${dailyContractors.length}`);
  
  // Apply our filter logic
  const filtered = dailyContractors.filter(c => (c.department || '').toLowerCase().endsWith('wh'));
  
  console.log(`Contractors matching filter (ends with 'wh'): ${filtered.length}`);
  console.log("Sample of matching contractors:");
  filtered.slice(0, 10).forEach(c => {
    console.log(`- ${c.id}: ${c.name} [Dept: ${c.department}] [Skill: ${c.skillId}]`);
  });
}

simulateClientFilter().then(() => afterSaleApp.delete());
