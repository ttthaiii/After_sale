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

// ----------------------------------------------------------------------
// Multi-job-per-day support:
// พนักงาน 1 คนอาจมีมากกว่า 1 daily report (คนละ task/subtask) ในวันเดียวกัน
// (เช่น เช้าทำงาน A บ่ายทำงาน B) — เก็บ contribution ของแต่ละงานแยกไว้ใน
// jobSegments ตาม taskId+subtaskId แล้ว "คำนวณผลรวมใหม่จากทั้งหมดทุกครั้ง"
// (ไม่ใช่บวก/ทับค่าเดิมตรงๆ) เพื่อให้ sync ซ้ำ (แก้ไข report เดิม) idempotent
// ----------------------------------------------------------------------
const SHIFT_KEYS = ['normal', 'otMorning', 'otNoon', 'otEvening'] as const;
type ShiftKey = (typeof SHIFT_KEYS)[number];
const shiftTimeField = (key: ShiftKey): string => (key === 'normal' ? 'day' : key);
const shiftPhotoField = (key: ShiftKey): string => (key === 'normal' ? 'regular' : key);

const parseRangeToMinutes = (str: string | undefined): [number, number] | null => {
  if (!str) return null;
  const parts = str.split(' - ');
  if (parts.length !== 2) return null;
  const [sh, sm] = parts[0].trim().split(':').map(Number);
  const [eh, em] = parts[1].trim().split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  return [sh * 60 + sm, eh * 60 + em];
};

const formatMinutes = (m: number): string => {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
};

// เวลาครอบคลุมกว้างสุด (เร็วสุด-ช้าสุด) ของกะเดียวกันข้ามหลายงาน — ใช้แค่โชว์
// ช่วงเข้า-ออกให้ Labor เทียบกับสแกนนิ้ว "ห้าม" เอาไปคำนวณชั่วโมงใหม่ (ต้อง sum
// จาก hours ของแต่ละงานแยกกันเท่านั้น ไม่งั้นช่วงที่หายไปจริงๆกลางวันจะถูกนับเป็นชั่วโมงทำงาน)
const mergeTimeEnvelope = (ranges: string[]): string | undefined => {
  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const r of ranges) {
    const parsed = parseRangeToMinutes(r);
    if (!parsed) continue;
    minStart = Math.min(minStart, parsed[0]);
    maxEnd = Math.max(maxEnd, parsed[1]);
  }
  if (minStart === Infinity) return undefined;
  return `${formatMinutes(minStart)} - ${formatMinutes(maxEnd)}`;
};

const rangesOverlap = (a: [number, number], b: [number, number]): boolean =>
  a[0] < b[1] && b[0] < a[1];

// normalize รูปให้เป็น array เสมอ ไม่ว่า source จะเป็น array (ปัจจุบัน) หรือ
// {in,out}/{in,lunch,afternoon,out} (รูปแบบเก่า)
const toPhotoArray = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(Boolean);
  if (typeof data === 'object') return [data.in, data.lunch, data.afternoon, data.out].filter(Boolean);
  return [];
};

interface JobSegmentEntry {
  taskId: string;
  subtaskId: string | null;
  taskName: string;
  subtaskName: string | null;
  location: string;
  shifts: Record<ShiftKey, boolean>;
  hours: Record<ShiftKey, number>;
  shiftTimes: Partial<Record<'day' | 'otMorning' | 'otNoon' | 'otEvening', string>>;
  photos: Partial<Record<'regular' | 'otMorning' | 'otNoon' | 'otEvening', string[]>>;
  sourceReport: string;
  lastUpdated: string;
}

