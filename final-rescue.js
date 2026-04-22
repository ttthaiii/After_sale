import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const astPath = path.join(__dirname, 'src', 'pages', 'Dashboard_ast.tsx');
const destPath = path.join(__dirname, 'src', 'pages', 'Dashboard_recovered.tsx');

let astContent = fs.readFileSync(astPath, 'utf8');

astContent = astContent.replace(/\/\* @__PURE__ \*\//g, '');

const lines = astContent.split('\n');
const startIdx = lines.findIndex(l => l.startsWith('const StatCard = ('));

let bodyText = lines.slice(startIdx).join('\n');

bodyText = bodyText.replace(/_s\(\);/g, '');
bodyText = bodyText.replace(/_c = StatCard;/g, '');
bodyText = bodyText.replace(/_c2 = SectionHeader;/g, '');
bodyText = bodyText.replace(/_c3 = Dashboard;/g, '');
bodyText = bodyText.replace(/\$RefreshReg\$.*;/g, '');

const header = `import React, { useState, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useAuth } from '../context/AuthContext';
import {
    TrendingUp, DollarSign, AlertTriangle, Clock, Activity, BarChart3,
    CheckCircle2, Users, MapPin, MessageCircle, User
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import ForemanCalendar from '../components/ForemanCalendar';

`;

const finalCode = header + bodyText + '\nexport default Dashboard;\n';

fs.writeFileSync(destPath, finalCode);
console.log('Final clean-up complete!');
