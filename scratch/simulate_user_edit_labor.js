const admin = require('firebase-admin');

// Initialize Labor database connection
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
}, 'labor');

const laborDb = laborApp.firestore();

async function simulateEdit() {
  try {
    console.log("Simulating user change role to AM in Labor DB...");
    await laborDb.collection('users').doc('101622').update({
      roleId: "AM",
      updatedAt: new Date().toISOString() // Simulating new update timestamp!
    });
    console.log("SUCCESS: Simulated update in Labor DB complete!");
  } catch (error) {
    console.error("Error simulating update:", error);
  } finally {
    await laborApp.delete();
  }
}

simulateEdit();
