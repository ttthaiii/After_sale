const admin = require('firebase-admin');

// Initialize Labor Database App
const laborServiceAccount = require('c:\\Users\\101485\\Downloads\\labor-management-system.json');
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(laborServiceAccount)
}, 'laborApp');

const db = laborApp.firestore();

async function inspectLaborDb() {
  console.log("=== Inspecting Labor Collections ===");
  
  // List some projects
  const projectsSnap = await db.collection('Project').get();
  console.log(`\nFound ${projectsSnap.size} projects in Labor DB:`);
  projectsSnap.docs.forEach(doc => {
    console.log(`- Project Doc ID: ${doc.id}, Name: ${doc.data().projectName}, Code: ${doc.data().projectCode}, Department: ${doc.data().department}`);
  });

  // Let's check collections in Labor DB
  // Typically, there's a workOrders or similar collection where construction work orders are stored.
  // Let's look for collections related to workOrders.
  // Wait, let's search if there's a collection named 'workOrders' or similar.
  const collections = await db.listCollections();
  console.log("\nAvailable collections in Labor DB:");
  collections.forEach(col => {
    console.log(`- ${col.id}`);
  });

  // Let's check if there is a 'workOrders' or similar in Labor DB
  const woCol = collections.find(c => c.id.toLowerCase().includes('work'));
  if (woCol) {
    const snap = await woCol.limit(5).get();
    console.log(`\nSample docs in "${woCol.id}":`);
    snap.docs.forEach(d => {
      console.log(`- ${d.id}:`, d.data());
    });
  } else {
    // If no work collection, let's search for the ID "LR-2026-0021-ARC" in all collections of Labor DB
    console.log("\nSearching for work order collections...");
  }
}

inspectLaborDb().then(() => laborApp.delete());
