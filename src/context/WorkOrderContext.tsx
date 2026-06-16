import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { WorkOrder, Category, MasterTask, DailyReport, Project, Staff, Contractor } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, getDocs, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { TaskAssignee } from '../types';
import { useAuth } from './AuthContext';

interface WorkOrderContextType {
    workOrders: WorkOrder[];
    getWorkOrderById: (id: string) => WorkOrder | undefined;
    updateTask: (workOrderId: string, categoryId: string, taskId: string, updates: Partial<MasterTask>) => Promise<void>;
    addWorkOrder: (wo: WorkOrder) => Promise<void>;
    updateWorkOrderStatus: (id: string, status: string) => Promise<void>;
    saveEvaluation: (id: string, status: string, categories: any[]) => Promise<void>;
    addTaskUpdate: (workOrderId: string, categoryId: string, taskId: string, report: DailyReport) => Promise<void>;
    projects: Project[];
    staff: Staff[];
    contractors: Contractor[];
    loading: boolean;
    deleteWorkOrder: (id: string) => Promise<void>;
    archiveWorkOrder: (id: string) => Promise<void>;
    markWorkOrderAsReviewed: (id: string) => Promise<void>;
    requestRetroactiveUnlock: (workOrderId: string, categoryId: string, taskId: string, date: string, reason: string) => Promise<void>;
    generateDeliveryQrToken: (woId: string, ownerId: string) => Promise<string>;
    submitCustomerInspection: (
        woId: string, 
        approvals: Record<string, { 
            status: 'approved' | 'rejected'; 
            reason?: string; 
            defectCategories?: Record<string, boolean>;
            contactName?: string;
            contactPhone?: string;
        }>,
        survey?: {
            workQuality: number;
            siteCleanliness: number;
            foremanProfessionalism: number;
            specAccuracy: number;
            handoverCare: number;
        }
    ) => Promise<void>;
    logCustomerQrView: (woId: string) => Promise<void>;
    markWorkOrderAsOpenedByAdmin: (id: string) => Promise<void>;
    requestSupport: (workOrderId: string, categoryId: string, taskId: string) => Promise<void>;
}

const WorkOrderContext = createContext<WorkOrderContextType | undefined>(undefined);

// ✅ Dropdown category list — same order as ForemanReportModal.tsx
// Position 1-indexed: หมวดงานทั่วไป=0001, งานโครงสร้าง=0002, งานปูนฉาบ=0003, งานกระเบื้อง=0004, ...
const CATEGORIES_LIST = [
    'หมวดงานทั่วไป (General)',        // pos 1 → 0001
    'งานโครงสร้าง',                    // pos 2 → 0002
    'งานปูนฉาบ/ผิวพื้นผนัง',          // pos 3 → 0003
    'งานกระเบื้อง/สุขภัณฑ์',          // pos 4 → 0004
    'งานไฟฟ้า',                        // pos 5 → 0005
    'งานระบบประปา/สุขาภิบาล',         // pos 6 → 0006
    'งานสี/เคลือบผิว',                 // pos 7 → 0007
    'งานฝ้าเพดาน',                     // pos 8 → 0008
    'งานบานประตู/หน้าต่าง',            // pos 9 → 0009
    'งานอลูมิเนียม/มุ้งลวด',           // pos 10 → 0010
    'งานเฟอร์นิเจอร์บิวท์อิน',        // pos 11 → 0011
    'งานระบบปรับอากาศ (Air)',           // pos 12 → 0012
    'งานระบบโทรศัพท์/อินเตอร์เน็ต',   // pos 13 → 0013
    'งานระบบแจ้งเหตุเพลิงใหม่',       // pos 14 → 0014
    'งานระบบความปลอดภัย',              // pos 15 → 0015
    'งานพื้น/พื้นไม้ลามิเนต',          // pos 16 → 0016
];

// ✅ Helper to format category and task IDs according to the LB structure
//
// Parses WO ID like: ART-2026-WOA-0002
//   projectCode = "ART"  (first segment)
//   jobCode     = "WOA"  (second-to-last segment)
//   woSeq       = "0002" (last segment)
//
// Category ID: [ProjectCode]-[JobCode]-[CatTypePos4digits]
//   e.g. งานกระเบื้อง in ART project → ART-WOA-0004   (unique per project + category type)
//
// Task ID: [ProjectCode]-[JobCode]-[WOSeq]-[globalTaskSeq7digits]
//   e.g. ART-WOA-0002-0000001   (globally unique: no two tasks in any project/WO can share this)
//
// ONLY applies to WOA/WOP work orders. All other codes are untouched.
const formatCategoriesAndTasks = (woId: string, categories: any[]): any[] => {
    if (!categories || categories.length === 0) return [];

    // Guard: only WOA/WOP
    const isWoaWop = woId.toUpperCase().includes('WOA') || woId.toUpperCase().includes('WOP');
    if (!isWoaWop) return categories;

    // Parse WO ID — e.g. ART-2026-WOA-0002
    const parts = woId.split('-');
    const jobCode     = parts.length >= 2 ? parts[parts.length - 2].toUpperCase() : 'WOA'; // "WOA"
    const woSeq       = parts.length >= 1 ? parts[parts.length - 1] : '0001';

    // Pad woSeq to 4 digits for standard display (e.g. 0001)
    const formattedWoSeq = String(parseInt(woSeq) || 0).padStart(4, '0');

    let taskCounter = 0;

    return categories.map((cat, catIndex) => {
        const catName = (cat.name || '').trim().toLowerCase();
        const listIndex = CATEGORIES_LIST.findIndex(n => n.trim().toLowerCase() === catName);

        // 1-indexed category type position; fallback to array position if name not found
        const position = listIndex >= 0 ? listIndex + 1 : catIndex + 1;
        const formattedPosition = String(position).padStart(4, '0');

        // Category ID: LR-[ProjectCode]-[CategorySeq]-[WOSeq] (e.g. LR-WOA-0003-0001)
        const computedCatId = `LR-${jobCode}-${formattedPosition}-${formattedWoSeq}`;

        // Task ID: LR-[ProjectCode]-[CategorySeq]-[WOSeq]-[TaskCount 4 digits] (e.g. LR-WOA-0003-0001-0001)
        const tasks = cat.tasks ? cat.tasks.map((task: any) => {
            taskCounter++;
            const taskSeq = String(taskCounter).padStart(4, '0');
            const computedTaskId = `LR-${jobCode}-${formattedPosition}-${formattedWoSeq}-${taskSeq}`;
            const computedSubtaskId = `${jobCode}-${formattedPosition}-${formattedWoSeq}-${taskSeq}`;
            return {
                ...task,
                id: computedTaskId,
                taskCode: computedTaskId,
                catId: computedCatId,
                subtaskId: computedSubtaskId
            };
        }) : [];

        return {
            ...cat,
            id: computedCatId,
            catId: computedCatId,
            catName: cat.name || cat.catName || '',
            name: cat.name || cat.catName || '',
            tasks
        };
    });
};

// Helper function to resolve subtask ID from task ID
const getSubtaskId = (taskId: string): string => {
    // Strip "LR-" prefix if present → e.g. "LR-WOA-0003-0001-0001" → "WOA-0003-0001-0001"
    if (taskId && taskId.startsWith('LR-')) {
        return taskId.substring(3);
    }
    return taskId;
};

