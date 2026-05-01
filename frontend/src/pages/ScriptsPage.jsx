import { useState, useEffect } from 'react';
import { FileCode2, Plus, Play, Trash2, Search, X, Loader2 } from 'lucide-react';
import { scriptsAPI, devicesAPI } from '../lib/api';
import toast from 'react-hot-toast';

const mockScripts = [
  { id: '1', name: 'Clear DNS Cache', description: 'Flushes DNS resolver cache', type: 'powershell', content: 'ipconfig /flushdns', created_by: { first_name: 'Admin' }, created_at: new Date('2026-01-10') },
  { id: '2', name: 'Check Disk Health', description: 'Runs CHKDSK on C drive', type: 'powershell', content: 'chkdsk C: /f /r', created_by: { first_name: 'Admin' }, created_at: new Date('2026-01-15') },
  { id: '3', name: 'System File Check', description: 'Verifies integrity of system files', type: 'powershell', content: 'sfc /scannow', created_by: { first_name: 'Admin' }, created_at: new Date('2026-02-01') },
  { id: '4', name: 'List Running Processes', description: 'Shows all running processes', type: 'powershell', content: 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 20', created_by: { first_name: 'Admin' }, created_at: new Date('2026-02-10') },
];

const typeColors = {
  powershell: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  bash: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  python: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

export default function ScriptsPage() {
  const [scripts, setScripts] = useState(mockScripts);
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [executing, setExecuting] = useState(null);
  const [confirmExec, setConfirmExec] = useState(null); // { script, deviceId }
  const [selectedDevice, setSelectedDevice] = useState('');

  useEffect(() => {
    scriptsAPI.getAll().then(({ data }) => { if (data.scripts?.length) setScripts(data.scripts); }).catch(() => {});
    devicesAPI.getAll().then(({ data }) => { if (data.devices?.length) setDevices(data.devices); }).catch(() => {});
  }, []);

  const filtered = scripts.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  const requestExecute = (script) => {
    if (!selectedDevice) { toast.error('Select a target device first'); return; }
    setConfirmExec({ script, deviceId: selectedDevice });
  };

  const confirmAndExecute = async () => {
    const { script, deviceId } = confirmExec;
    setConfirmExec(null);
    setExecuting(script.id);
    try {
      await scriptsAPI.execute(script.id, { device_id: deviceId });
      toast.success(`"${script.name}" sent to device`);
    } catch { toast.error('Execution failed'); }
    finally { setExecuting(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Scripts</h2>
          <p className="text-sm text-white/40 mt-1">{scripts.length} scripts available</p>
        </div>
        <button className="glass-button flex items-center gap-2"><Plus className="w-4 h-4" />New Script</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" placeholder="Search scripts..." value={search} onChange={e => setSearch(e.target.value)} className="glass-input w-full pl-10" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30"><X className="w-4 h-4" /></button>}
        </div>
        <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)} className="glass-input min-w-[180px]">
          <option value="">— Select target device —</option>
          {devices.map(d => <option key={d.id} value={d.id}>{d.hostname}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(script => (
          <div key={script.id} className="glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                  <FileCode2 className="w-4 h-4 text-brand-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{script.name}</h3>
                  <p className="text-xs text-white/40 mt-0.5">{script.description}</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${typeColors[script.type] || typeColors.powershell}`}>
                {script.type}
              </span>
            </div>
            <div className="mt-4 bg-black/20 rounded-lg p-3 font-mono text-xs text-white/50 overflow-x-auto">
              {script.content?.slice(0, 120)}{script.content?.length > 120 ? '…' : ''}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-white/25">by {script.created_by?.first_name}</span>
              <div className="flex items-center gap-2">
                <button className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => requestExecute(script)}
                  disabled={executing === script.id}
                  className="glass-button flex items-center gap-1.5 text-xs py-1.5"
                >
                  {executing === script.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Run
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmExec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-white mb-2">Confirm Execution</h3>
            <p className="text-sm text-white/50 mb-4">
              Run <span className="text-white font-medium">"{confirmExec.script.name}"</span> on the selected device?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmExec(null)} className="glass-button-outline">Cancel</button>
              <button onClick={confirmAndExecute} className="glass-button">Execute</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
