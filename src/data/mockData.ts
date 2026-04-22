import { WorkOrder, Project, Contractor, Staff } from '../types';

export const MOCK_PROJECTS: Project[] = [
    { id: 'SSRB', name: 'Bann Sansiri Bangna', code: 'SSRB', affiliation: 'Sansiri', imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=400', budget: 50000 },
    { id: 'DH2', name: 'DH2-สาย1', code: 'DH2', affiliation: 'DH', imageUrl: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&q=80&w=400', budget: 35000 },
    { id: 'PNN', name: 'DH2-พรานนก', code: 'PNN', affiliation: 'DH', imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b91d?auto=format&fit=crop&q=80&w=400', budget: 45000 },
    { id: 'ART', name: 'Artale Rama9', code: 'ART', affiliation: 'Artale', imageUrl: '', budget: 60000 },
    { id: 'LRM', name: 'Live Raminta', code: 'LRM', affiliation: 'Live', imageUrl: '', budget: 25000 },
    { id: 'BMWH', name: 'BLOOM MENTAL WELLNESS HOSPITAL', code: 'BMWH', affiliation: 'Hospital', imageUrl: '', budget: 150000 },
    { id: 'ESNKR3', name: 'Escent NST', code: 'ESNKR3', affiliation: 'Escent', imageUrl: '', budget: 30000 },
    { id: 'TTS2004', name: 'งานผู้บริหาร', code: 'TTS2004', affiliation: 'Management', imageUrl: '' },
    { id: 'CH70', name: 'ไอดีโอ จรัญฯ 70 ริเวอร์วิว', code: 'CH70', affiliation: 'Ideo', imageUrl: '' },
    { id: 'ICD', name: 'ไอคอนโด พัฒนาการ', code: 'ICD', affiliation: 'iCondo', imageUrl: '' },
    { id: 'NRV', name: 'ณ รีวา เจริญนคร', code: 'NRV', affiliation: 'Na Reva', imageUrl: '' },
    { id: 'TPL56', name: 'THE PARKLAND เพชรเกษม-56', code: 'TPL56', affiliation: 'Parkland', imageUrl: '' },
    { id: 'SLE', name: 'สีลมเอจ', code: 'SLE', affiliation: 'Silom Edge', imageUrl: '' },
    { id: 'EDS', name: 'เอดจ์ เซ็นทรัล พัทยา', code: 'EDS', affiliation: 'Edge', imageUrl: '' },
    { id: 'TR9', name: 'เดอะรัช พระราม 9', code: 'TR9', affiliation: 'Rush', imageUrl: '' },
    { id: 'ESW', name: 'เอดจ์ ลาวาลลี', code: 'ESW', affiliation: 'Edge', imageUrl: '' },
    { id: 'MKT', name: 'มาเก๊า', code: 'MKT', affiliation: 'Macau', imageUrl: '' },
    { id: 'NVN', name: 'เนอวานา', code: 'NVN', affiliation: 'Nirvana', imageUrl: '' },
    { id: 'TPL42', name: 'THE PARKLANE เพชรเกษม-42', code: 'TPL42', affiliation: 'Parklane', imageUrl: '' },
    { id: 'RCP', name: 'รีช พหลโยธิน 5', code: 'RCP', affiliation: 'Reach', imageUrl: '' },
    { id: 'p1', name: 'Demo Project A', code: 'P1', affiliation: 'Demo', imageUrl: '' },
    { id: 'p2', name: 'Demo Project B', code: 'P2', affiliation: 'Demo', imageUrl: '' },
];

export const MOCK_CONTRACTORS: Contractor[] = [
    { id: 'C001', name: 'บริษัท TRI-EN', specialty: ['General'], phone: '02-111-2222' },
    { id: 'C002', name: 'บริษัท ชวีน', specialty: ['Floor/Wall'], phone: '085-555-4433' },
    { id: 'C003', name: 'บริษัท ซิตี้ดีไซน์', specialty: ['Furniture'], phone: '02-333-4444' },
    { id: 'C004', name: 'บริษัท A&G', specialty: ['Electrical'], phone: '081-444-5555' },
    { id: 'C005', name: 'บริษัท เฟรมเทค', specialty: ['Aluminum'], phone: '02-666-7777' },
    { id: 'C006', name: 'บริษัท มัสมิก', specialty: ['General'], phone: '' },
    { id: 'C007', name: 'บริษัท AJ STAR', specialty: ['General'], phone: '' },
    { id: 'C008', name: 'บริษัท วิเทค', specialty: ['General'], phone: '' },
    { id: 'C009', name: 'บริษัท เอ็มเท็ม', specialty: ['General'], phone: '' },
    { id: 'C010', name: 'บริษัท ดุสิตา', specialty: ['General'], phone: '' },
    { id: 'C011', name: 'T.T.S. ENGINEERING', specialty: ['General'], phone: '' },
    { id: 'C012', name: 'OWNER-โครงการ', specialty: ['General'], phone: '' },
    { id: 'C013', name: 'นิติบุคคลโครงการ', specialty: ['General'], phone: '' },
];

export const MOCK_STAFF: Staff[] = [
    { id: 'S001', name: 'คุณ วุฒิชัย อรุณรื่น', role: 'Foreman', phone: '081-111-1111', affiliation: 'Sammakorn', profileImage: '' },
    { id: 'S002', name: 'คุณ ธิดารัตน์ เยาะเย้ย', role: 'Foreman', phone: '089-222-2222', affiliation: 'Life Asset', profileImage: '' },
    { id: 'S003', name: 'คุณ ชัยพร กวีพงศ์พาณิชย์', role: 'BackOffice', phone: '085-333-3333', affiliation: 'Sammakorn', profileImage: '' },
    { id: 'S004', name: 'คุณ กัญญพัชร ประสงค์สุข', role: 'Admin', phone: '086-444-4444', affiliation: 'Life Asset', profileImage: '' },
    { id: 'S005', name: 'คุณ กัลยาณิวัฒนา โกศัลนิศิวกุล', role: 'Foreman', phone: '', affiliation: 'Team', profileImage: '' },
    { id: 'S006', name: 'คุณ วรวลัญช์ ประสบทรัพย์', role: 'Foreman', phone: '', affiliation: 'Team', profileImage: '' },
    { id: 'S007', name: 'คุณ นรินทร์ ปลั่งกลาง', role: 'Foreman', phone: '', affiliation: 'Team', profileImage: '' },
    { id: 'S008', name: 'คุณ วณิชฌา พยาแวงศ์', role: 'Foreman', phone: '', affiliation: 'Team', profileImage: '' },
];

export const MOCK_WORK_ORDERS: WorkOrder[] = [
    {
        id: 'WO-001',
        projectId: 'SSRB',
        locationName: 'Unit 1204 - Building A',
        type: 'AfterSale',
        status: 'In Progress',
        isNew: true,
        createdAt: new Date().toISOString(),
        reporterName: 'คุณสมชาย ใจดี',
        reporterPhone: '0812345678',
        reportDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString().split('T')[0],
        appointmentDate: '2023-11-16',
        building: 'A',
        floor: '12',
        room: '04',
        initialProblem: 'ปลั๊กไฟไม่มีไฟเลี้ยง และสวิตช์ไฟห้องนั่งเล่นเสีย',
        categories: [
            {
                id: 'CAT-01',
                name: 'Electrical (งานไฟฟ้า)',
                tasks: [
                    {
                        id: 'MT-001',
                        name: 'Check power outlet voltage',
                        status: 'Assigned', // Case: Waiting for Accept (Assigned + 0%)
                        dailyProgress: 0,
                        contractorId: 'C001',
                        position: 'ผนังหลังชั้นวางทีวี',
                        amount: 2,
                        unit: 'จุด',
                        costType: 'Warranty',
                        slaCategory: '24h',
                        startDate: '2026-01-21',
                        beforePhotoUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=1000',
                        history: [
                            {
                                id: 'h1', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), note: 'เข้าตรวจหน้างานเบื้องต้น', progress: 0,
                                photos: ['https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=800'],
                                labor: [
                                    { id: 'l1', membership: 'Internal', staffId: 'S001', staffName: 'คุณ วุฒิชัย อรุณรื่น', affiliation: 'Sammakorn', amount: 1, timeType: 'Normal' }
                                ]
                            },
                            {
                                id: 'h2', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), note: 'เตรียมวัสดุอุปกรณ์', progress: 0,
                                photos: ['https://images.unsplash.com/photo-1581578731548-c64695cc6958?auto=format&fit=crop&q=80&w=800'],
                                labor: [
                                    { id: 'l2', membership: 'Internal', staffId: 'S001', staffName: 'คุณ วุฒิชัย อรุณรื่น', affiliation: 'Sammakorn', amount: 1, timeType: 'Normal' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'MT-002',
                        name: 'Replace living room light switch',
                        status: 'In Progress', // Case: In Progress
                        dailyProgress: 45,
                        responsibleStaffIds: ['S001'],
                        position: 'ทางเข้าห้องนั่งเล่น ชั้น 12',
                        amount: 1,
                        unit: 'จุด',
                        costType: 'Warranty',
                        beforePhotoUrl: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&q=80&w=1000',
                        slaCategory: '24h',
                        startDate: '2026-01-21',
                        history: [
                            {
                                id: 'h3', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), note: 'เริ่มถอดฝาครอบสวิตช์', progress: 10,
                                photos: ['https://images.unsplash.com/photo-1558372437-0f81d830b80c?auto=format&fit=crop&q=80&w=800'],
                                labor: [{ id: 'l3', membership: 'Internal', staffId: 'S001', staffName: 'คุณ วุฒิชัย อรุณรื่น', affiliation: 'Sammakorn', amount: 1, timeType: 'Normal' }]
                            },
                            {
                                id: 'h4', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), note: 'ตรวจสอบสายไฟภายใน', progress: 30,
                                photos: ['https://images.unsplash.com/photo-1595113316349-9fa4ee24f884?auto=format&fit=crop&q=80&w=800'],
                                labor: [{ id: 'l4', membership: 'Internal', staffId: 'S001', staffName: 'คุณ วุฒิชัย อรุณรื่น', affiliation: 'Sammakorn', amount: 1, timeType: 'Normal' }]
                            },
                            {
                                id: 'h5', date: new Date().toISOString(), note: 'กำลังเปลี่ยนสวิตช์ตัวใหม่', progress: 45,
                                photos: ['https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=800'],
                                labor: [{ id: 'l5', membership: 'Internal', staffId: 'S001', staffName: 'คุณ วุฒิชัย อรุณรื่น', affiliation: 'Sammakorn', amount: 1, timeType: 'Normal' }]
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'WO-002',
        projectId: 'DH2',
        locationName: 'Unit 5502 - Penthouse',
        type: 'PreHandover',
        status: 'Pending',
        isNew: true,
        createdAt: new Date().toISOString(),
        reporterName: 'คุณวิภา (Nิติบุคคล)',
        reporterPhone: '029876543',
        reportDate: new Date().toISOString().split('T')[0],
        appointmentDate: '2023-11-17',
        building: '-',
        floor: '55',
        room: '02',
        initialProblem: 'รอยขีดข่วนบนประตูหลัก',
        categories: [
            {
                id: 'CAT-03',
                name: 'รายการตรวจพบ (Defect List)',
                tasks: [
                    {
                        id: 'MT-004',
                        name: 'รอยขีดข่วนบนประตูหลัก',
                        status: 'Pending',
                        position: 'บานประตูหน้าบ้าน',
                        amount: 1,
                        unit: 'จุด',
                        dailyProgress: 0,
                        beforePhotoUrl: 'https://images.unsplash.com/photo-1595428774223-ef526241202e?auto=format&fit=crop&q=80&w=1000'
                    },
                    {
                        id: 'MT-005',
                        name: 'พื้นห้องน้ำโซนเปียกน้ำขัง',
                        status: 'Pending',
                        position: 'ห้องน้ำ Master ชั้น 2',
                        amount: 3.49,
                        unit: 'ตรม.',
                        dailyProgress: 0,
                        beforePhotoUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=1000'
                    },
                    {
                        id: 'MT-006',
                        name: 'สวิตช์ไฟติดขัด',
                        status: 'Pending',
                        position: 'หัวเตียงห้องนอน 1',
                        amount: 2,
                        unit: 'จุด',
                        dailyProgress: 0,
                        beforePhotoUrl: ''
                    }
                ]
            }
        ]
    },
    {
        id: 'WO-2601-002',
        projectId: 'SSRB',
        locationName: 'Unit 2201 - Building A',
        type: 'AfterSale',
        status: 'In Progress',
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
        reporterName: 'คุณสมศักดิ์ (เจ้าของร่วม)',
        reporterPhone: '089-999-9999',
        reportDate: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString().split('T')[0],
        appointmentDate: '2026-01-20',
        initialProblem: 'น้ำรั่วซึมจากเพดานห้องน้ำ',
        categories: [
            {
                id: 'cat-critical-1',
                name: 'Plumbing (งานประปา)',
                tasks: [
                    {
                        id: 't-crit-1',
                        name: 'ตรวจสอบรอยรั่วท่อน้ำทิ้ง',
                        status: 'Assigned', // Critical Case: Waiting for Accept + Red SLA
                        dailyProgress: 0,
                        contractorId: 'C001',
                        position: 'ใต้เคาน์เตอร์อ่างล้างหน้า',
                        amount: 1,
                        unit: 'ตำแหน่ง',
                        costType: 'Warranty',
                        slaCategory: 'Immediately',
                        slaStartTime: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
                        startDate: '2026-01-20'
                    }
                ]
            }
        ]
    },
    {
        id: 'WO-2601-003',
        projectId: 'DH2',
        locationName: 'Unit 1105 - Building B',
        type: 'AfterSale',
        status: 'In Progress',
        createdAt: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString(),
        reporterName: 'คุณดาริน (นิติบุคคล)',
        reporterPhone: '081-555-5555',
        reportDate: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString().split('T')[0],
        appointmentDate: '2026-01-20',
        initialProblem: 'แอร์ไม่เย็น ห้องนอนใหญ่',
        categories: [
            {
                id: 'cat-warn-1',
                name: 'Air Conditioning (งานแอร์)',
                tasks: [
                    {
                        id: 't-warn-1',
                        name: 'ล้างแอร์',
                        status: 'In Progress', // Case: In Progress + Almost deadline
                        dailyProgress: 80,
                        responsibleStaffIds: ['S004'],
                        position: 'Bedroom 1 (Master)',
                        amount: 1,
                        unit: 'เครื่อง',
                        costType: 'Warranty',
                        slaCategory: '24h',
                        slaStartTime: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString(),
                        startDate: '2026-01-21',
                        beforePhotoUrl: 'https://images.unsplash.com/photo-1517646287270-a5a0cabcdd0c?auto=format&fit=crop&q=80&w=1000',
                        history: [
                            {
                                id: 'h6', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), note: 'ล้างฟิลเตอร์เบื้องต้น', progress: 80,
                                photos: ['https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=800'],
                                labor: [{ id: 'l6', membership: 'Internal', staffId: 'S004', staffName: 'คุณ กัญญพัชร ประสงค์สุข', affiliation: 'Life Asset', amount: 1, timeType: 'Normal' }]
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'WO-004',
        projectId: 'DH2',
        locationName: 'Unit 505 - Tower B',
        type: 'AfterSale',
        status: 'In Progress',
        reporterName: 'คุณวิทยา (Foreman)',
        reporterPhone: '081-111-1111',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        categories: [
            {
                id: 'CAT-04',
                name: 'งานสี (Painting)',
                tasks: [
                    {
                        id: 'MT-004',
                        name: 'เก็บรอยเปื้อนสีผนังห้องนั่งเล่น',
                        status: 'Completed',
                        dailyProgress: 100,
                        position: 'ผนังฝั่งระเบียง',
                        amount: 5,
                        unit: 'จุด/ตำแหน่ง',
                        costType: 'Warranty',
                        slaCategory: '24h',
                        responsibleStaffIds: ['S001'],
                        history: [
                            {
                                id: 'h7', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), note: 'เก็บสีผนังรอบแรก', progress: 50,
                                photos: [],
                                labor: []
                            },
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'WO-005',
        projectId: 'PNN',
        locationName: 'Unit 909 - Tower C',
        type: 'AfterSale',
        status: 'Completed',
        reporterName: 'คุณวิทยา (Foreman)',
        reporterPhone: '081-111-1111',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        categories: [
            {
                id: 'CAT-05',
                name: 'งานฝ้า (Ceiling)',
                tasks: [
                    {
                        id: 'MT-005',
                        name: 'ซ่อมรอยร้าวฝ้าเพดาน',
                        status: 'Completed',
                        dailyProgress: 100,
                        slaCategory: '1-3d',
                        responsibleStaffIds: ['S001'],
                        history: [
                            {
                                id: 'h8', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), note: 'ฉาบรอยร้าว', progress: 50,
                                photos: [],
                                labor: []
                            },
                            {
                                id: 'h9', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), note: 'ทาสีทับหน้า', progress: 100,
                                photos: [],
                                labor: []
                            }
                        ]
                    }
                ]
            }
        ]
    },
    // --- DEMO DATA FOR REALISTIC WORKFLOW ---
    {
        id: 'WO-DEMO-01',
        projectId: 'p1',
        locationName: 'Unit 112 - Building B',
        type: 'AfterSale',
        status: 'In Progress',
        reporterName: 'คุณสมศักดิ์',
        reporterPhone: '081-999-8888',
        createdAt: new Date().toISOString(),
        categories: [{
            id: 'CAT-D1',
            name: 'Electrical',
            tasks: [{
                id: 'MT-D1',
                name: 'เปลี่ยนเบรกเกอร์ (Circuit Breaker)',
                status: 'Assigned',
                dailyProgress: 0,
                responsibleStaffIds: ['S001'],
                position: 'ตู้ไฟหลัก',
                amount: 1,
                unit: 'ตู้',
                slaCategory: '24h',
                slaStartTime: new Date().toISOString(), // Just started
                history: []
            }]
        }]
    },
    {
        id: 'WO-DEMO-02',
        projectId: 'p1',
        locationName: 'Lobby - Main Hall',
        type: 'AfterSale',
        status: 'In Progress',
        reporterName: 'Admin',
        reporterPhone: '02-123-4567',
        createdAt: new Date().toISOString(),
        categories: [{
            id: 'CAT-D2',
            name: 'General',
            tasks: [{
                id: 'MT-D2',
                name: 'เก็บสีขอบบัวพื้น',
                status: 'Assigned',
                dailyProgress: 0,
                responsibleStaffIds: ['S001'],
                position: 'โถงทางเดิน',
                amount: 15,
                unit: 'เมตร',
                slaCategory: '1-3d',
                history: []
            }]
        }]
    },
    {
        id: 'WO-DEMO-03',
        projectId: 'p1',
        locationName: 'Unit 505 - Building A',
        type: 'AfterSale',
        status: 'In Progress',
        reporterName: 'Owner',
        reporterPhone: '085-555-4433',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        categories: [{
            id: 'CAT-D3',
            name: 'Plumbing',
            tasks: [{
                id: 'MT-D3',
                name: 'แก้ไขท่อน้ำทิ้งอุดตัน',
                status: 'In Progress',
                dailyProgress: 50,
                responsibleStaffIds: ['S001'],
                position: 'ห้องครัว',
                amount: 1,
                unit: 'จุด',
                slaCategory: '24h',
                slaStartTime: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // Close to deadline
                assignee: 'คุณ วรวลัญช์ ประสบทรัพย์',
                rootCause: 'วัสดุเสื่อมสภาพ',
                history: [{
                    id: 'h-d3-1', date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                    note: 'ทะลวงท่อแล้ว ยังไม่หาย', progress: 50, photos: [], labor: []
                }]
            }]
        }]
    },
    {
        id: 'WO-DEMO-04',
        projectId: 'p2',
        locationName: 'Rooftop Garden',
        type: 'AfterSale',
        status: 'In Progress',
        reporterName: 'Foreman A',
        reporterPhone: '081-111-1111',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        categories: [{
            id: 'CAT-D4',
            name: 'Landscape',
            tasks: [{
                id: 'MT-D4',
                name: 'ซ่อมระบบรดน้ำอัตโนมัติ',
                status: 'In Progress',
                dailyProgress: 25,
                responsibleStaffIds: ['S001'],
                position: 'โซนไม้พุ่ม',
                amount: 1,
                unit: 'ระบบ',
                slaCategory: '1-3d',
                assignee: 'คุณ นรินทร์ ปลั่งกลาง',
                rootCause: 'เทคนิคการก่อสร้างผิดพลาด',
                history: [{
                    id: 'h-d4-1', date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                    note: 'ตรวจสอบพบปั๊มเสีย', progress: 25, photos: [], labor: []
                }]
            }]
        }]
    },
    {
        id: 'WO-DEMO-05',
        projectId: 'p2',
        locationName: 'Unit 888 - Penthouse',
        type: 'AfterSale',
        status: 'In Progress',
        reporterName: 'Admin',
        reporterPhone: '086-444-4444',
        createdAt: new Date().toISOString(),
        categories: [{
            id: 'CAT-D5',
            name: 'Interior',
            tasks: [{
                id: 'MT-D5',
                name: 'ติดตั้งโคมไฟระย้า (Chandelier)',
                status: 'In Progress',
                dailyProgress: 80,
                responsibleStaffIds: ['S001'],
                position: 'Living Room',
                amount: 1,
                unit: 'ชุด',
                slaCategory: '1-3d',
                history: [
                    { id: 'h-d5-1', date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), note: 'ติดตั้งโครงสร้างรับน้ำหนัก', progress: 40, photos: [], labor: [] },
                    { id: 'h-d5-2', date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), note: 'เดินสายไฟเสร็จแล้ว', progress: 80, photos: [], labor: [] }
                ]
            }]
        }]
    }
];
