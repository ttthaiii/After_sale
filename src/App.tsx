import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Entry from './pages/Entry';
import SLAMonitor from './pages/SLAMonitor';
import DailyReport from './pages/DailyReport';
import AdminMasterData from './pages/AdminMasterData';
import Evaluation from './pages/Evaluation';
import History from './pages/History';
import Login from './pages/Login';
import { AuthProvider } from './context/AuthContext';
import { WorkOrderProvider } from './context/WorkOrderContext';

import { NotificationProvider } from './context/NotificationContext';

function App() {
    return (
        <AuthProvider>
            <WorkOrderProvider>
                <NotificationProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/login" element={<Login />} />

                            <Route path="/" element={<MainLayout />}>
                                <Route index element={<Navigate to="/dashboard" replace />} />
                                <Route path="dashboard" element={<Dashboard />} />
                                <Route path="work-orders" element={<Entry />} />
                                <Route path="sla-monitor" element={<SLAMonitor />} />
                                <Route path="daily-report" element={<DailyReport />} />
                                <Route path="admin" element={<AdminMasterData />} />
                                <Route path="evaluation" element={<Evaluation />} />
                                <Route path="history" element={<History />} />
                            </Route>
                        </Routes>
                    </BrowserRouter>
                </NotificationProvider>
            </WorkOrderProvider>
        </AuthProvider>
    );
}

export default App;
