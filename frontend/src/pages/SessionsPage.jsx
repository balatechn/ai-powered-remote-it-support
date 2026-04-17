/**
 * Sessions Page
 * Remote session history and active session management.
 */

import { useState, useEffect, useCallback } from 'react';
import { Play, Square, Monitor, ExternalLink, RefreshCw } from 'lucide-react';
import { sessionsAPI } from '../lib/api';
import { useWSEvent } from '../lib/socket';
import toast from 'react-hot-toast';

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await sessionsAPI.getAll({ limit: 50 });
      setSessions(data.sessions || []);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Real-time updates
  useWSEvent('ws:session:started', () => loadSessions());
  useWSEvent('ws:session:ended', () => loadSessions());

  const handleEndSession = async (id) => {
    try {
      await sessionsAPI.end(id);
      toast.success('Session ended');
      loadSessions();
    } catch {
      toast.error('Failed to end session');
    }
  };

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);
  const active = sessions.filter(s => s.status === 'active');

  const fmtDur = (s) => { if (!s) return '—'; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m`; };
  const fmtTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const elapsed = (d) => { const m = Math.floor((Date.now() - new Date(d)) / 60000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };

  const typeColors = { rdp: 'bg-brand-600/15 text-brand-400', ssh: 'bg-emerald-600/15 text-emerald-400', vnc: 'bg-purple-600/15 text-purple-400', terminal: 'bg-amber-600/15 text-amber-400' };
  const statusCfg = { active: { c: 'text-emerald-400', bg: 'bg-emerald-400/10' }, ended: { c: 'text-white/40', bg: 'bg-white/[0.04]' }, failed: { c: 'text-red-400', bg: 'bg-red-400/10' }, timeout: { c: 'text-amber-400', bg: 'bg-amber-400/10' } };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Sessions</h2>
          <p className="text-sm text-white/40 mt-1">{active.length} active · {sessions.length} total</p>
        </div>
        <button onClick={loadSessions} className="glass-button-outline flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {active.length > 0 && (
        <div className="glass-card p-4 border-emerald-500/20">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Active Sessions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {active.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center"><Play className="w-4 h-4 text-emerald-400" /></div>
                  <div>
                    <p className="text-sm font-medium text-white">{s.device?.hostname || 'Unknown'}</p>
                    <p className="text-xs text-white/30">{s.user?.first_name} · {elapsed(s.started_at)}</p>
                  </div>
                </div>
                <button onClick={() => handleEndSession(s.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                  <Square className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'active', 'ended', 'failed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${filter === f ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20' : 'text-white/40 hover:bg-white/[0.04]'}`}>{f}</button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Device', 'User', 'Type', 'Status', 'Started', 'Duration', ''].map(h => (
                <th key={h} className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const sc = statusCfg[s.status] || statusCfg.ended;
              return (
                <tr key={s.id} className="table-row">
                  <td className="px-6 py-4"><div className="flex items-center gap-2"><Monitor className="w-4 h-4 text-white/30" /><span className="text-sm font-medium text-white/80">{s.device?.hostname || 'Unknown'}</span></div></td>
                  <td className="px-6 py-4 text-sm text-white/60">{s.user?.first_name} {s.user?.last_name}</td>
                  <td className="px-6 py-4"><span className={`text-xs px-2.5 py-1 rounded-full font-medium uppercase ${typeColors[s.session_type]}`}>{s.session_type}</span></td>
                  <td className="px-6 py-4"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sc.bg} ${sc.c}`}>{s.status}</span></td>
                  <td className="px-6 py-4 text-sm text-white/40">{fmtTime(s.started_at || s.created_at)}</td>
                  <td className="px-6 py-4 text-sm text-white/40 font-mono">{s.status === 'active' ? elapsed(s.started_at || s.created_at) : fmtDur(s.duration_seconds)}</td>
                  <td className="px-6 py-4 text-right">
                    {s.status === 'active'
                      ? <button onClick={() => handleEndSession(s.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-400/10"><Square className="w-4 h-4" /></button>
                      : <button className="p-2 rounded-lg text-white/30 hover:text-white/60"><ExternalLink className="w-4 h-4" /></button>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-white/30">No sessions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
