const admin = require('firebase-admin');

// Initialize Labor Database App
const laborServiceAccount = require('c:\\Users\\101485\\Downloads\\labor-management-system.json');
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(laborServiceAccount)
}, 'laborApp');

const db = laborApp.firestore();

async function inspectAllProjectConfigs() {
  const projects = ['P001', 'P002', 'P003', 'P004', 'P005'];
  
  for (const pid of projects) {
    console.log(`\n=== Configs for Project ${pid} ===`);
    const snap = await db.collection('Project').doc(pid).collection('workOrderConfigs').get();
    if (snap.size === 0) {
      console.log("No configs found.");
      continue;
    }
    snap.docs.forEach(doc => {
      console.log(`- Config Code: "${doc.id}", Name: "${doc.data().name}"`);
    });
  }
}

inspectAllProjectConfigs().then(() => laborApp.delete());
