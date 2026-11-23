// rollback-wo-delivery.mjs
// ถอยใบงานที่ "เสีย" จากดราฟ 100% (QR ถูกสร้าง + ลูกค้าประเมิน + rev ปิด) กลับเป็น
// In Progress ที่ progress จริง (confirmed จาก report ที่ไม่ใช่ draft) + progressStatus 'draft'
// (= 75% แบบมีเซฟแบบร่าง). เก็บ snapshot เดิมใน wo.deliveryRollbackSnapshot → กู้ด้วย --restore
//
//   node scripts/rollback-wo-delivery.mjs            → DRY RUN (โชว์ว่าจะเปลี่ยนอะไร ไม่เขียน)
//   node scripts/rollback-wo-delivery.mjs --confirm  → เขียนจริง
//   node scripts/rollback-wo-delivery.mjs --restore  → กู้คืนจาก snapshot

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, setDoc, deleteField } from "firebase/firestore";
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

const CONFIRM = process.argv.includes("--confirm");
const RESTORE = process.argv.includes("--restore");
const now = new Date().toISOString();

// confirmed progress = latest NON-draft dailyReport under the active revision (mirror jobSla.ts)
function confirmedFromReports(reports) {
  const nonDraft = reports
    .filter((r) => r.status !== "draft")
    .sort((a, b) => (b.date || b.id || "").localeCompare(a.date || a.id || ""));
  return nonDraft.length ? (Number(nonDraft[0].progress) || 0) : 0;
}

async function gatherPlan() {
  const woRef = doc(db, "workOrders", TARGET_ID);
  const woSnap = await getDoc(woRef);
  if (!woSnap.exists()) throw new Error("WO not found");
  const wo = woSnap.data();

  const plan = { woRef, wo, tasks: [], subtasks: [], revisions: [] };
  const catsSnap = await getDocs(collection(db, "workOrders", TARGET_ID, "categories"));
  for (const catDoc of catsSnap.docs) {
    const tSnap = await getDocs(collection(catDoc.ref, "tasks"));
    for (const tDoc of tSnap.docs) {
      const t = tDoc.data();
      const curRev = t.currentRevision || "rev00";
      const subSnap = await getDocs(collection(tDoc.ref, "subtasks"));
      // collect reports from the active revision across subtasks
      let reports = [];
      let hasDraft = false;
      for (const sDoc of subSnap.docs) {
        const revRef = doc(sDoc.ref, "revisions", curRev);
        const repsSnap = await getDocs(collection(revRef, "dailyReports"));
        repsSnap.forEach((d) => reports.push({ id: d.id, ...d.data() }));
        const draftsSnap = await getDocs(collection(revRef, "dailyReportsDraft"));
        if (!draftsSnap.empty) hasDraft = true;
      }
      if (reports.some((r) => r.status === "draft")) hasDraft = true;
      const confirmed = confirmedFromReports(reports);
      const targetStatus = confirmed >= 100 ? "For Checking" : "In Progress";
      const targetProgressStatus = hasDraft ? "draft" : "submitted";

      plan.tasks.push({ ref: tDoc.ref, id: tDoc.id, cur: t, curRev, confirmed, targetStatus, targetProgressStatus });
      for (const sDoc of subSnap.docs) {
        plan.subtasks.push({ ref: sDoc.ref, id: sDoc.id, cur: sDoc.data(), confirmed, targetStatus, targetProgressStatus });
        const revRef = doc(sDoc.ref, "revisions", curRev);
        const revSnap = await getDoc(revRef);
        if (revSnap.exists()) plan.revisions.push({ ref: revRef, id: curRev, cur: revSnap.data() });
      }
    }
  }
  return plan;
}

function printPlan(plan) {
  const w = plan.wo;
  console.log(`\n[WO ${TARGET_ID}]`);
  console.log(`  status: ${w.status} → In Progress`);
  console.log(`  deliveryQrToken: ${w.deliveryQrToken ? "(มี) → ลบ" : "(ไม่มี)"}`);
  console.log(`  inspectionTimeline: ${w.inspectionTimeline ? JSON.stringify(w.inspectionTimeline) + " → ล้าง" : "(ไม่มี)"}`);
  console.log(`  completedAt: ${w.completedAt ? w.completedAt + " → ลบ" : "(ไม่มี)"}`);
  for (const t of plan.tasks) {
    console.log(`  [TASK ${t.id}] status:${t.cur.status}→${t.targetStatus} | dailyProgress:${t.cur.dailyProgress}→${t.confirmed} | progressStatus:${t.cur.progressStatus}→${t.targetProgressStatus} | completedAt→ลบ (confirmed=${t.confirmed}, hasDraft=${t.targetProgressStatus === "draft"})`);
  }
  for (const s of plan.subtasks) {
    console.log(`  [SUBTASK ${s.id}] status:${s.cur.status}→${s.targetStatus} | dailyProgress:${s.cur.dailyProgress}→${s.confirmed} | progressStatus:${s.cur.progressStatus}→${s.targetProgressStatus}`);
  }
  for (const r of plan.revisions) {
    console.log(`  [REV ${r.id}] status:${r.cur.status}→active`);
  }
}

