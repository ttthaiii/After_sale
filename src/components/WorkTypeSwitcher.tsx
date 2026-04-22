import { WorkOrderType } from "../types";

interface WorkTypeSwitcherProps {
    currentType: WorkOrderType;
    onChange: (type: WorkOrderType) => void;
}

const WorkTypeSwitcher = ({ currentType, onChange }: WorkTypeSwitcherProps) => {
    return (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: '#242424', padding: '0.5rem', borderRadius: '12px', width: 'fit-content' }}>
            <button
                onClick={() => onChange('AfterSale')}
                style={{
                    background: currentType === 'AfterSale' ? '#646cff' : 'transparent',
                    color: currentType === 'AfterSale' ? '#fff' : '#aaa',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.75rem 1.5rem',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                }}
            >
                งานแจ้งซ่อมทั่วไป
            </button>
            <button
                onClick={() => onChange('PreHandover')}
                style={{
                    background: currentType === 'PreHandover' ? '#646cff' : 'transparent',
                    color: currentType === 'PreHandover' ? '#fff' : '#aaa',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.75rem 1.5rem',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                }}
            >
                งานตรวจรับห้อง
            </button>
        </div>
    );
};

export default WorkTypeSwitcher;
