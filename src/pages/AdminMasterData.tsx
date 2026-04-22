import { useState, useEffect } from 'react';
import { Users, HardHat, Plus, Edit2, Trash2, Building, Eye, EyeOff, ClipboardList } from 'lucide-react';
import { Contractor, Staff, Project } from '../types';
import MasterDataModal from '../components/MasterDataModal';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { migrateAll, migrateStaffFields } from '../services/migrationService'; // Import migration
import { performUniversalStaffMigration, clearAllNotifications } from '../services/staffSystemMigration';
import ActivityLogTable from '../components/ActivityLogTable';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import { logService } from '../services/logService';

const AdminMasterData = () => {
    const { user } = useAuth();
    const { projects: projectList, staff: staffList } = useWorkOrders();
    const [activeTab, setActiveTab] = useState<'Staff' | 'Contractors' | 'Projects' | 'Logs' | 'Costs'>('Staff');

    // Data States
    const [contractorList, setContractorList] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);

    // ✅ Real-time Sync with Firestore (Only for Contractors now, others from context)
    useEffect(() => {
        setLoading(true);
        const unsubContractors = onSnapshot(collection(db, 'contractors'), (snap) => {
            setContractorList(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Contractor));
            setLoading(false);
        });

        // ✅ Initial Page View Track
        if (user) {
            logService.trackPageView(user, 'MASTER_DATA', 'จัดการข้อมูลระบบ');
        }

        return () => {
            unsubContractors();
        };
    }, []);

    // ✅ Track Tab Switches
    useEffect(() => {
        if (user) {
            const tabNames = {
                Staff: 'ข้อมูลเจ้าหน้าที่',
                Contractors: 'ข้อมูลผู้รับเหมา',
                Projects: 'ข้อมูลโครงการ',
                Logs: 'ประวัติการใช้งาน',
                Costs: 'จัดการต้นทุนค่าแรง'
            };
            logService.trackPageView(user, 'MASTER_DATA', `จัดการข้อมูล: ${tabNames[activeTab]}`);
        }
    }, [activeTab]);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Staff | Contractor | Project | null>(null);
    const [passcode, setPasscode] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [dbPasscode, setDbPasscode] = useState<string | null>(null);

    // Cost Settings State
    const [laborRates, setLaborRates] = useState({
        staff: 500,
        contractor: 400
    });

    // Fetch central passcode and labor rates from Firestore
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'system_config', 'admin_settings'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDbPasscode(data.masterPasscode);
                if (data.statusRates) {
                    setLaborRates(data.statusRates);
                }
            }
        });
        return () => unsub();
    }, []);

    const saveLaborRates = async (updatedRates: any) => {
        try {
            await setDoc(doc(db, 'system_config', 'admin_settings'), {
                statusRates: updatedRates
            }, { merge: true });
            
            // ✅ Log Action
            await logService.trackAction({
                userId: user?.id || 'admin-system',
                userName: user?.name || 'Admin',
                role: user?.role || 'Admin',
                action: 'UPDATE',
                module: 'MASTER_DATA',
                details: `แก้ไขอัตราค่าแรง: Staff=${updatedRates.staff}, Contractor=${updatedRates.contractor}`,
                targetId: 'admin_settings'
            });
            
            alert('บันทึกอัตราค่าแรงสำเร็จ!');
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการบันทึก');
        }
    };

    const handleVerifyPasscode = (e: any) => {
        e.preventDefault();
        const targetPasscode = dbPasscode || 'AdminTTS2004'; // Use DB or fallback
        if (passcode === targetPasscode) {
            setIsAuthorized(true);
        } else {
            alert('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่');
            setPasscode('');
        }
    };

    const handleSave = async (data: any) => {
        const collectionName = activeTab.toLowerCase();
        let id = data.id;

        if (!editingItem) {
            // ✅ Auto-sequence ID for Staff/Contractors, Manual for Projects
            if (activeTab === 'Projects') {
                // Find the highest numeric id
                const maxIdNum = projectList.reduce((max, item) => {
                    const num = parseInt(item.id);
                    return !isNaN(num) ? Math.max(max, num) : max;
                }, 0);
                id = String(maxIdNum + 1).padStart(4, '0');
            } else if (activeTab === 'Staff') {
                // ✅ Use employeeId as the Document ID for new staff
                if (data.employeeId) {
                    id = data.employeeId;
                } else {
                    // Fallback to S-prefix only if employeeId is missing (preventing error)
                    const prefix = 'S';
                    const maxIdNum = staffList.reduce((max, item) => {
                        const num = parseInt(item.id.replace(prefix, ''));
                        return !isNaN(num) ? Math.max(max, num) : max;
                    }, 0);
                    id = `${prefix}${String(maxIdNum + 1).padStart(3, '0')}`;
                }
            } else {
                const prefix = 'C';
                const currentList = contractorList;

                // Find the highest existing number
                const maxIdNum = currentList.reduce((max, item) => {
                    const num = parseInt(item.id.replace(prefix, ''));
                    return !isNaN(num) ? Math.max(max, num) : max;
                }, 0);

                // Generate next ID with 3-digit padding (e.g., C006)
                id = `${prefix}${String(maxIdNum + 1).padStart(3, '0')}`;
            }
        }

        const docRef = doc(db, collectionName, id);
        const finalData = { ...data };

        // ✅ If it's a staff member, explicitly set employeeId and ensure redundant id field is removed
        if (activeTab === 'Staff') {
            finalData.employeeId = data.employeeId || id;
            if ('id' in finalData) delete finalData.id;
        }

        await setDoc(docRef, finalData);

        // ✅ Log Action
        await logService.trackAction({
            userId: user?.id || 'admin-system',
            userName: user?.name || 'Admin',
            role: user?.role || 'Admin',
            action: editingItem ? 'UPDATE' : 'CREATE',
            module: 'MASTER_DATA',
            details: `${editingItem ? 'แก้ไข' : 'เพิ่ม'}ข้อมูล ${activeTab}: ${data.name || id}`,
            targetId: id
        });

        setIsModalOpen(false);
        setEditingItem(null);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('ยืนยันการลบข้อมูล?')) return;
        const collectionName = activeTab.toLowerCase();
        const itemToDelete =
            activeTab === 'Staff' ? staffList.find(s => s.id === id) :
                activeTab === 'Contractors' ? contractorList.find(c => c.id === id) :
                    projectList.find(p => p.id === id);

        await deleteDoc(doc(db, collectionName, id));

        // ✅ Log Action
        await logService.trackAction({
            userId: user?.id || 'admin-system',
            userName: user?.name || 'Admin',
            role: user?.role || 'Admin',
            action: 'DELETE',
            module: 'MASTER_DATA',
            details: `ลบข้อมูล ${activeTab}: ${itemToDelete?.name || id}`,
            targetId: id
        });
    };

    const openAddModal = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const openEditModal = (item: any) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const [showPasscode, setShowPasscode] = useState(false);

    if (!isAuthorized) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ background: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', textAlign: 'center', width: '400px' }}>
                    <div style={{ background: '#fef2f2', color: '#ef4444', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Building size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Security Required</h2>
                    <p style={{ color: '#64748b', marginBottom: '32px' }}>กรุณาระบุรหัสผ่านเพื่อเข้าสู่หน้าจัดการข้อมูล</p>
                    <form onSubmit={handleVerifyPasscode}>
                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                            <input
                                type={showPasscode ? 'text' : 'password'}
                                value={passcode}
                                onChange={(e) => setPasscode(e.target.value)}
                                placeholder="กรอกรหัสผ่าน..."
                                style={{ width: '100%', padding: '14px 50px 14px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', textAlign: 'center', letterSpacing: '0.2em', boxSizing: 'border-box' }}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasscode(!showPasscode)}
                                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {showPasscode ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <button type="submit" style={{ width: '100%', padding: '14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)' }}>
                            ยืนยันรหัสผ่าน
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ background: '#eef2ff', padding: '16px', borderRadius: '20px', color: '#4f46e5', border: '1px solid #e0e7ff', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.1)' }}>
                    <Users size={36} />
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>จัดการข้อมูลระบบ (Master Data)</h1>
                    <span style={{ color: '#64748b', fontSize: '1.1rem', marginTop: '6px', display: 'block', fontWeight: 500 }}>บริหารจัดการข้อมูลพนักงาน, ผู้รับเหมา และโครงการ</span>
                </div>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>จัดการข้อมูลพื้นฐาน (Master Data)</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={async () => {
                            if (confirm('🚨 คำเตือน: ปฏิบัติการนี้จะทำการ "ย้ายไอดีพนักงาน" ในทุกใบงานและระบบLog ทั้งหมด! ต้องการดำเนินการใช่หรือไม่?')) {
                                const result = await performUniversalStaffMigration();
                                if (result.success) alert(result.message);
                                else alert(result.message);
                            }
                        }}
                        style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 900, boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' }}
                    >
                        🚨 Universal Align IDs (Global Update)
                    </button>
                    <button
                        onClick={async () => {
                            if (confirm('🗑️ คุณต้องการล้างการแจ้งเตือน (Notifications) ทั้งหมดออกจากฐานข้อมูลใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนคืนได้')) {
                                try {
                                    const result = await clearAllNotifications();
                                    if (result.success) {
                                        alert(`ล้างการแจ้งเตือนสำเร็จ! ลบไปทั้งหมด ${result.count} รายการ`);
                                    }
                                } catch (err) {
                                    alert('เกิดข้อผิดพลาดในการล้างข้อมูล');
                                }
                            }
                        }}
                        style={{ padding: '8px 16px', background: '#475569', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 900, boxShadow: '0 4px 10px rgba(71, 85, 105, 0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        🗑️ ล้างแจ้งเตือนทั้งหมด
                    </button>
                    <button
                        onClick={async () => {
                            if (confirm('ต้องการล้างและลงข้อมูลใหม่ตาม Excel ใช่ไหม?')) {
                                await migrateAll();
                                alert('Migration สำเร็จ!');
                            }
                        }}
                        style={{ padding: '8px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        🔄 Sync Excel Data
                    </button>
                    {activeTab !== 'Costs' && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            style={{ padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                        >
                            + เพิ่ม{activeTab === 'Staff' ? 'พนักงาน' : activeTab === 'Contractors' ? 'ผู้รับเหมา' : 'โครงการ'}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: '#f1f5f9', padding: '8px', borderRadius: '18px', width: 'fit-content', border: '1px solid #e2e8f0' }}>
                <button
                    onClick={() => setActiveTab('Staff')}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '12px',
                        background: activeTab === 'Staff' ? '#ffffff' : 'transparent',
                        color: activeTab === 'Staff' ? '#0f172a' : '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: activeTab === 'Staff' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <Users size={20} /> เจ้าหน้าที่ (Staff)
                </button>
                <button
                    onClick={() => setActiveTab('Contractors')}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '12px',
                        background: activeTab === 'Contractors' ? '#ffffff' : 'transparent',
                        color: activeTab === 'Contractors' ? '#0f172a' : '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: activeTab === 'Contractors' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <HardHat size={20} /> ผู้รับเหมา (Contractors)
                </button>
                <button
                    onClick={() => setActiveTab('Projects')}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '12px',
                        background: activeTab === 'Projects' ? '#ffffff' : 'transparent',
                        color: activeTab === 'Projects' ? '#0f172a' : '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: activeTab === 'Projects' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <Building size={20} /> โครงการ (Projects)
                </button>
                <button
                    onClick={() => setActiveTab('Logs')}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '12px',
                        background: activeTab === 'Logs' ? '#ffffff' : 'transparent',
                        color: activeTab === 'Logs' ? '#0f172a' : '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: activeTab === 'Logs' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <ClipboardList size={20} /> ประวัติการใช้งาน (Logs)
                </button>
                <button
                    onClick={() => setActiveTab('Costs')}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '12px',
                        background: activeTab === 'Costs' ? '#ffffff' : 'transparent',
                        color: activeTab === 'Costs' ? '#0f172a' : '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: activeTab === 'Costs' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <Building size={20} /> จัดการต้นทุน (Costs)
                </button>
            </div>

            {/* Content Table Container */}
            <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.75rem 2rem', borderBottom: '1px solid #f1f5f9' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                        {activeTab === 'Staff' ? 'รายชื่อเจ้าหน้าที่ทั้งหมด'
                            : activeTab === 'Contractors' ? 'รายชื่อผู้รับเหมาทั้งหมด'
                                : activeTab === 'Projects' ? 'รายชื่อโครงการทั้งหมด' : 'ตั้งค่าอัตราค่าแรง (บาท/วัน)'}
                    </h3>
                    <button
                        onClick={openAddModal}
                        style={{
                            background: '#4f46e5',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontWeight: 800,
                            boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Plus size={20} />
                        {activeTab === 'Staff' ? 'เพิ่มเจ้าหน้าที่'
                            : activeTab === 'Contractors' ? 'เพิ่มผู้รับเหมา'
                                : activeTab === 'Projects' ? 'เพิ่มโครงการ' : ''}
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    {activeTab === 'Logs' ? (
                        <ActivityLogTable />
                    ) : activeTab === 'Costs' ? (
                        <div style={{ padding: '2.5rem' }}>
                            <div style={{ maxWidth: '600px', background: '#f8fafc', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                                <div style={{ marginBottom: '2rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800, color: '#475569', marginBottom: '12px' }}>อัตราค่าแรงเจ้าหน้าที่ภายใน (Staff Rate) / วัน</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <input 
                                            type="number" 
                                            value={laborRates.staff}
                                            onChange={(e) => setLaborRates({ ...laborRates, staff: Number(e.target.value) })}
                                            style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', width: '200px', fontSize: '1.1rem', fontWeight: 700 }}
                                        />
                                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                            <span style={{ color: '#4f46e5', fontWeight: 800 }}>≈ {(laborRates.staff / 8).toFixed(1)} บาท/ชม.</span> (คำนวณจาก 8 ชม./วัน)
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '2.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800, color: '#475569', marginBottom: '12px' }}>อัตราค่าแรงผู้รับเหมา (Contractor Rate) / วัน</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <input 
                                            type="number" 
                                            value={laborRates.contractor}
                                            onChange={(e) => setLaborRates({ ...laborRates, contractor: Number(e.target.value) })}
                                            style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', width: '200px', fontSize: '1.1rem', fontWeight: 700 }}
                                        />
                                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                            <span style={{ color: '#4f46e5', fontWeight: 800 }}>≈ {(laborRates.contractor / 8).toFixed(1)} บาท/ชม.</span> (คำนวณจาก 8 ชม./วัน)
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => saveLaborRates(laborRates)}
                                    style={{ padding: '14px 40px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)' }}
                                >
                                    บันทึกการตั้งค่า
                                </button>
                            </div>
                            
                            <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: '#eff6ff', borderRadius: '20px', border: '1px solid #bfdbfe', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                <ClipboardList className="text-blue-600" size={24} />
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 800, color: '#1e40af' }}>วิธีการนำไปใช้</h4>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#3b82f6', lineHeight: 1.5 }}>สูตรนี้จะถูกนำไปคูณกับจำนวนชั่วโมงทำงานใน Daily Report ของพนักงานแต่ละคน เพื่อแสดงผลเป็นต้นทุนจริงในหน้ารายงาน Dashboard</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', background: '#f8fafc', color: '#64748b', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {activeTab === 'Staff' ? (
                                        <>
                                            <th style={{ padding: '16px 32px' }}>Emp ID</th>
                                            <th style={{ padding: '16px 32px' }}>เจ้าหน้าที่</th>
                                            <th style={{ padding: '16px 32px' }}>Role</th>
                                            <th style={{ padding: '16px 32px' }}>Username</th>
                                            <th style={{ padding: '16px 32px' }}>โครงการที่รับผิดชอบ</th>
                                            <th style={{ padding: '16px 32px' }}>สังกัด</th>
                                            <th style={{ padding: '16px 32px', textAlign: 'right' }}>จัดการ</th>
                                        </>
                                    ) : (
                                        <>
                                            <th style={{ padding: '16px 32px' }}>ID</th>
                                            <th style={{ padding: '16px 32px' }}>ชื่อ (Name)</th>
                                            <th style={{ padding: '16px 32px' }}>
                                                {activeTab === 'Contractors' ? 'ความเชี่ยวชาญ (Specialty)' : 'Code'}
                                            </th>
                                            {activeTab === 'Projects' && <th style={{ padding: '16px 32px' }}>สังกัด (Affiliation)</th>}
                                            <th style={{ padding: '16px 32px', textAlign: 'right' }}>จัดการ</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                            กำลังโหลดข้อมูลจาก Firebase...
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {activeTab === 'Staff' && staffList.map(st => (
                                            <tr key={st.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#fcfcfd'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '20px 32px', color: '#64748b', fontWeight: 600 }}>{st.employeeId || st.password || st.id}</td>
                                                <td style={{ padding: '20px 32px', color: '#0f172a', fontWeight: 700 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9' }}>
                                                            {st.profileImage ? (
                                                                <img loading="lazy" src={st.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}><Users size={20} /></div>
                                                            )}
                                                        </div>
                                                        {st.name}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '20px 32px' }}>
                                                    <span style={{ background: '#f1f5f9', color: '#334155', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid #e2e8f0' }}>
                                                        {st.role}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '20px 32px', color: '#64748b' }}>{st.username || '-'}</td>
                                                <td style={{ padding: '20px 32px' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {st.assignedProjects && st.assignedProjects.length > 0 ? (
                                                            st.assignedProjects.map(pCode => (
                                                                <span key={pCode} style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                                    {pCode}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>ยังไม่ได้ระบุ</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '20px 32px', color: '#64748b' }}>{st.affiliation}</td>
                                                <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                                    <button onClick={() => openEditModal(st)} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', padding: '8px', borderRadius: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = '#eef2ff'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}><Edit2 size={20} /></button>
                                                    <button onClick={() => handleDelete(st.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}><Trash2 size={20} /></button>
                                                </td>
                                            </tr>
                                        ))}

                                        {activeTab === 'Contractors' && contractorList.map(con => (
                                            <tr key={con.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#fcfcfd'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '20px 32px', color: '#64748b', fontWeight: 600 }}>{con.id}</td>
                                                <td style={{ padding: '20px 32px', color: '#0f172a', fontWeight: 700 }}>{con.name}</td>
                                                <td style={{ padding: '20px 32px', color: '#334155', fontWeight: 700 }}>
                                                    {Array.isArray(con.specialty) ? con.specialty.join(', ') : con.specialty || '-'}
                                                </td>
                                                <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                                    <button onClick={() => openEditModal(con)} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', padding: '8px', borderRadius: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = '#eef2ff'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}><Edit2 size={20} /></button>
                                                    <button onClick={() => handleDelete(con.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}><Trash2 size={20} /></button>
                                                </td>
                                            </tr>
                                        ))}

                                        {activeTab === 'Projects' && projectList.map(prj => (
                                            <tr key={prj.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#fcfcfd'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '20px 32px', color: '#64748b', fontWeight: 600 }}>{prj.id}</td>
                                                <td style={{ padding: '20px 32px', color: '#0f172a', fontWeight: 700 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '48px', height: '36px', borderRadius: '8px', overflow: 'hidden', background: '#f1f5f9' }}>
                                                            {prj.imageUrl ? (
                                                                <img loading="lazy" src={prj.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}><Building size={16} /></div>
                                                            )}
                                                        </div>
                                                        {prj.name}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '20px 32px' }}>
                                                    <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '6px 14px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800, fontFamily: 'monospace', border: '1px solid #c7d2fe' }}>
                                                        {prj.code}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '20px 32px', color: '#64748b', fontWeight: 600 }}>
                                                    {prj.affiliation || '-'}
                                                </td>
                                                <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                                    <button onClick={() => openEditModal(prj)} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', padding: '8px', borderRadius: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = '#eef2ff'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}><Edit2 size={20} /></button>
                                                    <button onClick={() => handleDelete(prj.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}><Trash2 size={20} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {activeTab !== 'Logs' && activeTab !== 'Costs' && (
                <MasterDataModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    type={activeTab as 'Staff' | 'Contractors' | 'Projects'}
                    initialData={editingItem}
                    projects={projectList}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default AdminMasterData;
