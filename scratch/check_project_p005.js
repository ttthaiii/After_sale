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

async function checkProject() {
  try {
    const laborDoc = await laborDb.collection('Project').doc('P005').get();
    console.log("Labor DB Project P005:");
    console.log(JSON.stringify(laborDoc.data(), null, 2));

    const asDoc = await afterSaleDb.collection('projects').doc('P005').get();
    console.log("\nAfter Sale DB Project P005:");
    console.log(JSON.stringify(asDoc.data(), null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await afterSaleApp.delete();
    await laborApp.delete();
  }
}

checkProject();
