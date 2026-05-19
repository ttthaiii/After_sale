const admin = require('firebase-admin');
const path = require('path');

// Initialize Labor Database App
const laborServiceAccount = require('c:\\Users\\101485\\Downloads\\labor-management-system.json');
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(laborServiceAccount)
}, 'laborApp');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const laborDb = laborApp.firestore();
const afterSaleDb = afterSaleApp.firestore();

async function syncProjects() {
  try {
    console.log("=== STEP 1: Clear old simulated projects in After Sale ===");
    const oldProjectsSnap = await afterSaleDb.collection('projects').get();
    console.log(`Found ${oldProjectsSnap.size} old projects to delete.`);
    
    const deleteBatch = afterSaleDb.batch();
    oldProjectsSnap.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log("Old simulated projects cleared successfully.");

    console.log("=== STEP 2: Fetch real projects from Labor Database ===");
    const laborProjectsSnap = await laborDb.collection('Project').get();
    console.log(`Found ${laborProjectsSnap.size} real projects in Labor database.`);

    const writeBatch = afterSaleDb.batch();
    
    // Standard placeholder image for premium look
    const placeholderImage = "https://firebasestorage.googleapis.com/v0/b/after-sale-system.firebasestorage.app/o/master_data%2Fprojectss%2Fprojects_1771927945750.png?alt=media&token=4e47ab64-fc4c-493a-9113-42a580221428";

    laborProjectsSnap.forEach(doc => {
      const data = doc.data();
      const prjId = doc.id; // e.g. "P001"
      
      const newProjectData = {
        id: prjId,
        name: data.projectName || data.name || `โครงการ ${prjId}`,
        code: data.code || data.projectCode || prjId,
        affiliation: data.department || "",
        imageUrl: placeholderImage
      };

      console.log(`Mapping ${prjId} -> ${newProjectData.name} (${newProjectData.code})`);
      const newRef = afterSaleDb.collection('projects').doc(prjId);
      writeBatch.set(newRef, newProjectData);
    });

    await writeBatch.commit();
    console.log("=== SUCCESS: Real projects synchronized successfully! ===");
  } catch (error) {
    console.error("Error synchronizing projects:", error);
  } finally {
    // Terminate apps
    await laborApp.delete();
    await afterSaleApp.delete();
  }
}

syncProjects();
