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

function isUserDocEqual(docA, docB) {
  if (!docA || !docB) return false;
  return docA.name === docB.name &&
         docA.username === docB.username &&
         docA.passwordHash === docB.passwordHash &&
         docA.roleId === docB.roleId &&
         docA.department === docB.department &&
         JSON.stringify(docA.projectLocationIds || []) === JSON.stringify(docB.projectLocationIds || []) &&
         (docA.isActive !== undefined ? docA.isActive : true) === (docB.isActive !== undefined ? docB.isActive : true);
}

async function debugSync() {
  try {
    console.log("Checking labor users with systemCode == 'AS'...");
    const snap = await laborDb.collection('users').where('systemCode', '==', 'AS').get();
    console.log(`Found ${snap.size} AS users in Labor DB.`);
    
    for (const doc of snap.docs) {
      const laborData = doc.data();
      const userId = doc.id;
      
      const asDoc = await afterSaleDb.collection('users').doc(userId).get();
      if (!asDoc.exists) {
        console.log(`- ${userId} (${laborData.name}): NOT found in After Sale DB.`);
      } else {
        const asData = asDoc.data();
        const equals = isUserDocEqual(laborData, asData);
        console.log(`- ${userId} (${laborData.name}): exists in After Sale. isUserDocEqual? ${equals}`);
        console.log(`  Labor: roleId=${laborData.roleId}, department=${laborData.department}`);
        console.log(`  After Sale: roleId=${asData.roleId}, department=${asData.department}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await afterSaleApp.delete();
    await laborApp.delete();
  }
}

debugSync();