async function apply(plan) {
  const w = plan.wo;
  // snapshot เดิม
  const snapshot = {
    at: now,
    by: "rollback-wo-delivery.mjs",
    wo: {
      status: w.status ?? null,
      deliveryQrToken: w.deliveryQrToken ?? null,
      inspectionTimeline: w.inspectionTimeline ?? null,
      completedAt: w.completedAt ?? null,
    },
    tasks: plan.tasks.map((t) => ({ path: t.ref.path, status: t.cur.status ?? null, dailyProgress: t.cur.dailyProgress ?? null, progressStatus: t.cur.progressStatus ?? null, completedAt: t.cur.completedAt ?? null, customerApprovedAt: t.cur.customerApprovedAt ?? null })),
    subtasks: plan.subtasks.map((s) => ({ path: s.ref.path, status: s.cur.status ?? null, dailyProgress: s.cur.dailyProgress ?? null, progressStatus: s.cur.progressStatus ?? null, completedAt: s.cur.completedAt ?? null, customerApprovedAt: s.cur.customerApprovedAt ?? null })),
    revisions: plan.revisions.map((r) => ({ path: r.ref.path, status: r.cur.status ?? null, approvedAt: r.cur.approvedAt ?? null })),
  };

  for (const t of plan.tasks) {
    await updateDoc(t.ref, {
      status: t.targetStatus, dailyProgress: t.confirmed, progressStatus: t.targetProgressStatus,
      completedAt: deleteField(), customerApprovedAt: deleteField(), updatedAt: now,
    });
  }
  for (const s of plan.subtasks) {
    await setDoc(s.ref, {
      status: s.targetStatus, dailyProgress: s.confirmed, progressStatus: s.targetProgressStatus,
      completedAt: deleteField(), customerApprovedAt: deleteField(),
    }, { merge: true });
  }
  for (const r of plan.revisions) {
    await setDoc(r.ref, { status: "active", approvedAt: deleteField(), rejectedAt: deleteField() }, { merge: true });
  }
  await updateDoc(plan.woRef, {
    status: "In Progress",
    deliveryQrToken: deleteField(),
    inspectionTimeline: deleteField(),
    completedAt: deleteField(),
    deliveryRollbackSnapshot: snapshot,
    lastUpdate: now,
  });
  console.log("\n✅ ถอยกลับเรียบร้อย (snapshot เก็บใน wo.deliveryRollbackSnapshot)");
}

async function restore() {
  const woRef = doc(db, "workOrders", TARGET_ID);
  const woSnap = await getDoc(woRef);
  const snap = woSnap.data()?.deliveryRollbackSnapshot;
  if (!snap) { console.log("⏭️ ไม่มี deliveryRollbackSnapshot — กู้ไม่ได้"); return; }
  if (!CONFIRM) { console.log("🔎 DRY RUN restore:", JSON.stringify(snap, null, 2)); return; }
  for (const t of snap.tasks) await setDoc(doc(db, t.path), { status: t.status, dailyProgress: t.dailyProgress, progressStatus: t.progressStatus, completedAt: t.completedAt, customerApprovedAt: t.customerApprovedAt }, { merge: true });
  for (const s of snap.subtasks) await setDoc(doc(db, s.path), { status: s.status, dailyProgress: s.dailyProgress, progressStatus: s.progressStatus, completedAt: s.completedAt, customerApprovedAt: s.customerApprovedAt }, { merge: true });
  for (const r of snap.revisions) await setDoc(doc(db, r.path), { status: r.status, approvedAt: r.approvedAt }, { merge: true });
  await updateDoc(woRef, { status: snap.wo.status, deliveryQrToken: snap.wo.deliveryQrToken, inspectionTimeline: snap.wo.inspectionTimeline, completedAt: snap.wo.completedAt, lastUpdate: now });
  console.log("↩️ กู้คืนจาก snapshot เรียบร้อย");
}

async function main() {
  console.log(`\n=== rollback-wo-delivery.mjs — โหมด: ${RESTORE ? "RESTORE" : CONFIRM ? "WRITE (เขียนจริง)" : "DRY RUN"} ===`);
  console.log(`project: ${process.env.VITE_FIREBASE_PROJECT_ID}`);
  if (RESTORE) { await restore(); console.log("\n✨ เสร็จ"); process.exit(0); }
  const plan = await gatherPlan();
  printPlan(plan);
  if (CONFIRM) await apply(plan);
  else console.log("\n💡 ยังไม่เขียนจริง. เติม --confirm เพื่อถอยกลับ");
  console.log("\n✨ เสร็จ");
  process.exit(0);
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
