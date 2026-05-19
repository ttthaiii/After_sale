const admin = require('firebase-admin');

// Initialize After Sale database connection
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\after-sale-system.json'))
}, 'afterSale');

const afterSaleDb = afterSaleApp.firestore();

// Native Labor user IDs to clean up
const nativeLaborIds = [
  '100051', '101485', '101510', '101527', '101622', '123456'
];

async function cleanupSystemCodes() {
  console.log("🧹 Starting cleanup of systemCode field in After Sale DB...");
  
  try {
    const batch = afterSaleDb.batch();
    let count = 0;
    
    for (const userId of nativeLaborIds) {
      const userRef = afterSaleDb.collection('users').doc(userId);
      const doc = await userRef.get();
      
      if (doc.exists) {
        console.log(`Removing systemCode from user ${userId} (${doc.data().name}) in After Sale DB...`);
        // Remove systemCode field using FieldValue.delete()
        batch.update(userRef, {
          systemCode: admin.firestore.FieldValue.delete()
        });
        count++;
      }
    }
    
    if (count > 0) {
      await batch.commit();
      console.log(`✅ Successfully cleaned up systemCode from ${count} native Labor accounts in After Sale DB!`);
    } else {
      console.log("No native Labor accounts found to update.");
    }
    
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  } finally {
    await afterSaleApp.delete();
  }
}

cleanupSystemCodes();
