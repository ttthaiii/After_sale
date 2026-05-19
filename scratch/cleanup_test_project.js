const admin = require('firebase-admin');

// Initialize Labor database connection
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
}, 'labor');

const laborDb = laborApp.firestore();

async function cleanup() {
  try {
    console.log("Restoring project P005 name to 'Test 1' and clearing imageUrl in Labor DB...");
    await laborDb.collection('Project').doc('P005').update({
      projectName: "Test 1",
      imageUrl: "",
      updatedAt: new Date().toISOString()
    });
    console.log("SUCCESS: Cleanup complete! Real-time sync will propagate this to After Sale DB.");
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    await laborApp.delete();
  }
}

cleanup();
