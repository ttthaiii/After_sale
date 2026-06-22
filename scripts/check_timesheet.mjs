import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const [key, ...value] = line.split("=");
    if (key && value) {
      process.env[key.trim().replace(/['"]+/g, '')] = value.join("=").trim().replace(/['"]+/g, '');
    }
  });
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const docPath = "DailyEmployeeTimesheets/200022_2026-05-04";
  console.log("Checking:", docPath);
  const snap = await getDoc(doc(db, docPath));
  if (!snap.exists()) {
    console.log("Document does not exist!");
  } else {
    const data = snap.data();
    console.log("Timesheet Data:", JSON.stringify(data, null, 2));
  }
  process.exit(0);
}
check();
