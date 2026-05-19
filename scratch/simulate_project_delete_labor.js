const admin = require('firebase-admin');

// Initialize Labor database connection
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
}, 'labor');

const laborDb = laborApp.firestore();

async function simulateDelete() {
  try {
    console.log("Simulating project P005 deletion in Labor DB...");
    await laborDb.collection('Project').doc('P005').delete();
    console.log("SUCCESS: Simulated project P005 deletion in Labor DB complete!");
  } catch (error) {
    console.error("Error simulating delete:", error);
  } finally {
    await laborApp.delete();
  }
}

simulateDelete();
