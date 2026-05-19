const admin = require('firebase-admin');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const db = afterSaleApp.firestore();

// Helper to delete a flat collection in batches of 400
async function clearFlatCollection(collectionName) {
  console.log(`Clearing flat collection "${collectionName}"...`);
  let deletedCount = 0;
  
  while (true) {
    const snapshot = await db.collection(collectionName).limit(400).get();
    if (snapshot.size === 0) {
      break;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    deletedCount += snapshot.size;
    console.log(`Deleted a batch of ${snapshot.size} documents from "${collectionName}". Total deleted so far: ${deletedCount}`);
  }
  
  console.log(`Collection "${collectionName}" is now empty. Total deleted: ${deletedCount}`);
}

async function deepClearWorkOrders() {
  console.log("=== Starting Deep Deletion of all Work Orders ===");
  const workOrdersSnap = await db.collection('workOrders').get();
  console.log(`Found ${workOrdersSnap.size} root work orders to delete.`);

  let deletedWoCount = 0;
  let deletedCatCount = 0;
  let deletedTaskCount = 0;
  let deletedReportCount = 0;

  for (const woDoc of workOrdersSnap.docs) {
    const woRef = woDoc.ref;
    
    // 1. Get Categories
    const categoriesSnap = await woRef.collection('categories').get();
    for (const catDoc of categoriesSnap.docs) {
      const catRef = catDoc.ref;
      
      // 2. Get Tasks
      const tasksSnap = await catRef.collection('tasks').get();
      for (const taskDoc of tasksSnap.docs) {
        const taskRef = taskDoc.ref;
        
        // 3. Get Daily Reports
        const reportsSnap = await taskRef.collection('dailyreport').get();
        if (reportsSnap.size > 0) {
          const reportBatch = db.batch();
          reportsSnap.forEach(reportDoc => {
            reportBatch.delete(reportDoc.ref);
            deletedReportCount++;
          });
          await reportBatch.commit();
        }
        
        // Delete Task
        await taskRef.delete();
        deletedTaskCount++;
      }
      
      // Delete Category
      await catRef.delete();
      deletedCatCount++;
    }
    
    // Delete Work Order
    await woRef.delete();
    deletedWoCount++;
    console.log(`Progress: Deleted Work Order "${woDoc.id}"`);
  }

  console.log("\n=== Deep Deletion Summary ===");
  console.log(`Work Orders Deleted:   ${deletedWoCount}`);
  console.log(`Categories Deleted:    ${deletedCatCount}`);
  console.log(`Tasks Deleted:         ${deletedTaskCount}`);
  console.log(`Daily Reports Deleted: ${deletedReportCount}`);
}

async function runCleanup() {
  try {
    // 1. Deep clear workOrders
    await deepClearWorkOrders();

    console.log("\n=== Deleting Flat Collections ===");
    // 2. Clear notifications
    await clearFlatCollection('notifications');

    // 3. Clear activity_logs
    await clearFlatCollection('activity_logs');
    
    // 4. Clear logs (if any)
    await clearFlatCollection('logs');

    console.log("\n=== SUCCESS: All old linked data has been completely cleared! ===");
  } catch (error) {
    console.error("Error during database cleanup:", error);
  } finally {
    await afterSaleApp.delete();
  }
}

runCleanup();
