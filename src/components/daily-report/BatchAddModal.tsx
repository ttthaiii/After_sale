import React, { useState, useMemo, useRef } from "react";
import { Clock, CheckSquare, Square, CheckCircle2 } from "lucide-react";
import { AvailableItem, BatchConfig, BatchAddModalProps, ModalTimeTarget } from "../../types/dailyReport.types";
import { AnalogTimePicker } from "../AnalogTimePicker";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAlert } from "../../context/AlertContext";

export const BatchAddModal: React.FC<BatchAddModalProps> = ({
  type,
  availableItems,
  onClose,
  onAdd,
}) => {
  const isMobile = useIsMobile();
  const showAlert = useAlert();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredItems = useMemo(() => {
    if (!searchQuery) return availableItems;
    const query = searchQuery.toLowerCase();
    return availableItems.filter(
      (item: AvailableItem) =>
        (item.name || "").toLowerCase().includes(query) ||
        (item.employeeId || "").toLowerCase().includes(query),
    );
  }, [availableItems, searchQuery]);

  const [config, setConfig] = useState<BatchConfig>({
    day: true,
    otMorning: false,
    otNoon: false,
    otEvening: false,
    timeDay: "08:00 - 17:00",
    timeOtMorning: "06:00 - 08:00",
    timeOtEvening: "18:00 - 21:00",
  });
  const [modalTimeTarget, setModalTimeTarget] =
    useState<ModalTimeTarget | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const hasSubmittedRef = useRef(false);

  const handleConfirm = async () => {
    if (hasSubmittedRef.current) return;
    if (selectedIds.length === 0) {
      await showAlert("กรุณาเลือกคนงานอย่างน้อย 1 คน");
      return;
    }
    hasSubmittedRef.current = true;
    onAdd(selectedIds, config);
  };

  const openModalTimePicker = (
    field: string,
    type2: "start" | "end",
    value: string,
  ) => {
    setModalTimeTarget({ field, type: type2, currentValue: value });
  };

  const handleModalTimeChange = (newTime: string) => {
    if (!modalTimeTarget) return;
    const { field, type: type2 } = modalTimeTarget;
    const currentRange = (config as any)[field] || "00:00 - 00:00";
    let [start, end] = currentRange.split(" - ").map((s: string) => s.trim());
    if (type2 === "start") start = newTime;
    else end = newTime;
    setConfig({ ...config, [field]: `${start} - ${end} ` });
    setModalTimeTarget(null);
  };

  const BatchTimeInput: React.FC<{
    label: string;
    field: keyof BatchConfig;
    timeField?: keyof BatchConfig;
  }> = ({ label, field, timeField }) => {
    const isActive = config[field] as boolean;
    const [startTime, endTime] = (
      ((timeField ? config[timeField] : "00:00 - 00:00") as string) ||
      "00:00 - 00:00"
    ).split(" - ");
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          padding: "8px",
          border: isActive ? "1px solid #3b82f6" : "1px solid #f1f5f9",
          borderRadius: "10px",
          background: isActive ? "#eff6ff" : "#f8fafc",
        }}
      >
        <div
          onClick={() => setConfig({ ...config, [field]: !isActive })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: isActive ? "2px solid #2563eb" : "2px solid #cbd5e1",
              background: isActive ? "#2563eb" : "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isActive && <CheckCircle2 size={12} color="#fff" />}
          </div>
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: isActive ? "#1e40af" : "#64748b",
            }}
          >
            {label}
          </span>
        </div>
        {isActive && timeField && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: "24px",
            }}
          >
            <div
              onClick={() =>
                openModalTimePicker(timeField as string, "start", startTime)
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "#fff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#334155",
              }}
            >
              <Clock size={12} color="#94a3b8" />
              {startTime}
            </div>
            <span style={{ color: "#cbd5e1", fontSize: "0.8rem" }}>-</span>
            <div
              onClick={() =>
                openModalTimePicker(timeField as string, "end", endTime)
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "#fff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#334155",
              }}
            >
              {endTime}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {modalTimeTarget && (
        <div style={{ zIndex: 3000, position: "relative" }}>
          <AnalogTimePicker
            value={modalTimeTarget.currentValue}
            onChange={handleModalTimeChange}
            onClose={() => setModalTimeTarget(null)}
          />
        </div>
      )}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 2000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "1.5rem",
            borderRadius: "24px",
            width: "500px",
            maxWidth: "90%",
            maxHeight: "85vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: isMobile ? "wrap" : "nowrap",
              marginBottom: "1rem",
              gap: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900 }}>
              เลือก{type === "Internal" ? "คนงานบริษัท" : "ผู้รับเหมา"}
            </h3>
            <div
              style={{
                background: selectedIds.length > 0 ? "#eff6ff" : "#f8fafc",
                color: selectedIds.length > 0 ? "#2563eb" : "#64748b",
                border: "1px solid",
                borderColor: selectedIds.length > 0 ? "#bfdbfe" : "#e2e8f0",
                padding: "4px 12px",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
            >
              {selectedIds.length > 0 ? (
                <>
                  เลือกแล้ว{" "}
                  <span
                    style={{
                      color: "#1d4ed8",
                      fontSize: "0.95rem",
                      fontWeight: 900,
                    }}
                  >
                    {selectedIds.length}
                  </span>{" "}
                  คน
                </>
              ) : (
                "ยังไม่ได้เลือก"
              )}
            </div>
            <input
              type="text"
              placeholder="ค้นหาคนงาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.8rem",
                outline: "none",
                width: isMobile ? "100%" : "180px",
                boxSizing: "border-box",
                fontWeight: 700,
              }}
            />
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              marginBottom: "1.5rem",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "0.5rem",
              minHeight: "300px",
            }}
          >
            {filteredItems.length === 0 ? (
              <div
                style={{
                  padding: "1rem",
                  textAlign: "center",
                  color: "#94a3b8",
                }}
              >
                ไม่พบรายการ
              </div>
            ) : (
              filteredItems.map((item: AvailableItem) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    style={{
                      padding: "10px",
                      borderRadius: "8px",
                      marginBottom: "4px",
                      cursor: "pointer",
                      background: isSelected ? "#eff6ff" : "#fff",
                      border: "1px solid",
                      borderColor: isSelected ? "#3b82f6" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare size={20} color="#3b82f6" />
                    ) : (
                      <Square size={20} color="#cbd5e1" />
                    )}
                    <span
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        color: "#1e293b",
                      }}
                    >
                      {item.employeeId ? `[${item.employeeId}] ` : ""}
                      {item.name}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <div
            style={{
              background: "#f8fafc",
              padding: "1rem",
              borderRadius: "16px",
              marginBottom: "1.5rem",
              border: "1px solid #f1f5f9",
            }}
          >
            <h4
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "0.85rem",
                fontWeight: 800,
                color: "#475569",
              }}
            >
              กำหนดเวลางาน (Batch Setting)
            </h4>
            <p
              style={{
                margin: "-4px 0 12px 0",
                fontSize: "0.75rem",
                color: "#94a3b8",
              }}
            >
              *เวลาที่ระบุจะถูกนำไปใช้กับทุกคนที่เลือก
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              <BatchTimeInput
                label="Day (ปกติ)"
                field="day"
                timeField={type === "Internal" ? "timeDay" : undefined}
              />
              {type === "Internal" && (
                <>
                  <BatchTimeInput
                    label="OT เช้า"
                    field="otMorning"
                    timeField="timeOtMorning"
                  />
                  <BatchTimeInput label="OT เที่ยง" field="otNoon" />
                  <BatchTimeInput
                    label="OT เย็น"
                    field="otEvening"
                    timeField="timeOtEvening"
                  />
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ยกเลิก
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 2,
                padding: "12px",
                borderRadius: "12px",
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              เพิ่ม {selectedIds.length} รายการ
            </button>
          </div>
        </div>
      </div>
    </>
  );
};