const admin = require('firebase-admin');

// Initialize After Sale database connection
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\after-sale-system.json'))
}, 'afterSale');

// Initialize Labor database connection
const laborApp = admin.initializeApp({
  credential: admin.credential.cert(require('c:\\Users\\101485\\Downloads\\labor-management-system.json'))
}, 'labor');

const afterSaleDb = afterSaleApp.firestore();
const laborDb = laborApp.firestore();

// Known 11 After Sale staff IDs
const afterSaleStaffIds = new Set([
  '101485', '101527', '101622', '123456', 
  'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008'
]);

async function syncUsers() {
  console.log("🚀 Starting one-time initialization of 'users' in After Sale database...");
  
  try {
    // 1. Fetch all users from Labor Database
    console.log("Fetching users from Labor Database...");
    const laborUsersSnap = await laborDb.collection('users').get();
    console.log(`Found ${laborUsersSnap.size} users in Labor DB.`);
    
    // 2. Clear current users in After Sale to ensure absolute consistency
    console.log("Clearing existing 'users' in After Sale DB...");
    const oldUsersSnap = await afterSaleDb.collection('users').get();
    const deleteBatch = afterSaleDb.batch();
    oldUsersSnap.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log("Old users cleared.");
    
    // 3. Write each user to After Sale DB, adding systemCode: "AS" for our staff
    const writeBatch = afterSaleDb.batch();
    let writeCount = 0;
    
    for (const docSnap of laborUsersSnap.docs) {
      const userData = docSnap.data();
      const userId = docSnap.id;
      
      const newUserData = { ...userData };
      
      // If they are in our 11 staff list, or if department is WH, tag them with AS!
      if (afterSaleStaffIds.has(userId) || userData.department === 'WH') {
        newUserData.systemCode = 'AS';
        
        // Also ensure they have the WH department
        newUserData.department = 'WH';
        
        // Ensure their roles align correctly to AM/FM
        if (userId === '101485' || userId === '100051') {
          newUserData.roleId = 'AM'; // AM = Admin in Labor System
        } else if (userId === '101527') {
          newUserData.roleId = 'FM'; // FM = Foreman in Labor System
        } else if (!newUserData.roleId) {
          newUserData.roleId = 'FM';
        }
        
        // Also tag/update them back in the Labor DB so they have systemCode: "AS" there too!
        await laborDb.collection('users').doc(userId).set({
          systemCode: 'AS',
          department: 'WH',
          roleId: newUserData.roleId
        }, { merge: true });
        
        console.log(`Tagged user ${userId} (${userData.name}) with systemCode: 'AS' in Labor DB.`);
      }
      
      const newRef = afterSaleDb.collection('users').doc(userId);
      writeBatch.set(newRef, newUserData);
      writeCount++;
    }
    
    await writeBatch.commit();
    console.log(`✅ Successfully initialized ${writeCount} users in After Sale database!`);
    
  } catch (error) {
    console.error("❌ Sync failed with error:", error);
  } finally {
    // Clean up connections
    await afterSaleApp.delete();
    await laborApp.delete();
  }
}

syncUsers();
