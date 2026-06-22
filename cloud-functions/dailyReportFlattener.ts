import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ----------------------------------------------------------------------
// Interfaces mapping to the Schema for Project A (Labor Management)
// ----------------------------------------------------------------------
interface ExpectedShifts {
  normal: boolean;
  otMorning: boolean;
  otNoon: boolean;
  otEvening: boolean;
}

interface ExpectedHours {
  normal: number;
  otMorning: number;
  otNoon: number;
  otEvening: number;
}

interface ShiftTimes {
  day?: string;
  otMorning?: string;
  otNoon?: string;
  otEvening?: string;
}

interface WorkLog {
  taskName: string;
  location: string;
}

export interface DailyEmployeeTimesheet {
  employeeNumber: string;
  date: string;
  projectLocationId: string;
  isActive: boolean;
  expectedShifts: ExpectedShifts;
  expectedHours: ExpectedHours;
  shiftTimes: ShiftTimes;
  workLogs: WorkLog[];
  photos?: {
    labor: string[];
    site: string[];
  };
  lastUpdated: string;
}

// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------

// Map Project B workType to Project A shift keys
const mapWorkTypeToShift = (workType: string): keyof ExpectedHours => {
  switch (workType) {
    case 'regular': return 'normal';
    case 'ot-morning': return 'otMorning';
    case 'ot-noon': return 'otNoon';
    case 'ot-evening': return 'otEvening';
    default: return 'normal';
  }
};

// Calculate hours between two time strings (HH:mm)
const calculateHours = (start: string, end: string, isRegular: boolean): number => {
  if (!start || !end) return 0;
  try {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let diff = (endH + endM / 60) - (startH + startM / 60);

    // Deduct 1 hr break if regular shift covers 12:00 to 13:00
    if (isRegular && startH <= 12 && endH >= 13) {
      diff -= 1;
    }
    return Math.max(0, diff);
  } catch {
    return 0;
  }
};

/**
 * Cloud Function (Gen 2): flattenDailyReportToTimesheet
 * NOTE: This is kept as reference. Due to Eventarc not supporting
 * asia-southeast3 (Bangkok) as a trigger source, this must be
 * converted to onCall by the project owner.
 * See: daily_timesheet_sync_brief.md for full instructions.
 */
