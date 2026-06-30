import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../serviceAccount.json'), 'utf8'));
let app; try { app = getApp(); } catch { app = initializeApp({ credential: cert(sa), projectId: 'after-sale-system' }); }
const db = getFirestore(app);

async function check() {
  const wosSnap = await db.collection('workOrders').where('type', '==', 'PreHandover').get();
  for (const woDoc of wosSnap.docs) {
    const woId = woDoc.id;
    console.log(`\nWO: ${woId}`);
    const catsSnap = await db.collection('workOrders').doc(woId).collection('categories').get();
    for (const catDoc of catsSnap.docs) {
      const catData = catDoc.data();
      console.log(`\n  Category: ${catDoc.id}`);
      console.log(`    currentRevision: ${catData.currentRevision || '(not set)'}`);
      console.log(`    currentPhRevision: ${catData.currentPhRevision || '(not set)'}`);
      console.log(`    dailyProgress: ${catData.dailyProgress}`);
      console.log(`    status: ${catData.status}`);

      // Check all subcollections
      const collections = ['revisions', 'phRevisions', 'tasks', 'phDailyReports', 'dailyReports'];
      for (const col of collections) {
        const snap = await catDoc.ref.collection(col).get();
        if (snap.size > 0) {
          console.log(`\n    [${col}] ${snap.size} doc(s):`);
          for (const d of snap.docs) {
            console.log(`      - ${d.id}: ${JSON.stringify(d.data()).substring(0, 80)}`);
            // Check subcollections of revisions
            if (col === 'revisions' || col === 'phRevisions') {
              for (const sub of ['dailyReports', 'phDailyReports', 'dailyReportsDraft']) {
                const subSnap = await d.ref.collection(sub).get();
                if (subSnap.size > 0) {
                  console.log(`        [${sub}] ${subSnap.size} doc(s):`);
                  subSnap.docs.forEach(sd => console.log(`          - ${sd.id}`));
                }
              }
            }
          }
        }
      }
    }
  }
}
check().catch(console.error);
