const admin = require('firebase-admin');

// Initialize Labor database connection
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
}, 'labor');

const laborDb = laborApp.firestore();

async function checkUser() {
  try {
    const userDoc = await laborDb.collection('users').doc('101622').get();
    if (userDoc.exists) {
      console.log("Labor DB data for 101622:");
      console.log(JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log("User 101622 NOT found in Labor DB.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await laborApp.delete();
  }
}

checkUser();
