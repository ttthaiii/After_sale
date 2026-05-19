const admin = require('firebase-admin');

const serviceAccount = require('c:\\Users\\101485\\Downloads\\labor-management-system.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUser() {
  console.log("Checking user '100051' in Labor DB 'users' collection...");
  try {
    const docRef = db.collection('users').doc('100051');
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      console.log("User '100051' found!");
      console.log(JSON.stringify(docSnap.data(), null, 2));
    } else {
      console.log("User '100051' NOT found.");
      // Let's also query if there's any user with employeeId "100051"
      const querySnap = await db.collection('users').where('employeeId', '==', '100051').get();
      if (!querySnap.empty) {
        console.log(`Found ${querySnap.size} matches via query:`);
        querySnap.forEach(d => {
          console.log(d.id, "=>", JSON.stringify(d.data(), null, 2));
        });
      } else {
        console.log("No query matches found either.");
      }
    }
  } catch (error) {
    console.error("Error checking user:", error);
  }
}

checkUser();
