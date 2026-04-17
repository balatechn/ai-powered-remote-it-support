/**
 * Dashboard Page
 * KPI overview with charts and activity feed.
 */

import { useState, useEffect } from 'react';
import {
  Monitor, Users, Play, AlertTriangle, Brain, Activity,
  TrendingUp, ArrowUpRight, ArrowDownRight, Server, Wifi
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { dashboardAPI } from '../lib/api';
import { useWSEvent } from '../lib/socket';

// Mock chart data for when API is unavailable
const mockAreaData = [
  { name: 'Mon', sessions: 12, issues: 3 },
  { name: 'Tue', sessions: 19, issues: 5 },
  { name: 'Wed', sessions: 15, issues: 2 },
  { name: 'Thu', sessions: 24, issues: 7 },
  { name: 'Fri', sessions: 22, issues: 4 },
  { name: 'Sat', sessions: 8, issues: 1 },
  { name: 'Sun', sessions: 5, issues: 0 },
];

const mockOsData = [
  { name: 'Windows', value: 65, color: '#6366f1' },
  { name: 'Linux', value: 25, color: '#8b5cf6' },
  { name: 'macOS', value: 10, color: '#06b6d4' },
];

const customTooltipStyle = {
  contentStyle: {
    background: '#1e293b',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '12px',
    color: '#fff'
  },
  cursor: { stroke: 'rgba(99, 102, 241, 0.3)' }
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [deviceHealth, setDeviceHealth] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Real-time updates
  useWSEvent('ws:device:status', () => loadDashboard());
  useWSEvent('ws:session:started', () => loadDashboard());
  useWSEvent('ws:session:ended', () => loadDashboard());

  const loadDashboard = async () => {
    try {
      const [statsRes, activityRes, healthRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getActivity(),
        dashboardAPI.getDeviceHealth()
      ]);
      setStats(statsRes.data);
      setActivity(activityRes.data);
      setDeviceHealth(healthRes.data?.devices || []);
    } catch {
      // Use default values if API unavailable
      setStats({
        devices: { total: 47, online: 38, offline: 9 },
        users: { total: 12 },
        sessions: { active: 5, total: 342 },
        logs: { today: 156, critical_week: 8 },
        ai: { interactions_week: 89, resolved: 72, success_rate: 81 }
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Devices',
      value: stats?.devices?.total || 0,
      change: '+3',
      trend: 'up',
      icon: Monitor,
      color: 'brand',
      sub: `${stats?.devices?.online || 0} online`
    },
    {
      label: 'Active Sessions',
      value: stats?.sessions?.active || 0,
      change: '+2',
      trend: 'up',
      icon: Play,
      color: 'emerald',
      sub: `${stats?.sessions?.total || 0} total`
    },
    {
      label: 'AI Resolution Rate',
      value: `${stats?.ai?.success_rate || 0}%`,
      change: '+5%',
      trend: 'up',
      icon: Brain,
      color: 'purple',
      sub: `${stats?.ai?.interactions_week || 0} this week`
    },
    {
      label: 'Critical Alerts',
      value: stats?.logs?.critical_week || 0,
      change: '-2',
      trend: 'down',
      icon: AlertTriangle,
      color: 'amber',
      sub: `${stats?.logs?.today || 0} logs today`
    }
  ];

  const colorMap = {
    brand: { bg: 'bg-brand-600/15', text: 'text-brand-400', glow: 'shadow-brand-500/20' },
    emerald: { bg: 'bg-emerald-600/15', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
    purple: { bg: 'bg-purple-600/15', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
    amber: { bg: 'bg-amber-600/15', text: 'text-amber-400', glow: 'shadow-amber-500/20' }
  };

  const getRelativeTime = (date) => {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const colors = colorMap[kpi.color];
          return (
            <div key={i} className="kpi-card group" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-white/40 font-medium uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-3xl font-bold text-white mt-2">{kpi.value}</p>
                  <p className="text-xs text-white/30 mt-1">{kpi.sub}</p>
                </div>
                <div className={`p-3 rounded-xl ${colors.bg} shadow-lg ${colors.glow}`}>
                  <kpi.icon className={`w-5 h-5 ${colors.text}`} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3">
                {kpi.trend === 'up' ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="text-xs font-medium text-emerald-400">{kpi.change}</span>
                <span className="text-xs text-white/30">vs last week</span>
              </div>
              {/* Decorative gradient */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 ${colors.bg} rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity`} />
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Session Trend */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-white">Session Activity</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-500" /> Sessions</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> Issues</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={mockAreaData}>
              <defs>
                <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="issueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip {...customTooltipStyle} />
              <Area type="monotone" dataKey="sessions" stroke="#6366f1" fill="url(#sessGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="issues" stroke="#f87171" fill="url(#issueGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* OS Distribution */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-6">OS Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={mockOsData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {mockOsData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip {...customTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {mockOsData.map((os, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: os.color }} />
                  <span className="text-white/60">{os.name}</span>
                </span>
                <span className="text-white/80 font-medium">{os.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Device Health + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Online Devices */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            Online Devices
          </h3>
          <div className="space-y-3">
            {(deviceHealth.length > 0 ? deviceHealth.slice(0, 5) : [
              { hostname: 'SRV-PROD-01', cpu_usage: 45, memory_usage: 62 },
              { hostname: 'WS-DEV-04', cpu_usage: 78, memory_usage: 84 },
              { hostname: 'DC-MAIN-01', cpu_usage: 23, memory_usage: 41 },
              { hostname: 'WS-DESIGN-02', cpu_usage: 56, memory_usage: 73 },
              { hostname: 'SRV-BACKUP-01', cpu_usage: 12, memory_usage: 35 },
            ]).map((device, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="status-dot status-online" />
                  <div>
                    <p className="text-sm font-medium text-white/80">{device.hostname}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/30">CPU</span>
                    <span className={`font-medium ${(device.cpu_usage || 0) > 70 ? 'text-amber-400' : 'text-white/60'}`}>{Math.round(device.cpu_usage || 0)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/30">MEM</span>
                    <span className={`font-medium ${(device.memory_usage || 0) > 80 ? 'text-red-400' : 'text-white/60'}`}>{Math.round(device.memory_usage || 0)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-400" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {(activity?.recentSessions?.length > 0 ? activity.recentSessions.slice(0, 5).map(s => ({
              action: `${s.session_type?.toUpperCase()} session ${s.status}`,
              target: s.device?.hostname || 'Unknown',
              user: s.user ? `${s.user.first_name} ${s.user.last_name?.[0]}.` : 'Unknown',
              time: getRelativeTime(s.created_at),
              type: 'session'
            })) : [
              { action: 'Remote session started', target: 'SRV-PROD-01', user: 'John D.', time: '2m ago', type: 'session' },
              { action: 'AI diagnosed issue', target: 'WS-DEV-04', user: 'NexusAI', time: '8m ago', type: 'ai' },
              { action: 'Script executed', target: 'DC-MAIN-01', user: 'Sarah K.', time: '15m ago', type: 'script' },
              { action: 'Device came online', target: 'WS-DESIGN-02', user: 'Agent', time: '22m ago', type: 'device' },
              { action: 'Critical alert resolved', target: 'SRV-BACKUP-01', user: 'Mike R.', time: '1h ago', type: 'alert' },
            ]).map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  item.type === 'session' ? 'bg-emerald-500/15 text-emerald-400' :
                  item.type === 'ai' ? 'bg-purple-500/15 text-purple-400' :
                  item.type === 'script' ? 'bg-brand-500/15 text-brand-400' :
                  item.type === 'device' ? 'bg-cyan-500/15 text-cyan-400' :
                  'bg-amber-500/15 text-amber-400'
                }`}>
                  {item.type === 'session' ? <Play className="w-3.5 h-3.5" /> :
                   item.type === 'ai' ? <Brain className="w-3.5 h-3.5" /> :
                   item.type === 'script' ? <Server className="w-3.5 h-3.5" /> :
                   item.type === 'device' ? <Monitor className="w-3.5 h-3.5" /> :
                   <AlertTriangle className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70">{item.action}</p>
                  <p className="text-xs text-white/30 mt-0.5">{item.target} · {item.user} · {item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
