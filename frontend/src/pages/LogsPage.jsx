import { useState, useEffect } from 'react';
import { ScrollText, AlertCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const LEVEL_STYLES = {
  info:     'text-blue-400 bg-blue-950/40',
  warn:     'text-yellow-400 bg-yellow-950/40',
  error:    'text-red-400 bg-red-950/40',
  critical: 'text-red-300 bg-red-950/60'
};
const LEVEL_ICONS = {
  info:     Info,
  warn:     AlertTriangle,
  error:    AlertCircle,
  critical: AlertCircle
};

function fmt(date) {
  return new Date(date).toLocaleString();
}

export default function LogsPage() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [level, setLevel]       = useState('');
  const [source, setSource]     = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (level)  params.level  = level;
      if (source) params.source = source;
      params.limit = 200;
      const { data } = await api.get('/logs', { params });
      setLogs(data);
    } catch {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [level, source]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ScrollText size={20} className="text-indigo-400" />
          <h1 className="text-lg font-semibold text-white">System Logs</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Level filter */}
          <select
            value={level}
            onChange={e => setLevel(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>

          {/* Source filter */}
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All sources</option>
            <option value="system">System</option>
            <option value="agent">Agent</option>
            <option value="user">User</option>
            <option value="command">Command</option>
          </select>

          <button
            onClick={fetchLogs}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <ScrollText size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No logs found</p>
          </div>
        ) : (
          logs.map(log => {
            const Icon = LEVEL_ICONS[log.level] || Info;
            return (
              <div key={log.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg ${LEVEL_STYLES[log.level] || 'bg-gray-900'}`}>
                <Icon size={15} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs uppercase font-medium opacity-70">{log.source}</span>
                    <span className="text-xs text-gray-500">{fmt(log.createdAt)}</span>
                  </div>
                  <p className="text-sm">{log.message}</p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre className="text-xs mt-1 opacity-60 whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
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
