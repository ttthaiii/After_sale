export type UserRole = 'Foreman' | 'BackOffice' | 'Approver' | 'Admin' | 'Manager';

export interface User {
    id: string;
    name: string;
    role: UserRole;
    avatar?: string;
    employeeId?: string;
    assignedProjects?: string[];
}

export type TaskStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Completed' | 'Verified' | 'Approved' | 'Rejected';

export interface TaskAssignee {
    employeeId: string;
    name: string;
    roleId: string;
    id?: string; // For backwards compatibility with old assignee.id
}

export interface LaborRecord {
    id: string;
    membership: 'Internal' | 'Outsource';
    staffId?: string; // For Internal: link to specific staff
    staffName?: string; // Display name
    affiliation: string; // Project affiliation for internal, source for outsource
    amount: number; // 1 for internal, headcount for outsource
    timeType: 'Normal' | 'OT';
    // Detailed Shift & Time tracking
    shifts?: {
        normal: boolean;
        otMorning: boolean; // Morning OT (before shift)
        otNoon: boolean; // Noon OT (break)
        otEvening: boolean; // Evening OT (after shift)
    };
    shiftTimes?: {
        day?: string;
        otMorning?: string;
        otNoon?: string;
        otEvening?: string;
    };
    workHours?: string; // e.g. "08:00 - 17:00"
    contractorId?: string; // For linking to master data
    employeeId?: string; // Add for labor database compatibility
    workerId?: string; // Add for LB compatibility
    workerName?: string; // Add for LB compatibility
    expectedShifts?: {
        normal: boolean;
        otMorning: boolean;
        otNoon: boolean;
        otEvening: boolean;
    }; // Add for LB compatibility
    expectedHours?: {
        normal: number;
        otMorning: number;
        otNoon: number;
        otEvening: number;
    }; // Add for LB compatibility
    leave?: {
        active: boolean;
        time?: string;
        medCertFileUrl?: string;
        leaveType?: 'Paid' | 'Unpaid';
    }; // Add for daily report leave status tracking
}

export interface TaskUpdate {
    id: string;
    date: string;
    note: string;
    progress: number;
    photos?: string[] | {
        site?: string[];
        laborByShift?: {
            regular?: string[] | { in?: string; lunch?: string; afternoon?: string; out?: string; } | null;
            otMorning?: { in?: string; out?: string; } | null;
            otNoon?: { in?: string; out?: string; } | null;
            otEvening?: { in?: string; out?: string; } | null;
        };
    }; // รองรับทั้งรูปแบบอาร์เรย์เดิม (legacy arrays) และรูปภาพแยกตามกะการทำงาน (LB-style)
    laborPhotos?: string[]; // นำ laborPhotos กลับมาใช้เพื่อรองรับความเข้ากันได้ย้อนหลัง
    labor: LaborRecord[];
    leave?: any[];
    type?: 'Update' | 'Problem' | 'Resolution';
    updatedBy?: string;
}

export interface DailyReport {
    id: string;
    date: string; // YYYY-MM-DD
    workType: 'regular' | 'ot-morning' | 'ot-evening';
    timeRange: {
        start: string;
        end: string;
    };
    workers: {
        workerId: string;
        name: string;
        role: string;
    }[];
    progress?: number;
    notes?: string;
    labor?: LaborRecord[]; // ✅ Added for compatibility with Dashboard/DailyReport pages
    leave?: any[];
    type?: string;         // ✅ Added for compatibility
    reportDate?: string;   // ✅ Added for compatibility
    photoUrl?: string; // ✅ New: Support for daily progress photo
    updatedBy?: string;
    photos?: string[]; // ✅ Added for compatibility with TaskUpdate/TaskUpdateModal
    laborPhotos?: string[]; // ✅ New: Support for labor proof photos
    createdAt: string;
    createdBy: string;
}

export interface MasterTask {
    id: string; // master_task_id or taskId
    name: string;
    title?: string;
    status: TaskStatus | 'upcoming' | 'in-progress' | 'for-checking' | 'completed';
    beforePhotoUrl?: string;
    afterPhotoUrl?: string;
    latestPhotoUrl?: string;
    dailyProgress: number; 
    dueDate?: string;
    assignee?: string; 
    assignees?: TaskAssignee[];
    
    // LB System Fields compatibility
    taskId?: string;
    taskName?: string;
    workOrderId?: string;
    workOrderCode?: string;
    workOrderName?: string;
    categoryId?: string;
    categoryName?: string;
    projectId?: string;
    isSupportRequest?: boolean;
    attachmentsCount?: number;
    isActive?: boolean;
    
