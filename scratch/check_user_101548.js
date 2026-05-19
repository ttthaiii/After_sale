const admin = require('firebase-admin');

// Initialize After Sale database connection
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\after-sale-system.json'))
}, 'afterSale');

const afterSaleDb = afterSaleApp.firestore();

async function checkUser() {
  try {
    const userDoc = await afterSaleDb.collection('users').doc('101548').get();
    if (userDoc.exists) {
      console.log("SUCCESS: User 101548 found in After Sale DB 'users' collection!");
      console.log(JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log("FAIL: User 101548 NOT found in After Sale DB 'users' collection.");
      
      // Let's list some documents in the 'users' collection
      const snap = await afterSaleDb.collection('users').limit(5).get();
      console.log("Sample users in After Sale 'users' collection:");
      snap.forEach(doc => {
        console.log(`- ${doc.id}: ${doc.data().name}`);
      });
    }
  } catch (error) {
    console.error("Error checking user:", error);
  } finally {
    await afterSaleApp.delete();
  }
}

checkUser();
