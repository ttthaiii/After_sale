const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectWorkOrders() {
  try {
    const idsToFetch = [
      'LR-2026-0016-STR',
      'WH-2026-0004-PD',
      'WO-2026-1599'
    ];
    
    const results = {};
    
    for (const id of idsToFetch) {
      console.log(`Fetching document ${id}...`);
      const docRef = db.collection('workOrders').doc(id);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        results[id] = {
          exists: true,
          data: docSnap.data(),
          subcollections: {}
        };
        
        // Let's check for any subcollections (like categories)
        const subcollections = await docRef.listCollections();
        for (const subcol of subcollections) {
          const subSnap = await subcol.limit(2).get();
          results[id].subcollections[subcol.id] = subSnap.docs.map(d => ({
            id: d.id,
            data: d.data()
          }));
        }
      } else {
        results[id] = { exists: false };
      }
    }
    
    const outputPath = path.join(__dirname, 'workorders_detailed_inspect.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log("Detailed inspection complete! Saved to:", outputPath);
    
  } catch (error) {
    console.error("Error during detailed workOrders inspection:", error);
  }
}

inspectWorkOrders();
