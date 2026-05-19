const admin = require('firebase-admin');

// Initialize Labor Database App
const laborServiceAccount = require('c:\\Users\\101485\\Downloads\\labor-management-system.json');
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(laborServiceAccount)
}, 'laborApp');

const db = laborApp.firestore();

async function inspectWorkOrderConfigs() {
  console.log("=== Inspecting workOrderConfigs under Project P003 ===");
  const docRef = db.collection('Project').doc('P003');
  const configsSnap = await docRef.collection('workOrderConfigs').get();
  
  console.log(`Found ${configsSnap.size} documents in P003/workOrderConfigs:`);
  configsSnap.docs.forEach(doc => {
    console.log(`- Config ID: ${doc.id}:`, doc.data());
  });
}

inspectWorkOrderConfigs().then(() => laborApp.delete());
