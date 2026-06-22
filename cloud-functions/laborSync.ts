import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ----------------------------------------------------------------------
// Helper: คำนวณชั่วโมงจาก "HH:mm - HH:mm"
// ----------------------------------------------------------------------
const calculateHours = (timeString: string, isRegular: boolean): number => {
  if (!timeString) return 0;
  try {
    const parts = timeString.split(' - ');
    if (parts.length !== 2) return 0;
    const [startH, startM] = parts[0].trim().split(':').map(Number);
    const [endH, endM] = parts[1].trim().split(':').map(Number);
    let diff = (endH + endM / 60) - (startH + startM / 60);
    // หักพักกลางวัน 1 ชม. ถ้าเป็นกะปกติและครอบคลุม 12:00-13:00
    if (isRegular && startH <= 12 && endH >= 13) {
      diff -= 1;
    }
    return Math.max(0, diff);
  } catch {
    return 0;
  }
};

// ----------------------------------------------------------------------
// Helper: แปลง Firestore Timestamp หรือ string → "YYYY-MM-DD"
// ----------------------------------------------------------------------
const toDateString = (value: any): string => {
  if (!value) return '';
  // Firestore Timestamp
  if (value?.toDate) {
    return value.toDate().toISOString().split('T')[0];
  }
  // ISO string หรือ date string
  if (typeof value === 'string') {
    return value.split('T')[0];
  }
  return '';
};

// ----------------------------------------------------------------------
// Helper: เช็คว่า laborByShift มีรูป "จริง" ไหม
// (help report ส่ง key ครบทุกกะแต่ value = null → Object.keys ใช้ไม่ได้)
// ----------------------------------------------------------------------
const hasShiftPhotos = (lbs: any): boolean => {
  if (!lbs || typeof lbs !== 'object') return false;
  const reg = lbs.regular;
  const regHas = Array.isArray(reg)
    ? reg.some((u: any) => !!u)
    : !!(reg && (reg.in || reg.out));
  const otHas = ['otMorning', 'otNoon', 'otEvening'].some((s) => {
    const v = lbs[s];
    return !!(v && (v.in || v.out));
  });
  return regHas || otHas;
};
/**
 * HTTP Endpoint: syncDailyReport
 *
 * รับข้อมูล Path ของ Daily Report จากระบบ Labor Management หรือ After-Sale Frontend
 * แล้วทำการ:
 * 1. ดึงข้อมูลจาก Firestore After-Sale DB ตาม Path ที่ระบุ
 * 2. แปลงโครงสร้างข้อมูล (Flatten) แล้วบันทึกลง DailyEmployeeTimesheets
 * 3. ยิง Webhook แจ้ง Labor Management System ให้ทำการ Reconcile
 *
 * Body Parameters:
 * - reportPath: string  — Firestore path เต็มๆ ของ dailyReport document
 *                         เช่น "workOrders/{id}/categories/{id}/tasks/{id}/revisions/{id}/dailyReports/{date}"
 *                         หรือ "workOrders/{id}/categories/{id}/tasks/{id}/help/{id}/dailyReports/{date}"
 * - reportDate: string  — วันที่รายงาน (YYYY-MM-DD)
 */
