const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectNestedSubcollections() {
  try {
    const paths = [
      { docPath: 'workOrders/WO-2026-1599/categories/CAT-6690' },
      { docPath: 'workOrders/WH-2026-0004-PD/categories/PD-0001' }
    ];
    
    const results = {};
    
    for (const item of paths) {
      console.log(`Checking nested collections for ${item.docPath}...`);
      const docRef = db.doc(item.docPath);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        results[item.docPath] = {
          exists: true,
          data: docSnap.data(),
          subcollections: {}
        };
        
        const subcollections = await docRef.listCollections();
        for (const subcol of subcollections) {
          const subSnap = await subcol.limit(2).get();
          results[item.docPath].subcollections[subcol.id] = subSnap.docs.map(d => ({
            id: d.id,
            data: d.data()
          }));
        }
      } else {
        results[item.docPath] = { exists: false };
      }
    }
    
    const outputPath = path.join(__dirname, 'nested_subcollections_inspect.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log("Nested inspection complete! Saved to:", outputPath);
    
  } catch (error) {
    console.error("Error during nested subcollection inspection:", error);
  }
}

inspectNestedSubcollections();
