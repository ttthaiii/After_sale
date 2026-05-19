const admin = require('firebase-admin');
const serviceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkCollection() {
  try {
    const collections = await db.listCollections();
    const names = collections.map(c => c.id);
    console.log("Existing collections in After Sale:", names);
    
    const dcSnap = await db.collection('dailyContractors').limit(3).get();
    console.log("dailyContractors document count in After Sale:", dcSnap.size);
    if (dcSnap.size > 0) {
      dcSnap.forEach(d => console.log(d.id, d.data()));
    }
  } catch (error) {
    console.error("Error checking collections:", error);
  }
}

checkCollection();
