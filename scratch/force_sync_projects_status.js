const admin = require('firebase-admin');

// Initialize database connections
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
}, 'labor');

const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\after-sale-system.json'))
}, 'after-sale');

const laborDb = laborApp.firestore();
const afterSaleDb = afterSaleApp.firestore();

async function forceSync() {
  try {
    console.log("Force syncing projects' status and affiliation from Labor to After-Sale...");
    const snap = await laborDb.collection('Project').get();
    
    for (const doc of snap.docs) {
      const pid = doc.id;
      const pdata = doc.data();
      
      console.log(`Syncing ${pid}: name=${pdata.projectName}, status=${pdata.status}, dept=${pdata.department}`);
      
      await afterSaleDb.collection('projects').doc(pid).set({
        id: pid,
        code: pid,
        projectCode: pdata.projectCode || pdata.code || pid,
        name: pdata.projectName || '',
        affiliation: pdata.department || '',
        imageUrl: pdata.imageUrl || '',
        status: pdata.status || 'กำลังดำเนินการอยู่',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    
    console.log("SUCCESS: Force sync complete!");
  } catch (error) {
    console.error("Error during force sync:", error);
  } finally {
    await laborApp.delete();
    await afterSaleApp.delete();
  }
}

forceSync();
