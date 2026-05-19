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

async function syncAfterSaleToLabor() {
  console.log("🚀 Starting synchronization from After Sale DB to Labor DB...");
  
  try {
    // 1. Fetch users from After Sale DB with systemCode == 'AS'
    const afterSaleUsersSnap = await afterSaleDb.collection('users')
      .where('systemCode', '==', 'AS')
      .get();
      
    console.log(`Found ${afterSaleUsersSnap.size} After Sale tagged users to sync.`);
    
    for (const docSnap of afterSaleUsersSnap.docs) {
      const userData = docSnap.data();
      const userId = docSnap.id;
      
      console.log(`Syncing user ${userId} (${userData.name})...`);
      
      // Merge updates into Labor DB securely (protecting existing native fields)
      const isNativeLaborUser = userId === '100051' || userId === '101510';
      
      const updatePayload = {
        employeeId: userData.employeeId || userId,
        name: userData.name || '',
        username: userData.username || '',
        passwordHash: userData.passwordHash || '',
        roleId: userData.roleId || 'FM',
        department: userData.department || 'WH',
        projectLocationIds: userData.projectLocationIds || [],
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (!isNativeLaborUser) {
        updatePayload.systemCode = 'AS'; // Only tag users created by After Sale (e.g. S-prefix) in the Labor DB
      }
      
      await laborDb.collection('users').doc(userId).set(updatePayload, { merge: true });
      
      console.log(`✅ Synced user ${userId} to Labor DB successfully.`);
    }
    
    console.log("🎉 Sync back completed successfully!");
    
  } catch (error) {
    console.error("❌ Sync back failed with error:", error);
  } finally {
    await afterSaleApp.delete();
    await laborApp.delete();
  }
}

syncAfterSaleToLabor();