// คำนวณ expectedHours/expectedShifts/shiftTimes/laborByShift ใหม่ทั้งหมดจาก
// breakdown ของทุกงานในวันนั้น (ไม่ใช่ค่าจาก report เดียว) — log-only overlap
// warning: ไม่มีระบบไหน (After-Sale หรือ Labor) กัน overlap ในสาย data นี้ไว้เลย
const aggregateJobSegments = (
  jobSegments: Record<string, JobSegmentEntry>,
  employeeId: string,
  activeDate: string
) => {
  const entries = Object.values(jobSegments);
  // เรียงตามเวลาเริ่มงาน ใช้จัดลำดับรูป boundary (เร็วสุด/ช้าสุด) ให้สมเหตุสมผล
  const startOf = (seg: JobSegmentEntry): number => {
    for (const key of SHIFT_KEYS) {
      const r = parseRangeToMinutes(seg.shiftTimes[shiftTimeField(key) as keyof typeof seg.shiftTimes]);
      if (r) return r[0];
    }
    return 0;
  };
  entries.sort((a, b) => startOf(a) - startOf(b));

  const expectedHours: Record<ShiftKey, number> = { normal: 0, otMorning: 0, otNoon: 0, otEvening: 0 };
  const expectedShifts: Record<ShiftKey, boolean> = { normal: false, otMorning: false, otNoon: false, otEvening: false };
  const shiftTimes: Record<string, string> = {};
  const laborByShift: Record<string, string[]> = {};

  for (const key of SHIFT_KEYS) {
    const timeField = shiftTimeField(key);
    const photoField = shiftPhotoField(key);

    let sum = 0;
    const ranges: string[] = [];
    for (const seg of entries) {
      sum += seg.hours[key] || 0;
      const r = (seg.shiftTimes as any)[timeField];
      if (r) ranges.push(r);
    }
    expectedHours[key] = sum;
    expectedShifts[key] = sum > 0 || entries.some((seg) => seg.shifts[key]);

    const envelope = mergeTimeEnvelope(ranges);
    if (envelope) shiftTimes[timeField] = envelope;

    // overlap ระหว่าง 2 งานในกะเดียวกัน = ข้อมูลผิดพลาด (คนเดียวทำ 2 ที่พร้อมกันไม่ได้)
    // ไม่ block การเขียน แค่ log ไว้ให้ตรวจสอบ
    const parsedPairs = ranges
      .map((r) => ({ str: r, parsed: parseRangeToMinutes(r) }))
      .filter((p): p is { str: string; parsed: [number, number] } => !!p.parsed);
    for (let i = 0; i < parsedPairs.length; i++) {
      for (let j = i + 1; j < parsedPairs.length; j++) {
        if (rangesOverlap(parsedPairs[i].parsed, parsedPairs[j].parsed)) {
          console.warn(
            `[syncDailyReport] OVERLAP DETECTED: employee=${employeeId} date=${activeDate} shift=${key} ` +
              `"${parsedPairs[i].str}" vs "${parsedPairs[j].str}" — ตรวจสอบข้อมูล, ชั่วโมงที่ sum อาจเกินจริง`
          );
        }
      }
    }

    // รูป: ไม่มีที่เก็บพอสำหรับทุกรูปของทุกงาน (Labor ยังอ่านได้แค่ boundary)
    // เอา "เข้า(รูปแรกสุด)/ออก(รูปท้ายสุด)" ของ "งานนั้นเอง" (ไม่ใช่ตัด array
    // ตามตำแหน่งดิบ — งานกลางที่มีรูปมากกว่า 2 ใบ ต้องไม่โดนตัดรูปเข้างานทิ้ง)
    // จากงานแรกสุด + งานสุดท้ายของวันเป็นตัวแทน (เก็บรูปครบทุกงานจริงๆไว้ใน
    // jobSegments ให้ Track 2 ของ Labor ไปดึงใช้ทีหลังได้ — ไม่มีการเสียข้อมูลที่นั่น)
    const boundaryInOut = (arr: string[]): string[] =>
      arr.length > 1 ? [arr[0], arr[arr.length - 1]] : arr;

    const withPhotos = entries.filter((seg) => (seg.photos as any)[photoField]?.length);
    if (withPhotos.length > 0) {
      let flat: string[];
      if (photoField === 'regular' && withPhotos.length > 1) {
        const first = (withPhotos[0].photos as any).regular as string[];
        const last = (withPhotos[withPhotos.length - 1].photos as any).regular as string[];
        flat = [...boundaryInOut(first), ...boundaryInOut(last)];
      } else {
        flat = withPhotos.flatMap((seg) => (seg.photos as any)[photoField] as string[]);
      }
      if (flat.length > 0) {
        laborByShift[photoField] = photoField === 'regular' ? flat.slice(0, 4) : flat;
      }
    }
  }

  return { expectedHours, expectedShifts, shiftTimes, laborByShift };
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

        // คำนวณชั่วโมงของ "งานนี้" เท่านั้น (ยังไม่รวมงานอื่นในวันเดียวกัน — รวมทีหลังตอน aggregate)
        const normalHours = shifts.normal ? calculateHours(shiftTimes.day || '', true) : 0;
        const otMorningHours = shifts.otMorning ? calculateHours(shiftTimes.otMorning || '', false) : 0;
        const otNoonHours = shifts.otNoon ? calculateHours(shiftTimes.otNoon || '', false) : 0;
        const otEveningHours = shifts.otEvening ? calculateHours(shiftTimes.otEvening || '', false) : 0;

        const jobPhotos: JobSegmentEntry['photos'] = {};
        if (shifts.normal) {
          const arr = toPhotoArray(effectiveLaborByShift.regular);
          if (arr.length > 0) jobPhotos.regular = arr;
        }
        for (const s of ['otMorning', 'otNoon', 'otEvening'] as const) {
          if (!shifts[s]) continue;
          const arr = toPhotoArray(effectiveLaborByShift[s]);
          if (arr.length > 0) jobPhotos[s] = arr;
        }

        // คีย์ด้วย taskId+subtaskId — ระบุตัวตนของ "งานนี้" เพื่อให้ sync ซ้ำ
        // (เช่นแก้ไข report เดิม) แทนที่แค่ entry ของงานนี้ ไม่บวกชั่วโมงซ้ำ
        const jobKey = `${taskId}_${subtaskId || 'none'}`;
        const segmentEntry: JobSegmentEntry = {
          taskId,
          subtaskId: subtaskId || null,
          taskName,
          subtaskName: subtaskName || null,
          location: locationName,
          shifts: {
            normal: shifts.normal || false,
            otMorning: shifts.otMorning || false,
            otNoon: shifts.otNoon || false,
            otEvening: shifts.otEvening || false,
          },
          hours: {
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
          photos: jobPhotos,
          sourceReport: cleanPath,
          lastUpdated: new Date().toISOString(),
        };

        // อ่านของเดิมก่อนเขียน เพื่อรวม breakdown ของงานนี้เข้ากับงานอื่นที่ sync
        // ไปแล้วในวันเดียวกัน (คนละ taskId/subtaskId) แล้วคำนวณผลรวมใหม่จาก
        // breakdown ทั้งหมดเสมอ — ไม่ใช่เขียนทับด้วยค่าของ report ใบนี้ใบเดียว
        const existingSnap = await timesheetRef.get();
        const jobSegments: Record<string, JobSegmentEntry> = {
          ...(existingSnap.exists ? existingSnap.data()?.jobSegments || {} : {}),
          [jobKey]: segmentEntry,
        };

        const aggregate = aggregateJobSegments(jobSegments, employeeId, activeDate);

        const timesheet: any = {
          employeeNumber: employeeId,
          date: activeDate,
          projectLocationId: projectLocationId,
          isActive: true,
          status: reportData.status ?? null, // สถานะรายงานต้นทาง (เช่น "draft") — ค่าล่าสุดเขียนทับเสมอเมื่อ sync รอบใหม่
          expectedShifts: aggregate.expectedShifts,
          expectedHours: aggregate.expectedHours,
          shiftTimes: aggregate.shiftTimes,
          // breakdown ละเอียดต่องาน (multi-job-per-day) — เก็บไว้ให้ Labor
          // ฝั่ง work-hour-monitoring ไปใช้แสดงทีละงานได้ทีหลัง (ไม่ต้องรอ sync ใหม่)
          jobSegments,
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
        if (Object.keys(aggregate.laborByShift).length > 0) {
          photosUpdate.laborByShift = aggregate.laborByShift;
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
