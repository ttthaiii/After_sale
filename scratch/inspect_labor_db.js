const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('c:\\Users\\101485\\Downloads\\labor-management-system.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectDatabase() {
  console.log("Connecting to Firestore database for project:", serviceAccount.project_id);
  
  try {
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} collections.`);
    
    const schema = {};
    
    for (const collection of collections) {
      const colId = collection.id;
      console.log(`Inspecting collection: ${colId}...`);
      
      const snapshot = await collection.limit(3).get();
      schema[colId] = {
        documentCountSample: snapshot.size,
        fields: {}
      };
      
      snapshot.forEach(doc => {
        const data = doc.data();
        Object.entries(data).forEach(([key, value]) => {
          let finalType = typeof value;
          if (value === null) {
            finalType = 'null';
          } else if (Array.isArray(value)) {
            finalType = 'array';
          } else if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'DocumentReference') {
            finalType = 'reference';
          } else if (typeof value === 'object') {
            finalType = 'object';
          }
          
          if (!schema[colId].fields[key]) {
            schema[colId].fields[key] = new Set();
          }
          schema[colId].fields[key].add(finalType);
        });
      });
      
      // Convert sets to arrays for JSON stringify
      const formattedFields = {};
      Object.entries(schema[colId].fields).forEach(([key, typeSet]) => {
        formattedFields[key] = Array.from(typeSet);
      });
      schema[colId].fields = formattedFields;
      
      // Add sample data from the first document
      if (!snapshot.empty) {
        schema[colId].sample = snapshot.docs[0].data();
      }
    }
    
    const outputPath = path.join(__dirname, 'labor_db_schema.json');
    fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2), 'utf8');
    console.log("Schema inspection completed successfully! Output saved to:", outputPath);
    
  } catch (error) {
    console.error("Error during database inspection:", error);
  }
}

inspectDatabase();
