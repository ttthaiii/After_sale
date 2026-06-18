// TypeScript Interfaces & Types for DailyReport Page

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  isOverdue: boolean;
}

export interface ShiftConfig {
  normal: boolean;
  otMorning: boolean;
  otNoon: boolean;
  otEvening: boolean;
}

export interface ShiftTimes {
  day?: string;
  otMorning?: string;
  otNoon?: string;
  otEvening?: string;
}

export interface LeaveInfo {
  active: boolean;
  time?: string;
  medCertFileUrl?: string;
  leaveType?: string;
}

export interface LaborEntry {
  id: string;
  membership: "Internal" | "Outsource";
  staffId?: string;
  staffName?: string;
  employeeId?: string;
  affiliation?: string;
  contractorId?: string;
  amount: number;
  timeType?: string;
  shifts?: ShiftConfig;
  shiftTimes?: ShiftTimes;
  leave?: LeaveInfo;
  recordedBy?: string;
}

export interface WorkTask {
  id: string;
  taskCode?: string;
  name: string;
  status: string;
  dailyProgress?: number;
  history?: HistoryEntry[];
  slaCategory?: string;
  baselineSla?: string;
  estimatedSla?: string;
  slaStartTime?: string;
  startDate?: string;
  position?: string;
  amount?: number;
  unit?: string;
  currentRevision?: string;
  revisionCreatedAt?: string;
  revisionName?: string;
  unlockedDates?: Record<string, { unlockedUntil: string }>;
  subtaskOperatorId?: string;
  responsibleStaffIds?: string[];
  isReadOnly?: boolean;
  beforePhotoUrl?: string;
  latestPhotoUrl?: string;
  afterPhotoUrl?: string;
  images?: string[];
  attachments?: { url: string }[];
  evaluationStatus?: string;
  rejectReason?: string;
  reason?: string;
  taskName?: string;
  subtaskId?: string;
  isHelper?: boolean;
  isSupportRequest?: boolean;
  isPickedUpBySupport?: boolean;
  assignedForeman?: string;
  helperForemanIds?: string[];
}

export interface WorkOrderCategory {
  id: string;
  name?: string;
  tasks: WorkTask[];
}

export interface WorkOrder {
  id: string;
  status: string;
  locationName: string;
  woOwnerId?: string;
  reporterId?: string | null;
  projectId?: string;
  startDate?: string;
  createdAt?: string;
  appointmentDate?: string;
  categories: WorkOrderCategory[];
  deliveryQrToken?: string;
  reviewedByAdmin?: boolean;
  pendingAdminReassign?: boolean;
  building?: string;
  floor?: string;
  room?: string;
}

export interface HistoryLaborEntry {
  workerId?: string;
  id?: string;
  staffId?: string;
  staffName?: string;
  workerName?: string;
  employeeId?: string;
  contractorId?: string;
  membership?: string;
  shifts?: ShiftConfig;
  shiftTimes?: ShiftTimes;
  amount?: number;
  affiliation?: string;
  recordedBy?: string;
}

export interface HistoryLeaveEntry {
  workerId?: string;
  id?: string;
  staffId?: string;
  staffName?: string;
  workerName?: string;
  employeeId?: string;
  contractorId?: string;
  leaveTimes?: { custom?: string };
  leaveShifts?: { custom?: boolean };
  medCertFileUrl?: string;
  leaveType?: string;
  amount?: number;
  recordedBy?: string;
}

export interface HistoryPhotos {
  site?: string[];
  laborByShift?: {
    regular?:
      | string[]
      | { in?: string; lunch?: string; afternoon?: string; out?: string }
      | null;
    otMorning?: string[] | { in?: string; out?: string } | null;
    otNoon?: string[] | { in?: string; out?: string } | null;
    otEvening?: string[] | { in?: string; out?: string } | null;
  };
}

export interface HistoryEntry {
  id: string;
  date: string;
  progress: number;
  note?: string;
  type?: string;
  labor: HistoryLaborEntry[];
  leave?: HistoryLeaveEntry[];
  photos?: string[] | HistoryPhotos;
  laborPhotos?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  serverTimestamp?: string;
  editHistory?: EditHistoryRecord[];
  projectLocationId?: string;
  isSupportReport?: boolean;
  revisionId?: string;
}

export interface EditHistoryRecord {
  editedAt: string;
  editedBy: string;
  snapshot: {
    labor: HistoryLaborEntry[];
    leave: HistoryLeaveEntry[];
    photos: string[] | HistoryPhotos | null;
    note: string;
    progress: number;
    serverTimestamp: string;
  };
}

export interface SelectedTaskInfo {
  task: WorkTask;
  wo: WorkOrder;
  categoryId: string;
}

export interface TaskListItem {
  task: WorkTask;
  wo: WorkOrder;
  categoryId: string;
}

export interface ModalAlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type: "success" | "warning" | "error" | "info";
}

export interface BatchConfig {
  day: boolean;
  otMorning: boolean;
  otNoon: boolean;
  otEvening: boolean;
  timeDay: string;
  timeOtMorning: string;
  timeOtEvening: string;
}

export interface TimePickerTarget {
  id: string;
  shift: string;
  type: "start" | "end";
  currentValue: string;
}

export interface ModalTimeTarget {
  field: string;
  type: "start" | "end";
  currentValue: string;
}

export interface AvailableItem {
  id: string;
  name?: string;
  employeeId?: string;
  skillId?: string;
  department?: string;
}

export interface RealProject {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface RealContractor {
  id: string;
  name: string;
}

export interface DailyContractor {
  id: string;
  name: string;
  employeeId?: string;
  skillId?: string;
  department?: string;
}

export interface PendingDeliveryItem {
  wo: any;
}

export interface GroupData {
  wo: any;
  myTasks: TaskListItem[];
  helperTasks: TaskListItem[];
  maxSla: string;
  globalDeadline: number;
  subtaskDeadline: number;
  originalDeadline: number;
}

export interface SLACountdownProps {
  startTime: string;
  durationHours?: number;
  appointmentDate?: string;
  actualStartDate?: string;
  isCompleted: boolean;
  groupDeadline?: number;
}

export interface GroupSLACountdownProps {
  globalDeadline: number;
  subtaskDeadline: number;
  isCompleted: boolean;
  originalDeadline?: number;
  isRevision?: boolean; // true เมื่อ currentRevision !== 'rev00'
}

export interface BatchAddModalProps {
  type: "Internal" | "Outsource";
  availableItems: AvailableItem[];
  onClose: () => void;
  onAdd: (selectedIds: string[], config: BatchConfig) => void;
}
