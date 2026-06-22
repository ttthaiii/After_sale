/**
 * fix_mismatched_shift_photos.mjs
 *
 * แก้ไขข้อมูล DailyEmployeeTimesheets ที่มีรูป laborByShift ผิดพลาด
 * (รูป OT shift ถูก sync ให้พนักงานที่ไม่ได้ทำ shift นั้น)
 *
 * สาเหตุ: Bug ใน syncDailyReport ที่ไม่ได้เช็ค shifts[s] ก่อน sync รูป OT
 *
 * วิธีใช้:
 *   node scripts/fix_mismatched_shift_photos.mjs           ← dry-run (แค่รายงาน ไม่แก้ไข)
 *   node scripts/fix_mismatched_shift_photos.mjs --fix     ← แก้ไขจริง
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── Load .env ────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value) {
      process.env[key.trim().replace(/['"]+/g, "")] = value
        .join("=")
        .trim()
        .replace(/['"]+/g, "");
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
const db = getFirestore(app);

// ─── Config ───────────────────────────────────────────────────────────────────
const IS_DRY_RUN = !process.argv.includes("--fix");
const OT_SHIFTS = ["otMorning", "otNoon", "otEvening"];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function fixMismatchedShiftPhotos() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  🔧 Fix Mismatched Shift Photos in DailyEmployeeTimesheets");
  console.log(`  Mode: ${IS_DRY_RUN ? "🔍 DRY-RUN (แค่รายงาน ไม่แก้ไข)" : "✏️  FIX (แก้ไขจริง)"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log("📂 กำลังอ่าน DailyEmployeeTimesheets...");
  const timesheetsSnap = await getDocs(collection(db, "DailyEmployeeTimesheets"));
  console.log(`   พบทั้งหมด: ${timesheetsSnap.size} records\n`);

  const toFix = [];    // records ที่มีรูปผิด
  const clean = [];    // records ที่ OK

  let checked = 0;

  for (const tsDoc of timesheetsSnap.docs) {
    const data = tsDoc.data();
    checked++;
    process.stdout.write(`\r   กำลังตรวจ: ${checked}/${timesheetsSnap.size}`);

    const expectedShifts = data.expectedShifts || {};
    const laborByShift = data.photos?.laborByShift || {};

    // ตรวจว่ามี OT photo ที่ไม่ควรมีหรือเปล่า
    const badShifts = [];

    for (const shift of OT_SHIFTS) {
      const hasPhoto = laborByShift[shift] && Object.keys(laborByShift[shift]).length > 0;
      const shouldWork = !!expectedShifts[shift];

      if (hasPhoto && !shouldWork) {
        badShifts.push(shift);
      }
    }

    // ตรวจ regular photo ด้วย
    const hasRegularPhoto =
      laborByShift.regular && Object.keys(laborByShift.regular).length > 0;
    const shouldWorkNormal = !!expectedShifts.normal;
    if (hasRegularPhoto && !shouldWorkNormal) {
      badShifts.push("regular");
    }

    if (badShifts.length > 0) {
      toFix.push({
        id: tsDoc.id,
        data,
        badShifts,
      });
    } else {
      clean.push(tsDoc.id);
    }
  }

  console.log("\n");

  // ─── รายงานผล ───────────────────────────────────────────────────────────────
  console.log("─── ผลการตรวจสอบ ─────────────────────────────────────────────");
  console.log(`   ✅ ปกติ (ไม่มีรูปผิด):      ${clean.length} records`);
  console.log(`   ❌ มีรูป shift ผิด:          ${toFix.length} records`);
  console.log("──────────────────────────────────────────────────────────────\n");

  if (toFix.length === 0) {
    console.log("✨ ไม่พบข้อมูลผิดพลาด ฐานข้อมูลสะอาดดีอยู่แล้ว!");
    process.exit(0);
  }

  // ─── แสดงรายละเอียด ─────────────────────────────────────────────────────────
  console.log("📋 รายการที่ต้องแก้ไข:");
  toFix.forEach((item, i) => {
    const d = item.data;
    console.log(`\n   ${i + 1}. [${item.id}]`);
    console.log(`      employee: ${d.employeeNumber || "-"}  |  date: ${d.date || "-"}  |  project: ${d.projectLocationId || "-"}`);
    console.log(`      expectedShifts: ${JSON.stringify(d.expectedShifts || {})}`);
    console.log(`      รูปที่ผิด: [${item.badShifts.join(", ")}]`);
  });

  console.log();

  // ─── แก้ไขจริง ──────────────────────────────────────────────────────────────
  if (IS_DRY_RUN) {
    console.log("🔍 DRY-RUN เสร็จแล้ว — ยังไม่มีการแก้ไข");
    console.log("   หากต้องการแก้ไขจริง ให้รันคำสั่ง:");
    console.log("   node scripts/fix_mismatched_shift_photos.mjs --fix\n");
  } else {
    console.log(`✏️  กำลังแก้ไข ${toFix.length} records...`);
    let fixed = 0;
    let failed = 0;

    for (const item of toFix) {
      try {
        // สร้าง update object โดยลบเฉพาะ field ที่ผิด
        const updateData = {};
        for (const shift of item.badShifts) {
          // ใช้ dot notation ลบ nested field ใต้ photos.laborByShift
          updateData[`photos.laborByShift.${shift}`] = deleteField();
        }

        await updateDoc(doc(db, "DailyEmployeeTimesheets", item.id), updateData);
        console.log(`   ✅ แก้แล้ว: ${item.id}  (ลบรูป: [${item.badShifts.join(", ")}])`);
        fixed++;
      } catch (err) {
        console.error(`   ❌ แก้ไม่ได้: ${item.id} — ${err.message}`);
        failed++;
      }
    }

    console.log(`\n✨ เสร็จแล้ว — แก้สำเร็จ: ${fixed}  |  ล้มเหลว: ${failed}`);
  }

  process.exit(0);
}

fixMismatchedShiftPhotos().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
