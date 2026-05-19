const admin = require('firebase-admin');
const fs = require('fs');

// We can check if after-sale-system.json or after-sale-system-firebase-adminsdk... is available in downloads
const serviceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectCurrentStaff() {
  console.log("Connecting to After Sale Firestore 'staff' collection...");
  try {
    const snap = await db.collection('staff').get();
    console.log(`Total staff in After Sale found: ${snap.size}`);
    
    const staffList = [];
    snap.forEach(doc => {
      staffList.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    console.log("After Sale Staff details:");
    console.log(JSON.stringify(staffList, null, 2));
    
  } catch (error) {
    console.error("Error inspecting current staff:", error);
  }
}

inspectCurrentStaff();
