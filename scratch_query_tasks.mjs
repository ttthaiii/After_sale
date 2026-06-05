import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env variables manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "./.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const [key, ...value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.join("=").trim();
    }
  });
}

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

async function inspectTasks() {
  console.log("🔍 Fetching Work Orders and Tasks...");
  try {
    const woSnap = await getDocs(collection(db, "workOrders"));
    console.log(`Found ${woSnap.size} Work Orders.`);
    
    for (const woDoc of woSnap.docs) {
      const woData = woDoc.data();
      const woId = woDoc.id;
      
      // Let's filter to active ones or recent ones to avoid too much log
      if (woData.status === "Draft" || woData.status === "Cancelled") continue;
      
      console.log(`\n=========================================`);
      console.log(`Work Order: ${woId} | Status: ${woData.status} | Owner: ${woData.woOwnerId}`);
      
      const catSnap = await getDocs(collection(db, "workOrders", woId, "categories"));
      for (const catDoc of catSnap.docs) {
        const catData = catDoc.data();
        const catId = catDoc.id;
        
        const taskSnap = await getDocs(collection(db, "workOrders", woId, "categories", catId, "tasks"));
        for (const taskDoc of taskSnap.docs) {
          const taskData = taskDoc.data();
          const taskId = taskDoc.id;
          
          console.log(`  👉 Task: ${taskId} | Name: ${taskData.name} | Status: ${taskData.status}`);
          console.log(`     subtaskOperatorId: ${taskData.subtaskOperatorId}`);
          console.log(`     responsibleStaffIds: ${JSON.stringify(taskData.responsibleStaffIds)}`);
          console.log(`     evaluationStatus: ${taskData.evaluationStatus}`);
          
          // Let's also check if subtasks subcollection exists and print its contents
          const subtaskSnap = await getDocs(collection(db, "workOrders", woId, "categories", catId, "tasks", taskId, "subtasks"));
          for (const subtaskDoc of subtaskSnap.docs) {
            const subtaskData = subtaskDoc.data();
            console.log(`     └─ Subtask: ${subtaskDoc.id} | Status: ${subtaskData.status}`);
            console.log(`        subtaskOperatorId: ${subtaskData.subtaskOperatorId}`);
            console.log(`        currentRevision: ${subtaskData.currentRevision}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error inspecting tasks:", error);
  }
}

inspectTasks();
