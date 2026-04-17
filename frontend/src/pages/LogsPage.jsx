/**
 * Logs Page
 * System log viewer with filtering and real-time streaming.
 */
import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, Info, AlertCircle, XCircle, X, RefreshCw } from 'lucide-react';
import { logsAPI } from '../lib/api';
import { useWSEvent } from '../lib/socket';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logsAPI.getAll({ limit: 200 });
      setLogs(res.data?.logs || res.data || []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Real-time new log entries
  useWSEvent('ws:log:new', (log) => {
    setLogs(prev => [log, ...prev].slice(0, 500));
  });

  const [levelFilter, setLevelFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = logs.filter(l => {
    const matchLevel = levelFilter === 'all' || l.level === levelFilter;
    const matchSearch = !search || l.message.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  const levelConfig = {
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    warn: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
    critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/15' }
  };

  const fmtTime = (d) => new Date(d).toLocaleString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold text-white">System Logs</h2><p className="text-sm text-white/40 mt-1">Real-time log monitoring ({logs.length} entries)</p></div>
        <button onClick={loadLogs} className="glass-button-outline flex items-center gap-2"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"/>
          <input type="text" placeholder="Filter logs..." value={search} onChange={e=>setSearch(e.target.value)} className="glass-input w-full pl-10"/>
          {search&&<button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30"><X className="w-4 h-4"/></button>}
        </div>
        <div className="flex gap-2">
          {['all','info','warn','error','critical'].map(l=>(
            <button key={l} onClick={()=>setLevelFilter(l)} className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${levelFilter===l?'bg-brand-600/20 text-brand-400 border border-brand-500/20':'text-white/40 hover:bg-white/[0.04]'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="divide-y divide-white/[0.04]">
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-white/30">{loading ? 'Loading...' : 'No logs match the current filter.'}</div>
          )}
          {filtered.map(log => {
            const cfg = levelConfig[log.level] || levelConfig.info;
            const Icon = cfg.icon;
            return (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                <div className={`mt-0.5 p-1.5 rounded-lg ${cfg.bg} flex-shrink-0`}><Icon className={`w-3.5 h-3.5 ${cfg.color}`}/></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70 font-mono">{log.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-white/25 font-mono">{fmtTime(log.created_at)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30">{log.source}</span>
                    {log.device&&<span className="text-[10px] text-white/25">{log.device.hostname}</span>}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${cfg.bg} ${cfg.color}`}>{log.level}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
