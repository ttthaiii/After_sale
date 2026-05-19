const admin = require('firebase-admin');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const db = afterSaleApp.firestore();

async function inspectDailyContractors() {
  console.log("=== Inspecting dailyContractors collection ===");
  const snap = await db.collection('dailyContractors').get();
  console.log(`Total documents found: ${snap.size}`);
  if (snap.size > 0) {
    console.log("First document data:", snap.docs[0].id, snap.docs[0].data());
  }
}

inspectDailyContractors().then(() => afterSaleApp.delete());
