import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.join(__dirname, 'src', 'pages', 'Dashboard.tsx');
const destPath = path.join(__dirname, 'src', 'pages', 'Dashboard_recovered.tsx');

const content = fs.readFileSync(srcPath, 'utf8');
const lines = content.split('\n');

const logicStart = lines.findIndex(l => l.includes('const Dashboard = () => {'));
const logicEnd = lines.findIndex((l, idx) => idx > logicStart && l.includes('if (loading || !user) return'));

let logicLines = lines.slice(logicStart + 1, logicEnd);
logicLines = logicLines.map(l => l.replace('_s();', ''));

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

export const StatCard = ({ title, value, icon, color, subtext, gradient, onClick, trend, style }: any) => (
    <div
        onClick={onClick}
        style={{
            background: gradient || "#ffffff",
            padding: "1.5rem",
            borderRadius: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: gradient ? "none" : "1px solid #e2e8f0",
            boxShadow: gradient ? "0 10px 15px -3px rgba(0, 0, 0, 0.1)" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            minHeight: "160px",
            position: "relative",
            overflow: "hidden",
            ...style
        }}
        onMouseOver={(e: any) => {
            e.currentTarget.style.transform = "translateY(-6px)";
            if (onClick) e.currentTarget.style.cursor = "pointer";
        }}
        onMouseOut={(e: any) => e.currentTarget.style.transform = "translateY(0)"}
    >
        <div style={{ position: "absolute", right: "-10%", top: "-10%", opacity: 0.1, color: gradient ? "#fff" : color }}>
            {React.cloneElement(icon, { size: 120 })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
            <div style={{ background: gradient ? "rgba(255,255,255,0.2)" : (color || "#64748b") + "15", padding: "12px", borderRadius: "14px", color: gradient ? "#fff" : color || "#64748b", display: "flex" }}>
                {icon}
            </div>
            {trend && (
                <div style={{ fontSize: "0.75rem", fontWeight: 700, padding: "4px 8px", borderRadius: "20px", background: trend > 0 ? "#dcfce7" : "#fee2e2", color: trend > 0 ? "#166534" : "#991b1b" }}>
                    {trend > 0 ? "+" : ""}{trend}%
                </div>
            )}
        </div>
        <div style={{ position: "relative", zIndex: 1, marginTop: "1rem" }}>
            <div style={{ fontSize: "0.875rem", color: gradient ? "rgba(255,255,255,0.8)" : "#64748b", fontWeight: 600, marginBottom: "4px" }}>
                {title}
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 900, color: gradient ? "#fff" : "#0f172a", lineHeight: 1, letterSpacing: "-0.03em" }}>
                {value}
            </div>
            {subtext && (
                <div style={{ fontSize: "0.75rem", color: gradient ? "rgba(255,255,255,0.7)" : "#94a3b8", marginTop: "8px", fontWeight: 500 }}>
                    {subtext}
                </div>
            )}
        </div>
    </div>
);

export const SectionHeader = ({ title, icon, subtitle, actions }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {icon && <div style={{ color: "#4f46e5" }}>{icon}</div>}
            <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#1e293b" }}>{title}</h3>
                {subtitle && <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>{subtitle}</p>}
            </div>
        </div>
        {actions && <div>{actions}</div>}
    </div>
);

export default function Dashboard() {
`;

const footer = `    if (loading || !user) return (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "60vh", gap: "1rem", color: "#64748b" }}>
            <div style={{ width: "40px", height: "40px", border: "4px solid #f3f3f3", borderTop: "4px solid #4f46e5", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>กำลังเตรียมข้อมูลแดชบอร์ด...</div>
            <style>{\`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }\`}</style>
        </div>
    );

    return (
        <div style={{ maxWidth: "1400px", margin: "0 auto", paddingBottom: "3rem" }}>
            {/* TODO: Return JSX needs to be recovered manually here chunk by chunk */}
        </div>
    );
}
`;

fs.writeFileSync(destPath, header + logicLines.join('\n') + '\n' + footer);
console.log('Dashboard_recovered.tsx created successfully!');
