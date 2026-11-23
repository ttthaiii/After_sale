// hide-workorders.mjs
// ซ่อนใบงานออกจากระบบ = ตั้ง status:'Cancelled' + isArchived:true บน WO และทุก task
// (mirror ของ deleteWorkOrder ใน src/context/WorkOrderContext.tsx) พร้อม snapshot
// สถานะเดิมไว้ใน field cancelledSnapshot เพื่อให้ย้อนกลับได้ด้วย --restore
//
// การใช้งาน (รันจาก root ของโปรเจค, ต้องมีไฟล์ .env ที่มี VITE_FIREBASE_*):
//   node scripts/hide-workorders.mjs            → DRY RUN (แค่แสดงว่าจะทำอะไร ไม่เขียนจริง)
//   node scripts/hide-workorders.mjs --confirm  → เขียนจริง (ซ่อน)
//   node scripts/hide-workorders.mjs --restore  → กู้คืนจาก cancelledSnapshot
//
// แก้รายการใบงานที่ TARGET_IDS ด้านล่างได้ตามต้องการ

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---- ใบงานที่จะซ่อน (= doc id ใน collection workOrders) ----
const TARGET_IDS = [
  "M110-2026-WOA-0001",
  "M110-2026-WOA-0005",
  "M110-2026-WOA-0002",
];

// ---- โหลด .env แบบเดียวกับ scripts อื่น ----
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value.length) process.env[key.trim()] = value.join("=").trim();
  });
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CONFIRM = process.argv.includes("--confirm");
const RESTORE = process.argv.includes("--restore");
const now = new Date().toISOString();

async function loadTasks(woId) {
  // คืน array ของ { catId, taskId, ref, status }
  const out = [];
  const catsSnap = await getDocs(collection(db, "workOrders", woId, "categories"));
  for (const catDoc of catsSnap.docs) {
    const tSnap = await getDocs(collection(db, "workOrders", woId, "categories", catDoc.id, "tasks"));
    for (const tDoc of tSnap.docs) {
      out.push({ catId: catDoc.id, taskId: tDoc.id, ref: tDoc.ref, status: tDoc.data()?.status });
    }
  }
  return out;
}

async function hideOne(woId) {
  const woRef = doc(db, "workOrders", woId);
  const woSnap = await getDoc(woRef);
  if (!woSnap.exists()) {
    console.log(`  ❌ ไม่พบใบงาน "${woId}" (doc id ไม่ตรง) — ข้าม`);
    return { woId, found: false };
  }
  const wo = woSnap.data();
  const tasks = await loadTasks(woId);
  console.log(`  📄 ${woId}`);
  console.log(`     project : ${wo.projectName || "-"}  | location: ${wo.locationName || "-"}`);
  console.log(`     status  : ${wo.status}  | isArchived: ${wo.isArchived === true}  | tasks: ${tasks.length}`);

  if (wo.status === "Cancelled" && wo.isArchived === true) {
    console.log(`     ⏭️  ซ่อนอยู่แล้ว — ข้าม`);
    return { woId, found: true, skipped: true };
  }

  if (!CONFIRM) {
    console.log(`     🔎 DRY RUN: จะตั้ง WO + ${tasks.length} task → status:'Cancelled', WO isArchived:true`);
    return { woId, found: true, dryRun: true };
  }

  // snapshot สถานะเดิมไว้ให้ย้อนกลับได้
  const snapshot = {
    at: now,
    by: "hide-workorders.mjs",
    woStatus: wo.status,
    woIsArchived: wo.isArchived === true,
    tasks: tasks.map((t) => ({ catId: t.catId, taskId: t.taskId, status: t.status })),
  };

  for (const t of tasks) {
    await updateDoc(t.ref, { status: "Cancelled", updatedAt: now });
  }
  await updateDoc(woRef, { status: "Cancelled", isArchived: true, cancelledSnapshot: snapshot, lastUpdate: now });
  console.log(`     ✅ ซ่อนแล้ว (snapshot เก็บใน field cancelledSnapshot)`);
  return { woId, found: true, hidden: true };
}

async function restoreOne(woId) {
  const woRef = doc(db, "workOrders", woId);
  const woSnap = await getDoc(woRef);
  if (!woSnap.exists()) { console.log(`  ❌ ไม่พบ ${woId} — ข้าม`); return; }
  const wo = woSnap.data();
  const snap = wo.cancelledSnapshot;
  if (!snap) { console.log(`  ⏭️  ${woId} ไม่มี cancelledSnapshot — กู้คืนไม่ได้ ข้าม`); return; }
  if (!CONFIRM) {
    console.log(`  🔎 DRY RUN: จะกู้ ${woId} → WO status:'${snap.woStatus}', isArchived:${snap.woIsArchived} + ${snap.tasks.length} task`);
    return;
  }
  for (const t of snap.tasks) {
    const tRef = doc(db, "workOrders", woId, "categories", t.catId, "tasks", t.taskId);
    await updateDoc(tRef, { status: t.status, updatedAt: now });
  }
  await updateDoc(woRef, { status: snap.woStatus, isArchived: snap.woIsArchived, lastUpdate: now });
  console.log(`  ↩️  กู้คืน ${woId} เรียบร้อย`);
}

async function main() {
  const mode = RESTORE ? "RESTORE" : CONFIRM ? "HIDE (เขียนจริง)" : "DRY RUN";
  console.log(`\n=== hide-workorders.mjs — โหมด: ${mode} ===`);
  console.log(`project: ${firebaseConfig.projectId || "(ไม่พบ VITE_FIREBASE_PROJECT_ID ใน .env)"}\n`);
  if (!firebaseConfig.projectId) {
    console.error("❌ ไม่พบค่า Firebase ใน .env — หยุด");
    process.exit(1);
  }
  for (const id of TARGET_IDS) {
    if (RESTORE) await restoreOne(id);
    else await hideOne(id);
  }
  if (!CONFIRM) console.log(`\n💡 ยังไม่ได้เขียนจริง. เติม --confirm เพื่อดำเนินการ`);
  console.log("\n✨ เสร็จ");
  process.exit(0);
}

main().catch((e) => { console.error("❌ error:", e); process.exit(1); });