export const syncDailyReport = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    // รองรับ CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const { reportPath, reportDate } = req.body;
      if (!reportPath || !reportDate) {
        res.status(400).json({
          error: 'Missing required parameters: reportPath, reportDate',
        });
        return;
      }

      // ------------------------------------------------------------------
      // Parse workOrderId, categoryId, taskId จาก reportPath
      // รองรับทุก path รูปแบบ เช่น:
      //   workOrders/{id}/categories/{id}/tasks/{id}/revisions/{id}/dailyReports/{date}
      //   workOrders/{id}/categories/{id}/tasks/{id}/help/{id}/dailyReports/{date}
      // ------------------------------------------------------------------
      // ลบเครื่องหมาย / ที่อยู่หน้าสุดและท้ายสุดออก (ถ้ามี)
      const cleanPath = reportPath.replace(/^\/+|\/+$/g, '');
      const parts = cleanPath.split('/');
      if (
        parts.length < 10 ||
        parts[0] !== 'workOrders' ||
        parts[2] !== 'categories' ||
        parts[4] !== 'tasks'
      ) {
        res.status(400).json({
          error: 'Invalid reportPath format. Expected: workOrders/{id}/categories/{id}/tasks/{id}/.../.../dailyReports/{date}',
        });
        return;
      }

      const workOrderId = parts[1];
      const categoryId = parts[3];
      const taskId = parts[5];

      // ------------------------------------------------------------------
      // 1. ดึงข้อมูล Daily Report จาก After-Sale DB
      // ------------------------------------------------------------------
      const reportSnap = await db.doc(cleanPath).get();

      if (!reportSnap.exists) {
        res.status(404).json({ error: `Report not found at path: ${cleanPath}` });
        return;
      }

      const reportData = reportSnap.data()!;

      // ดึงวันที่จาก reportDate field (Timestamp) หรือใช้ reportDate param
      const activeDate = toDateString(reportData.reportDate) || reportDate;

      // ดึง Project Location จาก workOrder
      const woSnap = await db.collection('workOrders').doc(workOrderId).get();
      const projectLocationId = woSnap.exists
        ? woSnap.data()?.projectLocationId || woSnap.data()?.projectId || workOrderId
        : workOrderId;
      const locationName = woSnap.exists
        ? woSnap.data()?.locationName || projectLocationId
        : projectLocationId;

      // ดึง Task Name
      const taskPath = `workOrders/${workOrderId}/categories/${categoryId}/tasks/${taskId}`;
      const taskSnap = await db.doc(taskPath).get();
      const taskName = taskSnap.exists
        ? taskSnap.data()?.taskName || taskSnap.data()?.name || taskId
        : taskId;

      // ดึง Subtask Name
      const subtaskIdx = parts.indexOf('subtasks');
      let subtaskId = '';
      let subtaskName = '';
      if (subtaskIdx !== -1 && subtaskIdx + 1 < parts.length) {
        subtaskId = parts[subtaskIdx + 1];
        const subtaskPath = `workOrders/${workOrderId}/categories/${categoryId}/tasks/${taskId}/subtasks/${subtaskId}`;
        const subtaskSnap = await db.doc(subtaskPath).get();
        subtaskName = subtaskSnap.exists
          ? subtaskSnap.data()?.subtaskName || subtaskSnap.data()?.name || subtaskId
          : subtaskId;
      }

      const reportPhotos = reportData.photos || {};
      const sitePhotos: string[] = reportPhotos.site || [];
      const laborByShift = reportPhotos.laborByShift || {};
      // ── FIX: help report ไม่มีรูป → ดึง laborByShift จาก site report (revisions) คู่ของมัน ──
      // help/helpNN กับ revisions/revNN เป็นพี่น้องใต้ subtask เดียวกัน เลขผูกกันเสมอ
      // คนงานคลังที่ไปช่วยจะอยู่ในรูปกลุ่มของกะที่ไซต์ถ่ายอยู่แล้ว → ใช้รูปนั้นเป็นหลักฐานได้
      let effectiveLaborByShift = laborByShift;
      const helpIdx = parts.indexOf('help');
      if (helpIdx !== -1 && !hasShiftPhotos(laborByShift)) {
        const siteParts = [...parts];
        siteParts[helpIdx] = 'revisions';
        siteParts[helpIdx + 1] = parts[helpIdx + 1].replace('help', 'rev'); // help02 -> rev02
        const sitePath = siteParts.join('/');
        const siteSnap = await db.doc(sitePath).get();
        if (siteSnap.exists) {
          effectiveLaborByShift = siteSnap.data()?.photos?.laborByShift || {};
          console.log(`[syncDailyReport] help report → ดึงรูปจาก site คู่: ${sitePath}`);
        }
      }
      // ------------------------------------------------------------------
      // 1B. ดึงข้อมูล Assignee จาก Parent Document (ระดับ Task/Help/Revision)
      // ------------------------------------------------------------------
      const parentPath = parts.slice(0, -2).join('/');
      const parentSnap = await db.doc(parentPath).get();
      const parentData = parentSnap.exists ? parentSnap.data() : null;
      const primaryAssignee = parentData?.assignees?.[0]?.employeeId;

      // ลำดับการหา AssigneeID: 1. จากตัวรายงานเอง 2. จากเจ้าของงานใน Task แม่
      const assigneeId = reportData.updatedBy || primaryAssignee || null;

      const batch = db.batch();
      const processedEmployeeIds: string[] = [];

      // ------------------------------------------------------------------
      // 2A. ประมวลผลพนักงานที่ทำงาน (labor array)
      //
      // Schema จริงของแต่ละ entry ใน labor[]:
      // {
      //   employeeId: "200022",
      //   workerId: "DC-200022",
      //   workerName: "...",
      //   shifts: { normal: true, otMorning: false, otNoon: false, otEvening: true },
      //   shiftTimes: { day: "08:00 - 17:00", otEvening: "18:00 - 21:00", ... }
      // }
      // ------------------------------------------------------------------
      const laborEntries: any[] = reportData.labor || [];

      for (const entry of laborEntries) {
        const employeeId = entry.employeeId;
        if (!employeeId) continue;

        const timesheetDocId = `${employeeId}_${activeDate}`;
        const timesheetRef = db.collection('DailyEmployeeTimesheets').doc(timesheetDocId);

        const shifts = entry.shifts || {};
        const shiftTimes = entry.shiftTimes || {};

        // คำนวณชั่วโมงแต่ละกะ
        const normalHours = shifts.normal ? calculateHours(shiftTimes.day || '', true) : 0;
        const otMorningHours = shifts.otMorning ? calculateHours(shiftTimes.otMorning || '', false) : 0;
        const otNoonHours = shifts.otNoon ? calculateHours(shiftTimes.otNoon || '', false) : 0;
        const otEveningHours = shifts.otEvening ? calculateHours(shiftTimes.otEvening || '', false) : 0;

        const timesheet: any = {
          employeeNumber: employeeId,
          date: activeDate,
          projectLocationId: projectLocationId,
          isActive: true,
          status: reportData.status ?? null, // สถานะรายงานต้นทาง (เช่น "draft") — copy มาเก็บไว้ ค่าล่าสุดเขียนทับเสมอเมื่อ sync รอบใหม่
          expectedShifts: {
            normal: shifts.normal || false,
            otMorning: shifts.otMorning || false,
            otNoon: shifts.otNoon || false,
            otEvening: shifts.otEvening || false,
          },
          expectedHours: {
            normal: normalHours,
            otMorning: otMorningHours,
            otNoon: otNoonHours,
            otEvening: otEveningHours,
          },
          shiftTimes: {
            ...(shifts.normal && shiftTimes.day ? { day: shiftTimes.day } : {}),
            ...(shifts.otMorning && shiftTimes.otMorning ? { otMorning: shiftTimes.otMorning } : {}),
            ...(shifts.otNoon && shiftTimes.otNoon ? { otNoon: shiftTimes.otNoon } : {}),
            ...(shifts.otEvening && shiftTimes.otEvening ? { otEvening: shiftTimes.otEvening } : {}),
          },
          workLogs: admin.firestore.FieldValue.arrayUnion({
            taskId,
            taskName,
            ...(subtaskId ? { subtaskId, subtaskName } : {}),
            location: locationName,
          }),
          leaveStatus: null, // ทำงานปกติ ไม่มีการลา
          lastUpdated: new Date().toISOString(),
          sourceReport: cleanPath,
          AssigneesID: assigneeId,
          editHistory: reportData.editHistory || [],
        };

        const photosUpdate: any = {
          labor: admin.firestore.FieldValue.delete(), // ลบฟิลด์รูปแบบเก่าออก
        };
        if (sitePhotos.length > 0) {
          photosUpdate.site = admin.firestore.FieldValue.arrayUnion(...sitePhotos);
        }
        if (Object.keys(effectiveLaborByShift).length > 0) {
          const shiftPhotos: any = {};

          // Handle Regular (Array or Map) — เฉพาะพนักงานที่ทำกะปกติ
          if (shifts.normal && effectiveLaborByShift.regular) {
            const regData = effectiveLaborByShift.regular;
            const regUpdate: any = {};
            if (Array.isArray(regData)) {
              // New structure: Array of 4 indices
              regData.forEach((url, idx) => {
                if (url) regUpdate[idx.toString()] = url;
              });
            } else if (typeof regData === 'object') {
              // Legacy/Map structure: in, out
              if (regData.in) regUpdate.in = regData.in;
              if (regData.out) regUpdate.out = regData.out;
            }
            if (Object.keys(regUpdate).length > 0) {
              shiftPhotos.regular = regUpdate;
            }
          }

          // Handle OT Shifts (Maps: in, out) — เฉพาะพนักงานที่ทำ OT shift นั้น ๆ จริง
          const otShifts = ['otMorning', 'otNoon', 'otEvening'] as const;
          for (const s of otShifts) {
            // ✅ Guard: ข้ามถ้าพนักงานคนนี้ไม่ได้ทำ shift นี้
            if (!shifts[s]) continue;

            const shiftData = effectiveLaborByShift[s];
            if (shiftData && typeof shiftData === 'object' && !Array.isArray(shiftData)) {
              const otUpdate: any = {};
              if (shiftData.in) otUpdate.in = shiftData.in;
              if (shiftData.out) otUpdate.out = shiftData.out;
              if (Object.keys(otUpdate).length > 0) {
                shiftPhotos[s] = otUpdate;
              }
            }
          }

          if (Object.keys(shiftPhotos).length > 0) {
            photosUpdate.laborByShift = shiftPhotos;
          }
        }

        if (Object.keys(photosUpdate).length > 0) {
          timesheet.photos = photosUpdate;
        }

        batch.set(timesheetRef, timesheet, { merge: true });
        processedEmployeeIds.push(employeeId);
      }

      // ------------------------------------------------------------------
      // 2B. ประมวลผลพนักงานที่ลา (leave array)
      //
      // Schema จริงของแต่ละ entry ใน leave[]:
      // {
      //   employeeId: "200030",
      //   workerId: "DC-200030",
      //   workerName: "...",
      //   leaveType: "Paid",
      //   leaveShifts: { morning: true, afternoon: true },
      //   leaveTimes: { morning: "08:00 - 12:00", afternoon: "13:00 - 17:00" }
      // }
      // ------------------------------------------------------------------
      const leaveEntries: any[] = reportData.leave || [];

      for (const entry of leaveEntries) {
        const employeeId = entry.employeeId;
        if (!employeeId) continue;

        const timesheetDocId = `${employeeId}_${activeDate}`;
        const timesheetRef = db.collection('DailyEmployeeTimesheets').doc(timesheetDocId);

        const leaveShifts = entry.leaveShifts || {};
        const isFullDay = !!(leaveShifts.morning && leaveShifts.afternoon);

        const hasWorked = processedEmployeeIds.includes(employeeId);

        let timesheet: any;

        if (hasWorked) {
          // ลาบางส่วน (มีข้อมูลการทำงานด้วย) -> อัปเดตเฉพาะข้อมูลการลา ไม่ให้ไปทับชั่วโมงทำงาน
          timesheet = {
            status: reportData.status ?? null, // copy สถานะรายงานต้นทางไว้ด้วย (กรณีลาบางส่วน)
            leaveStatus: {
              leaveType: entry.isMedCertRejected ? 'Unpaid' : (entry.leaveType || 'Unknown'),
              isFullDay: isFullDay,
              leaveShifts,
              leaveTimes: entry.leaveTimes || {},
              medCertFileUrl: entry.medCertFileUrl || null,
              ...(entry.isMedCertRejected ? { isMedCertRejected: true } : {}),
            },
            lastUpdated: new Date().toISOString(),
            AssigneesID: assigneeId,
            editHistory: reportData.editHistory || [],
          };
        } else {
          // ลาเต็มวัน (ไม่มีข้อมูลใน labor array)
          timesheet = {
            employeeNumber: employeeId,
            date: activeDate,
            projectLocationId: projectLocationId,
            isActive: false, // ลา = ไม่ได้มาทำงาน
            status: reportData.status ?? null, // copy สถานะรายงานต้นทางไว้ด้วย (กรณีลาเต็มวัน)
            expectedShifts: { normal: false, otMorning: false, otNoon: false, otEvening: false },
            expectedHours: { normal: 0, otMorning: 0, otNoon: 0, otEvening: 0 },
            shiftTimes: {},
            workLogs: [],
            leaveStatus: {
              leaveType: entry.isMedCertRejected ? 'Unpaid' : (entry.leaveType || 'Unknown'),
              isFullDay: isFullDay,
              leaveShifts,
              leaveTimes: entry.leaveTimes || {},
              medCertFileUrl: entry.medCertFileUrl || null,
              ...(entry.isMedCertRejected ? { isMedCertRejected: true } : {}),
            },
            lastUpdated: new Date().toISOString(),
            sourceReport: cleanPath,
            AssigneesID: assigneeId,
            editHistory: reportData.editHistory || [],
          };
        }

        batch.set(timesheetRef, timesheet, { merge: true });

        if (!hasWorked) {
          processedEmployeeIds.push(employeeId);
        }
      }

      await batch.commit();
      // ── เมื่อ sync site report เสร็จ → re-sync help report คู่ ให้คนงานคลังรับรูปใหม่ด้วย ──
      const revIdx = parts.indexOf('revisions');
      if (revIdx !== -1) {
        const helpParts = [...parts];
        helpParts[revIdx] = 'help';
        helpParts[revIdx + 1] = parts[revIdx + 1].replace('rev', 'help'); // rev02 -> help02
        const helpPath = helpParts.join('/');
        const helpSnap = await db.doc(helpPath).get();
        if (helpSnap.exists) {
          await fetch('https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportPath: helpPath, reportDate: activeDate }),
          }).catch(err => console.error('[syncDailyReport] re-sync help failed:', err));
        }
      }
      console.log(`[syncDailyReport] Processed ${processedEmployeeIds.length} employees for ${activeDate}`);

      // ------------------------------------------------------------------
      // 3. ยิง Webhook แจ้ง Labor Management ให้ Reconcile
      // ------------------------------------------------------------------
      const webhookUrl =
        process.env.LABOR_WEBHOOK_URL ||
        'https://us-central1-labor-management-system-33b06.cloudfunctions.net/webhookTimesheetChanged';

      const webhookPromises = processedEmployeeIds.map(async (empId) => {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeNumber: empId,
              workDate: activeDate,
              projectLocationId,
            }),
          });
          if (!response.ok) {
            console.error(`[Webhook Error] Employee ${empId}: Status ${response.status}`);
          } else {
            console.log(`[Webhook OK] Employee ${empId} on ${activeDate}`);
          }
        } catch (err) {
          console.error(`[Webhook Exception] Employee ${empId}:`, err);
        }
      });

      await Promise.allSettled(webhookPromises);

      res.status(200).json({
        success: true,
        message: 'Report processed and synced successfully',
        date: activeDate,
        employeesProcessed: processedEmployeeIds.length,
        laborCount: laborEntries.length,
        leaveCount: leaveEntries.length,
      });
    } catch (error: any) {
      console.error('[syncDailyReport] Unexpected error:', error);
      res.status(500).json({ error: error.message });
    }
  });
