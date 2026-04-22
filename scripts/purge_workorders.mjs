import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

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

// Firebase config (same as backup script)
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

async function purgeWorkOrders() {
  console.log("🔥 Purging all Work Orders...");
  try {
    const querySnapshot = await getDocs(collection(db, "workOrders"));
    console.log(`🔍 Found ${querySnapshot.size} work orders to delete.`);

    const deletePromises = querySnapshot.docs.map(docSnapshot => {
      console.log(`🗑️ Deleting ${docSnapshot.id}...`);
      return deleteDoc(doc(db, "workOrders", docSnapshot.id));
    });

    await Promise.all(deletePromises);
    console.log("\n✨ All Work Orders have been purged successfully!");
  } catch (error) {
    console.error("❌ Error purging work orders:", error.message);
  }
}

purgeWorkOrders();
