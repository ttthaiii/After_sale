const admin = require('firebase-admin');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const db = afterSaleApp.firestore();

async function inspectDepartments() {
  console.log("=== Inspecting Unique Departments in dailyContractors ===");
  const snap = await db.collection('dailyContractors').get();
  const depts = new Set();
  snap.docs.forEach(doc => {
    depts.add(doc.data().department);
  });
  console.log("Unique departments found:", Array.from(depts));
}

inspectDepartments().then(() => afterSaleApp.delete());