// ✅ Resolve task assignee details from the users collection for LB schema compatibility
const resolveAssignees = async (staffIds: string[]): Promise<TaskAssignee[]> => {
    if (!staffIds || staffIds.length === 0) return [];
    const assignees: TaskAssignee[] = [];
    for (const staffId of staffIds) {
        try {
            const userDoc = await getDoc(doc(db, 'users', staffId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                assignees.push({
                    employeeId: userData.employeeId || staffId,
                    name: userData.name || '',
                    roleId: userData.roleId || (userData.role === 'Admin' ? 'AM' : 'FM')
                });
            } else {
                // Fallback if user doesn't exist in users collection
                assignees.push({
                    employeeId: staffId,
                    name: `Staff ${staffId}`,
                    roleId: 'FM' // Default fallback
                });
            }
        } catch (error) {
            console.error("Error resolving assignee details:", error);
            assignees.push({
                employeeId: staffId,
                name: `Staff ${staffId}`,
                roleId: 'FM'
            });
        }
    }
    return assignees;
};

export const WorkOrderProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);

    // ✅ Deep Fetch for Sub-collections (The Bridge)
    const fetchSubcollections = async (woId: string): Promise<Category[]> => {
        const categoriesSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
        const categories: Category[] = [];

        // Sort categories alphabetically by document ID for stable deterministic ordering
        const sortedCategoryDocs = [...categoriesSnap.docs].sort((a, b) => a.id.localeCompare(b.id));

        for (const catDoc of sortedCategoryDocs) {
            const catData = catDoc.data();
            const tasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
            const tasks: MasterTask[] = [];

            // Sort tasks alphabetically by document ID for stable deterministic ordering
            const sortedTaskDocs = [...tasksSnap.docs].sort((a, b) => a.id.localeCompare(b.id));

            for (const taskDoc of sortedTaskDocs) {
                const taskData = taskDoc.data();
                
                // Fetch daily reports from subtasks -> revisions -> dailyReports (new LB structure) or dailyreport (legacy)
                const subtasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks'));
                let dailyreports: DailyReport[] = [];
                let currentRevision = 'rev00';
                let revisionCreatedAt: string | null = null;
                
                let subtaskName = taskData.subtaskName || '';
                let didPushSupportSubtask = false;

                if (!subtasksSnap.empty) {
                    for (const subtaskDoc of subtasksSnap.docs) {
                        const subtaskData = subtaskDoc.data();
                        if (subtaskData.subtaskName) {
                            subtaskName = subtaskData.subtaskName;
                        }
                        const revisionsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions'));
                        
                        let subtaskRev = 'rev00';
                        let subtaskRevCreatedAt: string | null = null;
                        if (!revisionsSnap.empty) {
                            // Find the active revision document, or fallback to the latest one
                            const activeRevDoc = revisionsSnap.docs.find(d => d.data().status === 'active') || 
                                                 revisionsSnap.docs.sort((a, b) => b.id.localeCompare(a.id))[0];
                            
                            if (activeRevDoc) {
                                subtaskRev = activeRevDoc.id;
                                currentRevision = activeRevDoc.id;
                                const revData = activeRevDoc.data();
                                if (revData.createdAt) {
                                    if (typeof revData.createdAt === 'object' && revData.createdAt.seconds !== undefined) {
                                        subtaskRevCreatedAt = new Date(revData.createdAt.seconds * 1000).toISOString();
                                    } else if (typeof revData.createdAt.toDate === 'function') {
                                        subtaskRevCreatedAt = revData.createdAt.toDate().toISOString();
                                    } else {
                                        subtaskRevCreatedAt = revData.createdAt;
                                    }
                                    revisionCreatedAt = subtaskRevCreatedAt;
                                }
                            }

                            // Fetch daily reports from ALL revisions for parent task
                            for (const revDoc of revisionsSnap.docs) {
                                const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports'));
                                for (const reportDoc of reportsSnap.docs) {
                                    const reportData = reportDoc.data();
                                    if (!dailyreports.some(r => r.id === reportDoc.id || r.date === (reportData.date || reportDoc.id))) {
                                        dailyreports.push({
                                            ...reportData,
                                            id: reportDoc.id,
                                            date: reportData.date || reportDoc.id,
                                            isSupportReport: false,
                                            revisionId: revDoc.id
                                        } as unknown as DailyReport);
                                    }
                                }
                            }
                        } else {
                            subtaskRev = subtaskData.currentRevision || 'rev00';
                            const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', subtaskRev, 'dailyReports'));
                            for (const reportDoc of reportsSnap.docs) {
                                const reportData = reportDoc.data();
                                dailyreports.push({
                                    ...reportData,
                                    id: reportDoc.id,
                                    date: reportData.date || reportDoc.id,
                                    isSupportReport: false,
                                    revisionId: subtaskRev
                                } as unknown as DailyReport);
                            }
                        }

                        // Check help subcollection (งานช่วย)
                        const helpSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'help'));
                        let subtaskAssignedForeman = subtaskData.assignedForeman || '';
                        let subtaskHelperForemanIds: string[] = subtaskData.helperForemanIds || [];
                        const hasHelpDocs = !helpSnap.empty;

                        // Check trace of foreman assignment from the other system (e.g. Labor)
                        const supportFms = subtaskData.supportAssignees?.filter((a: any) => a.roleId === 'FM' || a.role === 'Foreman') || [];
                        if (supportFms.length > 0) {
                            subtaskHelperForemanIds = supportFms.map((a: any) => a.employeeId || a.id);
                            subtaskAssignedForeman = subtaskHelperForemanIds[0] || '';
                        }

                        if (hasHelpDocs) {
                            const targetHelpId = subtaskRev.replace('rev', 'help');
                            const helpDoc = helpSnap.docs.find(d => d.id === targetHelpId) || helpSnap.docs[0];
                            if (helpDoc) {
                                const helpData = helpDoc.data();
                                // Prioritize trace of foreman assignment in help document's assignees
                                const helpFms = helpData.assignees?.filter((a: any) => a.roleId === 'FM' || a.role === 'Foreman') || [];
                                if (helpFms.length > 0) {
                                    subtaskHelperForemanIds = helpFms.map((a: any) => a.employeeId || a.id);
                                    subtaskAssignedForeman = subtaskHelperForemanIds[0] || '';
                                } else {
                                    if (helpData.assignedForeman) subtaskAssignedForeman = helpData.assignedForeman;
                                    if (helpData.helperForemanIds) subtaskHelperForemanIds = helpData.helperForemanIds;
                                }
                            }
                        }

                        const subtaskIsSupport = subtaskData.isSupportRequest === true || hasHelpDocs;
                        const subtaskIsPickedUp = subtaskData.isPickedUpBySupport === true || !!subtaskAssignedForeman || subtaskHelperForemanIds.length > 0;

                        if (subtaskIsSupport) {
                            // Fetch daily reports specifically for this helper subtask
                            let subtaskDailyreports: DailyReport[] = [];
                            
                            // Check help dailyReports first (where helper daily reports are written)
                            if (hasHelpDocs) {
                                for (const helpDoc of helpSnap.docs) {
                                    const helpReportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'help', helpDoc.id, 'dailyReports'));
                                    for (const reportDoc of helpReportsSnap.docs) {
                                        const reportData = reportDoc.data();
                                        if (!subtaskDailyreports.some(r => r.id === reportDoc.id || r.date === (reportData.date || reportDoc.id))) {
                                            subtaskDailyreports.push({
                                                ...reportData,
                                                id: reportDoc.id,
                                                date: reportData.date || reportDoc.id,
                                                isSupportReport: true,
                                                revisionId: subtaskRev
                                            } as unknown as DailyReport);
                                        }
                                    }
                                }
                            }

                            // Also fetch revision daily reports (if any, like from Labor source system)
                            if (!revisionsSnap.empty) {
                                for (const revDoc of revisionsSnap.docs) {
                                    const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports'));
                                    for (const reportDoc of reportsSnap.docs) {
                                        const reportData = reportDoc.data();
                                        if (!subtaskDailyreports.some(r => r.id === reportDoc.id || r.date === (reportData.date || reportDoc.id))) {
                                            subtaskDailyreports.push({
                                                ...reportData,
                                                id: reportDoc.id,
                                                date: reportData.date || reportDoc.id,
                                                isSupportReport: false,
                                                revisionId: revDoc.id
                                            } as unknown as DailyReport);
                                        }
                                    }
                                }
                            } else {
                                const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', subtaskRev, 'dailyReports'));
                                for (const reportDoc of reportsSnap.docs) {
                                    const reportData = reportDoc.data();
                                    if (!subtaskDailyreports.some(r => r.id === reportDoc.id || r.date === (reportData.date || reportDoc.id))) {
                                        subtaskDailyreports.push({
                                            ...reportData,
                                            id: reportDoc.id,
                                            date: reportData.date || reportDoc.id,
                                            isSupportReport: false,
                                            revisionId: subtaskRev
                                        } as unknown as DailyReport);
                                    }
                                }
                            }

                            subtaskDailyreports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                            const subtaskMappedReports = subtaskDailyreports.map(report => {
                                if (report.labor) {
                                    const mappedLabor = report.labor.map((l: any) => ({
                                        ...l,
                                        staffId: l.staffId || l.workerId,
                                        staffName: l.staffName || l.workerName,
                                        workerId: l.workerId || l.staffId,
                                        workerName: l.workerName || l.staffName
                                    }));
                                    return { ...report, labor: mappedLabor };
                                }
                                return report;
                            });

                            const subtaskNameVal = subtaskData.subtaskName || taskData.subtaskName || taskData.taskName || taskData.name || '';

                            // Push helper subtask as a separate virtual MasterTask
                            tasks.push({
                                ...taskData,
                                id: subtaskDoc.id, // Virtual Task ID is the Subtask ID!
                                parentTaskId: taskDoc.id,
                                name: taskData.taskName || taskData.name || '',
                                taskName: taskData.taskName || taskData.name || '',
                                subtaskName: subtaskData.subtaskName || '',
                                dailyProgress: subtaskData.dailyProgress || 0,
                                isSupportRequest: true,
                                isPickedUpBySupport: subtaskIsPickedUp,
                                assignedForeman: subtaskAssignedForeman,
                                helperForemanIds: subtaskHelperForemanIds,
                                isHelper: true,
                                status: subtaskData.status || taskData.status || 'upcoming',
                                currentRevision: subtaskRev,
                                revisionCreatedAt: subtaskRevCreatedAt,
                                dailyreports: subtaskMappedReports,
                                history: subtaskMappedReports,
                                responsibleStaffIds: taskData.responsibleStaffIds || []
                            } as unknown as MasterTask);
                            didPushSupportSubtask = true;
                        }
                    }
                } else {
                    const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport'));
                    dailyreports = reportsSnap.docs.map(d => {
                        const rData = d.data();
                        return {
                            ...rData,
                            id: d.id,
                            date: rData.date || d.id,
                            isSupportReport: false
                        } as DailyReport;
                    });
                }

                // Sort daily reports descending by date
                dailyreports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

                // Map labor fields in reports for backward compatibility
                const mappedDailyReports = dailyreports.map(report => {
                    if (report.labor) {
                        const mappedLabor = report.labor.map((l: any) => ({
                            ...l,
                            staffId: l.staffId || l.workerId,
                            staffName: l.staffName || l.workerName,
                            workerId: l.workerId || l.staffId,
                            workerName: l.workerName || l.staffName
                        }));
                        return { ...report, labor: mappedLabor };
                    }
                    return report;
                });

                const taskCode = taskDoc.id;
                
                // Backwards compatibility mappings for LB to After-Sale UI
                const name = taskData.taskName || taskData.name || '';
                const assignees = taskData.assignees || [];
                const responsibleStaffIds = taskData.responsibleStaffIds || (assignees.length > 0 ? assignees.map((a: any) => a.employeeId || a.id) : []);

                // Map status values for backward compatibility and to prevent UI bouncing
                let status = taskData.status;
                const evalStatus = taskData.evaluationStatus;
                
                if (status === 'upcoming') {
                    status = (evalStatus === 'Assigned' || evalStatus === 'Approved') ? 'Assigned' : 'Pending';
                } else if (status === 'in-progress') {
                    status = (evalStatus === 'Rejected') ? 'Rejected' : 'In Progress';
                } else if (status === 'for-checking') {
                    status = 'Completed';
                } else if (status === 'completed') {
                    status = 'Verified';
                } else if (status === 'pending_inspection') {
                    status = 'Completed'; // Maps to Completed so UI shows under inspection list
                } else if (status === 'approved') {
                    status = 'Verified';
                } else if (status === 'rejected') {
                    status = 'Rejected';
                }

                // Fallback for revisionCreatedAt from taskData if not retrieved from revisions
                let finalRevisionCreatedAt = revisionCreatedAt;
                if (!finalRevisionCreatedAt && taskData.revisionCreatedAt) {
                    if (typeof taskData.revisionCreatedAt === 'object' && taskData.revisionCreatedAt.seconds !== undefined) {
                        finalRevisionCreatedAt = new Date(taskData.revisionCreatedAt.seconds * 1000).toISOString();
                    } else if (typeof taskData.revisionCreatedAt.toDate === 'function') {
                        finalRevisionCreatedAt = taskData.revisionCreatedAt.toDate().toISOString();
                    } else {
                        finalRevisionCreatedAt = taskData.revisionCreatedAt;
                    }
                }

                if (!didPushSupportSubtask) {
                    tasks.push({ 
                        ...taskData, 
                        id: taskDoc.id, 
                        name,
                        taskName: name,
                        subtaskName,
                        responsibleStaffIds,
                        status,
                        taskCode,
                        currentRevision,
                        revisionCreatedAt: finalRevisionCreatedAt,
                        dailyreports: mappedDailyReports,
                        history: mappedDailyReports, // ✅ Backward compatibility for legacy UI components
                        isSupportRequest: false,
                        isPickedUpBySupport: false,
                        assignedForeman: '',
                        helperForemanIds: []
                    } as unknown as MasterTask);
                }
            }
            categories.push({ ...catData, id: catDoc.id, tasks } as Category);
        }
        return categories;
    };

    // ✅ REAL-TIME SYNC: Reverting to a more stable root listener with reactive integration
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const unsubscribeWO = onSnapshot(collection(db, 'workOrders'), async (snapshot) => {
            const ordersPromises = snapshot.docs.map(async (docSnapshot) => {
                const baseData = docSnapshot.data() as WorkOrder;
                const categories = await fetchSubcollections(docSnapshot.id);
                return {
                    ...baseData,
                    status: baseData.status || 'In Progress',
                    id: docSnapshot.id,
                    categories
                };
            });
            
            const fullOrders = await Promise.all(ordersPromises);
            setAllWorkOrders(fullOrders);
            setLoading(false);
        });

        onSnapshot(collection(db, 'projects'), s => setProjects(s.docs.map(d => ({ ...d.data(), id: d.id }) as Project)));
        onSnapshot(collection(db, 'users'), s => {
            const mappedStaff = s.docs.map(docSnapshot => {
                const userData = docSnapshot.data();
                const empId = docSnapshot.id;
                
                let role: 'Foreman' | 'Admin' | 'Manager' | 'BackOffice' | 'Approver' = 'Foreman';
                
                // Align roles according to Labor Standard (Image 3): AM = Admin, FM = Foreman
                if (userData.roleId === 'AM' || userData.roleId === 'PE' || empId === '100051' || empId === '101485' || empId === 'admin1') {
                    role = 'Admin';
                } else if (userData.roleId === 'FM' || userData.roleId === 'GOD' || empId === '101527') {
                    role = 'Foreman';
                }
                
                return {
                    id: empId,
                    employeeId: userData.employeeId || empId,
                    name: userData.name || '',
                    role: role,
                    department: userData.department || '',
                    phone: userData.phone || '',
                    affiliation: userData.department || 'T.T.S. ENGINEERING',
                    profileImage: userData.profileImage || '',
                    username: userData.username || '',
                    password: userData.password || '',
                    assignedProjects: userData.projectLocationIds || [],
                    projectLocationIds: userData.projectLocationIds || [],
                    systemCode: userData.systemCode || ''
                } as Staff;
            }).filter(st => st.systemCode === 'AS'); // Only show users belonging to After Sale (systemCode: "AS")
            setStaff(mappedStaff);
        });
        onSnapshot(collection(db, 'contractors'), s => setContractors(s.docs.map(d => ({ ...d.data(), id: d.id }) as Contractor)));

        return () => unsubscribeWO();
    }, [user]);

    // ✅ Filter and assemble the final list for the UI
    const workOrders = useMemo(() => {
        if (!user) return [];
        let filtered = allWorkOrders;
        if (user.role !== 'Admin' && user.role !== 'BackOffice' && user.role !== 'Manager' && user.role !== 'Approver') {
            filtered = allWorkOrders.filter(wo => {
                const isAssignedProject = user.assignedProjects?.includes(wo.projectId || '');
                // ✅ Check match against BOTH system id and employeeId during transition
                const isReporter = wo.reporterId === user.id || (user.employeeId && wo.reporterId === user.employeeId);
                
                // Also check if they are responsible or assigned as helper for any task in this WO
                const isResponsible = wo.categories?.some(cat => 
                    cat.tasks?.some(task => 
                        task.responsibleStaffIds?.includes(user.id) || 
                        (user.employeeId && task.responsibleStaffIds?.includes(user.employeeId)) ||
                        task.helperForemanIds?.includes(user.id) ||
                        (user.employeeId && task.helperForemanIds?.includes(user.employeeId)) ||
                        task.assignedForeman === user.id ||
                        (user.employeeId && task.assignedForeman === user.employeeId)
                    )
                );

                return isAssignedProject || isReporter || isResponsible;
            });
        }
        return filtered;
    }, [allWorkOrders, user]);

    const getWorkOrderById = (id: string) => workOrders.find(wo => wo.id === id);

    const addWorkOrder = async (wo: WorkOrder) => {
        const isWoaWop = wo.id.toUpperCase().includes('WOA') || wo.id.toUpperCase().includes('WOP');
        
        if (!isWoaWop) {
            // Standard/Legacy write for non-WOA/WOP systems (unmodified)
            const { categories, ...rest } = wo;
            await setDoc(doc(db, 'workOrders', wo.id), rest);
            if (categories && categories.length > 0) {
                const batch = writeBatch(db);
                for (const cat of categories) {
                    const catRef = doc(db, 'workOrders', wo.id, 'categories', cat.id);
                    const { tasks, ...catRest } = cat;
                    batch.set(catRef, catRest);

                    if (tasks) {
                        for (const task of tasks) {
                            const taskRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id);
                            batch.set(taskRef, task);
                        }
                    }
                }
                await batch.commit();
            }
            return;
        }

        // Format categories and tasks to have structured document IDs matching the LB format for WOA/WOP
        const formattedCategories = formatCategoriesAndTasks(wo.id, wo.categories || []);
        const woWithFormattedCategories = {
            ...wo,
            categories: formattedCategories
        };
        const { categories, ...rest } = woWithFormattedCategories;
        
        const parts = wo.id.split('-');
        const workOrderCode = parts.length >= 2 ? parts[parts.length - 2].toUpperCase() : 'WOA';

        // Clean up any existing categories/tasks for this work order to prevent orphans
        try {
            const oldCategoriesSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories'));
            if (!oldCategoriesSnap.empty) {
                const deleteBatch = writeBatch(db);
                for (const catDoc of oldCategoriesSnap.docs) {
                    const oldTasksSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks'));
                    for (const taskDoc of oldTasksSnap.docs) {
                        // Deep delete subtasks, revisions, dailyReports
                        const oldSubtasksSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks'));
                        for (const subtaskDoc of oldSubtasksSnap.docs) {
                            const oldRevisionsSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions'));
                            for (const revDoc of oldRevisionsSnap.docs) {
                                const oldReportsSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports'));
                                for (const reportDoc of oldReportsSnap.docs) {
                                    deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports', reportDoc.id));
                                }
                                deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id));
                            }
                            deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id));
                        }
                        const oldReportsSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport'));
                        for (const reportDoc of oldReportsSnap.docs) {
                            deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport', reportDoc.id));
                        }
                        deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id));
                    }
                    deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id));
                }
                await deleteBatch.commit();
            }
        } catch (error) {
            console.error("Error cleaning up legacy subcollections in addWorkOrder:", error);
        }

        // Store workOrderCode and workOrderId at root document
        const rootDocData = {
            ...rest,
            workOrderCode,
            workOrderId: wo.id
        };
        await setDoc(doc(db, 'workOrders', wo.id), rootDocData);
        
        if (formattedCategories && formattedCategories.length > 0) {
            const batch = writeBatch(db);
            for (const cat of formattedCategories) {
                const catRef = doc(db, 'workOrders', wo.id, 'categories', cat.id);
                const { tasks, ...catRest } = cat;
                
                // Write Category with catName and name
                batch.set(catRef, {
                    ...catRest,
                    catName: cat.name || cat.catName || '',
                    name: cat.name || cat.catName || '',
                    updatedAt: new Date().toISOString()
                });

                if (tasks) {
                    for (const task of tasks) {
                        const { dailyreports, dailyReport, history, ...taskRest } = task;
                        const assignees = await resolveAssignees(task.responsibleStaffIds || []);
                        
                        // Map status to LB
                        let lbStatus = 'upcoming';
                        if (task.status === 'Pending' || task.status === 'Assigned') lbStatus = 'upcoming';
                        else if (task.status === 'In Progress' || task.status === 'in-progress') lbStatus = 'in-progress';
                        else if (task.status === 'Completed' || task.status === 'for-checking') lbStatus = 'for-checking';
                        else if (task.status === 'Verified' || task.status === 'Approved' || task.status === 'completed') lbStatus = 'completed';
                        else if (task.status === 'Rejected') lbStatus = 'in-progress';

                        const taskRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id);
                        batch.set(taskRef, {
                            ...taskRest,
                            taskName: task.name || task.taskName || '',
                            assignees,
                            status: lbStatus,
                            taskId: task.id,
                            workOrderId: wo.id,
                            workOrderCode: workOrderCode, // short code!
                            workOrderName: wo.locationName || '',
                            categoryId: cat.id,
                            categoryName: cat.name || cat.catName || '',
                            projectId: wo.projectId || '',
                            isActive: task.isActive !== false
                        });

                        // Subtask ID: [taskId]-0001
                        const subtaskId = getSubtaskId(task.id);
                        const subtaskRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId);
                        batch.set(subtaskRef, {
                            subtaskId,
                            subtaskName: task.name || task.taskName || '',
                            status: lbStatus,
                            dailyProgress: task.dailyProgress || 0,
                            assignees,
                            currentRevision: task.currentRevision || 'rev00',
                            isActive: true
                        });

                        // Revision ID: task.currentRevision || 'rev00'
                        const revId = task.currentRevision || 'rev00';
                        const revisionRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions', revId);
                        batch.set(revisionRef, {
                            revisionId: revId,
                            revisionName: task.revisionName || 'Initial Revision',
                            status: 'active',
                            createdAt: task.revisionCreatedAt || new Date().toISOString()
                        });

                        const reportsToSave = dailyreports || dailyReport || history || [];
                        for (const report of reportsToSave) {
                            // Document ID is report date YYYY-MM-DD for LB compatibility
                            const reportDate = report.date.includes('T') ? report.date.split('T')[0] : report.date;
                            const reportRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions', revId, 'dailyReports', reportDate);
                            
                            // Map labor fields in reports for LB compatibility on write
                            let mappedReport = { ...report };
                            if (report.labor) {
                                const mappedLabor = report.labor.map((l: any) => ({
                                    ...l,
                                    workerId: l.workerId || l.staffId,
                                    workerName: l.workerName || l.staffName,
                                    staffId: l.staffId || l.workerId,
                                    staffName: l.staffName || l.workerName
                                }));
                                mappedReport.labor = mappedLabor;
                            }
                            batch.set(reportRef, mappedReport);
                        }
                    }
                }
            }
            await batch.commit();
        }
    };

    const saveEvaluation = async (id: string, status: string, categories: any[]) => {
        const isWoaWop = id.toUpperCase().includes('WOA') || id.toUpperCase().includes('WOP');
        
        if (!isWoaWop) {
            // Standard/Legacy write for non-WOA/WOP systems (unmodified)
            const batch = writeBatch(db);
            batch.update(doc(db, 'workOrders', id), { status, lastUpdate: new Date().toISOString() });
            if (categories) {
                for (const cat of categories) {
                    const catRef = doc(db, 'workOrders', id, 'categories', cat.id);
                    const { tasks, ...catRest } = cat;
                    batch.set(catRef, catRest);

                    if (tasks) {
                        for (const task of tasks) {
                            const taskRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id);
                            batch.set(taskRef, task);
                        }
                    }
                }
            }
            await batch.commit();
            return;
        }

        const formattedCategories = formatCategoriesAndTasks(id, categories || []);
        const parentWO = allWorkOrders.find(w => w.id === id);
        const projectId = parentWO?.projectId || '';
        const locationName = parentWO?.locationName || '';
        
        const parts = id.split('-');
        const workOrderCode = parts.length >= 2 ? parts[parts.length - 2].toUpperCase() : 'WOA';
        
        // Clean up any categories/tasks that were actually deleted in the new list to prevent orphans
        try {
            const oldCategoriesSnap = await getDocs(collection(db, 'workOrders', id, 'categories'));
            if (!oldCategoriesSnap.empty) {
                const deleteBatch = writeBatch(db);
                const newCatIds = new Set((categories || []).map(c => c.id));
                const newExecutionTaskIds = new Set((categories || []).flatMap(c => (c.tasks || []).map((t: any) => t.id)));

                for (const catDoc of oldCategoriesSnap.docs) {
                    const oldTasksSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks'));
                    for (const taskDoc of oldTasksSnap.docs) {
                        const taskId = taskDoc.id;
                        
                        // Only delete subcollections & task doc if it is NOT in the new list
                        if (!newExecutionTaskIds.has(taskId)) {
                            const oldSubtasksSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks'));
                            for (const subtaskDoc of oldSubtasksSnap.docs) {
                                const oldRevisionsSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id, 'revisions'));
                                for (const revDoc of oldRevisionsSnap.docs) {
                                    const oldReportsSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports'));
                                    for (const reportDoc of oldReportsSnap.docs) {
                                        deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports', reportDoc.id));
                                    }
                                    deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id));
                                }
                                deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id));
                            }
                            const oldReportsSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'dailyreport'));
                            for (const reportDoc of oldReportsSnap.docs) {
                                deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'dailyreport', reportDoc.id));
                            }
                            deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId));
                        }
                    }
                    if (!newCatIds.has(catDoc.id)) {
                        deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id));
                    }
                }
                await deleteBatch.commit();
            }
        } catch (error) {
            console.error("Error cleaning up legacy subcollections in saveEvaluation:", error);
        }

        // Check if there are any remaining rejected tasks in the new list
        let hasRejectedTasks = false;
        for (const cat of formattedCategories) {
            if (cat.tasks) {
                for (const t of cat.tasks) {
                    if (t.status === 'Rejected' || t.evaluationStatus === 'Rejected') {
                        hasRejectedTasks = true;
                    }
                }
            }
        }

        const batch = writeBatch(db);
        
        // Define root WO updates
        const woUpdates: any = { 
            status, 
            lastUpdate: new Date().toISOString(),
            workOrderCode,
            workOrderId: id
        };

        // Only update reviewedByAdmin if the WO is NOT in customer-Rejected state.
        // When a customer rejects, submitCustomerInspection sets reviewedByAdmin=false.
        // saveEvaluation (admin evaluation flow) must NOT override that flag until
        // the admin explicitly re-assigns via updateTask which handles the transition.
        const isCurrentlyCustomerRejected = parentWO?.status === 'Rejected';
        if (!isCurrentlyCustomerRejected) {
            if (!hasRejectedTasks) {
                woUpdates.reviewedByAdmin = true;
                woUpdates.adminReviewedAt = new Date().toISOString();
            } else {
                woUpdates.reviewedByAdmin = false;
            }
        }


        batch.update(doc(db, 'workOrders', id), woUpdates);

        for (const cat of formattedCategories) {
            const catRef = doc(db, 'workOrders', id, 'categories', cat.id);
            const { tasks, ...catRest } = cat;
            
            // Save Category with name and catName
            batch.set(catRef, {
                ...catRest,
                catName: cat.name || cat.catName || '',
                name: cat.name || cat.catName || '',
                updatedAt: new Date().toISOString()
            });

            if (tasks) {
                for (const task of tasks) {
                    const { dailyreports, dailyReport, history, ...taskRest } = task;
                    const assignees = await resolveAssignees(task.responsibleStaffIds || []);
                    
                    // Map status to LB
                    let lbStatus = 'upcoming';
                    if (task.status === 'Pending' || task.status === 'Assigned') lbStatus = 'upcoming';
                    else if (task.status === 'In Progress' || task.status === 'in-progress') lbStatus = 'in-progress';
                    else if (task.status === 'Completed' || task.status === 'for-checking') lbStatus = 'for-checking';
                    else if (task.status === 'Verified' || task.status === 'Approved' || task.status === 'completed') lbStatus = 'completed';
                    else if (task.status === 'Rejected') lbStatus = 'in-progress';

                    // Ensure that rescheduled/upcoming tasks have their progress value forced to 0%
                    let progressVal = task.dailyProgress || 0;
                    if (lbStatus === 'upcoming') {
                        progressVal = 0;
                    }

                    const taskRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id);
                    batch.set(taskRef, {
                        ...taskRest,
                        taskName: task.name || task.taskName || '',
                        assignees,
                        status: lbStatus,
                        dailyProgress: progressVal, // Force progress reset if rescheduling
                        evaluationStatus: task.status, // Keep track of the actual evaluation decision ('Assigned' | 'Approved' | 'Rejected')
                        taskId: task.id,
                        workOrderId: id,
                        workOrderCode: workOrderCode, // short code!
                        workOrderName: locationName,
                        categoryId: cat.id,
                        categoryName: cat.name || cat.catName || '',
                        projectId: projectId,
                        isActive: task.isActive !== false
                    });

                    // Subtask ID: [taskId]-0001
                    const subtaskId = getSubtaskId(task.id);
                    const subtaskRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId);
                    batch.set(subtaskRef, {
                        subtaskId,
                        subtaskName: task.name || task.taskName || '',
                        status: lbStatus,
                        dailyProgress: progressVal,
                        assignees,
                        subtaskOperatorId: task.subtaskOperatorId || (task.responsibleStaffIds && task.responsibleStaffIds[0]) || "",
                        currentRevision: task.currentRevision || 'rev00',
                        isActive: true
                    });

                    // Revision ID: task.currentRevision || 'rev00'
                    const revId = task.currentRevision || 'rev00';
                    const revisionRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions', revId);
                    batch.set(revisionRef, {
                        revisionId: revId,
                        revisionName: task.revisionName || 'Initial Revision',
                        status: 'active',
                        createdAt: task.revisionCreatedAt || new Date().toISOString()
                    });

                    // Skip writing/recreating daily reports during saveEvaluation.
                    // This prevents cloning old reports to the new revision context.
                }
            }
        }
        await batch.commit();
    };

    const addTaskUpdate = async (workOrderId: string, categoryId: string, taskId: string, report: DailyReport) => {
        // Ensure date is in a clean YYYY-MM-DD format for dashboard filtering if it's an ISO string
        const reportDate = report.date.includes('T') ? report.date.split('T')[0] : report.date;
        
        const finalReport = {
            ...report,
            date: reportDate, // Standardize to YYYY-MM-DD for consistency
            serverTimestamp: new Date().toISOString() // Keep track of when it was actually clicked
        };

        const isWoaWop = workOrderId.toUpperCase().includes('WOA') || workOrderId.toUpperCase().includes('WOP');
        const isSubtaskId = taskId.split('-').length === 4;
        const parentTaskId = isSubtaskId ? taskId.split('-').slice(0, 3).join('-') : taskId;
        const subtaskId = isSubtaskId ? taskId : getSubtaskId(taskId);

        const taskDoc = allWorkOrders.find(w => w?.id === workOrderId)?.categories?.find(c => c?.id === categoryId)?.tasks?.find(t => t?.id === parentTaskId);
        const currentRev = taskDoc?.currentRevision || 'rev00';

        const isHelperReport = isSubtaskId || taskDoc?.helperForemanIds?.includes(report.createdBy) || taskDoc?.assignedForeman === report.createdBy;

        if (isWoaWop) {
            if (isHelperReport) {
                const helpId = currentRev.replace('rev', 'help');
                const helpDocRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'help', helpId);
                await setDoc(helpDocRef, { helpId, createdAt: new Date().toISOString() }, { merge: true });

                // Save helper daily report
                const reportRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'help', helpId, 'dailyReports', reportDate);
                await setDoc(reportRef, finalReport);

                // Step 2: Trigger daily report sync API immediately after successful write
                try {
                    const reportPath = `workOrders/${workOrderId}/categories/${categoryId}/tasks/${parentTaskId}/subtasks/${subtaskId}/help/${helpId}/dailyReports/${reportDate}`;
                    console.log('Syncing helper daily report to LB API...', { reportPath, reportDate });
                    const syncResponse = await fetch('https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reportPath,
                            reportDate
                        })
                    });

                    if (!syncResponse.ok) {
                        console.error('Failed to sync helper daily report:', syncResponse.status, await syncResponse.text());
                    } else {
                        console.log('Successfully synced helper daily report to LB API');
                    }
                } catch (syncError) {
                    console.error('Error calling syncDailyReport API for helper:', syncError);
                }
            } else {
                // ✅ Ensure revision document exists (prevents phantom doc bug where getDocs returns empty)
                const revDocRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'revisions', currentRev);
                await setDoc(revDocRef, { revisionId: currentRev, createdAt: new Date().toISOString() }, { merge: true });

                // Save daily report with date YYYY-MM-DD as document ID for LB compatibility
                const reportRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'revisions', currentRev, 'dailyReports', reportDate);
                await setDoc(reportRef, finalReport);

                // Step 2: Trigger daily report sync API immediately after successful write
                try {
                    const reportPath = `workOrders/${workOrderId}/categories/${categoryId}/tasks/${parentTaskId}/subtasks/${subtaskId}/revisions/${currentRev}/dailyReports/${reportDate}`;
                    console.log('Syncing daily report to LB API...', { reportPath, reportDate });
                    const syncResponse = await fetch('https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reportPath,
                            reportDate
                        })
                    });

                    if (!syncResponse.ok) {
                        console.error('Failed to sync daily report:', syncResponse.status, await syncResponse.text());
                    } else {
                        console.log('Successfully synced daily report to LB API');
                    }
                } catch (syncError) {
                    console.error('Error calling syncDailyReport API:', syncError);
                }
            }
        } else {
            const reportRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'dailyreport', report.id);
            await setDoc(reportRef, finalReport);
        }

        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId);
        
        if (taskDoc) {
            if (isHelperReport) {
                // Bypass progress/status updates, only update updatedAt on task doc
                await updateDoc(taskRef, {
                    updatedAt: new Date().toISOString()
                });
            } else {
                const isCompleted = report.progress === 100 || (taskDoc.dailyProgress === 100);
                const newProgress = Math.max(taskDoc.dailyProgress || 0, report.progress || 0);
                
                // Map status values for LB compatibility
                let lbStatus = isCompleted ? 'for-checking' : 'in-progress';
                
                if (isWoaWop) {
                    await updateDoc(taskRef, {
                        dailyProgress: newProgress,
                        status: lbStatus,
                        updatedAt: new Date().toISOString()
                    });

                    // Update subtask as well
                    const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId);
                    await updateDoc(subtaskRef, {
                        dailyProgress: newProgress,
                        status: lbStatus
                    });
                } else {
                    await updateDoc(taskRef, {
                        dailyProgress: newProgress,
                        status: isCompleted ? 'Completed' : 'In Progress',
                        updatedAt: new Date().toISOString()
                    });
                }
            }
        }
        await updateDoc(doc(db, 'workOrders', workOrderId), { lastUpdate: new Date().toISOString() });
    };

    const updateTask = async (workOrderId: string, categoryId: string, taskId: string, updates: Partial<MasterTask>) => {
        const isWoaWop = workOrderId.toUpperCase().includes('WOA') || workOrderId.toUpperCase().includes('WOP');
        const isSubtaskId = taskId.split('-').length === 4;
        const parentTaskId = isSubtaskId ? taskId.split('-').slice(0, 3).join('-') : taskId;
        const subtaskId = isSubtaskId ? taskId : getSubtaskId(taskId);

        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId);
        
        // Check if subtasks exist for this task in the database
        const subtasksRef = collection(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks');
        const subtasksSnap = await getDocs(subtasksRef);
        const hasSubtasks = !subtasksSnap.empty;

        const taskDocSnap = await getDoc(taskRef);
        if (!taskDocSnap.exists()) {
            await updateDoc(taskRef, updates);
            return;
        }

        const taskData = taskDocSnap.data();
        
        // Resolve LB status
        let lbStatus = taskData.status || 'upcoming';
        if (updates.status) {
            if (updates.status === 'Pending' || updates.status === 'Assigned') lbStatus = 'upcoming';
            else if (updates.status === 'In Progress' || updates.status === 'in-progress') lbStatus = 'in-progress';
            else if (updates.status === 'Completed' || updates.status === 'for-checking') lbStatus = 'for-checking';
            else if (updates.status === 'Verified' || updates.status === 'Approved' || updates.status === 'completed') lbStatus = 'completed';
            else if (updates.status === 'Rejected') lbStatus = 'in-progress'; // Rejected moves to in-progress under LB standard
        }

        // Resolve assignees if staff changed
        const resolvedAssignees = updates.responsibleStaffIds
            ? await resolveAssignees(updates.responsibleStaffIds)
            : undefined;

        if (isSubtaskId) {
            // Only update the subtask document and help/revisions
            const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId);
            const subtaskDocSnap = await getDoc(subtaskRef);
            const subtaskData = subtaskDocSnap.exists() ? subtaskDocSnap.data() : null;

            const currentRev = updates.currentRevision || subtaskData?.currentRevision || 'rev00';
            const revisionName = updates.revisionName || updates.notes || subtaskData?.revisionName || taskData?.revisionName || 'มาช่วยกันเร็ว';
            const taskName = subtaskData?.subtaskName || taskData?.taskName || taskData?.name || 'มาช่วยกันเร็ว';

            const helperAssignees = (updates.helperForemanIds || []).map((fid: string) => {
                const s = staff.find(x => x.id === fid || x.employeeId === fid);
                return {
                    employeeId: fid,
                    name: s ? s.name : '',
                    roleId: s ? (s.role === 'Admin' ? 'AM' : 'FM') : 'FM'
                };
            });

            const subtaskUpdates: any = {};
            if (updates.status) subtaskUpdates.status = lbStatus;
            if (updates.dailyProgress !== undefined) subtaskUpdates.dailyProgress = updates.dailyProgress;
            if (updates.currentRevision) subtaskUpdates.currentRevision = updates.currentRevision;
            if (updates.isSupportRequest !== undefined) subtaskUpdates.isSupportRequest = updates.isSupportRequest;
            if (updates.isPickedUpBySupport !== undefined) subtaskUpdates.isPickedUpBySupport = updates.isPickedUpBySupport;

            if (updates.isPickedUpBySupport === true) {
                subtaskUpdates.supportAssignees = helperAssignees;
                subtaskUpdates.supportTaskName = revisionName;
                subtaskUpdates.supportCreatedAt = new Date();
                subtaskUpdates.supportedRevisionIds = [currentRev];
            } else if (updates.isPickedUpBySupport === false) {
                subtaskUpdates.supportAssignees = [];
                subtaskUpdates.supportTaskName = '';
                subtaskUpdates.supportCreatedAt = null;
                subtaskUpdates.supportedRevisionIds = [];
            }
            
            // Note: do NOT update parent task doc at all for helper subtask edits!
            await updateDoc(subtaskRef, subtaskUpdates);
            
            // Revisions and Help subcollections updates:
            const revisionRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'revisions', currentRev);
            await setDoc(revisionRef, {
                revisionId: currentRev,
                revisionName: updates.revisionName || 'Revision',
                status: 'active',
                createdAt: new Date().toISOString()
            }, { merge: true });

            if (updates.isPickedUpBySupport === true) {
                const helpId = currentRev.replace('rev', 'help');
                const helpDocRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'help', helpId);
                await setDoc(helpDocRef, {
                    revisionId: helpId,
                    revisionName: revisionName,
                    taskName: taskName,
                    assignees: helperAssignees,
                    createdAt: new Date(),
                    createdBy: user?.employeeId || user?.id || 'admin'
                });
            }
            await updateDoc(doc(db, 'workOrders', workOrderId), { lastUpdate: new Date().toISOString() });
            return;
        }

        // Apply updates to task document
        const mappedUpdates: any = { ...updates };
        if (updates.name) mappedUpdates.taskName = updates.name;
        if (updates.status) mappedUpdates.status = lbStatus;
        if (updates.responsibleStaffIds && updates.responsibleStaffIds.length > 0) {
            mappedUpdates.subtaskOperatorId = updates.responsibleStaffIds[0];
            if (resolvedAssignees) {
                mappedUpdates.assignees = resolvedAssignees;
            }
        }

        await updateDoc(taskRef, mappedUpdates);

        // Identify which subtask IDs need to be updated. If subtasks exist in Firestore, update all of them!
        const subtaskIdsToUpdate: string[] = [];
        if (hasSubtasks) {
            subtasksSnap.docs.forEach(doc => {
                subtaskIdsToUpdate.push(doc.id);
            });
        } else {
            subtaskIdsToUpdate.push(getSubtaskId(taskId));
        }

        for (const subtaskId of subtaskIdsToUpdate) {
            const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId);
            const subtaskDocSnap = await getDoc(subtaskRef);
            const subtaskData = subtaskDocSnap.exists() ? subtaskDocSnap.data() : null;

            const currentRev = updates.currentRevision || subtaskData?.currentRevision || 'rev00';
            const revisionName = updates.revisionName || updates.notes || subtaskData?.revisionName || taskData?.revisionName || 'มาช่วยกันเร็ว';
            const taskName = subtaskData?.subtaskName || taskData?.taskName || taskData?.name || 'มาช่วยกันเร็ว';

            const helperAssignees = (updates.helperForemanIds || []).map((fid: string) => {
                const s = staff.find(x => x.id === fid || x.employeeId === fid);
                return {
                    employeeId: fid,
                    name: s ? s.name : '',
                    roleId: s ? (s.role === 'Admin' ? 'AM' : 'FM') : 'FM'
                };
            });

            const subtaskUpdates: any = {};
            if (updates.status) subtaskUpdates.status = lbStatus;
            if (updates.dailyProgress !== undefined) subtaskUpdates.dailyProgress = updates.dailyProgress;
            if (updates.currentRevision) subtaskUpdates.currentRevision = updates.currentRevision;
            if (updates.isSupportRequest !== undefined) subtaskUpdates.isSupportRequest = updates.isSupportRequest;
            if (updates.isPickedUpBySupport !== undefined) subtaskUpdates.isPickedUpBySupport = updates.isPickedUpBySupport;
            if (updates.responsibleStaffIds && updates.responsibleStaffIds.length > 0) {
                subtaskUpdates.subtaskOperatorId = updates.responsibleStaffIds[0];
                if (resolvedAssignees) {
                    subtaskUpdates.assignees = resolvedAssignees;
                }
            }

            if (updates.isPickedUpBySupport === true) {
                subtaskUpdates.supportAssignees = helperAssignees;
                subtaskUpdates.supportTaskName = revisionName;
                subtaskUpdates.supportCreatedAt = new Date();
                subtaskUpdates.supportedRevisionIds = [currentRev];
            } else if (updates.isPickedUpBySupport === false) {
                subtaskUpdates.supportAssignees = [];
                subtaskUpdates.supportTaskName = '';
                subtaskUpdates.supportCreatedAt = null;
                subtaskUpdates.supportedRevisionIds = [];
            }

            if (subtaskDocSnap.exists()) {
                await updateDoc(subtaskRef, subtaskUpdates);
            } else {
                // Write subtask if it doesn't exist
                const assignees = taskData.assignees || [];
                await setDoc(subtaskRef, {
                    subtaskId,
                    subtaskName: taskData.taskName || taskData.name || '',
                    status: lbStatus,
                    dailyProgress: updates.dailyProgress !== undefined ? updates.dailyProgress : (taskData.dailyProgress || 0),
                    assignees,
                    subtaskOperatorId: updates.responsibleStaffIds?.[0] || taskData.subtaskOperatorId || (taskData.responsibleStaffIds && taskData.responsibleStaffIds[0]) || "",
                    currentRevision: updates.currentRevision || taskData.currentRevision || 'rev00',
                    isActive: true,
                    isSupportRequest: updates.isSupportRequest !== undefined ? updates.isSupportRequest : (taskData.isSupportRequest || false),
                    isPickedUpBySupport: updates.isPickedUpBySupport !== undefined ? updates.isPickedUpBySupport : (taskData.isPickedUpBySupport || false),
                    supportAssignees: updates.isPickedUpBySupport === true ? helperAssignees : [],
                    supportTaskName: updates.isPickedUpBySupport === true ? revisionName : '',
                    supportCreatedAt: updates.isPickedUpBySupport === true ? new Date() : null,
                    supportedRevisionIds: updates.isPickedUpBySupport === true ? [currentRev] : []
                });
            }

            // If currentRevision changed or we have updates like rejectReason/revisionName, write/update revision document
            const revisionRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'revisions', currentRev);
            const revisionData: any = {
                revisionId: currentRev,
                revisionName: updates.revisionName || updates.notes || subtaskData?.revisionName || taskData?.revisionName || 'Revision',
                status: 'active',
                createdAt: updates.revisionCreatedAt || taskData.revisionCreatedAt || new Date().toISOString()
            };
            await setDoc(revisionRef, revisionData, { merge: true });

            // If helper assigned, initialize/update help subcollection
            if (updates.isPickedUpBySupport === true) {
                const helpId = currentRev.replace('rev', 'help');
                const helpDocRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'help', helpId);
                await setDoc(helpDocRef, {
                    revisionId: helpId,
                    revisionName: revisionName,
                    taskName: taskName,
                    assignees: helperAssignees,
                    createdAt: new Date(),
                    createdBy: user?.employeeId || user?.id || 'admin'
                });
            }
        }

        // Auto-transition Rejected Work Orders to In Progress if all tasks are resolved (re-assigned)
        try {
            const woRef = doc(db, 'workOrders', workOrderId);
            const woSnap = await getDoc(woRef);
            if (woSnap.exists()) {
                const woData = woSnap.data();
                if (woData.status === 'Rejected') {
                    const categoriesSnap = await getDocs(collection(db, 'workOrders', workOrderId, 'categories'));
                    let hasOtherRejected = false;
                    for (const catDoc of categoriesSnap.docs) {
                        const tasksSnap = await getDocs(collection(db, 'workOrders', workOrderId, 'categories', catDoc.id, 'tasks'));
                        for (const taskDoc of tasksSnap.docs) {
                            if (taskDoc.id === taskId) {
                                if (updates.evaluationStatus === 'Rejected' || updates.status === 'Rejected') {
                                    hasOtherRejected = true;
                                }
                            } else {
                                const tData = taskDoc.data();
                                if (tData.evaluationStatus === 'Rejected' || tData.status === 'Rejected') {
                                    hasOtherRejected = true;
                                }
                            }
                        }
                    }
                    if (!hasOtherRejected) {
                        await updateDoc(woRef, {
                            status: 'In Progress',
                            reviewedByAdmin: true,
                            pendingAdminReassign: false, // admin has re-assigned, foremen unlocked
                            reviewedAt: new Date().toISOString(),
                            adminReviewedAt: new Date().toISOString(),
                            lastUpdate: new Date().toISOString()
                        });
                    }
                }
            }
        } catch (err) {
            console.error("Failed to transition Work Order status in updateTask:", err);
        }
    };

    const updateWorkOrderStatus = async (id: string, status: string) => {
        await updateDoc(doc(db, 'workOrders', id), { status, lastUpdate: new Date().toISOString() });
    };

    const requestRetroactiveUnlock = async (workOrderId: string, categoryId: string, taskId: string, date: string, reason: string) => {
        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
        const taskDoc = allWorkOrders.find(w => w?.id === workOrderId)?.categories?.find(c => c?.id === categoryId)?.tasks?.find(t => t?.id === taskId);
        
        // For demonstration, we auto-approve the unlock for 24 hours.
        // In a full implementation, this would send a notification to the Admin and wait for approval.
        const unlockedDates = taskDoc?.unlockedDates || {};
        unlockedDates[date] = {
            unlockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
            reason: reason
        };

        await updateDoc(taskRef, {
            unlockedDates
        });
    };

    const logCustomerQrView = async (woId: string) => {
        try {
            const woRef = doc(db, 'workOrders', woId);
            const woSnap = await getDoc(woRef);
            if (woSnap.exists()) {
                const data = woSnap.data();
                if (!data.inspectionTimeline || !data.inspectionTimeline.qrOpenedAt) {
                    const now = new Date().toISOString();
                    await updateDoc(woRef, {
                        'inspectionTimeline.qrOpenedAt': now,
                        lastUpdate: now
                    });
                    console.log('Customer scanned/opened QR link successfully logged:', now);
                }
            }
        } catch (err) {
            console.error('Failed to log customer QR view:', err);
        }
    };

    const generateDeliveryQrToken = async (woId: string, ownerId: string) => {
        // Generate secure random token
        const array = new Uint32Array(4);
        window.crypto.getRandomValues(array);
        const token = Array.from(array, dec => dec.toString(16).padStart(8, '0')).join('');
        
        const now = new Date().toISOString();
        await updateDoc(doc(db, 'workOrders', woId), {
            status: 'pending_delivery',
            woOwnerId: ownerId,
            deliveryQrToken: token,
            'inspectionTimeline.qrGeneratedAt': now,
            lastUpdate: now
        });
        
        return token;
    };

    const submitCustomerInspection = async (
        woId: string, 
        approvals: Record<string, { 
            status: 'approved' | 'rejected'; 
            reason?: string; 
            defectCategories?: Record<string, boolean>;
            contactName?: string;
            contactPhone?: string;
        }>,
        survey?: {
            workQuality: number;
            siteCleanliness: number;
            foremanProfessionalism: number;
            specAccuracy: number;
            handoverCare: number;
        }
    ) => {
        const woRef = doc(db, 'workOrders', woId);
        const woSnap = await getDoc(woRef);
        if (!woSnap.exists()) throw new Error('Work Order not found');
        const woData = woSnap.data() || {};

        const now = new Date().toISOString();
        
        let hasRejections = false;
        const rejectedTaskNames: string[] = [];
        
        // Loop through categories and tasks to apply customer decision
        const categoriesSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
        for (const catDoc of categoriesSnap.docs) {
            const tasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
            for (const taskDoc of tasksSnap.docs) {
                const taskData = taskDoc.data();
                const taskId = taskDoc.id;
                const decision = approvals[taskId];
                
                if (!decision) continue; // Skip if no decision for this task

                const subtaskId = getSubtaskId(taskId);
                const subtaskRef = doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId);
                const currentRev = taskData.currentRevision || 'rev00';
                
                if (decision.status === 'approved') {
                    // Update task to Verified / completed
                    await updateDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId), {
                        status: 'completed', // LB completed = Verified
                        evaluationStatus: 'Approved',
                        updatedAt: now
                    });
                    await setDoc(subtaskRef, {
                        status: 'completed'
                    }, { merge: true });
                    
                    // Close the current active revision
                    const revisionRef = doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', currentRev);
                    await setDoc(revisionRef, {
                        status: 'closed_approved',
                        approvedAt: now
                    }, { merge: true });

                    // Send notification to the foreman responsible for this task
                    try {
                        const foremanId = taskData.subtaskOperatorId || (taskData.responsibleStaffIds && taskData.responsibleStaffIds[0]) || woData.woOwnerId || woData.reporterId || 'unknown';
                        if (foremanId && foremanId !== 'unknown') {
                            await addDoc(collection(db, 'notifications'), {
                                recipientId: foremanId,
                                senderId: 'customer',
                                senderName: 'ลูกค้า',
                                title: 'งานได้รับการอนุมัติจากลูกค้า',
                                message: `งาน "${taskData.taskName || taskData.name || taskId}" (ใบงาน ${woId}) ได้รับการอนุมัติผ่านจากลูกค้าเรียบร้อยแล้ว`,
                                type: 'success',
                                targetPath: `/daily-report?id=${woId}`,
                                isRead: false,
                                createdAt: serverTimestamp()
                            });
                        }
                    } catch (notifyErr) {
                        console.error("Failed to send approval notification to foreman:", notifyErr);
                    }
                } else if (decision.status === 'rejected') {
                    hasRejections = true;
                    rejectedTaskNames.push(taskData.taskName || taskData.name || taskId);
                    
                    // Close current revision as rejected
                    const currentRevisionRef = doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', currentRev);
                    await setDoc(currentRevisionRef, {
                        status: 'closed_rejected',
                        rejectReason: decision.reason || '',
                        defectCategories: decision.defectCategories || {},
                        contactName: decision.contactName || '',
                        contactPhone: decision.contactPhone || '',
                        rejectedAt: now
                    }, { merge: true });
                    
                    // Increment revision number
                    const revNum = parseInt(currentRev.replace('rev', '')) || 0;
                    const nextRev = `rev${String(revNum + 1).padStart(2, '0')}`;
                    
                    // Clean task name of any existing (REV. X) suffix
                    const cleanName = (taskData.taskName || taskData.name || '').replace(/\s*\(REV\.\s*\d+\)/gi, '').trim();
                    
                    // Default assignee is the Work Order Owner Foreman!
                    const ownerId = woData.woOwnerId || woData.reporterId || 'unknown';
                    const assignees = await resolveAssignees([ownerId]);

                    await updateDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId), {
                        status: 'in-progress', // LB in-progress
                        evaluationStatus: 'Rejected',
                        dailyProgress: 0,
                        currentRevision: nextRev,
                        taskName: cleanName,
                        name: cleanName,
                        rejectReason: decision.reason || '',
                        contactName: decision.contactName || '',
                        contactPhone: decision.contactPhone || '',
                        revisionCreatedAt: now,
                        responsibleStaffIds: [ownerId],
                        assignees: assignees,
                        subtaskOperatorId: ownerId,
                        updatedAt: now
                    });
                    
                    await setDoc(subtaskRef, {
                        status: 'in-progress',
                        dailyProgress: 0,
                        currentRevision: nextRev,
                        assignees: assignees,
                        subtaskOperatorId: ownerId
                    }, { merge: true });
                    
                    // Create new revision doc
                    const newRevisionRef = doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', nextRev);
                    await setDoc(newRevisionRef, {
                        revisionId: nextRev,
                        revisionName: `Revision ${revNum + 1}`,
                        status: 'active',
                        createdAt: now
                    });
                    
                    // Send notification to the foreman originally assigned (or the WO owner foreman who will re-do it)
                    try {
                        const origForemanId = taskData.subtaskOperatorId || (taskData.responsibleStaffIds && taskData.responsibleStaffIds[0]) || ownerId;
                        if (origForemanId && origForemanId !== 'unknown') {
                            await addDoc(collection(db, 'notifications'), {
                                recipientId: origForemanId,
                                senderId: 'customer',
                                senderName: 'ลูกค้า',
                                title: 'งานถูกปฏิเสธโดยลูกค้า',
                                message: `งาน "${cleanName}" (ใบงาน ${woId}) ถูกปฏิเสธจากลูกค้า: ${decision.reason || 'กรุณาตรวจสอบและแก้ไข'}`,
                                type: 'error',
                                targetPath: `/daily-report?id=${woId}`,
                                isRead: false,
                                createdAt: serverTimestamp()
                            });
                        }
                    } catch (notifyErr) {
                        console.error("Failed to send reject notification to foreman:", notifyErr);
                    }
                    
                    // IMPORTANT: Do NOT clone labor records or daily reports into the new revision!
                    // This satisfies the constraint to start the new revision from a clean slate.
                }
            }
        }
        
        // Update root WO Document
        const woUpdates: any = {
            'inspectionTimeline.inspectionSubmittedAt': now,
            lastUpdate: now
        };
        
        if (hasRejections) {
            woUpdates.status = 'Rejected';
            woUpdates.reviewedByAdmin = false;
            woUpdates.pendingAdminReassign = true; // gate: foremen locked until admin re-assigns

            // Send notification to Admins
            try {
                await addDoc(collection(db, 'notifications'), {
                    recipientRole: 'Admin',
                    senderId: 'customer',
                    senderName: 'ลูกค้า',
                    title: 'ใบงานถูกปฏิเสธโดยลูกค้า',
                    message: `ใบงาน ${woId} ถูกปฏิเสธในรายการ: ${rejectedTaskNames.join(', ')}`,
                    type: 'error',
                    targetPath: `/evaluation`,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
            } catch (notifyErr) {
                console.error("Failed to send reject notification to admin:", notifyErr);
            }
        } else {
            woUpdates.status = 'Completed';
            woUpdates.completedAt = now;
            if (survey) {
                woUpdates.satisfactionSurvey = {
                    ...survey,
                    submittedAt: now
                };
            }

            // Send notification to Admins for successful completion
            try {
                await addDoc(collection(db, 'notifications'), {
                    recipientRole: 'Admin',
                    senderId: 'customer',
                    senderName: 'ลูกค้า',
                    title: 'ใบงานได้รับการอนุมัติ (สำเร็จ)',
                    message: `ใบงาน ${woId} ได้รับการตรวจสอบและอนุมัติผ่านจากลูกค้าเรียบร้อยแล้ว`,
                    type: 'success',
                    targetPath: `/evaluation`,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
            } catch (notifyErr) {
                console.error("Failed to send approval notification to admin:", notifyErr);
            }
        }
        
        await updateDoc(woRef, woUpdates);
    };

    const deleteWorkOrder = async (id: string) => {
        await updateDoc(doc(db, 'workOrders', id), { status: 'Cancelled', isArchived: true });
    };

    const archiveWorkOrder = async (id: string) => {
        await updateDoc(doc(db, 'workOrders', id), { isArchived: true });
    };

    const markWorkOrderAsReviewed = async (id: string) => {
        try {
            await updateDoc(doc(db, 'workOrders', id), { 
                reviewedByAdmin: true,
                pendingAdminReassign: false,
                reviewedAt: new Date().toISOString(),
                adminReviewedAt: new Date().toISOString()
            });
        } catch (err) {
            console.error("Failed to mark as reviewed:", err);
        }
    };

    const markWorkOrderAsOpenedByAdmin = async (id: string) => {
        try {
            const woRef = doc(db, 'workOrders', id);
            const woSnap = await getDoc(woRef);
            if (woSnap.exists()) {
                const data = woSnap.data();
                if (!data.adminReviewedAt) {
                    await updateDoc(woRef, {
                        adminReviewedAt: new Date().toISOString(),
                        lastUpdate: new Date().toISOString()
                    });
                }
            }
        } catch (err) {
            console.error("Failed to mark work order as opened by admin:", err);
        }
    };

    const requestSupport = async (workOrderId: string, categoryId: string, taskId: string) => {
        try {
            const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
            await updateDoc(taskRef, {
                isSupportRequest: true,
                isPickedUpBySupport: false
            });

            const subtaskId = getSubtaskId(taskId);
            const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', subtaskId);
            const subtaskSnap = await getDoc(subtaskRef);
            if (subtaskSnap.exists()) {
                await updateDoc(subtaskRef, {
                    isSupportRequest: true,
                    isPickedUpBySupport: false
                });
            }
        } catch (err) {
            console.error("Failed to request support:", err);
            throw err;
        }
    };

    return (
        <WorkOrderContext.Provider value={{
            workOrders,
            getWorkOrderById,
            updateTask,
            addWorkOrder,
            updateWorkOrderStatus,
            saveEvaluation,
            addTaskUpdate,
            projects,
            staff,
            contractors,
            loading,
            deleteWorkOrder,
            archiveWorkOrder,
            markWorkOrderAsReviewed,
            requestRetroactiveUnlock,
            generateDeliveryQrToken,
            submitCustomerInspection,
            logCustomerQrView,
            markWorkOrderAsOpenedByAdmin,
            requestSupport
        }}>
            {children}
        </WorkOrderContext.Provider>
    );
};

export const useWorkOrders = () => {
    const context = useContext(WorkOrderContext);
    if (context === undefined) {
        throw new Error('useWorkOrders must be used within a WorkOrderProvider');
    }
    return context;
};
