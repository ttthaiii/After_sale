const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

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

async function migrateStaffToUsers() {
  console.log("🚀 Starting one-time Staff-to-Users Migration...");
  
  try {
    const staffSnap = await afterSaleDb.collection('staff').get();
    console.log(`Found ${staffSnap.size} staff members in After Sale system.`);
    
    for (const docSnap of staffSnap.docs) {
      const data = docSnap.data();
      const oldId = docSnap.id;
      const empId = data.employeeId || data.password || oldId;
      
      console.log(`Processing staff: ${data.name} (ID: ${oldId} -> EmpID: ${empId})`);
      
      // Let's check if the user already exists in the Labor DB
      const laborUserRef = laborDb.collection('users').doc(empId);
      const laborUserSnap = await laborUserRef.get();
      
      let finalData = {};
      
      if (laborUserSnap.exists) {
        const laborUserData = laborUserSnap.data();
        console.log(`User '${empId}' already exists in Labor DB. Merging project locations...`);
        
        // Merge project Location IDs safely without duplicating
        const existingProjects = laborUserData.projectLocationIds || [];
        const afterSaleProjects = data.assignedProjects || [];
        const mergedProjects = Array.from(new Set([...existingProjects, ...afterSaleProjects]));
        
        finalData = {
          projectLocationIds: mergedProjects,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // If password is plain text in After Sale but labor has passwordHash, we don't overwrite passwordHash
        await laborUserRef.set(finalData, { merge: true });
        console.log(`✅ Merged user ${empId} successfully!`);
      } else {
        console.log(`User '${empId}' does not exist in Labor DB. Creating a new user record...`);
        
        // Hash the password using Bcrypt
        const rawPassword = data.password || empId;
        const passwordHash = bcrypt.hashSync(rawPassword, 10);
        
        finalData = {
          employeeId: empId,
          username: (data.username || data.name || empId).toLowerCase().replace(/\s+/g, '.'),
          passwordHash: passwordHash,
          name: data.name || '',
          roleId: data.role === 'Admin' ? 'PE' : 'AM', // PE for Admin, AM for Foreman
          department: data.affiliation || 'WH',
          projectLocationIds: data.assignedProjects || [],
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: '101527',
          startDate: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await laborUserRef.set(finalData);
        console.log(`✅ Created user ${empId} successfully!`);
      }
    }
    
    console.log("🎉 Migration process completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
  }
}

migrateStaffToUsers();
