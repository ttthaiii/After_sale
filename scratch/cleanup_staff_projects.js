const admin = require('firebase-admin');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const db = afterSaleApp.firestore();

async function cleanupStaffProjects() {
  try {
    console.log("=== STEP 1: Fetch all valid Project Codes ===");
    const projectsSnap = await db.collection('projects').get();
    const validProjectIds = projectsSnap.docs.map(doc => doc.id); // e.g., ["P001", "P002", "P003", "P004", "P005"]
    const validProjectCodes = projectsSnap.docs.map(doc => doc.data().code); // e.g., ["P001", "P002", "P003", "P004", "P005"]
    
    // Combine both IDs and Codes to be absolutely safe
    const allowedCodes = new Set([...validProjectIds, ...validProjectCodes]);
    console.log("Valid project codes allowed:", Array.from(allowedCodes));

    console.log("\n=== STEP 2: Fetch and Clean up Staff assignedProjects ===");
    const staffSnap = await db.collection('staff').get();
    
    const batch = db.batch();
    let updateCount = 0;

    staffSnap.forEach(docSnap => {
      const data = docSnap.data();
      const currentAssigned = data.assignedProjects || [];
      
      // Filter out any codes that are not in the allowedCodes set
      const cleanAssigned = currentAssigned.filter(code => allowedCodes.has(code));
      
      // Check if there was any change
      const isChanged = (currentAssigned.length !== cleanAssigned.length) || 
                        !currentAssigned.every((val, index) => val === cleanAssigned[index]);

      if (isChanged) {
        console.log(`Updating Staff "${data.name}" (${docSnap.id}):`);
        console.log(`  Before:`, currentAssigned);
        console.log(`  After: `, cleanAssigned);
        
        batch.update(docSnap.ref, {
          assignedProjects: cleanAssigned
        });
        updateCount++;
      }
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log(`\n=== SUCCESS: Cleaned up assignedProjects for ${updateCount} staff! ===`);
    } else {
      console.log("\n=== All staff already have clean assigned projects. ===");
    }
  } catch (error) {
    console.error("Error during staff project cleanup:", error);
  } finally {
    await afterSaleApp.delete();
  }
}

cleanupStaffProjects();
