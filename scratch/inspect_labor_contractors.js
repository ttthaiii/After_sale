const admin = require('firebase-admin');

// Initialize Labor Database App
const laborServiceAccount = require('c:\\Users\\101485\\Downloads\\labor-management-system.json');
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(laborServiceAccount)
}, 'laborApp');

const db = laborApp.firestore();

async function inspectLaborDailyContractors() {
  console.log("=== Inspecting dailyContractors in Labor DB ===");
  const snap = await db.collection('dailyContractors').limit(5).get();
  console.log(`Total documents found (limited to 5): ${snap.size}`);
  snap.docs.forEach(doc => {
    console.log(`- ${doc.id}:`, doc.data());
  });
}

inspectLaborDailyContractors().then(() => laborApp.delete());
