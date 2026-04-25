/**
 * Remote Tools Page
 * Tabs: Screenshot | Processes | Services | Inventory | Files
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  ChevronLeft, Camera, RefreshCw, Cpu, Layers,
  Package, FolderOpen, Trash2, Upload, Download,
  Play, Square, RotateCcw, Search, ChevronRight,
  Loader2, AlertCircle, Home, FileText, Folder, Monitor
} from 'lucide-react';
import api from '../lib/api.js';
import { useAuthStore } from '../stores/authStore.js';
import toast from 'react-hot-toast';

const SOCKET_URL = window.location.origin;
const TABS = [
  { label: 'Screenshot',  icon: Camera },
  { label: 'Processes',   icon: Cpu },
  { label: 'Services',    icon: Layers },
  { label: 'Inventory',   icon: Package },
  { label: 'Files',       icon: FolderOpen },
  { label: 'Remote View', icon: Monitor },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Shared helpers ─────────────────────────────────────────────
function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="animate-spin text-indigo-400" />;
}

function Err({ msg }) {
  return (
    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
      <AlertCircle size={16} className="flex-shrink-0" />
      {msg}
    </div>
  );
}

function Btn({ onClick, disabled, loading, children, variant = 'primary', className = '' }) {
  const base = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary:   'bg-indigo-600 hover:bg-indigo-500 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700',
    danger:    'bg-red-700 hover:bg-red-600 text-white',
    success:   'bg-green-700 hover:bg-green-600 text-white',
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`}>
      {loading && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

// ── Screenshot Tab ─────────────────────────────────────────────
function ScreenshotTab({ sendTool, online }) {
  const [loading, setLoading] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState(null);

  const take = async () => {
    if (!online) return toast.error('Device is offline');
    setLoading(true); setError(null);
    try {
      const data = await sendTool('screenshot');
      setScreenshot(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold">Remote Screenshot</h2>
          <p className="text-xs text-gray-500 mt-0.5">Capture the current display of the remote machine</p>
        </div>
        <Btn onClick={take} loading={loading} disabled={!online}>
          <Camera size={14} />
          {loading ? 'Capturing…' : 'Take Screenshot'}
        </Btn>
      </div>

      {error && <div className="mb-4"><Err msg={error} /></div>}

      {screenshot ? (
        <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
            <span className="text-xs text-gray-500">
              Captured at {new Date(screenshot.timestamp).toLocaleTimeString()}
            </span>
            <a
              href={`data:image/jpeg;base64,${screenshot.image}`}
              download={`screenshot-${Date.now()}.jpg`}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Download size={12} /> Save
            </a>
          </div>
          <img
            src={`data:image/jpeg;base64,${screenshot.image}`}
            alt="Remote screenshot"
            className="w-full h-auto block"
          />
        </div>
      ) : !loading && (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-800 text-gray-600">
          <Camera size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No screenshot yet</p>
          <p className="text-xs mt-1">Click "Take Screenshot" to capture the remote screen</p>
        </div>
      )}
    </div>
  );
}

// ── Processes Tab ──────────────────────────────────────────────
function ProcessesTab({ sendTool, online }) {
  const [loading, setLoading] = useState(false);
  const [processes, setProcesses] = useState([]);
  const [filter, setFilter] = useState('');
  const [killing, setKilling] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!online) return;
    setLoading(true); setError(null);
    try {
      const data = await sendTool('processes');
      setProcesses(data.processes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sendTool, online]);

  useEffect(() => { if (online) load(); }, [load, online]);

  const kill = async (proc) => {
    if (!confirm(`Kill "${proc.Name}" (PID ${proc.Id})?`)) return;
    setKilling(proc.Id);
    try {
      await sendTool('kill', { pid: proc.Id });
      toast.success(`Killed ${proc.Name}`);
      setProcesses(prev => prev.filter(p => p.Id !== proc.Id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setKilling(null);
    }
  };

  const visible = processes.filter(p =>
    !filter || p.Name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold">Process Manager</h2>
          <p className="text-xs text-gray-500 mt-0.5">{processes.length} processes</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter…"
              className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-40"
            />
          </div>
          <Btn onClick={load} loading={loading} variant="secondary">
            <RefreshCw size={13} /> Refresh
          </Btn>
        </div>
      </div>

      {error && <div className="mb-3"><Err msg={error} /></div>}

      {loading && processes.length === 0 ? (
        <div className="flex items-center justify-center h-40"><Spinner /></div>
      ) : (
        <div className="overflow-auto rounded-xl border border-gray-800 flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-16">PID</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">CPU (s)</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Memory</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {visible.map(p => (
                <tr key={p.Id} className="hover:bg-gray-800/40">
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{p.Id}</td>
                  <td className="px-4 py-2 text-gray-200 font-medium">{p.Name}</td>
                  <td className={`px-4 py-2 font-mono text-xs ${p.CPU > 50 ? 'text-red-400' : p.CPU > 10 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {p.CPU ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">
                    {p.MemMB != null ? `${p.MemMB} MB` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => kill(p)}
                      disabled={killing === p.Id}
                      className="text-red-500 hover:text-red-400 disabled:opacity-40 p-1 rounded hover:bg-red-900/20 transition-colors"
                      title="Kill process"
                    >
                      {killing === p.Id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600 text-sm">No processes found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Services Tab ───────────────────────────────────────────────
function ServicesTab({ sendTool, online }) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!online) return;
    setLoading(true); setError(null);
    try {
      const data = await sendTool('services');
      setServices(data.services || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sendTool, online]);

  useEffect(() => { if (online) load(); }, [load, online]);

  const control = async (svc, action) => {
    setBusy(`${svc.Name}:${action}`);
    try {
      await sendTool('service:control', { name: svc.Name, action });
      toast.success(`${action} "${svc.DisplayName}"`);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const statusColor = (s) => ({
    Running: 'text-green-400',
    Stopped: 'text-gray-500',
    Paused:  'text-yellow-400',
  })[s] || 'text-gray-400';

  const visible = services.filter(s => {
    const matchText = !filter ||
      s.DisplayName?.toLowerCase().includes(filter.toLowerCase()) ||
      s.Name?.toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.Status === statusFilter;
    return matchText && matchStatus;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold">Service Manager</h2>
          <p className="text-xs text-gray-500 mt-0.5">{services.length} services</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            {['all', 'Running', 'Stopped'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
              className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-40" />
          </div>
          <Btn onClick={load} loading={loading} variant="secondary">
            <RefreshCw size={13} /> Refresh
          </Btn>
        </div>
      </div>

      {error && <div className="mb-3"><Err msg={error} /></div>}

      {loading && services.length === 0 ? (
        <div className="flex items-center justify-center h-40"><Spinner /></div>
      ) : (
        <div className="overflow-auto rounded-xl border border-gray-800 flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Display Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">Start Type</th>
                <th className="px-4 py-2.5 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {visible.map(svc => {
                const isRunning = svc.Status === 'Running';
                const key = `${svc.Name}:`;
                return (
                  <tr key={svc.Name} className="hover:bg-gray-800/40">
                    <td className="px-4 py-2">
                      <div className="text-gray-200 font-medium">{svc.DisplayName}</div>
                      <div className="text-xs text-gray-600">{svc.Name}</div>
                    </td>
                    <td className={`px-4 py-2 font-medium text-sm ${statusColor(svc.Status)}`}>{svc.Status}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{svc.StartType}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        {!isRunning && (
                          <button onClick={() => control(svc, 'start')}
                            disabled={!!busy} title="Start"
                            className="p-1.5 rounded text-green-400 hover:bg-green-900/30 disabled:opacity-40 transition-colors">
                            {busy === `${svc.Name}:start` ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                          </button>
                        )}
                        {isRunning && (
                          <button onClick={() => control(svc, 'stop')}
                            disabled={!!busy} title="Stop"
                            className="p-1.5 rounded text-red-400 hover:bg-red-900/30 disabled:opacity-40 transition-colors">
                            {busy === `${svc.Name}:stop` ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
                          </button>
                        )}
                        {isRunning && (
                          <button onClick={() => control(svc, 'restart')}
                            disabled={!!busy} title="Restart"
                            className="p-1.5 rounded text-yellow-400 hover:bg-yellow-900/30 disabled:opacity-40 transition-colors">
                            {busy === `${svc.Name}:restart` ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && !loading && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600 text-sm">No services found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Inventory Tab ──────────────────────────────────────────────
function InventoryTab({ sendTool, online }) {
  const [loading, setLoading] = useState(false);
  const [software, setSoftware] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!online) return;
    setLoading(true); setError(null);
    try {
      const data = await sendTool('inventory');
      setSoftware(data.software || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sendTool, online]);

  const visible = software.filter(s =>
    !filter ||
    s.DisplayName?.toLowerCase().includes(filter.toLowerCase()) ||
    s.Publisher?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold">Software Inventory</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {software.length > 0 ? `${software.length} applications installed` : 'Installed applications on remote device'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {software.length > 0 && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by name / publisher…"
                className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-56" />
            </div>
          )}
          <Btn onClick={load} loading={loading} variant={software.length ? 'secondary' : 'primary'}>
            {software.length ? <><RefreshCw size={13} /> Refresh</> : <><Package size={13} /> Load Inventory</>}
          </Btn>
        </div>
      </div>

      {error && <div className="mb-3"><Err msg={error} /></div>}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Spinner />
          <p className="text-xs text-gray-500">Reading registry…</p>
        </div>
      ) : software.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-800 text-gray-600">
          <Package size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Click "Load Inventory" to fetch installed software</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-gray-800 flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Application</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-36">Version</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-44">Publisher</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">Install Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {visible.map((s, i) => (
                <tr key={i} className="hover:bg-gray-800/40">
                  <td className="px-4 py-2 text-gray-200">{s.DisplayName}</td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">{s.DisplayVersion || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{s.Publisher || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {s.InstallDate
                      ? `${s.InstallDate}`.slice(0, 4) + '-' + `${s.InstallDate}`.slice(4, 6) + '-' + `${s.InstallDate}`.slice(6, 8)
                      : '—'}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600 text-sm">No results for "{filter}"</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Files Tab ──────────────────────────────────────────────────
function FilesTab({ sendTool, online }) {
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [pathInput, setPathInput] = useState('');
  const [downloading, setDownloading] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);
  const uploadRef = useRef(null);

  const listDir = useCallback(async (p) => {
    if (!online) return;
    setLoading(true); setError(null);
    try {
      const data = await sendTool('file:list', { path: p || undefined });
      setCurrentPath(data.path);
      setPathInput(data.path);
      setEntries(data.entries || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sendTool, online]);

  useEffect(() => { if (online) listDir(''); }, [online, listDir]);

  const navigate = (entry) => {
    if (!entry.isDir) return;
    listDir(`${currentPath}${currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : (currentPath.includes('\\') ? '\\' : '/')}${entry.name}`);
  };

  const goUp = () => {
    const sep = currentPath.includes('\\') ? '\\' : '/';
    const parts = currentPath.replace(/[/\\]$/, '').split(sep);
    if (parts.length <= 1) return;
    parts.pop();
    listDir(parts.join(sep) || sep);
  };

  const download = async (entry) => {
    setDownloading(entry.name);
    try {
      const sep = currentPath.includes('\\') ? '\\' : '/';
      const filePath = `${currentPath}${currentPath.endsWith(sep) ? '' : sep}${entry.name}`;
      const data = await sendTool('file:download', { path: filePath });
      const blob = new Blob([Uint8Array.from(atob(data.data), c => c.charCodeAt(0))]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.name; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${data.name}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(null);
    }
  };

  const deleteFile = async (entry) => {
    if (!confirm(`Delete "${entry.name}"?`)) return;
    setDeleting(entry.name);
    try {
      const sep = currentPath.includes('\\') ? '\\' : '/';
      const filePath = `${currentPath}${currentPath.endsWith(sep) ? '' : sep}${entry.name}`;
      await sendTool('file:delete', { path: filePath });
      toast.success(`Deleted ${entry.name}`);
      setEntries(prev => prev.filter(e => e.name !== entry.name));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return toast.error('File too large (max 100MB)');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ev.target.result)));
      const sep = currentPath.includes('\\') ? '\\' : '/';
      const filePath = `${currentPath}${currentPath.endsWith(sep) ? '' : sep}${file.name}`;
      try {
        await sendTool('file:upload', { path: filePath, data: b64 });
        toast.success(`Uploaded ${file.name}`);
        listDir(currentPath);
      } catch (err) {
        toast.error(err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const fmtSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Path bar */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => listDir('')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Root">
          <Home size={14} />
        </button>
        <button onClick={goUp} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Up">
          <ChevronLeft size={14} />
        </button>
        <form className="flex-1" onSubmit={e => { e.preventDefault(); listDir(pathInput); }}>
          <input
            value={pathInput}
            onChange={e => setPathInput(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            placeholder="Enter path…"
          />
        </form>
        <Btn onClick={() => listDir(currentPath)} loading={loading} variant="secondary">
          <RefreshCw size={13} />
        </Btn>
        <input type="file" ref={uploadRef} onChange={upload} className="hidden" />
        <Btn onClick={() => uploadRef.current?.click()} variant="secondary">
          <Upload size={13} /> Upload
        </Btn>
      </div>

      {error && <div className="mb-3"><Err msg={error} /></div>}

      {loading ? (
        <div className="flex items-center justify-center h-40"><Spinner /></div>
      ) : (
        <div className="overflow-auto rounded-xl border border-gray-800 flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Size</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-40">Modified</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {entries.map(entry => (
                <tr key={entry.name} className={`hover:bg-gray-800/40 ${entry.isDir ? 'cursor-pointer' : ''}`}
                    onClick={entry.isDir ? () => navigate(entry) : undefined}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {entry.isDir
                        ? <Folder size={15} className="text-indigo-400 flex-shrink-0" />
                        : <FileText size={15} className="text-gray-500 flex-shrink-0" />}
                      <span className={entry.isDir ? 'text-indigo-300 font-medium' : 'text-gray-300'}>{entry.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                    {entry.isDir ? '—' : fmtSize(entry.size)}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(entry.modified).toLocaleString()}
                  </td>
                  <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      {!entry.isDir && (
                        <button onClick={() => download(entry)} disabled={!!downloading}
                          className="p-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-40 hover:bg-indigo-900/20 rounded transition-colors" title="Download">
                          {downloading === entry.name ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        </button>
                      )}
                      <button onClick={() => deleteFile(entry)} disabled={!!deleting}
                        className="p-1.5 text-red-500 hover:text-red-400 disabled:opacity-40 hover:bg-red-900/20 rounded transition-colors" title="Delete">
                        {deleting === entry.name ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600 text-sm">Empty directory</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Remote View Tab ────────────────────────────────────────────
function RemoteViewTab({ socket, socketRef, deviceId, online }) {
  const [streaming, setStreaming]       = useState(false);
  const [quality, setQuality]           = useState(50);
  const [fps, setFps]                   = useState(2);
  const [inputEnabled, setInputEnabled] = useState(false);
  const [actualFps, setActualFps]       = useState(0);
  const [frameInfo, setFrameInfo]       = useState(null);
  const [noFrameWarning, setNoFrameWarning] = useState(false);
  const imgRef         = useRef(null);
  const frameCountRef  = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());
  const frameDimsRef   = useRef({ width: 1920, height: 1080 });
  const movThrottleRef = useRef(null);
  const streamingRef   = useRef(false);
  const noFrameTimerRef = useRef(null);
  const firstFrameRef  = useRef(false);

  // Receive frames
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (String(data.deviceId) !== String(deviceId)) return;
      // Got first frame — clear the no-frame warning timer
      if (!firstFrameRef.current) {
        firstFrameRef.current = true;
        setNoFrameWarning(false);
        if (noFrameTimerRef.current) { clearTimeout(noFrameTimerRef.current); noFrameTimerRef.current = null; }
      }
      if (imgRef.current) imgRef.current.src = `data:image/jpeg;base64,${data.image}`;
      if (data.width && data.height) {
        frameDimsRef.current = { width: data.width, height: data.height };
        setFrameInfo(fi => (fi?.width === data.width && fi?.height === data.height) ? fi : { width: data.width, height: data.height });
      }
      frameCountRef.current++;
      const now = Date.now();
      const elapsed = (now - lastFpsTimeRef.current) / 1000;
      if (elapsed >= 2) {
        setActualFps(Math.round(frameCountRef.current / elapsed));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    };
    socket.on('rdview:frame', handler);
    return () => socket.off('rdview:frame', handler);
  }, [socket, deviceId]);

  // Stop on unmount
  useEffect(() => {
    return () => {
      if (noFrameTimerRef.current) clearTimeout(noFrameTimerRef.current);
      const sock = socket || socketRef?.current;
      if (sock && streamingRef.current) sock.emit('rdview:stop', { deviceId });
    };
  }, [socket, socketRef, deviceId]);

  const startStream = () => {
    // Use socketRef as fallback in case liveSocket state hasn't updated yet
    const sock = socket || socketRef?.current;
    if (!sock) return;
    sock.emit('rdview:start', { deviceId, quality, fps });
    setStreaming(true);
    streamingRef.current = true;
    setActualFps(0);
    setNoFrameWarning(false);
    firstFrameRef.current = false;
    frameCountRef.current = 0;
    lastFpsTimeRef.current = Date.now();
    // Warn after 12s if no frame received
    if (noFrameTimerRef.current) clearTimeout(noFrameTimerRef.current);
    noFrameTimerRef.current = setTimeout(() => {
      if (!firstFrameRef.current) setNoFrameWarning(true);
    }, 12000);
  };

  const stopStream = () => {
    const sock = socket || socketRef?.current;
    if (sock) sock.emit('rdview:stop', { deviceId });
    setStreaming(false);
    streamingRef.current = false;
    setActualFps(0);
    setNoFrameWarning(false);
    if (noFrameTimerRef.current) { clearTimeout(noFrameTimerRef.current); noFrameTimerRef.current = null; }
    if (imgRef.current) imgRef.current.removeAttribute('src');
  };

  const handleMouseDown = (e) => {
    if (!inputEnabled) return;
    e.preventDefault();
    const sock = socket || socketRef?.current;
    if (!sock) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width  * frameDimsRef.current.width);
    const y = Math.round((e.clientY - rect.top)  / rect.height * frameDimsRef.current.height);
    sock.emit('rdview:input', { deviceId, type: 'click', x, y, button: e.button === 2 ? 'right' : 'left' });
  };

  const handleMouseMove = (e) => {
    if (!inputEnabled || movThrottleRef.current) return;
    const sock = socket || socketRef?.current;
    if (!sock) return;
    movThrottleRef.current = setTimeout(() => { movThrottleRef.current = null; }, 80);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width  * frameDimsRef.current.width);
    const y = Math.round((e.clientY - rect.top)  / rect.height * frameDimsRef.current.height);
    sock.emit('rdview:input', { deviceId, type: 'mousemove', x, y });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-white font-semibold">Remote View</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {frameInfo ? `${frameInfo.width}\u00d7${frameInfo.height}` : 'Live screen streaming'}
            {streaming && ` \u2022 ${actualFps} fps`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!streaming && <>
            <label className="text-xs text-gray-500">Quality</label>
            <select value={quality} onChange={e => setQuality(+e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value={30}>Low (30%)</option>
              <option value={50}>Med (50%)</option>
              <option value={75}>High (75%)</option>
            </select>
            <label className="text-xs text-gray-500">FPS</label>
            <select value={fps} onChange={e => setFps(+e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value={1}>1 fps</option>
              <option value={2}>2 fps</option>
              <option value={5}>5 fps</option>
            </select>
          </>}
          {streaming && (
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={inputEnabled} onChange={e => setInputEnabled(e.target.checked)}
                className="accent-indigo-500 cursor-pointer" />
              Enable Input
            </label>
          )}
          {!streaming
            ? <Btn onClick={startStream} disabled={!online || !socket}><Monitor size={14} /> Start Streaming</Btn>
            : <Btn onClick={stopStream} variant="danger"><Square size={14} /> Stop</Btn>
          }
        </div>
      </div>

      {!streaming ? (
        <div className="flex flex-col items-center justify-center flex-1 rounded-xl border border-gray-800 text-gray-600">
          <Monitor size={48} className="mb-3 opacity-20" />
          <p className="text-sm">Click "Start Streaming" to view the remote screen live</p>
          <p className="text-xs mt-1.5 text-gray-700">First frame may take a few seconds while the agent loads display libraries</p>
        </div>
      ) : (
        <div
          className={`relative flex-1 rounded-xl overflow-hidden border border-gray-700 bg-black min-h-0 ${inputEnabled ? 'cursor-crosshair' : 'cursor-default'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onContextMenu={e => e.preventDefault()}
        >
          <img ref={imgRef} className="w-full h-full object-contain" alt="Remote screen" draggable={false} />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
            <span className="flex items-center gap-1 text-xs bg-black/70 text-green-400 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
              Live
            </span>
            {frameInfo && (
              <span className="text-xs bg-black/70 text-gray-400 px-2 py-0.5 rounded-full">
                {frameInfo.width}&times;{frameInfo.height} &bull; {actualFps} fps
              </span>
            )}
          </div>
          {noFrameWarning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
              <AlertCircle size={36} className="text-yellow-400" />
              <p className="text-white font-semibold">No frames received from agent</p>
              <p className="text-gray-400 text-sm text-center max-w-sm">
                The agent on this device may be outdated and does not support Remote View.
              </p>
              <a
                href="/downloads/NexusIT-Setup.exe"
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download size={14} /> Download latest agent
              </a>
              <p className="text-xs text-gray-600">Install on the remote machine, then try again</p>
            </div>
          )}
          {inputEnabled && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs bg-black/70 text-yellow-400 px-3 py-1 rounded-full pointer-events-none">
              Input Active — clicks affect the remote screen
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function RemoteToolsPage() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();

  const [device, setDevice] = useState(null);
  const [tab, setTab] = useState(0);
  const [liveSocket, setLiveSocket] = useState(null);

  const socketRef  = useRef(null);
  const pendingRef = useRef({});

  useEffect(() => {
    api.get(`/devices/${deviceId}`)
      .then(({ data }) => setDevice(data))
      .catch(() => toast.error('Device not found'));
  }, [deviceId]);

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/client`, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => setLiveSocket(socket));
    // Fix race condition: if socket already connected by the time listener registered
    if (socket.connected) setLiveSocket(socket);

    socket.on('tool:result', (result) => {
      const pending = pendingRef.current[result.requestId];
      if (!pending) return;
      delete pendingRef.current[result.requestId];
      clearTimeout(pending.timer);
      if (result.error) pending.reject(new Error(result.error));
      else pending.resolve(result.data);
    });

    socket.on('device:offline', ({ deviceId: id }) => {
      if (String(id) === String(deviceId)) {
        setDevice(d => d ? { ...d, status: 'offline' } : d);
        toast.error('Device went offline');
      }
    });

    return () => socket.disconnect();
  }, [token, deviceId]);

  const sendTool = useCallback((tool, params = {}) => {
    return new Promise((resolve, reject) => {
      const requestId = makeId();
      const timer = setTimeout(() => {
        delete pendingRef.current[requestId];
        reject(new Error(`Tool request timed out (${tool})`));
      }, 45000);
      pendingRef.current[requestId] = { resolve, reject, timer };
      socketRef.current?.emit('tool:request', { deviceId, requestId, tool, params });
    });
  }, [deviceId]);

  const online = device?.status === 'online';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => navigate('/devices')}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold truncate">{device?.hostname || 'Loading…'}</div>
          <div className="text-xs text-gray-500 truncate">{device?.ip_address || device?.public_ip} — Remote Tools</div>
        </div>
        <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${online ? 'bg-green-900/60 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
          {online ? '● Online' : '○ Offline'}
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-800 bg-gray-900 px-6 flex-shrink-0">
        {TABS.map(({ label, icon: Icon }, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === i
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {!online && (
        <div className="px-6 py-3 bg-yellow-900/20 border-b border-yellow-800 flex-shrink-0">
          <p className="text-yellow-400 text-xs flex items-center gap-2">
            <AlertCircle size={13} />
            Device is offline — tools cannot run until it reconnects
          </p>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col">
          {tab === 0 && <ScreenshotTab sendTool={sendTool} online={online} />}
          {tab === 1 && <ProcessesTab sendTool={sendTool} online={online} />}
          {tab === 2 && <ServicesTab sendTool={sendTool} online={online} />}
          {tab === 3 && <InventoryTab sendTool={sendTool} online={online} />}
          {tab === 4 && <FilesTab sendTool={sendTool} online={online} />}
          {tab === 5 && <RemoteViewTab socket={liveSocket} socketRef={socketRef} deviceId={deviceId} online={online} />}
        </div>
      </div>
    </div>
  );
}
