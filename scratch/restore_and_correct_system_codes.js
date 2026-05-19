const admin = require('firebase-admin');

// Initialize After Sale database connection
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\after-sale-system.json'))
}, 'afterSale');

// Initialize Labor database connection
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
}, 'labor');

const afterSaleDb = afterSaleApp.firestore();
const laborDb = laborApp.firestore();

// Users that should have systemCode: "AS"
const afterSaleUsers = [
  '101485', '101527', '101622', '123456', 
  'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008'
];

// Pure Labor users that must NEVER have systemCode
const pureLaborUsers = [
  '100051', '101510'
];

async function restoreAndCorrectSystemCodes() {
  console.log("🚀 Starting database systemCode correction...");
  
  try {
    // 1. Restore/set systemCode: "AS" for After Sale users in both databases
    for (const userId of afterSaleUsers) {
      console.log(`Setting systemCode: "AS" for user ${userId} in both databases...`);
      
      // Update in After Sale DB
      await afterSaleDb.collection('users').doc(userId).set({
        systemCode: 'AS'
      }, { merge: true });
      
      // Update in Labor DB
      await laborDb.collection('users').doc(userId).set({
        systemCode: 'AS'
      }, { merge: true });
    }
    
    // 2. Remove systemCode for Pure Labor users in both databases
    for (const userId of pureLaborUsers) {
      console.log(`Removing systemCode from user ${userId} in both databases...`);
      
      // Remove in After Sale DB
      await afterSaleDb.collection('users').doc(userId).update({
        systemCode: admin.firestore.FieldValue.delete()
      }).catch(e => console.log(`User ${userId} not present or already updated in After Sale DB`));
      
      // Remove in Labor DB
      await laborDb.collection('users').doc(userId).update({
        systemCode: admin.firestore.FieldValue.delete()
      }).catch(e => console.log(`User ${userId} not present or already updated in Labor DB`));
    }
    
    console.log("✅ Successfully corrected systemCode fields in both databases!");
    
  } catch (error) {
    console.error("❌ Correction failed:", error);
  } finally {
    await afterSaleApp.delete();
    await laborApp.delete();
  }
}

restoreAndCorrectSystemCodes();