    sourceSystem?: string;
    taskCode?: string;

    contractorId?: string | null;
    responsibleStaffIds?: string[];
    baselineSla?: 'Immediately' | '24h' | '1-3d' | '3-7d' | '7-14d' | '14-30d';
    slaCategory?: 'Immediately' | '24h' | '1-3d' | '3-7d' | '7-14d' | '14-30d' | null;
    estimatedSla?: 'Immediately' | '24h' | '1-3d' | '3-7d' | '7-14d' | '14-30d' | null;
    actualCompletionTime?: number;
    evaluationStatus?: 'Pending' | 'Evaluated';
    position?: string;
    amount?: number;
    unit?: string;
    costType?: 'Warranty' | 'Billable' | 'Project' | 'None' | null;
    rootCause?: string | null;
    attachments?: Attachment[];
    images?: string[];
    startDate?: string;
    history?: TaskUpdate[];
    labor?: LaborRecord[];
    slaStartTime?: string; // ✅ Added
    unlockedDates?: Record<string, { unlockedUntil: string, reason?: string }>; // For retroactive admin unlocking
    
    dailyreports?: DailyReport[]; 
    
    // Revision-related fields for tracking SLA round-trips and owner feedback
    currentRevision?: string;
    revisionId?: string;
    revisionName?: string;
    revisionCreatedAt?: any;
    ownerName?: string;
    notes?: string;
    updatedAt?: string;
    evaluationChecklist?: Record<string, number | boolean>;
    overallSatisfaction?: number;
}

export interface Attachment {
    id: string;
    name: string;
    url: string;
    type: string; 
}

export interface Contractor {
    id: string;
    name: string;
    specialty: string[]; 
    phone?: string;
    rating?: number;
}

export interface Staff {
    id: string;
    employeeId?: string; // New: Official employee identifier
    name: string;
    role: 'Foreman' | 'Admin' | 'Manager' | 'BackOffice' | 'Approver';
    department?: string;
    phone?: string;
    affiliation?: string; 
    profileImage?: string; 
    username?: string; 
    password?: string; 
    passwordHash?: string; // Add for labor database compatibility
    assignedProjects?: string[]; 
    projectLocationIds?: string[]; // Add for labor database compatibility
    systemCode?: string; // Add to tag users created by After Sale system
    createdAt?: string; // Add for labor database compatibility
    createdBy?: string; // Add for labor database compatibility
    startDate?: string; // Add for labor database compatibility
}

export interface Category {
    id: string;
    name: string;
    tasks: MasterTask[]; // Removed optional
}

export type WorkOrderType = 'AfterSale' | 'PreHandover';

export interface Project {
    id: string;
    name: string;
    code: string; 
    affiliation?: string; 
    imageUrl?: string; 
    budget?: number;
    projectCode?: string;
    status?: string;
}

export interface WorkOrder {
    id: string;
    projectId: string; 
    locationName: string;
    type: WorkOrderType;
    categories: Category[]; // Removed optional for strictness in some views
    createdAt: string;
    startDate?: string;

    reporterName: string;
    reporterId?: string | null;
    reporterPhone: string;
    reportDate?: string;

    building?: string;
    floor?: string;
    room?: string;
    appointmentDate?: string;
    initialProblem?: string;

    status: 'Draft' | 'Evaluating' | 'Pending' | 'Approved' | 'Partially Approved' | 'In Progress' | 'Completed' | 'Verified' | 'Rejected' | 'Cancelled';
    isNew?: boolean;
    isArchived?: boolean;
    submittedAt?: string | null;
    adminReviewedAt?: string;
    completedAt?: string | null;
    lastUpdate?: string;

    totalTasks?: number;
    completedTasks?: number;
    overallProgress?: number;
}

export interface ActivityLog {
    id: string;
    userId: string;
    userName: string;
    role: string;
    action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'UPLOAD' | 'VIEW_PAGE' | 'APPROVE' | 'REJECT';
    module: 'DASHBOARD' | 'SLA_MONITOR' | 'MASTER_DATA' | 'REPORTING' | 'WORK_ORDERS' | 'AUTH' | 'EVALUATION' | 'HISTORY';
    details: string; // Dynamic JSON or descriptive text
    timestamp: any; // Firestore Timestamp
    projectId?: string; // Optional: Link to project for filtering
    targetId?: string; // Optional: ID of the object being acted upon (WO ID, Staff ID, etc.)
}
