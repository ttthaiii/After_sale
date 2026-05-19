const admin = require('firebase-admin');

// Initialize Labor Database App
const laborServiceAccount = require('c:\\Users\\101485\\Downloads\\labor-management-system.json');
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(laborServiceAccount)
}, 'laborApp');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const laborDb = laborApp.firestore();
const afterSaleDb = afterSaleApp.firestore();

async function syncProjectCodes() {
  console.log("=== Syncing Project Codes from Labor DB ===");
  const laborProjectsSnap = await laborDb.collection('Project').get();
  
  const batch = afterSaleDb.batch();
  
  for (const laborDoc of laborProjectsSnap.docs) {
    const data = laborDoc.data();
    const pid = laborDoc.id; // e.g. P001
    const pcode = data.projectCode || pid; // e.g. HO, WH, LR, AS, Test
    
    console.log(`Mapping Project ${pid}: name="${data.projectName}", projectCode="${pcode}"`);
    
    const afterSaleDocRef = afterSaleDb.collection('projects').doc(pid);
    batch.set(afterSaleDocRef, {
      id: pid,
      code: pid, // keep code as doc ID (P001) for consistency
      projectCode: pcode, // e.g., LR, WH, HO
      name: data.projectName || '',
      affiliation: data.department || '',
      imageUrl: data.imageUrl || ''
    }, { merge: true });
  }
  
  await batch.commit();
  console.log("=== SUCCESS: Synced all project codes successfully! ===");
}

syncProjectCodes().then(() => {
  laborApp.delete();
  afterSaleApp.delete();
});
