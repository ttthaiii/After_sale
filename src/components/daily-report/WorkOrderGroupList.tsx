import React, { Fragment } from "react";
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
} from "lucide-react";
import { useDailyReport } from "../../context/DailyReportContext";
import { GroupSLACountdown } from "./SLACountdowns";
import { WorkTask, WorkOrder } from "../../types/dailyReport.types";
import { MOCK_STAFF } from "../../data/mockData";

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
    newTasks,
    inProgressTasks,
    pendingInspectionTasks,
    pendingDeliveryWorkOrders,
    handleSelectTask,
    getTaskImage,
    realProjects,
    setIsCustomerMockupOpen,
    setMockupWorkOrder,
    generateDeliveryQrToken,
  } = useDailyReport();

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
        onClick={() => {
          if (isTaskDisabledInRejectedWo) {
            return;
          }
          if ((task.dailyProgress || 0) === 100 || task.status === 'completed' || task.status === 'Verified') {
            return;
          }
          if (isReadOnly) {
            alert(
              "คุณเห็นงานนี้ในฐานะผู้ดูแลภาพรวมใบงาน (Owner) เท่านั้น ไม่สามารถแก้ไขหรือบันทึกรายงานได้ (เฉพาะช่างผู้มาช่วยเท่านั้นที่อัปเดตได้)",
            );
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
            : isHighlighted
              ? "#3b82f6"
              : isReadOnly
                ? "#cbd5e1"
                : isCompleted100
                  ? "#a7f3d0"
                  : isNew
                    ? "#fcd34d"
                    : "#f1f5f9",
          background: isSelected
            ? (isCompleted100 ? "#ecfdf5" : "#eff6ff")
            : isHighlighted
              ? "#eff6ff"
              : isReadOnly
                ? "#f8fafc"
                : isCompleted100
                  ? "#f0fdf4"
                  : isNew
                    ? "#fffbeb"
                    : "#fff",
          cursor: isTaskDisabledInRejectedWo
            ? "default"
            : ((task.dailyProgress || 0) === 100 || task.status === 'completed' || task.status === 'Verified')
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
            : ((task.dailyProgress || 0) === 100 || task.status === 'completed' || task.status === 'Verified')
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
                color: "#3b82f6",
                textTransform: "uppercase",
                background: "#dbeafe",
                padding: "2px 5px",
                borderRadius: "4px",
                whiteSpace: "nowrap",
              }}
            >
              {task.id || task.taskCode}
            </div>
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
            {task.name}
            {task.currentRevision && task.currentRevision !== "rev00" && (
              <span
                style={{
                  color: "#ef4444",
                  marginLeft: "6px",
                  fontWeight: 900,
                  background: "#fef2f2",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  border: "1px solid #fca5a5",
                  fontSize: "0.62rem",
                  display: "inline-block",
                }}
              >
                REV. {parseInt(task.currentRevision.replace("rev", ""))}
              </span>
            )}
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
              const isHelper = wo.id.includes("202G") || wo.id.includes("G-WO");
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
          {wo.status === "Rejected" && !wo.reviewedByAdmin && task.evaluationStatus === "Rejected" && (
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
                  background: "#fee2e2",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontWeight: 900,
                  fontSize: "0.68rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  border: "1px solid #fca5a5",
                }}
              >
                <AlertTriangle size={10} style={{ color: "#ef4444" }} />
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
          </div>{" "}
          
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
            pendingInspectionTasks.length === 0 ? (
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
                    {pendingDeliveryWorkOrders.map(({ wo }) => {
                      const isHelper = wo.id.includes("202G") || wo.id.includes("G-WO");
                      const isWoOwner =
                        !isHelper &&
                        (wo.woOwnerId === user?.id ||
                          (user?.employeeId && wo.woOwnerId === user.employeeId) ||
                          wo.reporterId === user?.id ||
                          (user?.employeeId && wo.reporterId === user.employeeId));

                      const globalTasks = wo.categories.flatMap((c) => c.tasks);
                      const globalIsAllCompleted =
                        globalTasks.length > 0 &&
                        globalTasks.every(
                          (t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100,
                        );
                      
                      // Calculate global deadlines
                      let maxDl = 0;
                      let minSubDl = Infinity;
                      wo.categories.forEach((cat) => {
                        cat.tasks.forEach((t) => {
                          const slaHoursMap = {
                            Immediately: 4,
                            "24h": 24,
                            "1-3d": 72,
                            "3-7d": 168,
                            "7-14d": 336,
                            "14-30d": 720,
                          };
                          const tSla = t.slaCategory || t.baselineSla || t.estimatedSla || "24h";
                          const tDurHours = slaHoursMap[tSla] || 24;
                          let tStart = t.slaStartTime;
                          if (!tStart && t.startDate) {
                            tStart = `${t.startDate}T08:00:00`;
                          }
                          if (!tStart) {
                            tStart = wo.createdAt || new Date().toISOString();
                          }
                          const tDeadline = new Date(tStart).getTime() + tDurHours * 60 * 60 * 1e3;
                          if (tDeadline > maxDl) {
                            maxDl = tDeadline;
                          }
                          if (t.deadline) {
                            const subDl = new Date(t.deadline).getTime();
                            if (subDl < minSubDl) {
                              minSubDl = subDl;
                            }
                          }
                        });
                      });
                      const globalDeadline = maxDl > 0 ? maxDl : new Date().getTime();
                      const subtaskDeadline = minSubDl !== Infinity ? minSubDl : globalDeadline;

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
                            if (wo.status === 'Completed' || wo.status === 'pending_delivery') {
                              return; // Do nothing for fully completed/pending delivery WOs
                            }
                            if (wo.status === 'Rejected' && !wo.reviewedByAdmin) {
                              return; // Do not auto-select any task if awaiting admin
                            }
                            if (globalTasks.length > 0) {
                              // Select the first rejected task, or first unfinished task, or first task
                              const activeTask =
                                globalTasks.find((t) => t.evaluationStatus === 'Rejected') ||
                                globalTasks.find((t) => (t.dailyProgress || 0) < 100) ||
                                globalTasks[0];
                              const catId = wo.categories.find((c) =>
                                c.tasks.some((t) => t.id === activeTask.id)
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
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.78rem",
                                  fontWeight: 900,
                                  color: "#0f172a",
                                }}
                              >
                                {wo.id}
                              </span>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
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
                                        : "#0891b2",
                                    background: wo.status === "Completed"
                                      ? "#d1fae5"
                                      : wo.status === "Rejected"
                                        ? "#fee2e2"
                                        : "#cffafe",
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
                                      : "✓ เสร็จครบ 100%"}
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
                                            alert("สร้าง QR Code สำหรับส่งมอบเรียบร้อย!");
                                          } else {
                                            return;
                                          }
                                        }
                                        setMockupWorkOrder(wo);
                                        setIsCustomerMockupOpen(true);
                                      } catch (err) {
                                        console.error(err);
                                        alert("เกิดข้อผิดพลาดในการเปิดการส่งมอบ");
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
                                    }}
                                    onMouseOver={(el) => (el.currentTarget.style.transform = "scale(1.05)")}
                                    onMouseOut={(el) => (el.currentTarget.style.transform = "scale(1)")}
                                  >
                                    <QrCode size={10} /> สร้าง QR Code
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
                                isCompleted={true}
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
                              {globalTasks.map((task) => {
                                const categoryId = wo.categories.find((c) =>
                                  c.tasks.some((t) => t.id === task.id)
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
                    const woId = item.wo.id;
                    const slaHoursMap: Record<string, number> = {
                      Immediately: 4,
                      "24h": 24,
                      "1-3d": 72,
                      "3-7d": 168,
                      "7-14d": 336,
                      "14-30d": 720,
                    };
                    const taskSla =
                      item.task.slaCategory ||
                      item.task.baselineSla ||
                      item.task.estimatedSla ||
                      "24h";
                    const durationHours = slaHoursMap[taskSla] || 24;
                    let startTime = item.task.slaStartTime;
                    if (!startTime && item.task.startDate) {
                      startTime = `${item.task.startDate}T08:00:00`;
                    }
                    if (!startTime) {
                      startTime =
                        item.wo.createdAt ||
                         new Date().toISOString();
                    }
                    const deadlineTime =
                      new Date(startTime).getTime() +
                      durationHours * 60 * 60 * 1e3;
                    let globalDeadlineTime = deadlineTime;
                    const fullWo = (workOrders as any[]).find((w) => w.id === woId);
                    if (fullWo) {
                      let maxDl = 0;
                      fullWo.categories.forEach((cat: any) => {
                        cat.tasks.forEach((t: any) => {
                          const tSla =
                            t.slaCategory ||
                            t.baselineSla ||
                            t.estimatedSla ||
                            "24h";
                          const tDurHours = slaHoursMap[tSla] || 24;
                          let tStart = t.slaStartTime;
                          if (!tStart && t.startDate) {
                            tStart = `${t.startDate}T08:00:00`;
                          }
                          if (!tStart) {
                            tStart =
                              fullWo.createdAt ||
                               new Date().toISOString();
                          }
                          const tDeadline =
                            new Date(tStart).getTime() +
                            tDurHours * 60 * 60 * 1e3;
                          if (tDeadline > maxDl) {
                            maxDl = tDeadline;
                          }
                        });
                      });
                      if (maxDl > 0) {
                        globalDeadlineTime = maxDl;
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
                      };
                    } else {
                      if (globalDeadlineTime > groups[woId].globalDeadline) {
                        groups[woId].globalDeadline = globalDeadlineTime;
                      }
                      if (deadlineTime > groups[woId].subtaskDeadline) {
                        groups[woId].subtaskDeadline = deadlineTime;
                      }
                    }
                    if (item.task.isReadOnly) {
                      groups[woId].helperTasks.push(item);
                    } else {
                      groups[woId].myTasks.push(item);
                    }
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
                      {Object.values(groups).map(
                        ({
                          wo,
                          myTasks,
                          helperTasks,
                          globalDeadline,
                          subtaskDeadline,
                        }) => {

                          
                          // Calculate global completion status for this Work Order group
                          const globalTasks = wo.categories.flatMap((c: any) => c.tasks);
                          const globalTotal = globalTasks.length;
                          const globalCompleted = globalTasks.filter(
                            (t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100
                          ).length;
                          const globalRemaining = globalTotal - globalCompleted;
                          const isAllCompleted = globalTotal > 0 && globalCompleted === globalTotal;

                          // Compute other tasks (tasks in WO not owned by this foreman, including helper tasks)
                          const myTaskIds = new Set(myTasks.map(({ task }: any) => task.id));
                          const helperTaskIds = new Set(helperTasks.map(({ task }: any) => task.id));
                          const otherTasks = [
                            ...helperTasks,
                            ...wo.categories.flatMap((c: any) =>
                              c.tasks
                                .filter((t: any) => !myTaskIds.has(t.id) && !helperTaskIds.has(t.id))
                                .map((t: any) => ({ task: t, categoryId: c.id }))
                            ),
                          ];
                          const isOthersCollapsed = collapsedHelpers[`${wo.id}-others`] !== false;

                          let groupBorderColor = "#cbd5e1";
                          let groupHeaderBg =
                            "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)";
                          
                          if (isAllCompleted) {
                            groupBorderColor = "#a5f3fc";
                            groupHeaderBg =
                              "linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)";
                          } else if (globalCompleted > 0 || globalTasks.some((t: any) => (t.dailyProgress ?? t.progress ?? 0) > 0)) {
                            groupBorderColor = "#fef08a";
                            groupHeaderBg =
                              "linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)";
                          }

                          let statusBadge = null;
                          if (isAllCompleted) {
                            statusBadge = (
                              <span
                                style={{
                                  fontSize: "0.62rem",
                                  fontWeight: 900,
                                  color: "#0891b2",
                                  background: "#cffafe",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "2px",
                                }}
                              >
                                ✓ {globalTotal} เสร็จ
                              </span>
                            );
                          } else {
                            statusBadge = (
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                {globalRemaining > 0 && (
                                  <span
                                    style={{
                                      fontSize: "0.62rem",
                                      fontWeight: 900,
                                      color: "#854d0e",
                                      background: "#fef9c3",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "2px",
                                    }}
                                  >
                                    ⏳ {globalRemaining}
                                  </span>
                                )}
                                {globalCompleted > 0 && (
                                  <span
                                    style={{
                                      fontSize: "0.62rem",
                                      fontWeight: 900,
                                      color: "#0f766e",
                                      background: "#ccfbf1",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "2px",
                                    }}
                                  >
                                    ✓ {globalCompleted}
                                  </span>
                                )}
                              </div>
                            );
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
                                    }}
                                  >
                                    {wo.id}
                                  </span>{" "}
                                  
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    {statusBadge}
                                    {isAllCompleted &&
                                      (() => {
                                        const isHelper =
                                          wo.id.includes("202G") ||
                                          wo.id.includes("G-WO");
                                        const isWoOwner =
                                          !isHelper &&
                                          (wo.woOwnerId === user?.id ||
                                            (user?.employeeId &&
                                              wo.woOwnerId ===
                                                user.employeeId));
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
                                                    alert(
                                                      "สร้าง QR Code สำหรับส่งมอบเรียบร้อย!",
                                                    );
                                                  } else {
                                                    return;
                                                  }
                                                }
                                                setMockupWorkOrder(wo);
                                                setIsCustomerMockupOpen(true);
                                              } catch (err) {
                                                console.error(err);
                                                alert(
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
                                            
                                            <QrCode size={10} /> ส่งมอบภาพรวม
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
                                              const f = MOCK_STAFF.find((s) => s.id === staffId || s.name.toLowerCase().includes(staffId.toLowerCase()));
                                              if (f) {
                                                foremanName = f.name;
                                              } else {
                                                foremanName = staffId;
                                              }
                                            } else if (task.subtaskOperatorId) {
                                              const f = MOCK_STAFF.find((s) => s.id === task.subtaskOperatorId || s.name.toLowerCase().includes(task.subtaskOperatorId.toLowerCase()));
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
                                                   <span>{task.id || ""}</span>
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
                                                   {task.name || task.taskName || task.description || "-"}
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
        </div>
  );
};
