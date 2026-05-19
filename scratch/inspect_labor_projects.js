const admin = require('firebase-admin');

// Initialize Labor database connection
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
}, 'labor');

const laborDb = laborApp.firestore();

async function inspectProjects() {
  try {
    const snap = await laborDb.collection('Project').get();
    console.log(`Found ${snap.size} projects in Labor DB:`);
    snap.forEach(doc => {
      console.log(`- Document ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
      console.log("------------------------");
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await laborApp.delete();
  }
}

inspectProjects();
