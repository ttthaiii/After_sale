const admin = require('firebase-admin');

// Initialize After Sale Database App
const afterSaleServiceAccount = require('c:\\Users\\101485\\Downloads\\after-sale-system.json');
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(afterSaleServiceAccount)
}, 'afterSaleApp');

const db = afterSaleApp.firestore();

const EXTERNAL_WOS = [
  {
    id: 'LR-2026-0016-STR',
    projectId: 'P003',
    workOrderCode: 'STR',
    workOrderName: 'งานโครงสร้าง'
  },
  {
    id: 'LR-2026-0017-ARC',
    projectId: 'P003',
    workOrderCode: 'ARC',
    workOrderName: 'งานสถาปัตยกรรม'
  },
  {
    id: 'LR-2026-0018-LA',
    projectId: 'P003',
    workOrderCode: 'LA',
    workOrderName: 'โครงสร้างภูมิสถาปัตย์'
  },
  {
    id: 'LR-2026-0019-SSS',
    projectId: 'P003',
    workOrderCode: 'SSS',
    workOrderName: 'ทดสอบ'
  },
  {
    id: 'LR-2026-0020-TEST',
    projectId: 'P003',
    workOrderCode: 'TEST',
    workOrderName: 'ลองของ'
  },
  {
    id: 'LR-2026-0021-ARC',
    projectId: 'P003',
    workOrderCode: 'ARC',
    workOrderName: 'งานสถาปัตยกรรม'
  },
  {
    id: 'WH-2026-0004-PD',
    projectId: 'P002',
    workOrderCode: 'PD',
    workOrderName: 'งานผลิต'
  },
  {
    id: 'WH-2026-0006-DEL',
    projectId: 'P002',
    workOrderCode: 'DEL',
    workOrderName: 'Delivery'
  },
  {
    id: 'Test-2026-0001-TEST',
    projectId: 'P005',
    workOrderCode: 'TEST',
    workOrderName: 'test'
  }
];

async function restoreWos() {
  console.log("=== Restoring External Work Orders ===");
  const batch = db.batch();
  
  const now = admin.firestore.Timestamp.now();
  
  for (const wo of EXTERNAL_WOS) {
    const docRef = db.collection('workOrders').doc(wo.id);
    batch.set(docRef, {
      projectId: wo.projectId,
      workOrderCode: wo.workOrderCode,
      workOrderId: wo.id,
      workOrderName: wo.workOrderName,
      updatedAt: now
    });
    console.log(`Prepared restoration for: ${wo.id}`);
  }
  
  await batch.commit();
  console.log("=== SUCCESS: Recreated all external work orders! ===");
}

restoreWos().then(() => afterSaleApp.delete());
