import React from 'react';

const TaskHistoryModal = ({ isOpen, onClose, task }: any) => {
    if (!isOpen) return null;
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '24px', width: '600px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 1rem 0' }}>ประวัติการทำงาน (Task History)</h3>
                <p>รายละเอียดประวัติ: {task?.taskName}</p>
                <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: '12px', background: '#0f172a', color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '1rem' }}>ปิดหน้าต่าง</button>
            </div>
        </div>
    );
};

export default TaskHistoryModal;
