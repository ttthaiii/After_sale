import React, { Fragment } from "react";
import {
  XCircle,
  Info,
  HardHat,
  Camera,
  User,
  Loader2,
  CheckSquare,
  FileText,
  Calendar,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { useDailyReport } from "../../context/DailyReportContext";
import { formatDate } from "../../utils/date";

export const DailyReportSummaryModal: React.FC = () => {
  const {
    showSummaryModal,
    setShowSummaryModal,
    selectedTaskInfo,
    labor,
    sitePhotos,
    reportDate,
    progress,
    note,
    isEditingExisting,
    isSubmitting,
    handleFinalSubmit,
    submittingRef,
    reportType,
    laborRegularPhotos,
    laborOtMorningPhotos,
    laborOtNoonPhotos,
    laborOtEveningPhotos,
  } = useDailyReport();

  if (!showSummaryModal || !selectedTaskInfo) return null;

          const totalManpower = labor
            .filter(
              (l) =>
                l.shifts?.normal ||
                l.shifts?.otMorning ||
                l.shifts?.otNoon ||
                l.shifts?.otEvening,
            )
            .reduce((acc, l) => acc + (Number(l.amount) || 1), 0);
          const internalCount = labor
            .filter(
              (l) =>
                l.membership === "Internal" &&
                (l.shifts?.normal ||
                  l.shifts?.otMorning ||
                  l.shifts?.otNoon ||
                  l.shifts?.otEvening),
            )
            .reduce((acc, l) => acc + (Number(l.amount) || 1), 0);
          const subcoCount = labor
            .filter(
              (l) =>
                l.membership === "Outsource" &&
                (l.shifts?.normal ||
                  l.shifts?.otMorning ||
                  l.shifts?.otNoon ||
                  l.shifts?.otEvening),
            )
            .reduce((acc, l) => acc + (Number(l.amount) || 1), 0);
          const leaveCount = labor.filter((l) => l.leave?.active).length;
          const originalReport =
            isEditingExisting &&
            selectedTaskInfo?.task?.history?.find(
              (h) => h.date?.split("T")[0] === reportDate,
            );
          const originalLaborMap =  new Map();
          if (originalReport) {
            if (originalReport.labor) {
              originalReport.labor.forEach((l) => {
                const wId = l.workerId || l.id || l.staffId || "";
                if (wId) {
                  originalLaborMap.set(wId, {
                    staffId: wId,
                    employeeId: l.employeeId || "",
                    staffName: l.staffName || l.workerName || "",
                    membership:
                      l.membership ||
                      (wId.startsWith("DC-") ? "Internal" : "Outsource"),
                    shifts: {
                      normal: l.shifts?.normal || false,
                      otMorning: l.shifts?.otMorning || false,
                      otNoon: l.shifts?.otNoon || false,
                      otEvening: l.shifts?.otEvening || false,
                    },
                    leave: {
                      active: false,
                      leaveType: "",
                    },
                    amount: Number(l.amount) || 1,
                  });
                }
              });
            }
            const exLeave = originalReport.leave;
            if (exLeave) {
              exLeave.forEach((lv) => {
                const wId = lv.workerId || lv.id || lv.staffId || "";
                if (wId) {
                  const existing = originalLaborMap.get(wId);
                  if (existing) {
                    existing.leave = {
                      active: lv.leaveShifts?.custom || false,
                      leaveType:
                        lv.leaveType || (lv.medCertFileUrl ? "Paid" : "Unpaid"),
                    };
                  } else {
                    originalLaborMap.set(wId, {
                      staffId: wId,
                      employeeId: lv.employeeId || "",
                      staffName: lv.staffName || lv.workerName || "",
                      membership: wId.startsWith("DC-")
                        ? "Internal"
                        : "Outsource",
                      shifts: {
                        normal: false,
                        otMorning: false,
                        otNoon: false,
                        otEvening: false,
                      },
                      leave: {
                        active: lv.leaveShifts?.custom || false,
                        leaveType:
                          lv.leaveType ||
                          (lv.medCertFileUrl ? "Paid" : "Unpaid"),
                      },
                      amount: Number(lv.amount) || 1,
                    });
                  }
                }
              });
            }
          }
          const isProgressChanged =
            originalReport && originalReport.progress !== progress;
          const isNoteChanged =
            originalReport && (originalReport.note || "") !== note;
          const removedWorkers = [];
          if (originalReport) {
            for (const [wId, orig] of originalLaborMap.entries()) {
              const isStillPresent = labor.some(
                (l) => (l.staffId || l.id) === wId,
              );
              if (!isStillPresent) {
                removedWorkers.push(orig);
              }
            }
          }
          return (
             <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(15, 23, 42, 0.65)",
                backdropFilter: "blur(10px)",
                zIndex: 2e3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1.5rem",
                boxSizing: "border-box",
              }}
            >
              {" "}
              
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "24px",
                  padding: "2rem",
                  width: "580px",
                  maxWidth: "100%",
                  maxHeight: "90vh",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {" "}
                
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "1rem",
                  }}
                >
                  {" "}
                  
                  <div
                    style={{
                      background: "#eff6ff",
                      padding: "12px",
                      borderRadius: "16px",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {" "}
                    
                    <CheckSquare size={24} />
                  </div>{" "}
                  
                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    {" "}
                    
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1.25rem",
                        fontWeight: 900,
                        color: "#0f172a",
                      }}
                    >
                      {isEditingExisting
                        ? "ตรวจสอบการแก้ไขรายงานประจำวัน"
                        : "ตรวจสอบรายงานประจำวัน"}
                    </h3>{" "}
                    
                    <p
                      style={{
                        margin: "2px 0 0 0",
                        fontSize: "0.8rem",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      โปรดตรวจสอบรายละเอียดข้อมูลก่อนกดยืนยันการส่งรายงาน
                    </p>
                  </div>{" "}
                  
                  <button
                    onClick={() => setShowSummaryModal(false)}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: "4px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f1f5f9")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "none")
                    }
                  >
                    {" "}
                    
                    <XCircle size={20} />
                  </button>
                </div>{" "}
                
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    overflowY: "auto",
                    paddingRight: "4px",
                    maxHeight: "calc(90vh - 200px)",
                  }}
                >
                  {" "}
                  
                  <div
                    style={{
                      background: isProgressChanged ? "#fff7ed" : "#f8fafc",
                      borderRadius: "16px",
                      border: isProgressChanged
                        ? "1.5px solid #ea580c"
                        : "1px solid #e2e8f0",
                      padding: "1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {" "}
                    
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: "#475569",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {" "}
                      
                      <FileText
                        size={14}
                        color={isProgressChanged ? "#ea580c" : "#64748b"}
                      />
                      ข้อมูลการดำเนินงาน
                      {isProgressChanged && (
                         <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: "#ea580c",
                            color: "#ffffff",
                            marginLeft: "6px",
                          }}
                        >
                          แก้ไขความคืบหน้า
                        </span>
                      )}
                    </h4>{" "}
                    
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "1rem",
                        marginTop: "4px",
                      }}
                    >
                      {" "}
                      
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        {" "}
                        
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "#64748b",
                          }}
                        >
                          วันที่รายงาน:
                        </span>{" "}
                        
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            color: "#0f172a",
                          }}
                        >
                          {" "}
                          
                          <Calendar size={14} color="#3b82f6" />
                          {formatDate(reportDate)}
                        </div>
                      </div>{" "}
                      
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        {" "}
                        
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "#64748b",
                          }}
                        >
                          ความคืบหน้างาน:
                        </span>{" "}
                        
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            color: "#2563eb",
                          }}
                        >
                          {" "}
                          
                          <TrendingUp size={14} color="#2563eb" />
                          {isProgressChanged ? (
                             <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              {" "}
                              
                              <span
                                style={{
                                  textDecoration: "line-through",
                                  color: "#94a3b8",
                                  fontSize: "0.85rem",
                                }}
                              >
                                {originalReport.progress}%
                              </span>{" "}
                              
                              <span
                                style={{
                                  color: "#ea580c",
                                  fontSize: "0.85rem",
                                }}
                              >
                                →
                              </span>{" "}
                              
                              <span
                                style={{
                                  color: "#2563eb",
                                  fontWeight: 900,
                                }}
                              >
                                {progress}%
                              </span>
                            </div>
                          ) : (
                             <span>{progress}%</span>
                          )}{" "}
                          
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "#64748b",
                            }}
                          >
                            (
                            {progress === 100
                              ? "ปิดงาน"
                              : reportType === "Problem"
                                ? "รายงานปัญหาหน้างาน"
                                : "อัปเดตความคืบหน้า"}
                            )
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>{" "}
                  
                  <div
                    style={{
                      background: "#f8fafc",
                      borderRadius: "16px",
                      border: "1px solid #e2e8f0",
                      padding: "1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
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
                      
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "0.85rem",
                          fontWeight: 800,
                          color: "#475569",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {" "}
                        
                        <HardHat size={14} color="#64748b" />{" "}
                        กำลังพลปฏิบัติงานทั้งหมด
                      </h4>{" "}
                      
                      <span
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 900,
                          color: "#1e40af",
                          background: "#eff6ff",
                          padding: "4px 10px",
                          borderRadius: "20px",
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        {totalManpower} คน
                      </span>
                    </div>{" "}
                    
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "10px",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: "#475569",
                      }}
                    >
                      {" "}
                      
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {" "}
                        
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#2563eb",
                          }}
                        />{" "}
                        
                        <span>
                          คนงานบริษัท: 
                          <span
                            style={{
                              color: "#0f172a",
                              fontWeight: 900,
                            }}
                          >
                            {internalCount} คน
                          </span>
                        </span>
                      </div>{" "}
                      
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {" "}
                        
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#10b981",
                          }}
                        />{" "}
                        
                        <span>
                          ทีมงานผู้รับเหมา: 
                          <span
                            style={{
                              color: "#0f172a",
                              fontWeight: 900,
                            }}
                          >
                            {subcoCount} คน
                          </span>
                        </span>
                      </div>
                      {leaveCount > 0 && (
                         <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {" "}
                          
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#ef4444",
                            }}
                          />{" "}
                          
                          <span>
                            ลางาน: 
                            <span
                              style={{
                                color: "#ef4444",
                                fontWeight: 900,
                              }}
                            >
                              {leaveCount} คน
                            </span>
                          </span>
                        </div>
                      )}
                    </div>{" "}
                    
                    <div
                      style={{
                        maxHeight: "260px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        paddingRight: "2px",
                        marginTop: "4px",
                      }}
                    >
                      {labor.map((l) => {
                        const activeShifts = [];
                        if (l.shifts?.normal)
                          activeShifts.push({
                            name: "ปกติ",
                            key: "normal",
                          });
                        if (l.shifts?.otMorning)
                          activeShifts.push({
                            name: "OT เช้า",
                            key: "otMorning",
                          });
                        if (l.shifts?.otNoon)
                          activeShifts.push({
                            name: "OT เที่ยง",
                            key: "otNoon",
                          });
                        if (l.shifts?.otEvening)
                          activeShifts.push({
                            name: "OT เย็น",
                            key: "otEvening",
                          });
                        if (l.leave?.active)
                          activeShifts.push({
                            name: "ลางาน",
                            key: "leave",
                          });
                        const wId = l.staffId || l.id;
                        const orig = originalLaborMap.get(wId);
                        const isNewWorker =
                          isEditingExisting && originalReport && !orig;
                        const isShiftChanged =
                          isEditingExisting &&
                          originalReport &&
                          orig &&
                          (orig.shifts.normal !== l.shifts?.normal ||
                            orig.shifts.otMorning !== l.shifts?.otMorning ||
                            orig.shifts.otNoon !== l.shifts?.otNoon ||
                            orig.shifts.otEvening !== l.shifts?.otEvening ||
                            orig.leave.active !== l.leave?.active);
                        const removedShifts = [];
                        if (orig) {
                          if (orig.shifts.normal && !l.shifts?.normal)
                            removedShifts.push("ปกติ");
                          if (orig.shifts.otMorning && !l.shifts?.otMorning)
                            removedShifts.push("OT เช้า");
                          if (orig.shifts.otNoon && !l.shifts?.otNoon)
                            removedShifts.push("OT เที่ยง");
                          if (orig.shifts.otEvening && !l.shifts?.otEvening)
                            removedShifts.push("OT เย็น");
                          if (orig.leave.active && !l.leave?.active)
                            removedShifts.push("ลางาน");
                        }
                        return (
                           <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              padding: "8px 12px",
                              background: isNewWorker
                                ? "#f0fdf4"
                                : isShiftChanged
                                  ? "#fff7ed"
                                  : "#ffffff",
                              borderRadius: "10px",
                              border: isNewWorker
                                ? "1.5px solid #10b981"
                                : isShiftChanged
                                  ? "1.5px solid #ea580c"
                                  : "1px solid #f1f5f9",
                            }}
                            key={l.id}
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
                              
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  minWidth: 0,
                                }}
                              >
                                {" "}
                                
                                <div
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    background:
                                      l.membership === "Internal"
                                        ? "#eff6ff"
                                        : "#f0fdf4",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {l.membership === "Internal" ? (
                                     <User
                                      size={12}
                                      color="#2563eb"
                                    />
                                  ) : (
                                     <HardHat
                                      size={12}
                                      color="#059669"
                                    />
                                  )}
                                </div>{" "}
                                
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    fontWeight: 800,
                                    color: "#0f172a",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  {l.employeeId ? `${l.employeeId} : ` : ""}
                                  {l.staffName || l.affiliation}
                                  {isNewWorker && (
                                     <span
                                      style={{
                                        fontSize: "0.6rem",
                                        fontWeight: 800,
                                        padding: "1px 5px",
                                        borderRadius: "4px",
                                        background: "#10b981",
                                        color: "#ffffff",
                                        marginLeft: "6px",
                                      }}
                                    >
                                      เพิ่มใหม่
                                    </span>
                                  )}
                                  {isShiftChanged && (
                                     <span
                                      style={{
                                        fontSize: "0.6rem",
                                        fontWeight: 800,
                                        padding: "1px 5px",
                                        borderRadius: "4px",
                                        background: "#ea580c",
                                        color: "#ffffff",
                                        marginLeft: "6px",
                                      }}
                                    >
                                      แก้ไขเวลา
                                    </span>
                                  )}
                                </div>
                              </div>{" "}
                              
                              <div
                                style={{
                                  display: "flex",
                                  gap: "4px",
                                  flexWrap: "wrap",
                                  justifyContent: "flex-end",
                                }}
                              >
                                {activeShifts.map((sh, sIdx) => {
                                  let bg = "#dbeafe";
                                  let text = "#1e40af";
                                  if (sh.name.startsWith("OT")) {
                                    bg = "#fef3c7";
                                    text = "#92400e";
                                  }
                                  if (sh.name === "ลางาน") {
                                    bg = "#fee2e2";
                                    text = "#991b1b";
                                  }
                                  const isShiftAdded =
                                    isEditingExisting &&
                                    originalReport &&
                                    orig &&
                                    ((sh.key === "normal" &&
                                      !orig.shifts.normal) ||
                                      (sh.key === "otMorning" &&
                                        !orig.shifts.otMorning) ||
                                      (sh.key === "otNoon" &&
                                        !orig.shifts.otNoon) ||
                                      (sh.key === "otEvening" &&
                                        !orig.shifts.otEvening) ||
                                      (sh.key === "leave" &&
                                        !orig.leave.active));
                                  return (
                                     <span
                                      style={{
                                        fontSize: "0.65rem",
                                        fontWeight: 800,
                                        padding: "2px 6px",
                                        borderRadius: "6px",
                                        background: bg,
                                        color: text,
                                        border: isShiftAdded
                                          ? "1.5px dashed #ea580c"
                                          : "1px solid transparent",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "2px",
                                      }}
                                      key={sIdx}
                                    >
                                      {isShiftAdded && (
                                         <span
                                          style={{
                                            fontWeight: 900,
                                            color: "#ea580c",
                                          }}
                                        >
                                          +
                                        </span>
                                      )}
                                      {sh.name}
                                    </span>
                                  );
                                })}
                                {Number(l.amount) > 1 && (
                                   <span
                                    style={{
                                      fontSize: "0.65rem",
                                      fontWeight: 900,
                                      padding: "2px 6px",
                                      borderRadius: "6px",
                                      background: "#e2e8f0",
                                      color: "#475569",
                                    }}
                                  >
                                    จำนวน {l.amount} คน
                                  </span>
                                )}
                              </div>
                            </div>
                            {removedShifts.length > 0 && (
                               <div
                                style={{
                                  display: "flex",
                                  gap: "4px",
                                  alignItems: "center",
                                  fontSize: "0.65rem",
                                  color: "#ef4444",
                                  fontWeight: 700,
                                  marginTop: "4px",
                                  paddingTop: "4px",
                                  borderTop: "1px dotted #fecaca",
                                }}
                              >
                                {" "}
                                
                                <span
                                  style={{
                                    color: "#94a3b8",
                                  }}
                                >
                                  นำออก:
                                </span>
                                {removedShifts.map((sh, idx) => (
                                   <span
                                    style={{
                                      background: "#fee2e2",
                                      color: "#b91c1c",
                                      padding: "1px 5px",
                                      borderRadius: "4px",
                                      textDecoration: "line-through",
                                    }}
                                    key={idx}
                                  >
                                    {sh}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {removedWorkers.length > 0 && (
                         <div
                          style={{
                            marginTop: "10px",
                            paddingTop: "10px",
                            borderTop: "1px dashed #fca5a5",
                          }}
                        >
                          {" "}
                          
                          <h5
                            style={{
                              margin: "0 0 6px 0",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              color: "#ef4444",
                            }}
                          >
                            คนงานที่ถูกลบออก ({removedWorkers.length} คน)
                          </h5>{" "}
                          
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            {removedWorkers.map((rw) => {
                              const origShifts = [];
                              if (rw.shifts.normal) origShifts.push("ปกติ");
                              if (rw.shifts.otMorning)
                                origShifts.push("OT เช้า");
                              if (rw.shifts.otNoon)
                                origShifts.push("OT เที่ยง");
                              if (rw.shifts.otEvening)
                                origShifts.push("OT เย็น");
                              if (rw.leave.active) origShifts.push("ลางาน");
                              return (
                                 <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "8px 12px",
                                    background: "#fef2f2",
                                    borderRadius: "10px",
                                    border: "1px solid #fca5a5",
                                    opacity: 0.8,
                                  }}
                                  key={rw.staffId}
                                >
                                  {" "}
                                  
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      minWidth: 0,
                                    }}
                                  >
                                    {" "}
                                    
                                    <div
                                      style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 6,
                                        background: "#fee2e2",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {" "}
                                      
                                      <User size={12} color="#ef4444" />
                                    </div>{" "}
                                    
                                    <div
                                      style={{
                                        fontSize: "0.8rem",
                                        fontWeight: 800,
                                        color: "#991b1b",
                                        textDecoration: "line-through",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {rw.employeeId
                                        ? `${rw.employeeId} : `
                                        : ""}
                                      {rw.staffName}
                                    </div>
                                  </div>{" "}
                                  
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "4px",
                                      flexWrap: "wrap",
                                      justifyContent: "flex-end",
                                    }}
                                  >
                                    {origShifts.map((sh, sIdx) => (
                                       <span
                                        style={{
                                          fontSize: "0.65rem",
                                          fontWeight: 800,
                                          padding: "2px 6px",
                                          borderRadius: "6px",
                                          background: "#fee2e2",
                                          color: "#991b1b",
                                          textDecoration: "line-through",
                                        }}
                                        key={sIdx}
                                      >
                                        {sh}
                                      </span>
                                    ))}
                                    {Number(rw.amount) > 1 && (
                                       <span
                                        style={{
                                          fontSize: "0.65rem",
                                          fontWeight: 900,
                                          padding: "2px 6px",
                                          borderRadius: "6px",
                                          background: "#fee2e2",
                                          color: "#991b1b",
                                        }}
                                      >
                                        จำนวน {rw.amount} คน
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>{" "}
                  
                  <div
                    style={{
                      background: "#f8fafc",
                      borderRadius: "16px",
                      border: "1px solid #e2e8f0",
                      padding: "1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {" "}
                    
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: "#475569",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {" "}
                      
                      <Camera size={14} color="#64748b" /> รูปภาพที่แนบรายงาน
                    </h4>{" "}
                    
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        marginTop: "4px",
                      }}
                    >
                      {" "}
                      
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          padding: "4px 10px",
                          borderRadius: "10px",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          color: "#166534",
                        }}
                      >
                        {" "}
                        
                        <CheckCircle2 size={12} color="#15803d" /> 
                        <span>
                          รูปถ่ายหน้างาน ({sitePhotos.filter(Boolean).length}{" "}
                          รูป)
                        </span>
                      </div>
                      {laborRegularPhotos.some(Boolean) && (
                         <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            padding: "4px 10px",
                            borderRadius: "10px",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            color: "#166534",
                          }}
                        >
                          {" "}
                          
                          <CheckCircle2 size={12} color="#15803d" /> 
                          <span>
                            รูปถ่ายคนงานปกติ (
                            {laborRegularPhotos.filter(Boolean).length} รูป)
                          </span>
                        </div>
                      )}
                      {(laborOtMorningPhotos.some(Boolean) ||
                        laborOtNoonPhotos.some(Boolean) ||
                        laborOtEveningPhotos.some(Boolean)) && (
                         <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            padding: "4px 10px",
                            borderRadius: "10px",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            color: "#166534",
                          }}
                        >
                          {" "}
                          
                          <CheckCircle2 size={12} color="#15803d" /> 
                          <span>
                            รูปถ่ายคนงาน OT (
                            {laborOtMorningPhotos.filter(Boolean).length +
                              laborOtNoonPhotos.filter(Boolean).length +
                              laborOtEveningPhotos.filter(Boolean).length}{" "}
                            รูป)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>{" "}
                  
                  <div
                    style={{
                      background: isNoteChanged ? "#fff7ed" : "#f8fafc",
                      borderRadius: "16px",
                      border: isNoteChanged
                        ? "1.5px solid #ea580c"
                        : "1px solid #e2e8f0",
                      padding: "1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {" "}
                    
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: "#475569",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {" "}
                      
                      <Info
                        size={14}
                        color={isNoteChanged ? "#ea580c" : "#64748b"}
                      />
                      หมายเหตุ (Site Notes)
                      {isNoteChanged && (
                         <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: "#ea580c",
                            color: "#ffffff",
                            marginLeft: "6px",
                          }}
                        >
                          แก้ไขแล้ว
                        </span>
                      )}
                    </h4>{" "}
                    
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {isNoteChanged && originalReport.note && (
                         <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#94a3b8",
                            textDecoration: "line-through",
                            background: "#fee2e2",
                            padding: "6px 8px",
                            borderRadius: "8px",
                            border: "1px solid #fecaca",
                          }}
                        >
                          เดิม: {originalReport.note}
                        </div>
                      )}{" "}
                      
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "0.8rem",
                          fontWeight: note ? 700 : 500,
                          color: note ? "#334155" : "#94a3b8",
                          background: "#ffffff",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #f1f5f9",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.4,
                        }}
                      >
                        {note || "ไม่ได้ระบุหมายเหตุเพิ่มเติม"}
                      </p>
                    </div>
                  </div>
                </div>{" "}
                
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginTop: "8px",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: "1.25rem",
                  }}
                >
                  {" "}
                  
                  <button
                    onClick={() => setShowSummaryModal(false)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "14px",
                      border: "2px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#94a3b8";
                      e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#cbd5e1";
                      e.currentTarget.style.background = "#ffffff";
                    }}
                  >
                    กลับไปแก้ไข
                  </button>{" "}
                  
                  <button
                    onClick={handleFinalSubmit}
                    disabled={submittingRef.current || isSubmitting}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "14px",
                      border: "none",
                      background:
                        "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      cursor:
                        submittingRef.current || isSubmitting
                          ? "not-allowed"
                          : "pointer",
                      transition: "all 0.2s",
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow =
                          "0 6px 16px rgba(37, 99, 235, 0.35)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmitting) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 12px rgba(37, 99, 235, 0.25)";
                      }
                    }}
                  >
                    {submittingRef.current || isSubmitting ? (
                       <Fragment>
                        {" "}
                        
                        <Loader2 size={16} className="animate-spin" /> <span>กำลังส่งรายงาน...</span>
                      </Fragment>
                    ) : (
                       <span>ส่งรายงานเลย</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
};