export const flattenDailyReportToTimesheet = functions
  .region('asia-southeast1')
  .firestore
  .document('workOrders/{workOrderId}/categories/{categoryId}/tasks/{taskId}/revisions/{revisionId}/dailyReports/{reportId}')
  .onWrite(async (change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) => {
    const { workOrderId, categoryId, taskId } = context.params;

    const oldData = change.before.exists ? change.before.data() : null;
    const newData = change.after.exists ? change.after.data() : null;

    const activeDate = newData?.date || oldData?.date;
    if (!activeDate) {
      console.log('No date found in report. Skipping.');
      return null;
    }

    const woSnap = await db.collection('workOrders').doc(workOrderId).get();
    const woData = woSnap.exists ? woSnap.data() : null;
    const projectLocationId = woData?.projectId || 'UNKNOWN';
    const locationName = woData?.locationName || projectLocationId;

    const taskSnap = await db
      .collection(`workOrders/${workOrderId}/categories/${categoryId}/tasks`)
      .doc(taskId)
      .get();
    const taskName = taskSnap.exists ? taskSnap.data()?.name || 'Unknown Task' : 'Unknown Task';

    const oldWorkers: any[] = oldData?.workers || [];
    const newWorkers: any[] = newData?.workers || [];

    const workerIds = new Set<string>([
      ...oldWorkers.map((w: any) => w.workerId),
      ...newWorkers.map((w: any) => w.workerId),
    ]);

    const batch = db.batch();

    for (const workerId of workerIds) {
      if (!workerId) continue;

      const timesheetId = `${workerId}_${activeDate}`;
      const timesheetRef = db.collection('DailyEmployeeTimesheets').doc(timesheetId);

      const timesheetSnap = await timesheetRef.get();
      let timesheet: DailyEmployeeTimesheet = timesheetSnap.exists
        ? (timesheetSnap.data() as DailyEmployeeTimesheet)
        : {
            employeeNumber: workerId,
            date: activeDate,
            projectLocationId: projectLocationId,
            isActive: true,
            expectedShifts: { normal: false, otMorning: false, otNoon: false, otEvening: false },
            expectedHours: { normal: 0, otMorning: 0, otNoon: 0, otEvening: 0 },
            shiftTimes: {},
            workLogs: [],
            photos: { labor: [], site: [] },
            lastUpdated: new Date().toISOString(),
          };

      if (!timesheet.photos) {
        timesheet.photos = { labor: [], site: [] };
      }

      const inOld = oldWorkers.find((w: any) => w.workerId === workerId);
      if (inOld && oldData) {
        const oldShiftKey = mapWorkTypeToShift(oldData.workType);
        const oldHours = calculateHours(
          oldData.timeRange?.start,
          oldData.timeRange?.end,
          oldShiftKey === 'normal'
        );
        timesheet.expectedHours[oldShiftKey] = Math.max(
          0,
          timesheet.expectedHours[oldShiftKey] - oldHours
        );
        timesheet.workLogs = timesheet.workLogs.filter((log) => log.taskName !== taskName);

        const oldPhotos = oldData.photos || {};
        const oldLabor = oldPhotos.labor || [];
        const oldSite = oldPhotos.site || [];
        
        if (timesheet.photos) {
          timesheet.photos.labor = timesheet.photos.labor.filter((p: string) => !oldLabor.includes(p));
          timesheet.photos.site = timesheet.photos.site.filter((p: string) => !oldSite.includes(p));
        }
      }

      const inNew = newWorkers.find((w: any) => w.workerId === workerId);
      if (inNew && newData) {
        const newShiftKey = mapWorkTypeToShift(newData.workType);
        const newHours = calculateHours(
          newData.timeRange?.start,
          newData.timeRange?.end,
          newShiftKey === 'normal'
        );
        timesheet.expectedHours[newShiftKey] += newHours;

        const timeString = `${newData.timeRange?.start || ''} - ${newData.timeRange?.end || ''}`;
        if (newShiftKey === 'normal') timesheet.shiftTimes.day = timeString;
        else timesheet.shiftTimes[newShiftKey] = timeString;

        const alreadyLogged = timesheet.workLogs.some(
          (log) => log.taskName === taskName && log.location === locationName
        );
        if (!alreadyLogged) {
          timesheet.workLogs.push({ taskName, location: locationName });
        }

        const newPhotos = newData.photos || {};
        const newLabor = newPhotos.labor || [];
        const newSite = newPhotos.site || [];
        
        if (timesheet.photos) {
          for (const p of newLabor) {
            if (!timesheet.photos.labor.includes(p)) timesheet.photos.labor.push(p);
          }
          for (const p of newSite) {
            if (!timesheet.photos.site.includes(p)) timesheet.photos.site.push(p);
          }
        }
      }

      timesheet.expectedShifts.normal = timesheet.expectedHours.normal > 0;
      timesheet.expectedShifts.otMorning = timesheet.expectedHours.otMorning > 0;
      timesheet.expectedShifts.otNoon = timesheet.expectedHours.otNoon > 0;
      timesheet.expectedShifts.otEvening = timesheet.expectedHours.otEvening > 0;

      const hasAnyHours = Object.values(timesheet.expectedHours).some((h) => h > 0);
      timesheet.isActive = hasAnyHours;
      timesheet.lastUpdated = new Date().toISOString();
      timesheet.employeeNumber = workerId;
      timesheet.date = activeDate;

      batch.set(timesheetRef, timesheet);
    }

    try {
      await batch.commit();
      console.log(`[Success] Processed daily report ${context.params.reportId} for ${workerIds.size} workers.`);
    } catch (error) {
      console.error(`[Error] Failed to process daily report ${context.params.reportId}:`, error);
    }

    return null;
  }
);
