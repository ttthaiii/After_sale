const admin = require('firebase-admin');

// Initialize After Sale database connection
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\after-sale-system.json'))
}, 'afterSale');

const afterSaleDb = afterSaleApp.firestore();

async function simulateEdit() {
  try {
    console.log("Simulating project imageUrl change in After Sale DB...");
    await afterSaleDb.collection('projects').doc('P005').update({
      imageUrl: "https://example.com/project-5.jpg",
      updatedAt: new Date().toISOString() // Newer timestamp!
    });
    console.log("SUCCESS: Simulated project update in After Sale DB complete!");
  } catch (error) {
    console.error("Error simulating update:", error);
  } finally {
    await afterSaleApp.delete();
  }
}

simulateEdit();
