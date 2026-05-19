const admin = require('firebase-admin');

// Initialize After Sale database connection
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\after-sale-system.json'))
}, 'afterSale');

const afterSaleDb = afterSaleApp.firestore();

async function checkSystemCodes() {
  try {
    const usersSnap = await afterSaleDb.collection('users').get();
    console.log("=== USERS WITH systemCode IN AFTER SALE DB ===");
    usersSnap.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id.padEnd(8)} | Name: ${data.name.padEnd(30)} | Department: ${(data.department || '').padEnd(6)} | systemCode: ${data.systemCode || 'None'}`);
    });
  } catch (error) {
    console.error(error);
  } finally {
    await afterSaleApp.delete();
  }
}

checkSystemCodes();
