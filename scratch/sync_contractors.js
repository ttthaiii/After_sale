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

async function syncDailyContractors() {
  console.log("=== Syncing dailyContractors from Labor DB ===");
  const laborDocsSnap = await laborDb.collection('dailyContractors').get();
  console.log(`Found ${laborDocsSnap.size} dailyContractors in Labor DB.`);
  
  let batch = afterSaleDb.batch();
  let count = 0;
  
  for (const doc of laborDocsSnap.docs) {
    const data = doc.data();
    const docRef = afterSaleDb.collection('dailyContractors').doc(doc.id);
    
    batch.set(docRef, {
      employeeId: data.employeeId || '',
      name: data.name || '',
      skillId: data.skillId || '',
      projectLocationId: data.projectLocationId || '',
      isActive: data.isActive !== false,
      department: data.department || '',
      foremanUsage: data.foremanUsage || {},
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    count++;
    
    // Commit batch in chunks of 400
    if (count % 400 === 0) {
      await batch.commit();
      batch = afterSaleDb.batch();
      console.log(`Synced ${count} documents...`);
    }
  }
  
  if (count % 400 !== 0) {
    await batch.commit();
  }
  
  console.log(`=== SUCCESS: Fully synchronized ${count} dailyContractors! ===`);
}

syncDailyContractors().then(() => {
  laborApp.delete();
  afterSaleApp.delete();
});
