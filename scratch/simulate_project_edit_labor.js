const admin = require('firebase-admin');

// Initialize Labor database connection
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
}, 'labor');

const laborDb = laborApp.firestore();

async function simulateEdit() {
  try {
    console.log("Simulating project name change in Labor DB to 'Test 1 (Labor Edit)'...");
    await laborDb.collection('Project').doc('P005').update({
      projectName: "Test 1 (Labor Edit)",
      updatedAt: new Date().toISOString() // Newer timestamp!
    });
    console.log("SUCCESS: Simulated project update in Labor DB complete!");
  } catch (error) {
    console.error("Error simulating update:", error);
  } finally {
    await laborApp.delete();
  }
}

simulateEdit();
