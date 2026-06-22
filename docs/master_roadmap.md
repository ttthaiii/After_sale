# Master Project Roadmap: After Sale Task Management System

> **📌 CURRENT ACTIVE FOCUS:** Phase 1 - Project Initialization & Architecture Setup
> **📊 OVERALL PROGRESS:** 5%

---

## 📚 System Documentation (Governance)
- `docs/master_roadmap.md`: แผนงานหลัก (อัปเดตตลอด)
- `docs/domain_rules.md`: กฎและ Business Logic ที่ตายตัว
- `knowledge/error_index.md`: แหล่งรวมความรู้สำหรับแก้ Bug และ Error

---

## 🖥️ Phase 1: Project Foundation

### Feature 1.1: Core Setup
- [X] T-000: ติดตั้งระบบ Agent และโครงสร้างพื้นฐาน (session_001_initialization)
- [X] T-000-001-01: ปรับปรุงคำสำคัญใน CLAUDE.md และ AGENTS.md/INVARIANTS.md เพื่อให้ผ่านการทดสอบตามคู่มือ 08_checklist.md (→ ERR-001) · attempts: 1 · tool_calls: 15
- [X] T-003-001-01: ปรับปรุง syncDailyReport ให้บันทึกข้อมูล taskName และ subtaskName เพิ่มเติมใน workLogs (→ ERR-002) · attempts: 1 · tool_calls: 13
- [X] T-003-002-01: ปรับปรุง syncDailyReport ให้บันทึกฟิลด์ editHistory ไปยัง DailyEmployeeTimesheets (→ ERR-003) · attempts: 1 · tool_calls: 64

---

### 🐛 Bug & Error Task Format Reference
> **Format:** `{TaskID}-{BugID}-{AttemptID}`
> **Example:** `T-004-001-02`

---
> **Status:** `[ ]` (ยังไม่เริ่ม) → `[/]` (กำลังทำ/รอตรวจ) → `[X]` (เสร็จ/ตรวจผ่าน)
