const admin = require('firebase-admin');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const db = afterSaleApp.firestore();

async function simulateWoIdGeneration(projectId) {
  console.log(`=== Simulating WO ID Generation for Project: ${projectId} ===`);
  
  // 1. Fetch selected project details
  const prjDoc = await db.collection('projects').doc(projectId).get();
  if (!prjDoc.exists) {
    console.log(`Project ${projectId} not found.`);
    return;
  }
  
  const projectCode = prjDoc.data().projectCode || prjDoc.id;
  const currentYear = new Date().getFullYear();
  console.log(`Project Code: "${projectCode}", Current Year: ${currentYear}`);
  
  // 2. Fetch existing work orders for this project in the After Sale Firestore
  const querySnapshot = await db.collection('workOrders').where('projectId', '==', projectId).get();
  
  let maxSequence = 0;
  console.log(`Analyzing ${querySnapshot.size} existing work orders in collection:`);
  
  querySnapshot.docs.forEach(docSnap => {
    const id = docSnap.id;
    const parts = id.split('-');
    // Check if it matches format: [projectCode]-[Year]-[Sequence]-WO
    if (parts.length === 4 && parts[3] === 'WO') {
      const year = parseInt(parts[1], 10);
      if (year === currentYear) {
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSequence) {
          maxSequence = seq;
        }
      }
    } else {
      console.log(`- Skipping external/non-after-sale ID: "${id}" (Safeguarded)`);
    }
  });
  
  const nextSeq = maxSequence + 1;
  const paddedSeq = String(nextSeq).padStart(4, '0');
  const finalId = `${projectCode}-${currentYear}-${paddedSeq}-WO`;
  
  console.log(`\n>>> GENERATED WO ID: "${finalId}" <<<`);
}

simulateWoIdGeneration('P003').then(() => afterSaleApp.delete());
