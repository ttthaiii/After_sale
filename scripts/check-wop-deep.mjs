import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../serviceAccount.json'), 'utf8'));
let app; try { app = getApp(); } catch { app = initializeApp({ credential: cert(sa), projectId: 'after-sale-system' }); }
const db = getFirestore(app);

async function listAllCollections(docRef, indent = '') {
  const cols = await docRef.listCollections();
  for (const col of cols) {
    const snap = await col.get();
    console.log(`${indent}[${col.id}] (${snap.size} docs)`);
    for (const d of snap.docs) {
      console.log(`${indent}  - ${d.id}`);
      await listAllCollections(d.ref, indent + '    ');
    }
  }
}

async function check() {
  const catRef = db.collection('workOrders').doc('ART-2026-WOP-0001')
                   .collection('categories').doc('ART-WOP-0005-0001');
  const catSnap = await catRef.get();
  const d = catSnap.data();
  console.log('Category fields:', JSON.stringify({
    currentRevision: d.currentRevision,
    currentPhRevision: d.currentPhRevision,
    dailyProgress: d.dailyProgress,
    status: d.status,
    assignedForemanId: d.assignedForemanId
  }, null, 2));
  console.log('\nAll subcollections:');
  await listAllCollections(catRef);
}
check().catch(console.error);
