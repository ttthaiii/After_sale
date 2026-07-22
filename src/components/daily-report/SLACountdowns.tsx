import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { TimeLeft, SLACountdownProps, GroupSLACountdownProps } from "../../types/dailyReport.types";
import { formatDate, formatDateTime } from "../../utils/date";
import { todayTH } from "../../lib/dateUtils";

// Helper: format deadline date
export const formatDeadline = (timestamp: number | string | undefined) => {
  if (!timestamp) return "-";
  return formatDateTime(timestamp);
};

export const SLACountdown: React.FC<SLACountdownProps & { isHelper?: boolean }> = ({
  startTime,
  durationHours = 24,
  appointmentDate,
  actualStartDate,
  isCompleted,
  groupDeadline,
  isHelper = false,
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (isHelper && groupDeadline) {
        const end = new Date(groupDeadline).getTime();
        const now = new Date().getTime();
        const diff = end - now;
        if (diff < 0) {
          const overdueDiff = Math.abs(diff);
          const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
          const hours = Math.floor(
            (overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          );
          const minutes = Math.floor(
            (overdueDiff % (1000 * 60 * 60)) / (1000 * 60),
          );
          setTimeLeft({ days, hours, minutes, isOverdue: true });
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor(
            (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          );
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft({ days, hours, minutes, isOverdue: false });
        }
        return;
      }
      const start2 = new Date(startTime).getTime();
      const end = start2 + durationHours * 60 * 60 * 1000;
      const now = new Date().getTime();
      const diff = end - now;
      if (diff < 0) {
        const overdueDiff = Math.abs(diff);
        const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor(
          (overdueDiff % (1000 * 60 * 60)) / (1000 * 60),
        );
        setTimeLeft({ days, hours, minutes, isOverdue: true });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft({ days, hours, minutes, isOverdue: false });
      }
    };
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(timer);
  }, [startTime, durationHours]);

  if (!timeLeft)
    return (
      <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>คำนวณเวลา...</div>
    );

  const durationDays = durationHours / 24;
  const formattedDurationDays = `${durationDays} วัน`;
  const formattedAppDate = appointmentDate
    ? formatDate(appointmentDate)
    : "ไม่ระบุ";

  const todayStr = todayTH();
  const isAppTodayOrPast = appointmentDate ? appointmentDate <= todayStr : true;
  const step2Text = actualStartDate
    ? `เริ่มจริงเมื่อ ${formatDate(actualStartDate)}`
    : isAppTodayOrPast
      ? "เริ่มได้แล้ววันนี้"
      : `เริ่มได้เมื่อ ${formattedAppDate}`;

  const start = new Date(startTime).getTime();
  const deadlineTime = start + durationHours * 60 * 60 * 1000;
  const deadlineDate = new Date(deadlineTime);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineMidnight = new Date(deadlineDate);
  deadlineMidnight.setHours(0, 0, 0, 0);
  const timeDiff = deadlineMidnight.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (isHelper) {
    const formattedDeadline = groupDeadline ? formatDate(groupDeadline) : "-";

    let timeText = "";
    let textColor = "#10b981"; 
    if (isCompleted) {
      timeText = "✅ เสร็จสมบูรณ์ 100%";
      textColor = "#0891b2";
    } else if (timeLeft?.isOverdue) {
      timeText = `🚨 เกินกำหนดมา ${timeLeft.days > 0 ? `${timeLeft.days} วัน ` : ""}${timeLeft.hours} ชม.`;
      textColor = "#ef4444";
    } else if (timeLeft) {
      if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0) {
        timeText = "⏳ ครบกำหนดวันนี้!";
        textColor = "#d97706";
      } else {
        timeText = `⏳ เหลืออีก ${timeLeft.days > 0 ? `${timeLeft.days} วัน ` : ""}${timeLeft.hours} ชม.`;
        textColor = "#10b981";
      }
    }

    return (
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)",
          backdropFilter: "blur(8px)",
          padding: "10px 14px",
          borderRadius: "16px",
          border: "1.5px solid rgba(226,232,240,0.9)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
          <Clock size={13} style={{ color: textColor }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 900, color: "#334155" }}>
            กำหนดเวลา (งานช่วยเหลือ)
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.72rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b", fontWeight: 800 }}>กำหนดส่งมอบ:</span>
            <span style={{ fontWeight: 900, color: "#1e293b" }}>{formattedDeadline}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
            <span style={{ color: "#64748b", fontWeight: 800 }}>เวลาคงเหลือ:</span>
            <span style={{ fontWeight: 900, color: textColor }}>{timeText}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)",
        backdropFilter: "blur(8px)",
        padding: "8px 12px",
        borderRadius: "16px",
        border: "1px solid rgba(226,232,240,0.9)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: "6px",
        }}
      >
        <Clock
          size={13}
          style={{
            color: isCompleted
              ? "#0891b2"
              : timeLeft.isOverdue
                ? "#ef4444"
                : "#0891b2",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 900,
            color: "#334155",
            letterSpacing: "0.02em",
          }}
        >
          การประเมินกำหนดส่งเป้าหมาย (SLA)
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.72rem",
          }}
        >
          <span style={{ color: "#0284c7", fontWeight: 900, flexShrink: 0 }}>
            1. วันนัดดำเนินการ:
          </span>
          <span style={{ fontWeight: 800, color: "#1e293b" }}>
            {formattedAppDate}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.72rem",
          }}
        >
          <span style={{ color: "#c026d3", fontWeight: 900, flexShrink: 0 }}>
            2. เป้าหมาย SLA:
          </span>
          <span style={{ fontWeight: 800, color: "#1e293b" }}>
            {formattedDurationDays}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.72rem",
          }}
        >
          <span style={{ color: "#0891b2", fontWeight: 900, flexShrink: 0 }}>
            3. การเริ่มงาน:
          </span>
          <span style={{ fontWeight: 800, color: "#1e293b" }}>{step2Text}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.72rem",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: isCompleted
                ? "#0891b2"
                : timeLeft.isOverdue
                  ? "#dc2626"
                  : "#16a34a",
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            4. เวลาคงเหลือ:
          </span>
          <span
            style={{
              fontWeight: 900,
              color: isCompleted
                ? "#0891b2"
                : timeLeft.isOverdue
                  ? "#ef4444"
                  : "#10b981",
              fontSize: "0.76rem",
            }}
          >
            {isCompleted
              ? "✅ เสร็จสมบูรณ์ 100%"
              : daysDiff > 0
                ? `เหลืออีก ${daysDiff} วัน`
                : daysDiff === 0
                  ? `ครบกำหนดวันนี้!`
                  : `เกินกำหนดมา ${Math.abs(daysDiff)} วัน`}
          </span>
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              color: "#94a3b8",
              marginLeft: "auto",
            }}
          >
            (เดดไลน์{" "}
            {formatDate(deadlineTime)}
            )
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.72rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#0284c7", fontWeight: 900, flexShrink: 0 }}>
            5. ส่งมอบลูกค้ารวม:
          </span>
          <span style={{ fontWeight: 800, color: "#1e293b" }}>
            {groupDeadline
              ? formatDate(groupDeadline)
              : "-"}
            {groupDeadline &&
              groupDeadline > deadlineTime &&
              !isCompleted &&
              " (มีเวลาเผื่อ)"}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Component: GroupSLACountdown
