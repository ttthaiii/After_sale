// audit-id-remap.mjs — READ-ONLY. Replicates formatCategoriesAndTasks against the
// STORED data to see whether saveEvaluation's recomputed task ids diverge from the
// ids already in Firestore (the divergence = duplication source). No writes.
//
// Run:  node scripts/audit-id-remap.mjs [woId]   (default: ART-2026-WOA-0024)

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../key/after-sale-key.json'), 'utf8'));
let app; try { app = getApp(); } catch { app = initializeApp({ credential: cert(sa), projectId: 'after-sale-system' }); }
const db = getFirestore(app);

const CATEGORIES_LIST = [
  'หมวดงานทั่วไป (General)','งานโครงสร้าง','งานปูนฉาบ/ผิวพื้นผนัง','งานกระเบื้อง/สุขภัณฑ์','งานไฟฟ้า',
  'งานระบบประปา/สุขาภิบาล','งานสี/เคลือบผิว','งานฝ้าเพดาน','งานบานประตู/หน้าต่าง','งานอลูมิเนียม/มุ้งลวด',
  'งานเฟอร์นิเจอร์บิวท์อิน','งานระบบปรับอากาศ (Air)','งานระบบโทรศัพท์/อินเตอร์เน็ต','งานระบบแจ้งเหตุเพลิงใหม่',
  'งานระบบความปลอดภัย','งานพื้น/พื้นไม้ลามิเนต',
];

// EXACT mirror of formatCategoriesAndTasks (WorkOrderContext.tsx:116) — GLOBAL taskCounter.
function formatCategoriesAndTasks(woId, categories) {
  if (!categories || categories.length === 0) return [];
  const isWoaWop = woId.toUpperCase().includes('WOA') || woId.toUpperCase().includes('WOP');
  if (!isWoaWop) return categories;
  const parts = woId.split('-');
  const projectPrefix = parts.length > 0 ? parts[0].toUpperCase() : 'LR';
  const jobCode = parts.length >= 2 ? parts[parts.length - 2].toUpperCase() : 'WOA';
  const woSeq = parts.length >= 1 ? parts[parts.length - 1] : '0001';
  const formattedWoSeq = String(parseInt(woSeq) || 0).padStart(4, '0');
  let taskCounter = 0; // GLOBAL — the suspect
  return categories.map((cat, catIndex) => {
    const catName = (cat.name || '').trim().toLowerCase();
    const listIndex = CATEGORIES_LIST.findIndex(n => n.trim().toLowerCase() === catName);
    const position = listIndex >= 0 ? listIndex + 1 : catIndex + 1;
    const formattedPosition = String(position).padStart(4, '0');
    const computedCatId = `${projectPrefix}-${jobCode}-${formattedPosition}-${formattedWoSeq}`;
    const tasks = (cat.tasks || []).map((task) => {
      taskCounter++;
      const taskSeq = String(taskCounter).padStart(4, '0');
      return { ...task, newId: `${projectPrefix}-${jobCode}-${formattedPosition}-${formattedWoSeq}-${taskSeq}` };
    });
    return { ...cat, newCatId: computedCatId, tasks };
  });
}

async function main() {
  const woId = process.argv[2] || 'ART-2026-WOA-0024';
  const woRef = db.collection('workOrders').doc(woId);
  const catsSnap = await woRef.collection('categories').get(); // getDocs order = doc-id ascending
  // Build categories array exactly as stored (name + tasks with their stored ids)
  const categories = [];
  for (const cat of catsSnap.docs) {
    const tSnap = await cat.ref.collection('tasks').get();
    categories.push({
      id: cat.id,
      name: cat.data().catName ?? cat.data().name ?? '',
      tasks: tSnap.docs.map(d => ({ id: d.id, name: d.data().taskName ?? d.data().name ?? '', status: d.data().status })),
    });
  }

  console.log(`WO ${woId} — stored id  vs  recomputed id (formatCategoriesAndTasks, global counter)\n`);
  const formatted = formatCategoriesAndTasks(woId, categories);
  const storedIds = new Set();
  const newIds = new Set();
  for (const cat of formatted) {
    console.log(`category "${cat.name}"  (stored catDoc ${cat.id}  vs  recomputed ${cat.newCatId}${cat.id === cat.newCatId ? '' : '  <-- CAT ID DIFFERS'})`);
    for (const t of cat.tasks) {
      storedIds.add(t.id); newIds.add(t.newId);
      const flag = t.id === t.newId ? 'same' : '<-- REMAPPED';
      console.log(`   [${t.status}]  ${t.id}   ->   ${t.newId}   ${flag}`);
    }
  }
  const willKeep = [...storedIds].filter(id => !newIds.has(id)); // cleanup keeps input ids; write adds newIds
  console.log(`\nstored task ids : ${storedIds.size}`);
  console.log(`recomputed ids  : ${newIds.size}`);
  console.log(`ids that DIVERGE (old kept + new written = DUPLICATE): ${willKeep.length}`);
  if (willKeep.length) console.log('  leftover-old-docs after a save: ' + willKeep.join(', '));
}

main().catch(e => { console.error('failed:', e); process.exit(1); });
