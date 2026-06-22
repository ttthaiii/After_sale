"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenDailyReportToTimesheet = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------
// Map Project B workType to Project A shift keys
const mapWorkTypeToShift = (workType) => {
    switch (workType) {
        case 'regular': return 'normal';
        case 'ot-morning': return 'otMorning';
        case 'ot-noon': return 'otNoon';
        case 'ot-evening': return 'otEvening';
        default: return 'normal';
    }
};
// Calculate hours between two time strings (HH:mm)
const calculateHours = (start, end, isRegular) => {
    if (!start || !end)
        return 0;
    try {
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        let diff = (endH + endM / 60) - (startH + startM / 60);
        // Deduct 1 hr break if regular shift covers 12:00 to 13:00
        if (isRegular && startH <= 12 && endH >= 13) {
            diff -= 1;
        }
        return Math.max(0, diff);
    }
    catch (_a) {
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
exports.flattenDailyReportToTimesheet = functions
    .region('asia-southeast1')
    .firestore
    .document('workOrders/{workOrderId}/categories/{categoryId}/tasks/{taskId}/revisions/{revisionId}/dailyReports/{reportId}')
    .onWrite(async (change, context) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const { workOrderId, categoryId, taskId } = context.params;
    const oldData = change.before.exists ? change.before.data() : null;
    const newData = change.after.exists ? change.after.data() : null;
    const activeDate = (newData === null || newData === void 0 ? void 0 : newData.date) || (oldData === null || oldData === void 0 ? void 0 : oldData.date);
    if (!activeDate) {
        console.log('No date found in report. Skipping.');
        return null;
    }
    const woSnap = await db.collection('workOrders').doc(workOrderId).get();
    const woData = woSnap.exists ? woSnap.data() : null;
    const projectLocationId = (woData === null || woData === void 0 ? void 0 : woData.projectId) || 'UNKNOWN';
    const locationName = (woData === null || woData === void 0 ? void 0 : woData.locationName) || projectLocationId;
    const taskSnap = await db
        .collection(`workOrders/${workOrderId}/categories/${categoryId}/tasks`)
        .doc(taskId)
        .get();
    const taskName = taskSnap.exists ? ((_a = taskSnap.data()) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Task' : 'Unknown Task';
    const oldWorkers = (oldData === null || oldData === void 0 ? void 0 : oldData.workers) || [];
    const newWorkers = (newData === null || newData === void 0 ? void 0 : newData.workers) || [];
    const workerIds = new Set([
        ...oldWorkers.map((w) => w.workerId),
        ...newWorkers.map((w) => w.workerId),
    ]);
    const batch = db.batch();
    for (const workerId of workerIds) {
        if (!workerId)
            continue;
        const timesheetId = `${workerId}_${activeDate}`;
        const timesheetRef = db.collection('DailyEmployeeTimesheets').doc(timesheetId);
        const timesheetSnap = await timesheetRef.get();
        let timesheet = timesheetSnap.exists
            ? timesheetSnap.data()
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
        const inOld = oldWorkers.find((w) => w.workerId === workerId);
        if (inOld && oldData) {
            const oldShiftKey = mapWorkTypeToShift(oldData.workType);
            const oldHours = calculateHours((_b = oldData.timeRange) === null || _b === void 0 ? void 0 : _b.start, (_c = oldData.timeRange) === null || _c === void 0 ? void 0 : _c.end, oldShiftKey === 'normal');
            timesheet.expectedHours[oldShiftKey] = Math.max(0, timesheet.expectedHours[oldShiftKey] - oldHours);
            timesheet.workLogs = timesheet.workLogs.filter((log) => log.taskName !== taskName);
            const oldPhotos = oldData.photos || {};
            const oldLabor = oldPhotos.labor || [];
            const oldSite = oldPhotos.site || [];
            if (timesheet.photos) {
                timesheet.photos.labor = timesheet.photos.labor.filter((p) => !oldLabor.includes(p));
                timesheet.photos.site = timesheet.photos.site.filter((p) => !oldSite.includes(p));
            }
        }
        const inNew = newWorkers.find((w) => w.workerId === workerId);
        if (inNew && newData) {
            const newShiftKey = mapWorkTypeToShift(newData.workType);
            const newHours = calculateHours((_d = newData.timeRange) === null || _d === void 0 ? void 0 : _d.start, (_e = newData.timeRange) === null || _e === void 0 ? void 0 : _e.end, newShiftKey === 'normal');
            timesheet.expectedHours[newShiftKey] += newHours;
            const timeString = `${((_f = newData.timeRange) === null || _f === void 0 ? void 0 : _f.start) || ''} - ${((_g = newData.timeRange) === null || _g === void 0 ? void 0 : _g.end) || ''}`;
            if (newShiftKey === 'normal')
                timesheet.shiftTimes.day = timeString;
            else
                timesheet.shiftTimes[newShiftKey] = timeString;
            const alreadyLogged = timesheet.workLogs.some((log) => log.taskName === taskName && log.location === locationName);
            if (!alreadyLogged) {
                timesheet.workLogs.push({ taskName, location: locationName });
            }
            const newPhotos = newData.photos || {};
            const newLabor = newPhotos.labor || [];
            const newSite = newPhotos.site || [];
            if (timesheet.photos) {
                for (const p of newLabor) {
                    if (!timesheet.photos.labor.includes(p))
                        timesheet.photos.labor.push(p);
                }
                for (const p of newSite) {
                    if (!timesheet.photos.site.includes(p))
                        timesheet.photos.site.push(p);
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
    }
    catch (error) {
        console.error(`[Error] Failed to process daily report ${context.params.reportId}:`, error);
    }
    return null;
});
//# sourceMappingURL=dailyReportFlattener.js.map