import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../serviceAccount.json'), 'utf8'));
let app; try { app = getApp(); } catch { app = initializeApp({ credential: cert(sa), projectId: 'after-sale-system' }); }
const db = getFirestore(app);

const WO_ID  = 'ART-2026-WOP-0001';
const CAT_ID = 'ART-WOP-0005-0001';

async function check() {
  // Search all collection-group names that might hold daily reports
  const names = ['dailyReports', 'phDailyReports', 'dailyreport', 'dailyReport'];
  for (const name of names) {
    const snap = await db.collectionGroup(name).get();
    const wopDocs = snap.docs.filter(d => d.ref.path.includes(WO_ID));
    if (wopDocs.length > 0) {
      console.log(`\n✅ [collectionGroup: ${name}] found ${wopDocs.length} docs under WOP WO:`);
      wopDocs.forEach(d => console.log(`  ${d.ref.path}`));
    } else {
      console.log(`❌ [collectionGroup: ${name}] — 0 docs under WOP WO`);
    }
  }
  // Also check full category doc
  const catSnap = await db.doc(`workOrders/${WO_ID}/categories/${CAT_ID}`).get();
  console.log('\nCategory doc full data:');
  console.log(JSON.stringify(catSnap.data(), null, 2));
}
check().catch(console.error);
