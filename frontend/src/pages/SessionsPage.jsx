import { useState, useEffect } from 'react';
import { Activity, Clock, Monitor, User, StopCircle, RefreshCw } from 'lucide-react';
import { sessionsAPI } from '../lib/api';
import toast from 'react-hot-toast';

const mockSessions = [
  { id: '1', device: { hostname: 'DESKTOP-3LMQR2M' }, user: { first_name: 'Bala', last_name: 'Pillai' }, started_at: new Date(Date.now() - 1800000), ended_at: null, status: 'active', duration_seconds: 1800 },
  { id: '2', device: { hostname: 'NAT-HO-BLR-002-IT' }, user: { first_name: 'Bala', last_name: 'Pillai' }, started_at: new Date(Date.now() - 7200000), ended_at: new Date(Date.now() - 3600000), status: 'ended', duration_seconds: 3600 },
  { id: '3', device: { hostname: 'NAT-HO-BLR-028' }, user: { first_name: 'Bala', last_name: 'Pillai' }, started_at: new Date(Date.now() - 86400000), ended_at: new Date(Date.now() - 82800000), status: 'ended', duration_seconds: 3600 },
];

const fmtDuration = (s) => {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export default function SessionsPage() {
  const [sessions, setSessions] = useState(mockSessions);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await sessionsAPI.getAll();
      if (data.sessions?.length) setSessions(data.sessions);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleEnd = async (id) => {
    try {
      await sessionsAPI.end(id, { notes: 'Ended by admin' });
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'ended', ended_at: new Date() } : s));
      toast.success('Session ended');
    } catch { toast.error('Failed to end session'); }
  };

  const active = sessions.filter(s => s.status === 'active');
  const ended = sessions.filter(s => s.status !== 'active');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Sessions</h2>
          <p className="text-sm text-white/40 mt-1">{active.length} active · {ended.length} completed</p>
        </div>
        <button onClick={load} className="glass-button-outline flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Active</p>
          <div className="space-y-3">
            {active.map(s => (
              <div key={s.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{s.device?.hostname || 'Unknown'}</span>
                    <span className="status-dot status-online" />
                    <span className="text-xs text-emerald-400">Live</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-white/30"><User className="w-3 h-3" />{s.user?.first_name} {s.user?.last_name}</span>
                    <span className="flex items-center gap-1 text-xs text-white/30"><Clock className="w-3 h-3" />Started {fmtTime(s.started_at)}</span>
                  </div>
                </div>
                <button onClick={() => handleEnd(s.id)} className="glass-button-danger flex items-center gap-1.5 text-xs">
                  <StopCircle className="w-3.5 h-3.5" /> End
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">History</p>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Device', 'User', 'Started', 'Duration', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-white/30 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {ended.map(s => (
                <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-white/70 flex items-center gap-2"><Monitor className="w-3.5 h-3.5 text-white/25" />{s.device?.hostname || '—'}</td>
                  <td className="px-5 py-3 text-white/50">{s.user?.first_name} {s.user?.last_name}</td>
                  <td className="px-5 py-3 text-white/40 text-xs font-mono">{fmtTime(s.started_at)}</td>
                  <td className="px-5 py-3 text-white/50">{fmtDuration(s.duration_seconds)}</td>
                  <td className="px-5 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/30 border border-white/[0.06] capitalize">{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