// ─────────────────────────────────────────────────────────────────────────────

export const GroupSLACountdown: React.FC<GroupSLACountdownProps & { isHelper?: boolean }> = ({
  globalDeadline,
  subtaskDeadline,
  isCompleted,
  originalDeadline,
  isRevision = false,
  isHelper = false,
  completedAtTime,
}) => {
  const [timeLeftGlobal, setTimeLeftGlobal] = useState<TimeLeft | null>(null);
  const [timeLeftSub, setTimeLeftSub] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const diffGlobal = globalDeadline - now;
      if (diffGlobal < 0) {
        const overdueDiff = Math.abs(diffGlobal);
        const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor(
          (overdueDiff % (1000 * 60 * 60)) / (1000 * 65),
        );
        setTimeLeftGlobal({ days, hours, minutes, isOverdue: true });
      } else {
        const days = Math.floor(diffGlobal / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (diffGlobal % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor(
          (diffGlobal % (1000 * 60 * 60)) / (1000 * 60),
        );
        setTimeLeftGlobal({ days, hours, minutes, isOverdue: false });
      }
      const diffSub = subtaskDeadline - now;
      if (diffSub < 0) {
        const overdueDiff = Math.abs(diffSub);
        const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor(
          (overdueDiff % (1000 * 60 * 60)) / (1000 * 65),
        );
        setTimeLeftSub({ days, hours, minutes, isOverdue: true });
      } else {
        const days = Math.floor(diffSub / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (diffSub % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor((diffSub % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeftSub({ days, hours, minutes, isOverdue: false });
      }
    };
    calculateTime();
    const timer = setInterval(calculateTime, 60000);
    return () => clearInterval(timer);
  }, [globalDeadline, subtaskDeadline]);

  if (!timeLeftGlobal)
    return (
      <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
        คำนวณเวลา...
      </span>
    );

  const formattedGlobalDate = formatDate(globalDeadline);
  const formattedGlobalTime = (() => {
    const d = new Date(globalDeadline);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  })();
  const formattedSubDate = formatDate(subtaskDeadline);
  
  const formattedOriginalDate = originalDeadline
    ? formatDate(originalDeadline)
    : formattedGlobalDate;
  const formattedOriginalTime = originalDeadline
    ? (() => {
        const d = new Date(originalDeadline);
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
      })()
    : formattedGlobalTime;

  let globalBadgeColor = "#ef4444";
  let globalBadgeBg = "#fef2f2";
  let globalBorderColor = "#fca5a5";
  let globalLabelText = "";
  const totalGlobalHours = timeLeftGlobal.days * 24 + timeLeftGlobal.hours;

  if (isCompleted) {
    if (completedAtTime) {
      const compDate = new Date(completedAtTime);
      const day = String(compDate.getDate()).padStart(2, "0");
      const month = String(compDate.getMonth() + 1).padStart(2, "0");
      const year = compDate.getFullYear();
      const formattedCompletedDate = `${day}/${month}/${year}`;
      
      const baseline = originalDeadline || globalDeadline;
      
      const getStartOfDay = (timeMs: number) => {
        const d = new Date(timeMs);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      };
      
      const compStart = getStartOfDay(completedAtTime);
      const baselineStart = getStartOfDay(baseline);
      
      const diffDays = Math.round((baselineStart - compStart) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        globalLabelText = `${formattedCompletedDate} (เสร็จก่อนกำหนด ${diffDays} วัน)`;
        globalBadgeColor = "#0891b2";
        globalBadgeBg = "#ecfeff";
        globalBorderColor = "#a5f3fc";
      } else if (diffDays === 0) {
        globalLabelText = `${formattedCompletedDate} (เสร็จตามกำหนด)`;
        globalBadgeColor = "#059669";
        globalBadgeBg = "#f0fdf4";
        globalBorderColor = "#a7f3d0";
      } else {
        const overdueDays = Math.abs(diffDays);
        globalLabelText = `${formattedCompletedDate} (เลยกำหนด ${overdueDays} วัน)`;
        globalBadgeColor = "#ef4444";
        globalBadgeBg = "#fef2f2";
        globalBorderColor = "#fca5a5";
      }
    } else {
      globalBadgeColor = "#0891b2";
      globalBadgeBg = "#ecfeff";
      globalBorderColor = "#a5f3fc";
      globalLabelText = "เสร็จสมบูรณ์ 100%";
    }
  } else if (timeLeftGlobal.isOverdue) {
    globalBadgeColor = "#ef4444";
    globalBadgeBg = "#fef2f2";
    globalBorderColor = "#fca5a5";
    globalLabelText = `เกินกำหนด: ${timeLeftGlobal.days > 0 ? `${timeLeftGlobal.days} วัน ` : ""}${timeLeftGlobal.hours} ชม.`;
  } else {
    if (totalGlobalHours < 24) {
      globalBadgeColor = "#d97706";
      globalBadgeBg = "#fffbeb";
      globalBorderColor = "#fde047";
      globalLabelText = `ด่วน! เหลือ ${timeLeftGlobal.hours} ชม. ${timeLeftGlobal.minutes} น.`;
    } else {
      globalBadgeColor = "#059669";
      globalBadgeBg = "#f0fdf4";
      globalBorderColor = "#a7f3d0";
      globalLabelText = `เหลือ ${timeLeftGlobal.days > 0 ? `${timeLeftGlobal.days} วัน ` : ""}${timeLeftGlobal.hours} ชม.`;
    }
  }

  const hasSubtaskDifference = globalDeadline > subtaskDeadline;

  if (isHelper) {
    const formattedDate = formatDate(globalDeadline);
    const totalHours = timeLeftGlobal ? (timeLeftGlobal.days * 24 + timeLeftGlobal.hours) : 0;
    
    let timeText = "";
    if (isCompleted) {
      timeText = globalLabelText;
    } else if (timeLeftGlobal?.isOverdue) {
      timeText = `เกินกำหนด: ${timeLeftGlobal.days > 0 ? `${timeLeftGlobal.days} วัน ` : ""}${timeLeftGlobal.hours} ชม.`;
    } else {
      if (totalHours < 24) {
        timeText = `ด่วน! เหลือ ${timeLeftGlobal?.hours} ชม. ${timeLeftGlobal?.minutes} น.`;
      } else {
        timeText = `เหลือ ${timeLeftGlobal?.days > 0 ? `${timeLeftGlobal?.days} วัน ` : ""}${timeLeftGlobal?.hours} ชม.`;
      }
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#475569" }}>
            กำหนดส่งมอบ (ลูกค้า):
          </span>
          <span style={{ fontSize: "0.68rem", fontWeight: 900, color: "#1e293b" }}>
            {formattedDate}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1px" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#475569" }}>
            {isCompleted ? "เสร็จสิ้นเมื่อ:" : "เวลาคงเหลือ (ลูกค้า):"}
          </span>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 900,
              color: globalBadgeColor,
              background: globalBadgeBg,
              padding: "1px 6px",
              borderRadius: "4px",
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              border: `1.5px solid ${globalBorderColor}`,
            }}
          >
            {isCompleted ? "✅" : "⏳"} {timeText}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        width: "100%",
      }}
    >
      {/* แสดงขีดฆ่าเดดไลน์เก่า เฉพาะกรณี revision >= 1 AND deadline ใหม่นานกว่าเดิม */}
      {isRevision && originalDeadline && globalDeadline > originalDeadline ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{ fontSize: "0.65rem", fontWeight: 800, color: "#64748b" }}
            >
              กำหนดส่งมอบ (ลูกค้าเดิม):
            </span>
            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", textDecoration: "line-through" }}>
              {formattedOriginalDate} ({formattedOriginalTime})
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "2px",
            }}
          >
            <span
              style={{ fontSize: "0.65rem", fontWeight: 900, color: "#ef4444" }}
            >
              กำหนดส่งมอบล่าสุด (REV):
            </span>
            <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#ef4444" }}>
              {formattedGlobalDate} ({formattedGlobalTime})
            </span>
          </div>
        </>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{ fontSize: "0.65rem", fontWeight: 800, color: "#475569" }}
          >
            กำหนดส่งมอบ (ลูกค้า):
          </span>
          <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#1e293b" }}>
            {(isRevision && originalDeadline)
              ? `${formattedOriginalDate} (${formattedOriginalTime})`
              : `${formattedGlobalDate} (${formattedGlobalTime})`}
          </span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1px",
        }}
      >
        <span
          style={{ fontSize: "0.65rem", fontWeight: 800, color: "#475569" }}
        >
          {isCompleted ? "เสร็จสิ้นเมื่อ:" : "เวลาคงเหลือ (ลูกค้า):"}
        </span>
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 900,
            color: globalBadgeColor,
            background: globalBadgeBg,
            padding: "1px 6px",
            borderRadius: "4px",
            display: "inline-flex",
            alignItems: "center",
            gap: "2px",
            border: `1.5px solid ${globalBorderColor}`,
          }}
        >
          {isCompleted ? "✅" : "⏳"} {globalLabelText}
        </span>
      </div>
      {hasSubtaskDifference &&
        !isCompleted &&
        timeLeftSub &&
        (() => {
          let subBadgeColor = "#4f46e5";
          let subBadgeBg = "#e0e7ff";
          let subBorderColor = "#c7d2fe";
          let subLabelText = "";
          if (timeLeftSub.isOverdue) {
            subBadgeColor = "#9a3412";
            subBadgeBg = "#ffedd5";
            subBorderColor = "#fed7aa";
            subLabelText = `เป้าหมายช่าง: เกินแล้ว ${timeLeftSub.days > 0 ? `${timeLeftSub.days} วัน ` : ""}${timeLeftSub.hours} ชม.`;
          } else {
            subLabelText = `เป้าหมายช่าง: เหลือ ${timeLeftSub.days > 0 ? `${timeLeftSub.days} วัน ` : ""}${timeLeftSub.hours} ชม.`;
          }
          return (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "3px",
                padding: "4px 8px",
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  color: "#64748b",
                }}
              >
                เป้าหมายภายใน (งานย่อย):
              </span>
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  color: subBadgeColor,
                  background: subBadgeBg,
                  padding: "1px 5px",
                  borderRadius: "4px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  border: `1px solid ${subBorderColor}`,
                }}
                title={`กำหนดเวลาภายในงานนี้: ${formattedSubDate}`}
              >
                🛠️ {subLabelText}
              </span>
            </div>
          );
        })()}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Component: BatchAddModal
// ─────────────────────────────────────────────────────────────────────────────
