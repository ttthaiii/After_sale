// inspect-wo.mjs — READ-ONLY: ดัมป์สถานะทั้งหมดของใบงานหนึ่งใบ เพื่อดูว่า field ไหนค้าง
// ไม่เขียนอะไรทั้งสิ้น. ใช้: cd D:\Project_After_sale ; node scripts/inspect-wo.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TARGET_ID = "AS_RPW-2026-WOA-0007";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}
const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

const pick = (o, keys) => keys.reduce((a, k) => { if (o?.[k] !== undefined) a[k] = o[k]; return a; }, {});

async function main() {
  console.log(`\n=== INSPECT ${TARGET_ID} (read-only) ===`);
  const woRef = doc(db, "workOrders", TARGET_ID);
  const woSnap = await getDoc(woRef);
  if (!woSnap.exists()) { console.log("❌ ไม่พบใบงาน"); process.exit(1); }
  const wo = woSnap.data();
  console.log("\n[WO]", JSON.stringify(pick(wo, [
    "status", "deliveryQrToken", "woOwnerId", "inspectionTimeline", "completedAt", "lastUpdate", "isArchived"
  ]), null, 2));

  const catsSnap = await getDocs(collection(db, "workOrders", TARGET_ID, "categories"));
  for (const catDoc of catsSnap.docs) {
    console.log(`\n[CAT ${catDoc.id}]`, JSON.stringify(pick(catDoc.data(), ["status", "currentRevision"])));
    const tSnap = await getDocs(collection(db, "workOrders", TARGET_ID, "categories", catDoc.id, "tasks"));
    for (const tDoc of tSnap.docs) {
      const t = tDoc.data();
      console.log(`  [TASK ${tDoc.id}]`, JSON.stringify(pick(t, [
        "status", "dailyProgress", "progressStatus", "completedAt", "currentRevision"
      ])));
      if (Array.isArray(t.history)) {
        console.log(`     history[${t.history.length}]:`, JSON.stringify(
          t.history.map((h) => pick(h, ["date", "progress", "status", "revisionId"]))
        ));
      }
      // subtasks → revisions → dailyReports / dailyReportsDraft
      const subSnap = await getDocs(collection(tDoc.ref, "subtasks"));
      for (const sDoc of subSnap.docs) {
        console.log(`    [SUBTASK ${sDoc.id}]`, JSON.stringify(pick(sDoc.data(), [
          "status", "dailyProgress", "progressStatus", "completedAt"
        ])));
        const revSnap = await getDocs(collection(sDoc.ref, "revisions"));
        for (const rDoc of revSnap.docs) {
          const reps = await getDocs(collection(rDoc.ref, "dailyReports"));
          const drafts = await getDocs(collection(rDoc.ref, "dailyReportsDraft"));
          console.log(`       [REV ${rDoc.id}] status=${rDoc.data()?.status ?? "-"}`);
          reps.forEach((d) => console.log(`          report  ${d.id}:`, JSON.stringify(pick(d.data(), ["progress", "status", "isRetroactive"]))));
          drafts.forEach((d) => console.log(`          DRAFT   ${d.id}:`, JSON.stringify(pick(d.data(), ["progress", "status"]))));
        }
      }
    }
  }
  console.log("\n✨ เสร็จ (ไม่ได้เขียนอะไร)");
  process.exit(0);
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
