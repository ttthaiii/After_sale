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
}

export interface TaskUpdate {
    id: string;
    date: string;
    note: string;
    progress: number;
    photos?: string[];
    laborPhotos?: string[];
    labor: LaborRecord[];
    type?: 'Update' | 'Problem' | 'Resolution';
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
    type?: string;         // ✅ Added for compatibility
    reportDate?: string;   // ✅ Added for compatibility
    photoUrl?: string; // ✅ New: Support for daily progress photo
    laborPhotos?: string[]; // ✅ New: Support for labor proof photos
    createdAt: string;
    createdBy: string;
}

export interface MasterTask {
    id: string; // master_task_id or taskId
    name: string;
    title?: string;
    status: TaskStatus | 'upcoming' | 'in-progress' | 'completed';
    beforePhotoUrl?: string;
    afterPhotoUrl?: string;
    latestPhotoUrl?: string;
    dailyProgress: number; 
    dueDate?: string;
    assignee?: string; 
    assignees?: { id: string, name: string }[];
    
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
    
    dailyreports?: DailyReport[]; 
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
    assignedProjects?: string[]; 
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
