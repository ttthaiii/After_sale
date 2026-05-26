import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { WorkOrder, Category, MasterTask, DailyReport, Project, Staff, Contractor } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
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
    const projectCode = parts[0].toUpperCase();                                        // "ART"
    const jobCode     = parts.length >= 2 ? parts[parts.length - 2].toUpperCase() : 'WOA'; // "WOA"
    const woSeq       = parts.length >= 1 ? parts[parts.length - 1] : '0001';          // "0002"

    // Global task counter — increments across ALL categories in this WO (prevents internal dups)
    let globalTaskCounter = 0;

    return categories.map((cat, catIndex) => {
        const catName = (cat.name || '').trim().toLowerCase();
        const listIndex = CATEGORIES_LIST.findIndex(n => n.trim().toLowerCase() === catName);

        // 1-indexed category type position; fallback to array position if name not found
        const position = listIndex >= 0 ? listIndex + 1 : catIndex + 1;

        // Category ID: JobCode-CatTypeSeq4digits (no project code prefix to match LB)
        // e.g. WOA-0004 or DBD-0001
        const computedCatId = `${jobCode}-${String(position).padStart(4, '0')}`;

        // Task ID: ProjectCode-JobCode-WOSeq-globalTaskSeq7digits
        // e.g. ART-WOA-0002-0000001  (globally unique across all projects and WOs)
        const tasks = cat.tasks ? cat.tasks.map((task: any) => {
            globalTaskCounter++;
            const computedTaskId = `${projectCode}-${jobCode}-${woSeq}-${String(globalTaskCounter).padStart(7, '0')}`;
            return {
                ...task,
                id: computedTaskId,
                taskCode: computedTaskId,
                catId: computedCatId
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
                
                if (!subtasksSnap.empty) {
                    for (const subtaskDoc of subtasksSnap.docs) {
                        const revisionsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions'));
                        for (const revDoc of revisionsSnap.docs) {
                            const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports'));
                            for (const reportDoc of reportsSnap.docs) {
                                dailyreports.push({
                                    ...reportDoc.data(),
                                    id: reportDoc.id
                                } as unknown as DailyReport);
                            }
                        }
                    }
                } else {
                    const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport'));
                    dailyreports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id }) as DailyReport);
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
                }

                tasks.push({ 
                    ...taskData, 
                    id: taskDoc.id, 
                    name,
                    taskName: name,
                    responsibleStaffIds,
                    status,
                    taskCode,
                    dailyreports: mappedDailyReports,
                    history: mappedDailyReports // ✅ Backward compatibility for legacy UI components
                } as unknown as MasterTask);
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
                
                // Also check if they are responsible for any task in this WO
                const isResponsible = wo.categories?.some(cat => 
                    cat.tasks?.some(task => 
                        task.responsibleStaffIds?.includes(user.id) || 
                        (user.employeeId && task.responsibleStaffIds?.includes(user.employeeId))
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
                        const subtaskId = `${task.id}-0001`;
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
        
        // Clean up any existing categories/tasks for this work order to prevent orphans
        try {
            const oldCategoriesSnap = await getDocs(collection(db, 'workOrders', id, 'categories'));
            if (!oldCategoriesSnap.empty) {
                const deleteBatch = writeBatch(db);
                for (const catDoc of oldCategoriesSnap.docs) {
                    const oldTasksSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks'));
                    for (const taskDoc of oldTasksSnap.docs) {
                        // Deep delete subtasks, revisions, dailyReports
                        const oldSubtasksSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks'));
                        for (const subtaskDoc of oldSubtasksSnap.docs) {
                            const oldRevisionsSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions'));
                            for (const revDoc of oldRevisionsSnap.docs) {
                                const oldReportsSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports'));
                                for (const reportDoc of oldReportsSnap.docs) {
                                    deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports', reportDoc.id));
                                }
                                deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id));
                            }
                            deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id));
                        }
                        const oldReportsSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport'));
                        for (const reportDoc of oldReportsSnap.docs) {
                            deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport', reportDoc.id));
                        }
                        deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id));
                    }
                    deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id));
                }
                await deleteBatch.commit();
            }
        } catch (error) {
            console.error("Error cleaning up legacy subcollections in saveEvaluation:", error);
        }

        const batch = writeBatch(db);
        batch.update(doc(db, 'workOrders', id), { 
            status, 
            lastUpdate: new Date().toISOString(),
            workOrderCode,
            workOrderId: id
        });

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

                    const taskRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id);
                    batch.set(taskRef, {
                        ...taskRest,
                        taskName: task.name || task.taskName || '',
                        assignees,
                        status: lbStatus,
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
                    const subtaskId = `${task.id}-0001`;
                    const subtaskRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId);
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
                    const revisionRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions', revId);
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
                        const reportRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions', revId, 'dailyReports', reportDate);
                        
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
        const taskDoc = allWorkOrders.find(w => w?.id === workOrderId)?.categories?.find(c => c?.id === categoryId)?.tasks?.find(t => t?.id === taskId);
        const currentRev = taskDoc?.currentRevision || 'rev00';
        const subtaskId = `${taskId}-0001`;

        if (isWoaWop) {
            // Save daily report with date YYYY-MM-DD as document ID for LB compatibility
            const reportRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', currentRev, 'dailyReports', reportDate);
            await setDoc(reportRef, finalReport);

            // Step 2: Trigger daily report sync API immediately after successful write
            try {
                const reportPath = `workOrders/${workOrderId}/categories/${categoryId}/tasks/${taskId}/subtasks/${subtaskId}/revisions/${currentRev}/dailyReports/${reportDate}`;
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
        } else {
            const reportRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'dailyreport', report.id);
            await setDoc(reportRef, finalReport);
        }

        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
        
        if (taskDoc) {
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
                const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', subtaskId);
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
        await updateDoc(doc(db, 'workOrders', workOrderId), { lastUpdate: new Date().toISOString() });
    };

    const updateTask = async (workOrderId: string, categoryId: string, taskId: string, updates: Partial<MasterTask>) => {
        const isWoaWop = workOrderId.toUpperCase().includes('WOA') || workOrderId.toUpperCase().includes('WOP');
        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
        
        if (!isWoaWop) {
            await updateDoc(taskRef, updates);
            return;
        }

        // For WOA/WOP, update the task doc, subtask doc, and write a new revision if revision changed!
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

        // Apply updates to task document
        const mappedUpdates: any = { ...updates };
        if (updates.name) mappedUpdates.taskName = updates.name;
        if (updates.status) mappedUpdates.status = lbStatus;

        await updateDoc(taskRef, mappedUpdates);

        // Update Subtask
        const subtaskId = `${taskId}-0001`;
        const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', subtaskId);
        
        const subtaskUpdates: any = {};
        if (updates.status) subtaskUpdates.status = lbStatus;
        if (updates.dailyProgress !== undefined) subtaskUpdates.dailyProgress = updates.dailyProgress;
        if (updates.currentRevision) subtaskUpdates.currentRevision = updates.currentRevision;

        const subtaskDocSnap = await getDoc(subtaskRef);
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
                currentRevision: updates.currentRevision || taskData.currentRevision || 'rev00',
                isActive: true
            });
        }

        // If currentRevision changed or we have updates like rejectReason/revisionName, write/update revision document
        const currentRev = updates.currentRevision || taskData.currentRevision || 'rev00';
        const revisionRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', currentRev);
        
        const revisionData: any = {
            revisionId: currentRev,
            revisionName: updates.revisionName || updates.notes || taskData.revisionName || 'Revision',
            status: 'active',
            createdAt: updates.revisionCreatedAt || taskData.revisionCreatedAt || new Date().toISOString()
        };
        await setDoc(revisionRef, revisionData, { merge: true });
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
                reviewedAt: new Date().toISOString(),
                adminReviewedAt: new Date().toISOString()
            });
        } catch (err) {
            console.error("Failed to mark as reviewed:", err);
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
            requestRetroactiveUnlock
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
