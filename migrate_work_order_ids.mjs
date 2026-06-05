import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyArRwN9_UpULParyEnxmyf9PXuclBg2zAU",
  authDomain: "after-sale-system.firebaseapp.com",
  projectId: "after-sale-system",
  storageBucket: "after-sale-system.firebasestorage.app",
  messagingSenderId: "378333375127",
  appId: "1:378333375127:web:6481088fe3a4763b3357d2"
};

const CATEGORIES_LIST = [
    'หมวดงานทั่วไป (General)',
    'งานโครงสร้าง',
    'งานปูนฉาบ/ผิวพื้นผนัง',
    'งานกระเบื้อง/สุขภัณฑ์',
    'งานไฟฟ้า',
    'งานระบบประปา/สุขาภิบาล',
    'งานสี/เคลือบผิว',
    'งานฝ้าเพดาน',
    'งานบานประตู/หน้าต่าง',
    'งานอลูมิเนียม/มุ้งลวด',
    'งานเฟอร์นิเจอร์บิวท์อิน',
    'งานระบบปรับอากาศ (Air)',
    'งานระบบโทรศัพท์/อินเตอร์เน็ต',
    'งานระบบแจ้งเหตุเพลิงใหม่',
    'งานระบบความปลอดภัย',
    'งานพื้น/พื้นไม้ลามิเนต',
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runMigration() {
  console.log('--- STARTING FIRESTORE WORK ORDER ID MIGRATION ---');

  const woSnap = await getDocs(collection(db, 'workOrders'));
  console.log(`Found ${woSnap.size} total work orders in database.`);

  for (const woDoc of woSnap.docs) {
    const woId = woDoc.id;
    const woData = woDoc.data();

    // Guard: only migrate WOA/WOP
    const parts = woId.split('-');
    const jobCode = parts.length >= 2 ? parts[parts.length - 2].toUpperCase() : 'WOA';
    const woSeq = parts.length >= 1 ? parts[parts.length - 1] : '0001';
    const isWoaWop = jobCode.includes('WOA') || jobCode.includes('WOP');

    if (!isWoaWop) {
      console.log(`Skipping legacy/non-WOA-WOP Work Order: ${woId}`);
      continue;
    }

    console.log(`\nMigrating Work Order: ${woId} (jobCode: ${jobCode}, woSeq: ${woSeq})...`);

    const formattedWoSeq = String(parseInt(woSeq) || 0).padStart(4, '0');

    // Read all old categories
    const oldCategoriesSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
    console.log(`  Found ${oldCategoriesSnap.size} categories under ${woId}`);

    // We will keep a taskCounter scoped to the Work Order (project-wide/wo-wide)
    let taskCounter = 0;

    for (const catDoc of oldCategoriesSnap.docs) {
      const oldCatId = catDoc.id;
      const catData = catDoc.data();

      // Determine CategorySeq (position)
      let position = 1;
      const match = oldCatId.match(/\d+$/);
      if (match) {
        position = parseInt(match[0]);
      } else {
        const catName = (catData.name || catData.catName || '').trim().toLowerCase();
        const listIndex = CATEGORIES_LIST.findIndex(n => n.trim().toLowerCase() === catName);
        if (listIndex >= 0) {
          position = listIndex + 1;
        }
      }
      const formattedPosition = String(position).padStart(4, '0');
      const newCatId = `LR-${jobCode}-${formattedPosition}-${formattedWoSeq}`;

      console.log(`  -> Category: ${oldCatId} => ${newCatId}`);

      // Read tasks for this category
      const oldTasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', oldCatId, 'tasks'));
      console.log(`    Found ${oldTasksSnap.size} tasks under category ${oldCatId}`);

      // Sort tasks by old ID to preserve order
      const sortedTaskDocs = [...oldTasksSnap.docs].sort((a, b) => a.id.localeCompare(b.id));

      for (const taskDoc of sortedTaskDocs) {
        const oldTaskId = taskDoc.id;
        const taskData = taskDoc.data();

        taskCounter++;
        const taskSeq = String(taskCounter).padStart(4, '0');
        const newTaskId = `LR-${jobCode}-${formattedPosition}-${formattedWoSeq}-${taskSeq}`;
        const newSubtaskId = `${jobCode}-${formattedPosition}-${formattedWoSeq}-${taskSeq}-0001`;

        console.log(`    -> Task: ${oldTaskId} => ${newTaskId}`);

        // Read subtasks
        const oldSubtasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', oldCatId, 'tasks', oldTaskId, 'subtasks'));
        
        // Write new Task document
        const newTaskRef = doc(db, 'workOrders', woId, 'categories', newCatId, 'tasks', newTaskId);
        const newTaskData = {
          ...taskData,
          id: newTaskId,
          taskId: newTaskId,
          taskCode: newTaskId,
          categoryId: newCatId,
          subtaskId: newSubtaskId
        };
        await setDoc(newTaskRef, newTaskData);

        for (const subtaskDoc of oldSubtasksSnap.docs) {
          const oldSubtaskId = subtaskDoc.id;
          const subtaskData = subtaskDoc.data();

          console.log(`      -> Subtask: ${oldSubtaskId} => ${newSubtaskId}`);

          // Read revisions
          const oldRevisionsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', oldCatId, 'tasks', oldTaskId, 'subtasks', oldSubtaskId, 'revisions'));

          // Write new Subtask document
          const newSubtaskRef = doc(db, 'workOrders', woId, 'categories', newCatId, 'tasks', newTaskId, 'subtasks', newSubtaskId);
          const newSubtaskData = {
            ...subtaskData,
            subtaskId: newSubtaskId
          };
          await setDoc(newSubtaskRef, newSubtaskData);

          for (const revDoc of oldRevisionsSnap.docs) {
            const revId = revDoc.id;
            const revData = revDoc.data();

            // Read daily reports
            const oldReportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', oldCatId, 'tasks', oldTaskId, 'subtasks', oldSubtaskId, 'revisions', revId, 'dailyReports'));

            // Write new Revision document
            const newRevisionRef = doc(db, 'workOrders', woId, 'categories', newCatId, 'tasks', newTaskId, 'subtasks', newSubtaskId, 'revisions', revId);
            await setDoc(newRevisionRef, revData);

            for (const reportDoc of oldReportsSnap.docs) {
              const reportId = reportDoc.id;
              const reportData = reportDoc.data();

              // Write new Daily Report document
              const newReportRef = doc(db, 'workOrders', woId, 'categories', newCatId, 'tasks', newTaskId, 'subtasks', newSubtaskId, 'revisions', revId, 'dailyReports', reportId);
              await setDoc(newReportRef, reportData);

              // Delete old Daily Report
              await deleteDoc(doc(db, 'workOrders', woId, 'categories', oldCatId, 'tasks', oldTaskId, 'subtasks', oldSubtaskId, 'revisions', revId, 'dailyReports', reportId));
            }

            // Delete old Revision
            await deleteDoc(doc(db, 'workOrders', woId, 'categories', oldCatId, 'tasks', oldTaskId, 'subtasks', oldSubtaskId, 'revisions', revId));
          }

          // Delete old Subtask
          await deleteDoc(doc(db, 'workOrders', woId, 'categories', oldCatId, 'tasks', oldTaskId, 'subtasks', oldSubtaskId));
        }

        // Write new Category document (if not written yet or to update it)
        const newCatRef = doc(db, 'workOrders', woId, 'categories', newCatId);
        await setDoc(newCatRef, {
          ...catData,
          id: newCatId,
          catId: newCatId,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Delete old Task
        await deleteDoc(doc(db, 'workOrders', woId, 'categories', oldCatId, 'tasks', oldTaskId));
      }

      // Delete old Category
      await deleteDoc(doc(db, 'workOrders', woId, 'categories', oldCatId));
    }
  }

  console.log('\n--- MIGRATION COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

runMigration().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
