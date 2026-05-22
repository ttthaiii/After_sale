import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyArRwN9_UpULParyEnxmyf9PXuclBg2zAU",
  authDomain: "after-sale-system.firebaseapp.com",
  projectId: "after-sale-system",
  storageBucket: "after-sale-system.firebasestorage.app",
  messagingSenderId: "378333375127",
  appId: "1:378333375127:web:6481088fe3a4763b3357d2",
  measurementId: "G-NTQ39K5Y60"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Simulated fetch from WorkOrderContext.tsx
const fetchSubcollections = async (woId) => {
  const categoriesSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
  const categories = [];

  const sortedCategoryDocs = [...categoriesSnap.docs].sort((a, b) => a.id.localeCompare(b.id));

  for (const catDoc of sortedCategoryDocs) {
    const catData = catDoc.data();
    const tasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
    const tasks = [];

    const sortedTaskDocs = [...tasksSnap.docs].sort((a, b) => a.id.localeCompare(b.id));

    for (const taskDoc of sortedTaskDocs) {
      const taskData = taskDoc.data();
      const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport'));
      const dailyreports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      
      const taskCode = taskDoc.id;

      tasks.push({ 
        ...taskData, 
        id: taskDoc.id, 
        taskCode,
        dailyreports,
        history: dailyreports
      });
    }
    categories.push({ ...catData, id: catDoc.id, tasks });
  }
  return categories;
};

async function main() {
  const woId = "ART-2026-WOA-0002";
  const woRef = doc(db, 'workOrders', woId);
  const woSnap = await getDoc(woRef);
  
  if (!woSnap.exists()) {
    console.log("Not found");
    return;
  }

  const baseData = woSnap.data();
  const categories = await fetchSubcollections(woId);
  const wo = {
    ...baseData,
    id: woSnap.id,
    categories
  };

  // Simulated SLAMonitor.tsx flattenedTasks logic
  let filteredWOs = [wo].filter(w => w.status !== 'Draft' && w.status !== 'Completed' && !w.isArchived);
  console.log(`Filtered WOs count: ${filteredWOs.length}`);

  const allTasks = filteredWOs.flatMap(w => {
    return (w.categories || []).flatMap(cat =>
      (cat.tasks || []).map(t => {
        const taskCode = t.taskCode || t.id;
        return {
          ...t,
          taskCode,
          woId: w.id,
          woProjectId: w.projectId,
          woLocation: w.locationName,
          woCreatedAt: w.createdAt,
          woAppointmentDate: w.appointmentDate,
          taskStartDate: t.startDate,
          categoryName: cat.name,
        };
      })
    );
  });

  console.log(`allTasks count: ${allTasks.length}`);
  for (const t of allTasks) {
    console.log(`- Task Code: ${t.taskCode}`);
    console.log(`  Status: ${t.status}`);
    console.log(`  Progress: ${t.dailyProgress || 0}`);
  }

  // Column distribution logic
  const columns = [
    { id: 'pending-eval', label: 'งานรอประเมิน' },
    { id: 'assigned-unstarted', label: 'มอบหมายแล้วยังไม่ทำ' },
    { id: 'in-progress', label: 'กำลังทำ' },
    { id: 'for-checking', label: 'รอตรวจสอบ' },
    { id: 'completed', label: 'สำเร็จ' },
  ];

  for (const column of columns) {
    const columnTasks = allTasks.filter(t => {
      let effectiveStatus = t.status;
      const progress = t.dailyProgress || 0;
      
      if (progress >= 100 && effectiveStatus !== 'Completed') {
        effectiveStatus = 'for-checking';
      } else if (progress > 0 && progress < 100 && (effectiveStatus === 'Pending' || effectiveStatus === 'Assigned' || effectiveStatus === 'upcoming')) {
        effectiveStatus = 'in-progress';
      }

      if (column.id === 'pending-eval') return effectiveStatus === 'Pending';
      if (column.id === 'assigned-unstarted') return (effectiveStatus === 'Assigned' || effectiveStatus === 'Approved' || effectiveStatus === 'upcoming') && progress === 0;
      if (column.id === 'in-progress') return effectiveStatus === 'In Progress' || effectiveStatus === 'in-progress';
      if (column.id === 'for-checking') return effectiveStatus === 'for-checking' || effectiveStatus === 'Verified';
      if (column.id === 'completed') return effectiveStatus === 'Completed' || (effectiveStatus === 'Approved' && progress >= 100);
      
      return false;
    });

    console.log(`Column ${column.id} count: ${columnTasks.length}`);
  }
}

main().catch(console.error);
