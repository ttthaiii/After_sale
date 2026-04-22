import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env variables manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const [key, ...value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.join("=").trim();
    }
  });
}

// Firebase config (from .env)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = ["workOrders", "projects", "staff", "contractors", "notifications", "activity_logs"];

async function backup() {
  console.log("🚀 Starting Full Firestore Backup...");
  const fullBackup = {};

  for (const colName of collections) {
    try {
      console.log(`📦 Fetching collection: ${colName}...`);
      const querySnapshot = await getDocs(collection(db, colName));
      fullBackup[colName] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log(`✅ ${colName}: ${fullBackup[colName].length} items`);
    } catch (error) {
      console.error(`❌ Error fetching ${colName}:`, error.message);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `db_backup_${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(fullBackup, null, 2));
  console.log(`\n🎉 Backup completed! File saved as: ${filename}`);
}

backup();
