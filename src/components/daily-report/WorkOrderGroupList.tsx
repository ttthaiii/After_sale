import React, { Fragment, useState, useEffect } from "react";
import { computeJobSLA, SLA_HOURS_MAP } from "../../utils/jobSla";
import {
  ChevronLeft,
  Search,
  Building2,
  Lock,
  QrCode,
  CheckCircle2,
  Package,
  LayoutDashboard,
  AlertTriangle,
  ClipboardList,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDailyReport } from "../../context/DailyReportContext";
import { useAlert } from "../../context/AlertContext";
import { GroupSLACountdown } from "./SLACountdowns";
import { WorkTask, WorkOrder } from "../../types/dailyReport.types";
import { useWorkOrders } from "../../context/WorkOrderContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { identifierStyle } from "../ui/responsiveText";
import { chipScrollRow } from "../ui/layout";

const formatSubtaskId = (id: string | undefined): string => {
  if (!id) return "";
  const cleanId = id.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
  const parts = cleanId.split('-');
  if (parts.length === 5) {
    return parts.slice(0, 4).join('-');
  }
  return cleanId;
};

const getCompletedAtTime = (wo: any, tasks: any[]): number | null => {
  const isAllCompleted = tasks.length > 0 && tasks.every((t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100);
  if (!isAllCompleted) return null;

  // ถ้ายังมี task รอลูกค้าประเมิน → ยังไม่เสร็จสมบูรณ์จริง → ไม่แสดง completedAt
  const hasPendingEval = tasks.some((t: any) =>
    t.status === 'For Checking' || t.status === 'pending_delivery'
  );
  if (hasPendingEval) {
    // งานรอลูกค้าประเมิน → แสดงวันที่ progress ถึง 100% ของ rev ปัจจุบัน (updatedAt ล่าสุด)
    const pendingTaskUpdates = tasks
      .filter((t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100 && t.updatedAt)
      .map((t: any) => new Date(t.updatedAt).getTime());
    return pendingTaskUpdates.length > 0 ? Math.max(...pendingTaskUpdates) : null;
  }

  if (wo.completedAt) {
    return new Date(wo.completedAt).getTime();
  }
  
  const inspectionSubmittedAt = wo.inspectionTimeline?.inspectionSubmittedAt;
  if (inspectionSubmittedAt) {
    return new Date(inspectionSubmittedAt).getTime();
  }
  
  const taskUpdates = tasks
    .filter((t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100)
    .map((t: any) => t.updatedAt)
    .filter(Boolean);
    
  if (taskUpdates.length > 0) {
    return Math.max(...taskUpdates.map((d: string) => new Date(d).getTime()));
  }
  
  if (wo.createdAt) {
    return new Date(wo.createdAt).getTime();
  }
  
  return new Date().getTime();
};

export const WorkOrderGroupList: React.FC = () => {
  const {
    workOrders,
    user,
    highlightedId,
    selectedTaskInfo,
    searchTerm,
    setSearchTerm,
    setIsSidebarOpen,
    collapsedHelpers,
    setCollapsedHelpers,
    newTasks: rawNewTasks,
    inProgressTasks: rawInProgressTasks,
    pendingInspectionTasks: rawPendingInspectionTasks,
    pendingDeliveryWorkOrders: rawPendingDeliveryWorkOrders,
    preHandoverWorkOrders,
    selectPhCatInfo,
    selectedPhCatInfo,
    setSelectedTaskInfo,
    handleSelectTask,
    getTaskImage,
    realProjects,
    setIsCustomerMockupOpen,
    setMockupWorkOrder,
    generateDeliveryQrToken,
    setModalAlert,
    draftedTaskIds,
  } = useDailyReport();
  const showAlert = useAlert();
  const isMobile = useIsMobile();

  // Real staff (users, systemCode='AS') — used to resolve foreman display names by id/employeeId
  const { staff } = useWorkOrders();

  const [activeTab, setActiveTab] = useState<'internal' | 'support'>('internal');
  const [sortBy, setSortBy] = useState<'deadline' | 'delivery' | 'id'>('deadline');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalWo, setQrModalWo] = useState<any>(null);
  const [ipOverride, setIpOverride] = useState('');
  const [collapsedPhWos, setCollapsedPhWos] = useState<Record<string, boolean>>({});


  useEffect(() => {
    if (selectedTaskInfo) {
      const isSupport = selectedTaskInfo.task.isSupportRequest === true || selectedTaskInfo.task.isHelper === true;
      setActiveTab(isSupport ? 'support' : 'internal');
    }
  }, [selectedTaskInfo]);

  // Filter tasks based on activeTab
  const newTasks = rawNewTasks.filter(item => {
    const isSupport = item.task.isSupportRequest === true || item.task.isHelper === true;
    return activeTab === 'support' ? isSupport : !isSupport;
  });

  const inProgressTasks = rawInProgressTasks.filter(item => {
    const isSupport = item.task.isSupportRequest === true || item.task.isHelper === true;
    return activeTab === 'support' ? isSupport : !isSupport;
  });

  const pendingInspectionTasks = rawPendingInspectionTasks.filter(item => {
    const isSupport = item.task.isSupportRequest === true || item.task.isHelper === true;
    return activeTab === 'support' ? isSupport : !isSupport;
  });

  const pendingDeliveryWorkOrders = rawPendingDeliveryWorkOrders.filter(item => {
    const hasMatchingTask = item.wo.categories.some((c: any) =>
      c.tasks.some((t: any) => {
        const isSupport = t.isSupportRequest === true || t.isHelper === true;
        return activeTab === 'support' ? isSupport : !isSupport;
      })
    );
    return hasMatchingTask;
  });

  const mappedPendingDeliveries = pendingDeliveryWorkOrders.map(item => {
    const wo = item.wo;
    const globalTasks = wo.categories.flatMap((c: any) => c.tasks).filter((t: any) => {
      // Cancelled/archived-rejected tasks never happened — exclude them here too,
      // same rule as the other task-count sites in this file (globalTasks filter,
      // allActiveItems.forEach, otherTasks fallback, generateDeliveryQrToken).
      if (t.status === 'Cancelled' || (t.status === 'Rejected' && t.taskArchived === true)) return false;
      const isSupport = t.isSupportRequest === true || t.isHelper === true;
      return activeTab === 'support' ? isSupport : !isSupport;
    });

    const jobSla = computeJobSLA(wo);
    let maxDlOriginal = 0;
    let minSubDl = Infinity;

    wo.categories.forEach((cat: any) => {
      cat.tasks.forEach((t: any) => {
        const tRawInit1 = (t as any).initialStartDate;
        const tRevAt1 = (t as any).revisionCreatedAt;
        const tValidInit1 = tRawInit1 && tRevAt1
          ? (new Date(tRawInit1) < new Date(tRevAt1) ? tRawInit1 : null)
          : (tRawInit1 || null);
        const originalSla = (tValidInit1 ? (t as any).initialSlaCategory : null) || t.baselineSla || t.estimatedSla || t.slaCategory || "24h";
        const tDurHoursOriginal = SLA_HOURS_MAP[originalSla as keyof typeof SLA_HOURS_MAP] || 24;
        const tStartOriginalRaw = tValidInit1 || t.slaStartTime || wo.createdAt || new Date().toISOString();
        const tStartOriginal = tValidInit1
          ? `${tStartOriginalRaw.split('T')[0]}T08:00:00+07:00`
          : tStartOriginalRaw;
        const tDeadlineOriginal = new Date(tStartOriginal).getTime() + tDurHoursOriginal * 60 * 60 * 1e3;
        if (tDeadlineOriginal > maxDlOriginal) {
          maxDlOriginal = tDeadlineOriginal;
        }

        if (t.deadline) {
          const subDl = new Date(t.deadline).getTime();
          if (subDl < minSubDl) {
            minSubDl = subDl;
          }
        }
      });
    });

    const globalDeadline = jobSla.deadlineMs || new Date().getTime();
    const subtaskDeadline = minSubDl !== Infinity ? minSubDl : globalDeadline;
    const completedAtTime = getCompletedAtTime(wo, globalTasks);

    return {
      ...item,
      globalTasks,
      globalDeadline,
      subtaskDeadline,
      originalDeadline: maxDlOriginal,
      completedAtTime,
    };
  });

  mappedPendingDeliveries.sort((a: any, b: any) => {
    if (sortBy === 'id') {
      return a.wo.id.localeCompare(b.wo.id);
    }
    return a.globalDeadline - b.globalDeadline;
  });


  // Helper render function with lexical scope access
  const renderTaskCard = (
    task: WorkTask,
    wo: WorkOrder,
    categoryId: string,
    isNew: boolean,
  ) => {
    const isReadOnly = task.isReadOnly;
    const isSelected = selectedTaskInfo?.task.id === task.id;
    const isHighlighted = highlightedId === wo.id;
    const project = realProjects.find((p) => p.id === wo.projectId);
    const progressColor =
      task.dailyProgress === 100
        ? "#10b981"
        : task.dailyProgress && task.dailyProgress > 0
          ? "#3b82f6"
          : "#e2e8f0";
    // Calculate global completion status for this Work Order
    const globalTasks = wo.categories.flatMap((c: any) => c.tasks);
    const globalIsAllCompleted =
      globalTasks.length > 0 &&
      globalTasks.every(
        (t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100,
      );
    const isCompleted100 = (task.dailyProgress || 0) >= 100 && globalIsAllCompleted;
    const isWoRejectedAwaitingAdmin = wo.status === 'Rejected' && !wo.reviewedByAdmin;
    const isTaskDisabledInRejectedWo = isWoRejectedAwaitingAdmin;

    return (
      <div
        key={task.id}
        onClick={async (e) => {
          e.stopPropagation();
          if (isTaskDisabledInRejectedWo) {
            setModalAlert({
              isOpen: true,
              title: "อยู่ระหว่างรอแอดมินมอบหมายตารางเวลาใหม่",
              message: "ใบสั่งงานนี้ถูกระงับการดำเนินงานชั่วคราว เพื่อรอให้แอดมินจัดสรรรอบเวลาการแก้ไขงานใหม่",
              type: "warning",
            });
            return;
          }
          if ((task.dailyProgress || 0) === 100 || task.status === 'Complete') {
            return;
          }
          if (isReadOnly) {
            const isWoOwner =
              wo.woOwnerId === user?.id ||
              (user?.employeeId && wo.woOwnerId === user.employeeId) ||
              wo.reporterId === user?.id ||
              (user?.employeeId && wo.reporterId === user.employeeId);
            if (isWoOwner) {
              await showAlert(
                "คุณเห็นงานนี้ในฐานะผู้ดูแลภาพรวมใบงาน (Owner) เท่านั้น ไม่สามารถแก้ไขหรือบันทึกรายงานได้ (เฉพาะช่างผู้มาช่วยเท่านั้นที่อัปเดตได้)",
              );
            } else {
              await showAlert(
                "คุณไม่ได้เป็นผู้รับผิดชอบงานย่อยนี้ในรอบการแก้งานปัจจุบัน จึงสามารถดูข้อมูลได้อย่างเดียวเท่านั้น",
              );
            }
            return;
          }
          handleSelectTask(task, wo, categoryId);
        }}
        style={{
          padding: "12px 14px 12px 10px",
          borderRadius: "16px",
          marginBottom: "8px",
          border: "1px solid",
          borderLeft: isSelected
            ? (isCompleted100 ? "6px solid #10b981" : "6px solid #3b82f6")
            : isCompleted100
              ? "6px solid #34d399"
              : isNew
                ? "6px solid #fbbf24"
                : "6px solid #e2e8f0",
          borderColor: isSelected
            ? (isCompleted100 ? "#10b981" : "#3b82f6")
            : isCompleted100
              ? "#a7f3d0"
              : isHighlighted
                ? "#3b82f6"
                : isReadOnly
                  ? "#cbd5e1"
                  : isNew
                    ? "#fcd34d"
                    : "#f1f5f9",
          background: isSelected
            ? (isCompleted100 ? "#ecfdf5" : "#eff6ff")
            : isCompleted100
              ? "#f0fdf4"
              : isHighlighted
                ? "#eff6ff"
                : isReadOnly
                  ? "#f8fafc"
                  : isNew
                    ? "#fffbeb"
                    : "#fff",
          cursor: isTaskDisabledInRejectedWo
            ? "default"
            : ((task.dailyProgress || 0) === 100 || task.status === 'Complete')
              ? "default"
              : isReadOnly
                ? "not-allowed"
                : "pointer",
          transition: "all 0.2s",
          boxShadow: isSelected && isCompleted100
            ? "0 10px 15px -3px rgba(16, 185, 129, 0.2), 0 4px 6px -4px rgba(16, 185, 129, 0.2)"
            : isSelected || isHighlighted
              ? "0 8px 12px -3px rgba(59, 130, 246, 0.15)"
              : isCompleted100
                ? "0 4px 6px -1px rgba(16, 185, 129, 0.08)"
                : "0 2px 4px -1px rgba(0,0,0,0.05)",
          transform: isHighlighted && !isSelected ? "scale(1.02)" : "none",
          position: "relative",
          opacity: isTaskDisabledInRejectedWo
            ? 0.55
            : ((task.dailyProgress || 0) === 100 || task.status === 'Complete')
              ? 0.55
              : isReadOnly
                ? 0.75
                : 1,
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
                {isCompleted100 ? (
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#10b981",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.15)",
              flexShrink: 0,
            }}
            title="เสร็จสมบูรณ์ 100%"
          >
            <CheckCircle2 size={22} color="#ffffff" strokeWidth={3} />
            <span
              style={{
                fontSize: "0.62rem",
                fontWeight: 900,
                marginTop: "2px",
                lineHeight: 1,
              }}
            >
              100%
            </span>
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              width: "64px",
              height: "64px",
              flexShrink: 0,
            }}
          >
            <svg height="64" width="64" style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="#e2e8f0"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke={progressColor}
                strokeWidth="6"
                fill="none"
                strokeDasharray={2 * Math.PI * 26}
                strokeDashoffset={
                  2 * Math.PI * 26 -
                  ((task.dailyProgress || 0) / 100) * (2 * Math.PI * 26)
                }
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  color: "#334155",
                  letterSpacing: "-0.03em",
                }}
              >
                {task.dailyProgress}%
              </span>
            </div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "3px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                color: "#0f766e",
                textTransform: "uppercase",
                background: "#ccfbf1",
                padding: "2px 5px",
                borderRadius: "4px",
                whiteSpace: "nowrap",
              }}
              title="รหัสงาน"
            >
              {formatSubtaskId(task.subtaskId || task.id)}
            </div>
            {task.isSupportRequest && (
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 900,
                  color: "#0369a1",
                  background: "#e0f2fe",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                  border: "1px solid #bae6fd",
                }}
              >
                🤝 งานช่วยเหลือ (Support)
              </div>
            )}
            {task.currentRevision && task.currentRevision !== "rev00" && (
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  color: "#ef4444",
                  textTransform: "uppercase",
                  background: "#fee2e2",
                  padding: "2px 5px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                  border: "1px solid #fca5a5",
                }}
              >
                REV. {parseInt(task.currentRevision.replace("rev", ""))}
              </div>
            )}
            {draftedTaskIds.has(task.id) && (
              <div
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  color: "#92400e",
                  background: "#fef3c7",
                  padding: "2px 5px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                  border: "1px solid #fcd34d",
                }}
              >
                ✏️ ร่างค้าง
              </div>
            )}
            {isReadOnly && (
              <div
                style={{
                  background: "#cbd5e1",
                  color: "#475569",
                  fontSize: "0.58rem",
                  fontWeight: 800,
                  padding: "2px 5px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <Lock size={8} /> ดูได้อย่างเดียว
              </div>
            )}
            {isNew && (
              <div
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: "0.58rem",
                  fontWeight: 800,
                  padding: "2px 5px",
                  borderRadius: "6px",
                }}
              >
                ใหม่
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: "0.82rem",
              fontWeight: 800,
              color: "#0f172a",
              marginBottom: "3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {task.isHelper ? (task.subtaskName || task.name) : task.name}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "#64748b",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              overflow: "hidden",
            }}
          >
            <Building2 size={11} style={{ flexShrink: 0 }} />{" "}
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {wo.locationName}
            </span>
          </div>
          {isCompleted100 &&
            (() => {
              const isHelper = task.isHelper === true;
              const isWoOwner =
                !isHelper &&
                (wo.woOwnerId === user?.id ||
                  (user?.employeeId && wo.woOwnerId === user.employeeId) ||
                  wo.reporterId === user?.id ||
                  (user?.employeeId && wo.reporterId === user.employeeId));
              return (
                <div
                  style={{
                    marginTop: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      color: "#15803d",
                      background: "#dcfce7",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontWeight: 800,
                      fontSize: "0.65rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <CheckCircle2 size={10} style={{ color: "#10b981" }} />
                    {isWoOwner ? "เสร็จสมบูรณ์ 100% (รอส่งมอบภาพรวม)" : "เสร็จสมบูรณ์ 100%"}
                  </span>
                </div>
              );
            })()}
          {wo.status === "Rejected" && !wo.reviewedByAdmin && task.status === "Rejected" && (
            <div
              style={{
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span
                style={{
                  color: "#dc2626",
                  background: "rgba(220, 38, 38, 0.08)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontWeight: 900,
                  fontSize: "0.68rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  border: "1px solid rgba(220, 38, 38, 0.25)",
                }}
              >
                <AlertTriangle size={12} style={{ color: "#dc2626" }} />
                รอแอดมินประเมิน/จัดตารางใหม่
              </span>
            </div>
          )}
        </div>
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            overflow: "hidden",
            flexShrink: 0,
            border: "1px solid #e2e8f0",
            background: "#f1f5f9",
          }}
        >
          {getTaskImage(task) ? (
            <img
              loading="lazy"
              src={getTaskImage(task)!}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              alt="Task"
            />
          ) : project?.imageUrl ? (
            <img
              loading="lazy"
              src={project.imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              alt="Project"
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#cbd5e1",
              }}
            >
              <Building2 size={20} />
            </div>
          )}
        </div>
      </div>
    );
  };

  // Renders the Sidebar JSX
  return (
<div
          style={{
            background: "#fff",
            borderRadius: "24px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {" "}
          
          <div
            style={{
              padding: "1.5rem",
              borderBottom: "1px solid #f1f5f9",
              background: "#f8fafc",
            }}
          >
            {" "}
            
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
              }}
            >
              {" "}
              
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                {" "}
                
                <div
                  style={{
                    background: "#3b82f6",
                    color: "#fff",
                    padding: "8px",
                    borderRadius: "10px",
                  }}
                >
                  {" "}
                  
                  <LayoutDashboard size={20} />
                </div>{" "}
                
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.2rem",
                    fontWeight: 900,
                    color: "#0f172a",
                  }}
                >
                  งานรอรายงานผล
                </h2>
              </div>{" "}
              
              <button
                onClick={() => setIsSidebarOpen(false)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                  transition: "all 0.2s",
                  padding: 0,
                  outline: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#e2e8f0";
                  e.currentTarget.style.color = "#3b82f6";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.color = "#64748b";
                }}
                title="ซ่อนแถบซ้าย"
              >
                {" "}
                
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
            </div>{" "}
            
            <div
              style={{
                position: "relative",
              }}
            >
              {" "}
              
              <Search
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
                size={16}
              />{" "}
              
              <input
                type="text"
                placeholder="ค้นหาเลขที่งาน หรือ สถานที่..."
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  outline: "none",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  boxSizing: "border-box",
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Switcher tabs */}
            <div
              style={{
                display: "flex",
                background: "#f1f5f9",
                borderRadius: "12px",
                padding: "4px",
                marginTop: "12px",
              }}
            >
              <button
                onClick={() => setActiveTab('internal')}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: activeTab === 'internal' ? "#ffffff" : "transparent",
                  color: activeTab === 'internal' ? "#1e293b" : "#64748b",
                  fontSize: "0.8rem",
                  fontWeight: activeTab === 'internal' ? 800 : 600,
                  cursor: "pointer",
                  boxShadow: activeTab === 'internal' ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                  transition: "all 0.2s",
                }}
              >
                งานภายใน
              </button>
              <button
                onClick={() => setActiveTab('support')}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: activeTab === 'support' ? "#ffffff" : "transparent",
                  color: activeTab === 'support' ? "#1e293b" : "#64748b",
                  fontSize: "0.8rem",
                  fontWeight: activeTab === 'support' ? 800 : 600,
                  cursor: "pointer",
                  boxShadow: activeTab === 'support' ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                  transition: "all 0.2s",
                }}
              >
                งานซัพพอร์ทไซต์
              </button>
            </div>

            {/* Sorting Bar */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                marginTop: "12px",
                background: "#f8fafc",
                padding: "6px 8px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                // Mobile: chips scroll horizontally at natural width (mockup S3) — desktop unchanged
                ...(isMobile ? chipScrollRow : {}),
              }}
            >
              {[
                { id: 'deadline', label: '⏰ ตามเดดไลน์', title: 'เรียงตามเดดไลน์ที่เลยกำหนดนานที่สุด' },
                { id: 'delivery', label: '📦 รอ QR Code', title: 'ดึงงานเสร็จ 100% ขึ้นก่อน' },
                { id: 'id', label: '🔢 รหัสใบงาน', title: 'เรียงตามลำดับรหัสใบงาน' }
              ].map((opt) => {
                const isActive = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSortBy(opt.id as any)}
                    title={opt.title}
                    style={{
                      // Mobile: natural width + nowrap so the row scrolls (mockup S3); desktop keeps equal flex:1
                      flex: isMobile ? "0 0 auto" : 1,
                      whiteSpace: "nowrap",
                      padding: "6px 4px",
                      borderRadius: "8px",
                      border: "none",
                      background: isActive ? "#ffffff" : "transparent",
                      color: isActive ? "#2563eb" : "#64748b",
                      fontSize: "0.68rem",
                      fontWeight: isActive ? 900 : 700,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "2px",
                      boxShadow: isActive ? "0 2px 4px rgba(0, 0, 0, 0.05)" : "none",
                    }}
                    onMouseOver={(el) => {
                      if (!isActive) el.currentTarget.style.color = "#1e293b";
                    }}
                    onMouseOut={(el) => {
                      if (!isActive) el.currentTarget.style.color = "#64748b";
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div> 
          
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem",
            }}
          >
            {pendingDeliveryWorkOrders.length === 0 &&
            newTasks.length === 0 &&
            inProgressTasks.length === 0 &&
            pendingInspectionTasks.length === 0 &&
            (activeTab !== 'internal' || preHandoverWorkOrders.length === 0) ? (
               <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: "#94a3b8",
                }}
              >
                {" "}
                
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                  }}
                >
                  ไม่มีงานที่ต้องรายงานในขณะนี้
                </div>
              </div>
            ) : (
               <Fragment>
                {/* ─── PreHandover Section ─── */}
                {activeTab === 'internal' && preHandoverWorkOrders.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{
                      fontSize: '0.8rem', fontWeight: 800, color: '#0d9488',
                      marginLeft: '8px', marginBottom: '10px',
                      textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <ClipboardList size={12} style={{ color: '#0d9488' }} />
                      ตรวจรับก่อนโอน (PreHandover)
                    </h3>
                    {preHandoverWorkOrders.map(({ wo, assignedCategories }) => {
                      const project = realProjects.find((p: any) => p.id === wo.projectId);
                      const woCollapsed = collapsedPhWos[wo.id];
                      // SLA deadline — job-level via central helper (wo.scheduledDate@08:00 + phActualSla, no Date.now / 720 fallback; incl 30-60d/60d+).
                      const _jobSla = computeJobSLA(wo);
                      const phDeadlineMs = _jobSla.deadlineMs ?? Date.now();
                      const phDeadlineDate = new Date(phDeadlineMs);
                      const slaLabel = _jobSla.deadlineMs !== null ? phDeadlineDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
                      const daysLeft = _jobSla.deadlineMs !== null ? Math.ceil((phDeadlineMs - Date.now()) / 86400000) : 0;
                      const daysLabel = daysLeft > 0 ? `อีก ${daysLeft} วัน` : daysLeft === 0 ? 'วันนี้!' : `เกิน ${Math.abs(daysLeft)} วัน`;
                      const allDone = assignedCategories.every((cat: any) => (cat.dailyProgress || 0) >= 100);
                      const hasReassigned = assignedCategories.some((cat: any) => cat.customerStatus === 'reassigned');
                      const maxRevNum = assignedCategories.reduce((max: number, cat: any) => {
                        const rev = cat.currentRevision || 'rev00';
                        const n = parseInt(rev.replace('rev', '')) || 0;
                        return Math.max(max, n);
                      }, 0);
                      return (
                        <div key={wo.id} style={{
                          background: '#fff',
                          border: wo.status === 'Rejected' ? '2px solid #fca5a5' : hasReassigned ? '2px solid #fbbf24' : '2px solid #99f6e4',
                          borderRadius: '20px',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                          overflow: 'hidden',
                          marginBottom: '10px',
                          transition: 'all 0.2s',
                        }}>
                          {/* WO header */}
                          <div
                            onClick={() => setCollapsedPhWos(prev => ({ ...prev, [wo.id]: !prev[wo.id] }))}
                            style={{
                              background: wo.status === 'Rejected'
                                ? 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)'
                                : allDone
                                  ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                                  : 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
                              padding: '14px 16px',
                              borderBottom: woCollapsed ? 'none' : (wo.status === 'Rejected' ? '1px solid #fca5a5' : '1px solid #99f6e4'),
                              display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(isMobile ? { flexWrap: 'wrap', rowGap: '8px' } : {}) }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#0f172a', ...(isMobile ? identifierStyle : {}) }}>
                                  {wo.id}
                                </span>
                                {maxRevNum > 0 && (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#ef4444', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fca5a5', whiteSpace: 'nowrap' }}>
                                    REV. {maxRevNum}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', ...(isMobile ? { flexWrap: 'wrap', flex: '1 1 100%', justifyContent: 'space-between' } : {}) }}>
                                <span style={{
                                  fontSize: '0.62rem', fontWeight: 900,
                                  color: wo.status === 'Complete' ? '#059669' : wo.status === 'Rejected' ? '#dc2626' : hasReassigned ? '#d97706' : allDone ? '#059669' : '#0891b2',
                                  background: wo.status === 'Complete' ? '#d1fae5' : wo.status === 'Rejected' ? '#fee2e2' : hasReassigned ? '#fef3c7' : allDone ? '#d1fae5' : '#cffafe',
                                  padding: '2px 6px', borderRadius: '4px',
                                  display: 'inline-flex', alignItems: 'center', gap: '2px',
                                }}>
                                  {wo.status === 'Complete' ? '✓ เสร็จสมบูรณ์' : wo.status === 'Rejected' ? '⚠️ รอแก้ไข' : hasReassigned ? '🔄 ได้รับมอบหมายใหม่' : allDone ? '✓ ครบ 100%' : `${assignedCategories.length} หมวด`}
                                </span>
                                {(() => {
                                  const isPhWoOwner = assignedCategories.some(
                                    (cat: any) => cat.assignedForemanId === user?.employeeId || cat.assignedForemanId === user?.id
                                  );
                                  const revisionInProgress = maxRevNum > 0 && !allDone;
                                  const canShowQr = (wo.status === 'pending_delivery' || !!wo.deliveryQrToken) && !revisionInProgress;
                                  if (!allDone && !canShowQr) return null;
                                  return (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          let token = wo.deliveryQrToken;
                                          if (!token) {
                                            if (!isPhWoOwner) { await showAlert('เฉพาะโฟรแมนที่รับผิดชอบหมวดงานนี้เท่านั้นที่สร้าง QR ได้'); return; }
                                            if (window.confirm('สร้าง QR Code ส่งมอบงานให้ลูกค้าตรวจรับใช่หรือไม่?')) {
                                              token = await generateDeliveryQrToken(wo.id, user?.employeeId || user?.id || 'unknown');
                                            } else return;
                                          }
                                          setQrModalWo(wo);
                                          setShowQrModal(true);
                                        } catch (err) {
                                          await showAlert('เกิดข้อผิดพลาดในการสร้าง QR');
                                        }
                                      }}
                                      style={{
                                        fontSize: '0.62rem', fontWeight: 900, color: '#fff',
                                        background: canShowQr ? 'linear-gradient(135deg, #0d9488 0%, #059669 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                        border: 'none', padding: '3px 8px', borderRadius: '6px',
                                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)', transition: 'all 0.2s',
                                        // Mobile: full-width button on its own row (mockup S3) — order:2 pushes it below badge/chevron
                                        ...(isMobile ? { flex: '1 1 100%', order: 2, justifyContent: 'center', fontSize: '0.82rem', padding: '10px 12px' } : {}),
                                      }}
                                      onMouseOver={(el) => (el.currentTarget.style.transform = 'scale(1.05)')}
                                      onMouseOut={(el) => (el.currentTarget.style.transform = 'scale(1)')}
                                    >
                                      <QrCode size={isMobile ? 16 : 10} /> {canShowQr ? 'ดู QR ส่งมอบ' : 'สร้าง QR ส่งมอบ'}
                                    </button>
                                  );
                                })()}
                                <div style={{ color: '#475569', flexShrink: 0 }}>
                                  {woCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              📍 {wo.locationName || project?.name || '—'}
                            </div>
                            <div style={{ marginTop: '2px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>
                                กำหนดครบ:
                                <span style={{ marginLeft: '4px', fontWeight: 800, color: daysLeft < 0 ? '#dc2626' : daysLeft <= 3 ? '#d97706' : '#0f172a' }}>
                                  {slaLabel}
                                </span>
                              </span>
                              <span style={{
                                fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: '20px',
                                color: daysLeft < 0 ? '#dc2626' : daysLeft <= 3 ? '#d97706' : '#059669',
                                background: daysLeft < 0 ? '#fee2e2' : daysLeft <= 3 ? '#fef3c7' : '#d1fae5',
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                              }}>
                                {daysLeft < 0 ? '⏰' : daysLeft <= 3 ? '⚠️' : '✓'} {daysLabel}
                              </span>
                            </div>
                          </div>

                          {/* Category list */}
                          {!woCollapsed && (
                            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {assignedCategories.map((cat: any) => {
                                const isSelected = selectedPhCatInfo?.cat.id === cat.id && selectedPhCatInfo?.wo.id === wo.id;
                                const progress = cat.dailyProgress || 0;
                                const progressColor = progress >= 100 ? '#10b981' : progress > 0 ? '#3b82f6' : '#e2e8f0';
                                const catRevNum = parseInt((cat.currentRevision || 'rev00').replace('rev', '')) || 0;
                                const isReassigned = cat.customerStatus === 'reassigned';
                                return (
                                  <div
                                    key={cat.id}
                                    onClick={() => {
                                      const isPhWoRejectedAwaitingAdmin = wo.status === 'Rejected' && !wo.reviewedByAdmin;
                                      if (isPhWoRejectedAwaitingAdmin) {
                                        setModalAlert({ isOpen: true, title: 'รอแอดมินมอบหมายรอบใหม่', message: 'ใบงานนี้ถูกลูกค้าปฏิเสธ — รอแอดมินอนุมัติรอบการแก้ไขก่อนจึงจะเริ่มงานได้', type: 'warning' });
                                        return;
                                      }
                                      if (isReassigned && progress === 0) {
                                        setModalAlert({ isOpen: true, title: `ได้รับมอบหมายงานใหม่ — REV. ${catRevNum}`, message: `หมวดงาน "${cat.name}" ถูกส่งกลับให้แก้ไขโดยแอดมิน (ครั้งที่ ${catRevNum}) — กรุณาเริ่มบันทึกความคืบหน้าใหม่`, type: 'warning' });
                                      }
                                      selectPhCatInfo({ wo, cat }); setSelectedTaskInfo(null);
                                    }}
                                    style={{
                                      borderRadius: '12px', background: isSelected ? '#f0fdfa' : isReassigned ? '#fffbeb' : '#fff',
                                      border: `1px solid ${isSelected ? '#0d9488' : isReassigned ? '#fbbf24' : '#e2e8f0'}`,
                                      padding: '10px 12px', cursor: 'pointer',
                                      boxShadow: isSelected ? '0 0 0 2px #99f6e4' : 'none',
                                      transition: 'all 0.15s',
                                    }}
                                  >
                                    {isReassigned && (
                                      <div style={{ marginBottom: '6px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '4px 8px', fontSize: '0.68rem', fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        🔄 ได้รับมอบหมายกลับมาแก้ไข — กรุณาเริ่มบันทึกรายงาน
                                      </div>
                                    )}
                                    {cat.customerStatus === 'rejected' && cat.customerRejectReason && (
                                      <div style={{ marginBottom: '6px', background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', fontSize: '0.68rem', fontWeight: 700, color: '#be123c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        ✕ ลูกค้าปฏิเสธ: {cat.customerRejectReason}
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {cat.name}
                                        </div>
                                        {catRevNum > 0 && (
                                          <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#ef4444', background: '#fee2e2', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fca5a5', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            REV. {catRevNum}
                                          </span>
                                        )}
                                      </div>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: progress === 0 ? '#94a3b8' : progressColor, marginLeft: '8px' }}>
                                        {progress}%
                                      </span>
                                    </div>
                                    <div style={{ height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${progress}%`, background: progressColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* ─── End PreHandover Section ─── */}
                {pendingDeliveryWorkOrders.length > 0 && (
                   <div
                    style={{
                      marginBottom: "1.5rem",
                    }}
                  >
                    {" "}
                    
                    <h3
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 800,
                        color: "#6366f1",
                        marginLeft: "8px",
                        marginBottom: "10px",
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {" "}
                      
                      <Package
                        size={12}
                        style={{
                          color: "#6366f1",
                        }}
                      />{" "}
                      งานที่รอส่งมอบภาพรวม (Delivery)
                    </h3>
                    {mappedPendingDeliveries.map((item: any) => {
                      const { wo, globalTasks, globalDeadline, subtaskDeadline, originalDeadline, completedAtTime } = item;
                      const isWoOwner =
                        wo.woOwnerId === user?.id ||
                        (user?.employeeId && wo.woOwnerId === user.employeeId) ||
                        wo.reporterId === user?.id ||
                        (user?.employeeId && wo.reporterId === user.employeeId);

                      const globalIsAllCompleted =
                        globalTasks.length > 0 &&
                        globalTasks.every(
                          (t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100,
                        );

                      const isSelected = selectedTaskInfo?.wo.id === wo.id;

                      return (
                        <div
                          style={{
                            background: "#fff",
                            border: isSelected
                              ? "2.5px solid #3b82f6"
                              : wo.status === "Rejected"
                                ? "2px solid #fca5a5"
                                : "2px solid #a5f3fc",
                            borderRadius: "20px",
                            boxShadow: isSelected
                              ? "0 10px 15px -3px rgba(59, 130, 246, 0.15)"
                              : "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                            overflow: "hidden",
                            marginBottom: "10px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                          onClick={() => {
                            if (wo.status === 'Complete' || wo.status === 'pending_delivery') {
                              return; // Do nothing for fully completed/pending delivery WOs
                            }
                            if (wo.status === 'Rejected' && !wo.reviewedByAdmin) {
                              setModalAlert({
                                isOpen: true,
                                title: "อยู่ระหว่างรอแอดมินมอบหมายตารางเวลาใหม่",
                                message: "ใบสั่งงานนี้ถูกระงับการดำเนินงานชั่วคราว เพื่อรอให้แอดมินจัดสรรรอบเวลาการแก้ไขงานใหม่",
                                type: "warning",
                              });
                              return; // Do not auto-select any task if awaiting admin
                            }
                            if (globalTasks.length > 0) {
                              // Select the first rejected task, or first unfinished task, or first task
                              const activeTask =
                                globalTasks.find((t: any) => t.status === 'Rejected') ||
                                globalTasks.find((t: any) => (t.dailyProgress || 0) < 100) ||
                                globalTasks[0];
                              const catId = wo.categories.find((c: any) =>
                                c.tasks.some((t: any) => t.id === activeTask.id)
                              )?.id || wo.categories[0]?.id;
                              handleSelectTask(activeTask, wo, catId);
                            }
                          }}
                          key={wo.id}
                        >
                          <div
                            style={{
                              background: wo.status === "Rejected"
                                ? "linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)"
                                : "linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)",
                              padding: "14px 16px",
                              borderBottom: wo.status === "Rejected"
                                ? "1px solid #fca5a5"
                                : "1px solid #a5f3fc",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                ...(isMobile ? { flexWrap: "wrap", rowGap: "8px" } : {}),
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.78rem",
                                  fontWeight: 900,
                                  color: "#0f172a",
                                  ...(isMobile ? identifierStyle : {}),
                                }}
                              >
                                {wo.id}
                              </span>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  ...(isMobile ? { flexWrap: "wrap", flex: "1 1 100%", justifyContent: "space-between" } : {}),
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "0.62rem",
                                    fontWeight: 900,
                                    color: wo.status === "Completed"
                                      ? "#059669"
                                      : wo.status === "Rejected"
                                        ? "#dc2626"
                                        : globalIsAllCompleted
                                          ? "#0891b2"
                                          : "#b45309",
                                    background: wo.status === "Completed"
                                      ? "#d1fae5"
                                      : wo.status === "Rejected"
                                        ? "#fee2e2"
                                        : globalIsAllCompleted
                                          ? "#cffafe"
                                          : "#fef3c7",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                  }}
                                >
                                  {wo.status === "Completed"
                                    ? "✓ เสร็จสมบูรณ์"
                                    : wo.status === "Rejected"
                                      ? "⚠️ รอแก้ไข"
                                      : globalIsAllCompleted
                                        ? "✓ เสร็จครบ 100%"
                                        : `⏳ เสร็จ ${globalTasks.filter((t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100).length}/${globalTasks.length}`}
                                </span>

                                 {isWoOwner && globalIsAllCompleted && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        let token = wo.deliveryQrToken;
                                        if (!token) {
                                          if (
                                            window.confirm(
                                              "คุณต้องการสร้าง QR Code สำหรับส่งมอบงานให้ลูกค้าตรวจรับใช่หรือไม่?"
                                            )
                                          ) {
                                            token = await generateDeliveryQrToken(
                                              wo.id,
                                              user?.employeeId || user?.id || "unknown"
                                            );
                                            await showAlert("สร้าง QR Code สำหรับส่งมอบเรียบร้อย!");
                                          } else {
                                            return;
                                          }
                                        }
                                        setQrModalWo(wo);
                                        setShowQrModal(true);
                                      } catch (err) {
                                        console.error(err);
                                        await showAlert("เกิดข้อผิดพลาดในการเปิดการส่งมอบ");
                                      }
                                    }}
                                    style={{
                                      fontSize: "0.62rem",
                                      fontWeight: 900,
                                      color: "#ffffff",
                                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                                      border: "none",
                                      padding: "3px 8px",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      boxShadow: "0 2px 4px rgba(99, 102, 241, 0.2)",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "3px",
                                      transition: "all 0.2s",
                                      // Mobile: full-width button on its own row (mockup S3)
                                      ...(isMobile ? { flex: "1 1 100%", order: 2, justifyContent: "center", fontSize: "0.82rem", padding: "10px 12px" } : {}),
                                    }}
                                    onMouseOver={(el) => (el.currentTarget.style.transform = "scale(1.05)")}
                                    onMouseOut={(el) => (el.currentTarget.style.transform = "scale(1)")}
                                  >
                                    <QrCode size={isMobile ? 16 : 10} /> สร้าง QR Code
                                  </button>
                                )}
                              </div>
                            </div>

                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 800,
                                color: "#475569",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              📍 {wo.locationName}
                            </div>

                            <div
                              style={{
                                marginTop: "6px",
                                borderTop: "1px dashed #cbd5e1",
                                paddingTop: "6px",
                              }}
                            >
                              <GroupSLACountdown
                                globalDeadline={globalDeadline}
                                subtaskDeadline={subtaskDeadline}
                                isCompleted={globalIsAllCompleted}
                                originalDeadline={originalDeadline}
                                isRevision={!!wo.categories.flatMap((c: any) => c.tasks).find((t: any) => t.currentRevision && t.currentRevision !== 'rev00')}
                                isHelper={wo.categories.flatMap((c: any) => c.tasks).some((t: any) => t.isHelper === true)}
                                completedAtTime={completedAtTime}
                              />
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "12px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              {globalTasks.map((task: any) => {
                                const categoryId = wo.categories.find((c: any) =>
                                  c.tasks.some((t: any) => t.id === task.id)
                                )?.id;
                                return renderTaskCard(task, wo, categoryId, false);
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(() => {
                  const allActiveItems = [
                    ...newTasks,
                    ...inProgressTasks,
                    ...pendingInspectionTasks,
                  ];
                  if (allActiveItems.length === 0) return null;
                  const groups: Record<string, any> = {};
                  allActiveItems.forEach((item) => {
                    // Cancelled/archived-rejected tasks never happened — hide entirely from the
                    // FM's daily-report list, same as completed tasks are already filtered out
                    // upstream (agreed with product owner: don't show a task with zero remaining action).
                    if (item.task.status === 'Cancelled' || (item.task.status === 'Rejected' && item.task.taskArchived === true)) return;
                    const woId = item.wo.id;
                    const slaHoursMap = SLA_HOURS_MAP;
                    const taskSla =
                      item.task.slaCategory ||
                      item.task.baselineSla ||
                      item.task.estimatedSla ||
                      "24h";
                    const durationHours = slaHoursMap[taskSla as keyof typeof slaHoursMap] || 24;
                    let startTime = item.task.startDate 
                      ? `${item.task.startDate.split('T')[0]}T08:00:00+07:00`
                      : item.task.slaStartTime;
                    if (!startTime) {
                      startTime =
                        item.wo.createdAt ||
                         new Date().toISOString();
                    }
                    let deadlineTime =
                      new Date(startTime).getTime() +
                      durationHours * 60 * 60 * 1e3;
                    let globalDeadlineTime = deadlineTime;
                    
                    // Original start time & deadline — locked to first assignment
                    // Validate: initialStartDate must be BEFORE revisionCreatedAt
                    const tRawInit2 = (item.task as any).initialStartDate;
                    const tRevAt2 = (item.task as any).revisionCreatedAt;
                    const tValidInit2 = tRawInit2 && tRevAt2
                      ? (new Date(tRawInit2) < new Date(tRevAt2) ? tRawInit2 : null)
                      : (tRawInit2 || null);
                    const origSlaItem = (tValidInit2 ? (item.task as any).initialSlaCategory : null) || item.task.baselineSla || item.task.estimatedSla || item.task.slaCategory || "24h";
                    const origStartRaw = tValidInit2 || item.task.slaStartTime || item.wo.createdAt || new Date().toISOString();
                    const origStart = tValidInit2
                      ? `${origStartRaw.split('T')[0]}T08:00:00+07:00`
                      : origStartRaw;
                    let deadlineTimeOriginal = new Date(origStart).getTime() + (slaHoursMap[origSlaItem as keyof typeof slaHoursMap] || 24) * 60 * 60 * 1e3;
                    let globalDeadlineTimeOriginal = deadlineTimeOriginal;

                    if (item.task.isHelper) {
                      const helperDue = item.task.dueDate ? new Date(item.task.dueDate).getTime() : 0;
                      if (helperDue > 0) {
                        deadlineTime = helperDue;
                        globalDeadlineTime = helperDue;
                        globalDeadlineTimeOriginal = helperDue;
                      }
                    } else {
                      const fullWo = (workOrders as any[]).find((w) => w.id === woId);
                      if (fullWo) {
                        const jobSla = computeJobSLA(fullWo);
                        let maxDlOriginal = 0;
                        fullWo.categories.forEach((cat: any) => {
                          cat.tasks.forEach((t: any) => {
                            // Original Deadline Calculation — locked to first assignment
                            // Validate: initialStartDate must be BEFORE revisionCreatedAt
                            const tRawInit3 = t.initialStartDate;
                            const tRevAt3 = t.revisionCreatedAt;
                            const tValidInit3 = tRawInit3 && tRevAt3
                              ? (new Date(tRawInit3) < new Date(tRevAt3) ? tRawInit3 : null)
                              : (tRawInit3 || null);
                            const oSla = (tValidInit3 ? t.initialSlaCategory : null) || t.baselineSla || t.estimatedSla || t.slaCategory || "24h";
                            const tDurHoursOriginal = slaHoursMap[oSla as keyof typeof slaHoursMap] || 24;
                            const tOrigRaw = tValidInit3 || t.slaStartTime || fullWo.createdAt || new Date().toISOString();
                            const tStartOriginal = tValidInit3
                              ? `${tOrigRaw.split('T')[0]}T08:00:00+07:00`
                              : tOrigRaw;
                            const tDeadlineOriginal = new Date(tStartOriginal).getTime() + tDurHoursOriginal * 60 * 60 * 1e3;
                            if (tDeadlineOriginal > maxDlOriginal) {
                              maxDlOriginal = tDeadlineOriginal;
                            }
                          });
                        });
                        if (jobSla.deadlineMs) {
                          globalDeadlineTime = jobSla.deadlineMs;
                        }
                        if (maxDlOriginal > 0) {
                          globalDeadlineTimeOriginal = maxDlOriginal;
                        }
                      }
                    }

                    if (!groups[woId]) {
                      groups[woId] = {
                        wo: item.wo,
                        myTasks: [],
                        helperTasks: [],
                        maxSla: taskSla,
                        globalDeadline: globalDeadlineTime,
                        subtaskDeadline: deadlineTime,
                        originalDeadline: globalDeadlineTimeOriginal,
                        isHelper: item.task.isHelper === true,
                      };
                    } else {
                      if (globalDeadlineTime > groups[woId].globalDeadline) {
                        groups[woId].globalDeadline = globalDeadlineTime;
                      }
                      if (deadlineTime > groups[woId].subtaskDeadline) {
                        groups[woId].subtaskDeadline = deadlineTime;
                      }
                      if (globalDeadlineTimeOriginal > groups[woId].originalDeadline) {
                        groups[woId].originalDeadline = globalDeadlineTimeOriginal;
                      }
                      if (item.task.isHelper) {
                        groups[woId].isHelper = true;
                      }
                    }
                    if (item.task.isReadOnly) {
                      groups[woId].helperTasks.push(item);
                    } else {
                      groups[woId].myTasks.push(item);
                    }
                  });
                  // Post-process groups to calculate globalTasks, isAllCompleted, globalTotal, and globalCompleted
                  const processedGroups = Object.values(groups).map((g: any) => {
                    let globalTasks = g.wo.categories.flatMap((c: any) => c.tasks).filter((t: any) => {
                      // Cancelled/archived-rejected tasks never happened — exclude from the
                      // completion count, same rule as Dashboard.tsx's isWorkOrderCompleted.
                      if (t.status === 'Cancelled' || (t.status === 'Rejected' && t.taskArchived === true)) return false;
                      const isSupport = t.isSupportRequest === true || t.isHelper === true;
                      return activeTab === 'support' ? isSupport : !isSupport;
                    });

                    const isSupportWO = g.wo.categories.some((c: any) => c.tasks.some((t: any) => t.isSupportRequest));
                    const activeParentTaskIds = new Set<string>();

                    if (isSupportWO && activeTab === 'support') {
                      // Add parent task IDs of tasks in myTasks and helperTasks
                      [...g.myTasks, ...g.helperTasks].forEach(({ task }: any) => {
                        const parentId = task.parentTaskId || task.id.split('-').slice(0, 3).join('-');
                        if (parentId) {
                          activeParentTaskIds.add(parentId);
                        }
                      });

                      // If selectedTaskInfo is active and belongs to this WO, also include its parent ID to prevent it from disappearing if clicked
                      if (selectedTaskInfo && selectedTaskInfo.wo.id === g.wo.id) {
                        const selParentId = (selectedTaskInfo.task as any).parentTaskId || selectedTaskInfo.task.id.split('-').slice(0, 3).join('-');
                        if (selParentId) {
                          activeParentTaskIds.add(selParentId);
                        }
                      }

                      if (activeParentTaskIds.size > 0) {
                        globalTasks = globalTasks.filter((t: any) => {
                          const parentId = t.parentTaskId || t.id.split('-').slice(0, 3).join('-');
                          return activeParentTaskIds.has(parentId);
                        });
                      }
                    }

                    const globalTotal = globalTasks.length;
                    const globalCompleted = globalTasks.filter(
                      (t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100
                    ).length;

                    const isAllCompleted = globalTotal > 0 && globalCompleted === globalTotal;
                    const completedAtTime = getCompletedAtTime(g.wo, globalTasks);

                    return {
                      ...g,
                      globalTasks,
                      globalTotal,
                      globalCompleted,
                      isAllCompleted,
                      completedAtTime,
                      activeParentTaskIds,
                      isSupportWO,
                    };
                  });

                  // Sort groups based on sortBy state
                  processedGroups.sort((a: any, b: any) => {
                    if (sortBy === 'id') {
                      return a.wo.id.localeCompare(b.wo.id);
                    }
                    if (sortBy === 'delivery') {
                      if (a.isAllCompleted && !b.isAllCompleted) return -1;
                      if (!a.isAllCompleted && b.isAllCompleted) return 1;
                    }
                    return a.globalDeadline - b.globalDeadline;
                  });

                  return (
                     <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1.5rem",
                      }}
                    >
                      {" "}
                      
                      <h3
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 900,
                          color: "#334155",
                          marginLeft: "8px",
                          marginBottom: "-4px",
                          textTransform: "uppercase",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {" "}
                        
                        <LayoutDashboard size={12} color="#475569" />{" "}
                        รายการใบงานแยกกลุ่ม (Work Orders)
                      </h3>
                      {processedGroups.map(
                        ({
                          wo,
                          myTasks,
                          helperTasks,
                          globalDeadline,
                          subtaskDeadline,
                          globalTasks,
                          globalTotal,
                          globalCompleted,
                          isAllCompleted,
                          completedAtTime,
                          activeParentTaskIds,
                          isSupportWO,
                        }) => {

                          // Compute other tasks (tasks in WO not owned by this foreman, including helper tasks)
                          const myTaskIds = new Set(myTasks.map(({ task }: any) => task.id));
                          const helperTaskIds = new Set(helperTasks.map(({ task }: any) => task.id));
                          let otherTasks = [
                            ...helperTasks,
                            ...wo.categories.flatMap((c: any) =>
                              c.tasks
                                .filter((t: any) =>
                                  !myTaskIds.has(t.id) && !helperTaskIds.has(t.id) &&
                                  // Cancelled/archived-rejected tasks never happened — this fallback
                                  // branch pulls straight from wo.categories, so it must re-apply the
                                  // same exclusion the main loop uses, or a hidden task reappears here.
                                  t.status !== 'Cancelled' && !(t.status === 'Rejected' && t.taskArchived === true)
                                )
                                .map((t: any) => ({ task: t, categoryId: c.id }))
                            ),
                          ].filter(({ task }: any) => {
                            const isSupport = task.isSupportRequest === true || task.isHelper === true;
                            return activeTab === 'support' ? isSupport : !isSupport;
                          });

                          // Filter other tasks list to only include subtasks of the SAME parent task for support WOs
                          if (isSupportWO && activeTab === 'support' && activeParentTaskIds.size > 0) {
                            otherTasks = otherTasks.filter(({ task }: any) => {
                              const parentId = task.parentTaskId || task.id.split('-').slice(0, 3).join('-');
                              return activeParentTaskIds.has(parentId);
                            });
                          }
                          const isOthersCollapsed = collapsedHelpers[`${wo.id}-others`] !== false;
                          const containsSupportTask = myTasks.some(({ task }: any) => task.isSupportRequest);

                          // Calculate average progress of all tasks/subtasks in this WO
                           const totalProgress = globalTasks.reduce((acc: number, t: any) => acc + (t.dailyProgress ?? t.progress ?? 0), 0);
                           const averageProgress = globalTotal > 0 ? Math.round(totalProgress / globalTotal) : 0;

                           const progressBadge = (
                             <span
                               style={{
                                 fontSize: "0.62rem",
                                 fontWeight: 900,
                                 color: isAllCompleted ? "#0f766e" : "#854d0e",
                                 background: isAllCompleted ? "#ccfbf1" : "#fef9c3",
                                 border: `1px solid ${isAllCompleted ? "#99f6e4" : "#fef08a"}`,
                                 padding: "2px 6px",
                                 borderRadius: "4px",
                                 display: "inline-flex",
                                 alignItems: "center",
                                 gap: "2px",
                               }}
                             >
                               {isAllCompleted ? "✓" : "⏳"} เสร็จ {globalCompleted}/{globalTotal}
                             </span>
                           );

                           const avgProgressBadge = (
                             <span
                               style={{
                                 fontSize: "0.62rem",
                                 fontWeight: 900,
                                 color: "#2563eb",
                                 background: "#eff6ff",
                                 border: "1px solid #bfdbfe",
                                 padding: "2px 6px",
                                 borderRadius: "4px",
                                 display: "inline-flex",
                                 alignItems: "center",
                                 gap: "2px",
                               }}
                             >
                               📊 {averageProgress}%
                             </span>
                           );

                          let groupBorderColor = "#cbd5e1";
                          let groupHeaderBg =
                            "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)";
                          
                          if (isAllCompleted) {
                            groupBorderColor = "#a5f3fc";
                            groupHeaderBg =
                              "linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)";
                          } else if (containsSupportTask) {
                            groupBorderColor = "#bae6fd";
                            groupHeaderBg =
                              "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)";
                          } else if (globalCompleted > 0 || globalTasks.some((t: any) => (t.dailyProgress ?? t.progress ?? 0) > 0)) {
                            groupBorderColor = "#fef08a";
                            groupHeaderBg =
                              "linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)";
                          }

                          return (
                             <div
                              style={{
                                background: "#fff",
                                border: `2px solid ${groupBorderColor}`,
                                borderRadius: "20px",
                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                                overflow: "hidden",
                              }}
                              key={wo.id}
                            >
                              {" "}
                              
                              <div
                                style={{
                                  background: groupHeaderBg,
                                  padding: "14px 16px",
                                  borderBottom: `1px solid ${groupBorderColor}`,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                }}
                              >
                                {" "}
                                
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  {" "}
                                  
                                  <span
                                    style={{
                                      fontSize: "0.78rem",
                                      fontWeight: 900,
                                      color: "#0f172a",
                                      ...(isMobile ? identifierStyle : {}),
                                    }}
                                  >
                                    {wo.id}
                                  </span>
                                  {containsSupportTask && (
                                    <span
                                      style={{
                                        marginLeft: "8px",
                                        fontSize: "0.62rem",
                                        fontWeight: 900,
                                        color: "#0369a1",
                                        background: "#e0f2fe",
                                        padding: "2px 6px",
                                        borderRadius: "6px",
                                        border: "1px solid #bae6fd",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "2px",
                                      }}
                                    >
                                      🤝 งานช่วยเหลือ (Support)
                                    </span>
                                  )}{" "}
                                  
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                    }}
                                  >
                                     {globalTotal > 0 && avgProgressBadge}
                                     {globalTotal > 0 && progressBadge}
                                    {isAllCompleted &&
                                      (() => {
                                        const isWoOwner =
                                           wo.woOwnerId === user?.id ||
                                           (user?.employeeId &&
                                             wo.woOwnerId === user.employeeId) ||
                                           wo.reporterId === user?.id ||
                                           (user?.employeeId &&
                                             wo.reporterId === user.employeeId);
                                        return isWoOwner ? (
                                           <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                let token = wo.deliveryQrToken;
                                                if (!token) {
                                                  if (
                                                    window.confirm(
                                                      "คุณต้องการสร้าง QR Code สำหรับส่งมอบงานให้ลูกค้าตรวจรับใช่หรือไม่?",
                                                    )
                                                  ) {
                                                    token =
                                                      await generateDeliveryQrToken(
                                                        wo.id,
                                                        user?.employeeId ||
                                                          user?.id ||
                                                          "unknown",
                                                      );
                                                    await showAlert(
                                                      "สร้าง QR Code สำหรับส่งมอบเรียบร้อย!",
                                                    );
                                                  } else {
                                                    return;
                                                  }
                                                }
                                                setQrModalWo(wo);
                                                setShowQrModal(true);
                                              } catch (err) {
                                                console.error(err);
                                                await showAlert(
                                                  "เกิดข้อผิดพลาดในการเปิดการส่งมอบ",
                                                );
                                              }
                                            }}
                                            style={{
                                              fontSize: "0.62rem",
                                              fontWeight: 900,
                                              color: "#ffffff",
                                              background:
                                                "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                              border: "none",
                                              padding: "3px 8px",
                                              borderRadius: "6px",
                                              cursor: "pointer",
                                              boxShadow:
                                                "0 2px 4px rgba(16, 185, 129, 0.2)",
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "3px",
                                              transition: "all 0.2s",
                                            }}
                                            onMouseOver={(el) =>
                                              (el.currentTarget.style.transform =
                                                "scale(1.05)")
                                            }
                                            onMouseOut={(el) =>
                                              (el.currentTarget.style.transform =
                                                "scale(1)")
                                            }
                                          >
                                            {" "}
                                            
                                            <QrCode size={10} /> สร้าง QR Code
                                          </button>
                                        ) : null;
                                      })()}
                                  </div>
                                </div>{" "}
                                
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    fontWeight: 800,
                                    color: "#475569",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  📍 {wo.locationName}
                                </div>{" "}
                                
                                <div
                                  style={{
                                    marginTop: "6px",
                                    borderTop: "1px dashed #cbd5e1",
                                    paddingTop: "6px",
                                  }}
                                >
                                  {" "}
                                  
                                  <GroupSLACountdown
                                    globalDeadline={globalDeadline}
                                    subtaskDeadline={subtaskDeadline}
                                    isCompleted={isAllCompleted}
                                    originalDeadline={groups[wo.id]?.originalDeadline}
                                    isRevision={!!(wo as any).categories?.flatMap((c: any) => c.tasks).find((t: any) => t.currentRevision && t.currentRevision !== 'rev00')}
                                    completedAtTime={completedAtTime}
                                  />
                                </div>
                              </div>{" "}
                              
                              <div
                                style={{
                                  padding: "12px",
                                }}
                              >
                                {myTasks.length > 0 && (
                                   <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "8px",
                                    }}
                                  >
                                    {myTasks.map(({ task, categoryId }: any) =>
                                      renderTaskCard(
                                        task,
                                        wo,
                                        categoryId,
                                        false,
                                      ),
                                    )}
                                  </div>
                                )}
                                {otherTasks.length > 0 && (
                                   <div
                                     style={{
                                       marginTop:
                                         myTasks.length > 0 ? "12px" : "0px",
                                       borderTop:
                                         myTasks.length > 0
                                           ? "1.5px dashed #f1f5f9"
                                           : "none",
                                       paddingTop:
                                         myTasks.length > 0 ? "10px" : "0px",
                                     }}
                                   >
                                     <button
                                       onClick={() =>
                                         setCollapsedHelpers((prev) => ({
                                           ...prev,
                                           [`${wo.id}-others`]: !isOthersCollapsed,
                                         }))
                                       }
                                       style={{
                                         width: "100%",
                                         background: "#f1f5f9",
                                         border: "1px dashed #94a3b8",
                                         padding: "6px 12px",
                                         borderRadius: "10px",
                                         color: "#475569",
                                         fontSize: "0.7rem",
                                         fontWeight: 800,
                                         cursor: "pointer",
                                         display: "flex",
                                         alignItems: "center",
                                         justifyContent: "center",
                                         gap: "4px",
                                         marginBottom: isOthersCollapsed ? "0px" : "10px",
                                       }}
                                     >
                                       {isOthersCollapsed
                                         ? `🔒 งานอื่นๆ ใน WO (${otherTasks.length} งาน)`
                                         : `🔒 ซ่อนงานอื่นๆ`}
                                     </button>
                                     {!isOthersCollapsed && (
                                       <div
                                         style={{
                                           display: "flex",
                                           flexDirection: "column",
                                           gap: "6px",
                                         }}
                                       >
                                         {otherTasks.map(({ task }: any) => {
                                           const prog = task.dailyProgress ?? task.progress ?? 0;
                                           const isDone = prog === 100;
                                           const isInProg = prog > 0 && prog < 100;
                                           const sColor = isDone ? "#059669" : isInProg ? "#d97706" : "#94a3b8";
                                           const sBg = isDone ? "#d1fae5" : isInProg ? "#fef9c3" : "#f1f5f9";
                                           const sLabel = isDone ? "✓ เสร็จ" : isInProg ? `${prog}%` : "○ รอ";

                                           // Resolve foreman name
                                            let foremanName = "";
                                            if (task.assignees && task.assignees.length > 0) {
                                              foremanName = task.assignees.map((a: any) => a.name).join(", ");
                                            } else if (task.assignee) {
                                              foremanName = task.assignee;
                                            } else if (task.responsibleStaffIds && task.responsibleStaffIds.length > 0) {
                                              const staffId = task.responsibleStaffIds[0];
                                              const f = staff.find((s) => s.id === staffId || s.employeeId === staffId);
                                              if (f) {
                                                foremanName = f.name;
                                              } else {
                                                foremanName = staffId;
                                              }
                                            } else if (task.subtaskOperatorId) {
                                              const f = staff.find((s) => s.id === task.subtaskOperatorId || s.employeeId === task.subtaskOperatorId);
                                              if (f) {
                                                foremanName = f.name;
                                              } else {
                                                foremanName = task.subtaskOperatorId;
                                              }
                                            }
                                            
                                            if (foremanName && !foremanName.startsWith("คุณ")) {
                                              foremanName = `คุณ${foremanName}`;
                                            }
                                            
                                            return (
                                             <div
                                               key={task.id}
                                               style={{
                                                 background: "#f8fafc",
                                                 border: "1px solid #e2e8f0",
                                                 borderRadius: "10px",
                                                 padding: "8px 10px",
                                                 display: "flex",
                                                 alignItems: "center",
                                                 gap: "10px",
                                               }}
                                             >
                                               <div
                                                 style={{
                                                   width: "32px",
                                                   height: "32px",
                                                   borderRadius: "50%",
                                                   background: sBg,
                                                   border: `2px solid ${sColor}`,
                                                   display: "flex",
                                                   alignItems: "center",
                                                   justifyContent: "center",
                                                   fontSize: "0.6rem",
                                                   fontWeight: 900,
                                                   color: sColor,
                                                   flexShrink: 0,
                                                 }}
                                               >
                                                 {isDone ? "✓" : isInProg ? prog : "○"}
                                               </div>
                                               <div style={{ flex: 1, minWidth: 0 }}>
                                                 <div
                                                   style={{
                                                     fontSize: "0.6rem",
                                                     fontWeight: 800,
                                                     color: "#94a3b8",
                                                     marginBottom: "1px",
                                                     display: "flex",
                                                     alignItems: "center",
                                                     gap: "6px",
                                                     flexWrap: "wrap",
                                                   }}
                                                 >
                                                    <span>{formatSubtaskId(task.subtaskId || task.id) || ""}</span>
                                                     {task.currentRevision && task.currentRevision !== "rev00" && (
                                                       <span
                                                         style={{
                                                           fontSize: "0.58rem",
                                                           fontWeight: 900,
                                                           color: "#ef4444",
                                                           textTransform: "uppercase",
                                                           background: "#fee2e2",
                                                           padding: "1px 4px",
                                                           borderRadius: "3px",
                                                           whiteSpace: "nowrap",
                                                           border: "1px solid #fca5a5",
                                                           marginLeft: "4px",
                                                         }}
                                                       >
                                                         REV. {parseInt(task.currentRevision.replace("rev", ""))}
                                                       </span>
                                                     )}
                                                   {foremanName && (
                                                     <span style={{ color: "#6366f1", fontWeight: 700 }}>
                                                       • 👤 {foremanName}
                                                     </span>
                                                   )}
                                                 </div>
                                                 <div
                                                   style={{
                                                     fontSize: "0.72rem",
                                                     fontWeight: 700,
                                                     color: "#475569",
                                                     overflow: "hidden",
                                                     textOverflow: "ellipsis",
                                                     whiteSpace: "nowrap",
                                                   }}
                                                 >
                                                    {task.isHelper ? (task.subtaskName || task.name || task.taskName || task.description || "-") : (task.name || task.taskName || task.description || "-")}
                                                 </div>
                                               </div>
                                               <span
                                                 style={{
                                                   fontSize: "0.62rem",
                                                   fontWeight: 900,
                                                   color: sColor,
                                                   background: sBg,
                                                   padding: "2px 7px",
                                                   borderRadius: "5px",
                                                   flexShrink: 0,
                                                 }}
                                               >
                                                 {sLabel}
                                               </span>
                                             </div>
                                           );
                                         })}
                                       </div>
                                     )}
                                   </div>
                                 )}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  );
                })()}
              </Fragment>
            )}
          </div>
          
          {/* Handover QR Code Modal */}
          {showQrModal && qrModalWo && (() => {
            const qrBaseUrl = ipOverride ? (ipOverride.startsWith('http') ? ipOverride : `http://${ipOverride}:5173`) : window.location.origin;
            return (
              <div 
                onClick={() => setShowQrModal(false)}
                style={{
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 9999, padding: '20px'
                }}
              >
                <div 
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: '#ffffff', width: '100%', maxWidth: '420px',
                    borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                    padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', padding: '4px 12px', borderRadius: '50px', border: '1px solid #d1fae5', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#065f46', letterSpacing: '0.05em' }}>ハンドオーバー / HANDOVER</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>คิวอาร์โค้ดส่งมอบงาน (Handover)</h3>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                      ให้ลูกค้าใช้มือถือสแกนคิวอาร์โค้ดนี้เพื่อเปิดหน้าจอตรวจรับงานในวง Wi-Fi เดียวกัน
                    </p>
                  </div>

                  {/* Local Network IP Helper for localhost */}
                  {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                    <div style={{ width: '100%', padding: '14px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>⚠️ ตรวจพบการใช้งานผ่าน Localhost</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#78350f', lineHeight: 1.4, textAlign: 'left' }}>
                        มือถือภายนอกจะไม่สามารถสแกนคิวอาร์โค้ดที่ชี้ไปที่ <code>localhost</code> ได้โดยตรง กรุณากรอก IP คอมพิวเตอร์ของคุณเพื่อเปลี่ยนเส้นทางลิงก์:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input 
                          type="text" 
                          placeholder="เช่น 192.168.61.130"
                          value={ipOverride}
                          onChange={(e) => setIpOverride(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#334155',
                            background: '#ffffff'
                          }}
                        />
                        <button
                          onClick={() => setIpOverride('192.168.61.130')}
                          style={{
                            padding: '6px 10px',
                            background: '#fbbf24',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            color: '#78350f',
                            cursor: 'pointer'
                          }}
                        >
                          ดึงค่าด่วน
                        </button>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#9a3412', fontStyle: 'italic', marginTop: '2px', textAlign: 'left' }}>
                        *ลิงก์ QR จะเปลี่ยนเป็น: <code style={{ wordBreak: 'break-all' }}>{qrBaseUrl}/handover?woId={qrModalWo.id}</code>
                      </div>
                    </div>
                  )}

                  {/* QR Code image */}
                  <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '18px', border: '1px dashed #cbd5e1' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrBaseUrl + '/handover?woId=' + qrModalWo.id)}`} 
                      alt="Handover QR Code"
                      style={{ width: '200px', height: '200px', display: 'block' }}
                    />
                  </div>

                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      onClick={async () => {
                        navigator.clipboard.writeText(`${qrBaseUrl}/handover?woId=${qrModalWo.id}`);
                        await showAlert('คัดลอกลิงก์ส่งมอบเรียบร้อย!');
                      }}
                      style={{
                        width: '100%', padding: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1',
                        borderRadius: '12px', fontSize: '0.82rem', fontWeight: 900, color: '#334155', cursor: 'pointer'
                      }}
                    >
                      📋 คัดลอกลิงก์ส่งมอบ
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowQrModal(false);
                        setMockupWorkOrder(qrModalWo);
                        setIsCustomerMockupOpen(true);
                      }}
                      style={{
                        width: '100%', padding: '10px', background: '#3b82f6', border: 'none',
                        borderRadius: '12px', fontSize: '0.82rem', fontWeight: 900, color: '#ffffff', cursor: 'pointer'
                      }}
                    >
                      💻 เปิดหน้าจอตรวจรับ (จำลองบนเครื่องนี้)
                    </button>
                    
                    <button
                      onClick={() => setShowQrModal(false)}
                      style={{
                        width: '100%', padding: '10px', background: 'transparent', border: 'none',
                        fontSize: '0.82rem', fontWeight: 800, color: '#64748b', cursor: 'pointer', marginTop: '4px'
                      }}
                    >
                      ปิดหน้าต่าง
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
  );
};
