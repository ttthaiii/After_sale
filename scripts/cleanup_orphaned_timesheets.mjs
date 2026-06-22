/**
 * cleanup_orphaned_timesheets.mjs
 *
 * ตรวจสอบ DailyEmployeeTimesheets ที่ค้างอยู่ในฐานข้อมูล
 * โดยเทียบกับ dailyReport ใน workOrders ที่อาจถูกลบไปแล้ว
 *
 * วิธีใช้:
 *   node scripts/cleanup_orphaned_timesheets.mjs           ← dry-run (แค่รายงาน ไม่ลบ)
 *   node scripts/cleanup_orphaned_timesheets.mjs --delete  ← ลบจริง
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, doc, deleteDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── Load .env ────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const [key, ...value] = line.split("=");
    if (key && value) {
      process.env[key.trim().replace(/['\"]+/g, "")] = value.join("=").trim().replace(/['\"]+/g, "");
    }
  });
}

// ─── Firebase Init ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─── Config ───────────────────────────────────────────────────────────────────
const IS_DRY_RUN = !process.argv.includes("--delete");

// ─── Main ─────────────────────────────────────────────────────────────────────
async function cleanupOrphanedTimesheets() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  🧹 Cleanup Orphaned DailyEmployeeTimesheets");
  console.log(`  Mode: ${IS_DRY_RUN ? "🔍 DRY-RUN (ไม่ลบจริง)" : "🗑️  DELETE (ลบจริง)"}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. อ่าน DailyEmployeeTimesheets ทั้งหมด
  console.log("📂 กำลังอ่าน DailyEmployeeTimesheets...");
  const timesheetsSnap = await getDocs(collection(db, "DailyEmployeeTimesheets"));
  console.log(`   พบทั้งหมด: ${timesheetsSnap.size} records\n`);

  const orphaned   = []; // timesheets ที่ sourceReport ถูกลบไปแล้ว
  const noSource   = []; // timesheets ที่ไม่มี sourceReport field (สร้างจากแหล่งอื่น)
  const valid      = []; // timesheets ที่ยังมี report อยู่

  let checked = 0;

  // 2. เช็คทีละ record
  for (const tsDoc of timesheetsSnap.docs) {
    const data       = tsDoc.data();
    const sourceReport = data.sourceReport;

    checked++;
    process.stdout.write(`\r   กำลังเช็ค: ${checked}/${timesheetsSnap.size}`);

    // ถ้าไม่มี sourceReport → ข้ามไป (ไม่ได้มาจาก syncDailyReport)
    if (!sourceReport) {
      noSource.push({ id: tsDoc.id, data });
      continue;
    }

    // เช็คว่า report ต้นทางยังมีอยู่ไหม
    try {
      const reportSnap = await getDoc(doc(db, sourceReport));
      if (reportSnap.exists()) {
        valid.push({ id: tsDoc.id, sourceReport });
      } else {
        orphaned.push({ id: tsDoc.id, sourceReport, data });
      }
    } catch (err) {
      orphaned.push({ id: tsDoc.id, sourceReport, data, error: err.message });
    }
  }

  console.log("\n");

  // 3. รายงานผล
  console.log("─── ผลการตรวจสอบ ───────────────────────────────────────");
  console.log(`   ✅ ปกติ (report ยังมีอยู่):     ${valid.length} records`);
  console.log(`   ⚠️  ไม่มี sourceReport:          ${noSource.length} records`);
  console.log(`   ❌ Orphaned (report ถูกลบแล้ว): ${orphaned.length} records`);
  console.log("─────────────────────────────────────────────────────────\n");

  if (orphaned.length === 0) {
    console.log("✨ ไม่พบ orphaned timesheets ฐานข้อมูลสะอาดดีอยู่แล้ว!");
    process.exit(0);
  }

  // 4. แสดงรายการ orphaned
  console.log("📋 รายการ Orphaned Timesheets:");
  orphaned.forEach((item, i) => {
    console.log(`   ${i + 1}. [${item.id}]`);
    console.log(`      sourceReport: ${item.sourceReport}`);
    console.log(`      date: ${item.data.date || "-"}  |  employee: ${item.data.employeeNumber || "-"}  |  project: ${item.data.projectLocationId || "-"}`);
    if (item.error) console.log(`      ⚠️ error: ${item.error}`);
  });

  console.log();

  // 5. ลบ (ถ้าไม่ใช่ dry-run)
  if (IS_DRY_RUN) {
    console.log("🔍 DRY-RUN เสร็จแล้ว — ยังไม่มีการลบ");
    console.log("   หากต้องการลบจริง ให้รันคำสั่ง:");
    console.log("   node scripts/cleanup_orphaned_timesheets.mjs --delete\n");
  } else {
    console.log(`🗑️  กำลังลบ ${orphaned.length} orphaned records...`);
    let deleted = 0;
    let failed  = 0;

    for (const item of orphaned) {
      try {
        await deleteDoc(doc(db, "DailyEmployeeTimesheets", item.id));
        console.log(`   ✅ ลบแล้ว: ${item.id}`);
        deleted++;
      } catch (err) {
        console.error(`   ❌ ลบไม่ได้: ${item.id} — ${err.message}`);
        failed++;
      }
    }

    console.log(`\n✨ เสร็จแล้ว — ลบสำเร็จ: ${deleted}  |  ล้มเหลว: ${failed}`);
  }

  process.exit(0);
}

cleanupOrphanedTimesheets().catch(err => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
