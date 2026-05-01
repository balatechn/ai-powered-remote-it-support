import { useState, useEffect } from 'react';
import { Monitor, Activity, FileCode2, AlertTriangle, TrendingUp, Cpu, HardDrive, Wifi } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

const mockStats = {
  totalDevices: 5,
  onlineDevices: 3,
  activeSessions: 2,
  scriptsRun: 14,
  criticalAlerts: 1,
};

const mockActivity = [
  { id: 1, type: 'device', message: 'DESKTOP-3LMQR2M came online', time: '2 min ago', color: 'text-emerald-400' },
  { id: 2, type: 'script', message: 'Clear DNS Cache executed on NAT-HO-BLR-028', time: '15 min ago', color: 'text-brand-400' },
  { id: 3, type: 'alert', message: 'High CPU on NAT-HO-BLR-002-IT: 92%', time: '32 min ago', color: 'text-amber-400' },
  { id: 4, type: 'session', message: 'Remote session started on DESKTOP-3LMQR2M', time: '1 hr ago', color: 'text-blue-400' },
  { id: 5, type: 'fix', message: 'Flush DNS fix applied on NAT-HO-BLR-028', time: '2 hr ago', color: 'text-purple-400' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(mockStats);

  useEffect(() => {
    dashboardAPI.getStats().then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const cards = [
    { label: 'Total Devices', value: stats.totalDevices, icon: Monitor, color: 'text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Online Now', value: stats.onlineDevices, icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Active Sessions', value: stats.activeSessions, icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Scripts Run Today', value: stats.scriptsRun, icon: FileCode2, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Critical Alerts', value: stats.criticalAlerts, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-white">Dashboard</h2>
        <p className="text-sm text-white/40 mt-1">Overview of your IT infrastructure</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass-card p-5">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/40 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {mockActivity.map(a => (
              <div key={a.id} className="flex items-start gap-3">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  a.color.replace('text-', 'bg-')
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70">{a.message}</p>
                  <p className="text-xs text-white/25 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Health */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-brand-400" />
            Average System Health
          </h3>
          {[
            { label: 'CPU Usage', value: 39, color: 'bg-brand-500' },
            { label: 'Memory', value: 58, color: 'bg-purple-500' },
            { label: 'Disk', value: 62, color: 'bg-amber-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="mb-4">
              <div className="flex justify-between text-xs text-white/50 mb-1.5">
                <span>{label}</span>
                <span>{value}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-white/30" />
              <p className="text-xs text-white/40">3 of 5 devices reporting healthy metrics</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
