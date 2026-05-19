const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('c:\\Users\\101485\\Downloads\\labor-management-system.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectUsers() {
  console.log("Connecting to Firestore 'users' collection...");
  try {
    const snap = await db.collection('users').get();
    console.log(`Total users found: ${snap.size}`);
    
    const userSamples = [];
    snap.forEach(doc => {
      userSamples.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    console.log("User data details:");
    console.log(JSON.stringify(userSamples, null, 2));
    
  } catch (error) {
    console.error("Error inspecting users:", error);
  }
}

inspectUsers();
