const admin = require('firebase-admin');

// Initialize After Sale database connection
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\after-sale-system.json'))
}, 'afterSale');

const afterSaleDb = afterSaleApp.firestore();

async function checkUser() {
  try {
    const userDoc = await afterSaleDb.collection('users').doc('101622').get();
    if (userDoc.exists) {
      console.log("After Sale DB data for 101622:");
      console.log(JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log("User 101622 NOT found in After Sale DB.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await afterSaleApp.delete();
  }
}

checkUser();
