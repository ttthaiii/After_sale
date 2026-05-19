const admin = require('firebase-admin');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const db = afterSaleApp.firestore();

async function inspectStaff() {
  console.log("=== Inspecting Staff collection ===");
  const snap = await db.collection('staff').get();
  snap.docs.forEach(doc => {
    console.log(`Staff ID: ${doc.id}:`, doc.data());
  });
}

inspectStaff().then(() => afterSaleApp.delete());
